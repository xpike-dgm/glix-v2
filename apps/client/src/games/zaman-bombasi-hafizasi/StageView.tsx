import type { ZamanBombasiColor } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { createServerNow } from "../../net/time.js";
import { Avatar } from "../../ui/Avatar.js";
import { BombArt } from "../../ui/BombArt.js";
import type { GameScreenProps } from "../registry.js";
import { PADS, PadSymbol, padSound } from "./pads.js";
import {
  clientPhase,
  formatClock,
  isSuddenDeath,
  litIndexAt,
  parseZamanBombasiView,
  statusOf,
} from "./view.js";
import "./stage-view.css";

const STATUS_TITLE: Record<string, string> = {
  intro: "Hazır ol!",
  watch: "İzle ve ezberle",
  watchMine: "İzle ve ezberle",
  mine: "Sıra sende!",
  other: "Basıyor",
  ok: "Doğru!",
  fail: "Elendi!",
  timeout: "Süre doldu!",
  eliminated: "Elendi",
  over: "Oyun bitti",
};

/**
 * Zaman Bombası Hafızası, büyük ekran: dört dev renkli tuş, ışık dizisi oynarken tuşlar sırayla yanar,
 * sırası gelen oyuncu ortada büyük görünür. Yalnız herkese açık görünüm kullanılır.
 */
export default function ZamanBombasiStageView(props: GameScreenProps) {
  const now = createServerNow(40);
  const view = createMemo(() => parseZamanBombasiView(props.match.publicView, props.match.view));
  const phase = createMemo(() => {
    const v = view();
    return v ? clientPhase(v, now()) : "over";
  });
  const status = createMemo(() => {
    const v = view();
    return v ? statusOf({ v, phase: phase(), spectator: true }) : "intro";
  });
  const nameOf = (id: string | null | undefined): string =>
    props.players.find((p) => p.id === id)?.nickname ?? "Oyuncu";
  const activePlayer = () => props.players.find((p) => p.id === view()?.active);

  // Oynatmada yanan tuş; girişte son doğru basışın yankısı.
  const playLit = createMemo<ZamanBombasiColor | null>(() => {
    const v = view();
    if (!v || v.phase === "over" || !v.sequence || phase() !== "playback") return null;
    const i = litIndexAt(v, now());
    return i >= 0 ? (v.sequence[i] ?? null) : null;
  });
  const [echo, setEcho] = createSignal<ZamanBombasiColor | null>(null);
  let echoTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(echoTimer));
  createEffect(
    on(
      () => view()?.pressed.length ?? 0,
      (n, prev) => {
        const v = view();
        if (!v || n === 0 || (prev !== undefined && n <= prev)) return;
        const c = v.pressed[n - 1];
        if (!c) return;
        setEcho(c);
        clearTimeout(echoTimer);
        echoTimer = setTimeout(() => setEcho(null), 260);
      },
    ),
  );
  const lit = (): ZamanBombasiColor | null => playLit() ?? echo();
  createEffect(
    on(playLit, (c) => {
      if (c) padSound(c, 220);
    }),
  );

  const dots = () => Array.from({ length: view()?.length ?? 0 }, (_, i) => i);
  const dotState = (i: number): string => {
    const v = view();
    if (!v) return "";
    if (phase() === "playback") {
      const cur = litIndexAt(v, now());
      return i < Math.floor((now() - v.turnStart) / v.stepMs) ? "on" : i === cur ? "now" : "";
    }
    if (phase() === "input" || phase() === "expired") return i < v.pressed.length ? "ok" : "";
    return "";
  };
  const timeLeft = () => {
    const v = view();
    return v ? Math.max(0, v.endsAt - now()) : 0;
  };
  const sudden = () => {
    const v = view();
    return v ? !v.timeUp && v.phase !== "over" && isSuddenDeath(v, now()) : false;
  };
  const tone = (): string => {
    const s = status();
    if (s === "ok") return "lime";
    if (s === "fail" || s === "timeout" || s === "eliminated") return "red";
    if (s === "mine" || s === "other") return "cyan";
    return "";
  };
  const heading = (): string => {
    const s = status();
    if (s === "other" || s === "mine") return `${nameOf(view()?.active)} basıyor`;
    if (s === "fail") return `${nameOf(view()?.last?.player)} elendi`;
    return STATUS_TITLE[s] ?? "";
  };
  const subline = (): string => {
    const v = view();
    if (!v) return "";
    const s = status();
    if (s === "watch" || s === "watchMine" || s === "intro")
      return v.active ? `${nameOf(v.active)} bu ${v.length} rengi tekrarlayacak` : "";
    if (s === "other" || s === "mine") return `${v.pressed.length} / ${v.length} renk`;
    if (s === "ok") return v.active ? `Sıradaki: ${nameOf(v.active)}` : "";
    if (s === "fail") return "Dizi 2 renge döndü";
    return "";
  };

  return (
    <Show when={view()}>
      {(v) => (
        <div class="zbtv" data-sudden={sudden() ? "1" : undefined}>
          <div class="zbtv__top">
            <div class="zbtv__who">
              <Show when={activePlayer()} fallback={<BombArt class="zbtv__bomb" />}>
                {(p) => (
                  <Avatar
                    index={p().avatar}
                    size={150}
                    connected={p().connected}
                    live="breathe"
                    ring="var(--cyan)"
                  />
                )}
              </Show>
              <div>
                <p class="zbtv__head" data-tone={tone()}>
                  {heading()}
                </p>
                <p class="zbtv__sub">{subline()}</p>
              </div>
            </div>
            <div class="zbtv__total" role="timer" aria-label="Kalan toplam süre">
              <span class="zbtv__totalnum">{formatClock(timeLeft())}</span>
              <Show when={sudden()}>
                <span class="zbtv__badge">Ani ölüm</span>
              </Show>
            </div>
          </div>
          <div class="zbtv__pads">
            <For each={PADS}>
              {(pad) => (
                <div class="zbtv__pad" data-c={pad.color} data-state={lit() === pad.color ? "lit" : "dim"}>
                  <PadSymbol color={pad.color} />
                  <span class="zbtv__padname">{pad.label}</span>
                </div>
              )}
            </For>
          </div>
          <div class="zbtv__track" aria-hidden="true">
            <For each={dots()}>{(i) => <i class="zbtv__dot" data-s={dotState(i)} />}</For>
          </div>
          <p class="zbtv__len">Dizi uzunluğu: {v().length}</p>
        </div>
      )}
    </Show>
  );
}
