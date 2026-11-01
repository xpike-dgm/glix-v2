import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { TvFit } from "../../stage/TvParts.js";
import { Avatar } from "../../ui/Avatar.js";
import { BlastArt, BombArt } from "../../ui/BombArt.js";
import { worldAllowed, worldSrc } from "../../ui/world.js";
import type { GameScreenProps } from "../registry.js";
import { BombBadge, PlugIcon } from "./icons.js";
import { bildiFor, HandChain, JourneyPanel } from "./parts.js";
import { boom } from "./sounds.js";
import { blastText, bombSpot, handChip, parseKorBombaView, seatPositions } from "./view.js";
import "./kor-bomba.css";

const W = 1600;
const H = 700;
/** Patlama gösterisinden sonra yolculuk şeridi açılır (telefonla aynı). */
const TRIP_DELAY_MS = 2_000;

/**
 * Kör Bomba, büyük ekran (BM-U11). TV'yi taşıyıcı da gördüğü için süre, bahis ve kıvılcım yoktur; yalnız herkese
 * açık görünüm kullanılır. Büyük elips masa, 120 px koltuklar, üstte el çipi ve pas zinciri, taşıyıcının koltuğunda
 * zamandan bağımsız halka ve "KİM TUTACAK?". Patlama tam ekran (şok dalgası), ardından yolculuk şeridi.
 */
export default function KorBombaStageView(props: GameScreenProps) {
  const view = createMemo(() => parseKorBombaView(props.match.publicView, { role: "spectator" }));
  const seats = createMemo(() => seatPositions(props.match.participants, ""));
  const n = () => props.match.participants.length;
  const playerOf = (id: string) => props.players.find((p) => p.id === id);
  const nameOf = (id: string): string => playerOf(id)?.nickname ?? "Oyuncu";
  const holder = () => view()?.pub.holder ?? "";
  const seatOf = (id: string) => seats().find((s) => s.id === id);
  const spot = () => bombSpot(seatOf(holder()), n());
  const exploded = () => view()?.pub.exploded ?? false;
  const trip = () => {
    const v = view();
    const at = v?.pub.explodedAt;
    return at !== null && at !== undefined && props.now() >= at + TRIP_DELAY_MS ? v?.pub.journey : null;
  };
  const [fresh, setFresh] = createSignal(false);
  let first = true;
  createEffect(
    on(exploded, (now) => {
      const initial = first;
      first = false;
      if (!now || initial) return;
      setFresh(true);
      boom();
    }),
  );
  const bg = worldAllowed() ? worldSrc("kor-bomba", "landscape") : null;

  return (
    <TvFit w={W} h={H}>
      <div class="kbotv" data-blast={exploded() ? "1" : undefined} data-fresh={fresh() ? "1" : undefined}>
        <Show when={bg}>{(src) => <img class="kbotv__bg" src={src()} alt="" aria-hidden="true" />}</Show>
        <div class="kbotv__scrim" aria-hidden="true" />
        <Show when={view()}>
          {(v) => (
            <>
              <div class="kbotv__felt" aria-hidden="true" />
              <svg class="kbotv__cables" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <title>Kablolar</title>
                <For each={seats()}>
                  {(s) => (
                    <line
                      class="kbo__cable"
                      classList={{ "kbo__cable--holder": holder() === s.id }}
                      x1="50"
                      y1="50"
                      x2={50 + (s.x - 50) * 0.8}
                      y2={50 + (s.y - 50) * 0.8}
                      vector-effect="non-scaling-stroke"
                    />
                  )}
                </For>
              </svg>
              <For each={seats()}>
                {(s) => {
                  const p = () => playerOf(s.id);
                  const isHolder = () => holder() === s.id;
                  const won = () => exploded() && v().pub.correctPredictors.includes(s.id);
                  return (
                    <div
                      class="kbotv__seat"
                      data-holder={isHolder() && !exploded() ? "1" : undefined}
                      data-white={isHolder() && exploded() ? "1" : undefined}
                      data-off={p()?.connected === false ? "1" : undefined}
                      style={{ left: `${s.x}%`, top: `${s.y}%` }}
                    >
                      <span class="kbo__av">
                        <Avatar
                          index={p()?.avatar ?? 0}
                          size={120}
                          connected={p()?.connected ?? true}
                          ring={isHolder() && !exploded() ? "#FF3B5C" : undefined}
                        />
                        <Show when={isHolder() && !exploded()}>
                          <span class="kbo__badge kbo__badge--bomb">
                            <BombBadge />
                          </span>
                        </Show>
                        <Show when={p()?.connected === false}>
                          <span class="kbo__badge kbo__badge--off">
                            <PlugIcon />
                          </span>
                        </Show>
                        <Show when={won()}>
                          <span class="kbo__badge kbo__badge--win">✓ +1</span>
                        </Show>
                      </span>
                      <span class="kbotv__name">{p()?.nickname ?? ""}</span>
                    </div>
                  );
                }}
              </For>
              <Show
                when={!exploded()}
                fallback={
                  <div class="kbotv__blast" style={{ left: `${spot().x}%`, top: `${spot().y}%` }}>
                    <span class="kbo__wave" />
                    <BlastArt />
                  </div>
                }
              >
                <div class="kbotv__bomb" style={{ left: `${spot().x}%`, top: `${spot().y}%` }}>
                  <BombArt />
                </div>
              </Show>
              <div class="kbotv__top">
                <HandChain
                  chip={handChip(v().pub.passes, nameOf(holder()))}
                  trail={v().pub.trail}
                  playerOf={playerOf}
                  size="52px"
                  class="kbotv__chain"
                />
                <Show when={!exploded()}>
                  <p class="kbotv__who">KİM TUTACAK?</p>
                </Show>
              </div>
              <Show when={!exploded() && playerOf(holder())?.connected === false}>
                <p class="kbotv__band">{nameOf(holder())} koptu — bomba onda!</p>
              </Show>
              <Show when={exploded() && !trip()}>
                <div class="kbotv__boom">
                  <p class="kbotv__boomtag">{blastText(nameOf(holder()), false)}</p>
                  <Show when={bildiFor(v().pub.correctPredictors, playerOf, "")}>
                    {(t) => <p class="kbotv__bildi">{t()}</p>}
                  </Show>
                </div>
              </Show>
              <Show when={trip()}>
                {(j) => (
                  <div class="kbotv__trip">
                    <JourneyPanel
                      journey={j()}
                      winners={v().pub.correctPredictors}
                      playerOf={playerOf}
                      selfId=""
                      avatar="72px"
                      class="kbotv__journey"
                    />
                  </div>
                )}
              </Show>
            </>
          )}
        </Show>
      </div>
    </TvFit>
  );
}
