import type { PlayerInfo } from "@glix/engine";
import { createMemo, Show } from "solid-js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { Screen } from "../../ui/Screen.js";
import type { GameScreenProps } from "../registry.js";
import "./kara-borsa.css";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Bid } from "./Bid.js";
import { Reveal } from "./Reveal.js";
import { isBigRound, parseBorsaView } from "./view.js";

/** `tv`: büyük ekran (StageView) yerleşimi: iki sütun, ipucu ve kişisel bilgi hiç yok. */
export default function KaraBorsaScreen(props: GameScreenProps & { tv?: boolean }) {
  const view = createMemo(() => parseBorsaView(props.match.publicView, props.match.view));
  const crew = createMemo<PlayerInfo[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [p] : [];
    }),
  );
  const spectator = () => props.spectator === true || props.tv === true;
  return (
    <Screen class={`kb${props.tv ? " kb--tv" : ""}`}>
      <Show
        when={view()}
        fallback={
          <div class="center-stack">
            <span class="loader" aria-hidden="true" />
          </div>
        }
      >
        {(v) => {
          const title = () => {
            if (v().phase !== "bid") return v().reveal?.winner === null ? "SATILMADI" : "SATILDI!";
            return spectator() ? "Teklifler veriliyor" : "Teklifini ver";
          };
          return (
            <>
              <header class="kb__top">
                <div class="kb__center">
                  <span class="kb__chip" data-big={isBigRound(v()) ? "1" : undefined}>
                    TUR {Math.min(v().round + 1, v().rounds)}/{v().rounds}
                    {isBigRound(v()) ? " · FİNAL" : ""}
                  </span>
                  <span class="kb__title" data-phase={v().phase}>
                    {title()}
                  </span>
                </div>
              </header>
              <PhaseClock
                startedAt={v().stageStartedAt}
                endsAt={v().stageEndsAt}
                urgency={v().phase === "bid"}
              />
              <Show
                when={v().phase === "bid" ? null : v().reveal}
                keyed
                fallback={
                  <Show when={`${v().round}`} keyed>
                    {(_) => (
                      <Bid
                        view={v()}
                        crew={crew()}
                        selfId={props.selfId}
                        spectator={spectator()}
                        now={props.now}
                        tv={props.tv === true}
                      />
                    )}
                  </Show>
                }
              >
                {(result) => (
                  <Reveal
                    view={v()}
                    result={result}
                    crew={crew()}
                    selfId={props.selfId}
                    spectator={spectator()}
                    now={props.now}
                    comment={props.match.comment ?? null}
                    tv={props.tv === true}
                  />
                )}
              </Show>
            </>
          );
        }}
      </Show>
      <Show when={!props.tv}>
        <div class="kb__devam">
          <RevealContinue
            match={props.match}
            selfId={props.selfId}
            now={props.now}
            spectator={props.spectator}
          />
        </div>
      </Show>
    </Screen>
  );
}
