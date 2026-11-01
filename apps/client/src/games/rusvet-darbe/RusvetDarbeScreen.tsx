import { createMemo, createSignal, Match, onCleanup, Show, Switch } from "solid-js";
import { sendActionAck } from "../../net/client.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import type { GameScreenProps } from "../registry.js";
import { Dagitim } from "./Dagitim.js";
import { Darbe } from "./Darbe.js";
import { Duello } from "./Duello.js";
import type { CrewMember } from "./Seats.js";
import { Secim } from "./Secim.js";
import { Sonuc } from "./Sonuc.js";
import { TacAni } from "./TacAni.js";
import "./rusvet-darbe.css";
import { parseRusvetView } from "./view.js";

export default function RusvetDarbeScreen(props: GameScreenProps) {
  const view = createMemo(() => parseRusvetView(props.match.publicView, props.match.view));
  const crew = createMemo<CrewMember[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const spectator = () => props.spectator === true;
  // Sahne saatleri (düello ritmi, taç anı, açılış sahneleri, son 5 sn) için 100 ms'lik saat.
  const [clock, setClock] = createSignal(props.now());
  const timer = setInterval(() => setClock(props.now()), 100);
  onCleanup(() => clearInterval(timer));
  const now = () => clock();

  const crowning = () => {
    const c = view()?.crown;
    return c !== null && c !== undefined && now() < c.endsAt;
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
            <Match when={v().phase === "vote" || v().phase === "runoff"}>
              <Secim view={v()} crew={crew()} selfId={props.selfId} spectator={spectator()} />
            </Match>
            <Match when={v().phase === "duel"}>
              <Duello
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={spectator()}
                now={now}
                onSign={(sign) => sendActionAck({ kind: "sign", sign })}
              />
            </Match>
            <Match when={v().phase === "give"}>
              <Dagitim
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={spectator()}
                now={now}
                onGive={(tokens) => sendActionAck({ kind: "give", tokens })}
                onDone={() => sendActionAck({ kind: "lock" })}
              />
              <Show when={crowning()}>
                <TacAni
                  president={crew().find((m) => m.id === v().president) ?? null}
                  budget={v().budget ?? 0}
                  mine={!spectator() && v().president === props.selfId}
                  spectator={spectator()}
                />
              </Show>
            </Match>
            <Match when={v().phase === "coup" && v().coup}>
              <Darbe
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={spectator()}
                onCoup={(yes) => sendActionAck({ kind: "coup", yes })}
              />
            </Match>
            <Match when={v().phase === "reveal" && v().reveal}>
              <Sonuc view={v()} crew={crew()} selfId={props.selfId} spectator={spectator()} now={now} />
            </Match>
          </Switch>
        )}
      </Show>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
