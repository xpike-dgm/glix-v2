import type { Sign } from "@glix/engine";
import { For, type JSX, Show } from "solid-js";
import { type RusvetProp, rusvetProp } from "../../ui/props.js";

/*
 * Rüşvet ve Darbe süs görselleri. Sahip görselleri üretene kadar (docs/oneriler/GORSEL-IHTIYACLARI.md "Rüşvet ve
 * Darbe") her biri kendi SVG/CSS karşılığını çizer; dosya `public/assets/props/rusvet-darbe/<ad>.webp` olarak gelince
 * kod değişmeden görsel kullanılır (olmayan dosya hiç istenmez). Hepsi süstür: anlamı çevresindeki metindedir.
 */

function PropOr(props: { name: RusvetProp; class: string; size: string; children: JSX.Element }) {
  const src = rusvetProp(props.name);
  return (
    <Show
      when={src}
      fallback={
        <span class={props.class} style={{ width: props.size, height: props.size }} aria-hidden="true">
          {props.children}
        </span>
      }
    >
      {(s) => (
        <img
          class={props.class}
          src={s()}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{ width: props.size, height: props.size }}
        />
      )}
    </Show>
  );
}

/** RD-U1: oy sandığı (koyu ahşap, altın kenar, kapakta yarık). */
export function Ballot(props: { size?: string }) {
  return (
    <PropOr name="sandik" class="rdx rdx--ballot" size={props.size ?? "44px"}>
      <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
        <rect x="7" y="16" width="34" height="26" rx="3" fill="#3a1422" stroke="#ffc23b" stroke-width="2" />
        <rect x="5" y="12" width="38" height="7" rx="2" fill="#5a1d2e" stroke="#ffc23b" stroke-width="2" />
        <rect x="16" y="14.5" width="16" height="2" rx="1" fill="#05081a" />
        <path d="M20 6h8v9h-8z" fill="#f3e6c8" stroke="#c9a65a" stroke-width="1" />
        <circle cx="24" cy="30" r="5" fill="none" stroke="#ffc23b" stroke-width="1.6" />
      </svg>
    </PropOr>
  );
}

/** RD-U1: altın mühür (balmumu, amblem). */
export function Seal(props: { size?: string }) {
  return (
    <PropOr name="muhur" class="rdx rdx--seal" size={props.size ?? "28px"}>
      <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
        <path
          d="M16 1.5l3 2.4 3.8-.6 1.6 3.5 3.5 1.6-.6 3.8 2.4 3-2.4 3 .6 3.8-3.5 1.6-1.6 3.5-3.8-.6-3 2.4-3-2.4-3.8.6-1.6-3.5-3.5-1.6.6-3.8L1.5 16l2.4-3-.6-3.8 3.5-1.6 1.6-3.5 3.8.6z"
          fill="#d9a21b"
          stroke="#7a4e05"
          stroke-width="1"
        />
        <circle cx="16" cy="16" r="8" fill="none" stroke="#7a4e05" stroke-width="1.4" />
        <path d="M11 18.5l2-6 3 3.5 3-3.5 2 6z" fill="#7a4e05" />
      </svg>
    </PropOr>
  );
}

