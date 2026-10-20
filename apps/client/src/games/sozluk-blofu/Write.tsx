// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import { createSignal, type JSX, Show } from "solid-js";
import { hapticError, hapticReady } from "../../fx/haptics.js";
import { fail, ready as readySound, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { CrewStrip } from "./Crew.js";
import { bluffErrorText, type CrewMember, canSubmitBluff, type SozlukScreenView } from "./view.js";

const MAX_LENGTH = 100;

const LockIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="3" fill="currentColor" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
  </svg>
);

/** Garip kelime: sözlük maddesi plakası. */
export function Term(props: { word: string; small?: boolean }) {
  return (
    <h1 class="sb__term" data-small={props.small ? "1" : undefined}>
      <span class="sb__term-in">{props.word}</span>
    </h1>
  );
}

interface Props {
  view: SozlukScreenView;
  crew: CrewMember[];
  spectator: boolean;
}

/** Sahte tanım yazma: tek, kesin gönderim ("Gönder" aynı zamanda Tamam). */
export function Write(props: Props) {
  const [text, setText] = createSignal("");
  const [sent, setSent] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  let field: HTMLTextAreaElement | undefined;

  const mine = () => props.view.myBluff ?? sent();
  const locked = () => mine() !== null;

  const submit = async (e?: Event): Promise<void> => {
    e?.preventDefault();
    const value = text();
    if (props.spectator || locked() || busy() || !canSubmitBluff(value, MAX_LENGTH)) return;
    unlockAudio();
    setBusy(true);
    setError("");
    const ack = await sendActionAck({ kind: "bluff", text: value });
    setBusy(false);
    if (ack.ok) {
      setSent(value.replace(/\s+/gu, " ").trim());
      field?.blur();
      readySound();
      hapticReady();
    } else if (ack.reason === "already_written") {
      setSent(value.replace(/\s+/gu, " ").trim());
    } else {
      setError(bluffErrorText(ack.reason));
      fail();
      hapticError();
    }
  };

  const count = () => [...text()].length;
  return (
    <>
      <div class="sb__head">
        <span class="overline">{props.spectator ? "Arkadaşların yazıyor" : "Bu kelimenin anlamı ne?"}</span>
        <Term word={props.view.word} />
        <Show when={!props.spectator && !locked()}>
          <p class="sb__tip">Gerçek gibi görünen sahte bir anlam yaz</p>
        </Show>
      </div>

      <div class="sb__mid">
        <Show
          when={!props.spectator}
          fallback={
            <p class="sb__watch">
              Tanımlar karışınca görünür · {props.view.ready.length}/{props.crew.length} hazır
            </p>
          }
        >
          <Show
            when={!locked()}
            fallback={
              <div class="sblock" role="status">
                <span class="sblock__icon">
                  <LockIcon />
                </span>
                <span class="sblock__title">Tanımın kilitlendi</span>
                <span class="sblock__text">{mine()}</span>
                <span class="sblock__wait">
                  {props.view.ready.length >= props.crew.length
                    ? "Herkes yazdı"
                    : `Diğerleri bekleniyor · ${props.view.ready.length}/${props.crew.length} hazır`}
                </span>
              </div>
            }
          >
            <form class="sb__form" onSubmit={submit} autocomplete="off">
              <textarea
                ref={field}
                class="field sb__field"
                rows="3"
                enterkeyhint="send"
                autocomplete="off"
                autocapitalize="sentences"
                spellcheck={false}
                maxlength={MAX_LENGTH}
                placeholder="Kendi tanımını yaz…"
                aria-label="Sahte tanımın"
                value={text()}
                onInput={(e) => {
                  setText(e.currentTarget.value);
                  if (error()) setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
              <div class="sb__meta">
                <span class="sb__err" role="alert">
                  {error()}
                </span>
                <span class="sb__count" data-near={count() >= 90 ? "1" : undefined}>
                  {count()}/{MAX_LENGTH}
                </span>
              </div>
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
