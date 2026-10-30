import type { Clue } from "@glix/engine";
import { createSignal, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { hapticTap } from "../../fx/haptics.js";
import { tap } from "../../fx/sound.js";
import { propSrc } from "../../ui/props.js";
import { ClueDiagram } from "./ClueDiagram.js";
import { clueText } from "./view.js";

/** Kâğıt dokusu görseli varsa o, yoksa CSS kâğıdı (buruşukluk, bant). */
function Paper(props: { big?: boolean; clue: Clue }) {
  const [art, setArt] = createSignal(false);
  return (
    <div class="kpn__paper" data-art={art() ? "1" : undefined} data-big={props.big ? "1" : undefined}>
      <img
        class="kpn__art"
        src={propSrc("kontrol-paneli-kaosu/not-kagidi")}
        alt=""
        aria-hidden="true"
        draggable={false}
        onLoad={() => setArt(true)}
        onError={() => setArt(false)}
      />
      <i class="kpn__tape" aria-hidden="true" />
      <span class="kpn__badge">🎤 Sesli oku</span>
      <div class="kpn__body">
        <ClueDiagram clue={props.clue} />
        <p class="kpn__text">{clueText(props.clue)}</p>
      </div>
    </div>
  );
}

/**
 * İpucu notu: bantla tutturulmuş buruşuk kâğıt, yanıp sönen "🎤 Sesli oku" rozeti. Dokununca kâğıt büyür (masada
 * yüksek sesle okunacak kadar); tekrar dokununca ya da dışına basınca küçülür.
 */
export function Note(props: { clue: Clue }) {
  const [open, setOpen] = createSignal(false);
  const toggle = (on: boolean): void => {
    tap();
    hapticTap();
    setOpen(on);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") setOpen(false);
  };
  window.addEventListener("keydown", onKey);
  onCleanup(() => window.removeEventListener("keydown", onKey));
  return (
    <>
      <button
        type="button"
        class="kpn"
        aria-label={`İpucu notu: ${clueText(props.clue)}. Büyütmek için dokun.`}
        onClick={() => toggle(true)}
      >
        <Paper clue={props.clue} />
      </button>
      <Show when={open()}>
        <Portal>
          <button type="button" class="kpn-zoom" aria-label="Notu küçült" onClick={() => toggle(false)}>
            <Paper clue={props.clue} big />
          </button>
        </Portal>
      </Show>
    </>
  );
}
