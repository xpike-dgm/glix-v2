import type { MatchSnapshot, RoomSnapshot } from "@glix/engine";
import { Show, Suspense } from "solid-js";
import { Dynamic } from "solid-js/web";
import { gameEntry } from "../games/registry.js";
import { createServerNow } from "../net/time.js";
import { Screen } from "../ui/Screen.js";

/** Oyun ekranını kayıt defterinden bulur; bilinmeyen oyun için sakin bir yer tutucu gösterir. */
export function Playing(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const now = createServerNow(100);
  const entry = () => gameEntry(props.match.gameId);
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
        <Suspense
          fallback={
            <Screen>
              <div class="center-stack">
                <span class="loader" aria-hidden="true" />
              </div>
            </Screen>
          }
        >
          <Dynamic
            component={e().Screen}
            match={props.match}
            selfId={props.snap.selfId}
            players={props.snap.players}
            now={now}
          />
        </Suspense>
      )}
    </Show>
  );
}
