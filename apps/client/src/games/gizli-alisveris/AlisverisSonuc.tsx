import type { AlisverisProduct, AlisverisReveal } from "@glix/engine";
import { formatKredi } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticResult, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { fanfare, match as matchSound, solo as soloSound, tick } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { UrunArt } from "./Urun.js";
import { productValueText, ranking } from "./view.js";

export interface SonucEntry {
  id: string;
  avatar: number;
  nickname: string;
  connected: boolean;
}

interface Props {
  reveal: AlisverisReveal;
  products: AlisverisProduct[];
  /** Alışveriş bitişi: sonuç animasyonu buradan başlar. */
  anchor: number;
  entries: SonucEntry[];
  selfId: string;
  spectator: boolean;
  now: () => number;
}

/** Zaman çizelgesi (ms): kepenk açılır → alıcı sayıları ve değerler → sepet sıralaması. */
export const T_SHELF = 900;
export const T_RANK = 4600;

export function AlisverisSonuc(props: Props) {
  const r = () => props.reveal;
  const byId = createMemo(() => new Map(props.entries.map((e) => [e.id, e])));
  const order = createMemo(() =>
    ranking(
      r(),
      props.entries.map((e) => e.id),
    ),
  );
  const iWon = () => r().winners.includes(props.selfId);

  const skew = Math.max(0, Math.min(8000, props.now() - props.anchor));
  const reduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const stageAt = (ms: number): number => (ms < T_SHELF ? 0 : ms < T_RANK ? 1 : 2);
  const [stage, setStage] = createSignal(reduced ? 2 : stageAt(skew));

  onMount(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void): void => {
      if (ms > skew) timers.push(setTimeout(fn, ms - skew));
    };
    at(T_SHELF, () => {
      setStage(1);
      tick();
      hapticTick();
    });
    at(T_RANK, () => {
      setStage(2);
      if (props.spectator) return;
      if (iWon()) {
        fanfare();
        hapticResult();
      } else if ((r().values[props.selfId] ?? 0) > 0) {
        matchSound();
        hapticMatch();
      } else {
        soloSound();
        hapticSolo();
      }
    });
    onCleanup(() => {
      for (const t of timers) clearTimeout(t);
    });
  });

  const head = (): { label: string; value: string; kind: string } => {
    const s = stage();
    if (s === 0) return { label: "Raf kepengi", value: "Açılıyor", kind: "n" };
    if (s === 1) return { label: "Kaç kişi aldı?", value: "Bölünüyor", kind: "n" };
    if (props.spectator || !(props.selfId in r().values)) {
      const w = r().winners.map((id) => byId().get(id)?.nickname ?? "Oyuncu");
      return w.length === 0
        ? { label: "En değerli sepet", value: "Kimse yok", kind: "dim" }
        : {
            label: "En değerli sepet",
            value: w.length === 1 ? (w[0] ?? "") : `${w.length} kişi`,
            kind: "gold",
          };
    }
    return iWon()
      ? { label: "En değerli sepet", value: "+1", kind: "gold" }
      : { label: "Sepetin", value: formatKredi(r().values[props.selfId] ?? 0), kind: "dim" };
  };

  return (
    <div class="ares" style={{ "--skew": `${skew}ms` }} data-stage={stage()}>
      <div class="ares__head" role="status" aria-live="polite">
        <span class="overline">{head().label}</span>
        <span class="ares__val" data-k={head().kind} data-s={stage()}>
          {head().value}
        </span>
      </div>

      <Show
        when={stage() >= 2}
        fallback={
          <div class="ashelf ashelf--res">
            <For each={props.products}>
              {(p, i) => {
                const n = () => r().buyers[String(p.id)] ?? 0;
                return (
                  <div
                    class="aitem aitem--res"
                    data-n={n()}
                    data-open={stage() >= 1 ? "1" : undefined}
                    style={{ "--i": i() }}
                  >
                    <UrunArt id={p.id} name={p.name} decorative />
                    <span class="aitem__name">{p.name}</span>
                    <span class="aitem__price">
                      <Show when={stage() >= 1 && n() > 1} fallback={p.price}>
                        <s>{p.price}</s> {productValueText(p.price, n())}
                      </Show>
                    </span>
                    <span class="aitem__buyers">
                      {stage() >= 1 ? (n() === 0 ? "kimse" : `${n()} kişi`) : "?"}
                    </span>
                  </div>
                );
              }}
            </For>
            <div class="ashutter" aria-hidden="true" />
          </div>
        }
      >
        <ol class="arank">
          <For each={order()}>
            {(id, i) => {
              const e = () => byId().get(id);
              const win = () => r().winners.includes(id);
              return (
                <li
                  class="arow"
                  data-win={win() ? "1" : undefined}
                  data-me={id === props.selfId ? "1" : undefined}
                  style={{ "--i": i() }}
                >
                  <Avatar
                    index={e()?.avatar ?? 0}
                    size="clamp(30px, 5.4dvh, 38px)"
                    connected={e()?.connected ?? true}
                  />
                  <span class="arow__main">
                    <span class="arow__name">{e()?.nickname ?? "Oyuncu"}</span>
                    <span class="arow__items">
                      <For each={r().baskets[id] ?? []} fallback={<em>Sepet boş</em>}>
                        {(pid) => {
                          const p = props.products.find((x) => x.id === pid);
                          return <UrunArt id={pid} name={p?.name ?? "?"} />;
                        }}
                      </For>
                    </span>
                  </span>
                  <span class="arow__val">
                    {formatKredi(r().values[id] ?? 0)}
                    <Show when={win()}>
                      <em class="arow__pts">+1</em>
                    </Show>
                  </span>
                </li>
              );
            }}
          </For>
        </ol>
      </Show>
    </div>
  );
}
