import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { hapticError, hapticReady, hapticTap } from "../../fx/haptics.js";
import { fail, ready as readySound, tap, unlockAudio } from "../../fx/sound.js";
import { type ActionAck, sendActionAck } from "../../net/client.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { CrewStrip } from "./Crew.js";
import { Mic, PromptBubble } from "./Stage.js";
import { penSound } from "./sounds.js";
import {
  type CrewMember,
  canSubmitAnswer,
  emptyWarning,
  LAF_MAX_LENGTH,
  type LafScreenView,
  lafErrorText,
  tidyAnswer,
} from "./view.js";

const SAVE_DELAY_MS = 700;
/** Son tuştan sonra mikrofon bu kadar süre "dinler" (ses dalgaları). */
const MIC_LIVE_MS = 900;

interface Props {
  view: LafScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
}

/**
 * Cevap yazma: sorular sırayla tam ekran (Soru 1 → "Sıradaki" → Soru 2, geri dönülebilir; üstte iki nokta).
 * Cevaplar kilitlenene kadar değiştirilebilir; "Tamam" kesinleştirir, boş soru varsa önce kısa uyarı çıkar.
 * Klavye açıkken (görünür alan küçülünce) soru küçülür; cevap alanı ve düğme klavyenin hemen üstünde kalır.
 */
