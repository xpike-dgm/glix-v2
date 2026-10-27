import { createMemo, Show } from "solid-js";
import { createVisibleArea } from "../../ui/keyboardArea.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import type { GameScreenProps } from "../registry.js";
import { Eslestirme } from "./Eslestirme.js";
import { Sonuc } from "./Sonuc.js";
import { parseKendimView } from "./view.js";
import { Yazma } from "./Yazma.js";
import "./kendim.css";

export interface Crew {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

export default function KendimScreen(props: GameScreenProps) {
  const view = createMemo(() => parseKendimView(props.match.publicView, props.match.view));
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
    if (!v) return { from: 0, to: 1 };
    if (v.stage === "reveal") return { from: v.matchEndsAt, to: v.finishAt };
    if (v.stage === "match") return { from: v.writeEndsAt, to: v.matchEndsAt };
    return { from: v.startedAt, to: v.writeEndsAt };
  };
  const areaStyle = () => {
    const a = area();
    return a.keyboard ? { top: `${a.top}px`, bottom: "auto", height: `${a.height}px` } : undefined;
  };

  return (
    <section class="screen game kn" data-tight={area().height < 440 ? "1" : undefined} style={areaStyle()}>
      <div class="col">
        <Show when={view()}>
          <PhaseClock startedAt={bar().from} endsAt={bar().to} urgency />
        </Show>

        <Show when={view()}>
          {(v) => (
            <Show
              when={v().reveal}
              fallback={
                <Show
                  when={v().stage === "write"}
                  fallback={
                    <Eslestirme view={v()} crew={crew()} selfId={props.selfId} spectator={spectator()} />
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
