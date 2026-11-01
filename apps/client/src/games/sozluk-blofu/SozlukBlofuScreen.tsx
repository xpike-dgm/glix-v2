import { createEffect, createMemo, type JSX, on, Show } from "solid-js";
import { hapticGo } from "../../fx/haptics.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import type { GameScreenProps } from "../registry.js";
import { Pick } from "./Pick.js";
import "./sozluk.css";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { clearDrafts } from "./draft.js";
import { Sonuc } from "./Sonuc.js";
import { shuffleSound } from "./sounds.js";
import { TvBoard } from "./TvBoard.js";
import { type CrewMember, parseSozlukView } from "./view.js";
import { createVisibleArea } from "./visibleArea.js";
import { Write } from "./Write.js";

/** Ekran klavyesi açıkken görünen alan bu yüksekliğin altına inerse düzen sıkışık kipine geçer. */
const TIGHT_HEIGHT = 440;

/** `tv`: büyük ekran (StageView, SB-U12) yerleşimi; kişisel bilgi hiç yoktur. */
export default function SozlukBlofuScreen(props: GameScreenProps & { tv?: boolean }) {
  const view = createMemo(() => parseSozlukView(props.match.publicView, props.match.view));
  const crew = createMemo<CrewMember[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const spectator = () => props.spectator === true;
  const tv = () => props.tv === true;
  const phase = () => view()?.phase ?? "write";
  const area = createVisibleArea();
  const tight = () => !tv() && area().height < TIGHT_HEIGHT;
  const areaStyle = (): JSX.CSSProperties | undefined => {
    const a = area();
    return !tv() && a.keyboard ? { top: `${a.top}px`, bottom: "auto", height: `${a.height}px` } : undefined;
  };

  // Yazmadan seçmeye geçişte deste karıştırma sesi; taslak silinir (SB-U11).
  createEffect(
    on(phase, (now, before) => {
      if (now !== "write") clearDrafts();
      if (before === "write" && now === "pick") {
        shuffleSound();
        hapticGo();
      }
    }),
  );

  // Ekran okuyucuya aşama değişiminde tek cümle (SB-U18).
  const announce = () => {
    const v = view();
    if (v?.phase !== "pick") return "";
    return `Seçim başladı, ${v.cards?.length ?? 0} kart`;
  };

  const bar = () => {
    const v = view();
    if (!v) return null;
    if (v.phase === "reveal") return { from: v.pickEndsAt, to: v.finishAt, urgency: false };
    if (v.phase === "pick") return { from: v.writeEndsAt, to: v.pickEndsAt, urgency: true };
    return { from: v.startedAt, to: v.writeEndsAt, urgency: true };
  };

  return (
    <section
      class="screen game sb"
      data-tight={tight() ? "1" : undefined}
      data-tv={tv() ? "1" : undefined}
      style={areaStyle()}
    >
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
                <Show when={!tv()} fallback={<TvBoard view={v()} crew={crew()} now={props.now} />}>
                  <Show
                    when={v().phase === "pick"}
                    fallback={<Write view={v()} crew={crew()} spectator={spectator()} now={props.now} />}
                  >
                    <Pick view={v()} crew={crew()} spectator={spectator()} />
                  </Show>
                </Show>
              }
            >
              <Sonuc
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={spectator()}
                now={props.now}
                tv={tv()}
              />
            </Show>
          )}
        </Show>
        <p class="sr-only" aria-live="polite">
          {announce()}
        </p>
        <Show when={!tv()}>
          <RevealContinue
            match={props.match}
            selfId={props.selfId}
            now={props.now}
            spectator={props.spectator}
          />
        </Show>
      </div>
    </section>
  );
}
