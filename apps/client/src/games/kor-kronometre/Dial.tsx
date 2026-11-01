import { createEffect, onCleanup, Show } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { kronometreProp, propSrc } from "../../ui/props.js";
import { nextPulseGap } from "./view.js";

/**
 * Karanlık kronometre. Rakam ve ibre yoktur. Nabız (KR-M4) düzensizdir: her vuruş arası 0,6–2,2 sn rastgele, tek halka;
 * vuruş sayarak zaman tutulamaz. Ses ve titreşim üretmez; hareket azaltmada hiç yoktur. Kilitlenince (KR-U2) taç gömülür,
 * cam kırağıyla donar ve nabız durur. "Hazır ol"da (KR-U3) hedef rakamı kadranın içinde dev yazılır.
 */
export function Dial(props: {
  locked?: boolean;
  /** Nabız atsın mı (sayarken ve anlatımda). */
  pulse?: boolean;
  /** "Hazır ol": kadranın içindeki dev hedef rakamı. */
  digit?: number | null;
  /** 2. ve 3. elde önceki elin hedefi: "11 → 8" kayması. */
  prevDigit?: number | null;
}) {
  let core: HTMLElement | undefined;
  let ring: HTMLElement | undefined;
  createEffect(() => {
    if (!props.pulse || props.locked || reducedMotion()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const beat = (): void => {
      core?.animate(
        [
          { transform: "scale(0.8)", opacity: 0.55 },
          { transform: "scale(1.45)", opacity: 1, offset: 0.35 },
          { transform: "scale(0.8)", opacity: 0.55 },
        ],
        { duration: 900, easing: "ease-in-out" },
      );
      ring?.animate(
        [
          { transform: "scale(0.35)", opacity: 0.6 },
          { transform: "scale(1.15)", opacity: 0 },
        ],
        { duration: 1_100 + Math.random() * 500, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
      timer = setTimeout(beat, nextPulseGap(Math.random()));
    };
    timer = setTimeout(beat, nextPulseGap(Math.random()) / 2);
    onCleanup(() => clearTimeout(timer));
  });
  const frozen = () => (props.locked ? kronometreProp("kronometre-donmus") : null);
  return (
    <div
      class="kro-dial"
      data-locked={props.locked ? "1" : undefined}
      data-art={frozen() ? "1" : undefined}
      data-ready={props.digit != null ? "1" : undefined}
      aria-hidden="true"
    >
      <img
        class="kro-dial__img"
        src={frozen() ?? propSrc("genel/kronometre")}
        alt=""
        draggable={false}
        width="384"
        height="384"
      />
      {/* Geçici (görsel gelene kadar): taç gölgesi ve kırağı CSS ile çizilir. */}
      <Show when={props.locked && !frozen()}>
        <i class="kro-dial__crown" />
        <i class="kro-dial__frost" />
      </Show>
      <i class="kro-dial__pulse" ref={ring} />
      <i class="kro-dial__core" ref={core} />
      <Show when={props.digit != null}>
        <span class="kro-dial__digit">
          <Show when={props.prevDigit != null && props.prevDigit !== props.digit}>
            <b class="kro-dial__num kro-dial__num--out">{props.prevDigit}</b>
          </Show>
          <b class="kro-dial__num" data-in={props.prevDigit != null ? "1" : undefined}>
            {props.digit}
          </b>
        </span>
      </Show>
    </div>
  );
}
