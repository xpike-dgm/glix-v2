import { createEffect, For, on } from "solid-js";

export interface ArcadeFx {
  kind: "match" | "solo";
  n: number;
}

interface Props {
  pressed?: boolean;
  disabled?: boolean;
  /** Halka dalgası kimlikleri; ebeveyn süre dolunca listeden çıkarır. */
  waves?: number[];
  waveMs?: number;
  fx?: ArcadeFx | null;
  label?: string;
  demo?: boolean;
  onDown?: (e: PointerEvent) => void;
  onUp?: () => void;
}

/** CSS katmanlarından kurulu arcade butonu: metal halka, iç parlama, gömülen kırmızı kubbe. */
export function ArcadeButton(props: Props) {
  let root: HTMLDivElement | undefined;
  let flash: HTMLDivElement | undefined;

  createEffect(
    on(
      () => props.fx,
      (fx) => {
        if (!fx) return;
        if (fx.kind === "solo") {
          root?.animate(
            [
              { transform: "translateX(0)" },
              { transform: "translateX(-12px) rotate(-1.5deg)" },
              { transform: "translateX(10px) rotate(1.2deg)" },
              { transform: "translateX(-7px)" },
              { transform: "translateX(4px)" },
              { transform: "translateX(0)" },
            ],
            { duration: 380, easing: "ease-out" },
          );
        }
        if (flash) {
          flash.style.background = fx.kind === "match" ? "var(--lime)" : "#ff1f45";
          flash.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 420, easing: "ease-out" });
        }
      },
      { defer: true },
    ),
  );

  return (
    <div
      class="arcade"
      classList={{ "arcade--demo": props.demo, "arcade--off": props.disabled }}
      data-pressed={props.pressed ? "1" : undefined}
      ref={root}
    >
      <div class="arcade__waves" aria-hidden="true">
        <For each={props.waves ?? []}>
          {(id) => (
            <i class="arcade__wave" data-id={id} style={{ "--wave-ms": `${props.waveMs ?? 300}ms` }} />
          )}
        </For>
        {props.demo ? <i class="arcade__wave arcade__wave--loop" /> : null}
      </div>
      <button
        type="button"
        class="arcade__hit"
        aria-label="Bas"
        disabled={props.disabled}
        onPointerDown={(e) => props.onDown?.(e)}
        onPointerUp={() => props.onUp?.()}
        onPointerCancel={() => props.onUp?.()}
        onPointerLeave={() => props.onUp?.()}
        onContextMenu={(e) => e.preventDefault()}
        tabIndex={props.demo ? -1 : 0}
      >
        <span class="arcade__housing">
          <span class="arcade__well">
            <span class="arcade__side" />
            <span class="arcade__cap">
              <span class="arcade__gloss" />
              <span class="arcade__flash" ref={flash} />
              <span class="arcade__label">{props.label ?? ""}</span>
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
