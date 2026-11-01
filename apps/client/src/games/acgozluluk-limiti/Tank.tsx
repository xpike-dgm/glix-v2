import type { AcgozlulukBand, AcgozlulukReveal, AcgozlulukScoutWord } from "@glix/engine";
import { createMemo, For, Show } from "solid-js";
import {
  type EveryoneFit,
  type FillPlan,
  FOG_MS,
  SCOUT_TEXT,
  shortName,
  tankPercent,
  verdictOf,
} from "./view.js";

export interface TankEntry {
  id: string;
  /** Avatar sırası (0..7); oyuncu rengini belirler. */
  avatar: number;
  name: string;
  connected: boolean;
}

/** Gözcü kelimesi ekranın ortasında bu kadar kalır, sonra köşeye küçülür (AL-U5). */
export const PEEK_BIG_MS = 1_200;

interface Props {
  band: AcgozlulukBand;
  entries: TankEntry[];
  selfId: string;
  /** Kendi seçimin (açılmadan önce yalnız sen görürsün). */
  mine: number | null;
  lockedIds: readonly string[];
  scoutId: string | null;
  /** Gözcü baktıktan sonra geçen süre (ms); bakmadıysa null (avatar parıltısı). */
  peekAgo: number | null;
  /** Yalnız Gözcü'nün kendi ekranında: gördüğü kelime ve baktığından beri geçen süre. */
  peek: { word: AcgozlulukScoutWord; ago: number } | null;
  /** AL-U1: kendi ekranında "herkes senin kadar koyarsa" çizgisi (yazısı ekranda düğmelerin üstünde). */
  everyone: { choice: number; total: number; fit: EveryoneFit } | null;
  /** Kasa kapısı 0..1 (AL-U15). */
  door: number;
  /** Açılış: sonuç, plan ve açılış başından geçen süre. */
  open: { reveal: AcgozlulukReveal; plan: FillPlan; elapsed: number } | null;
  /** Hareket azaltma: bant anında çizgiye döner, kapı inmez. */
  reduced: boolean;
  /** TV: büyük yazılar. */
  tv?: boolean;
}

