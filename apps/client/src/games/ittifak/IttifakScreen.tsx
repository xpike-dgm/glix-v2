import { createMemo, Show } from "solid-js";
import { sendActionAck } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { look } from "../../ui/avatars.js";
import { PlayerPicker } from "../../ui/PlayerPicker.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { Screen } from "../../ui/Screen.js";
import { SoundToggle } from "../../ui/SoundToggle.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./ittifak.css";
import { type CrewMember, Pazarlik } from "./Pazarlik.js";
import { Sonuc } from "./Sonuc.js";
import { parseIttifakView } from "./view.js";

const LOCK = "#B6FF3B";

export default function IttifakScreen(props: GameScreenProps) {
  const view = createMemo(() => parseIttifakView(props.match.publicView, props.match.view));
  const crew = createMemo<CrewMember[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  // Aşama sunucudan gelir: geçişlerde sunucu yayın yapar (tick durumu değiştirir).
  const phase = () => view()?.phase ?? "talk";
  const closed = () => props.spectator === true || phase() !== "vote" || view()?.locked === true;

  const pick = createPendingPick({
    server: () => view()?.myVote ?? null,
    send: (id) => sendActionAck({ kind: "vote", target: id }),
    closed,
  });
  const chosen = () => {
    const id = pick.value();
    return id === null ? null : (crew().find((m) => m.id === id) ?? null);
  };

  const bar = () => {
    const v = view();
    if (!v) return { from: 0, to: 1, urgency: false };
    if (v.reveal) return { from: v.voteEndsAt, to: v.finishAt, urgency: false };
    if (v.phase === "vote") return { from: v.talkEndsAt, to: v.voteEndsAt, urgency: true };
    return { from: v.startedAt, to: v.talkEndsAt, urgency: false };
  };

  return (
    <Screen class="game it">
      <header class="game__top">
        <Show when={view()} fallback={<div class="pbar" />}>
          <ProgressBar startedAt={bar().from} endsAt={bar().to} now={serverNow} urgency={bar().urgency} />
        </Show>
        <div class="game__tools">
          <SoundToggle />
        </div>
      </header>

      <Show when={view()}>
        {(v) => (
          <Show
            when={v().reveal}
            fallback={
              <Show
                when={v().phase === "vote"}
                fallback={
                  <>
                    <div class="it__head">
                      <span class="overline">Pazarlık zamanı</span>
                      <span class="it__title">Oy iste, söz ver</span>
                    </div>
                    <Pazarlik
                      crew={crew()}
                      selfId={props.selfId}
                      endsAt={v().talkEndsAt}
                      now={props.now}
                      ready={v().ready}
                    />
                    <TamamBar
                      locked={v().locked}
                      ready={v().ready.length}
                      total={crew().length}
                      spectator={props.spectator === true}
                      label="Oylamaya geçelim"
                      doneLabel="Hazırsın"
                      onLock={() => sendActionAck({ kind: "skip" })}
                    />
                  </>
                }
              >
                <div class="it__head">
                  <span class="overline">{props.spectator ? "Gizli oylama" : "Gizli oyun"}</span>
                  <Show
                    when={chosen()}
                    fallback={
                      <span class="it__title">
                        {props.spectator ? "Herkes oy veriyor" : "Kime oy veriyorsun?"}
                      </span>
                    }
                  >
                    {(p) => (
                      <span class="it__title it__title--locked" style={{ "--tc": look(p().avatar).color }}>
                        {p().nickname}
                      </span>
                    )}
                  </Show>
                </div>
                <PlayerPicker
                  players={crew()}
                  selfId={props.selfId}
                  selected={pick.value()}
                  disabled={closed()}
                  ring={LOCK}
                  label={(p) => `${p.nickname} adlı oyuncuya oy ver`}
                  ready={v().ready}
                  onPick={(id) => pick.pick(id)}
                />
                <TamamBar
                  locked={v().locked}
                  ready={v().ready.length}
                  total={crew().length}
                  disabled={pick.value() === null}
                  spectator={props.spectator === true}
                  onLock={() => sendActionAck({ kind: "lock" })}
                />
              </Show>
            }
          >
            <Sonuc view={v()} crew={crew()} selfId={props.selfId} spectator={props.spectator === true} />
          </Show>
        )}
      </Show>
    </Screen>
  );
}
