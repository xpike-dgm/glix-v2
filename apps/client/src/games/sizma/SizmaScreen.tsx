import { createEffect, createMemo, on, Show } from "solid-js";
import { hapticGo } from "../../fx/haptics.js";
import { go } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { look } from "../../ui/avatars.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { PlayerPicker } from "../../ui/PlayerPicker.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import { Order, WordGem } from "./Clue.js";
import "./sizma.css";
import { Sonuc } from "./Sonuc.js";
import { type CrewMember, parseSizmaView } from "./view.js";

const SUSPECT = "#FF2BD6";

export default function SizmaScreen(props: GameScreenProps) {
  const view = createMemo(() => parseSizmaView(props.match.publicView, props.match.view));
  const crew = createMemo<CrewMember[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const spectator = () => props.spectator === true;
  // Aşama sunucudan gelir: geçişlerde sunucu yayın yapar (tick durumu değiştirir).
  const phase = () => view()?.phase ?? "clue";
  const closed = () => spectator() || phase() !== "vote" || view()?.locked === true;

  const pick = createPendingPick({
    server: () => view()?.myVote ?? null,
    send: (id) => sendActionAck({ kind: "vote", target: id }),
    closed,
  });
  const chosen = () => {
    const id = pick.value();
    return id === null ? null : (crew().find((m) => m.id === id) ?? null);
  };

  // İpucundan oylamaya geçişte kısa "başla" tepkisi.
  createEffect(
    on(phase, (now, before) => {
      if (before === "clue" && now === "vote") {
        go();
        hapticGo();
      }
    }),
  );

  // Yalnız oylama süreli: ipucu aşamasında süre göstergesi yoktur.
  const bar = () => {
    const v = view();
    if (!v) return null;
    if (v.phase === "vote") return { from: v.clueEndsAt, to: v.voteEndsAt, urgency: true };
    if (v.phase === "reveal") return { from: v.voteEndsAt, to: v.finishAt, urgency: false };
    return null;
  };

  return (
    <Screen class="game sz">
      <Show when={bar()}>
        {(b) => <PhaseClock startedAt={b().from} endsAt={b().to} urgency={b().urgency} />}
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
                    <div class="sz__head">
                      <span class="overline">{spectator() ? "Kelimeler gizli" : "Senin kelimen"}</span>
                    </div>
                    <div class="sz__mid">
                      <WordGem word={spectator() ? null : v().word} />
                      <p class="sz__hint">Sırayla yüksek sesle ipucu ver · 2 tur</p>
                      <Order crew={crew()} order={v().order} selfId={props.selfId} ready={v().ready} />
                    </div>
                    <TamamBar
                      locked={v().locked}
                      ready={v().ready.length}
                      readyIds={v().ready}
                      total={crew().length}
                      spectator={spectator()}
                      label="Oylamaya geç"
                      doneLabel="Hazırsın"
                      onLock={() => sendActionAck({ kind: "skip" })}
                    />
                  </>
                }
              >
                <div class="sz__head">
                  <span class="overline">{spectator() ? "Gizli oylama" : "Gizli oy"}</span>
                  <Show
                    when={chosen()}
                    fallback={
                      <span class="sz__title">{spectator() ? "Herkes oy veriyor" : "Sızma kim?"}</span>
                    }
                  >
                    {(p) => (
                      <span class="sz__title sz__title--locked" style={{ "--tc": look(p().avatar).color }}>
                        {p().nickname}
                      </span>
                    )}
                  </Show>
                  <Show when={!spectator() && v().word}>
                    <span class="sz__mine">
                      Kelimen <b>{v().word}</b>
                    </span>
                  </Show>
                </div>
                <PlayerPicker
                  players={crew()}
                  selfId={props.selfId}
                  allowSelf
                  selected={pick.value()}
                  disabled={closed()}
                  ring={SUSPECT}
                  label={(p) =>
                    p.id === props.selfId ? "Kendine oy ver" : `${p.nickname} adlı oyuncuya oy ver`
                  }
                  ready={v().ready}
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
              </Show>
            }
          >
            <Sonuc view={v()} crew={crew()} selfId={props.selfId} spectator={spectator()} />
          </Show>
        )}
      </Show>
    </Screen>
  );
}
