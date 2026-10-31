import type { ParsedEffect } from "@glix/engine";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { reducedMotion } from "../fx/motion.js";
import { frameLook, type Particle, particlesOf, shopTexture } from "./effects.js";

/**
 * Efekt motorlarının bileşenleri (MG-4). Parçacıklar yalnız transform/opacity ile oynar; hareket azaltmada CSS
 * onları gizler (`styles/effects.css`). En çok 60 parçacık (`particlesOf`).
 */
export function FxParticles(props: {
  effect: ParsedEffect;
  shape: "ring" | "box";
  colour?: string | undefined;
}) {
  const list = (): Particle[] => particlesOf(props.effect, props.shape);
  const colour = () =>
    props.colour ?? (props.effect.motor === "kivilcim" ? props.effect.renk : "rgba(255, 255, 255, 0.9)");
  return (
    <span
      class="fx-parcaciklar"
      data-motor={props.effect.motor}
      aria-hidden="true"
      style={{ "--fx-renk": colour() }}
    >
      <For each={list()}>
        {(p) => (
          <span
            class="fx-parcacik"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              "--fx-dx": `${p.dx}px`,
              "--fx-dy": `${p.dy}px`,
              "--fx-don": `${p.rotate}deg`,
              "animation-delay": `${p.delay}s`,
              "animation-duration": `${p.duration}s`,
            }}
          >
            <Show when={p.src}>{(src) => <img src={src()} alt="" draggable={false} />}</Show>
          </span>
        )}
      </For>
    </span>
  );
}

/** Kare animasyonu: kareler sırayla; hareket azaltmada yalnız ilk kare. */
export function FxFrames(props: { effect: Extract<ParsedEffect, { motor: "kare-animasyon" }> }) {
  const [at, setAt] = createSignal(0);
  onMount(() => {
    if (reducedMotion()) return;
    const n = props.effect.kareler.length;
    const t = setInterval(() => {
      setAt((i) => {
        if (i + 1 < n) return i + 1;
        return props.effect.dongu ? 0 : i;
      });
    }, props.effect.kareSuresi);
    onCleanup(() => clearInterval(t));
  });
  return (
    <span class="fx-kareler" aria-hidden="true">
      <For each={props.effect.kareler}>
        {(k, i) => (
          <img src={shopTexture(k)} alt="" draggable={false} style={{ opacity: i() === at() ? "1" : "0" }} />
        )}
      </For>
    </span>
  );
}

/**
 * Herhangi bir tarifi bir kutuda çizer: giriş efektinin ek katmanı, zafer kutlamasının ek katmanı ve önizleme sayfası.
 * Çerçeve tarifleri halka gibi (kutuya oturan görsel), ad tarifleri burada çizilmez (`PlayerName` çizer).
 */
export function EffectView(props: { effect: ParsedEffect; class?: string }) {
  const e = () => props.effect;
  return (
    <span class={`fx-kutu ${props.class ?? ""}`} aria-hidden="true">
      <Show when={e().motor === "kivilcim" || e().motor === "parcacik-yagmuru" ? e() : null} keyed>
        {(p) => <FxParticles effect={p} shape={p.motor === "kivilcim" ? "ring" : "box"} />}
      </Show>
      <Show
        when={
          e().motor === "kare-animasyon" ? (e() as Extract<ParsedEffect, { motor: "kare-animasyon" }>) : null
        }
        keyed
      >
        {(k) => <FxFrames effect={k} />}
      </Show>
      <Show
        when={
          e().motor === "doku-katmani" || e().motor === "donen-halka" || e().motor === "parlama" ? e() : null
        }
        keyed
      >
        {(f) => (
          <For each={frameLook(f).layers}>
            {(l) => (
              <img class={`fx-kutu__kat ${l.class}`} src={l.src} alt="" draggable={false} style={l.style} />
            )}
          </For>
        )}
      </Show>
    </span>
  );
}
