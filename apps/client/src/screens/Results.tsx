import { type MatchSnapshot, type RoomSnapshot, summarizeRound } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show, Suspense } from "solid-js";
import { Dynamic } from "solid-js/web";
import { hapticResult } from "../fx/haptics.js";
import { reducedMotion } from "../fx/motion.js";
import { roundResult } from "../fx/sound.js";
import { gameEntry } from "../games/registry.js";
import { sendContinue } from "../net/client.js";
import { createServerNow } from "../net/time.js";
import { Avatar } from "../ui/Avatar.js";
import type { Mood } from "../ui/avatars.js";
import { EmojiBar, RESULT_EMOJIS } from "../ui/EmojiBar.js";
import { ProgressBar } from "../ui/ProgressBar.js";
import { ReactionLayer } from "../ui/ReactionLayer.js";
import { createReactionSender } from "../ui/reactionSend.js";
import { Screen } from "../ui/Screen.js";
import { TamamBar } from "../ui/TamamBar.js";
import { Watchers } from "../ui/Watchers.js";
import { CountUp } from "./CountUp.js";
import {
  deltaLabel,
  formatScore,
  playersOnly,
  podiumOrder,
  previousScore,
  rankDeltas,
  rankPlayers,
  watchersOf,
} from "./ranking.js";

/** Sıra animasyonunun zaman çizelgesi (ms): jetonlar uçar, puan güncellenir, satırlar kayar; toplam ~1 sn. */
const TOKEN_DELAY = 100;
const TOKEN_MS = 450;
const SCORE_AT = 520;
const SLIDE_DELAY = 500;
const SLIDE_MS = 500;

