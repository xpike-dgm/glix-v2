import { createMemo, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js";
import { formatScore } from "../../screens/ranking.js";
import { TvFit } from "../../stage/TvParts.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { worldAllowed, worldSrc } from "../../ui/world.js";
import type { GameScreenProps } from "../registry.js";
import { Ballot, SignArt } from "./Art.js";
import { ThroneFront } from "./Dagitim.js";
import type { CrewMember } from "./Seats.js";
import { Sonuc } from "./Sonuc.js";
import { TacAni } from "./TacAni.js";
import "./rusvet-darbe.css";
import { handOutcome, parseRusvetView, SIGN_LABEL } from "./view.js";

const W = 1600;
const H = 800;
const EMPTY_PRIVATE = { myVote: null, locked: false };

/**
 * Rüşvet ve Darbe, büyük ekran (RD-U13): saray salonu, solda oyuncu sütunu (ad, genel skor, durum), ortada aşamanın
 * sahnesi. Yalnız herkese açık görünüm: oylar, işaretler, dağılım ve defter sonuca kadar TV'de yoktur.
 */
export default function RusvetStageView(props: GameScreenProps) {
  const view = createMemo(() => parseRusvetView(props.match.publicView, EMPTY_PRIVATE));
  const [clock, setClock] = createSignal(props.now());
  const timer = setInterval(() => setClock(props.now()), 100);
  onCleanup(() => clearInterval(timer));
  const crew = createMemo<CrewMember[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const scoreOf = (id: string) => props.players.find((p) => p.id === id)?.score ?? 0;
  const member = (id: string | null | undefined) => crew().find((m) => m.id === id) ?? null;
  const secsLeft = () => {
    const v = view();
    return v ? Math.max(0, Math.ceil((v.phaseEndsAt - clock()) / 1000)) : 0;
  };

  /** Oyuncu sütunundaki durum: mühürledi / aday / jeton aldı / hak sahibi. */
  const statusOf = (id: string): string => {
    const v = view();
    if (!v) return "";
    if (v.phase === "vote") return v.ready.includes(id) ? "mühürledi" : "";
    if (v.phase === "runoff")
      return v.runoff?.candidates.includes(id) ? "aday" : v.ready.includes(id) ? "oy verdi" : "";
    if (v.phase === "duel") return v.duel?.candidates.includes(id) ? "aday" : "";
    if (v.phase === "give") return v.president === id ? "başkan" : "";
    if (v.phase === "coup") {
      if (v.president === id) return "başkan";
      if ((v.coup?.tokens[id] ?? 0) > 0) return "jeton aldı";
      return v.coup?.eligible.includes(id) ? "hak sahibi" : "";
    }
    return v.president === id ? "başkan" : "";
  };
  const head = () => {
    const v = view();
    if (!v) return "";
    switch (v.phase) {
      case "vote":
        return "Başkanlık seçimi";
      case "runoff":
        return `EŞİTLİK! ${v.runoff?.candidates.length ?? 0} aday`;
      case "duel":
        return `Darbe düellosu · ${v.duel?.hand ?? 1}. el`;
      case "give":
        return `${member(v.president)?.nickname ?? "Başkan"} jeton dağıtıyor`;
      case "coup":
        return "Darbe oylaması";
      default:
        return `Başkan: ${member(v.president)?.nickname ?? ""}`;
    }
  };
  const bg = worldAllowed() ? worldSrc("rusvet-darbe", "landscape") : null;

  return (
    <TvFit w={W} h={H}>
      <div class="rdtv" data-phase={view()?.phase}>
        <Show when={bg}>{(src) => <img class="rdtv__bg" src={src()} alt="" aria-hidden="true" />}</Show>
        <aside class="rdtv__left">
          <For each={crew()}>
            {(m) => (
              <div class="rdtv__row" data-off={m.connected ? undefined : "1"}>
                <Avatar index={m.avatar} size={52} connected={m.connected} />
                <span class="rdtv__who">
                  <b>{m.nickname}</b>
                  <small>Genel {formatScore(scoreOf(m.id))}</small>
                </span>
                <Show when={statusOf(m.id)}>
                  <span class="rdtv__st">{statusOf(m.id)}</span>
                </Show>
              </div>
            )}
          </For>
        </aside>
        <main class="rdtv__main">
          <Show when={view()}>
            {(v) => (
              <>
                <header class="rdtv__head">
                  <h2>{head()}</h2>
                  <Show when={v().phase !== "reveal"}>
                    <span class="rdtv__time">{secsLeft()}</span>
                  </Show>
                </header>
                <Switch>
                  <Match when={v().phase === "vote"}>
                    <div class="rdtv__ballot">
                      <Ballot size="220px" />
                      <div class="rdtv__sealed">
                        <For each={crew().filter((m) => v().ready.includes(m.id))}>
                          {(m) => <Avatar index={m.avatar} size={64} />}
                        </For>
                      </div>
                      <p>
                        Mühürleyenler: {v().ready.length}/{crew().length}
                      </p>
                    </div>
                  </Match>
                  <Match when={v().phase === "runoff" || v().phase === "duel"}>
                    <div class="rdtv__cands">
                      <For
                        each={(v().phase === "runoff" ? v().runoff?.candidates : v().duel?.candidates) ?? []}
                      >
                        {(id) => {
                          const m = () => member(id);
                          const sign = () => v().duel?.signs?.[id];
                          const out = () => {
                            const d = v().duel;
                            const o = d?.signs ? handOutcome(d.candidates, d.signs) : null;
                            return o && !o.replay && !o.advance.includes(id);
                          };
                          return (
                            <div class="rdtv__cand" data-out={out() ? "1" : undefined}>
                              <Show when={m()}>
                                {(mm) => (
                                  <Avatar
                                    index={mm().avatar}
                                    size={150}
                                    connected={mm().connected}
                                    ready={v().ready.includes(id)}
                                  />
                                )}
                              </Show>
                              <b style={{ color: look(m()?.avatar ?? 0).color }}>{m()?.nickname}</b>
                              <Show when={v().phase === "duel"}>
                                <span class="rdtv__card">
                                  <Show when={sign()} fallback={<span class="rdtv__q">?</span>}>
                                    {(s) => (
                                      <>
                                        <SignArt sign={s()} size="110px" />
                                        <small>{SIGN_LABEL[s()]}</small>
                                      </>
                                    )}
                                  </Show>
                                </span>
                              </Show>
                              <Show when={out()}>
                                <span class="rd__stamp rd__stamp--out">ELENDİ</span>
                              </Show>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                    <Show when={v().duel?.lottery}>
                      {(id) => <p class="rdtv__note">Kura ile: {member(id())?.nickname}</p>}
                    </Show>
                  </Match>
                  <Match when={v().phase === "give"}>
                    <ThroneFront
                      president={member(v().president)}
                      budget={v().budget ?? 0}
                      done={v().ready.length > 0}
                      big
                    />
                    <Show when={v().crown && clock() < (v().crown?.endsAt ?? 0)}>
                      <TacAni
                        president={member(v().president)}
                        budget={v().budget ?? 0}
                        mine={false}
                        spectator
                      />
                    </Show>
                  </Match>
                  <Match when={v().phase === "coup"}>
                    <div class="rdtv__coup">
                      <ThroneFront president={member(v().president)} budget={v().budget ?? 0} done big />
                      <p class="rdtv__note">
                        Karar verenler:{" "}
                        {crew()
                          .filter((m) => v().coup?.eligible.includes(m.id))
                          .map((m) => m.nickname)
                          .join(", ")}{" "}
                        · {v().ready.length}/{v().coup?.eligible.length ?? 0}
                      </p>
                    </div>
                  </Match>
                  <Match when={v().phase === "reveal" && v().reveal}>
                    <div class="rdtv__reveal">
                      <Sonuc view={v()} crew={crew()} selfId="" spectator now={clock} />
                    </div>
                  </Match>
                </Switch>
              </>
            )}
          </Show>
        </main>
      </div>
    </TvFit>
  );
}
