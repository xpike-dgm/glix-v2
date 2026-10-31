import { createMemo, Show } from "solid-js";
import { createVisibleArea } from "../../ui/keyboardArea.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
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

/** `tv`: büyük ekran (StageView, KN-U7) yerleşimi; dokunma yok, açılış tüm ekranda. */
export default function KendimScreen(props: GameScreenProps & { tv?: boolean }) {
  const view = createMemo(() => parseKendimView(props.match.publicView, props.match.view));
  const crew = createMemo<Crew[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const area = createVisibleArea();
  const tv = () => props.tv === true;
  const spectator = () => props.spectator === true || tv();

  // KN-U3: son saniyelerde kırmızı nabız, tik ve titreşim yalnız Tamam dememiş oyuncuya.
  const bar = () => {
    const v = view();
    if (!v) return { from: 0, to: 1, urgency: false };
    const urgency = !spectator() && !v.locked;
    if (v.stage === "reveal") return { from: v.matchEndsAt, to: v.finishAt, urgency: false };
    if (v.stage === "match") return { from: v.writeEndsAt, to: v.matchEndsAt, urgency };
    return { from: v.startedAt, to: v.writeEndsAt, urgency };
  };
  const areaStyle = () => {
    const a = area();
    return a.keyboard ? { top: `${a.top}px`, bottom: "auto", height: `${a.height}px` } : undefined;
  };

  return (
    <section
      class="screen game kn"
      data-tight={!tv() && area().height < 440 ? "1" : undefined}
      data-kb={!tv() && area().keyboard ? "1" : undefined}
      data-tv={tv() ? "1" : undefined}
      data-stage={view()?.stage}
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
                <Show
                  when={v().stage === "write"}
                  fallback={
                    <Eslestirme
                      view={v()}
                      crew={crew()}
                      selfId={props.selfId}
                      spectator={spectator()}
                      tv={tv()}
                    />
                  }
                >
                  <Yazma view={v()} crew={crew()} spectator={spectator()} tv={tv()} />
                </Show>
              }
            >
              {(r) => (
                <Sonuc
                  reveal={r()}
                  startAt={v().matchEndsAt}
                  topic={v().topic}
                  crew={crew()}
                  selfId={props.selfId}
                  now={props.now}
                  spectator={spectator()}
                  tv={tv()}
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
