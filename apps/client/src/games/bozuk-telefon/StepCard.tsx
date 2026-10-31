import type { PlayerInfo } from "@glix/engine";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { Avatar } from "../../ui/Avatar.js";
import { CbState } from "../../ui/CbState.js";
import { FitText } from "./FitText.js";
import { typedCount } from "./fit.js";
import { Replay } from "./Replay.js";
import { replayPencil, typeKey } from "./sounds.js";
import type { ParsedStep } from "./view.js";

/** Daktilo süresi üst sınırı: gösteride iki adım arası 2 sn. */
const TYPE_MAX_MS = 1_200;
/** 😂 yığınında en çok bu kadar simge; fazlası sayıyla. */
const PILE_MAX = 6;

export interface StepCardProps {
  step: ParsedStep;
  index: number;
  /** İlk görünüş: yazı daktiloyla, çizim yeniden çizilerek gelir. */
  fresh?: boolean;
  /** Yazar (yalnız sonuçta; isimsiz aşamada verilmez). */
  author?: PlayerInfo | undefined;
  /** Yalnız sana: kendi adımın ("SENİN"). */
  mine?: boolean;
  /** 👑 EN KOMİK. */
  crowned?: boolean;
  /** Sonuçta aldığı oy (😂 yığını). */
  votes?: number | null;
  /** Kendi oyun bu karta (😂 damgası). */
  stamped?: boolean;
  /** Ses çalınsın mı (gösterideki ilk görünüş). */
  sound?: boolean;
  /** "feed": akış kartı, "big": tam ekran, "tv": büyük ekran, "thumb": galeri küçük kartı. */
  variant?: "feed" | "big" | "tv" | "thumb";
  /** Verilirse kart dokunulabilir (oylamada büyütmek için). */
  onOpen?: () => void;
  disabled?: boolean;
  selfId?: string;
}

/** Zincirin tek adımı: cümle (sığdırılmış, daktilo) ya da çizim (yeniden çizim). Gösteri, oylama, TV ve galeride. */
export function StepCard(props: StepCardProps) {
  const isDraw = () => props.step.kind === "draw";
  const text = () => (props.step.kind === "write" ? props.step.text : "");
  const [typed, setTyped] = createSignal<number | undefined>(undefined);
  let raf = 0;
  onMount(() => {
    if (!props.fresh || isDraw() || reducedMotion()) return;
    const t0 = performance.now();
    setTyped(0);
    const frame = (t: number): void => {
      const n = typedCount(text(), t - t0, TYPE_MAX_MS);
      if (n !== typed()) {
        setTyped(n);
        if (props.sound) typeKey();
      }
      if (n < Array.from(text()).length) raf = requestAnimationFrame(frame);
      else setTyped(undefined);
    };
    raf = requestAnimationFrame(frame);
  });
  onCleanup(() => cancelAnimationFrame(raf));

  const variant = () => props.variant ?? "feed";
  const pile = () => Math.min(PILE_MAX, props.votes ?? 0);
  const blank = () => props.step.kind === "draw" && props.step.drawing.strokes.length === 0;
  const kindLabel = () => (isDraw() ? "ÇİZİM" : "CÜMLE");
  const name = () => (props.author ? (props.author.id === props.selfId ? "Sen" : props.author.nickname) : "");

  const body = () => (
    <>
      <div class="btc__body">
        <Show
          when={props.step.kind === "draw" ? props.step.drawing : null}
          fallback={
            <FitText
              text={text() === "…" ? "…" : text()}
              max={variant() === "tv" ? 64 : variant() === "big" ? 40 : variant() === "thumb" ? 16 : 30}
              min={variant() === "tv" ? 22 : 13}
              {...(typed() === undefined ? {} : { typed: typed() as number })}
              class="btc__text"
            />
          }
        >
          {(d) => (
            <>
              <Replay
                strokes={d().strokes}
                version={d().key}
                play={props.fresh === true}
                {...(props.sound ? { onDraw: replayPencil } : {})}
              />
              <Show when={blank()}>
                <span class="bt__blank">Boş tuval</span>
              </Show>
            </>
          )}
        </Show>
        <Show when={props.crowned}>
          <span class="btc__crown">
            <span aria-hidden="true">👑</span> EN KOMİK
          </span>
          <CbState kind="star" size={18} class="bt__cb" />
        </Show>
        <Show when={pile() > 0}>
          <span class="btc__pile" role="img" aria-label={`${props.votes ?? 0} oy`}>
            <For each={Array.from({ length: pile() }, (_, i) => i)}>
              {(i) => (
                <i style={{ "--i": i }} aria-hidden="true">
                  😂
                </i>
              )}
            </For>
            <b>{props.votes}</b>
          </span>
        </Show>
        <Show when={props.stamped}>
          <span class="btc__stamp" role="img" aria-label="Oyun bu karta">
            <span aria-hidden="true">😂</span>
          </span>
        </Show>
      </div>
      <span class="btc__head">
        <span class="btc__no">{props.index + 1}</span>
        <Show when={props.author} fallback={<span class="btc__kind">{kindLabel()}</span>}>
          {(a) => (
            <span class="btc__by">
              <Avatar index={a().avatar} size={variant() === "tv" ? 44 : 26} connected={a().connected} />
              <span class="btc__name">{name()}</span>
            </span>
          )}
        </Show>
        <Show when={props.mine && !props.author}>
          <span class="btc__mine">SENİN</span>
        </Show>
      </span>
    </>
  );

  return (
    <Show
      when={props.onOpen}
      fallback={
        <div
          class="btc"
          data-v={variant()}
          data-kind={props.step.kind}
          data-fresh={props.fresh ? "1" : undefined}
          data-mine={props.mine ? "1" : undefined}
          data-crown={props.crowned ? "1" : undefined}
          data-named={props.author ? "1" : undefined}
        >
          {body()}
        </div>
      }
    >
      {(open) => (
        <button
          type="button"
          class="btc"
          data-v={variant()}
          data-kind={props.step.kind}
          data-fresh={props.fresh ? "1" : undefined}
          data-mine={props.mine ? "1" : undefined}
          data-crown={props.crowned ? "1" : undefined}
          data-named={props.author ? "1" : undefined}
          data-stamped={props.stamped ? "1" : undefined}
          disabled={props.disabled}
          aria-label={`${props.index + 1}. adım${props.mine ? " (senin)" : ""}${props.author ? `, ${name()}` : ""}${props.disabled ? "" : ": büyüt"}`}
          onClick={() => open()()}
        >
          {body()}
        </button>
      )}
    </Show>
  );
}
