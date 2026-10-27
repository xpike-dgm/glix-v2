import type { MatchSnapshot, RoomSnapshot } from "@glix/engine";
import { createMemo, Show, Suspense } from "solid-js";
import { Dynamic } from "solid-js/web";
import { gameEntry } from "../games/registry.js";
import { createServerNow } from "../net/time.js";
import { GameFrame } from "../ui/GameFrame.js";
import { Loading } from "../ui/Loading.js";
import { Screen } from "../ui/Screen.js";

/**
 * Oyun ekranını kayıt defterinden bulur ve oyun çerçevesine (dikey sütun / yatay sahne, izleyici şeridi,
 * "yan çevir" örtüsü) koyar. Bilinmeyen oyun için sakin bir yer tutucu gösterir.
 */
export function Playing(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const now = createServerNow(100);
  const entry = () => gameEntry(props.match.gameId);
  const spectator = () => !props.match.participants.includes(props.snap.selfId);
  const hud = createMemo(() => entry()?.hud?.(props.match, props.snap.selfId) ?? null);
  return (
    <Show
      when={entry()}
      fallback={
        <Screen>
          <div class="center-stack">
            <div class="ghost-seat" aria-hidden="true">
              ?
            </div>
            <h1 class="display h-title">{props.match.gameName}</h1>
            <p class="lead">Bu oyun bu sürümde henüz açılmıyor. Birazdan sıradaki oyuna geçilecek.</p>
          </div>
        </Screen>
      }
    >
      {(e) => (
        <GameFrame
          orientation={props.match.orientation}
          spectator={spectator()}
          gameName={props.match.gameName}
          gameId={props.match.gameId}
          round={props.match.round}
          total={props.match.total}
          noClock={e().noClock}
          selfId={props.snap.selfId}
          players={props.snap.players}
          participants={props.match.participants}
          hud={hud()}
          now={now}
        >
          <Suspense fallback={<Loading />}>
            <Dynamic
              component={e().Screen}
              match={props.match}
              selfId={props.snap.selfId}
              players={props.snap.players}
              now={now}
              spectator={spectator()}
            />
          </Suspense>
        </GameFrame>
      )}
    </Show>
  );
}
