import { createEffect, createMemo, Match, on, Show, Switch } from "solid-js";
import { hapticGo } from "../../fx/haptics.js";
import { go } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import type { GameScreenProps } from "../registry.js";
import { ClueStage } from "./Clue.js";
import { Fark } from "./Fark.js";
import "./sizma.css";
import { Sonuc } from "./Sonuc.js";
import { VoteStage } from "./Vote.js";
import { type CrewMember, parseSizmaView } from "./view.js";

type Props = GameScreenProps & {
  /** Büyük ekran (TV) yerleşimi: kelimeler yok, düğmeler yok, yatay düzen. */
  tv?: boolean;
};

export default function SizmaScreen(props: Props) {
  const view = createMemo(() => parseSizmaView(props.match.publicView, props.match.view));
  const crew = createMemo<CrewMember[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const spectator = () => props.spectator === true || props.tv === true;
  // Aşama sunucudan gelir: geçişlerde sunucu yayın yapar.
  const phase = () => view()?.phase ?? "clue";

  // İpucundan oylamaya geçişte kısa "başla" tepkisi.
  createEffect(
    on(phase, (now, before) => {
      if (before === "clue" && now === "vote" && !spectator()) {
        go();
        hapticGo();
      }
    }),
  );

  // Süre göstergesi: oylamalar ve soru (son 5 sn kırmızı + tik); ipucunda konuşma çubuğu kendi kartında.
  const bar = () => {
    const v = view();
    if (!v || v.phase === "clue" || v.phase === "guess" || v.phase === "reveal") return null;
    return { from: v.phaseStartedAt, to: v.phaseEndsAt };
  };

  return (
    <Screen class={`game sz${props.tv ? " sz--tv" : ""}`}>
      <Show when={bar()}>{(b) => <PhaseClock startedAt={b().from} endsAt={b().to} urgency />}</Show>
      <Show when={view()}>
        {(v) => (
          <Switch>
            <Match when={v().phase === "clue"}>
              <ClueStage
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={spectator()}
                now={props.now}
                tv={props.tv}
              />
            </Match>
            <Match when={v().phase === "vote" || v().phase === "runoff"}>
              <VoteStage
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={spectator()}
                now={props.now}
                tv={props.tv}
              />
            </Match>
            <Match when={v().phase === "notice"}>
              <Fark
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={spectator()}
                now={props.now}
                onAnswer={(yes) => sendActionAck({ kind: "notice", yes })}
              />
            </Match>
            <Match when={v().reveal}>
              <Sonuc
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={spectator()}
                now={props.now}
                comment={() => props.match.comment ?? null}
                tv={props.tv}
              />
            </Match>
          </Switch>
        )}
      </Show>
      <Show when={!props.tv}>
        <RevealContinue
          match={props.match}
          selfId={props.selfId}
          now={props.now}
          spectator={props.spectator}
        />
      </Show>
    </Screen>
  );
}
