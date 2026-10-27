import { createMemo, Show } from "solid-js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import type { GameScreenProps } from "../registry.js";
import { Oyun } from "./Oyun.js";
import { Sonuc } from "./Sonuc.js";
import { parseKontrolView } from "./view.js";
import "./kontrol.css";

export interface Crew {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

export default function KontrolScreen(props: GameScreenProps) {
  const view = createMemo(() => parseKontrolView(props.match.publicView, props.match.view));
  const crew = createMemo<Crew[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const bar = () => {
    const v = view();
    if (!v) return { from: 0, to: 1, urgency: false };
    if (v.stage === "reveal") return { from: v.endsAt, to: v.finishAt, urgency: false };
    return { from: v.startedAt, to: v.endsAt, urgency: true };
  };
  return (
    <section class="screen game kp">
      <div class="col">
        <Show when={view()}>
          <PhaseClock startedAt={bar().from} endsAt={bar().to} urgency={bar().urgency} />
        </Show>

        <Show when={view()}>
          {(v) => (
            <Show
              when={v().reveal}
              fallback={<Oyun view={v()} total={crew().length} spectator={props.spectator === true} />}
            >
              {(r) => (
                <Sonuc
                  reveal={r()}
                  crew={crew()}
                  selfId={props.selfId}
                  spectator={props.spectator === true}
                />
              )}
            </Show>
          )}
        </Show>
      </div>
    </section>
  );
}
