import { type OrtalamaReveal, ortalamaMultiplier } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticResult, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { fanfare, go, match as matchSound, solo as soloSound, tick } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { CbMarker } from "../../ui/CbMarker.js";
import { CbState } from "../../ui/CbState.js";
import { look } from "../../ui/avatars.js";
import {
  assignLanes,
  formatNumber,
  linePercent,
  multiplierLabel,
  pointsOf,
  targetName,
  tierOf,
} from "./view.js";

export interface SonucEntry {
  id: string;
  avatar: number;
  nickname: string;
  connected: boolean;
}

interface Props {
  reveal: OrtalamaReveal;
  /** Gösterilen tur (1 tabanlı) ve toplam tur sayısı. */
  round: number;
  rounds: number;
  multiplier: { num: number; den: number };
  /** Bu tur dahil mini puan toplamları. */
  totals: Record<string, number>;
  /** Yalnız son turda: genel skora eklenecek puanlar (3 turun toplamından, bir kez). */
  final: Record<string, number> | null;
  /** Seçim süresinin bitişi: sonuç animasyonu buradan başlar. */
  endsAt: number;
  entries: SonucEntry[];
  selfId: string;
  spectator: boolean;
  now: () => number;
}

/** Zaman çizelgesi (ms): sayılar açılır → ortalama çizgisi → hedef ışını → kapsüller hedefe bağlanır → puan. */
export const T_MEAN = 1000;
export const T_TARGET = 2100;
export const T_LINK = 3100;
export const LINK_STEP = 320;

const LANE_H = 22;

/** Sonraki turun çarpanı (½ → ⅔ → ¾). */
function nextMultiplier(round: number): { num: number; den: number } {
  return ortalamaMultiplier(round);
}

