import { createMemo, For, Match, Show, Switch } from "solid-js";
import { formatScore } from "../../screens/ranking.js";
import { TvFit } from "../../stage/TvParts.js";
import { Avatar } from "../../ui/Avatar.js";
import { worldAllowed, worldSrc } from "../../ui/world.js";
import type { GameScreenProps } from "../registry.js";
import { Table } from "./Art.js";
import { type CrewMember, Pazarlik } from "./Pazarlik.js";
import { Sonuc } from "./Sonuc.js";
import "./ittifak.css";
import { finalAt, parseIttifakView, voteOpensAt } from "./view.js";

const W = 1600;
const H = 800;
const EMPTY_PRIVATE = { myVote: null, myPromises: [], locked: false };

/**
 * İttifak, büyük ekran (IT-U13): solda oyuncu sütunu (ad, genel skor, hazır), ortada müzakere masası ve dev sayaç;
 * oylamada mühürleyenler; açılışta oy okuma tam ekran. Yalnız herkese açık görünüm: söz işaretleri ve oylar açılışa
 * kadar TV'de yoktur.
 */
export default function IttifakStageView(props: GameScreenProps) {
  const view = createMemo(() => parseIttifakView(props.match.publicView, EMPTY_PRIVATE));
  const crew = createMemo<CrewMember[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const scoreOf = (id: string) => props.players.find((p) => p.id === id)?.score ?? 0;
  const band = () => {
    const v = view();
    return v !== null && v.phase === "vote" && props.now() < voteOpensAt(v);
  };
  const voteLeft = () => Math.max(0, Math.ceil(((view()?.voteEndsAt ?? 0) - props.now()) / 1000));
  const head = () => {
    const v = view();
    if (!v) return "";
    if (v.phase === "talk") return "Pazarlık zamanı";
    if (v.phase === "vote") return band() ? "PAZARLIK BİTTİ · OYLAR GİZLİ" : "Oylar mühürleniyor";
    return props.now() - v.voteEndsAt >= finalAt(v.players.length) ? "Oylar açıldı" : "Oylar okunuyor";
  };
  const bg = worldAllowed() ? worldSrc("ittifak", "landscape") : null;

  return (
    <TvFit w={W} h={H}>
      <div class="ittv" data-phase={view()?.phase}>
        <Show when={bg}>{(src) => <img class="ittv__bg" src={src()} alt="" aria-hidden="true" />}</Show>
        <aside class="ittv__left">
          <For each={crew()}>
            {(m) => (
              <div class="ittv__row" data-off={m.connected ? undefined : "1"}>
                <Avatar index={m.avatar} size={52} connected={m.connected} />
                <span class="ittv__who">
                  <b>{m.nickname}</b>
                  <small>{m.connected ? `Genel ${formatScore(scoreOf(m.id))}` : "bağlantı yok"}</small>
                </span>
                <Show when={view()?.phase !== "reveal" && view()?.ready.includes(m.id)}>
                  <span class="ittv__st">{view()?.phase === "vote" ? "mühürledi" : "hazır"}</span>
                </Show>
              </div>
            )}
          </For>
        </aside>
        <main class="ittv__main">
          <Show when={view()}>
            {(v) => (
              <>
                <header class="ittv__head">
                  <h2>{head()}</h2>
                  <Show when={v().phase === "vote" && !band()}>
                    <span class="ittv__time">{voteLeft()}</span>
                  </Show>
                </header>
                <Switch>
                  <Match when={v().phase === "talk"}>
                    <div class="ittv__stage">
                      <Pazarlik
                        crew={crew()}
                        selfId=""
                        endsAt={v().talkEndsAt}
                        now={props.now}
                        clock={props.now}
                        ready={v().ready}
                        tv
                      />
                    </div>
                    <p class="ittv__note">
                      Oylamaya hazır: {v().ready.length}/{crew().length}
                    </p>
                  </Match>
                  <Match when={v().phase === "vote"}>
                    <div class="ittv__vote">
                      <Table wide />
                      <div class="ittv__sealed">
                        <For each={crew().filter((m) => v().ready.includes(m.id))}>
                          {(m) => <Avatar index={m.avatar} size={96} />}
                        </For>
                      </div>
                      <p class="ittv__note">
                        Mühürleyenler: {v().ready.length}/{crew().length}
                      </p>
                    </div>
                  </Match>
                  <Match when={v().phase === "reveal" && v().reveal}>
                    <div class="ittv__reveal">
                      <Sonuc
                        view={v()}
                        crew={crew()}
                        selfId=""
                        spectator
                        tv
                        now={props.now}
                        comment={props.match.comment ?? null}
                      />
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
