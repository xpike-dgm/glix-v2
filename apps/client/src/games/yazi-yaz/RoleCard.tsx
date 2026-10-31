import type { YaziYazRole } from "@glix/engine";
import { createSignal, onCleanup, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { yaziYazProp } from "../../ui/props.js";
import { flipSound } from "./sounds.js";
import { YY_PLAN } from "./timeline.js";

interface Props {
  role: YaziYazRole;
  /** Konusuz turda yazana "Gizli bir kelime yaz" denir. */
  hasTopic: boolean;
  /** Kart bir kez çevrilip bırakıldı: pano açılır, kart "Rolüm" düğmesine dönüşür. */
  onSeen: () => void;
}

/** Kartın ön yüzündeki kısa yazı. */
export function roleLine(role: YaziYazRole, hasTopic: boolean): string {
  if (role === "innocent") return "MASUM yaz";
  return hasTopic ? "Konudan bir kelime yaz" : "Gizli bir kelime yaz";
}

/** Yazan yüzü: daktilo ve kalem (görsel yoksa SVG). */
function WriterArt() {
  const src = yaziYazProp("kart-yazan");
  return (
    <Show
      when={src}
      fallback={
        <svg class="yyrc__svg" viewBox="0 0 120 90" aria-hidden="true">
          <rect x="22" y="8" width="58" height="34" rx="3" fill="#F4EEDD" />
          <path d="M30 18h40M30 25h34M30 32h26" stroke="#9A8F7A" stroke-width="2.4" stroke-linecap="round" />
          <rect
            x="12"
            y="40"
            width="96"
            height="40"
            rx="10"
            fill="#2A2350"
            stroke="#FF2BD6"
            stroke-width="3"
          />
          <rect x="18" y="36" width="84" height="8" rx="4" fill="#3B3270" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <circle cx={24 + i * 12} cy={56} r={4} fill="#8E97C7" />
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle cx={30 + i * 12} cy={68} r={4} fill="#8E97C7" />
          ))}
          <path d="M92 6l12 12-30 30-14 3 3-14z" fill="#FFC23D" stroke="#0A0E2A" stroke-width="2" />
          <path d="M92 6l12 12" stroke="#FF2BD6" stroke-width="5" />
        </svg>
      }
    >
      {(s) => <img class="yyrc__img" src={s()} alt="" draggable={false} />}
    </Show>
  );
}

/** Masum yüzü: boş kâğıt (görsel yoksa SVG). */
function InnocentArt() {
  const src = yaziYazProp("kart-masum");
  return (
    <Show
      when={src}
      fallback={
        <svg class="yyrc__svg" viewBox="0 0 120 90" aria-hidden="true">
          <rect x="30" y="6" width="60" height="78" rx="4" fill="#F4EEDD" transform="rotate(-4 60 45)" />
          <path d="M40 24h40M40 34h40M40 44h40M40 54h40M40 64h28" stroke="#D9CFB8" stroke-width="2" />
        </svg>
      }
    >
      {(s) => <img class="yyrc__img" src={s()} alt="" draggable={false} />}
    </Show>
  );
}

/**
 * Ters duran rol kartı (YY-U2): "Rolünü görmek için basılı tut". Basılı tutmayan biri için yazan ve masumun kartı birebir
 * aynıdır; basılı tutunca döner, bırakınca pano açılır. Kısa dokunuş yetmez (yanlışlıkla görünmesin).
 */
export function RoleCard(props: Props) {
  const [held, setHeld] = createSignal(false);
  const [flipped, setFlipped] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const back = yaziYazProp("kart-arka");
  const down = (e: PointerEvent): void => {
    unlockAudio();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setHeld(true);
    clearTimeout(timer);
    timer = setTimeout(() => {
      setFlipped(true);
      flipSound();
      hapticTap();
    }, YY_PLAN.cardHoldMs);
  };
  const up = (): void => {
    clearTimeout(timer);
    setHeld(false);
    if (flipped()) {
      setFlipped(false);
      props.onSeen();
    }
  };
  return (
    <button
      type="button"
      class="yyrc"
      data-held={held() ? "1" : undefined}
      data-flipped={flipped() ? "1" : undefined}
      aria-label="Rolünü görmek için basılı tut"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span class="yyrc__inner">
        <span class="yyrc__face yyrc__back" data-art={back ? "1" : undefined}>
          <Show when={back}>
            {(s) => <img class="yyrc__img yyrc__img--full" src={s()} alt="" draggable={false} />}
          </Show>
          <span class="yyrc__mark" aria-hidden="true">
            ?
          </span>
          <span class="yyrc__hint">Rolünü görmek için basılı tut</span>
        </span>
        <span class="yyrc__face yyrc__front" data-role={props.role}>
          <Show when={flipped()}>
            {props.role === "writer" ? <WriterArt /> : <InnocentArt />}
            <span class="yyrc__role">{props.role === "writer" ? "YAZAN" : "MASUM"}</span>
            <span class="yyrc__line">{roleLine(props.role, props.hasTopic)}</span>
          </Show>
        </span>
      </span>
    </button>
  );
}
