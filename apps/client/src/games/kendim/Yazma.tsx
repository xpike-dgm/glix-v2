import { createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { hapticError, hapticReady } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import type { AckLike } from "../../ui/optimistic.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { createWordDraft } from "../../ui/wordDraft.js";
import { hasWord } from "../../ui/wordInput.js";
import type { Crew } from "./KendimScreen.js";
import { Mirror } from "./Mirror.js";
import { glassTing, mirrorChime } from "./sounds.js";
import { KN_PLAN } from "./timeline.js";
import { joinWord, type KendimScreenView } from "./view.js";

interface Props {
  view: KendimScreenView;
  crew: Crew[];
  spectator: boolean;
  /** TV: dokunma yok, büyük yerleşim. */
  tv?: boolean;
}

/** Konu kartı (KN-M2): yazmada büyük, eşleştirme ve sonuçta üstte küçük. */
export function TopicLine(props: { topic: string; size: "big" | "small" }) {
  return (
    <div class="kn__topic" data-size={props.size}>
      <span class="overline">Konu</span>
      <span class="kn__topic-text">{props.topic}</span>
    </div>
  );
}

/** Portre şeridi: avatarlar ve altında adlar; Tamam diyen ✓ ile yanar (KN-U1). */
export function CrewStrip(props: { crew: Crew[]; ready: readonly string[] }) {
  return (
    <ul class="kn__crew" data-n={props.crew.length} aria-label="Oyuncular">
      <For each={props.crew}>
        {(p) => (
          <li class="kn__p" data-done={props.ready.includes(p.id) ? "1" : undefined}>
            <Avatar
              index={p.avatar}
              size="var(--kn-cav)"
              connected={p.connected}
              ready={props.ready.includes(p.id)}
            />
            <span class="kn__p-name">{p.nickname}</span>
          </li>
        )}
      </For>
    </ul>
  );
}

/** Yazma (KN-U1, KN-M3): konu aynanın üstünde; aynaya tek kelime, boşluk yok. Tamam'a kadar değiştirilebilir. */
export function Yazma(props: Props) {
  let input: HTMLInputElement | undefined;
  const draft = createWordDraft({
    server: () => props.view.myText ?? "",
    send: (text) => {
      sendAction({ kind: "write", text });
    },
    allowEmpty: false,
  });
  const [oneWord, setOneWord] = createSignal(false);
  const [flash, setFlash] = createSignal(false);
  let warnTimer: ReturnType<typeof setTimeout> | undefined;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearTimeout(warnTimer);
    clearTimeout(flashTimer);
  });
  const warn = (): void => {
    hapticError();
    setOneWord(false);
    // Yeniden tetiklemek için bir kare sonra aç (sallanma baştan oynar).
    requestAnimationFrame(() => setOneWord(true));
    clearTimeout(warnTimer);
    warnTimer = setTimeout(() => setOneWord(false), KN_PLAN.oneWordMs);
  };
  const onInput = (raw: string): void => {
    const { text, hadSpace } = joinWord(raw);
    if (hadSpace) {
      if (input) {
        const caret = Math.max(0, (input.selectionStart ?? text.length) - (raw.length - text.length));
        input.value = text;
        input.setSelectionRange(caret, caret);
      }
      warn();
    } else {
      unlockAudio();
      mirrorChime();
    }
    draft.input(text);
  };
  const bindInput = (el: HTMLInputElement): void => {
    input = el;
    // Boşluk tuşu çalışmaz: basılırsa pano sallanır (KN-M3). Yapıştırılan boşluk `onInput`ta bitiştirilir.
    el.addEventListener("beforeinput", (e) => {
      // Yalnız boşluk basıldıysa engellenir; klavye önerisi ("NEŞELİ ") gibi kelimeli ekleme geçer ve
      // boşluğu `onInput`ta atılır.
      if (e.inputType === "insertText" && e.data !== null && /^\s+$/u.test(e.data)) {
        e.preventDefault();
        warn();
      }
    });
  };
  const lock = (): AckLike => {
    if (props.spectator || props.view.locked || !hasWord(draft.text())) return false;
    draft.flush();
    glassTing();
    hapticReady();
    setFlash(true);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => setFlash(false), KN_PLAN.flashMs);
    input?.blur();
    return sendActionAck({ kind: "lock" });
  };
  return (
    <>
      <div class="kn__head kn__head--write">
        <TopicLine topic={props.view.topic} size="big" />
      </div>

      <div class="kn__mid">
        <Mirror flash={flash()} locked={props.view.locked} shake={oneWord()}>
          <Show
            when={!props.spectator}
            fallback={
              <div class="kn__idle" aria-hidden="true">
                <span>{props.tv ? "Herkes aynaya yazıyor" : "Herkes yazıyor"}</span>
              </div>
            }
          >
            <div class="kn__field" data-locked={props.view.locked ? "1" : undefined}>
              <input
                ref={bindInput}
                class="kn__input"
                type="text"
                lang="tr"
                inputmode="text"
                enterkeyhint="done"
                autocomplete="off"
                autocapitalize="none"
                autocorrect="off"
                spellcheck={false}
                maxlength={24}
                placeholder={props.view.hint}
                aria-label="Seni anlatan tek kelime"
                disabled={props.view.locked}
                value={untrack(() => props.view.myText ?? "")}
                onInput={(e) => onInput(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    lock();
                  }
                }}
              />
              <Show when={props.view.locked}>
                <svg
                  class="kn__seal"
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect x="5" y="11" width="14" height="10" rx="3" fill="currentColor" />
                  <path
                    d="M8 11V8a4 4 0 0 1 8 0v3"
                    stroke="currentColor"
                    stroke-width="2.4"
                    stroke-linecap="round"
                  />
                </svg>
              </Show>
            </div>
            <p class="kn__hint" data-warn={oneWord() ? "1" : undefined} aria-live="polite">
              {oneWord() ? "Tek kelime!" : props.view.locked ? "Aynaya kazındı" : "Tek kelime, boşluksuz"}
            </p>
          </Show>
        </Mirror>
      </div>

      <CrewStrip crew={props.crew} ready={props.view.ready} />

      <Show when={!props.tv}>
        <TamamBar
          dots={false}
          doneLabel="Gönderildi"
          locked={props.view.locked}
          ready={props.view.ready.length}
          readyIds={props.view.ready}
          total={props.crew.length}
          disabled={!hasWord(draft.text())}
          spectator={props.spectator}
          onLock={lock}
        />
      </Show>
    </>
  );
}