export function Results(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const now = createServerNow(100);
  const react = createReactionSender();
  const result = () => props.match.result;
  const ranked = createMemo(() =>
    rankPlayers(playersOnly(props.snap.players), (p) => result()?.miniScores[p.id]),
  );
  const top = () => ranked().slice(0, 3);
  const awards = () => result()?.awards ?? {};
  const award = (id: string) => awards()[id] ?? 0;
  const reduced = reducedMotion();
  /** Genel sıralama (yeni toplam puana göre) ve bu turdaki sıra değişimi. */
  const standing = createMemo(() => rankPlayers(playersOnly(props.snap.players), (p) => p.score));
  const deltas = createMemo(() => rankDeltas(playersOnly(props.snap.players), awards()));
  /** Puan sütunu jetonlar ulaşınca eski toplamdan yeniye geçer (azaltılmış harekette baştan yeni). */
  const [bumped, setBumped] = createSignal(reduced);
  let listEl: HTMLUListElement | undefined;
  const summary = () =>
    result()
      ? summarizeRound(
          props.match.gameId,
          result() as NonNullable<ReturnType<typeof result>>,
          props.snap.players,
          props.match.publicView,
        )
      : null;
  const nextId = () => props.snap.gameIds[props.match.round + 1];
  const nextName = () => props.snap.catalog.find((g) => g.id === nextId())?.name;
  const self = () => props.snap.players.find((p) => p.id === props.snap.selfId);
  const watching = () => self()?.spectator === true;
  const waitingFor = () =>
    props.match.participants.filter((id) => props.snap.players.find((p) => p.id === id)?.connected);
  const continued = () => props.match.continueIds ?? [];
  const last = () => props.match.round + 1 >= props.match.total;
  const [announce, setAnnounce] = createSignal("");
  const spoken = (): string => {
    const lines = top().map((r) => `${r.rank}. ${r.player.nickname}, ${formatScore(r.score)} puan`);
    const me = ranked().find((r) => r.player.id === props.snap.selfId);
    return `${props.match.gameName} bitti. ${lines.join(". ")}.${me ? ` Senin sıran ${me.rank}.` : ""}`;
  };
  /** FLIP: satırlar önceki yerlerinden yeni yerlerine `transform` ile kayar; jetonlar avatardan toplama uçar. */
  const animateStanding = (): void => {
    const rows = [...(listEl?.querySelectorAll<HTMLElement>(".srow") ?? [])];
    const [r0, r1] = rows;
    if (!r0 || !r1) return;
    const step = r1.offsetTop - r0.offsetTop;
    for (const row of rows) {
      const d = deltas()[row.dataset.id ?? ""] ?? 0;
      if (d !== 0 && typeof row.animate === "function") {
        row.style.zIndex = d > 0 ? "2" : "1";
        row.animate([{ transform: `translateY(${d * step}px)` }, { transform: "none" }], {
          duration: SLIDE_MS,
          delay: SLIDE_DELAY,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          fill: "backwards",
        });
      }
      const tok = row.querySelector<HTMLElement>(".row__tok");
      const score = row.querySelector<HTMLElement>(".row__score");
      if (tok && score && typeof tok.animate === "function") {
        const dx = score.getBoundingClientRect().right - tok.getBoundingClientRect().right;
        tok.animate(
          [
            { transform: "translate(0, 0) scale(0.8)", opacity: 0 },
            { transform: "translate(0, 0) scale(1)", opacity: 1, offset: 0.2 },
            { transform: `translate(${dx}px, 0) scale(1)`, opacity: 1, offset: 0.8 },
            { transform: `translate(${dx}px, 0) scale(0.6)`, opacity: 0 },
          ],
          { duration: TOKEN_MS, delay: TOKEN_DELAY, easing: "ease-in-out", fill: "both" },
        );
      }
    }
  };
  onMount(() => {
    roundResult();
    hapticResult();
    if (!reduced) {
      animateStanding();
      const swap = setTimeout(() => setBumped(true), SCORE_AT);
      onCleanup(() => clearTimeout(swap));
    }
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
        <Show when={summary()}>{(line) => <p class="results__summary rise">{line()}</p>}</Show>
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

      <div class="results__body" data-scroll>
        <div class="podium">
          <For each={podiumOrder(top())}>
            {(r) => (
              <div
                class="podium__col"
                data-rank={r.rank}
                data-pid={r.player.id}
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

        <p class="overline results__standing">Genel sıralama</p>
        <ul class="rows srows" ref={listEl} aria-label="Genel sıralama">
          <For each={standing()}>
            {(r) => (
              <li
                class="row srow"
                data-id={r.player.id}
                data-pid={top().some((t) => t.player.id === r.player.id) ? undefined : r.player.id}
                data-me={r.player.id === props.snap.selfId ? "1" : undefined}
              >
                <span class="row__rank">{r.rank}</span>
                <Avatar
                  index={r.player.avatar}
                  size={36}
                  mood={award(r.player.id) < 0 ? "shock" : "idle"}
                  connected={r.player.connected}
                />
                <span class="row__name">
                  <span class="row__nick">{r.player.nickname}</span>
                  <Show when={r.player.id === props.snap.selfId}>
                    <em class="row__me">Sen</em>
                  </Show>
                </span>
                <Show when={deltas()[r.player.id]}>
                  {(d) => (
                    <span
                      class="row__delta"
                      data-dir={d() > 0 ? "up" : "down"}
                      role="img"
                      aria-label={d() > 0 ? `${d()} sıra yükseldi` : `${-d()} sıra düştü`}
                    >
                      {deltaLabel(d())}
                    </span>
                  )}
                </Show>
                <Show when={award(r.player.id) !== 0 && !reduced}>
                  <span
                    class="row__tok"
                    data-neg={award(r.player.id) < 0 ? "1" : undefined}
                    aria-hidden="true"
                  >
                    {award(r.player.id) > 0 ? "+" : ""}
                    {formatScore(award(r.player.id))}
                  </span>
                </Show>
                <span class="row__score" data-bump={bumped() && award(r.player.id) !== 0 ? "1" : undefined}>
                  {formatScore(bumped() ? r.player.score : previousScore(r.player, awards()))}
                </span>
              </li>
            )}
          </For>
        </ul>
      </div>

      <Watchers players={watchersOf(props.snap.players)} selfId={props.snap.selfId} />

      <footer class="results__foot">
        <EmojiBar compact emojis={RESULT_EMOJIS} onPick={react} />
        <div class="next">
          <div class="next__card">
            <Show when={nextId()} fallback={<span class="next__art next__art--final" aria-hidden="true" />}>
              {(id) => (
                <span class="next__art" aria-hidden="true">
                  <img
                    src={`/assets/cards/${id()}.webp`}
                    alt=""
                    decoding="async"
                    draggable={false}
                    width="800"
                    height="450"
                    onError={(e) => e.currentTarget.remove()}
                  />
                </span>
              )}
            </Show>
            <span class="next__text">
              <span class="overline">Sıradaki</span>
              <span class="next__name">{last() ? "Final" : (nextName() ?? "Yeni oyun")}</span>
            </span>
          </div>
          <div class="next__go">
            <TamamBar
              label="Devam"
              locked={continued().includes(props.snap.selfId)}
              ready={continued().filter((id) => waitingFor().includes(id)).length}
              total={waitingFor().length}
              spectator={watching()}
              onLock={() => sendContinue()}
            />
          </div>
        </div>
        <Show when={props.match.phaseEndsAt}>
          {(end) => <ProgressBar startedAt={props.match.phaseStartedAt} endsAt={end()} now={now} />}
        </Show>
      </footer>
      <ReactionLayer />
    </Screen>
  );
}
