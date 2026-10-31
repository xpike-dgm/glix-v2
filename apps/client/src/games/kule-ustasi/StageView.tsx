import { KULE_WARN_MS } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { atServerTime } from "../../net/serverTimer.js";
import { createSmoothClock } from "../../net/smoothClock.js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import { Tower } from "./Tower.js";
import { KULE_FX } from "./timeline.js";
import {
  formatClock,
  type KulePhase,
  kulePhase,
  kuleStatus,
  nextPlayer,
  parseKuleView,
  speedLabel,
  speedTone,
} from "./view.js";
import "./kule.css";
import "./stage-view.css";

/**
 * Kule Ustası, büyük ekran (KU-U10): ortada büyük ve yüksek kule, solda büyük oyuncu sütunu (avatar, ad, usta
 * puanı, ★, durum), sağda büyük "KAT", "Rekor" ve "HIZ" göstergeleri, üstte toplam süre. Kusursuz ve yıkılış tam
 * ekran efektli. Yalnız herkese açık görünüm kullanılır; TV'de dokunma ve "Devam et" düğmesi yoktur.
 */
export default function KuleStageView(props: GameScreenProps) {
  const smoothNow = createSmoothClock();
  const view = createMemo(() => parseKuleView(props.match.publicView, props.match.view));
  const [tick, setTick] = createSignal(0);
  const [clockNow, setClockNow] = createSignal(props.now());
  const clockTimer = setInterval(() => setClockNow(props.now()), 250);
  onCleanup(() => clearInterval(clockTimer));
  const phase = createMemo<KulePhase>(() => {
    tick();
    const v = view();
    return v ? kulePhase(v, props.now()) : "over";
  });
  let edges: (() => void)[] = [];
  onCleanup(() => {
    for (const c of edges) c();
  });
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      for (const c of edges) c();
      edges = [];
      const now = props.now();
      for (const edge of [v.turnStart - KULE_WARN_MS, v.turnStart, v.deadline, v.endsAt]) {
        if (edge > now) edges.push(atServerTime(edge, () => setTick((n) => n + 1), props.now));
      }
      setTick((n) => n + 1);
    });
  });
  const status = createMemo(() => {
    const v = view();
    return v ? kuleStatus({ v, phase: phase(), spectator: true }) : "intro";
  });
  const nameOf = (id: string | null | undefined): string =>
    props.players.find((p) => p.id === id)?.nickname ?? "Oyuncu";
  const timeLeft = () => {
    const v = view();
    return v ? Math.max(0, v.endsAt - clockNow()) : 0;
  };
  const heading = (): string => {
    const v = view();
    switch (status()) {
      case "intro":
        return "Hazır ol!";
      case "other":
      case "mine":
        return `${nameOf(v?.active)} bırakıyor`;
      case "ok":
        return `${nameOf(v?.last?.player)} oturttu`;
      case "perfect":
        return `${nameOf(v?.last?.player)} kusursuz!`;
      case "miss":
        return `${nameOf(v?.last?.player)} ıskaladı`;
      default:
        return v?.timeUp ? "Süre doldu" : "Oyun bitti";
    }
  };
  const tone = (): string => {
    const s = status();
    if (s === "perfect") return "amber";
    if (s === "ok") return "lime";
    if (s === "miss") return "red";
    if (s === "other" || s === "mine") return "cyan";
    return "";
  };
  const roster = () => {
    const v = view();
    return (v?.order ?? [])
      .map((id) => props.players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
  };
  const stateOf = (id: string): { key: string; label: string } => {
    const v = view();
    if (!v) return { key: "", label: "" };
    if (v.eliminated.includes(id)) return { key: "out", label: "Çıktı" };
    if (phase() === "over") return { key: "safe", label: "Ayakta" };
    if (v.active === id) return { key: "turn", label: "Bırakıyor" };
    if (nextPlayer(v) === id) return { key: "next", label: "Sırada" };
    return { key: "", label: "Bekliyor" };
  };
  const fx = (): string | undefined => {
    const s = status();
    return s === "perfect" || s === "miss" ? s : undefined;
  };

  return (
    <Show when={view()}>
      {(v) => (
        <div class="kutv" data-fx={fx()}>
          <section class="kutv__crew" style={{ "--n": roster().length }}>
            <For each={roster()}>
              {(p) => {
                const st = () => stateOf(p.id);
                const award = () => v().awards?.[p.id];
                return (
                  <div class="kutv__card" data-s={st().key}>
                    <Avatar
                      index={p.avatar}
                      size="var(--kutv-av)"
                      mood={st().key === "out" ? "out" : undefined}
                      connected={p.connected}
                    />
                    <div class="kutv__who">
                      <span class="kutv__name">{p.nickname}</span>
                      <span class="kutv__state">{st().label}</span>
                    </div>
                    <div class="kutv__pts">
                      <b>{v().usta[p.id] ?? 0}</b>
                      <span class="kutv__stars">★{v().perfects[p.id] ?? 0}</span>
                    </div>
                    <Show when={award() !== undefined}>
                      <span class="kutv__award" data-a={award()}>
                        {(award() ?? 0) > 0 ? `+${award()}` : "0"}
                      </span>
                    </Show>
                  </div>
                );
              }}
            </For>
          </section>

          <section class="kutv__mid">
            <div class="kutv__top">
              <p class="kutv__head" data-tone={tone()}>
                {heading()}
              </p>
              <span
                class="kutv__clock"
                data-urgent={timeLeft() <= KULE_FX.clockUrgent && phase() !== "over" ? "1" : undefined}
              >
                {formatClock(timeLeft())}
              </span>
            </div>
            <div class="kutv__stage">
              <Tower
                view={v()}
                phase={phase()}
                now={props.now}
                smoothNow={smoothNow}
                mine={false}
                canDrop={false}
                frozenAt={null}
                selfId={props.selfId}
                spectator={true}
                tv={true}
              />
            </div>
          </section>

          <section class="kutv__gauges" aria-label="Göstergeler">
            <div class="kutv__gauge">
              <small>KAT</small>
              <b>{v().floors}</b>
            </div>
            <div
              class="kutv__gauge"
              data-k="record"
              data-beaten={v().record > 0 && v().floors > v().record ? "1" : undefined}
            >
              <small>REKOR</small>
              <b>{v().record > 0 ? Math.max(v().record, v().floors) : "—"}</b>
            </div>
            <div class="kutv__gauge" data-tone={speedTone(v().speed)}>
              <small>HIZ</small>
              <b>{speedLabel(v().speed)}</b>
            </div>
          </section>
        </div>
      )}
    </Show>
  );
}
