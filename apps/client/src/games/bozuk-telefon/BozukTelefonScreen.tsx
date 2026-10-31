import { createMemo, For, Match, Show, Switch } from "solid-js";
import { createVisibleArea } from "../../ui/keyboardArea.js";
import type { GameScreenProps } from "../registry.js";
import "../karalama-defteri/karalama.css";
import "./bozuk-telefon.css";
import { sendInspire } from "../../net/client.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Cizme } from "./Cizme.js";
import { Galeri } from "./Galeri.js";
import { Gosteri } from "./Gosteri.js";
import { parseBozukView } from "./view.js";
import { Yazma } from "./Yazma.js";

export interface Crew {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

export default function BozukTelefonScreen(props: GameScreenProps) {
  const view = createMemo(() => parseBozukView(props.match.publicView, props.match.view));
  const crew = createMemo<Crew[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const area = createVisibleArea();
  const spectator = () => props.spectator === true;
  const areaStyle = () => {
    const a = area();
    return a.keyboard ? { top: `${a.top}px`, bottom: "auto", height: `${a.height}px` } : undefined;
  };
  return (
    <section class="screen kd bt" data-tight={area().height < 440 ? "1" : undefined} style={areaStyle()}>
      <div class="col">
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
              <Match when={v().phase === "write"}>
                <For each={[v().step]}>
                  {() => (
                    <Yazma
                      view={v()}
                      crew={crew()}
                      spectator={spectator()}
                      now={props.now}
                      inspire={props.match.inspire}
                      onInspire={() => sendInspire(props.match.round)}
                    />
                  )}
                </For>
              </Match>
              <Match when={v().phase === "draw"}>
                <For each={[v().step]}>
                  {() => <Cizme view={v()} crew={crew()} spectator={spectator()} now={props.now} />}
                </For>
              </Match>
              <Match when={v().phase === "done" ? v().recap : null}>
                {(recap) => (
                  <Galeri
                    recap={recap()}
                    players={props.players}
                    selfId={props.selfId}
                    startedAt={props.match.reveal?.startedAt ?? props.now()}
                    endsAt={props.match.reveal?.endsAt ?? props.now()}
                  />
                )}
              </Match>
              <Match when={v().reveal}>
                {(rv) => (
                  <Gosteri
                    view={v()}
                    reveal={rv()}
                    players={props.players}
                    selfId={props.selfId}
                    spectator={spectator()}
                    now={props.now}
                  />
                )}
              </Match>
            </Switch>
          )}
        </Show>
        <RevealContinue
          match={props.match}
          selfId={props.selfId}
          now={props.now}
          spectator={props.spectator}
        />
      </div>
    </section>
  );
}