export function Sonuc(props: Props) {
  const r = () => props.reveal;
  const byId = createMemo(() => new Map(props.entries.map((e) => [e.id, e])));
  const order = createMemo(() => r().order.filter((id) => byId().has(id)));
  const lanes = createMemo(() =>
    assignLanes(
      order().map((id) => r().choices[id] ?? 0),
      7,
    ),
  );
  const laneCount = () => Math.max(1, ...lanes().map((l) => l + 1));
  const myPoints = () => pointsOf(r(), props.selfId);
  const isLast = () => props.round >= props.rounds;
  const myTotal = () => props.totals[props.selfId] ?? 0;
  const myFinal = () => props.final?.[props.selfId] ?? 0;
  const tFinal = () => T_LINK + order().length * LINK_STEP + 150;

  // Animasyon, seçim süresi bittiği andan sayılır (geç açılan ekran kaldığı yerden devam eder).
  const skew = Math.max(0, Math.min(6000, props.now() - props.endsAt));
  const reduced = reducedMotion();
  const stageAt = (ms: number): number => (ms <= T_MEAN ? 0 : ms <= T_TARGET ? 1 : ms <= tFinal() ? 2 : 3);
  const [stage, setStage] = createSignal(reduced ? 3 : stageAt(skew));

  onMount(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void): void => {
      if (ms > skew) timers.push(setTimeout(fn, ms - skew));
    };
    at(T_MEAN, () => {
      setStage(1);
      tick();
      hapticTick();
    });
    at(T_TARGET, () => {
      setStage(2);
      go();
    });
    at(tFinal(), () => {
      setStage(3);
      if (props.spectator) return;
      const pts = myPoints();
      if (pts >= 2) {
        fanfare();
        hapticResult();
      } else if (pts === 1) {
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

  // Son turun sonunda başlık, genel skora eklenen puanı gösterir; önceki turlarda yalnız tur puanı.
  const headPoints = () => (isLast() ? myFinal() : myPoints());
  const headLabel = () =>
    stage() === 0
      ? `Tur ${props.round}/${props.rounds} · sayılar açılıyor`
      : stage() === 1
        ? "Ortalama"
        : stage() === 2 || props.spectator
          ? `Hedef · ${targetName(props.multiplier)}`
          : isLast()
            ? headPoints() > 0
              ? "Genel skora eklenen"
              : "Genel skor"
            : myPoints() > 0
              ? "Tur puanın"
              : "Bu sefer";
  const headValue = () =>
    stage() === 0
      ? "?"
      : stage() === 1
        ? formatNumber(r().mean)
        : stage() === 2 || props.spectator
          ? formatNumber(r().target)
          : headPoints() > 0
            ? `+${headPoints()}`
            : "puan yok";
  const headSub = () =>
    stage() < 3 || props.spectator
      ? ""
      : isLast()
        ? `3 turun toplamı: ${myTotal()} puan`
        : `Toplam: ${myTotal()} puan`;

  return (
    <div
      class="ort-res"
      style={{
        "--skew": `${skew}ms`,
        "--mean": linePercent(r().mean) / 100,
        "--target": linePercent(r().target) / 100,
      }}
      data-stage={stage()}
    >
      <div class="ort-res__head" role="status" aria-live="polite">
        <span class="overline">{headLabel()}</span>
        <span
          class="ort-res__val"
          data-k={stage() === 3 && !props.spectator ? "pts" : "n"}
          data-pts={headPoints()}
        >
          {headValue()}
        </span>
        <Show when={headSub()}>
          <span class="ort-res__sub">{headSub()}</span>
        </Show>
      </div>

      <div class="sc" style={{ "--lanes": laneCount() }} aria-hidden="true">
        <div class="sc__field" style={{ height: `${laneCount() * LANE_H + 10}px` }}>
          <i class="sc__mean" style={{ "--x": linePercent(r().mean) / 100 }} />
          <i class="sc__beam" style={{ "--x": linePercent(r().target) / 100 }} />
          <For each={order()}>
            {(id, i) => {
              const x = () => linePercent(r().choices[id] ?? 0) / 100;
              const t = () => linePercent(r().target) / 100;
              const e = () => byId().get(id);
              return (
                <>
                  <i
                    class="sc__link"
                    data-tier={tierOf(r(), id)}
                    data-dir={x() <= t() ? "r" : "l"}
                    style={{
                      "--from": Math.min(x(), t()),
                      "--w": Math.abs(x() - t()),
                      "--y": `${(lanes()[i()] ?? 0) * LANE_H + 5}px`,
                      "--d": `${T_LINK + i() * LINK_STEP}ms`,
                    }}
                  />
                  <i
                    class="sc__dot"
                    data-tier={tierOf(r(), id)}
                    data-me={id === props.selfId ? "1" : undefined}
                    style={{
                      "--x": x(),
                      "--y": `${(lanes()[i()] ?? 0) * LANE_H + 5}px`,
                      "--c": look(e()?.avatar ?? 0).color,
                      "--d": `${(i() * 60) % 400}ms`,
                    }}
                  >
                    <CbMarker index={e()?.avatar ?? 0} size={12} class="sc__cb" />
                    <Show when={tierOf(r(), id) === "gold"}>
                      <CbState kind="star" size={11} class="sc__cbstar" />
                    </Show>
                  </i>
                </>
              );
            }}
          </For>
        </div>
        <div class="sc__scale">
          <span>0</span>
          <span class="sc__legend">
            <span class="sc__key sc__key--mean">ortalama {formatNumber(r().mean)}</span>
            <span class="sc__key sc__key--target">
              hedef {multiplierLabel(props.multiplier)} · {formatNumber(r().target)}
            </span>
          </span>
          <span>100</span>
        </div>
      </div>

      <ol class="rrows">
        <For each={order()}>
          {(id, i) => {
            const e = () => byId().get(id);
            const pts = () => r().points[id] ?? 0;
            return (
              <li
                class="rrow"
                data-tier={tierOf(r(), id)}
                data-me={id === props.selfId ? "1" : undefined}
                style={{
                  "--c": look(e()?.avatar ?? 0).color,
                  "--d": `${T_LINK + i() * LINK_STEP}ms`,
                  "--o": `${(i() * 60) % 400}ms`,
                }}
              >
                <span class="rrow__rank">{r().ranks[id]}</span>
                <Avatar
                  index={e()?.avatar ?? 0}
                  size="clamp(26px, 4.4dvh, 30px)"
                  connected={e()?.connected ?? true}
                />
                <span class="rrow__name">{id === props.selfId ? "Sen" : (e()?.nickname ?? "Oyuncu")}</span>
                <span class="rrow__num">{r().choices[id]}</span>
                <span class="rrow__dist">±{formatNumber(r().distances[id] ?? 0)}</span>
                <span class="rrow__pts" data-on={pts() > 0 ? "1" : undefined}>
                  <Show when={pts() > 0}>+{pts()}</Show>
                </span>
              </li>
            );
          }}
        </For>
      </ol>
      <Show when={!isLast()}>
        <p class="ort-res__next">Sonraki tur: hedef {targetName(nextMultiplier(props.round))}</p>
      </Show>
    </div>
  );
}