/** Ortak neon hazne: seçimde sisli limit bandı ve raftaki kapalı jetonlar; açılışta sıralı dolum. */
export function Tank(props: Props) {
  const pct = (v: number) => tankPercent(v, props.band);
  const entryOf = (id: string) => props.entries.find((e) => e.id === id);
  // AL-M4: bant açılışta 0,6 sn'de gerçek limit çizgisine daralır.
  const fog = createMemo(() => {
    const o = props.open;
    const { low, high } = props.band;
    if (!o) return { low, high, line: false };
    const k = props.reduced ? 1 : Math.min(1, Math.max(0, o.elapsed / FOG_MS));
    const lim = o.reveal.limit;
    return { low: low + (lim - low) * k, high: high + (lim - high) * k, line: k >= 1 };
  });
  const verdict = () => {
    const o = props.open;
    if (!o || o.elapsed < o.plan.verdictAt) return undefined;
    return verdictOf(o.reveal);
  };
  const segments = createMemo(() => {
    const o = props.open;
    if (!o) return [];
    let base = 0;
    return o.plan.segments.map((s) => {
      const out = { ...s, from: base, shown: o.elapsed >= s.at };
      base += s.value;
      return out;
    });
  });

  const pas = () =>
    props.entries.filter((e) => (props.open?.reveal.choices[e.id] ?? 0) === 0).map((e) => shortName(e.name));

  return (
    <div
      class="tank"
      classList={{ "tank--tv": props.tv === true }}
      data-mode={props.open ? "open" : "closed"}
      data-verdict={verdict()}
      data-over={verdict() ? (props.open?.reveal.over ? "1" : "0") : undefined}
    >
      <div class="tank__glass">
        <div class="tank__glow" aria-hidden="true" />

        {/* AL-U1: kendi payın (dipte) ve "herkes senin kadar" çizgisi */}
        <Show when={!props.open && props.everyone}>
          {(e) => {
            const self = () => entryOf(props.selfId);
            return (
              <>
                <i
                  class="tank__own"
                  aria-hidden="true"
                  style={{
                    height: `${pct(e().choice)}%`,
                    "--c": `var(--p${(self()?.avatar ?? 0) + 1})`,
                  }}
                />
                <div
                  class="tank__all"
                  data-fit={e().fit}
                  aria-hidden="true"
                  style={{ bottom: `${pct(e().total)}%`, "--c": `var(--p${(self()?.avatar ?? 0) + 1})` }}
                />
              </>
            );
          }}
        </Show>

        {/* AL-U6: sıralı dolum */}
        <Show when={props.open}>
          <div class="tank__fill" aria-hidden="true">
            <For each={segments()}>
              {(s) => {
                const e = () => entryOf(s.id);
                return (
                  <i
                    class="tank__seg cbpat"
                    classList={{
                      "tank__seg--in": s.shown,
                      "tank__seg--spill": s.spill && verdict() !== undefined,
                    }}
                    data-p={(e()?.avatar ?? 0) % 8}
                    data-me={s.id === props.selfId ? "1" : undefined}
                    style={{
                      bottom: `${pct(s.from)}%`,
                      height: `${pct(s.value)}%`,
                      "--c": `var(--p${(e()?.avatar ?? 0) + 1})`,
                      "--dur": `${props.reduced ? 0 : s.dur}ms`,
                    }}
                  >
                    <Show when={pct(s.value) >= 6}>
                      <span class="tank__seg-tag">
                        {shortName(e()?.name ?? "", props.tv ? 10 : 6)} {s.value}
                      </span>
                    </Show>
                  </i>
                );
              }}
            </For>
          </div>
        </Show>

        {/* AL-M4: sisli limit bandı; açılışta gerçek limit çizgisine daralır */}
        <div
          class="tank__fog"
          classList={{ "tank__fog--line": fog().line }}
          aria-hidden="true"
          style={{
            bottom: `${pct(fog().low)}%`,
            height: fog().line ? "0" : `${Math.max(0, pct(fog().high) - pct(fog().low))}%`,
          }}
        >
          <span class="tank__tag">
            {fog().line ? props.open?.reveal.limit : `${props.band.low}–${props.band.high}`}
          </span>
        </div>

        {/* Raftaki kapalı jetonlar: limit bandının hemen altındaki rafta (AL-U10) */}
        <Show when={!props.open}>
          <div
            class="tank__pile"
            style={{ top: `min(calc(${100 - pct(props.band.low)}% + 8px), calc(100% - 76px))` }}
          >
            <For each={props.entries}>
              {(e) => {
                const ready = () => props.lockedIds.includes(e.id);
                const me = () => e.id === props.selfId;
                const scout = () => e.id === props.scoutId;
                return (
                  <span
                    class="tok"
                    classList={{
                      "tok--me": me(),
                      "tok--ready": ready(),
                      "tok--off": !e.connected,
                      "tok--scout": scout(),
                      "tok--glint": scout() && props.peekAgo !== null && props.peekAgo < PEEK_BIG_MS,
                    }}
                    style={{ "--c": `var(--p${e.avatar + 1})` }}
                    title={!e.connected ? `${e.name} · kopuk` : scout() ? `${e.name} · Gözcü` : e.name}
                  >
                    {!e.connected ? "–" : ready() && !me() ? "✓" : me() ? (props.mine ?? "?") : "?"}
                  </span>
                );
              }}
            </For>
          </div>
        </Show>

        {/* AL-U15: kasa kapısı (süs; limit çizgisini kapatmaz) */}
        <Show when={!props.open && !props.reduced && props.door > 0}>
          <div class="tank__door" aria-hidden="true" style={{ height: `${props.door * 20}%` }} />
        </Show>

        {/* AL-U5: Gözcü'nün anahtar deliği */}
        <Show when={!props.open && props.peek}>
          {(p) => (
            <Show
              when={p().ago < PEEK_BIG_MS}
              fallback={
                <span class="tank__peek-tag" data-word={p().word}>
                  7. sn: {SCOUT_TEXT[p().word]}
                </span>
              }
            >
              <div class="tank__keyhole" data-word={p().word} role="status">
                <span class="tank__keyhole-word">{SCOUT_TEXT[p().word]}</span>
              </div>
            </Show>
          )}
        </Show>

        <Show when={verdict() && props.open?.reveal.over}>
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
        <Show when={verdict() === "full" && !props.reduced}>
          <div class="tank__rain" aria-hidden="true">
            <For each={[8, 22, 36, 50, 64, 78, 92, 15, 43, 71]}>
              {(x, i) => <i style={{ left: `${x}%`, "--k": i() }} />}
            </For>
          </div>
        </Show>

        {/* AL-U6: 0 seçenler şerit oluşturmaz; dolumdan sonra dipte yazar */}
        <Show when={verdict() && pas().length > 0}>
          <span class="tank__pas">Pas: {pas().join(", ")}</span>
        </Show>
      </div>
    </div>
  );
}
