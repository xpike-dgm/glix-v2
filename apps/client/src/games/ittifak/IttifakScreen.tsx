import { ITTIFAK_MAX_PROMISES } from "@glix/engine";
import { createMemo, createSignal, Show } from "solid-js";
import { hapticError } from "../../fx/haptics.js";
import { fail } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { look } from "../../ui/avatars.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { PlayerPicker } from "../../ui/PlayerPicker.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./ittifak.css";
import { type CrewMember, Pazarlik } from "./Pazarlik.js";
import { Sonuc } from "./Sonuc.js";
import { parseIttifakView, togglePromise } from "./view.js";

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

  // Söz işaretleri: yalnız sana görünür; dokununca hemen görünür, sunucu onaylayınca kesinleşir.
  const sameSet = (a: string[], b: string[]): boolean =>
    a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
  const [promised, setPromised] = createOptimistic<string[]>(() => view()?.myPromises ?? [], {
    equals: sameSet,
  });
  const [full, setFull] = createSignal(false);
  const promise = (id: string): void => {
    const next = togglePromise(promised(), id, ITTIFAK_MAX_PROMISES);
    if (next === null) {
      fail();
      hapticError();
      setFull(true);
      return;
    }
    setFull(false);
    setPromised(next, () => sendActionAck({ kind: "promise", target: id, on: next.includes(id) }));
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
      <Show when={view()}>
        <PhaseClock startedAt={bar().from} endsAt={bar().to} urgency={bar().urgency} />
      </Show>

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
                      promised={promised()}
                      {...(props.spectator === true ? {} : { onPromise: promise })}
                    />
                    <Show when={props.spectator !== true}>
                      <p
                        class="it__hint it__hint--promise"
                        role="status"
                        data-full={full() ? "1" : undefined}
                      >
                        {full()
                          ? "En çok 2 söz işareti"
                          : `Dokun: söz işareti ${promised().length}/${ITTIFAK_MAX_PROMISES} · yalnız sen görürsün`}
                      </p>
                    </Show>
                    <TamamBar
                      locked={v().locked}
                      ready={v().ready.length}
                      readyIds={v().ready}
                      total={crew().length}
                      spectator={props.spectator === true}
                      label="Oylamaya geç"
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
                  readyIds={v().ready}
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
