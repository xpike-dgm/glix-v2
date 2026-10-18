import { createMemo, createSignal, For, onCleanup } from "solid-js";
import { hapticTap, hapticTick } from "../fx/haptics.js";
import { tap, tick, unlockAudio } from "../fx/sound.js";
import { ratioOfValue, stepValue, valueFromRatio } from "./numberPicker.js";
import "./number-picker.css";

interface Props {
  min: number;
  max: number;
  /** Gösterilen değer; henüz seçilmediyse null. */
  value: number | null;
  /** Değer değişti. `final`: parmak kalktı (sunucuya hemen gönderilir). */
  onChange: (value: number, final: boolean) => void;
  disabled?: boolean;
  /** İlk adımın başlayacağı değer (henüz seçim yokken). */
  startAt?: number;
  /** Çubuk üzerindeki işaret aralığı (varsayılan 10). */
  tickEvery?: number;
  /** Ekran okuyucu adı. */
  label: string;
}

const STEPS: readonly number[] = [-10, -1, 1, 10];
const HOLD_DELAY_MS = 380;
const HOLD_EVERY_MS = 75;

/**
 * Başparmak için sayı seçici: geniş bir kaydırma çubuğu (her yere dokun, sürükle) ve altında −10 / −1 / +1 / +10
 * düğmeleri (basılı tutunca tekrarlar). Çubuk kaba, düğmeler ince ayar içindir; her değer birkaç dokunuşla yakındır.
 */
export function NumberPicker(props: Props) {
  let track: HTMLDivElement | undefined;
  const [dragging, setDragging] = createSignal(false);
  const startAt = () => props.startAt ?? Math.round((props.min + props.max) / 2);
  const ratio = createMemo(() => ratioOfValue(props.value ?? startAt(), props.min, props.max));
  const marks = createMemo(() => {
    const every = Math.max(1, props.tickEvery ?? 10);
    const out: number[] = [];
    for (let v = props.min; v <= props.max; v += every) out.push(v);
    return out;
  });

  const commit = (v: number, final: boolean): void => {
    if (props.disabled) return;
    if (v !== props.value) {
      tick();
      hapticTick();
    }
    props.onChange(v, final);
  };

  const fromPointer = (e: PointerEvent): number => {
    const rect = (track as HTMLDivElement).getBoundingClientRect();
    // Düğme genişliği kadar iç boşluk: uçlara tam ulaşılsın.
    const pad = Math.min(24, rect.width / 4);
    return valueFromRatio(
      (e.clientX - rect.left - pad) / Math.max(1, rect.width - 2 * pad),
      props.min,
      props.max,
    );
  };

  const onDown = (e: PointerEvent): void => {
    if (props.disabled || !track) return;
    e.preventDefault();
    unlockAudio();
    track.setPointerCapture(e.pointerId);
    setDragging(true);
    commit(fromPointer(e), false);
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging()) return;
    const v = fromPointer(e);
    if (v !== props.value) commit(v, false);
  };
  const onUp = (e: PointerEvent): void => {
    if (!dragging()) return;
    setDragging(false);
    if (track?.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
    commit(fromPointer(e), true);
  };
  const onKey = (e: KeyboardEvent): void => {
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? -1
          : e.key === "PageUp"
            ? 10
            : e.key === "PageDown"
              ? -10
              : 0;
    if (delta === 0) return;
    e.preventDefault();
    commit(stepValue(props.value, delta, props.min, props.max, startAt()), true);
  };

  // Düğmeler: basınca bir adım, basılı tutunca tekrar.
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let repeatTimer: ReturnType<typeof setInterval> | undefined;
  let current: number | null = null;
  const stopHold = (): void => {
    if (holdTimer !== undefined) clearTimeout(holdTimer);
    if (repeatTimer !== undefined) clearInterval(repeatTimer);
    holdTimer = undefined;
    repeatTimer = undefined;
  };
  onCleanup(stopHold);
  const stepOnce = (delta: number): void => {
    current = stepValue(current ?? props.value, delta, props.min, props.max, startAt());
    commit(current, false);
  };
  const holdStart = (delta: number, e: PointerEvent): void => {
    if (props.disabled) return;
    e.preventDefault();
    unlockAudio();
    tap();
    hapticTap();
    stopHold();
    current = props.value;
    stepOnce(delta);
    // Büyük adımlar tekrarlanmaz: ±10 zaten hızlıdır; ±1 basılı tutunca akar.
    if (Math.abs(delta) === 1) {
      holdTimer = setTimeout(() => {
        repeatTimer = setInterval(() => stepOnce(delta), HOLD_EVERY_MS);
      }, HOLD_DELAY_MS);
    }
  };
  const holdEnd = (): void => {
    const wasHolding = current !== null;
    stopHold();
    if (wasHolding && current !== null) commit(current, true);
    current = null;
  };

  return (
    <div class="npick" data-disabled={props.disabled ? "1" : undefined}>
      <div
        class="npick__track"
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={props.label}
        aria-valuemin={props.min}
        aria-valuemax={props.max}
        aria-valuenow={props.value ?? undefined}
        aria-disabled={props.disabled ? "true" : undefined}
        data-active={dragging() ? "1" : undefined}
        data-empty={props.value === null ? "1" : undefined}
        style={{ "--r": ratio() }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <div class="npick__rail">
          <div class="npick__fill" />
          <For each={marks()}>
            {(m) => (
              <i
                class="npick__tick"
                data-on={props.value !== null && props.value >= m ? "1" : undefined}
                style={{ "--t": ratioOfValue(m, props.min, props.max) }}
              />
            )}
          </For>
        </div>
        <div class="npick__thumb" aria-hidden="true" />
      </div>
      <div class="npick__steps">
        <For each={STEPS}>
          {(d) => (
            <button
              type="button"
              class="npick__step"
              data-big={Math.abs(d) === 10 ? "1" : undefined}
              disabled={props.disabled}
              aria-label={d > 0 ? `${d} artır` : `${-d} azalt`}
              onPointerDown={(e) => holdStart(d, e)}
              onPointerUp={holdEnd}
              onPointerCancel={holdEnd}
              onPointerLeave={holdEnd}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  commit(stepValue(props.value, d, props.min, props.max, startAt()), true);
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {d > 0 ? `+${d}` : `−${-d}`}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
