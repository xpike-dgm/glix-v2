import type { MatchSnapshot, RoomSnapshot } from "@glix/engine";
import { createSignal, For, Show, Suspense } from "solid-js";
import { Dynamic } from "solid-js/web";
import { gameEntry } from "../games/registry.js";
import { playersOnly } from "../screens/ranking.js";
import { BriefingPanels } from "../ui/BriefingPanels.js";
import { CheckIcon } from "../ui/Icons.js";
import { TvBoard } from "./TvParts.js";

/** Anlatım: üç kare büyük gösterilir, hedef ve adımlar okunur; sağda kimin hazır olduğu. */
export function TvBriefing(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const [panel, setPanel] = createSignal(0);
  const art = () => gameEntry(props.match.gameId)?.Art;
  const crew = () => playersOnly(props.snap.players).filter((p) => props.match.participants.includes(p.id));
  const readyCount = () => crew().filter((p) => props.match.readyIds.includes(p.id)).length;
  return (
    <div class="tv__cols">
      <main class="tv__brief">
        <header class="tv__head">
          <div>
            <p class="tv__overline">
              Oyun {props.match.round + 1} / {props.match.total}
            </p>
            <h1 class="tv__title tv__title--game">{props.match.gameName}</h1>
          </div>
          <p class="tv__chip" role="status">
            <CheckIcon size={28} /> {readyCount()} / {crew().length} hazır
          </p>
        </header>
        <div class="tv__briefbody">
          <div class="tv__briefart">
            <BriefingPanels
              gameId={props.match.gameId}
              index={panel}
              onIndex={setPanel}
              fallback={() => (
                <Suspense>
                  <Show when={art()}>{(a) => <Dynamic component={a()} />}</Show>
                </Suspense>
              )}
            />
          </div>
          <div class="tv__brieftext">
            <p class="tv__goal">{props.match.briefing.goal}</p>
            <ol class="tv__steps">
              <For each={props.match.briefing.steps}>
                {(step, i) => (
                  <li data-on={panel() === i() ? "1" : undefined}>
                    <b>{i() + 1}</b>
                    <span>{step}</span>
                  </li>
                )}
              </For>
            </ol>
          </div>
        </div>
      </main>
      <TvBoard
        title="Hazır mısınız?"
        hostId={props.snap.hostId}
        rows={crew().map((player) => ({
          player,
          ready: props.match.readyIds.includes(player.id),
          note: props.match.readyIds.includes(player.id) ? "Hazır" : "Bekleniyor",
        }))}
      />
    </div>
  );
}
