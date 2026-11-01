import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { TvFit } from "../../stage/TvParts.js";
import { worldAllowed, worldSrc } from "../../ui/world.js";
import type { GameScreenProps } from "../registry.js";
import { Core, type CoreState } from "./Core.js";
import { Outro } from "./Outro.js";
import { Table } from "./Table.js";
import "./gizli-hirsiz.css";
import { decidedLine, outroStep, parseGizliHirsizView, revealHeadline, seatArc, signalText } from "./view.js";

const W = 1600;
const H = 800;

/**
 * Gizli Hırsız, büyük ekran (GH-U13). Yalnız herkese açık görünüm: ortada büyük kasa ve lazerler, çevresinde oyuncular
 * (ad ve karar kilidi), üstte büyük süre; açılış (GH-U5) ve zaman şeridi (GH-U6) tam ekran.
 */
export default function GizliHirsizStageView(props: GameScreenProps) {
  const view = createMemo(() => parseGizliHirsizView(props.match.publicView, { choice: null }));
  const [clock, setClock] = createSignal(props.now());
  const timer = setInterval(() => setClock(props.now()), 100);
  onCleanup(() => clearInterval(timer));

  const playerOf = (id: string) => props.players.find((p) => p.id === id);
  const nick = (id: string): string => playerOf(id)?.nickname ?? "Oyuncu";
  const seats = createMemo(() => seatArc(props.match.participants, ""));
  const over = () => {
    const v = view();
    return !v || v.finished || clock() >= v.endsAt;
  };
  const secsLeft = () => {
    const v = view();
    return v ? Math.max(0, Math.ceil((v.endsAt - clock()) / 1000)) : 0;
  };
  const outro = () => {
    const v = view();
    if (!v?.reveal || clock() < v.endsAt) return null;
    return { reveal: v.reveal, elapsed: clock() - v.endsAt };
  };
  const step = () => {
    const o = outro();
    return o ? outroStep(o.elapsed, o.reveal.thieves.length) : null;
  };
  const coreState = (): CoreState => {
    const o = outro();
    return o && step() === "stamp" ? o.reveal.outcome : "idle";
  };
  const head = () => {
    const o = outro();
    if (o && step() === "stamp") return revealHeadline(o.reveal);
    if (over()) return "Süre doldu! Kasa açılıyor…";
    return "Kim çalacak?";
  };

  const bg = worldAllowed() ? worldSrc("gizli-hirsiz", "landscape") : null;

  return (
    <TvFit w={W} h={H}>
      <div
        class="ghtv"
        data-phase={outro() ? "outro" : "deciding"}
        data-step={step() ?? undefined}
        data-outcome={step() === "stamp" ? outro()?.reveal.outcome : undefined}
        data-urgent={!over() && secsLeft() <= 5 ? "1" : undefined}
      >
        <Show when={bg}>{(src) => <img class="ghtv__bg" src={src()} alt="" aria-hidden="true" />}</Show>
        <i class="gh__lasers" aria-hidden="true" />
        <Show when={view()}>
          {(v) => (
            <>
              <aside class="ghtv__left">
                <h2 class="ghtv__head">{head()}</h2>
                <Show when={!over()}>
                  <p class="ghtv__time">{secsLeft()}</p>
                  <p class="ghtv__sub">{decidedLine(v().decided.length, props.match.participants.length)}</p>
                  <Show when={v().signal}>
                    {(s) => (
                      <p class="gh__signal ghtv__signal" data-signal={s()}>
                        {signalText(s())}
                      </p>
                    )}
                  </Show>
                </Show>
              </aside>
              <div class="ghtv__stage">
                <div class="gh__ring ghtv__ring">
                  <Core
                    state={coreState()}
                    opening={step() === "stamp"}
                    urgent={!over() && secsLeft() <= 5}
                  />
                </div>
                <Table
                  class="ghtv__table"
                  seats={seats()}
                  decided={v().decided}
                  playerOf={playerOf}
                  label={nick}
                  locks={!over()}
                />
              </div>
              <aside class="ghtv__right">
                <Show when={outro()}>
                  {(o) => (
                    <Outro
                      class="ghtv__outro"
                      reveal={o().reveal}
                      elapsed={o().elapsed}
                      signal={v().signal}
                      playerOf={playerOf}
                      nameOf={nick}
                      avatar="72px"
                    />
                  )}
                </Show>
              </aside>
            </>
          )}
        </Show>
      </div>
    </TvFit>
  );
}
