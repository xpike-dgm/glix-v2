import type { KareReveal } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticResult, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { fail, fanfare, match as matchSound, solo as soloSound, tick } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { cellName, groupByCell, statusOf, whoColumns } from "./view.js";

export interface SonucEntry {
  id: string;
  avatar: number;
  nickname: string;
  connected: boolean;
}

interface Props {
  reveal: KareReveal;
  size: number;
  /** Bu aşamanın seçim bitişi: sonuç animasyonu buradan başlar. */
  anchor: number;
  /** 1. aşama sonucu mu, son sonuç mu. */
  final: boolean;
  /** 1. aşama sonrası oyun sürüyor mu (2. aşama var mı). */
  continues: boolean;
  /** Rakipsiz sayılıp otomatik +1 alan oyuncu. */
  walkover: string | null;
  /** Kendi toplam puanın (şimdiye kadar). */
  total: number;
  entries: SonucEntry[];
  selfId: string;
  spectator: boolean;
  now: () => number;
}

/** Zaman çizelgesi (ms): avatarlar kareye iner → çakışanlar söner → tek kalanlar altın sütunla yükselir. */
export const T_CLASH = 1100;
export const T_GOLD = 2200;

export function KareSonuc(props: Props) {
  const r = () => props.reveal;
  const byId = createMemo(() => new Map(props.entries.map((e) => [e.id, e])));
  const groups = createMemo(() => groupByCell(r()));
  const cells = () => Array.from({ length: props.size * props.size }, (_, i) => i);
  const passive = createMemo(() => Object.keys(r().status).filter((id) => statusOf(r(), id) === "passive"));
  const soloCount = () => Object.values(r().status).filter((s) => s === "solo").length;
  const hasClash = () => Object.values(r().status).some((s) => s === "clash");
  const mine = () => statusOf(r(), props.selfId);
  const iAmWalkover = () => props.walkover === props.selfId;

  const skew = Math.max(0, Math.min(6000, props.now() - props.anchor));
  const reduced = reducedMotion();
  const stageAt = (ms: number): number => (ms < T_CLASH ? 0 : ms < T_GOLD ? 1 : 2);
  const [stage, setStage] = createSignal(reduced ? 2 : stageAt(skew));

  onMount(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void): void => {
      if (ms > skew) timers.push(setTimeout(fn, ms - skew));
    };
    at(T_CLASH, () => {
      setStage(1);
      if (hasClash()) {
        fail();
        hapticSolo();
      } else {
        tick();
        hapticTick();
      }
    });
    at(T_GOLD, () => {
      setStage(2);
      if (props.spectator || mine() === null) return;
      if (props.final && props.total >= 2) {
        fanfare();
        hapticResult();
      } else if (mine() === "solo") {
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
    if (s === 0) return { label: "Kareler açılıyor", value: "?", kind: "n" };
    if (s === 1) {
      return hasClash()
        ? { label: "Aynı kareyi seçenler", value: "Çakıştı!", kind: "clash" }
        : { label: "Kareler", value: "Temiz!", kind: "gold" };
    }
    const m = mine();
    if (props.spectator || m === null) {
      return soloCount() > 0
        ? { label: "Tek kalan", value: `${soloCount()} kişi`, kind: "gold" }
        : { label: "Bu aşamada", value: "Kimse yok", kind: "dim" };
    }
    if (m === "solo") {
      return iAmWalkover()
        ? { label: "Rakipsiz kaldın", value: "+2", kind: "gold" }
        : { label: "Tek kaldın", value: "+1", kind: "gold" };
    }
    if (m === "clash") return { label: "Çakıştın", value: "Elendin", kind: "clash" };
    return { label: "Seçmedin", value: "Pasif", kind: "dim" };
  };

  const note = (): string => {
    if (stage() < 2) return "";
    if (!props.final) {
      if (props.continues) return "Tek kalanlar 2. aşamaya geçti";
      if (props.walkover !== null) {
        const w = byId().get(props.walkover);
        return iAmWalkover()
          ? "İkinci aşama rakipsiz: bir +1 daha!"
          : `${w?.nickname ?? "Biri"} rakipsiz kaldı: +1 daha`;
      }
      return "Kimse kalmadı, puan yok";
    }
    if (props.spectator || mine() === null) return "";
    return props.total > 0 ? `Toplam +${props.total}` : "Bu sefer puan yok";
  };

  return (
    <div class="kres" style={{ "--skew": `${skew}ms` }} data-stage={stage()}>
      <div class="kres__head" role="status" aria-live="polite">
        <span class="overline">{head().label}</span>
        <span class="kres__val" data-k={head().kind}>
          {head().value}
        </span>
        <span class="kres__note">{note()}</span>
      </div>

      <div class="kstage">
        <div class="kgrid" style={{ "--n": props.size }}>
          <For each={cells()}>
            {(cell) => {
              const ids = () => groups().get(cell) ?? [];
              const state = (): string =>
                ids().length === 0 ? "empty" : ids().length === 1 ? "solo" : "clash";
              return (
                <div
                  class="kcell kcell--res"
                  data-state={state()}
                  data-has={ids().length > 0 ? "1" : undefined}
                  style={{ "--i": cell, "--cols": whoColumns(ids().length) }}
                  role="img"
                  aria-label={`${cellName(cell, props.size)}: ${ids().length} kişi`}
                >
                  <Show when={ids().length === 0}>
                    <i class="kcell__core" />
                  </Show>
                  <Show when={state() === "solo"}>
                    <i class="kcell__beam" />
                  </Show>
                  <span class="kcell__who">
                    <For each={ids()}>
                      {(id, k) => {
                        const e = () => byId().get(id);
                        return (
                          <span
                            class="kwho"
                            data-status={statusOf(r(), id) ?? undefined}
                            data-me={id === props.selfId ? "1" : undefined}
                            style={{ "--k": k() }}
                          >
                            <Avatar
                              index={e()?.avatar ?? 0}
                              size="var(--as)"
                              connected={e()?.connected ?? true}
                            />
                          </span>
                        );
                      }}
                    </For>
                  </span>
                  <Show when={state() === "solo"}>
                    <em class="kcell__pts">+1</em>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      <Show when={passive().length > 0}>
        <div class="kpassive">
          <span class="kpassive__label">Seçmedi</span>
          <For each={passive()}>
            {(id) => (
              <span class="kpassive__who" data-me={id === props.selfId ? "1" : undefined}>
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
