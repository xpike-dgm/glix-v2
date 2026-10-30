import { For } from "solid-js";
import { heatLabel } from "./view.js";

/**
 * Mağazanın kodla çizilen parçaları (görsel dosyası gerekmez): talep ateşi, kupon etiketi, alışveriş poşeti.
 * Sahip ayrıca görsel üretirse (docs/oneriler/gizli-alisveris-gorsel.md) bunların yerine konabilir.
 */

/** Talep ateşi: seviye kadar alev (1–3). Renk tek başına bilgi taşımaz: alev sayısı seviyedir. */
export function Alev(props: { level: number }) {
  const n = () => Math.max(1, Math.min(3, props.level));
  return (
    <span class="gaheat" data-l={n()} role="img" aria-label={`Talep: ${heatLabel(n())}`}>
      <For each={Array.from({ length: n() }, (_, i) => i)}>
        {(i) => (
          <svg viewBox="0 0 12 16" aria-hidden="true" style={{ "--j": i }}>
            <path d="M6 1c.6 3 4.5 4.6 4.5 9A4.5 4.5 0 0 1 1.5 10c0-2.2 1.3-3.4 2.3-4.6.2 1.6 1 2.4 1.8 2.6C5.2 5.6 5.2 3.4 6 1z" />
            <path
              class="gaheat__core"
              d="M6 8.2c.4 1.4 2 2.1 2 3.8a2 2 0 0 1-4 0c0-1 .6-1.6 1.1-2.2.1.6.5 1 .9 1-.2-1-.3-1.8 0-2.6z"
            />
          </svg>
        )}
      </For>
    </span>
  );
}

/** Kupon etiketi: zımbalı kenarlı küçük bilet, "%50". */
export function Kupon(props: { class?: string }) {
  return (
    <svg class={`gakupon ${props.class ?? ""}`} viewBox="0 0 44 22" aria-hidden="true">
      <path
        class="gakupon__body"
        d="M3 2h38a2 2 0 0 1 2 2v4a3 3 0 0 0 0 6v4a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-4a3 3 0 0 0 0-6V4a2 2 0 0 1 2-2z"
      />
      <path class="gakupon__cut" d="M13 4v14" />
      <text x="28" y="15" text-anchor="middle">
        %50
      </text>
      <circle cx="7" cy="11" r="2.2" class="gakupon__hole" />
    </svg>
  );
}

/** Alışveriş poşeti: neon kenarlı kâğıt poşet, iki saplı. */
export function Poset(props: { class?: string }) {
  return (
    <svg class={`gaposet ${props.class ?? ""}`} viewBox="0 0 40 44" aria-hidden="true">
      <path class="gaposet__handle" d="M13 14V9a7 7 0 0 1 14 0v5" />
      <path class="gaposet__body" d="M5 13h30l3 29H2z" />
      <path class="gaposet__fold" d="M5 13l3 5h24l3-5" />
      <circle cx="13" cy="20" r="1.6" class="gaposet__dot" />
      <circle cx="27" cy="20" r="1.6" class="gaposet__dot" />
    </svg>
  );
}
