import { butonaBasWindowMs } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, untrack } from "solid-js";
import { hapticMatch, hapticSolo, hapticTap } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound, tap, unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { Avatar } from "../../ui/Avatar.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import type { GameScreenProps } from "../registry.js";
import { ArcadeButton, type ArcadeFx } from "./ArcadeButton.js";
import { maxWindowIndex, newWindows, parseButonaBasView, roundClockAt } from "./view.js";

interface Float {
  id: number;
  text: string;
  kind: "match" | "solo";
}

export default function ButonaBasScreen(props: GameScreenProps) {
  const view = createMemo(() => parseButonaBasView(props.match.publicView, props.match.view));
  const score = () => {
    const v = view();
    if (!v) return 0;
    // İzleyicinin kendi puanı yok: o an en yüksek puanı göster.
    if (props.spectator) return Math.max(0, ...Object.values(v.scores));
    return v.myScore ?? v.scores[props.selfId] ?? 0;
  };
  const strip = () => props.players.filter((p) => props.match.participants.includes(p.id));
  // Tur/ara geçişi yerel saatten türetilir (görünüm yalnız durum değişince gelir).
  const clock = createMemo(() => {
    const v = view();
    return v ? roundClockAt(v.startedAt, v.endsAt, props.now()) : null;
  });
  const waveMs = () => clock()?.windowMs ?? view()?.windowMs ?? 300;
  const rounds = () => view()?.rounds ?? 3;
  const tightening = () => (clock()?.round ?? 0) > 0;
  const inGap = () => clock()?.phase === "gap";
  const prevWindowMs = () => butonaBasWindowMs(Math.max(0, (clock()?.round ?? 1) - 1));

  const [pressed, setPressed] = createSignal(false);
  const [waves, setWaves] = createSignal<number[]>([]);
  const [fx, setFx] = createSignal<ArcadeFx | null>(null);
  const [floats, setFloats] = createSignal<Float[]>([]);
  const [flashes, setFlashes] = createSignal<Record<string, "match" | "solo">>({});
  let counter = 0;
  let lastSeen: number | null = null;
  let lastSentWindow = -1;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  let pressedAt = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number): void => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
    clearTimeout(releaseTimer);
  });

  // Yeni kapanan pencerelere tepki: yalnız bu ekran açıkken gelenler.
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      if (lastSeen === null) {
        lastSeen = maxWindowIndex(v.recent, null) ?? -1;
        return;
      }
      const fresh = newWindows(v.recent, lastSeen);
      lastSeen = maxWindowIndex(v.recent, lastSeen);
      let mineMatch = false;
      let mineSolo = false;
      for (const w of fresh) {
        const mine = w.pressers.includes(props.selfId);
        const next = { ...flashes() };
        for (const id of w.pressers) next[id] = w.outcome;
        setFlashes(next);
        later(() => {
          setFlashes((cur) => {
            const c = { ...cur };
            for (const id of w.pressers) delete c[id];
            return c;
          });
        }, 480);
        if (!mine) continue;
        const id = ++counter;
        setFloats((f) => [
          ...f.slice(-3),
          { id, text: w.outcome === "match" ? "+1" : "−1", kind: w.outcome },
        ]);
        later(() => setFloats((f) => f.filter((x) => x.id !== id)), 950);
        setFx({ kind: w.outcome, n: ++counter });
        if (w.outcome === "match") mineMatch = true;
        else mineSolo = true;
      }
      if (mineSolo) {
        soloSound();
        hapticSolo();
      } else if (mineMatch) {
        matchSound();
        hapticMatch();
      }
    });
  });

  // Skor değişince büyük rakam kısa süre "zıplar".
  let scoreEl: HTMLSpanElement | undefined;
  createEffect(
    on(
      score,
      (now, prev) => {
        if (prev === undefined || now === prev) return;
        scoreEl?.animate(
          [
            { transform: "scale(1)", color: now > prev ? "#B6FF3B" : "#FF3B5C" },
            { transform: "scale(1.22)", color: now > prev ? "#B6FF3B" : "#FF3B5C", offset: 0.3 },
            { transform: "scale(1)", color: "#F3F5FF" },
          ],
          { duration: 480, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      },
      { defer: true },
    ),
  );

  const release = (): void => {
    const hold = Math.max(0, 90 - (performance.now() - pressedAt));
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => setPressed(false), hold);
  };

  const press = (e: PointerEvent): void => {
    e.preventDefault();
    unlockAudio();
    pressedAt = performance.now();
    clearTimeout(releaseTimer);
    setPressed(true);
    tap();
    hapticTap();
    const id = ++counter;
    setWaves((w) => [...w.slice(-3), id]);
    later(() => setWaves((w) => w.filter((x) => x !== id)), waveMs() + 60);

    const v = view();
    if (!v) return;
    const t = serverNow();
    const c = roundClockAt(v.startedAt, v.endsAt, t);
    // Turlar arasındaki ara ve oyun sonrası: basış sunucuda sayılmaz, gönderilmez.
    if (c.phase !== "play") return;
    const idx = c.round * 1000 + Math.floor((t - c.phaseStartsAt) / c.windowMs);
    if (idx === lastSentWindow) return;
    lastSentWindow = idx;
    sendAction({ kind: "press" });
  };

  // Ara sırasında da buton kilitli: pencere yalnız tur içinde açıktır.
  const over = () => {
    const v = view();
    return !v || props.now() >= v.endsAt || inGap();
  };

  return (
    <Screen class="game">
      <Show when={clock()}>
        {(c) => (
          <PhaseClock startedAt={c().phaseStartsAt} endsAt={c().phaseEndsAt} urgency={c().phase === "play"} />
        )}
      </Show>

      <div class="game__round" role="status" data-tight={tightening() ? "1" : undefined}>
        <span class="game__roundNo">
          Tur {Math.min(rounds(), (clock()?.round ?? 0) + 1)}/{rounds()}
        </span>
        <span class="game__roundWin">
          {tightening() ? "Pencere daralıyor · " : "Pencere "}
          {waveMs()} ms
        </span>
      </div>

      <div class="game__score">
        <span class="overline">{props.spectator ? "En yüksek puan" : "Puanın"}</span>
        <span class="game__num" ref={scoreEl}>
          {score()}
        </span>
      </div>

      <div class="game__stage">
        <div class="game__rings" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <ArcadeButton
          pressed={pressed()}
          waves={waves()}
          waveMs={waveMs()}
          fx={fx()}
          label="BAS"
          disabled={over()}
          onDown={press}
          onUp={release}
        />
        <div class="floats" aria-hidden="true">
          <For each={floats()}>{(f) => <span class={`float float--${f.kind}`}>{f.text}</span>}</For>
        </div>
        <Show when={inGap()}>
          <div class="game__gap" role="status">
            <span class="overline">
              Tur {Math.min(rounds(), (clock()?.round ?? 0) + 1)}/{rounds()}
            </span>
            <strong class="game__gapTitle">Pencere daralıyor</strong>
            <span class="game__gapWin">
              {prevWindowMs()} ms → {waveMs()} ms
            </span>
          </div>
        </Show>
      </div>

      <footer class="game__strip">
        <For each={strip()}>
          {(p) => (
            <div class="gs" data-me={p.id === props.selfId ? "1" : undefined}>
              <Avatar
                index={p.avatar}
                size="min(46px, calc((100vw - 40px - 42px) / 8))"
                connected={p.connected}
                flash={flashes()[p.id]}
              />
              <span class="gs__score">{view()?.scores[p.id] ?? 0}</span>
            </div>
          )}
        </For>
      </footer>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
