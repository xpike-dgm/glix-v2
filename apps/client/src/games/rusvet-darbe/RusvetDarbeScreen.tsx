import { createMemo, Match, Show, Switch } from "solid-js";
import { sendActionAck } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { look } from "../../ui/avatars.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { PlayerPicker } from "../../ui/PlayerPicker.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import { Dagitim } from "./Dagitim.js";
import { type CrewMember, Duello } from "./Duello.js";
import { Sonuc } from "./Sonuc.js";
import "./rusvet-darbe.css";
import { parseRusvetView } from "./view.js";

const SEAL = "#FFC23B";

export default function RusvetDarbeScreen(props: GameScreenProps) {
  const view = createMemo(() => parseRusvetView(props.match.publicView, props.match.view));
  const crew = createMemo<CrewMember[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const spectator = () => props.spectator === true;
  const voting = () => view()?.phase === "vote";

  const pick = createPendingPick({
    server: () => view()?.myVote ?? null,
    send: (id) => sendActionAck({ kind: "vote", target: id }),
    closed: () => spectator() || !voting() || view()?.locked === true,
  });
  const chosen = () => {
    const id = pick.value();
    return id === null ? null : (crew().find((m) => m.id === id) ?? null);
  };

  return (
    <Screen class="game rd">
      <Show when={view()}>
        {(v) => (
          <PhaseClock
            startedAt={v().phaseStartedAt}
            endsAt={v().phaseEndsAt}
            urgency={v().phase !== "reveal"}
          />
        )}
      </Show>

      <Show when={view()}>
        {(v) => (
          <Switch>
            <Match when={v().phase === "vote"}>
              <div class="rd__head">
                <span class="overline">{spectator() ? "Gizli seçim" : "Başkanlık seçimi"}</span>
                <Show
                  when={chosen()}
                  fallback={
                    <span class="rd__title">{spectator() ? "Herkes oy veriyor" : "Kimi seçiyorsun?"}</span>
                  }
                >
                  {(p) => (
                    <span class="rd__title rd__title--locked" style={{ "--tc": look(p().avatar).color }}>
                      {p().nickname}
                    </span>
                  )}
                </Show>
              </div>
              <PlayerPicker
                players={crew()}
                selfId={props.selfId}
                selected={pick.value()}
                disabled={spectator() || !voting() || v().locked}
                ring={SEAL}
                ready={v().ready}
                label={(p) => `${p.nickname} adlı oyuncuya başkanlık oyu ver`}
                onPick={(id) => pick.pick(id)}
              />
              <TamamBar
                locked={v().locked}
                ready={v().ready.length}
                readyIds={v().ready}
                total={crew().length}
                disabled={pick.value() === null}
                spectator={spectator()}
                onLock={() => sendActionAck({ kind: "lock" })}
              />
            </Match>
            <Match when={v().phase === "duel"}>
              <Duello
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={spectator()}
                onSign={(sign) => sendActionAck({ kind: "sign", sign })}
              />
            </Match>
            <Match when={v().phase === "give"}>
              <Dagitim
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={spectator()}
                onGive={(tokens) => sendActionAck({ kind: "give", tokens })}
                onDone={() => sendActionAck({ kind: "lock" })}
              />
            </Match>
            <Match when={v().phase === "reveal" && v().reveal}>
              <Sonuc view={v()} crew={crew()} selfId={props.selfId} spectator={spectator()} />
            </Match>
          </Switch>
        )}
      </Show>
    </Screen>
  );
}
