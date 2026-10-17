import { createMemo, For, Show } from "solid-js";
import { limitLinePercent, segmentPercent } from "./view.js";

export interface TankEntry {
  id: string;
  /** Avatar sırası (0..7); oyuncu rengini belirler. */
  avatar: number;
}

interface Props {
  limit: number;
  /** Seçim yapabilecek herkes (jeton sayısı bundan gelir; değerler gizlidir). */
  entries: TankEntry[];
  selfId: string;
  /** Kendi seçimin (açılmadan önce yalnız sen görürsün). */
  mine: number | null;
  /** Açılmış seçimler; null iken hazne kapalıdır. */
  choices: Record<string, number> | null;
  over: boolean;
}

/** Ortak neon hazne: kapalıyken üstü kapalı jetonlar, açılınca herkesin jetonları dolar. */
export function Tank(props: Props) {
  const segments = createMemo(() => {
    const choices = props.choices;
    if (!choices) return [];
    return props.entries
      .map((e) => ({ ...e, value: choices[e.id] ?? 0 }))
      .filter((e) => e.value > 0)
      .map((e, i) => ({ ...e, pct: segmentPercent(e.value, props.limit), i }));
  });
  const verdictDelay = () => `${segments().length * 300 + 250}ms`;
  const verdict = () => (props.choices ? (props.over ? "over" : "ok") : undefined);

  return (
    <div
      class="tank"
      data-verdict={verdict()}
      style={{ "--vd": verdictDelay(), "--lim": `${limitLinePercent(props.limit)}%` }}
    >
      <div class="tank__glass">
        <div class="tank__glow" aria-hidden="true" />
        <Show
          when={props.choices}
          fallback={
            <div class="tank__pile" aria-hidden="true">
              <For each={props.entries}>
                {(e) => (
                  <span
                    class="tok"
                    classList={{ "tok--me": e.id === props.selfId }}
                    style={{ "--c": `var(--p${e.avatar + 1})` }}
                  >
                    {e.id === props.selfId ? (props.mine ?? "?") : "?"}
                  </span>
                )}
              </For>
            </div>
          }
        >
          <div class="tank__fill" aria-hidden="true">
            <For each={segments()}>
              {(s) => (
                <i
                  class="tank__seg"
                  data-me={s.id === props.selfId ? "1" : undefined}
                  style={{
                    height: `${s.pct}%`,
                    "--c": `var(--p${s.avatar + 1})`,
                    "--d": `${s.i * 300}ms`,
                  }}
                />
              )}
            </For>
          </div>
        </Show>
        <div class="tank__line" aria-hidden="true">
          <span class="tank__tag">{props.limit}</span>
        </div>
        <Show when={verdict() === "over"}>
          <svg class="tank__crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <title>Çatlak</title>
            <polyline
              pathLength="1"
              points="52,0 44,14 58,26 40,40 56,52 38,66 54,78 46,100"
              fill="none"
              stroke="#ff3b5c"
              stroke-width="3"
              stroke-linejoin="bevel"
              vector-effect="non-scaling-stroke"
            />
          </svg>
        </Show>
      </div>
    </div>
  );
}
