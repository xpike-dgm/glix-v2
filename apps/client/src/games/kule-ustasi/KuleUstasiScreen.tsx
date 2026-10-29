import { KULE_BASE_SPEED, KULE_TRACK, KULE_TURN_MS, type KuleBlock } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { hapticError, hapticMatch, hapticPress, hapticSolo } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { fail, match as matchSound, solo as soloSound, unlockAudio } from "../../fx/sound.js";
import { type ActionAck, sendActionAck } from "../../net/client.js";
import { atServerTime } from "../../net/serverTimer.js";
import { createSmoothClock } from "../../net/smoothClock.js";
import { Avatar } from "../../ui/Avatar.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { pressable } from "../../ui/press.js";
import { Screen } from "../../ui/Screen.js";
import { Status } from "../../ui/Status.js";
import type { GameScreenProps } from "../registry.js";
import {
  formatClock,
  isNewResult,
  type KulePhase,
  type KuleStatus,
  kulePhase,
  kuleStatus,
  parseKuleView,
  pct,
} from "./view.js";
import "./kule.css";

/** Ekranda aynı anda görünen kat sayısı (taban dahil); kule yükselince pencere yukarı kayar. */
const VISIBLE_ROWS = 8;
/** Efekt parçalarının ekranda kalma süresi. */
const FX_MS = 1100;

const fmtScore = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

interface Piece {
  id: number;
  left: number;
  width: number;
  /** Alttan sayılan, pencereye göre kat. */
  row: number;
  /** Düşüş yönü: -1 sola, 1 sağa. */
  dir: -1 | 1;
  /** Hangi tür parça: kesilen kenar ya da yıkılan blok. */
  kind: "cut" | "fall";
  /** Gecikme (ms), yıkılışta sıralı dökülme için. */
  delay: number;
}

/** Yerel bırakış: yalnız bu sıra için, sunucu onaylayana kadar bloğu dondurur. */
interface LocalDrop {
  turn: number;
  at: number;
}

