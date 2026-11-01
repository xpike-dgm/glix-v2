import { Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { hirsizProp, propSrc } from "../../ui/props.js";
import "./gizli-hirsiz.css";
import { dialClick } from "./sounds.js";

export type CoreState = "idle" | "solo" | "multi" | "none";

interface Props {
  state: CoreState;
  /** Kasa açılıyor (yalnız açılışta). */
  opening?: boolean;
  /** GH-U4: parmak izi (yalnız kendi ekranında, 👁 basılı tutulurken). */
  print?: boolean;
  /** GH-U7: son 5 sn. */
  urgent?: boolean;
  /** GH-U9: kasa dinleniyor (stetoskop dalgası). */
  listening?: boolean;
  /** GH-U3: oyalama kadranı çevrilebilir. */
  dial?: boolean;
  class?: string;
}

/** Kadranın her tıkırtısı (derece). */
const DIAL_STEP = 15;
/** Kadranın merkezi (çekirdek koordinatında; kasa kapısındaki tekerlek). */
const DX = 116;
const DY = 100;

/** Karanlık "güvenlik çekirdeği": halkalar, kasa kapısı, oyalama kadranı ve (yalnız kendi ekranında) parmak izi. */
export function Core(props: Props) {
  let svg: SVGSVGElement | undefined;
  let dialG: SVGGElement | undefined;
  let angle = 0;
  let last: number | null = null;
  let acc = 0;

  const pointAngle = (e: PointerEvent): number | null => {
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (r.width === 0) return null;
    const cx = r.left + (DX / 200) * r.width;
    const cy = r.top + (DY / 200) * r.height;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  };
  const down = (e: PointerEvent): void => {
    if (!props.dial) return;
    e.preventDefault();
    unlockAudio();
    last = pointAngle(e);
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // desteklenmiyor
    }
  };
  // GH-U3: kadran yalnız bu telefonda döner; hiçbir eylem göndermez (ağ trafiği yok).
  const move = (e: PointerEvent): void => {
    if (last === null || !props.dial) return;
    const a = pointAngle(e);
    if (a === null) return;
    let d = a - last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    last = a;
    angle += d;
    acc += d;
    dialG?.setAttribute("transform", `rotate(${angle.toFixed(1)} ${DX} ${DY})`);
    while (Math.abs(acc) >= DIAL_STEP) {
      acc -= Math.sign(acc) * DIAL_STEP;
      dialClick();
      hapticTap();
    }
  };
  const up = (): void => {
    last = null;
  };

  const openSrc = () => (props.state === "solo" && props.opening ? hirsizProp("kasa-acik") : null);

  return (
    <svg
      ref={svg}
      class={`ghcore ${props.class ?? ""}`}
      viewBox="0 0 200 200"
      data-state={props.state}
      data-opening={props.opening ? "1" : undefined}
      data-print={props.print ? "1" : undefined}
      data-urgent={props.urgent ? "1" : undefined}
      data-listen={props.listening ? "1" : undefined}
      aria-hidden="true"
      role="presentation"
    >
      <title>Güvenlik çekirdeği</title>
      <circle class="ghcore__ring ghcore__ring--a" cx="100" cy="100" r="94" />
      <circle class="ghcore__ring ghcore__ring--b" cx="100" cy="100" r="78" />
      <circle class="ghcore__pulse" cx="100" cy="100" r="86" />
      <g class="ghcore__ticks">
        <path d="M100 4v14M100 182v14M4 100h14M182 100h14" />
      </g>
      <g class="ghcore__waves">
        <circle cx="100" cy="100" r="60" />
        <circle cx="100" cy="100" r="60" />
      </g>
      <Show
        when={openSrc()}
        fallback={
          <image
            class="ghcore__door"
            href={propSrc("genel/kasa-kapisi")}
            x="22"
            y="22"
            width="156"
            height="156"
            preserveAspectRatio="xMidYMid meet"
          />
        }
      >
        {(src) => (
          <image
            class="ghcore__door ghcore__door--open"
            href={src()}
            x="10"
            y="10"
            width="180"
            height="180"
            preserveAspectRatio="xMidYMid meet"
          />
        )}
      </Show>
      <g
        class="ghcore__dial"
        data-on={props.dial ? "1" : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <circle class="ghcore__dialhit" cx={DX} cy={DY} r="34" />
        <g ref={dialG}>
          <circle class="ghcore__dialring" cx={DX} cy={DY} r="24" />
          <path
            class="ghcore__dialmarks"
            d={`M${DX} ${DY - 24}v6M${DX + 24} ${DY}h-6M${DX} ${DY + 24}v-6M${DX - 24} ${DY}h6`}
          />
          <circle class="ghcore__dialdot" cx={DX} cy={DY - 19} r="2.4" />
        </g>
      </g>
      <g class="ghcore__print">
        <ellipse cx="100" cy="104" rx="5" ry="7" />
        <ellipse cx="100" cy="104" rx="11" ry="14" />
        <ellipse cx="100" cy="104" rx="17" ry="21" />
        <path d="M77 112c-1-4-1-8 0-12M123 112c1-4 1-8 0-12M88 128c4 2 8 3 12 3s8-1 12-3" />
      </g>
    </svg>
  );
}
