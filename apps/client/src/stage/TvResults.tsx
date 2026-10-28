import { type MatchSnapshot, type RoomSnapshot, summarizeRound } from "@glix/engine";
import { createMemo, For, onMount, Show } from "solid-js";
import { roundResult } from "../fx/sound.js";
import { createServerNow } from "../net/time.js";
import {
  deltaLabel,
  formatScore,
  playersOnly,
  podiumOrder,
  rankDeltas,
  rankPlayers,
} from "../screens/ranking.js";
import { Avatar } from "../ui/Avatar.js";
import type { Mood } from "../ui/avatars.js";
import { CardLines } from "../ui/CardLines.js";
import { ProgressBar } from "../ui/ProgressBar.js";
import { TvBoard } from "./TvParts.js";

/** Tur sonucu: dev podyum (bu oyunun puanları) solda, genel sıralama ve sıra değişimleri sağda. */
export function TvResults(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const now = createServerNow(100);
  const result = () => props.match.result;
  const players = createMemo(() => playersOnly(props.snap.players));
  const ranked = createMemo(() => rankPlayers(players(), (p) => result()?.miniScores[p.id]));
  const top = () => ranked().slice(0, 3);
  const awards = () => result()?.awards ?? {};
  const deltas = createMemo(() => rankDeltas(players(), awards()));
  const summary = () => {
    const r = result();
    return r ? summarizeRound(props.match.gameId, r, props.snap.players, props.match.publicView) : null;
  };
  const nextId = () => props.snap.gameIds[props.match.round + 1];
  const nextName = () => props.snap.catalog.find((g) => g.id === nextId())?.name;
  const last = () => props.match.round + 1 >= props.match.total;
  const mood = (rank: number, id: string): Mood =>
    (awards()[id] ?? 0) < 0 ? "shock" : rank === 1 ? "happy" : "idle";
  const hasCards = () => (props.match.cards?.lines.length ?? 0) > 0;
  onMount(() => roundResult());
  const rows = createMemo(() =>
    rankPlayers(players(), (p) => p.score).map((r) => {
      const d = deltas()[r.player.id];
      const a = awards()[r.player.id] ?? 0;
      const note = [d ? deltaLabel(d) : "", a !== 0 ? `${a > 0 ? "+" : ""}${formatScore(a)} puan` : ""]
        .filter(Boolean)
        .join(" · ");
      return { player: r.player, score: r.score, note: note || undefined };
    }),
  );
  return (
    <div class="tv__cols">
      <main class="tv__results" data-cards={hasCards() ? "1" : undefined}>
        <header class="tv__head">
          <div>
            <p class="tv__overline">
              Oyun {props.match.round + 1} / {props.match.total} bitti
            </p>
            <h1 class="tv__title tv__title--game">{props.match.gameName}</h1>
          </div>
        </header>
        <Show when={summary()}>{(line) => <p class="tv__summary">{line()}</p>}</Show>
        <section class="tv__podium" aria-label="Bu oyunun sıralaması">
          <For each={podiumOrder(top())}>
            {(r) => (
              <div class="tv__pod" data-rank={r.rank} data-pid={r.player.id}>
                <Show when={(awards()[r.player.id] ?? 0) !== 0}>
                  <span class="tv__podaward" data-neg={(awards()[r.player.id] ?? 0) < 0 ? "1" : undefined}>
                    {(awards()[r.player.id] ?? 0) > 0 ? "+" : ""}
                    {formatScore(awards()[r.player.id] ?? 0)}
                  </span>
                </Show>
                <Avatar
                  index={r.player.avatar}
                  size={hasCards() ? (r.rank === 1 ? 150 : 116) : r.rank === 1 ? 240 : 180}
                  mood={mood(r.rank, r.player.id)}
                  live={r.rank === 1 ? "joy" : undefined}
                  connected={r.player.connected}
                />
                <span class="tv__podname">{r.player.nickname}</span>
                <span class="tv__podscore">{formatScore(r.score)}</span>
                <div class="tv__podblock">
                  <span>{r.rank}</span>
                </div>
              </div>
            )}
          </For>
        </section>
        <CardLines big limit={6} cards={props.match.cards} players={props.snap.players} />
        <footer class="tv__next">
          <span class="tv__overline">Sıradaki</span>
          <b>{last() ? "Final" : (nextName() ?? "Yeni oyun")}</b>
          <Show when={props.match.phaseEndsAt}>
            {(end) => (
              <div class="tv__nextbar">
                <ProgressBar startedAt={props.match.phaseStartedAt} endsAt={end()} now={now} />
              </div>
            )}
          </Show>
        </footer>
      </main>
      <TvBoard title="Genel sıralama" hostId={props.snap.hostId} rows={rows()} />
    </div>
  );
}