export function Write(props: Props) {
  const tasks = () => props.view.tasks;
  const final = () => props.view.phase === "finalWrite";
  const [step, setStep] = createSignal(0);
  const [dir, setDir] = createSignal<1 | -1>(1);
  const [drafts, setDrafts] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [savedMark, setSavedMark] = createSignal(false);
  const [warn, setWarn] = createSignal<string | null>(null);
  const [typing, setTyping] = createSignal(false);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let typingTimer: ReturnType<typeof setTimeout> | undefined;
  let field: HTMLTextAreaElement | undefined;
  /** Düğmeye basılırken cevap alanı odaktaydı: klavye kapanmasın diye geçişten sonra odak geri verilir. */
  let keepFocus = false;
  onCleanup(() => {
    for (const t of timers.values()) clearTimeout(t);
    clearTimeout(typingTimer);
  });

  const index = () => Math.min(step(), Math.max(0, tasks().length - 1));
  const current = () => tasks()[index()];
  const multi = () => tasks().length > 1;
  const last = () => index() >= tasks().length - 1;
  const savedOf = (id: string): string => tasks().find((t) => t.id === id)?.answer ?? "";
  const draftOf = (id: string): string => drafts()[id] ?? savedOf(id);
  const dirty = (id: string): boolean => tidyAnswer(draftOf(id)) !== savedOf(id);
  const filled = (id: string): boolean => canSubmitAnswer(draftOf(id));
  const locked = () => props.view.locked;
  const hasAny = createMemo(() => tasks().some((t) => filled(t.id) || (t.answer ?? "") !== ""));

  const flush = async (id: string): Promise<boolean> => {
    const pending = timers.get(id);
    if (pending !== undefined) {
      clearTimeout(pending);
      timers.delete(id);
    }
    if (props.spectator || locked() || !dirty(id)) return true;
    const text = draftOf(id);
    if (tidyAnswer(text) !== "" && !canSubmitAnswer(text)) {
      setError(lafErrorText("too_long"));
      return false;
    }
    const ack = await sendActionAck({ kind: "answer", prompt: id, text });
    if (ack.ok) {
      setError("");
      setSavedMark(true);
      return true;
    }
    setError(lafErrorText(ack.reason));
    fail();
    hapticError();
    return false;
  };

  const schedule = (id: string): void => {
    const old = timers.get(id);
    if (old !== undefined) clearTimeout(old);
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        void flush(id);
      }, SAVE_DELAY_MS),
    );
  };

  const lockIn = async (): Promise<ActionAck> => {
    if (props.spectator || locked() || busy()) return { ok: false, reason: "local" };
    unlockAudio();
    setBusy(true);
    // Kilit anında görünür (TamamBar); taslaklar ve kilit arka planda gider, hata olursa geri açılır.
    readySound();
    hapticReady();
    let ok = true;
    for (const t of tasks()) ok = (await flush(t.id)) && ok;
    let result: ActionAck = { ok: false, reason: "invalid" };
    if (ok) {
      result = await sendActionAck({ kind: "lock" });
      if (!result.ok && result.reason !== "locked") {
        setError(lafErrorText(result.reason));
        fail();
        hapticError();
      } else {
        result = { ok: true };
      }
    }
    setBusy(false);
    return result;
  };

  /** "Tamam": boş soru varsa önce uyarı (ikinci basış onaydır). */
  const onLock = (): Promise<ActionAck> | false => {
    if (warn() === null) {
      const w = emptyWarning(tasks().map((t) => filled(t.id)));
      if (w !== null) {
        setWarn(w);
        tap();
        hapticTap();
        return false;
      }
    }
    setWarn(null);
    return lockIn();
  };

  const goTo = (i: number): void => {
    if (i === index() || i < 0 || i >= tasks().length) return;
    setDir(i > index() ? 1 : -1);
    setStep(i);
    setWarn(null);
    if (keepFocus) field?.focus();
    keepFocus = false;
  };
  const holdFocus = (e: PointerEvent | MouseEvent): void => {
    keepFocus = document.activeElement === field;
    // Odağı cevap alanında tutar (masaüstü/Android); iOS'ta odak tıklamada geri verilir.
    if (keepFocus) e.preventDefault();
  };
  const firstEmpty = (): number => tasks().findIndex((t) => !filled(t.id));

  // Başka bir soruya geçince önceki taslak kaydedilir.
  createEffect(
    on(index, (_now, before) => {
      const t = before === undefined ? undefined : tasks()[before];
      if (t) void flush(t.id);
      setError("");
    }),
  );

  const count = (id: string) => [...draftOf(id)].length;
  return (
    <>
      <Show
        when={current()}
        fallback={
          <div class="lf__head">
            <span class="lf__watch">
              {props.spectator ? "Arkadaşların cevap yazıyor" : "Sorun bekleniyor"}
            </span>
          </div>
        }
      >
        {(t) => (
          <div class="lf__head lf__head--write">
            <Show when={multi() && !locked()}>
              <div class="lf__dots" role="tablist" aria-label="Sorular">
                <For each={tasks()}>
                  {(k, i) => (
                    <button
                      type="button"
                      role="tab"
                      class="lf__dot"
                      aria-label={`${i() + 1}. soru`}
                      aria-selected={index() === i()}
                      data-on={index() === i() ? "1" : undefined}
                      data-done={filled(k.id) ? "1" : undefined}
                      onPointerDown={holdFocus}
                      onMouseDown={holdFocus}
                      onClick={() => goTo(i())}
                    >
                      <i />
                    </button>
                  )}
                </For>
              </div>
            </Show>
            <Show when={`${t().id}`} keyed>
              {(_id) => (
                <div class="lf__slide" data-dir={dir() > 0 ? "next" : "back"}>
                  <PromptBubble
                    label={final() ? "Final sorusu" : `Soru ${index() + 1}/${tasks().length}`}
                    prompt={t().prompt}
                    final={final()}
                  />
                </div>
              )}
            </Show>
          </div>
        )}
      </Show>

      <div class="lf__mid">
        <Show when={!locked()}>
          <Mic live={typing()} />
        </Show>
        <Show when={!props.spectator && locked()}>
          <ul class="lf__locked" role="status">
            <For each={tasks()}>
              {(k) => (
                <li data-empty={k.answer === null ? "1" : undefined}>
                  <span>{k.answer ?? "Cevap yok"}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>

      <Show when={!props.spectator && !locked() ? current() : undefined}>
        {(t) => (
          <div class="lf__form">
            <textarea
              ref={field}
              class="field lf__field"
              rows="3"
              enterkeyhint={multi() && !last() ? "next" : "done"}
              autocomplete="off"
              autocapitalize="sentences"
              spellcheck={false}
              maxlength={LAF_MAX_LENGTH + 20}
              placeholder="Komik cevabını yaz…"
              aria-label={`${index() + 1}. sorunun cevabı`}
              value={draftOf(t().id)}
              onInput={(e) => {
                const id = t().id;
                setDrafts({ ...drafts(), [id]: e.currentTarget.value });
                setSavedMark(false);
                setWarn(null);
                if (error()) setError("");
                schedule(id);
                if ((e as InputEvent).inputType?.startsWith("insert")) penSound();
                setTyping(true);
                clearTimeout(typingTimer);
                typingTimer = setTimeout(() => setTyping(false), MIC_LIVE_MS);
              }}
              onBlur={() => void flush(t().id)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey) return;
                e.preventDefault();
                if (multi() && !last()) {
                  keepFocus = true;
                  goTo(index() + 1);
                } else {
                  e.currentTarget.blur();
                }
              }}
            />
            <div class="lf__meta">
              <span class="lf__err" role="alert">
                {error()}
              </span>
              <Show when={error() === "" && savedMark() && !dirty(t().id)}>
                <span class="lf__saved">Kaydedildi</span>
              </Show>
              <span
                class="lf__count"
                data-near={count(t().id) >= 70 ? "1" : undefined}
                data-over={count(t().id) > LAF_MAX_LENGTH ? "1" : undefined}
              >
                {count(t().id)}/{LAF_MAX_LENGTH}
              </span>
            </div>
          </div>
        )}
      </Show>

      <Show when={warn()}>
        {(w) => (
          <div class="lf__warn" role="alert">
            <span>{w()}</span>
            <button
              type="button"
              class="lf__warn-fix"
              onClick={() => {
                const i = firstEmpty();
                setWarn(null);
                if (i >= 0) goTo(i);
                field?.focus();
              }}
            >
              Yaz
            </button>
          </div>
        )}
      </Show>

      <div class="lf__actions">
        <Show when={!props.spectator && !locked() && multi() && index() > 0}>
          <button
            type="button"
            class="lf__back"
            aria-label="Önceki soru"
            onPointerDown={holdFocus}
            onMouseDown={holdFocus}
            onClick={() => goTo(index() - 1)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                fill="none"
                stroke="currentColor"
                stroke-width="2.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </Show>
        <Show
          when={!props.spectator && !locked() && multi() && !last()}
          fallback={
            <TamamBar
              dots={false}
              doneLabel="Gönderildi"
              label={warn() !== null ? "Evet, gönder" : "Tamam"}
              locked={locked()}
              ready={props.view.ready.length}
              readyIds={props.view.ready}
              total={props.crew.length}
              disabled={!hasAny() || busy()}
              spectator={props.spectator}
              onLock={onLock}
            />
          }
        >
          <div class="lf__nextwrap">
            <button
              type="button"
              class="pbtn pbtn--cyan lf__next"
              onPointerDown={(e) => {
                holdFocus(e);
                unlockAudio();
                tap();
                hapticTap();
              }}
              onMouseDown={holdFocus}
              onClick={() => goTo(index() + 1)}
            >
              <span class="pbtn__label">Sıradaki</span>
            </button>
            <p class="tamam__count" data-quiet="1">
              {props.view.ready.length}/{props.crew.length} hazır
            </p>
          </div>
        </Show>
      </div>
      <CrewStrip
        crew={props.crew}
        ready={props.view.ready}
        scores={props.view.scores}
        selfId={props.selfId}
        label="Hazır olanlar ve kahkaha puanları"
      />
    </>
  );
}
