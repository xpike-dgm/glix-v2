import { createEffect, createMemo, createSignal, Match, on, onCleanup, Show, Switch } from "solid-js";
import { hapticTick } from "../../fx/haptics.js";
import { state } from "../../net/store.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import type { GameScreenProps } from "../registry.js";
import "./gizli-kareler.css";
import { KareSonuc, type SonucEntry } from "./KareSonuc.js";
import { Secim, type SecimRole } from "./Secim.js";
import { bandWhoosh, lastTick } from "./sounds.js";
import { type KarelerScreenView, parseKarelerView, screenPhase } from "./view.js";

/** GK-U15: dönen oyuncuya bant süresi. */
const BACK_MS = 1_600;

export default function GizliKarelerScreen(props: GameScreenProps) {
  const view = createMemo(() => parseKarelerView(props.match.publicView, props.match.view));
  // Sunucu saati reaktif değildir; aşama geçişleri ve açılış zamanlaması için yerel bir saat.
  const [clock, setClock] = createSignal(props.now());
  const timer = setInterval(() => setClock(props.now()), 100);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  onCleanup(() => {
    clearInterval(timer);
    for (const t of timers) clearTimeout(t);
  });
  const entries = createMemo<SonucEntry[]>(() =>
    props.match.participants.map((id) => {
      const p = props.players.find((x) => x.id === id);
      return {
        id,
        avatar: p?.avatar ?? 0,
        nickname: p?.nickname ?? "Oyuncu",
        connected: p?.connected ?? true,
      };
    }),
  );
  const phase = createMemo(() => {
    const v = view();
    return v ? screenPhase(v, clock()) : null;
  });
  const spectator = () => props.spectator === true;
  const role2 = (v: KarelerScreenView): SecimRole => {
    if (spectator()) return "spectator";
    if (v.stage2?.players.includes(props.selfId)) return "racer";
    if (v.stage2?.ghosts.includes(props.selfId)) return "ghost";
    return "out";
  };

  /** Seçim aşamasının bitişi (son 5 sn ve dönüş bandı için). */
  const chooseEnd = (): number | null => {
    const v = view();
    if (!v) return null;
    if (phase() === "choose1") return v.endsAt;
    if (phase() === "choose2") return v.stage2?.endsAt ?? null;
    return null;
  };
  const secsLeft = () => {
    const end = chooseEnd();
    return end === null ? null : Math.max(0, Math.ceil((end - clock()) / 1000));
  };
  const urgent = () => {
    const s = secsLeft();
    return s !== null && s > 0 && s <= 5;
  };

  /** Üstteki süre çubuğunun aralığı: seçim süresi ya da açılış penceresi. */
  const bar = (v: KarelerScreenView): { from: number; to: number } => {
    switch (phase()) {
      case "reveal1":
      case "band":
        return { from: v.endsAt, to: v.stage2?.startsAt ?? v.finishesAt ?? v.endsAt };
      case "choose2":
        return { from: v.stage2?.startsAt ?? v.endsAt, to: v.stage2?.endsAt ?? v.endsAt };
      case "reveal2":
        return { from: v.stage2?.endsAt ?? v.endsAt, to: v.finishesAt ?? v.endsAt };
      default:
        return { from: v.startedAt, to: v.endsAt };
    }
  };

  // GK-U10: son 5 sn herkese aynı tik ve kısa titreşim (seçip seçmediğin yan koltuğa sızmasın).
  createEffect(
    on(secsLeft, (s, prev) => {
      if (s === null || prev === undefined || prev === null || s === prev || s > 5 || s === 0) return;
      lastTick();
      if (!spectator()) hapticTick();
    }),
  );
  // GK-U5: bant sesi.
  createEffect(
    on(phase, (p, prev) => {
      if (p === "band" && prev === "reveal1") bandWhoosh();
    }),
  );

  // GK-U15: bağlantı dönünce kısa bant: "Döndün · 2. aşama · 9 sn".
  const [back, setBack] = createSignal(false);
  createEffect(
    on(
      () => state.conn,
      (conn, prev) => {
        if (conn !== "open" || prev === undefined || prev === "open") return;
        setBack(true);
        const t = setTimeout(() => {
          timers.delete(t);
          setBack(false);
        }, BACK_MS);
        timers.add(t);
      },
      { defer: true },
    ),
  );
  const backText = (): string | null => {
    const s = secsLeft();
    if (!back() || s === null) return null;
    return `Döndün · ${phase() === "choose2" ? "2" : "1"}. aşama · ${s} sn`;
  };

  return (
    <Screen class="kk">
      <Show when={view()}>
        {(v) => (
          <PhaseClock
            startedAt={bar(v()).from}
            endsAt={bar(v()).to}
            urgency={phase() === "choose1" || phase() === "choose2"}
          />
        )}
      </Show>

      <Show when={view()}>
        {(v) => (
          <Switch>
            <Match when={phase() === "choose1"}>
              <Secim
                v={v()}
                stage={1}
                who={spectator() ? "spectator" : "player"}
                entries={entries()}
                selfId={props.selfId}
                now={clock}
                band={false}
                urgent={urgent()}
              />
            </Match>
            <Match when={phase() === "reveal1"}>
              <KareSonuc
                v={v()}
                final={false}
                entries={entries()}
                selfId={props.selfId}
                spectator={spectator()}
                now={clock}
              />
            </Match>
            <Match when={phase() === "band" || phase() === "choose2"}>
              <Secim
                v={v()}
                stage={2}
                who={role2(v())}
                entries={entries()}
                selfId={props.selfId}
                now={clock}
                band={phase() === "band"}
                urgent={urgent()}
              />
            </Match>
            <Match when={phase() === "reveal2"}>
              <KareSonuc
                v={v()}
                final={true}
                entries={entries()}
                selfId={props.selfId}
                spectator={spectator()}
                now={clock}
              />
            </Match>
          </Switch>
        )}
      </Show>

      <Show when={phase() === "band"}>
        <div class="kband" role="status">
          <i class="kband__sweep" aria-hidden="true" />
          <b class="kband__title">2. AŞAMA</b>
          <span class="kband__sub">Gizli bir ödül karesi saklandı</span>
        </div>
      </Show>
      <Show when={backText()}>
        {(t) => (
          <p class="kback" role="status">
            {t()}
          </p>
        )}
      </Show>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
