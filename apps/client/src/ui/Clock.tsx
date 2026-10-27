import { createSignal, onCleanup, Show } from "solid-js";
import { hapticTick } from "../fx/haptics.js";
import { setTensionLevel } from "../fx/music.js";
import { tick } from "../fx/sound.js";
import {
  type ClockView,
  type ClockWindow,
  clockView,
  shouldTick,
  stepFraction,
  tensionLevel,
} from "./clockState.js";

interface Props {
  win: ClockWindow | null;
  /** Sunucu saati (ms). */
  now: () => number;
  vertical?: boolean;
  /**
   * Gerilim müziği bu saate bağlı mı. Süresi gizli oyunlarda kabuk saati hiç çizilmez; yine de çağıran
   * `false` verirse ritim ele vermez.
   */
  tension?: boolean;
}

/**
 * Kabuk süre çubuğu: sunucu saatine bağlı ince çubuk. Son 5 sn kalınlaşır, kırmızıya döner, sayı gösterir,
 * saniyede bir tik sesi ve hafif titreşim verir; son 10 sn'de alçak bir gerilim yatağı (müzik) başlar, süre bitince susar. Pencere erkene alınırsa çubuk yumuşakça kapanır.
 */
export function Clock(props: Props) {
  let fill: HTMLDivElement | undefined;
  const [view, setView] = createSignal<ClockView>(clockView(null, 0));
  let shown = clockView(props.win, props.now()).fraction;
  let last = 0;
  let prevSecs: number | null = null;
  let raf = 0;

  const frame = (t: number): void => {
    const v = clockView(props.win, props.now());
    shown = stepFraction(shown, v.fraction, last ? t - last : 16);
    last = t;
    if (fill) fill.style.transform = props.vertical ? `scaleY(${shown})` : `scaleX(${shown})`;
    const cur = view();
    if (cur.tone !== v.tone || cur.secs !== v.secs) setView(v);
    if (shouldTick(prevSecs, v)) {
      tick();
      hapticTick();
    }
    prevSecs = v.secs;
    setTensionLevel(tensionLevel(props.win, props.now(), props.tension === true));
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  onCleanup(() => {
    cancelAnimationFrame(raf);
    setTensionLevel(0);
  });

  return (
    <div
      class="clock"
      data-tone={view().tone}
      data-idle={props.win ? undefined : "1"}
      data-v={props.vertical ? "1" : undefined}
    >
      <div class="clock__track" aria-hidden="true">
        <div class="clock__fill" ref={fill} />
      </div>
      <Show when={view().secs}>
        {(s) => (
          <span class="clock__secs" role="timer" aria-label={`${s()} saniye kaldı`}>
            {s()}
          </span>
        )}
      </Show>
    </div>
  );
}
