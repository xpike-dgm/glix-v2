import type { PlayerInfo } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import "../karalama-defteri/karalama.css";
import "./bozuk-telefon.css";
import { ChainLock } from "./ChainLock.js";

import { StepCard } from "./StepCard.js";
import { cellLayout, robustPair } from "./story.js";
import { parseBozukPublicView } from "./view.js";

const secsLeft = (endsAt: number, now: number): number => Math.max(0, Math.ceil((endsAt - now) / 1000));

/**
 * Bozuk Telefon, büyük ekran (BT-U9): gösteride tam ekran hikâye (yeni adım büyük, çizimler yeniden çizilerek;
 * önceki adımlar solda iz olarak), oylamada tüm kartlar ızgarada ve oy sayacı, sonuçta taç, 😂 yığını, yazarlar ve
 * sağlam zincir halkası. Yalnız herkese açık görünüm kullanılır (yazarlar sonuca kadar yok).
 */
export default function BozukStageView(props: GameScreenProps) {
  const view = createMemo(() => parseBozukPublicView(props.match.publicView));
  const person = (id: string | null): PlayerInfo | undefined =>
    id === null ? undefined : props.players.find((p) => p.id === id);
  const crew = createMemo(() =>
    (view()?.players ?? []).map((id) => person(id)).filter((p): p is PlayerInfo => p !== undefined),
  );
  let grid: HTMLDivElement | undefined;
  const [size, setSize] = createSignal({ w: 0, h: 0 });
  const observe = (el: HTMLDivElement): void => {
    grid = el;
    const read = (): void => {
      setSize({ w: grid?.clientWidth ?? 0, h: grid?.clientHeight ?? 0 });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  };

  return (
    <Show when={view()}>
      {(v) => (
        <div class="bttv">
          <Show
            when={v().reveal}
            fallback={
              <div class="bttv__input">
                <p class="bttv__chip">
                  ADIM {v().step + 1}/{v().steps}
                </p>
                <h2 class="bttv__title">
                  {v().phase === "draw" ? "Arkadaşların çiziyor" : "Arkadaşların yazıyor"}
                </h2>
                <div class="bttv__crew">
                  <For each={crew()}>
                    {(p) => (
                      <span class="bttv__member" data-done={v().doneIds.includes(p.id) ? "1" : undefined}>
                        <Avatar
                          index={p.avatar}
                          size={96}
                          connected={p.connected}
                          ready={v().doneIds.includes(p.id)}
                        />
                        <span>{p.nickname}</span>
                      </span>
                    )}
                  </For>
                </div>
              </div>
            }
          >
            {(rv) => {
              const r = rv;
              const result = () => r().stage === "result";
              const layout = () => cellLayout(r().steps.length, size().w, size().h);
              const pair = () => (result() && r().robust ? robustPair(r().steps) : null);
              return (
                <>
                  <div class="bttv__bar">
                    <p class="bttv__chip">
                      ZİNCİR {r().chain + 1}/{r().chains}
                    </p>
                    <h2 class="bttv__title">
                      {r().stage === "show"
                        ? "Zincir açılıyor"
                        : r().stage === "vote"
                          ? "En komik hangisi?"
                          : (r().crowned ?? []).length > 0
                            ? "En komik seçildi"
                            : "Kimse oy vermedi"}
                    </h2>
                    <p class="bttv__count" role="timer">
                      <Show
                        when={r().stage === "vote"}
                        fallback={
                          <Show when={result() ? person(r().starter) : undefined}>
                            {(p) => (
                              <span class="bttv__starter">
                                <Avatar index={p().avatar} size={52} />
                                {p().nickname} başlattı
                              </span>
                            )}
                          </Show>
                        }
                      >
                        {r().voted.length} / {crew().length} oy · {secsLeft(r().stageEndsAt, props.now())} sn
                      </Show>
                    </p>
                  </div>
                  <For each={[`${r().chain}:${r().stage === "show" ? "show" : "grid"}`]}>
                    {() => (
                      <Show
                        when={r().stage === "show"}
                        fallback={
                          <div
                            class="bttv__grid"
                            ref={observe}
                            style={{
                              "--cols": layout().cols,
                              "--cell": `${layout().cell}px`,
                              visibility: layout().cell > 0 ? "visible" : "hidden",
                            }}
                          >
                            <For each={r().steps}>
                              {(s, i) => (
                                <div class="bttv__cell">
                                  <StepCard
                                    step={s}
                                    index={i()}
                                    variant="tv"
                                    author={result() ? person(s.author) : undefined}
                                    crowned={result() && (r().crowned ?? []).includes(i())}
                                    votes={result() ? (r().tally?.[i()] ?? 0) : null}
                                  />
                                </div>
                              )}
                            </For>
                          </div>
                        }
                      >
                        <div class="bttv__story">
                          <div class="bttv__trail">
                            <For each={r().steps.slice(0, -1)}>
                              {(s, i) => (
                                <div class="bttv__mini">
                                  <StepCard step={s} index={i()} variant="feed" />
                                </div>
                              )}
                            </For>
                          </div>
                          <For each={[r().steps.length - 1]}>
                            {(last) => (
                              <Show when={r().steps[last]}>
                                {(s) => (
                                  <div class="bttv__spot">
                                    <StepCard step={s()} index={last} variant="tv" fresh sound />
                                  </div>
                                )}
                              </Show>
                            )}
                          </For>
                        </div>
                      </Show>
                    )}
                  </For>
                  <Show when={pair()}>{(p) => <ChainLock first={p()[0]} last={p()[1]} big />}</Show>
                </>
              );
            }}
          </Show>
        </div>
      )}
    </Show>
  );
}
