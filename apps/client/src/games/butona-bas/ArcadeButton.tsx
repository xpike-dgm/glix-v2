import { createEffect, For, on, Show } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { currentFlashPeak, currentShakeGain } from "../../fx/shake.js";
import { propSrc } from "../../ui/props.js";

export interface ArcadeFx {
  kind: "match" | "crowd" | "solo";
  n: number;
}

interface Props {
  pressed?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Halka dalgası kimlikleri; ebeveyn süre dolunca listeden çıkarır. */
  waves?: number[] | undefined;
  waveMs?: number | undefined;
  fx?: ArcadeFx | null | undefined;
  label?: string | undefined;
  /** Ekran okuyucu etiketi (verilmezse "Bas"). */
  ariaLabel?: string | undefined;
  demo?: boolean | undefined;
  /** BB-U1: pencere halkası kalınlığı (0: Geniş, 1: Dar, 2: İğne ucu); verilmezse halka yok. */
  ring?: number | undefined;
  /** BB-U3: dolum kimliği (her sayılan basışta yeni); null iken buton dolu. */
  fill?: number | null | undefined;
  /** BB-U3: dolum bitti parlaması (her bitişte yeni kimlik). */
  ready?: number | undefined;
  /** BB-U3: dolarken basıldı: "boş" sallanma (her denemede yeni kimlik). */
  empty?: number | undefined;
  /** BB-U6: son 3 saniye: ışıklar hızlanır. */
  urgent?: boolean | undefined;
  /** BB-U5: aranın sonunda buton "yeniden parlar". */
  glow?: boolean | undefined;
  /** İzleyici: soluk, basılmaz; üstünde "İzliyorsun". */
  watching?: boolean | undefined;
  onDown?: (e: PointerEvent) => void;
  onUp?: () => void;
  /** Klavyeyle basış (Enter/Boşluk); dokunma `onDown` ya da ebeveyn alanı üzerinden gelir. */
  onKey?: () => void;
  /** Uçtan uca test için sabit kimlik (yalnız oyuncunun basma butonu). */
  testId?: string | undefined;
}

/** Arcade butonu: normal ve basılı görsel üst üste; etiket, dolum halkası ve parlama kubbenin üstünde. */
export function ArcadeButton(props: Props) {
  let root: HTMLDivElement | undefined;
  let flash: HTMLDivElement | undefined;

  const shake = (frames: Keyframe[], ms: number): void => {
    if (currentShakeGain() <= 0 || reducedMotion()) return;
    root?.animate(frames, { duration: ms, easing: "ease-out" });
  };

  createEffect(
    on(
      () => props.fx,
      (fx) => {
        if (!fx) return;
        const gain = currentShakeGain();
        if (fx.kind === "solo") {
          const x = (px: number): string => `translateX(${(px * gain).toFixed(1)}px)`;
          shake(
            [
              { transform: "translateX(0)" },
              { transform: `${x(-12)} rotate(${(-1.5 * gain).toFixed(2)}deg)` },
              { transform: `${x(10)} rotate(${(1.2 * gain).toFixed(2)}deg)` },
              { transform: x(-7) },
              { transform: x(4) },
              { transform: "translateX(0)" },
            ],
            380,
          );
        }
        if (flash) {
          flash.style.background =
            fx.kind === "solo" ? "#ff1f45" : fx.kind === "crowd" ? "#ffc23b" : "var(--lime)";
          const peak = currentFlashPeak(fx.kind === "crowd" ? 0.85 : 0.7) * (reducedMotion() ? 0.5 : 1);
          flash.animate([{ opacity: peak }, { opacity: 0 }], { duration: 420, easing: "ease-out" });
        }
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.empty,
      (n) => {
        if (n === undefined) return;
        shake(
          [
            { transform: "rotate(0)" },
            { transform: "rotate(-2.5deg)" },
            { transform: "rotate(2deg)" },
            { transform: "rotate(-1deg)" },
            { transform: "rotate(0)" },
          ],
          260,
        );
      },
      { defer: true },
    ),
  );

  return (
    <div
      class="arcade"
      classList={{
        "arcade--demo": props.demo,
        "arcade--off": props.disabled,
        "arcade--watch": props.watching,
      }}
      data-pressed={props.pressed ? "1" : undefined}
      data-ring={props.ring}
      data-filling={props.fill !== null && props.fill !== undefined ? "1" : undefined}
      data-urgent={props.urgent ? "1" : undefined}
      data-glow={props.glow ? "1" : undefined}
      ref={root}
    >
      <Show when={props.ring !== undefined}>
        <i class="arcade__ring" aria-hidden="true" />
      </Show>
      <div class="arcade__waves" aria-hidden="true">
        <For each={props.waves ?? []}>
          {(id) => (
            <i
              class="arcade__wave"
              classList={{ "arcade__wave--still": reducedMotion() }}
              data-id={id}
              style={{ "--wave-ms": `${props.waveMs ?? 300}ms` }}
            />
          )}
        </For>
        {props.demo && !props.onDown ? <i class="arcade__wave arcade__wave--loop" /> : null}
      </div>
      <button
        type="button"
        class="arcade__hit"
        data-testid={props.testId}
        aria-label={props.ariaLabel ?? "Bas"}
        disabled={props.disabled}
        onPointerDown={(e) => props.onDown?.(e)}
        onPointerUp={() => props.onUp?.()}
        onPointerCancel={() => props.onUp?.()}
        onPointerLeave={() => props.onUp?.()}
        onClick={(e) => {
          // Yalnız klavye (Enter/Boşluk): dokunuş zaten `pointerdown`da işlendi.
          if (e.detail === 0) props.onKey?.();
        }}
        onContextMenu={(e) => e.preventDefault()}
        tabIndex={props.demo && !props.onDown ? -1 : 0}
      >
        <span class="arcade__housing">
          <img
            class="arcade__img arcade__img--up"
            src={propSrc("genel/arcade-dugme")}
            alt=""
            draggable={false}
            width="384"
            height="384"
          />
          <img
            class="arcade__img arcade__img--down"
            src={propSrc("genel/arcade-dugme-basili")}
            alt=""
            draggable={false}
            width="384"
            height="384"
          />
          <span class="arcade__cap">
            <span class="arcade__flash" ref={flash} />
            <Show when={props.fill} keyed>
              {(id) => <i class="arcade__fill" data-id={id} aria-hidden="true" />}
            </Show>
            <Show when={props.ready} keyed>
              {(id) => <i class="arcade__ready" data-id={id} aria-hidden="true" />}
            </Show>
            <span class="arcade__label">{props.label ?? ""}</span>
          </span>
        </span>
      </button>
    </div>
  );
}
