// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import { createMemo, Match, Show, Switch } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./karalama.css";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { DrawBoard } from "./DrawBoard.js";
import { Header } from "./Header.js";
import { VoteWall } from "./VoteWall.js";
import { parseKaralamaView } from "./view.js";

export default function KaralamaDefteriScreen(props: GameScreenProps) {
  const view = createMemo(() => parseKaralamaView(props.match.publicView, props.match.view));
  const phase = createMemo(() => view()?.phase);
  const crew = () => props.players.filter((p) => props.match.participants.includes(p.id));
  return (
    <Screen class="kd">
      <Show
        when={view()}
        fallback={
          <div class="center-stack">
            <span class="loader" aria-hidden="true" />
          </div>
        }
      >
        {(v) => (
          <Switch>
            <Match when={phase() === "draw" && !props.spectator}>
              <DrawBoard
                strokes={v().strokes}
                endsAt={v().drawEndsAt}
                done={v().drawDone}
                readyCount={v().drawDoneIds.length}
                total={v().players.length}
                header={<Header view={v()} now={props.now} />}
                now={props.now}
              />
            </Match>
            <Match when={phase() === "draw"}>
              <Header view={v()} now={props.now} title="Arkadaşların çiziyor" />
              <div class="kd__watch">
                <svg viewBox="0 0 96 96" class="kd__watchart" aria-hidden="true">
                  <path d="M10 80c8-14 16 6 24-4" />
                  <path d="M64 14l18 18-38 38-22 4 4-22z" />
                  <path d="M56 22l18 18" />
                </svg>
                <div class="kd__crew">
                  {crew().map((p) => (
                    <Avatar
                      index={p.avatar}
                      size={40}
                      connected={p.connected}
                      ready={v().drawDoneIds.includes(p.id)}
                    />
                  ))}
                </div>
                <TamamBar
                  spectator
                  locked={false}
                  ready={v().drawDoneIds.length}
                  readyIds={v().drawDoneIds}
                  total={v().players.length}
                  onLock={() => undefined}
                />
              </div>
            </Match>
            <Match when={true}>
              <VoteWall
                view={v()}
                players={props.players}
                selfId={props.selfId}
                spectator={props.spectator === true}
                now={props.now}
              />
            </Match>
          </Switch>
        )}
      </Show>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
