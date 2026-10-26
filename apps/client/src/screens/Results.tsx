import type { MatchSnapshot, RoomSnapshot } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show, Suspense } from "solid-js";
import { Dynamic } from "solid-js/web";
import { hapticResult } from "../fx/haptics.js";
import { roundResult } from "../fx/sound.js";
import { gameEntry } from "../games/registry.js";
import { createServerNow } from "../net/time.js";
import { Avatar } from "../ui/Avatar.js";
import type { Mood } from "../ui/avatars.js";
import { ProgressBar } from "../ui/ProgressBar.js";
import { Screen } from "../ui/Screen.js";
import { CountUp } from "./CountUp.js";
import { formatScore, podiumOrder, rankPlayers } from "./ranking.js";

export function Results(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const now = createServerNow(100);
  const result = () => props.match.result;
  const ranked = createMemo(() => rankPlayers(props.snap.players, (p) => result()?.miniScores[p.id]));
  const top = () => ranked().slice(0, 3);
  const rest = () => ranked().slice(3);
  const award = (id: string) => result()?.awards[id] ?? 0;
  const anyAward = () => rest().some((r) => award(r.player.id) > 0);
  const last = () => props.match.round + 1 >= props.match.total;
  const [announce, setAnnounce] = createSignal("");
  const spoken = (): string => {
    const lines = top().map((r) => `${r.rank}. ${r.player.nickname}, ${formatScore(r.score)} puan`);
    const me = ranked().find((r) => r.player.id === props.snap.selfId);
    return `${props.match.gameName} bitti. ${lines.join(". ")}.${me ? ` Senin sıran ${me.rank}.` : ""}`;
  };
  onMount(() => {
    roundResult();
    hapticResult();
    // Canlı bölge, içerik yerleştikten sonra değişince okunur.
    const t = setTimeout(() => setAnnounce(spoken()), 250);
    onCleanup(() => clearTimeout(t));
  });

  /** Podyum: kazanan sevinir, olumsuz ödül alan şaşırır, diğerleri sakin. */
  const moodOf = (r: { rank: number; player: { id: string } }): Mood =>
    award(r.player.id) < 0 ? "shock" : r.rank === 1 ? "happy" : "idle";

  const podiumAvatar = (rank: number) =>
    rank === 1 ? "var(--pod-big, clamp(76px, 24vw, 104px))" : "var(--pod-small, clamp(60px, 18vw, 76px))";

  return (
    <Screen class="results">
      <p class="sr-only" role="status" aria-live="polite">
        {announce()}
      </p>
      <header class="results__head rise">
        <p class="overline">
          Oyun {props.match.round + 1} / {props.match.total}
        </p>
        <h1 class="display h-title">{props.match.gameName}</h1>
      </header>

      <Show when={gameEntry(props.match.gameId)?.Reveal}>
        {(reveal) => (
          <Suspense>
            <Dynamic
              component={reveal()}
              match={props.match}
              selfId={props.snap.selfId}
              players={props.snap.players}
              now={now}
            />
          </Suspense>
        )}
      </Show>

      <div class="results__body">
        <div class="podium">
          <For each={podiumOrder(top())}>
            {(r) => (
              <div
                class="podium__col"
                data-rank={r.rank}
                data-pos={top().indexOf(r)}
                style={{ "--i": 3 - top().indexOf(r) }}
              >
                <div class="podium__badge">
                  <Show when={award(r.player.id) > 0}>
                    <CountUp to={award(r.player.id)} delay={700 + r.rank * 160} />
                  </Show>
                </div>
                <Avatar
                  index={r.player.avatar}
                  size={podiumAvatar(r.rank)}
                  mood={moodOf(r)}
                  host={r.player.id === props.snap.hostId}
                  connected={r.player.connected}
                  self={r.player.id === props.snap.selfId}
                />
                <span class="podium__name">{r.player.nickname}</span>
                <span class="podium__score">{formatScore(r.score)}</span>
                <div class="podium__block">
                  <span>{r.rank}</span>
                </div>
              </div>
            )}
          </For>
        </div>

        <ul class="rows" data-scroll>
          <For each={rest()}>
            {(r, i) => (
              <li class="row rise" style={{ "--i": 4 + i() }}>
                <span class="row__rank">{r.rank}</span>
                <Avatar
                  index={r.player.avatar}
                  size={40}
                  mood={award(r.player.id) < 0 ? "shock" : "idle"}
                  connected={r.player.connected}
                />
                <span class="row__name">
                  <span class="row__nick">{r.player.nickname}</span>
                  <Show when={r.player.id === props.snap.selfId}>
                    <em class="row__me">Sen</em>
                  </Show>
                </span>
                <Show when={anyAward()}>
                  <span class="row__award">
                    <Show when={award(r.player.id) > 0}>
                      <CountUp to={award(r.player.id)} delay={900} />
                    </Show>
                  </span>
                </Show>
                <span class="row__score">{formatScore(r.score)}</span>
              </li>
            )}
          </For>
        </ul>
      </div>

      <footer class="results__foot">
        <Show when={props.match.phaseEndsAt}>
          {(end) => <ProgressBar startedAt={props.match.phaseStartedAt} endsAt={end()} now={now} />}
        </Show>
        <p class="waiting">{last() ? "Final geliyor…" : "Sıradaki oyun hazırlanıyor…"}</p>
      </footer>
    </Screen>
  );
}
