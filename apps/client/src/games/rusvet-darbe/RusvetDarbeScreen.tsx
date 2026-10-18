import { createMemo, Match, Show, Switch } from "solid-js";
import { sendAction } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { look } from "../../ui/avatars.js";
import { PlayerPicker } from "../../ui/PlayerPicker.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { Screen } from "../../ui/Screen.js";
import { SoundToggle } from "../../ui/SoundToggle.js";
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
    send: (id) => {
      sendAction({ kind: "vote", target: id });
    },
    closed: () => spectator() || !voting(),
  });
  const chosen = () => {
    const id = pick.value();
    return id === null ? null : (crew().find((m) => m.id === id) ?? null);
  };

  return (
    <Screen class="game rd">
      <header class="game__top">
        <Show when={view()} fallback={<div class="pbar" />}>
          {(v) => (
            <ProgressBar
              startedAt={v().phaseStartedAt}
              endsAt={v().phaseEndsAt}
              now={serverNow}
              urgency={v().phase !== "reveal"}
            />
          )}
        </Show>
        <div class="game__tools">
          <SoundToggle />
        </div>
      </header>

      <Show when={view()}>
        {(v) => (
          <Switch>
            <Match when={v().phase === "vote"}>
              <div class="rd__head">
                <span class="overline">{spectator() ? "Gizli seçim" : "Başkanlık seçimi"}</span>
                <Show
                  when={chosen()}
                  fallback={
                    <span class="rd__title">
                      {spectator() ? "Herkes oy veriyor" : "Kimi başkan yapıyorsun?"}
                    </span>
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
                disabled={spectator() || !voting()}
                ring={SEAL}
                label={(p) => `${p.nickname} adlı oyuncuya başkanlık oyu ver`}
                onPick={(id) => pick.pick(id)}
              />
              <p class="rd__hint" role="status">
                {spectator()
                  ? "Başkan süre bitince belli olur"
                  : pick.value() === null
                    ? "Oy vermezsen rastgele biri seçilir"
                    : "Süre bitene kadar değiştirebilirsin"}
              </p>
            </Match>
            <Match when={v().phase === "duel"}>
              <Duello
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={spectator()}
                onSign={(sign) => {
                  sendAction({ kind: "sign", sign });
                }}
              />
            </Match>
            <Match when={v().phase === "give"}>
              <Dagitim
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={spectator()}
                onGive={(tokens) => {
                  sendAction({ kind: "give", tokens });
                }}
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
