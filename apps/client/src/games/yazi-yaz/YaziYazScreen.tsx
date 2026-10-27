import { createMemo, Show } from "solid-js";
import { createVisibleArea } from "../../ui/keyboardArea.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import type { GameScreenProps } from "../registry.js";
import { Sonuc } from "./Sonuc.js";
import { Tahmin } from "./Tahmin.js";
import { Tartisma } from "./Tartisma.js";
import { parseYaziYazView } from "./view.js";
import { Yazma } from "./Yazma.js";
import "./yazi-yaz.css";

export interface Crew {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

export default function YaziYazScreen(props: GameScreenProps) {
  const view = createMemo(() => parseYaziYazView(props.match.publicView, props.match.view));
  const crew = createMemo<Crew[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const area = createVisibleArea();
  const spectator = () => props.spectator === true;

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
    <section class="screen game yy" data-tight={area().height < 440 ? "1" : undefined} style={areaStyle()}>
      <div class="col">
        <Show when={view()}>
          <PhaseClock startedAt={bar().from} endsAt={bar().to} urgency={bar().urgency} />
        </Show>

        <Show when={view()}>
          {(v) => (
            <Show
              when={v().reveal}
              fallback={
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
                  <Yazma view={v()} crew={crew()} spectator={spectator()} />
                </Show>
              }
            >
              {(r) => <Sonuc reveal={r()} crew={crew()} selfId={props.selfId} spectator={spectator()} />}
            </Show>
          )}
        </Show>
      </div>
    </section>
  );
}
