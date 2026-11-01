import { createSignal, For, onCleanup, Show } from "solid-js";
import { hapticTap, hapticTick } from "../../fx/haptics.js";
import { tap, unlockAudio } from "../../fx/sound.js";
import { ratioOfValue, stepValue, valueFromRatio } from "../../ui/numberPicker.js";
import { dragTick } from "./sounds.js";
import { crossedFive, formatNumber, strongMark } from "./view.js";

interface Props {
  /** Şu anki seçimin (yoksa null: pin yok). */
  value: number | null;
  onChange?: (value: number, final: boolean) => void;
  /** İzleyici/TV: yalnız önceki turların çizgileri; pin ve düğme yok. */
  readonly?: boolean;
  disabled?: boolean;
  locked?: boolean;
  /** Son 3 saniye ve seçim yok/kilit yok: kenarlar nabız gibi parlar (OY-U4). */
  urgent?: boolean;
  /** Önceki turun ortalaması ve hedefi (2. turdan itibaren). */
  prev: { mean: number; target: number } | null;
  /** Önceki turdaki kendi sayın. */
  mine: { value: number; distance: number; random: boolean } | null;
  /** Oyuncunun rengi (pin ve halka). */
  color: string;
  /** Yol üstündeki kısa yazı (1. turda "Herkes ne yazacak? …"). */
  caption?: string | undefined;
  label: string;
}

const STEPS: readonly number[] = [-10, -1, 1, 10];
const MIN = 0;
const MAX = 100;
/** ± düğmeleri seçim yokken ortadan başlar (yol üstünde başlangıç çapası yok, OY-U1). */
const STEP_FROM = 50;

/**
 * Seçim ekranının canlı sayı yolu (OY-U1): ekran genişliğinde 0–100 yolu; üstünde önceki turun ortalaması (camgöbeği
 * kesik çizgi), hedefi (altın düz çizgi) ve aradaki "hedef buraya kaydı" oku, önceki turdaki kendi sayın (içi boş
 * halka) ve şu anki seçimin (parlayan pin). Yolun kendisi kaydırıcıdır: ilk dokunduğun yere pin gelir.
 */
export function NumberRoad(props: Props) {
  let track: HTMLDivElement | undefined;
  const [dragging, setDragging] = createSignal(false);
  let last: number | null = null;

  const commit = (v: number, final: boolean): void => {
    if (props.disabled || props.readonly) return;
    const crossed = crossedFive(last ?? props.value, v);
    if (crossed !== null) {
      dragTick(crossed);
      if (strongMark(crossed)) hapticTap();
      else hapticTick();
    }
    last = v;
    props.onChange?.(v, final);
  };
  const fromPointer = (e: PointerEvent): number => {
    const rect = (track as HTMLDivElement).getBoundingClientRect();
    const pad = Math.min(22, rect.width / 4);
    return valueFromRatio((e.clientX - rect.left - pad) / Math.max(1, rect.width - 2 * pad), MIN, MAX);
  };
  const onDown = (e: PointerEvent): void => {
    if (props.disabled || props.readonly || !track) return;
    e.preventDefault();
    unlockAudio();
    track.setPointerCapture(e.pointerId);
    setDragging(true);
    last = props.value;
    commit(fromPointer(e), false);
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging()) return;
    const v = fromPointer(e);
    if (v !== last) commit(v, false);
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
    commit(stepValue(props.value, delta, MIN, MAX, STEP_FROM), true);
  };

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
    current = stepValue(current ?? props.value, delta, MIN, MAX, STEP_FROM);
    commit(current, false);
  };
  const holdStart = (delta: number, e: PointerEvent): void => {
    if (props.disabled) return;
    e.preventDefault();
    unlockAudio();
    tap();
    stopHold();
    current = props.value;
    last = props.value;
    stepOnce(delta);
    if (Math.abs(delta) === 1) {
      holdTimer = setTimeout(() => {
        repeatTimer = setInterval(() => stepOnce(delta), 75);
      }, 380);
    }
  };
  const holdEnd = (): void => {
    const was = current !== null;
    stopHold();
    if (was && current !== null) commit(current, true);
    current = null;
  };

  const x = (v: number) => ratioOfValue(v, MIN, MAX);

  return (
    <div
      class="road"
      data-urgent={props.urgent ? "1" : undefined}
      data-locked={props.locked ? "1" : undefined}
      data-readonly={props.readonly ? "1" : undefined}
      style={{ "--c": props.color }}
    >
      <div
        class="road__track"
        ref={track}
        role="slider"
        tabIndex={props.readonly ? -1 : 0}
        aria-label={props.label}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={props.value ?? undefined}
        aria-readonly={props.readonly ? "true" : undefined}
        aria-disabled={props.disabled || props.readonly ? "true" : undefined}
        data-active={dragging() ? "1" : undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <div class="road__rail">
          <For each={[0, 25, 50, 75, 100]}>
            {(m) => (
              <i class="road__mark" data-big={m % 50 === 0 ? "1" : undefined} style={{ "--x": x(m) }} />
            )}
          </For>
          <Show when={props.prev}>
            {(p) => (
              <>
                <i
                  class="road__shift"
                  aria-hidden="true"
                  style={{
                    "--from": x(Math.min(p().mean, p().target)),
                    "--w": Math.abs(x(p().mean) - x(p().target)),
                  }}
                />
                <i class="road__mean" style={{ "--x": x(p().mean) }} />
                <i class="road__target" style={{ "--x": x(p().target) }} />
              </>
            )}
          </Show>
          <Show when={props.mine}>{(m) => <i class="road__ring" style={{ "--x": x(m().value) }} />}</Show>
          <Show when={!props.readonly && props.value !== null ? props.value : null}>
            {(v) => (
              <div class="road__pin" style={{ "--x": x(v()) }} aria-hidden="true">
                <b>{v()}</b>
                <Show when={props.locked}>
                  <svg class="road__lock" viewBox="0 0 16 16" aria-hidden="true">
                    <rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor" />
                    <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="2" />
                  </svg>
                </Show>
              </div>
            )}
          </Show>
        </div>
        <Show when={!props.readonly && props.value === null}>
          <span class="road__touch">Dokun ve sürükle</span>
        </Show>
        <div class="road__scale" aria-hidden="true">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>
      <Show when={props.prev || props.mine}>
        <p class="road__legend">
          <Show when={props.prev}>
            {(p) => (
              <>
                <span class="road__key road__key--mean">ortalama {formatNumber(p().mean)}</span>
                <span class="road__key road__key--target">hedef {formatNumber(p().target)}</span>
              </>
            )}
          </Show>
          <Show when={props.mine}>
            {(m) => (
              <span class="road__key road__key--ring">
                {m().random ? "🎲 " : ""}geçen tur {m().value} · hedefe {formatNumber(m().distance)}
              </span>
            )}
          </Show>
        </p>
      </Show>
      <Show when={props.caption}>
        <p class="road__caption">{props.caption}</p>
      </Show>
      <Show when={!props.readonly}>
        <div class="road__steps">
          <For each={STEPS}>
            {(d) => (
              <button
                type="button"
                class="road__step"
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
                    commit(stepValue(props.value, d, MIN, MAX, STEP_FROM), true);
                  }
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {d > 0 ? `+${d}` : `−${-d}`}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
