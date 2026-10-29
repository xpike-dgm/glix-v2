import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { hapticError, hapticReady } from "../../fx/haptics.js";
import { fail, ready as readySound, unlockAudio } from "../../fx/sound.js";
import { type ActionAck, sendActionAck } from "../../net/client.js";
import { CheckIcon } from "../../ui/Icons.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { CrewStrip } from "./Crew.js";
import {
  type CrewMember,
  canSubmitAnswer,
  LAF_MAX_LENGTH,
  type LafScreenView,
  lafErrorText,
  tidyAnswer,
} from "./view.js";

const SAVE_DELAY_MS = 700;

interface Props {
  view: LafScreenView;
  crew: CrewMember[];
  spectator: boolean;
}

/** Soru kartı: "SORU 1/2" ya da "FİNAL". */
export function PromptBubble(props: { label: string; prompt: string; final?: boolean; small?: boolean }) {
  return (
    <div
      class="lf__prompt"
      data-final={props.final ? "1" : undefined}
      data-small={props.small ? "1" : undefined}
    >
      <span class="lf__tag">{props.label}</span>
      <h1 class="lf__q">{props.prompt}</h1>
    </div>
  );
}

/** Cevap yazma: bir ya da iki soru; cevaplar kilitlenene kadar değiştirilebilir, "Tamam" kesinleştirir. */
export function Write(props: Props) {
  const tasks = () => props.view.tasks;
  const final = () => props.view.phase === "finalWrite";
  const [active, setActive] = createSignal(0);
  const [drafts, setDrafts] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [savedMark, setSavedMark] = createSignal(false);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  onCleanup(() => {
    for (const t of timers.values()) clearTimeout(t);
  });

  const current = () => tasks()[Math.min(active(), Math.max(0, tasks().length - 1))];
  const savedOf = (id: string): string => tasks().find((t) => t.id === id)?.answer ?? "";
  const draftOf = (id: string): string => drafts()[id] ?? savedOf(id);
  const dirty = (id: string): boolean => tidyAnswer(draftOf(id)) !== savedOf(id);
  const locked = () => props.view.locked;
  const hasAny = createMemo(() =>
    tasks().some((t) => canSubmitAnswer(draftOf(t.id)) || (t.answer ?? "") !== ""),
  );

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

  // Başka bir soruya geçince önceki taslak kaydedilir.
  createEffect(
    on(active, (_now, before) => {
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
          <div class="lf__head">
            <PromptBubble
              label={final() ? "Final sorusu" : `Soru ${active() + 1}/${tasks().length}`}
              prompt={t().prompt}
              final={final()}
            />
          </div>
        )}
      </Show>

      <div class="lf__mid">
        <Show
          when={!props.spectator}
          fallback={
            <p class="lf__watch">
              Cevaplar yazılıyor · {props.view.ready.length}/{props.crew.length} hazır
            </p>
          }
        >
          <Show when={tasks().length > 1 && !locked()}>
            <div class="lf__chips" role="tablist" aria-label="Sorular">
              <For each={tasks()}>
                {(t, i) => (
                  <button
                    type="button"
                    role="tab"
                    class="lf__chip"
                    aria-selected={active() === i()}
                    data-on={active() === i() ? "1" : undefined}
                    data-done={canSubmitAnswer(draftOf(t.id)) ? "1" : undefined}
                    onClick={() => setActive(i())}
                  >
                    <span>{i() + 1}</span>
                    <Show when={canSubmitAnswer(draftOf(t.id))}>
                      <CheckIcon size={16} />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Show when={current()}>
            {(t) => (
              <Show
                when={!locked()}
                fallback={
                  <ul class="lf__locked" role="status">
                    <For each={tasks()}>
                      {(k) => (
                        <li data-empty={k.answer === null ? "1" : undefined}>
                          <span>{k.answer ?? "Cevap yok"}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                }
              >
                <div class="lf__form">
                  <textarea
                    class="field lf__field"
                    rows="3"
                    enterkeyhint="done"
                    autocomplete="off"
                    autocapitalize="sentences"
                    spellcheck={false}
                    maxlength={LAF_MAX_LENGTH + 20}
                    placeholder="Komik cevabını yaz…"
                    aria-label="Cevabın"
                    value={draftOf(t().id)}
                    onInput={(e) => {
                      const id = t().id;
                      setDrafts({ ...drafts(), [id]: e.currentTarget.value });
                      setSavedMark(false);
                      if (error()) setError("");
                      schedule(id);
                    }}
                    onBlur={() => void flush(t().id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
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
              </Show>
            )}
          </Show>
        </Show>
      </div>

      <TamamBar
        dots={false}
        doneLabel="Gönderildi"
        locked={locked()}
        ready={props.view.ready.length}
        readyIds={props.view.ready}
        total={props.crew.length}
        disabled={!hasAny() || busy()}
        spectator={props.spectator}
        onLock={lockIn}
      />
      <CrewStrip crew={props.crew} ready={props.view.ready} label="Hazır olanlar" />
    </>
  );
}
