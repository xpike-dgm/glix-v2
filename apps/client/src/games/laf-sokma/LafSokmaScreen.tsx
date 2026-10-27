import { createEffect, createMemo, type JSX, on, Show } from "solid-js";
import { hapticGo } from "../../fx/haptics.js";
import { go } from "../../fx/sound.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import type { GameScreenProps } from "../registry.js";
import "./laf.css";
import { Reveal } from "./Reveal.js";
import { Vote } from "./Vote.js";
import { type CrewMember, parseLafView } from "./view.js";
import { createVisibleArea } from "./visibleArea.js";
import { Write } from "./Write.js";

/** Ekran klavyesi açıkken görünen alan bu yüksekliğin altına inerse düzen sıkışık kipine geçer. */
const TIGHT_HEIGHT = 440;

export default function LafSokmaScreen(props: GameScreenProps) {
  const view = createMemo(() => parseLafView(props.match.publicView, props.match.view));
  const crew = createMemo<CrewMember[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const spectator = () => props.spectator === true;
  const phase = () => view()?.phase ?? "write";
  const area = createVisibleArea();
  const tight = () => area().height < TIGHT_HEIGHT;
  const areaStyle = (): JSX.CSSProperties | undefined => {
    const a = area();
    return a.keyboard ? { top: `${a.top}px`, bottom: "auto", height: `${a.height}px` } : undefined;
  };

  // Oylamaya ve finale geçişte kısa "başla" tepkisi.
  createEffect(
    on(phase, (now, before) => {
      if (before === undefined) return;
      if (now === "vote" || now === "finalWrite") {
        go();
        hapticGo();
      }
    }),
  );

  return (
    <section class="screen game lf" data-tight={tight() ? "1" : undefined} style={areaStyle()}>
      <div class="col">
        <Show when={view()}>
          {(v) => (
            <PhaseClock
              startedAt={v().stageStartedAt}
              endsAt={v().stageEndsAt}
              urgency={
                v().phase === "write" ||
                v().phase === "finalWrite" ||
                v().phase === "vote" ||
                v().phase === "finalVote"
              }
            />
          )}
        </Show>

        <Show
          when={view()}
          fallback={
            <div class="center-stack">
              <span class="loader" aria-hidden="true" />
            </div>
          }
        >
          {(v) => (
            <Show when={`${v().phase}:${v().index ?? ""}`} keyed>
              {(_stage) => (
                <>
                  <Show when={v().phase === "write" || v().phase === "finalWrite"}>
                    <Write view={v()} crew={crew()} spectator={spectator()} />
                  </Show>
                  <Show when={v().phase === "vote" || v().phase === "finalVote"}>
                    <Vote view={v()} crew={crew()} selfId={props.selfId} spectator={spectator()} />
                  </Show>
                  <Show when={v().phase === "reveal" || v().phase === "finalReveal"}>
                    <Reveal view={v()} crew={crew()} selfId={props.selfId} spectator={spectator()} />
                  </Show>
                </>
              )}
            </Show>
          )}
        </Show>
      </div>
    </section>
  );
}
