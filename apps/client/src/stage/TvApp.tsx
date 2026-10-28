import { createEffect, createMemo, createSignal, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { enterTvMode, joinStage, startNet } from "../net/client.js";
import { normalizeCode } from "../net/code.js";
import { collectRounds } from "../net/matchHistory.js";
import { state } from "../net/store.js";
import { setScreenAwake } from "../pwa/wakeLock.js";
import { Reconnecting } from "../screens/Reconnecting.js";
import { installErrorReporting } from "../telemetry/errors.js";
import { preloadGameArt } from "../ui/artPreload.js";
import { Toasts } from "../ui/Toast.js";
import { WorldBackdrop } from "../ui/WorldBackdrop.js";
import { preloadWorld } from "../ui/world.js";
import { TvBriefing } from "./TvBriefing.js";
import { TvCards } from "./TvCards.js";
import { TvCountdown } from "./TvCountdown.js";
import { TvEntry } from "./TvEntry.js";
import { TvFinal } from "./TvFinal.js";
import { TvLobby } from "./TvLobby.js";
import { TvCodeTag } from "./TvParts.js";
import { TvPlaying } from "./TvPlaying.js";
import { TvResults } from "./TvResults.js";
import { tvCanvas } from "./tvLayout.js";
import "./tv.css";

/** `/tv` yolunda mıyız. */
export function isTvRoute(loc: Pick<Location, "pathname">): boolean {
  return /^\/tv\/?$/.test(loc.pathname);
}

function devReady(started: Promise<unknown>): void {
  void started.finally(() => {
    queueMicrotask(() => queueMicrotask(() => document.documentElement.setAttribute("data-ready", "1")));
  });
}

/** Büyük ekran (sahne) uygulaması: oda koduyla bağlanır, yalnız izler; hiçbir eylem göndermez. */
export function TvApp() {
  const [canvas, setCanvas] = createSignal(tvCanvas(window.innerWidth, window.innerHeight));
  const onResize = (): void => {
    setCanvas(tvCanvas(window.innerWidth, window.innerHeight));
  };

  onMount(() => {
    enterTvMode();
    document.title = "GLIX · TV ekranı";
    window.addEventListener("resize", onResize);
    onCleanup(() => window.removeEventListener("resize", onResize));
    installErrorReporting();
    const params = new URLSearchParams(window.location.search);
    const mock = import.meta.env.DEV ? params.get("mock") : null;
    if (mock?.startsWith("tv-")) {
      devReady(import("../dev/mockTv.js").then((m) => void m.startTvMock(mock, params)));
      return;
    }
    onCleanup(startNet());
    const code = normalizeCode(params.get("oda") ?? "");
    if (code.length === 5) joinStage(code);
  });

  createEffect(() => collectRounds(state.snapshot));
  createEffect(() => setScreenAwake(state.snapshot !== null));
  const worldId = createMemo(() => {
    const s = state.snapshot;
    if (!s) return "lobi";
    return s.phase === "lobby" || s.phase === "final" || !s.match ? "lobi" : s.match.gameId;
  });
  createEffect(() => preloadWorld(worldId()));
  // Anlatım çizgi romanı ve nesne görselleri ile sıradaki oyunun görselleri önden inip hazır beklesin.
  createEffect(() => {
    const id = state.snapshot?.match?.gameId;
    if (id) preloadGameArt(id);
  });
  createEffect(() => {
    const snap = state.snapshot;
    const next = snap?.match
      ? snap.gameIds[snap.match.round + 1]
      : snap?.phase === "lobby"
        ? snap.gameIds[0]
        : undefined;
    if (!next) return;
    const t = setTimeout(() => preloadGameArt(next, true), 1200);
    onCleanup(() => clearTimeout(t));
  });

  return (
    <div class="stage tvstage">
      <WorldBackdrop gameId={worldId()} />
      <div
        class="tv"
        data-screen={state.snapshot ? state.snapshot.phase : "entry"}
        style={{
          width: `${canvas().w}px`,
          height: `${canvas().h}px`,
          transform: `scale(${canvas().k})`,
        }}
      >
        <Switch>
          <Match when={!state.snapshot}>
            <TvEntry />
          </Match>
          <Match when={state.snapshot}>
            {(snap) => (
              <>
                <Show when={snap().phase !== "lobby"}>
                  <TvCodeTag code={snap().code} />
                </Show>
                <Switch>
                  <Match when={snap().phase === "lobby"}>
                    <TvLobby snap={snap()} />
                  </Match>
                  <Match when={snap().phase === "final"}>
                    <TvFinal snap={snap()} />
                  </Match>
                  <Match when={snap().match}>
                    {(match) => (
                      <Switch>
                        <Match when={snap().phase === "briefing"}>
                          <TvBriefing snap={snap()} match={match()} />
                        </Match>
                        <Match when={snap().phase === "countdown"}>
                          <TvCountdown snap={snap()} match={match()} />
                        </Match>
                        <Match when={snap().phase === "playing"}>
                          <TvPlaying snap={snap()} match={match()} />
                        </Match>
                        <Match when={snap().phase === "results"}>
                          <TvResults snap={snap()} match={match()} />
                        </Match>
                        <Match when={snap().phase === "cards"}>
                          <TvCards snap={snap()} match={match()} />
                        </Match>
                      </Switch>
                    )}
                  </Match>
                </Switch>
              </>
            )}
          </Match>
        </Switch>
      </div>
      <Reconnecting />
      <Toasts />
    </div>
  );
}
