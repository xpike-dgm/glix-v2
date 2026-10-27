import type { CizgiReveal } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticResult, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { fail, fanfare, match as matchSound, solo as soloSound, tick } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { CbState } from "../../ui/CbState.js";
import { groupByZone, isDense, pointsOf, statusOf, zoneLabel, zonesTopDown } from "./view.js";

export interface SonucEntry {
  id: string;
  avatar: number;
  nickname: string;
  connected: boolean;
}

interface Props {
  reveal: CizgiReveal;
  /** Seçim süresinin bitişi: sonuç animasyonu buradan başlar. */
  endsAt: number;
  entries: SonucEntry[];
  selfId: string;
  spectator: boolean;
  now: () => number;
}

/** Zaman çizelgesi (ms): pinler platformlara iner → aynı platformdakiler söner → tek kalanlar yükselir → puan. */
export const T_CRASH = 1700;
export const T_RISE = 3200;
export const T_FINAL = 4400;

export function Sonuc(props: Props) {
  const r = () => props.reveal;
  const byId = createMemo(() => new Map(props.entries.map((e) => [e.id, e])));
  const groups = createMemo(() => groupByZone(r()));
  const passive = createMemo(() =>
    props.entries.filter((e) => statusOf(r(), e.id) === "none").map((e) => e.id),
  );
  const hasCrash = () => props.entries.some((e) => statusOf(r(), e.id) === "crashed");
  const winner = () => props.entries.find((e) => statusOf(r(), e.id) === "first");
  const myPoints = () => pointsOf(r(), props.selfId);

  const skew = Math.max(0, Math.min(6000, props.now() - props.endsAt));
  const reduced = reducedMotion();
  const stageAt = (ms: number): number => (ms < T_CRASH ? 0 : ms < T_RISE ? 1 : ms < T_FINAL ? 2 : 3);
  const [stage, setStage] = createSignal(reduced ? 3 : stageAt(skew));

  onMount(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void): void => {
      if (ms > skew) timers.push(setTimeout(fn, ms - skew));
    };
    at(T_CRASH, () => {
      setStage(1);
      if (hasCrash()) {
        fail();
        hapticSolo();
      } else {
        tick();
        hapticTick();
      }
    });
    at(T_RISE, () => {
      setStage(2);
      tick();
      hapticTick();
    });
    at(T_FINAL, () => {
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

  const headLabel = () =>
    stage() === 0
      ? "Pinler iniyor"
      : stage() === 1
        ? hasCrash()
          ? "Aynı platformdakiler"
          : "Platformlar"
        : stage() === 2 || props.spectator
          ? "En yüksek tek kalan"
          : myPoints() > 0
            ? "Puanın"
            : "Bu sefer";
  const headValue = () =>
    stage() === 0
      ? "?"
      : stage() === 1
        ? hasCrash()
          ? "Söndü!"
          : "Temiz!"
        : stage() === 2 || props.spectator
          ? (winner()?.nickname ?? "Kimse yok")
          : myPoints() > 0
            ? `+${myPoints()}`
            : "puan yok";
  const headKind = () =>
    stage() === 1 && hasCrash()
      ? "crash"
      : stage() === 3 && !props.spectator
        ? `pts${myPoints()}`
        : stage() === 2 || (stage() === 3 && props.spectator)
          ? "name"
          : "n";

  return (
    <div class="cg-res" style={{ "--skew": `${skew}ms` }} data-stage={stage()}>
      <div class="cg-res__head" role="status" aria-live="polite">
        <span class="overline">{headLabel()}</span>
        <span class="cg-res__val" data-k={headKind()}>
          {headValue()}
        </span>
      </div>

      <div class="cg__tower cg__tower--res" data-dense={isDense(r().zoneWidth) ? "1" : undefined}>
        <For each={zonesTopDown(r().zoneWidth)}>
          {(z, rowIdx) => {
            const ids = () => groups().get(z) ?? [];
            const crash = () => ids().length >= 2;
            return (
              <div
                class="cgrow"
                data-crash={crash() ? "1" : undefined}
                data-has={ids().length > 0 ? "1" : undefined}
                style={{ "--ri": rowIdx(), "--lines": Math.max(1, Math.ceil(ids().length / 3)) }}
              >
                <span class="cgrow__label">{zoneLabel(z, r().zoneWidth)}</span>
                <span class="cgrow__bar">
                  <For each={ids()}>
                    {(id, k) => {
                      const e = () => byId().get(id);
                      const st = () => statusOf(r(), id);
                      const pts = () => pointsOf(r(), id);
                      return (
                        <span
                          class="cgchip"
                          data-status={st()}
                          data-me={id === props.selfId ? "1" : undefined}
                          style={{ "--k": k(), "--ri": rowIdx() }}
                        >
                          <Avatar
                            index={e()?.avatar ?? 0}
                            size="clamp(20px, 3.4dvh, 26px)"
                            connected={e()?.connected ?? true}
                          />
                          <b class="cgchip__n">{r().choices[id]}</b>
                          <Show when={st() === "crashed"}>
                            <CbState kind="bad" size={13} />
                          </Show>
                          <Show when={st() === "first"}>
                            <CbState kind="star" size={13} />
                          </Show>
                          <Show when={pts() > 0}>
                            <em class="cgchip__pts">+{pts()}</em>
                          </Show>
                        </span>
                      );
                    }}
                  </For>
                </span>
              </div>
            );
          }}
        </For>
      </div>

      <Show when={passive().length > 0}>
        <div class="cgpassive">
          <span class="cgpassive__label">Seçmedi</span>
          <For each={passive()}>
            {(id) => (
              <span class="cgpassive__who" data-me={id === props.selfId ? "1" : undefined}>
                <Avatar
                  index={byId().get(id)?.avatar ?? 0}
                  size="clamp(20px, 3.2dvh, 24px)"
                  connected={byId().get(id)?.connected ?? true}
                />
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
