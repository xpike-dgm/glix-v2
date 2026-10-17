import type { MatchSnapshot, RoomSnapshot } from "@glix/engine";
import { createMemo, For, onMount, Show } from "solid-js";
import { fanfare } from "../fx/sound.js";
import { createServerNow } from "../net/time.js";
import { Avatar } from "../ui/Avatar.js";
import { ProgressBar } from "../ui/ProgressBar.js";
import { Screen } from "../ui/Screen.js";
import { CountUp } from "./CountUp.js";
import { podiumOrder, rankPlayers } from "./ranking.js";

export function Results(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const now = createServerNow(100);
  const result = () => props.match.result;
  const ranked = createMemo(() => rankPlayers(props.snap.players, (p) => result()?.miniScores[p.id]));
  const top = () => ranked().slice(0, 3);
  const rest = () => ranked().slice(3);
  const award = (id: string) => result()?.awards[id] ?? 0;
  const last = () => props.match.round + 1 >= props.match.total;
  onMount(() => fanfare());

  const podiumAvatar = (rank: number) =>
    rank === 1 ? "var(--pod-big, clamp(76px, 24vw, 104px))" : "var(--pod-small, clamp(60px, 18vw, 76px))";

  return (
    <Screen class="results">
      <header class="results__head rise">
        <p class="overline">
          Oyun {props.match.round + 1} / {props.match.total}
        </p>
        <h1 class="display h-title">{props.match.gameName}</h1>
      </header>

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
                  host={r.player.id === props.snap.hostId}
                  connected={r.player.connected}
                  self={r.player.id === props.snap.selfId}
                />
                <span class="podium__name">{r.player.nickname}</span>
                <span class="podium__score">{r.score}</span>
                <div class="podium__block">
                  <span>{r.rank}</span>
                </div>
              </div>
            )}
          </For>
        </div>

        <ul class="rows">
          <For each={rest()}>
            {(r, i) => (
              <li class="row rise" style={{ "--i": 4 + i() }}>
                <span class="row__rank">{r.rank}</span>
                <Avatar index={r.player.avatar} size={40} connected={r.player.connected} />
                <span class="row__name">
                  {r.player.nickname}
                  <Show when={r.player.id === props.snap.selfId}>
                    <em class="row__me">Sen</em>
                  </Show>
                </span>
                <span class="row__score">{r.score}</span>
                <span class="row__award">
                  <Show when={award(r.player.id) > 0}>
                    <CountUp to={award(r.player.id)} delay={900} />
                  </Show>
                </span>
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
