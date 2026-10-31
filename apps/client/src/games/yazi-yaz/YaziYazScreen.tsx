import { createMemo, Show } from "solid-js";
import { createVisibleArea } from "../../ui/keyboardArea.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import type { GameScreenProps } from "../registry.js";
import { Sonuc } from "./Sonuc.js";
import { Tahmin } from "./Tahmin.js";
import { Tartisma } from "./Tartisma.js";
import { TvBoard } from "./TvBoard.js";
import { parseYaziYazView } from "./view.js";
import { Yazma } from "./Yazma.js";
import "./yazi-yaz.css";

export interface Crew {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

/** `tv`: büyük ekran (StageView) yerleşimi; solda konu ve saat, sağda oyuncu halkası; açılış tüm ekranda. */
export default function YaziYazScreen(props: GameScreenProps & { tv?: boolean }) {
  const view = createMemo(() => parseYaziYazView(props.match.publicView, props.match.view));
  const crew = createMemo<Crew[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const area = createVisibleArea();
  const spectator = () => props.spectator === true;
  const tv = () => props.tv === true;

  const bar = () => {
    const v = view();
    if (!v) return { from: 0, to: 1, urgency: false };
    if (v.stage === "reveal") return { from: v.guessEndsAt, to: v.finishAt, urgency: false };
    if (v.stage === "guess") return { from: v.talkEndsAt, to: v.guessEndsAt, urgency: true };
    if (v.stage === "talk") return { from: v.writeEndsAt, to: v.talkEndsAt, urgency: false };
    return { from: v.startedAt, to: v.writeEndsAt, urgency: true };
  };
  const areaStyle = () => {
    const a = area();
    return a.keyboard ? { top: `${a.top}px`, bottom: "auto", height: `${a.height}px` } : undefined;
  };

  return (
    <section
      class="screen game yy"
      data-tight={!tv() && area().keyboard && area().height < 440 ? "1" : undefined}
      data-tv={tv() ? "1" : undefined}
      style={tv() ? undefined : areaStyle()}
    >
      <div class="col">
        <Show when={view()}>
          <PhaseClock startedAt={bar().from} endsAt={bar().to} urgency={bar().urgency} />
        </Show>

        <Show when={view()}>
          {(v) => (
            <Show
              when={v().reveal}
              fallback={
                <Show when={!tv()} fallback={<TvBoard view={v()} crew={crew()} now={props.now} />}>
                  <Show
                    when={v().stage === "write"}
                    fallback={
                      <Show
                        when={v().stage === "talk"}
                        fallback={
                          <Tahmin view={v()} crew={crew()} selfId={props.selfId} spectator={spectator()} />
                        }
                      >
                        <Tartisma
                          view={v()}
                          crew={crew()}
                          selfId={props.selfId}
                          now={props.now}
                          spectator={spectator()}
                        />
                      </Show>
                    }
                  >
                    <Yazma view={v()} crew={crew()} now={props.now} spectator={spectator()} />
                  </Show>
                </Show>
              }
            >
              {(r) => (
                <Sonuc
                  reveal={r()}
                  startAt={v().guessEndsAt}
                  topic={v().topic}
                  crew={crew()}
                  selfId={props.selfId}
                  now={props.now}
                  spectator={spectator()}
                  comment={props.match.comment ?? null}
                />
              )}
            </Show>
          )}
        </Show>
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
