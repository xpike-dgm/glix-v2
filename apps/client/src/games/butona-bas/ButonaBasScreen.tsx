import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, untrack } from "solid-js";
import { hapticMatch, hapticSolo, hapticTap } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound, tap, unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { Avatar } from "../../ui/Avatar.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { Screen } from "../../ui/Screen.js";
import { SoundToggle } from "../../ui/SoundToggle.js";
import type { GameScreenProps } from "../registry.js";
import { ArcadeButton, type ArcadeFx } from "./ArcadeButton.js";
import { maxWindowIndex, newWindows, parseButonaBasView } from "./view.js";

interface Float {
  id: number;
  text: string;
  kind: "match" | "solo";
}

export default function ButonaBasScreen(props: GameScreenProps) {
  const view = createMemo(() => parseButonaBasView(props.match.view));
  const score = () => {
    const v = view();
    if (!v) return 0;
    return v.myScore ?? v.scores[props.selfId] ?? 0;
  };
  const strip = () => props.players.filter((p) => props.match.participants.includes(p.id));
  const waveMs = () => view()?.windowMs ?? 300;

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
    if (t >= v.endsAt) return;
    const idx = Math.floor((t - v.startedAt) / v.windowMs);
    if (idx === lastSentWindow) return;
    lastSentWindow = idx;
    sendAction({ kind: "press" });
  };

  const over = () => {
    const v = view();
    return !v || props.now() >= v.endsAt;
  };

  return (
    <Screen class="game">
      <header class="game__top">
        <Show when={view()} fallback={<div class="pbar" />}>
          {(v) => <ProgressBar startedAt={v().startedAt} endsAt={v().endsAt} now={serverNow} urgency />}
        </Show>
        <div class="game__tools">
          <SoundToggle />
        </div>
      </header>

      <div class="game__score">
        <span class="overline">Puanın</span>
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
    </Screen>
  );
}
