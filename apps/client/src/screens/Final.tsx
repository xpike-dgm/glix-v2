import type { RoomSnapshot } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { playConfetti } from "../fx/confetti.js";
import { hapticFinal } from "../fx/haptics.js";
import { fanfare } from "../fx/sound.js";
import { returnToLobby } from "../net/client.js";
import { noteMatchFinished } from "../pwa/pwa.js";
import { Avatar } from "../ui/Avatar.js";
import type { Mood } from "../ui/avatars.js";
import { FeedbackRow } from "../ui/FeedbackRow.js";
import { CrownIcon } from "../ui/Icons.js";
import { LeaveButton } from "../ui/LeaveButton.js";
import { Mascot } from "../ui/Mascot.js";
import { MatchGallery } from "../ui/MatchGallery.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";
import { SoundToggle } from "../ui/SoundToggle.js";
import { Watchers } from "../ui/Watchers.js";
import { formatScore, playersOnly, rankPlayers, watchersOf, winnersOf } from "./ranking.js";

export function Final(props: { snap: RoomSnapshot }) {
  let confetti: HTMLDivElement | undefined;
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

  return (
    <Screen class={ranked().length >= 7 ? "final final--dense" : "final"}>
      <div class="confetti" ref={confetti} aria-hidden="true" />
      <p class="sr-only" role="status" aria-live="polite">
        {announce()}
      </p>
      <header class="topbar">
        <LeaveButton />
        <SoundToggle />
      </header>

      <div class="winner">
        <span class="winner__mascot" aria-hidden="true">
          <Mascot pose="kutluyor" size="clamp(72px, 20vw, 96px)" />
        </span>
        <p class="overline winner__label rise" style={{ "--i": 0 }}>
          {tie() ? "Berabere" : "Kazanan"}
        </p>
        <div class="winner__avatars rise" style={{ "--i": 1 }} data-many={tie() ? "1" : undefined}>
          <For each={winners()}>
            {(w) => (
              <div class="winner__one">
                <Avatar
                  index={w.player.avatar}
                  size={
                    tie() ? "clamp(64px, 22vw, 96px)" : "var(--win-av, clamp(96px, min(38vw, 22dvh), 168px))"
                  }
                  mood="happy"
                  connected={w.player.connected}
                />
                <span class="winner__crown">
                  <CrownIcon size="100%" />
                </span>
                <Show when={tie()}>
                  <span class="winner__tiename">{w.player.nickname}</span>
                </Show>
              </div>
            )}
          </For>
        </div>
        <Show when={!tie()}>
          <h1 class="display winner__name rise" style={{ "--i": 2 }}>
            {winners()[0]?.player.nickname}
          </h1>
        </Show>
        <p class="winner__score rise" style={{ "--i": 3 }}>
          {formatScore(winners()[0]?.score ?? 0)} puan
        </p>
      </div>

      <ul class="rows rows--final" data-scroll>
        <For each={ranked()}>
          {(r, i) => (
            <li
              class="row rise"
              style={{ "--i": 4 + i() }}
              data-me={r.player.id === props.snap.selfId ? "1" : undefined}
            >
              <span class="row__rank">{r.rank}</span>
              <Avatar
                index={r.player.avatar}
                size={40}
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

      <MatchGallery players={props.snap.players} />

      <Watchers players={watchers()} selfId={props.snap.selfId} />

      <footer class="final__foot">
        <Show when={!watching()}>
          <FeedbackRow />
        </Show>
        <Show
          when={isHost()}
          fallback={
            <p class="waiting">{watching() ? "Lobiye dönünce oyuncu olursun" : "Host seni lobiye alacak"}</p>
          }
        >
          <PrimaryButton onClick={() => returnToLobby()}>Lobiye dön</PrimaryButton>
        </Show>
      </footer>
    </Screen>
  );
}
