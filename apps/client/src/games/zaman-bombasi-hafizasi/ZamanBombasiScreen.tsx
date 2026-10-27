// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden); anlam metinde
import type { ZamanBombasiColor } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { hapticError, hapticMatch, hapticPress, hapticSolo } from "../../fx/haptics.js";
import { fail, match as matchSound, solo as soloSound, unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { Avatar } from "../../ui/Avatar.js";
import { BlastArt, BombArt } from "../../ui/BombArt.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { Screen } from "../../ui/Screen.js";
import { SoundToggle } from "../../ui/SoundToggle.js";
import type { GameScreenProps } from "../registry.js";
import { PADS, PadSymbol, padSound } from "./pads.js";
import {
  type ClientPhase,
  clientPhase,
  formatClock,
  isNewResult,
  isSuddenDeath,
  litMs,
  parseZamanBombasiView,
  type StatusKind,
  statusOf,
} from "./view.js";
import "./zaman-bombasi.css";

const fmtScore = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

const CRACKS = [
  "M52 -2 L47 14 L56 24 L45 38 L55 50 L43 63 L52 76 L46 90 L50 102",
  "M55 50 L72 44 L80 55 L96 52 L102 58",
  "M45 38 L30 33 L22 42 L8 38 L-2 44",
  "M43 63 L31 70 L33 84 L20 92",
  "M56 24 L68 18 L74 8",
];

export default function ZamanBombasiScreen(props: GameScreenProps) {
  const view = createMemo(() => parseZamanBombasiView(props.match.publicView, props.match.view));
  const [tick, setTick] = createSignal(0);
  // Toplam süre göstergesi: saniyede birkaç kez güncellenir (kare kare çizim gerekmez).
  const [clockNow, setClockNow] = createSignal(serverNow());
  const clockTimer = setInterval(() => setClockNow(serverNow()), 250);
  onCleanup(() => clearInterval(clockTimer));
  const timeLeft = () => {
    const v = view();
    return v ? Math.max(0, v.endsAt - clockNow()) : 0;
  };
  const sudden = () => {
    const v = view();
    return v ? !v.timeUp && v.phase !== "over" && isSuddenDeath(v, clockNow()) : false;
  };
  const phase = createMemo<ClientPhase>(() => {
    tick();
    const v = view();
    return v ? clientPhase(v, serverNow()) : "over";
  });
  const status = createMemo<StatusKind>(() => {
    const v = view();
    return v ? statusOf({ v, phase: phase(), spectator: props.spectator === true }) : "intro";
  });
  const mine = () => !props.spectator && (view()?.myTurn ?? false) && !(view()?.isOut ?? false);
  const canPlay = () => mine() && phase() === "input";
  const nameOf = (id: string | null | undefined): string =>
    props.players.find((p) => p.id === id)?.nickname ?? "Oyuncu";

  const [lit, setLit] = createSignal<ZamanBombasiColor | null>(null);
  const [playIdx, setPlayIdx] = createSignal(-1);
  const [pressedPad, setPressedPad] = createSignal<ZamanBombasiColor | null>(null);
  const [leftMs, setLeftMs] = createSignal(0);
  const [frac, setFrac] = createSignal(1);
  let panel: HTMLDivElement | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let playTimers: ReturnType<typeof setTimeout>[] = [];
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
    for (const t of playTimers) clearTimeout(t);
    cancelAnimationFrame(raf);
  });

  // Evre sınırları ve oynatma ışıkları: sunucudan gelen mutlak zamanlardan kurulur.
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      for (const t of playTimers) clearTimeout(t);
      playTimers = [];
      setLit(null);
      const now = serverNow();
      const at = (target: number, fn: () => void): void => {
        playTimers.push(setTimeout(fn, Math.max(0, target - serverNow())));
      };
      for (const edge of [v.turnStart, v.inputStart, v.deadline, v.endsAt]) {
        if (edge > now) at(edge + 2, () => setTick((n) => n + 1));
      }
      setTick((n) => n + 1);
      if (v.phase === "over") return;
      const seq = v.sequence;
      const dur = litMs(v.length, v.stepMs);
      setPlayIdx(now >= v.turnStart && now < v.inputStart ? Math.floor((now - v.turnStart) / v.stepMs) : -1);
      if (!seq || now >= v.inputStart) return;
      seq.forEach((color, i) => {
        const start = v.turnStart + i * v.stepMs;
        const end = start + dur;
        if (end <= now) return;
        at(start, () => {
          setPlayIdx(i);
          setLit(color);
          if (serverNow() - start < 120) padSound(color, dur);
        });
        at(end, () => setLit((cur) => (cur === color ? null : cur)));
      });
    });
  });

  // Geri sayım halkası: yalnız giriş evresinde kare kare.
  let raf = 0;
  createEffect(() => {
    cancelAnimationFrame(raf);
    const v = view();
    if (!v || phase() !== "input") return;
    const total = Math.max(1, v.deadline - v.inputStart);
    const frame = (): void => {
      const left = Math.max(0, v.deadline - serverNow());
      setLeftMs(left);
      setFrac(Math.min(1, left / total));
      raf = requestAnimationFrame(frame);
    };
    frame();
  });

  // Yeni doğru basışlar (sunucu onayı): başkalarında tuş yanar, herkeste yeşil iz.
  let seenPressed = 0;
  let seenTurn = -1;
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      if (v.turn !== seenTurn) {
        seenTurn = v.turn;
        seenPressed = 0;
      }
      if (v.pressed.length > seenPressed) {
        const fresh = v.pressed.slice(seenPressed);
        seenPressed = v.pressed.length;
        if (!mine()) {
          const color = fresh[fresh.length - 1];
          if (color) {
            setLit(color);
            padSound(color, 200);
            later(() => setLit((cur) => (cur === color ? null : cur)), 220);
          }
        }
        panel?.animate(
          [
            {
              boxShadow:
                "inset 0 0 40px rgba(0,0,0,.6), 0 0 0 2px rgba(182,255,59,.0), 0 0 0 rgba(182,255,59,0)",
            },
            {
              boxShadow:
                "inset 0 0 40px rgba(0,0,0,.6), 0 0 0 3px rgba(182,255,59,.9), 0 0 34px rgba(182,255,59,.55)",
              offset: 0.25,
            },
            {
              boxShadow:
                "inset 0 0 40px rgba(0,0,0,.6), 0 0 0 2px rgba(182,255,59,0), 0 0 0 rgba(182,255,59,0)",
            },
          ],
          { duration: 520, easing: "ease-out" },
        );
      }
    });
  });

  // Bir sıranın sonucu: ses, titreşim, çatlak sarsıntısı. Yalnız bu ekran açıkken gelenler.
  let lastTurn: number | null = null;
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      const seen = lastTurn;
      lastTurn = Math.max(lastTurn ?? -1, v.last?.turn ?? 0);
      if (!isNewResult(v.last, seen) || !v.last) return;
      const ownTurn = v.last.player === props.selfId && !props.spectator;
      if (v.last.kind === "ok") {
        matchSound();
        if (ownTurn) hapticMatch();
        return;
      }
      soloSound();
      later(fail, 140);
      if (ownTurn) {
        hapticSolo();
        later(hapticError, 220);
      }
      panel?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-10px) rotate(-.8deg)" },
          { transform: "translateX(9px) rotate(.7deg)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(3px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 420, easing: "ease-out" },
      );
    });
  });

  const cracked = () => {
    const v = view();
    if (!v?.last) return false;
    if (v.last.kind === "ok") return false;
    return phase() === "pause" || phase() === "over" ? v.last.turn >= v.turn - 1 : false;
  };

  let pressedAt = 0;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(releaseTimer));
  const down = (color: ZamanBombasiColor, e: PointerEvent): void => {
    e.preventDefault();
    if (!canPlay()) return;
    unlockAudio();
    pressedAt = performance.now();
    clearTimeout(releaseTimer);
    setPressedPad(color);
    padSound(color, 180);
    hapticPress();
    sendAction({ kind: "press", color });
  };
  const up = (): void => {
    const hold = Math.max(0, 90 - (performance.now() - pressedAt));
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => setPressedPad(null), hold);
  };

  const padState = (color: ZamanBombasiColor): "dim" | "ready" | "lit" => {
    if (lit() === color || pressedPad() === color) return "lit";
    return canPlay() ? "ready" : "dim";
  };

  const dots = createMemo(() => Array.from({ length: view()?.length ?? 0 }, (_, i) => i));
  const dotState = (i: number): "on" | "now" | "ok" | "" => {
    const v = view();
    if (!v) return "";
    const p = phase();
    if (p === "playback") return i < playIdx() ? "on" : i === playIdx() ? (lit() ? "now" : "on") : "";
    if (p === "input" || p === "expired") return i < v.pressed.length ? "ok" : "";
    return "";
  };

  const title = (): string => {
    const v = view();
    const s = status();
    const who = nameOf(v?.last?.player);
    switch (s) {
      case "intro":
        return "Hazır ol!";
      case "watch":
        return "İzle";
      case "watchMine":
        return "İzle ve ezberle";
      case "mine":
        return "Sıra sende!";
      case "other":
        return `${nameOf(v?.active)} basıyor`;
      case "ok":
        return "Doğru!";
      case "fail":
        return `${who} elendi`;
      case "timeout":
        return "Süre doldu!";
      case "eliminated":
        return "Elendin";
      default:
        return view()?.timeUp ? "Süre doldu" : "Oyun bitti";
    }
  };
  const sub = (): string => {
    const v = view();
    const s = status();
    const n = v?.length ?? 2;
    switch (s) {
      case "intro":
        return "Işıkları ezberle";
      case "watch":
        return v?.active ? `${nameOf(v.active)} bunu tekrarlayacak` : "";
      case "watchMine":
        return `${n} renk — sıra sana geliyor`;
      case "mine":
        return "Aynı sırayla bas";
      case "other":
        return v?.turnsAway && v.turnsAway > 0 ? `Sıran ${v.turnsAway} sıra sonra` : "Sessizce izle";
      case "ok":
        return v?.active ? `Sıradaki: ${nameOf(v.active)}` : "";
      case "fail":
        return "Dizi 2 renge döndü";
      case "timeout":
        return `${who()} elendi`;
      case "eliminated":
        return "Arkadaşlarını izle";
      default:
        return "";
    }
  };
  const who = (): string => nameOf(view()?.last?.player);
  const tone = (): string => {
    const s = status();
    if (s === "mine") return "cyan";
    if (s === "ok") return "lime";
    if (s === "fail" || s === "timeout" || s === "eliminated") return "red";
    return "";
  };

  const secs = () => Math.max(0, Math.ceil(leftMs() / 1000));
  const ringTone = () => (frac() < 0.15 ? "red" : frac() < 0.4 ? "amber" : "");
  const C = 2 * Math.PI * 46;

  const strip = () => {
    const v = view();
    if (!v) return props.players.filter((p) => props.match.participants.includes(p.id));
    return v.order
      .map((id) => props.players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
  };

  return (
    <Screen class="game zgame">
      <header class="game__top zgame__top">
        <div class="game__tools">
          <SoundToggle />
        </div>
      </header>

      <Show when={view()}>
        {(v) => (
          <div class="ztotal" data-sudden={sudden() ? "1" : undefined}>
            <span class="ztotal__clock">{formatClock(timeLeft())}</span>
            <ProgressBar class="ztotal__bar" startedAt={v().startedAt} endsAt={v().endsAt} now={serverNow} />
            <Show when={sudden()}>
              <span class="ztotal__badge">Ani ölüm</span>
            </Show>
          </div>
        )}
      </Show>

      <div class="zstatus" data-tone={tone()} role="status" aria-live="polite">
        <h2 class="display zstatus__title">{title()}</h2>
        <p class="zstatus__sub">{sub()}</p>
      </div>

      <div class="ztrack" aria-hidden="true">
        <For each={dots()}>{(i) => <i class="ztrack__dot" data-s={dotState(i)} />}</For>
      </div>

      <div
        class="zpanel"
        data-cracked={cracked() ? "1" : undefined}
        data-active={canPlay() ? "1" : undefined}
        ref={panel}
      >
        <For each={PADS}>
          {(pad) => (
            <button
              type="button"
              class="zpad"
              data-c={pad.color}
              data-state={padState(pad.color)}
              data-pressed={pressedPad() === pad.color ? "1" : undefined}
              aria-label={pad.label}
              disabled={!canPlay()}
              onPointerDown={(e) => down(pad.color, e)}
              onPointerUp={up}
              onPointerCancel={up}
              onPointerLeave={up}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span class="zpad__side" />
              <span class="zpad__face">
                <PadSymbol color={pad.color} />
              </span>
            </button>
          )}
        </For>

        <div
          class="zhub"
          data-live={phase() === "input" ? "1" : undefined}
          data-tone={ringTone()}
          aria-hidden="true"
        >
          <svg viewBox="0 0 100 100" class="zhub__ring">
            <circle cx="50" cy="50" r="46" class="zhub__track" />
            <circle
              cx="50"
              cy="50"
              r="46"
              class="zhub__fill"
              stroke-dasharray={String(C)}
              stroke-dashoffset={String(C * (1 - (phase() === "input" ? frac() : 0)))}
            />
          </svg>
          <Show
            when={phase() === "input"}
            fallback={
              <Show when={cracked()} fallback={<BombArt class="zhub__bomb" />}>
                <BlastArt class="zhub__blast" />
              </Show>
            }
          >
            <span class="display zhub__num">{secs()}</span>
          </Show>
        </div>

        <svg class="zcrack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <For each={CRACKS}>{(d) => <path d={d} vector-effect="non-scaling-stroke" />}</For>
        </svg>
        <span class="zpanel__flash" aria-hidden="true" />
      </div>

      <footer class="zstrip">
        <For each={strip()}>
          {(p) => {
            const out = () => view()?.eliminated.includes(p.id) ?? false;
            const isActive = () => !out() && view()?.active === p.id && phase() !== "over";
            return (
              <div
                class="zs"
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
                <span class="zs__score">{fmtScore(view()?.scores[p.id] ?? 0)}</span>
              </div>
            );
          }}
        </For>
      </footer>
    </Screen>
  );
}
