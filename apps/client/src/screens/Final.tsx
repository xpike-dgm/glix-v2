import type { RoomSnapshot } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { playConfetti } from "../fx/confetti.js";
import { hapticFinal } from "../fx/haptics.js";
import { fanfare } from "../fx/sound.js";
import { returnToLobby } from "../net/client.js";
import { matchRounds } from "../net/matchHistory.js";
import { noteMatchFinished } from "../pwa/pwa.js";
import { Avatar } from "../ui/Avatar.js";
import type { Mood } from "../ui/avatars.js";
import { EmojiBar, RESULT_EMOJIS } from "../ui/EmojiBar.js";
import { FeedbackRow } from "../ui/FeedbackRow.js";
import { CrownIcon } from "../ui/Icons.js";
import { LeaveButton } from "../ui/LeaveButton.js";
import { Mascot } from "../ui/Mascot.js";
import { MatchGallery } from "../ui/MatchGallery.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { ReactionLayer } from "../ui/ReactionLayer.js";
import { createReactionSender } from "../ui/reactionSend.js";
import { Screen } from "../ui/Screen.js";
import { SoundToggle } from "../ui/SoundToggle.js";
import { Watchers } from "../ui/Watchers.js";
import { formatScore, playersOnly, podiumOrder, rankPlayers, watchersOf, winnersOf } from "./ranking.js";
import { deriveTitles } from "./titles.js";

export function Final(props: { snap: RoomSnapshot }) {
  let confetti: HTMLDivElement | undefined;
  const react = createReactionSender();
  const ranked = createMemo(() => rankPlayers(playersOnly(props.snap.players), (p) => p.score));
  const winners = () => winnersOf(ranked());
  const lastRank = () => ranked().at(-1)?.rank ?? 0;
  /** 1. sıra sevinir; sonuncu yalnız puanı negatifse "out", yoksa sakin. */
  const rowMood = (rank: number, score: number): Mood =>
    rank === 1 ? "happy" : rank === lastRank() && ranked().length > 1 && score < 0 ? "out" : "idle";
  const isHost = () => props.snap.hostId === props.snap.selfId;
  const tie = () => winners().length > 1;
  const watchers = () => watchersOf(props.snap.players);
  const watching = () => watchers().some((p) => p.id === props.snap.selfId);

  const [announce, setAnnounce] = createSignal("");
  const spoken = (): string => {
    const names = winners()
      .map((w) => w.player.nickname)
      .join(" ve ");
    const me = ranked().find((r) => r.player.id === props.snap.selfId);
    return `Final. ${tie() ? "Berabere" : "Kazanan"} ${names}, ${formatScore(winners()[0]?.score ?? 0)} puan.${me ? ` Senin sıran ${me.rank}.` : ""}`;
  };

  onMount(() => {
    fanfare();
    hapticFinal();
    noteMatchFinished();
    const t = setTimeout(() => setAnnounce(spoken()), 250);
    onCleanup(() => clearTimeout(t));
    if (!confetti) return;
    let stop: (() => void) | undefined;
    let gone = false;
    playConfetti(confetti)
      .then((d) => {
        if (gone) d();
        else stop = d;
      })
      .catch(() => {
        // konfeti olmadan da final çalışır
      });
    onCleanup(() => {
      gone = true;
      stop?.();
    });
  });

  const top = () => ranked().slice(0, 3);
  const rest = () => ranked().slice(3);
  const podiumAvatar = (rank: number) =>
    rank === 1 ? "var(--pod-big, clamp(72px, 22vw, 100px))" : "var(--pod-small, clamp(56px, 17vw, 72px))";
  const titles = createMemo(() =>
    deriveTitles(
      matchRounds(),
      playersOnly(props.snap.players).map((p) => p.id),
    ),
  );
  const playerOf = (id: string) => props.snap.players.find((p) => p.id === id);

  return (
    <Screen class="final fin">
      <div class="confetti" ref={confetti} aria-hidden="true" />
      <p class="sr-only" role="status" aria-live="polite">
        {announce()}
      </p>
      <header class="topbar">
        <LeaveButton />
        <SoundToggle />
      </header>

      <div class="fin__scroll" data-scroll>
        <div class="fin__a">
          <div class="fin__head rise" style={{ "--i": 0 }}>
            <p class="overline">{tie() ? "Berabere" : "Kazanan"}</p>
            <h1 class="display fin__name">
              {winners()
                .map((w) => w.player.nickname)
                .join(" ve ")}
            </h1>
            <p class="fin__score">{formatScore(winners()[0]?.score ?? 0)} puan</p>
          </div>

          <div class="podium fin__podium">
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
                    <Show when={r.rank === 1}>
                      <span class="fin__crown" aria-hidden="true">
                        <CrownIcon size="100%" />
                      </span>
                    </Show>
                  </div>
                  <Avatar
                    index={r.player.avatar}
                    size={podiumAvatar(r.rank)}
                    mood={rowMood(r.rank, r.score)}
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
        </div>

        <div class="fin__b">
          <Show when={titles().length > 0}>
            <section class="fin__titles rise" style={{ "--i": 6 }} aria-label="Unvanlar">
              <p class="overline">Unvanlar</p>
              <ul class="fin__chips">
                <For each={titles()}>
                  {(t) => (
                    <li class="fin__chip">
                      <Show when={playerOf(t.playerId)}>
                        {(p) => <Avatar index={p().avatar} size={28} mood="idle" connected={p().connected} />}
                      </Show>
                      <span class="fin__chiptext">
                        <span class="fin__chiplabel">{t.label}</span>
                        <span class="fin__chipnick">{playerOf(t.playerId)?.nickname}</span>
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>

          <Show when={rest().length > 0}>
            <ul class="rows fin__rows" aria-label="Sıralama">
              <For each={rest()}>
                {(r, i) => (
                  <li
                    class="row rise"
                    data-pid={r.player.id}
                    style={{ "--i": 4 + i() }}
                    data-me={r.player.id === props.snap.selfId ? "1" : undefined}
                  >
                    <span class="row__rank">{r.rank}</span>
                    <Avatar
                      index={r.player.avatar}
                      size={36}
                      mood={rowMood(r.rank, r.score)}
                      connected={r.player.connected}
                    />
                    <span class="row__name">
                      <span class="row__nick">{r.player.nickname}</span>
                      <Show when={r.player.id === props.snap.selfId}>
                        <em class="row__me">Sen</em>
                      </Show>
                    </span>
                    <span class="row__score row__score--big">{formatScore(r.score)}</span>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <MatchGallery players={props.snap.players} />

          <Show when={!watching()}>
            <FeedbackRow />
          </Show>
          <Watchers players={watchers()} selfId={props.snap.selfId} />
        </div>
      </div>

      <footer class="final__foot">
        <EmojiBar compact emojis={RESULT_EMOJIS} onPick={react} />
        <Show
          when={isHost()}
          fallback={
            <p class="waiting">
              {watching() ? "Lobiye dönünce oyuncu olursun" : "Ev sahibi yeni maçı başlatacak"}
            </p>
          }
        >
          <PrimaryButton class="pbtn--long" onClick={() => returnToLobby()}>
            Aynı ekiple yeni maç
          </PrimaryButton>
        </Show>
      </footer>
      <ReactionLayer />
    </Screen>
  );
}
