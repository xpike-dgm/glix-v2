// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import type { PlayerInfo } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { CheckIcon } from "../../ui/Icons.js";
import type { GameScreenProps } from "../registry.js";
import "./karalama.css";
import "./stage-view.css";
import { Acilis } from "./Acilis.js";
import { DrawingCanvas } from "./DrawingCanvas.js";
import { wallLayout } from "./VoteWall.js";
import { isRevealPhase, parseKaralamaPublicView } from "./view.js";

const secsLeft = (endsAt: number, now: number): number => Math.max(0, Math.ceil((endsAt - now) / 1000));

/**
 * Karalama Defteri, büyük ekran (KD-U10): çizim sürerken her avatarda hareketli kalem (bitiren kalemi bırakır),
 * oylamada herkesin çizimi dev bir duvarda (çizimler kendini baştan çizer), oylama bitince açılış tam ekran (ışık
 * izleri, maske, damga), son şansta ortada bilgisiz ve geri sayım. Yalnız herkese açık görünüm kullanılır; kelimeler,
 * bilgisiz ve çizimler oylamadan önce hiç gösterilmez.
 */
export default function KaralamaStageView(props: GameScreenProps) {
  const view = createMemo(() => parseKaralamaPublicView(props.match.publicView));
  const crew = createMemo(() =>
    (view()?.players ?? [])
      .map((id) => props.players.find((p) => p.id === id))
      .filter((p): p is PlayerInfo => p !== undefined),
  );
  let wall: HTMLDivElement | undefined;
  const [size, setSize] = createSignal({ w: 0, h: 0 });
  onMount(() => {
    if (!wall) return;
    const read = (): void => {
      setSize({ w: wall?.clientWidth ?? 0, h: wall?.clientHeight ?? 0 });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(wall);
    onCleanup(() => ro.disconnect());
  });
  const layout = () => wallLayout(crew().length, size().w, size().h);
  return (
    <Show when={view()}>
      {(v) => (
        <div class="kdtv">
          <Show
            when={!isRevealPhase(v().phase) ? v() : null}
            fallback={
              <Show when={v().reveal}>
                {(r) => (
                  <Acilis
                    phase={v().phase as "unmask" | "guess" | "done"}
                    reveal={r()}
                    players={v().players}
                    drawings={v().drawings}
                    crew={crew()}
                    selfId=""
                    me={false}
                    myWord={null}
                    tv
                    now={props.now}
                  />
                )}
              </Show>
            }
          >
            <Show
              when={v().phase === "draw"}
              fallback={
                <>
                  <div class="kdtv__bar">
                    <h2 class="kdtv__title">Kelimeyi bilmeyen kim?</h2>
                    <p class="kdtv__count" role="timer">
                      <span>
                        {v().voted.length} / {crew().length} oy · {secsLeft(v().voteEndsAt, props.now())} sn
                      </span>
                    </p>
                  </div>
                  <div
                    class="kdtv__wall"
                    ref={wall}
                    style={{
                      "--cols": layout().cols,
                      "--cell": `${layout().cell}px`,
                      visibility: layout().cell > 0 ? "visible" : "hidden",
                    }}
                  >
                    <For each={crew()}>
                      {(p) => {
                        const d = () => v().drawings?.[p.id];
                        return (
                          <div class="kdtv__card">
                            <div class="kdtv__frame">
                              <DrawingCanvas
                                strokes={d()?.strokes ?? []}
                                version={d()?.key ?? "0"}
                                replay={1}
                              />
                            </div>
                            <div class="kdtv__name">
                              <Avatar index={p.avatar} size={44} connected={p.connected} />
                              <span class="kdtv__nick">{p.nickname}</span>
                              <Show when={v().voted.includes(p.id)}>
                                <span class="kdtv__done" role="img" aria-label="Oy verdi">
                                  <CheckIcon size={26} />
                                </span>
                              </Show>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </>
              }
            >
              <div class="kdtv__draw">
                <h2 class="kdtv__title">Çiziyorlar…</h2>
                <p class="kdtv__count" role="timer">
                  {secsLeft(v().drawEndsAt, props.now())} sn · {v().drawDoneIds.length} / {crew().length}{" "}
                  bitirdi
                </p>
                <div class="kdtv__crew">
                  <For each={crew()}>
                    {(p) => (
                      <div class="kdtv__who" data-done={v().drawDoneIds.includes(p.id) ? "1" : undefined}>
                        <span class="kdtv__avatar">
                          <Avatar
                            index={p.avatar}
                            size={132}
                            connected={p.connected}
                            ready={v().drawDoneIds.includes(p.id)}
                            live={v().drawDoneIds.includes(p.id) ? undefined : "think"}
                          />
                          <svg class="kdtv__pen" viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M34 6l8 8-22 22-10 2 2-10z" />
                            <path d="M30 10l8 8" />
                          </svg>
                        </span>
                        <span class="kdtv__nick">{p.nickname}</span>
                      </div>
                    )}
                  </For>
                </div>
                <p class="kdtv__hint">Çizimler oylamada hep birlikte açılacak.</p>
              </div>
            </Show>
          </Show>
        </div>
      )}
    </Show>
  );
}