/** Motordaki `kuleBlockLeft` ile aynı üçgen dalga, yalnız ekranda akıcı çizim için kesirli (fark < 1 pist birimi). */
function smoothLeft(turnStart: number, speed: number, width: number, now: number): number {
  const range = KULE_TRACK - width;
  if (range <= 0) return 0;
  const dist = (Math.max(0, now - turnStart) * KULE_BASE_SPEED * speed) / 1_000_000;
  const m = dist % (2 * range);
  return m <= range ? m : 2 * range - m;
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
  const mine = () => !props.spectator && (view()?.myTurn ?? false) && !(view()?.isOut ?? false);
  const nameOf = (id: string | null | undefined): string =>
    props.players.find((p) => p.id === id)?.nickname ?? "Oyuncu";

  // Sıra sınırlarında yeniden hesapla: evre mutlak zamanlardan türer (sunucu yalnız durum değişince yayın yapar).
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
      // Saat eşitlemesi beklerken sunucu saatini geri çekse de sınır geçilmeden çağrılmaz (net/serverTimer.ts).
      for (const edge of [v.turnStart, v.deadline, v.endsAt]) {
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
  const canDrop = () => mine() && phase() === "moving" && frozen() === null;

  const dropNow = (): void => {
    const v = view();
    if (!v || !canDrop()) return;
    unlockAudio();
    hapticPress();
    // Oyuncunun gördüğü konumla aynı saat: bırakma anı ekrandaki bloğa denk gelsin.
    const at = Math.floor(smoothNow());
    const send = (): Promise<ActionAck> => sendActionAck({ kind: "drop", at });
    setLocalDrop({ turn: v.turn, at }, send);
  };
  const press = pressable(dropNow);

  // Kayan blok: konum sunucu saatinin saf fonksiyonu; kare kare doğrudan DOM'a yazılır. Saat, 50 ms'lik sinyal
  // yerine her karede okunan akıcı saattir; konum da yuvarlanmadan hesaplanır (`smoothLeft`).
  let mover: HTMLDivElement | undefined;
  let raf = 0;
  const frame = (): void => {
    const v = view();
    if (v && mover) {
      const d = frozen();
      const t = d ? d.at : Math.min(smoothNow(), v.deadline);
      const left = smoothLeft(v.turnStart, v.speed, v.blockWidth, t);
      mover.style.transform = `translate3d(${(left / v.blockWidth) * 100}%, 0, 0)`;
    }
    raf = requestAnimationFrame(frame);
  };
  frame();
  onCleanup(() => cancelAnimationFrame(raf));

  // Pencere: son VISIBLE_ROWS blok görünür.
  const startIdx = (len: number): number => Math.max(0, len - VISIBLE_ROWS);
  const rows = createMemo(() => {
    const t = view()?.tower ?? [];
    const s = startIdx(t.length);
    return t.slice(s).map((b, i) => ({ b, row: i, abs: s + i }));
  });
  const moverRow = () => Math.min(view()?.tower.length ?? 1, VISIBLE_ROWS);
  const topAbs = () => (view()?.tower.length ?? 1) - 1;

  // Efektler: kesilen parça, yıkılan kule, "Kusursuz!" parlaması, sarsıntı.
  const [pieces, setPieces] = createSignal<Piece[]>([]);
  const [landed, setLanded] = createSignal(-1);
  const [shakeKey, setShakeKey] = createSignal(0);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number): void => {
    const t = setTimeout(
      () => {
        timers.delete(t);
        fn();
      },
      Math.max(0, ms),
    );
    timers.add(t);
  };
  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
  });
  let pieceId = 0;
  const addPieces = (list: Omit<Piece, "id">[]): void => {
    if (list.length === 0 || reducedMotion()) return;
    const made = list.map((p) => ({ ...p, id: ++pieceId }));
    setPieces((cur) => [...cur, ...made]);
    const ids = new Set(made.map((p) => p.id));
    later(() => setPieces((cur) => cur.filter((p) => !ids.has(p.id))), FX_MS + 400);
  };

  let seenTurn: number | null = null;
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      const seen = seenTurn;
      seenTurn = Math.max(seenTurn ?? -1, v.last?.turn ?? 0);
      const last = v.last;
      if (!last) return;
      // Açılışta yalnız az önce olmuş bir sonuç (yeniden bağlanma) gösterilir; eskisi sessiz kalır.
      const fresh = seen === null && props.now() - last.at < FX_MS;
      if (!fresh && !isNewResult(last, seen)) return;
      const own = last.player === props.selfId && !props.spectator;
      if (last.kind === "miss") {
        soloSound();
        later(fail, 140);
        if (own) {
          hapticSolo();
          later(hapticError, 220);
        }
        setShakeKey((n) => n + 1);
        const fallen: KuleBlock[] = last.fallen ?? [];
        const s = startIdx(fallen.length);
        const out: Omit<Piece, "id">[] = fallen.slice(Math.max(1, s)).map((b, i) => ({
          left: b.left,
          width: b.width,
          row: Math.max(1, s) - s + i,
          dir: i % 2 === 0 ? -1 : 1,
          kind: "fall",
          delay: i * 60,
        }));
        out.push({
          left: last.dropLeft,
          width: last.dropWidth,
          row: Math.min(fallen.length, VISIBLE_ROWS),
          dir: last.dropLeft + last.dropWidth / 2 < 500 ? -1 : 1,
          kind: "fall",
          delay: 0,
        });
        addPieces(out);
        return;
      }
      matchSound();
      if (own) hapticMatch();
      setLanded(v.tower.length - 1);
      later(() => setLanded(-1), 520);
      if (last.cutWidth > 0) {
        addPieces([
          {
            left: last.cutLeft,
            width: last.cutWidth,
            row: Math.min(v.tower.length - 1, VISIBLE_ROWS - 1),
            dir: last.cutLeft <= last.dropLeft ? -1 : 1,
            kind: "cut",
            delay: 0,
          },
        ]);
      }
    });
  });

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
        return "Blok kulenin üstünde kayacak";
      case "mine":
        return frozen() ? "Bırakıldı…" : "Dokun ve bırak";
      case "other":
        return v?.turnsAway && v.turnsAway > 0 ? `Sıran ${v.turnsAway} sıra sonra` : "Sessizce izle";
      case "ok":
        return v?.last && v.last.cutWidth > 0 ? "Taşan kısım kesildi" : "";
      case "perfect":
        return `${nameOf(v?.last?.player)} tam oturttu`;
      case "miss":
        return "Kule yıkıldı, oyundan çıktı";
      case "eliminated":
        return "Arkadaşlarını izle";
      default:
        return "";
    }
  };
  const tone = (): string => {
    const s = status();
    if (s === "mine") return "cyan";
    if (s === "ok" || s === "perfect") return "lime";
    if (s === "miss" || s === "eliminated") return "red";
    return "";
  };

  const strip = () => {
    const v = view();
    if (!v) return props.players.filter((p) => props.match.participants.includes(p.id));
    return v.order
      .map((id) => props.players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
  };

  return (
    <Screen class="game kule">
      <Show when={view()}>
        {(v) => (
          <div class="kule__total">
            <span class="kule__clock">{formatClock(timeLeft())}</span>
            <ProgressBar class="kule__bar" startedAt={v().startedAt} endsAt={v().endsAt} now={props.now} />
          </div>
        )}
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

      <Show when={view()}>
        {(v) => (
          <div class="kule__turn" data-live={phase() === "moving" ? "1" : undefined} aria-hidden="true">
            <Show when={phase() === "moving"}>
              <ProgressBar
                class="kule__turnbar"
                startedAt={v().deadline - KULE_TURN_MS}
                endsAt={v().deadline}
                now={props.now}
              />
            </Show>
          </div>
        )}
      </Show>

      <button
        type="button"
        class="kule__stage"
        data-active={canDrop() ? "1" : undefined}
        data-shake={shakeKey() > 0 ? shakeKey() % 2 : undefined}
        aria-label="Bırak"
        disabled={!canDrop()}
        onPointerDown={press.onPointerDown}
        onClick={press.onClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div class="kule__track">
          <For each={rows()}>
            {(r) => (
              <i
                class="kule__blk"
                data-base={r.abs === 0 ? "1" : undefined}
                data-perfect={r.b.perfect ? "1" : undefined}
                data-new={landed() === r.abs && r.abs === topAbs() ? "1" : undefined}
                style={{
                  left: `${pct(r.b.left)}%`,
                  width: `${pct(r.b.width)}%`,
                  "--r": r.row,
                  "--h": r.abs % 6,
                }}
              />
            )}
          </For>

          <For each={pieces()}>
            {(p) => (
              <i
                class="kule__piece"
                data-kind={p.kind}
                style={{
                  left: `${pct(p.left)}%`,
                  width: `${pct(p.width)}%`,
                  "--r": p.row,
                  "--dir": p.dir,
                  "--d": `${p.delay}ms`,
                }}
              />
            )}
          </For>

          <Show when={view()}>
            {(v) => (
              <div
                class="kule__mover"
                data-state={
                  phase() === "moving" ? (frozen() ? "frozen" : "run") : phase() === "pause" ? "wait" : "gone"
                }
                style={{ width: `${pct(v().blockWidth)}%`, "--r": moverRow() }}
                ref={mover}
              >
                <i class="kule__moverface" />
              </div>
            )}
          </Show>
        </div>

        <Show when={status() === "perfect"}>
          <span class="display kule__flash" aria-hidden="true">
            Kusursuz!
          </span>
        </Show>
        <span class="kule__hint" aria-hidden="true">
          {canDrop() ? "BIRAK" : ""}
        </span>
      </button>

      <footer class="kule__strip">
        <For each={strip()}>
          {(p) => {
            const out = () => view()?.eliminated.includes(p.id) ?? false;
            const isActive = () => !out() && view()?.active === p.id && phase() !== "over";
            return (
              <div
                class="kule__p"
                data-me={p.id === props.selfId ? "1" : undefined}
                data-active={isActive() ? "1" : undefined}
                data-out={out() ? "1" : undefined}
              >
                <Avatar
                  index={p.avatar}
                  size="min(46px, calc((100vw - 40px - 42px) / 8))"
                  mood={out() ? "out" : undefined}
                  connected={p.connected}
                />
                <span class="kule__score">{fmtScore(view()?.scores[p.id] ?? 0)}</span>
              </div>
            );
          }}
        </For>
      </footer>
    </Screen>
  );
}
