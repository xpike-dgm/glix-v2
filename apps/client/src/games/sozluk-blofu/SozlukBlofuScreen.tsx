import { createEffect, createMemo, type JSX, on, Show } from "solid-js";
import { hapticGo } from "../../fx/haptics.js";
import { go } from "../../fx/sound.js";
import { serverNow } from "../../net/store.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import type { GameScreenProps } from "../registry.js";
import { Pick } from "./Pick.js";
import "./sozluk.css";
import { Sonuc } from "./Sonuc.js";
import { type CrewMember, parseSozlukView } from "./view.js";
import { createVisibleArea } from "./visibleArea.js";
import { Write } from "./Write.js";

/** Ekran klavyesi açıkken görünen alan bu yüksekliğin altına inerse düzen sıkışık kipine geçer. */
const TIGHT_HEIGHT = 440;

export default function SozlukBlofuScreen(props: GameScreenProps) {
  const view = createMemo(() => parseSozlukView(props.match.publicView, props.match.view));
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

  // Yazmadan seçmeye geçişte kısa "başla" tepkisi.
  createEffect(
    on(phase, (now, before) => {
      if (before === "write" && now === "pick") {
        go();
        hapticGo();
      }
    }),
  );

  const bar = () => {
    const v = view();
    if (!v) return null;
    if (v.phase === "reveal") return { from: v.pickEndsAt, to: v.finishAt, urgency: false };
    if (v.phase === "pick") return { from: v.writeEndsAt, to: v.pickEndsAt, urgency: true };
    return { from: v.startedAt, to: v.writeEndsAt, urgency: true };
  };

  return (
    <section class="screen game sb" data-tight={tight() ? "1" : undefined} style={areaStyle()}>
      <div class="col">
        <Show when={bar()}>
          {(b) => <PhaseClock startedAt={b().from} endsAt={b().to} urgency={b().urgency} />}
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
            <Show
              when={v().reveal}
              fallback={
                <Show
                  when={v().phase === "pick"}
                  fallback={<Write view={v()} crew={crew()} spectator={spectator()} />}
                >
                  <Pick view={v()} crew={crew()} spectator={spectator()} />
                </Show>
              }
            >
              <Sonuc view={v()} crew={crew()} selfId={props.selfId} spectator={spectator()} />
            </Show>
          )}
        </Show>
      </div>
    </section>
  );
}
