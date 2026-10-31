import type { MatchSnapshot, RoomSnapshot } from "@glix/engine";
import { createMemo, createSignal, onCleanup, Show, Suspense } from "solid-js";
import { Dynamic } from "solid-js/web";
import { gameEntry } from "../games/registry.js";
import { createServerNow } from "../net/time.js";
import { playersOnly } from "../screens/ranking.js";
import { Clock } from "../ui/Clock.js";
import type { ClockWindow } from "../ui/clockState.js";
import { Loading } from "../ui/Loading.js";
import { ShellContext } from "../ui/shell.js";
import { scoreRows, TvBoard, TvFit } from "./TvParts.js";
import { gameBox } from "./tvLayout.js";

/**
 * Oyun sırasında sahne: solda oyunun adı, turu, kabuk saati ve oyun ekranı (izleyici kipinde, büyütülmüş;
 * `StageView` tanımlı oyunlarda ona özel büyük görünüm), sağda oyuncular ve puanlar.
 * Sahne hiçbir zaman oyuncu kimliği taşımaz: oyun ekranına `selfId` boş verilir, izleyici yolu çalışır.
 */
export function TvPlaying(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const now = createServerNow(100);
  const entry = () => gameEntry(props.match.gameId);
  const hud = createMemo(() => entry()?.hud?.(props.match, "") ?? null);
  // Süre penceresi: oyun `useShell().setClock` ile bildirir; yatay oyunlar `hud` ile.
  const [reported, setReported] = createSignal<ClockWindow | null>(null);
  let owner: symbol | null = null;
  const setClock = (who: symbol, w: ClockWindow | null): void => {
    if (w) {
      owner = who;
      setReported(w);
    } else if (owner === who) {
      owner = null;
      setReported(null);
    }
  };
  onCleanup(() => setReported(null));
  const win = createMemo<ClockWindow | null>(
    () => reported() ?? (hud() ? { ...(hud() as NonNullable<ReturnType<typeof hud>>), urgency: true } : null),
  );
  const crew = () => playersOnly(props.snap.players).filter((p) => props.match.participants.includes(p.id));
  const box = () => gameBox(props.match.orientation);
  /** Oyun kendi oyuncu/skor sütununu çiziyorsa (yalnız `StageView` ile) kabuk paneli gizlenir, alan genişler. */
  const ownBoard = () => entry()?.tvOwnBoard === true && entry()?.StageView !== undefined;
  const rows = createMemo(() =>
    scoreRows(crew(), (p) => {
      const inGame = hud()?.scores[p.id];
      return {
        note: inGame === undefined ? undefined : `Bu oyunda ${inGame}`,
      };
    }),
  );
  const gameProps = () => ({
    match: props.match,
    selfId: "",
    players: props.snap.players,
    now,
    spectator: true,
  });
  return (
    <ShellContext.Provider value={{ setClock, crew }}>
      <div class="tv__cols" data-own-board={ownBoard() ? "1" : undefined}>
        <main class="tv__play">
          <header class="tv__head">
            <div>
              <p class="tv__overline">
                Oyun {props.match.round + 1} / {props.match.total}
              </p>
              <h1 class="tv__title tv__title--game">{props.match.gameName}</h1>
            </div>
            <Show when={!entry()?.noClock}>
              <div class="tv__clock">
                <Clock tension={false} win={win()} now={now} />
              </div>
            </Show>
          </header>
          <Show when={entry()} fallback={<p class="tv__lead">Bu oyun bu sürümde henüz açılmıyor.</p>}>
            {(e) => (
              <Show
                when={e().StageView}
                fallback={
                  <TvFit w={box().w} h={box().h}>
                    <div
                      class="gframe"
                      data-o={props.match.orientation === "portrait" ? "tvp" : "landscape"}
                      data-spectator="1"
                    >
                      <div class="gframe__main">
                        <div class="gframe__body">
                          <div
                            class="gframe__game"
                            ref={(el) => {
                              el.inert = true;
                            }}
                          >
                            <Suspense fallback={<Loading />}>
                              <Dynamic component={e().Screen} {...gameProps()} />
                            </Suspense>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TvFit>
                }
              >
                {(StageView) => (
                  <div class="tv__bespoke">
                    <Suspense fallback={<Loading />}>
                      <Dynamic component={StageView()} {...gameProps()} />
                    </Suspense>
                  </div>
                )}
              </Show>
            )}
          </Show>
        </main>
        <Show when={!ownBoard()}>
          <TvBoard title="Oyuncular" hostId={props.snap.hostId} rows={rows()} />
        </Show>
      </div>
    </ShellContext.Provider>
  );
}
