import { bluffDisplayForm, type SozlukWordType } from "@glix/engine";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { hapticError, hapticTap } from "../../fx/haptics.js";
import { fail, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { sozlukProp } from "../../ui/props.js";
import { CrewStrip } from "./Crew.js";
import { clearDrafts, draftKey, readDraft, writeDraft } from "./draft.js";
import { quillSound } from "./sounds.js";
import {
  bluffErrorText,
  type CrewMember,
  canSubmitBluff,
  clockLevel,
  insertTemplate,
  type SozlukScreenView,
  templatesFor,
} from "./view.js";

const MAX_LENGTH = 100;

/** Garip kelime: sözlük maddesi plakası; altında sözlükteki gibi küçük italik tür satırı (SB-M3). */
export function Term(props: {
  word: string;
  type: SozlukWordType | null;
  small?: boolean;
  secs?: number | null;
}) {
  return (
    <div class="sb__termwrap">
      <h1 class="sb__term" data-small={props.small ? "1" : undefined}>
        <span class="sb__term-in">{props.word}</span>
        <Show when={props.secs !== undefined && props.secs !== null ? props.secs : null}>
          {(s) => (
            <span
              class="sb__secs"
              data-level={clockLevel(s())}
              role="timer"
              aria-label={`${s()} saniye kaldı`}
            >
              {s()}
            </span>
          )}
        </Show>
      </h1>
      <Show when={props.type}>{(t) => <em class="sb__type">{t()}</em>}</Show>
    </div>
  );
}

interface Props {
  view: SozlukScreenView;
  crew: CrewMember[];
  spectator: boolean;
  now: () => number;
}

/** Kalan saniye (sunucu saatiyle, 250 ms'de bir). */
function createSecs(endsAt: () => number, now: () => number): () => number {
  const read = () => Math.max(0, Math.ceil((endsAt() - now()) / 1000));
  const [secs, setSecs] = createSignal(read());
  const t = setInterval(() => setSecs(read()), 250);
  onCleanup(() => clearInterval(t));
  return secs;
}

/**
 * Sahte tanım yazma (SB-U1): açık bir sözlük sayfası; madde başı (kelime + tür), sözlük satırı gibi yazı alanı, kalıp
 * düğmeleri (SB-U2) ve "Kartta böyle görünecek" önizlemesi. Gönder aynı zamanda Tamam'dır (tek, kesin gönderim).
 * Taslak cihazda geçici tutulur (SB-U11).
 */
export function Write(props: Props) {
  const key = draftKey(props.view.startedAt, props.view.word);
  const [text, setText] = createSignal(readDraft(key));
  const [sent, setSent] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const secs = createSecs(() => props.view.writeEndsAt, props.now);
  let field: HTMLTextAreaElement | undefined;

  const mine = () => props.view.myBluff ?? sent();
  const locked = () => mine() !== null;
  const update = (value: string): void => {
    setText(value);
    writeDraft(key, value);
    if (error()) setError("");
  };

  const submit = async (e?: Event): Promise<void> => {
    e?.preventDefault();
    const value = text();
    if (props.spectator || locked() || busy() || !canSubmitBluff(value, MAX_LENGTH)) return;
    unlockAudio();
    setBusy(true);
    setError("");
    // Tanım hemen kilitlenir; sunucu reddederse (ör. gerçek anlamın aynısı) alan geri açılır.
    const shown = bluffDisplayForm(value);
    setSent(shown);
    field?.blur();
    quillSound();
    hapticTap();
    const ack = await sendActionAck({ kind: "bluff", text: value });
    setBusy(false);
    if (ack.ok || ack.reason === "already_written") {
      setSent(shown);
      clearDrafts();
    } else {
      setSent(null);
      setError(bluffErrorText(ack.reason));
      fail();
      hapticError();
    }
  };

  const useTemplate = (i: number): void => {
    const t = templatesFor(props.view.wordType)[i];
    if (!t || !field) return;
    const r = insertTemplate(
      text(),
      field.selectionStart ?? text().length,
      field.selectionEnd ?? text().length,
      t,
    );
    if ([...r.text].length > MAX_LENGTH) return;
    update(r.text);
    field.value = r.text;
    field.focus();
    field.setSelectionRange(r.caret, r.caret);
  };

  const count = () => [...text()].length;
  const preview = () => bluffDisplayForm(text());
  const page = sozlukProp("sayfa");
  return (
    <>
      <div class="sb__head">
        <span class="overline">{props.spectator ? "Arkadaşların yazıyor" : "Bu kelimenin anlamı ne?"}</span>
      </div>

      <div class="sb__mid">
        <Show
          when={!props.spectator}
          fallback={
            <>
              <Term word={props.view.word} type={props.view.wordType} secs={secs()} />
              <p class="sb__watch">
                Tanımlar karışınca görünür · {props.view.ready.length}/{props.crew.length} hazır
              </p>
            </>
          }
        >
          <Show
            when={!locked()}
            fallback={
              <>
                <Term word={props.view.word} type={props.view.wordType} small secs={secs()} />
                <Deck mine={mine() ?? ""} ready={props.view.ready.length} total={props.crew.length} />
              </>
            }
          >
            <form
              class="sbpage"
              data-art={page ? "1" : undefined}
              style={page ? { "--sb-page": `url(${page})` } : undefined}
              onSubmit={submit}
              autocomplete="off"
            >
              <span class="sbpage__tab" aria-hidden="true">
                {[...props.view.word][0] ?? ""}
              </span>
              <Term word={props.view.word} type={props.view.wordType} secs={secs()} />
              <div class="sbpage__tpl" data-scroll data-dim={count() > 0 ? "1" : undefined}>
                <For each={templatesFor(props.view.wordType)}>
                  {(t, i) => (
                    <button
                      type="button"
                      class="sbpage__chip"
                      // Klavye kapanmasın: odak alanda kalır.
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => useTemplate(i())}
                    >
                      {t.label}
                    </button>
                  )}
                </For>
              </div>
              <label class="sbpage__line">
                <span class="sbpage__head" aria-hidden="true">
                  <b>{props.view.word}</b>
                  <Show when={props.view.wordType}>{(t) => <i> {t()}</i>}</Show> —
                </span>
                <textarea
                  ref={field}
                  class="sbpage__field"
                  rows="3"
                  enterkeyhint="send"
                  autocomplete="off"
                  autocapitalize="sentences"
                  spellcheck={false}
                  maxlength={MAX_LENGTH}
                  placeholder="gerçek gibi görünen sahte bir anlam…"
                  aria-label="Sahte tanımın"
                  value={text()}
                  onInput={(e) => update(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                />
              </label>
              <div class="sbpage__meta">
                <span class="sbpage__prev" data-empty={preview() === "" ? "1" : undefined}>
                  <small>Kartta böyle görünecek:</small> {preview()}
                </span>
                <span class="sb__count" data-near={count() >= 90 ? "1" : undefined}>
                  {count()}/{MAX_LENGTH}
                </span>
              </div>
              <span class="sb__err" role="alert">
                {error()}
              </span>
              <PrimaryButton type="submit" busy={busy()} disabled={!canSubmitBluff(text(), MAX_LENGTH)}>
                Gönder
              </PrimaryButton>
            </form>
          </Show>
        </Show>
      </div>

      <CrewStrip crew={props.crew} ready={props.view.ready} label="Tanımını gönderenler" />
    </>
  );
}

/**
 * "Sözlüğe işleniyor" (SB-U3): gönderilen tanım kart olarak desteye iner; destede gönderilen kart sayısı kadar ters kart
 * birikir (sahipsiz, içerik görünmez). Kendi tanımın 2 sn okunur, sonra ters döner; basılı tutunca yeniden görünür.
 * Herkes gönderince deste karılır.
 */
function Deck(props: { mine: string; ready: number; total: number }) {
  const [peek, setPeek] = createSignal(true);
  const [hold, setHold] = createSignal(false);
  onMount(() => {
    const t = setTimeout(() => setPeek(false), 2_000);
    onCleanup(() => clearTimeout(t));
  });
  const all = () => props.total > 0 && props.ready >= props.total;
  const backs = () => Math.max(0, Math.min(8, props.ready) - 1);
  return (
    <div class="sbdeck" role="status" data-shuffle={all() ? "1" : undefined}>
      <span class="sbdeck__title">Sözlüğe işleniyor</span>
      <button
        type="button"
        class="sbdeck__pile"
        onPointerDown={() => setHold(true)}
        onPointerUp={() => setHold(false)}
        onPointerLeave={() => setHold(false)}
        onPointerCancel={() => setHold(false)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Tanımın (görmek için basılı tut)"
      >
        <For each={Array.from({ length: backs() })}>
          {(_, i) => <i class="sbdeck__back" style={{ "--i": i() }} aria-hidden="true" />}
        </For>
        <span class="sbdeck__mine" data-open={peek() || hold() ? "1" : undefined} style={{ "--i": backs() }}>
          <span class="sbdeck__face">{props.mine}</span>
          <i class="sbdeck__cover" aria-hidden="true" />
        </span>
      </button>
      <span class="sbdeck__hint">{peek() || hold() ? "Senin tanımın" : "Görmek için basılı tut"}</span>
      <span class="sblock__wait">
        {all() ? "Herkes yazdı · deste karılıyor" : `${props.ready}/${props.total} tanım geldi`}
      </span>
    </div>
  );
}