/** RD-M1 / RD-M5: rastgele düşen oy / jeton işareti (zar). */
export function Dice(props: { size?: string }) {
  return (
    <span
      class="rdx rdx--dice"
      style={{ width: props.size ?? "20px", height: props.size ?? "20px" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
        <rect
          x="2.5"
          y="2.5"
          width="19"
          height="19"
          rx="4"
          fill="#e9ecff"
          stroke="#05081a"
          stroke-width="1.6"
        />
        <circle cx="8" cy="8" r="1.8" fill="#05081a" />
        <circle cx="12" cy="12" r="1.8" fill="#05081a" />
        <circle cx="16" cy="16" r="1.8" fill="#05081a" />
      </svg>
    </span>
  );
}

const SIGN_PROP: Record<Sign, RusvetProp> = { tas: "el-tas", kagit: "el-kagit", makas: "el-makas" };

/**
 * RD-U2: büyük, ayırt edilebilir el işaretleri: taş gri yuvarlak ve kalın, kâğıt beyaz düz yaprak, makas kırmızı V.
 * Renk + şekil (yazı düğmenin altında).
 */
export function SignArt(props: { sign: Sign; size?: string }) {
  return (
    <PropOr
      name={SIGN_PROP[props.sign]}
      class={`rdx rdx--sign rdx--${props.sign}`}
      size={props.size ?? "48px"}
    >
      <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
        <Show when={props.sign === "tas"}>
          <path
            d="M10 27c-1-9 6-16 15-16s14 6 13 14c-1 9-7 13-15 13S11 35 10 27z"
            fill="#9aa1b8"
            stroke="#3b4058"
            stroke-width="3"
          />
          <path
            d="M17 22c3-3 8-4 12-2"
            stroke="#d8dcee"
            stroke-width="2.4"
            fill="none"
            stroke-linecap="round"
          />
          <path d="M16 31l5-3 4 3 5-2" stroke="#4c536d" stroke-width="2" fill="none" stroke-linecap="round" />
        </Show>
        <Show when={props.sign === "kagit"}>
          <path d="M12 7h18l7 7v27H12z" fill="#f7f8ff" stroke="#8d93b5" stroke-width="2.4" />
          <path d="M30 7v7h7" fill="#dfe3f7" stroke="#8d93b5" stroke-width="2.4" />
          <path d="M17 21h14M17 27h14M17 33h10" stroke="#a9aed0" stroke-width="2" stroke-linecap="round" />
        </Show>
        <Show when={props.sign === "makas"}>
          <path d="M18 6l7 22M30 6l-7 22" stroke="#ff4f64" stroke-width="5" stroke-linecap="round" />
          <circle cx="16" cy="36" r="6" fill="none" stroke="#ff4f64" stroke-width="4" />
          <circle cx="32" cy="36" r="6" fill="none" stroke="#ff4f64" stroke-width="4" />
          <circle cx="24" cy="27" r="2" fill="#ffd0d6" />
        </Show>
      </svg>
    </PropOr>
  );
}

/** RD-U3: jeton kesesi (kadife, altın ip). */
export function Purse(props: { size?: string }) {
  return (
    <PropOr name="kese" class="rdx rdx--purse" size={props.size ?? "46px"}>
      <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
        <path
          d="M17 14c-8 6-11 14-9 21 2 6 8 9 16 9s14-3 16-9c2-7-1-15-9-21z"
          fill="#7a1530"
          stroke="#ffc23b"
          stroke-width="2"
        />
        <path d="M15 14h18l-3-6H18z" fill="#5a0f22" stroke="#ffc23b" stroke-width="2" />
        <path d="M14 15c4 2 16 2 20 0" stroke="#ffc23b" stroke-width="2.4" fill="none" />
        <circle cx="24" cy="31" r="6" fill="#ffc23b" stroke="#7a4e05" stroke-width="1.4" />
      </svg>
    </PropOr>
  );
}

/** RD-U3 / RD-U9: portrenin altında duran 1 ya da 2 jetonluk yığın (gümüş = rastgele giden). */
export function Stack(props: { n: number; silver?: number }) {
  const silver = () => Math.min(props.n, props.silver ?? 0);
  const file = () => (props.silver ? null : rusvetProp(props.n >= 2 ? "yigin-2" : "yigin-1"));
  return (
    <span class="rd__stack" data-n={props.n} aria-hidden="true">
      <Show
        when={file()}
        fallback={
          <For each={Array.from({ length: props.n }, (_, i) => i)}>
            {(i) => <i class="rd__chipcoin" data-silver={i >= props.n - silver() ? "1" : undefined} />}
          </For>
        }
      >
        {(src) => <img class="rd__stack-img" src={src()} alt="" draggable={false} />}
      </Show>
    </span>
  );
}

/** RD-U6: kırmızı darbe yumruğu. */
export function Fist(props: { size?: string }) {
  return (
    <PropOr name="yumruk" class="rdx rdx--fist" size={props.size ?? "28px"}>
      <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
        <path
          d="M8 13c0-2 1.5-3 3-3h2c0-1.5 1-2.5 2.5-2.5S18 8.5 18 10c.4-1.2 1.3-2 2.6-2 1.6 0 2.4 1.1 2.4 2.6.5-.4 1-.6 1.7-.6 1.5 0 2.3 1.2 2.3 2.7V19c0 5-3.5 8-8.5 8h-2C10.5 27 8 24 8 20z"
          fill="#ff4f64"
          stroke="#5a0010"
          stroke-width="1.6"
        />
        <path d="M13 10v5M18 10v5M23 10.6V15" stroke="#5a0010" stroke-width="1.4" stroke-linecap="round" />
      </svg>
    </PropOr>
  );
}

/** RD-U7 / RD-U9: taç. */
export function Crown(props: { size?: string }) {
  return (
    <PropOr name="tac" class="rdx rdx--crown" size={props.size ?? "36px"}>
      <svg viewBox="0 0 40 32" width="100%" height="100%" aria-hidden="true">
        <path
          d="M4 26L2 8l10 8 8-13 8 13 10-8-2 18z"
          fill="#ffc23b"
          stroke="#7a4e05"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <rect
          x="4"
          y="25"
          width="32"
          height="5"
          rx="1.5"
          fill="#d9a21b"
          stroke="#7a4e05"
          stroke-width="1.6"
        />
        <circle cx="20" cy="18" r="2.6" fill="#ff2b55" />
        <circle cx="11" cy="20" r="1.8" fill="#2ef2ff" />
        <circle cx="29" cy="20" r="1.8" fill="#2ef2ff" />
      </svg>
    </PropOr>
  );
}
