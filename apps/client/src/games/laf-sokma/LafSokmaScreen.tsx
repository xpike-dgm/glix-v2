import { createEffect, createMemo, createSignal, type JSX, on, onCleanup, Show } from "solid-js";
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

/** `tv`: büyük ekran (StageView) yerleşimi; kartlar yan yana, damga ve konfeti tüm ekranda. */
export default function LafSokmaScreen(props: GameScreenProps & { tv?: boolean }) {
  const view = createMemo(() => parseLafView(props.match.publicView, props.match.view));
  const crew = createMemo<CrewMember[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const spectator = () => props.spectator === true;
  // Açılış zaman çizelgesi sunucu saatiyle ilerler (her cihazda ve TV'de aynı anda).
  const [clock, setClock] = createSignal(props.now());
  const timer = setInterval(() => setClock(props.now()), 80);
  onCleanup(() => clearInterval(timer));
  const phase = () => view()?.phase ?? "write";
  const area = createVisibleArea();
  // Klavye açıkken her zaman sıkışık düzen: cevap alanı ve düğme klavyenin üstünde kalsın.
  const tight = () => area().keyboard || area().height < TIGHT_HEIGHT;
  let section: HTMLElement | undefined;
  // Klavye açıkken ekranın altı görünen alanın altına (klavyenin hemen üstüne) oturur. Ekran kabuk başlığının
  // altında başladığından konum, kabın görünen alana göre yerinden hesaplanır (iOS Safari'de sayfa kayabilir).
  const areaStyle = (): JSX.CSSProperties | undefined => {
    const a = area();
    if (!a.keyboard) return undefined;
    const parentTop = section?.offsetParent?.getBoundingClientRect().top ?? 0;
    const top = Math.max(0, a.top - parentTop);
    const height = Math.max(160, a.top + a.height - parentTop - top);
    return { top: `${top}px`, bottom: "auto", height: `${height}px` };
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
    <section
      ref={section}
      class="screen game lf"
      data-tight={tight() && props.tv !== true ? "1" : undefined}
      data-tv={props.tv ? "1" : undefined}
      data-phase={phase()}
      style={props.tv ? undefined : areaStyle()}
    >
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
                    <Write view={v()} crew={crew()} selfId={props.selfId} spectator={spectator()} />
                  </Show>
                  <Show when={v().phase === "vote" || v().phase === "finalVote"}>
                    <Vote view={v()} crew={crew()} selfId={props.selfId} spectator={spectator()} />
                  </Show>
                  <Show when={v().phase === "reveal" || v().phase === "finalReveal"}>
                    <Reveal
                      view={v()}
                      crew={crew()}
                      selfId={props.selfId}
                      spectator={spectator()}
                      clock={clock}
                      tv={props.tv === true}
                    />
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
