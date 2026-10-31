import { KULE_WARN_MS } from "@glix/engine";
import { createEffect, createMemo, createSignal, onCleanup, Show, untrack } from "solid-js";
import { hapticPress } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { type ActionAck, sendActionAck } from "../../net/client.js";
import { atServerTime } from "../../net/serverTimer.js";
import { createSmoothClock } from "../../net/smoothClock.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { pressable } from "../../ui/press.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import { Status } from "../../ui/Status.js";
import type { GameScreenProps } from "../registry.js";
import { Crew } from "./Crew.js";
import { releaseClick } from "./sounds.js";
import { Tower } from "./Tower.js";
import { KULE_FX } from "./timeline.js";
import {
  formatClock,
  type KulePhase,
  type KuleStatus,
  kulePhase,
  kuleStatus,
  parseKuleView,
} from "./view.js";
import "./kule.css";

/** Yerel bırakış: yalnız bu sıra için, sunucu onaylayana kadar bloğu dondurur. */
interface LocalDrop {
  turn: number;
  at: number;
}

export default function KuleUstasiScreen(props: GameScreenProps) {
  const smoothNow = createSmoothClock();
  const view = createMemo(() => parseKuleView(props.match.publicView, props.match.view));
  const [tick, setTick] = createSignal(0);
  const [clockNow, setClockNow] = createSignal(props.now());
  const clockTimer = setInterval(() => setClockNow(props.now()), 250);
  onCleanup(() => clearInterval(clockTimer));

  const timeLeft = () => {
    const v = view();
    return v ? Math.max(0, v.endsAt - clockNow()) : 0;
  };
  const phase = createMemo<KulePhase>(() => {
    tick();
    const v = view();
    return v ? kulePhase(v, props.now()) : "over";
  });
  const status = createMemo<KuleStatus>(() => {
    const v = view();
    return v ? kuleStatus({ v, phase: phase(), spectator: props.spectator === true }) : "intro";
  });
  const mineTurn = () => !props.spectator && (view()?.myTurn ?? false) && !(view()?.isOut ?? false);
  const mine = () => mineTurn() && (phase() === "warn" || phase() === "moving");
  const nameOf = (id: string | null | undefined): string =>
    props.players.find((p) => p.id === id)?.nickname ?? "Oyuncu";

  // Evre sınırlarında yeniden hesapla: evre mutlak zamanlardan türer (sunucu yalnız durum değişince yayın yapar).
  let edgeTimers: (() => void)[] = [];
  onCleanup(() => {
    for (const cancel of edgeTimers) cancel();
  });
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      for (const cancel of edgeTimers) cancel();
      edgeTimers = [];
      const now = props.now();
      for (const edge of [v.turnStart - KULE_WARN_MS, v.turnStart, v.deadline, v.endsAt]) {
        if (edge > now) edgeTimers.push(atServerTime(edge, () => setTick((n) => n + 1), props.now));
      }
      setTick((n) => n + 1);
    });
  });

  // Dokunuş: yerel bırakış hemen bloğu dondurur; sunucu reddederse eski haline döner.
  const serverDrop = (): LocalDrop | null => {
    const v = view();
    if (!v?.last || v.last.player !== props.selfId) return null;
    return { turn: v.last.turn, at: v.last.at };
  };
  const [localDrop, setLocalDrop] = createOptimistic<LocalDrop | null>(serverDrop, {
    equals: (a, b) => (a?.turn ?? -1) === (b?.turn ?? -1),
  });
  const frozen = (): LocalDrop | null => {
    const d = localDrop();
    const v = view();
    return d && v && d.turn === v.turn ? d : null;
  };
  const canDrop = () => mineTurn() && phase() === "moving" && frozen() === null;

  const dropNow = (): void => {
    const v = view();
    if (!v || !canDrop()) return;
    unlockAudio();
    hapticPress();
    releaseClick(true);
    // Oyuncunun gördüğü konumla aynı saat: bırakma anı ekrandaki bloğa denk gelsin.
    const at = Math.floor(smoothNow());
    const send = (): Promise<ActionAck> => sendActionAck({ kind: "drop", at });
    setLocalDrop({ turn: v.turn, at }, send);
  };
  const press = pressable(dropNow);

  const title = (): string => {
    const v = view();
    const who = nameOf(v?.last?.player);
    const me = v?.last?.player === props.selfId && !props.spectator;
    switch (status()) {
      case "intro":
        return "Hazır ol!";
      case "mine":
        return "Sıra sende!";
      case "other":
        return `${nameOf(v?.active)} bırakıyor`;
      case "ok":
        return me ? "Oturdu!" : `${who} oturttu`;
      case "perfect":
        return "Kusursuz!";
      case "miss":
        return me ? "Iskaladın!" : `${who} ıskaladı`;
      case "eliminated":
        return "Oyundan çıktın";
      default:
        return v?.timeUp ? "Süre doldu" : "Oyun bitti";
    }
  };
  const sub = (): string => {
    const v = view();
    switch (status()) {
      case "intro":
        return "Vinç ilk bloğu indiriyor";
      case "mine":
        return frozen() ? "Bırakıldı…" : "Doğru anda dokun";
      case "other":
        return v?.turnsAway && v.turnsAway > 0 ? `Sıran ${v.turnsAway} sıra sonra` : "Sessizce izle";
      case "ok":
        return v?.last && v.last.cutWidth > 0 ? "Taşan kısım kesildi · +1" : "+1 usta puanı";
      case "perfect":
        return `${nameOf(v?.last?.player)} tam oturttu · +2`;
      case "miss":
        return "Kule yıkıldı, oyundan çıktı";
      case "eliminated":
        return "Arkadaşlarını izle";
      default:
        return "Ayakta kalanlar +3 usta puanı aldı";
    }
  };
  const tone = (): string => {
    const s = status();
    if (s === "mine") return "cyan";
    if (s === "ok") return "lime";
    if (s === "perfect") return "amber";
    if (s === "miss" || s === "eliminated") return "red";
    return "";
  };

  return (
    <Screen class="game kule">
      <Show when={view()}>
        <div
          class="kule__total"
          data-urgent={timeLeft() <= KULE_FX.clockUrgent && phase() !== "over" ? "1" : undefined}
        >
          <span class="kule__clock">{formatClock(timeLeft())}</span>
        </div>
      </Show>

      <Status
        class="kule__status"
        titleClass="display kule__title"
        subClass="kule__sub"
        tone={tone()}
        sub={sub()}
      >
        {title()}
      </Status>

      <button
        type="button"
        class="kule__stage"
        data-active={mine() ? "1" : undefined}
        aria-label="Bırak"
        disabled={!canDrop()}
        onPointerDown={press.onPointerDown}
        onClick={press.onClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Show when={view()}>
          {(v) => (
            <Tower
              view={v()}
              phase={phase()}
              now={props.now}
              smoothNow={smoothNow}
              mine={mine()}
              canDrop={canDrop()}
              frozenAt={frozen()?.at ?? null}
              selfId={props.selfId}
              spectator={props.spectator === true}
            />
          )}
        </Show>
      </button>

      <Crew
        view={view()}
        phase={phase()}
        players={props.players}
        participants={props.match.participants}
        selfId={props.selfId}
      />
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
