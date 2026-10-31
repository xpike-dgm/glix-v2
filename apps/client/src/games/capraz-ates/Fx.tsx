import { Show } from "solid-js";
import { cxArtSrc, hasArt } from "./art.js";

/** Son 5 saniye: ekran hafifçe kararır; son 3 saniyede büyük "3 · 2 · 1". Dokunuşu geçirir. */
export function Duel(props: { label: string }) {
  return (
    <div class="cx-duel" aria-hidden="true">
      <i class="cx-duel__shade" />
      <Show when={props.label !== ""}>
        {/* Her sayı kendi öğesi: değişince yeniden belirir. */}
        <Show when={props.label} keyed>
          {(n) => <span class="cx-duel__n">{n}</span>}
        </Show>
      </Show>
    </div>
  );
}

/** "ATEŞ!" anı: kısa flaş ve büyük yazı (açılışın başında). */
export function FireFlash(props: { elapsed: number }) {
  return (
    <div class="cx-fire" aria-hidden="true" style={{ "--el": `${Math.max(0, props.elapsed)}ms` }}>
      <i class="cx-fire__flash" />
      <span class="cx-fire__word">ATEŞ!</span>
    </div>
  );
}

/** Seni vurdular: ekranında cam çatlağı (isabet anında). Görsel varsa o, yoksa SVG çizgiler. */
export function Glass(props: { delay: number }) {
  return (
    <div class="cx-glass" aria-hidden="true" style={{ "--d": `${props.delay}ms` }}>
      <Show
        when={hasArt("cam-catlagi")}
        fallback={
          <svg
            class="cx-glass__svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <g class="cx-glass__lines">
              <path d="M58 40 L70 6 M58 40 L96 22 M58 40 L98 52 M58 40 L84 94 M58 40 L52 100 M58 40 L20 92 M58 40 L2 58 M58 40 L8 18 M58 40 L36 0" />
              <path d="M64 24 L76 30 L80 45 L72 64 L56 70 L40 64 L34 48 L42 30 Z" />
              <path d="M70 13 L88 26 L92 52 L80 82 L54 88 L28 80 L14 56 L20 28 L40 12 Z" />
            </g>
          </svg>
        }
      >
        <img class="cx-glass__art" src={cxArtSrc("cam-catlagi")} alt="" />
      </Show>
    </div>
  );
}
