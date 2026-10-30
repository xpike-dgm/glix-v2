import type { KontrolWaveResult, WireColor } from "@glix/engine";
import { For, onCleanup, onMount, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { CbMarker } from "../../ui/CbMarker.js";
import { CheckIcon } from "../../ui/Icons.js";
import { defusedBell } from "./bombSounds.js";
import type { Crew } from "./KontrolScreen.js";
import { COLOR_CSS, COLOR_MARK, COLOR_NAME, outcomeOf, waveCleared } from "./view.js";

export const Cross = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" />
  </svg>
);

/** Kesim çipi: renk (şekil ve ad) ve ✓/✗; kesmediyse "kesmedi". */
export function CutChip(props: { cut: WireColor | null; correct: boolean; compact?: boolean }) {
  return (
    <span
      class="kp__cutchip"
      data-ok={props.correct ? "1" : "0"}
      data-none={props.cut ? undefined : "1"}
      data-compact={props.compact ? "1" : undefined}
    >
      <Show when={props.cut} fallback={<span>{props.compact ? "–" : "kesmedi"}</span>}>
        {(c) => (
          <>
            <i class="kp__dot" style={{ background: COLOR_CSS[c()] }} />
            <span class="kp__cbm" style={props.compact ? { color: COLOR_CSS[c()] } : undefined}>
              <CbMarker index={COLOR_MARK[c()]} size={13} />
            </span>
            <Show when={!props.compact}>
              <span>{COLOR_NAME[c()]}</span>
            </Show>
            {props.correct ? <CheckIcon size={14} /> : <Cross />}
          </>
        )}
      </Show>
    </span>
  );
}

interface Props {
  result: KontrolWaveResult;
  crew: Crew[];
  selfId: string;
  spectator: boolean;
  /** Sonraki dalganın numarası (1 tabanlı). */
  next: number;
  sound: boolean;
}

/** Dalgalar arası kısa sonuç (4 sn): kim doğru kesti (✓/✗), o dalganın imha puanı ve ipucu taşıyıcısı. */
export function Ara(props: Props) {
  const member = (id: string) => props.crew.find((m) => m.id === id);
  const mine = () => outcomeOf(props.result, props.selfId);
  const cleared = () => waveCleared(props.result);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  onMount(() => {
    if (props.sound && cleared()) timer = setTimeout(defusedBell, 250);
  });
  return (
    <div class="kp__res">
      <div class="kp__head kp__head--res">
        <span class="kp__title">
          {cleared() ? "Bomba imha edildi!" : `Dalga ${props.result.wave + 1} bitti`}
        </span>
        <Show when={!props.spectator}>
          <span class="kp__verdict">
            Bu dalgada <b class="kp__score-sm">+{mine().points}</b> imha puanı
          </span>
        </Show>
      </div>
      <ul class="kp__rows" data-scroll>
        <For each={props.crew}>
          {(m, i) => {
            const row = () => props.result.rows[m.id];
            const carrier = () => member(row()?.carrier ?? "");
            const pts = () => props.result.scores[m.id] ?? 0;
            return (
              <li class="kp__row" data-me={m.id === props.selfId ? "1" : undefined} style={{ "--i": i() }}>
                <Avatar index={m.avatar} size={30} connected={m.connected} />
                <span class="kp__row-name">{m.nickname}</span>
                <CutChip cut={row()?.cut ?? null} correct={row()?.correct === true} />
                <span class="kp__hint-by" title="İpucu taşıyıcısı">
                  <Avatar index={carrier()?.avatar ?? 0} size={22} />
                </span>
                <span class="kp__pts" data-zero={pts() === 0 ? "1" : undefined}>
                  +{pts()}
                </span>
              </li>
            );
          }}
        </For>
      </ul>
      <p class="kp__legend">Küçük portre: o panelin ipucunu taşıyan · Dalga {props.next} geliyor</p>
    </div>
  );
}
