import type { PlayerInfo } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { CheckIcon } from "../../ui/Icons.js";
import type { GameScreenProps } from "../registry.js";
import "./karalama.css";
import "./stage-view.css";
import { DrawingCanvas } from "./DrawingCanvas.js";
import { wallLayout } from "./VoteWall.js";
import { parseKaralamaPublicView } from "./view.js";

const secsLeft = (endsAt: number, now: number): number => Math.max(0, Math.ceil((endsAt - now) / 1000));

/**
 * Karalama Defteri, büyük ekran: çizim sürerken kimin bitirdiği, oylamada herkesin çizimi dev bir duvarda
 * (çizimler kendini baştan çizer), oy sayıları ve kapanışta "kelimeyi bilmeyen" görünür.
 * Yalnız herkese açık görünüm kullanılır; kelime hiçbir zaman gösterilmez.
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
            when={v().phase === "draw"}
            fallback={
              <>
                <div class="kdtv__bar">
                  <h2 class="kdtv__title">
                    {v().reveal
                      ? v().reveal?.caught
                        ? "Yakalandı!"
                        : "Kurtuldu!"
                      : "Kelimeyi bilmeyen kim?"}
                  </h2>
                  <p class="kdtv__count" role="timer">
                    <Show when={v().phase === "vote"} fallback={<span>Oylama bitti</span>}>
                      <span>
                        {v().voted.length} / {crew().length} oy · {secsLeft(v().voteEndsAt, props.now())} sn
                      </span>
                    </Show>
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
                      const votes = () => v().reveal?.tally[p.id];
                      const outsider = () => v().reveal?.outsider === p.id;
                      return (
                        <div class="kdtv__card" data-outsider={outsider() ? "1" : undefined}>
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
                            <Show when={outsider()}>
                              <span class="kdtv__mask">Bilgisiz</span>
                            </Show>
                            <Show when={votes() !== undefined}>
                              <span class="kdtv__votes">{votes()} oy</span>
                            </Show>
                            <Show when={votes() === undefined && v().voted.includes(p.id)}>
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
                <Show when={v().reveal}>
                  {(r) => (
                    <p class="kdtv__words">
                      Ortak kelime <b>{r().mainWord}</b> · bilgisizin kelimesi <b>{r().nearWord}</b>
                    </p>
                  )}
                </Show>
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
                      <Avatar
                        index={p.avatar}
                        size={132}
                        connected={p.connected}
                        ready={v().drawDoneIds.includes(p.id)}
                        live={v().drawDoneIds.includes(p.id) ? undefined : "think"}
                      />
                      <span class="kdtv__nick">{p.nickname}</span>
                    </div>
                  )}
                </For>
              </div>
              <p class="kdtv__hint">Çizimler oylamada hep birlikte açılacak.</p>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
}
