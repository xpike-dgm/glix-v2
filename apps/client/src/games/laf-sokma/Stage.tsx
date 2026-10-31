import { Show } from "solid-js";
import { StarIcon } from "../../ui/Icons.js";

/** Soru kartı (yazma): "SORU 1/2" ya da "FİNAL SORUSU". */
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

/** Oylama ve açılışta soru: ringin üstüne iki zincirle asılı tabela. */
export function RingSign(props: { label: string; prompt: string; final?: boolean }) {
  return (
    <div class="lf__sign" data-final={props.final ? "1" : undefined}>
      <i class="lf__chain lf__chain--l" aria-hidden="true" />
      <i class="lf__chain lf__chain--r" aria-hidden="true" />
      <div class="lf__plate">
        <span class="lf__plate-tag">{props.label}</span>
        <h1 class="lf__plate-q">{props.prompt}</h1>
      </div>
    </div>
  );
}

/** Ortadaki "VS" amblemi (CSS + SVG şimşek). */
export function VsBadge() {
  return (
    <div class="lf__vs" aria-hidden="true">
      <svg class="lf__vs-bolt" viewBox="0 0 64 64" role="presentation">
        <path d="M37 2 12 36h16l-4 26 28-38H35z" />
      </svg>
      <span class="lf__vs-text">VS</span>
    </div>
  );
}

/** Arka planda iki kartın üstüne düşen iki spot ışığı. `win`: kazanan kartın spotu güçlenir, öbürü söner. */
export function Spotlights(props: { win?: "a" | "b" | "both" | null }) {
  return (
    <div class="lf__spots" data-win={props.win ?? undefined} aria-hidden="true">
      <i class="lf__spot lf__spot--a" />
      <i class="lf__spot lf__spot--b" />
    </div>
  );
}

/** Kartın köşe şeridi: "Kırmızı köşe" / "Mavi köşe"; açılışta Laf Ustası kartında "★ Laf Ustası · +1". */
export function CornerTag(props: { side: "a" | "b"; master?: boolean }) {
  return (
    <span class="lf__corner" data-side={props.side} data-master={props.master ? "1" : undefined}>
      <Show
        when={props.master}
        fallback={
          <>
            <i aria-hidden="true" />
            {props.side === "a" ? "Kırmızı köşe" : "Mavi köşe"}
          </>
        }
      >
        <StarIcon size={14} />
        Laf Ustası · +1
      </Show>
    </span>
  );
}

/** Boş alanda hafifçe sallanan sahne mikrofonu; yazarken ses dalgaları çıkar. */
export function Mic(props: { live?: boolean }) {
  return (
    <div class="lf__mic" data-live={props.live ? "1" : undefined} aria-hidden="true">
      <svg viewBox="0 0 120 160" role="presentation">
        <defs>
          <linearGradient id="lf-mic-head" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#e9edff" />
            <stop offset="1" stop-color="#7f8ad0" />
          </linearGradient>
          <pattern id="lf-mic-mesh" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.2" fill="#2a3170" />
          </pattern>
        </defs>
        <g class="lf__mic-waves" fill="none" stroke-linecap="round" stroke-width="4">
          <path d="M18 40a30 30 0 0 0 0 30" stroke="var(--cyan)" />
          <path d="M8 32a42 42 0 0 0 0 46" stroke="var(--magenta)" />
          <path d="M102 40a30 30 0 0 1 0 30" stroke="var(--cyan)" />
          <path d="M112 32a42 42 0 0 1 0 46" stroke="var(--magenta)" />
        </g>
        <g class="lf__mic-body">
          <rect x="56" y="78" width="8" height="64" rx="3" fill="#3a4180" />
          <ellipse cx="60" cy="150" rx="30" ry="7" fill="#232a63" />
          <rect x="49" y="70" width="22" height="18" rx="5" fill="#4b538f" />
          <ellipse cx="60" cy="50" rx="22" ry="26" fill="url(#lf-mic-head)" />
          <ellipse cx="60" cy="50" rx="22" ry="26" fill="url(#lf-mic-mesh)" opacity="0.55" />
          <rect x="38" y="52" width="44" height="6" fill="var(--magenta)" opacity="0.85" />
          <ellipse cx="52" cy="38" rx="6" ry="9" fill="#fff" opacity="0.5" />
        </g>
      </svg>
    </div>
  );
}
