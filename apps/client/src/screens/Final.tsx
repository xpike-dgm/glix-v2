import type { RoomSnapshot } from "@glix/engine";
import { createMemo, For, onCleanup, onMount, Show } from "solid-js";
import { playConfetti } from "../fx/confetti.js";
import { fanfare } from "../fx/sound.js";
import { returnToLobby } from "../net/client.js";
import { Avatar } from "../ui/Avatar.js";
import { CrownIcon } from "../ui/Icons.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";
import { SoundToggle } from "../ui/SoundToggle.js";
import { LeaveButton } from "./LeaveButton.js";
import { rankPlayers, winnersOf } from "./ranking.js";

export function Final(props: { snap: RoomSnapshot }) {
  let confetti: HTMLDivElement | undefined;
  const ranked = createMemo(() => rankPlayers(props.snap.players, (p) => p.score));
  const winners = () => winnersOf(ranked());
  const isHost = () => props.snap.hostId === props.snap.selfId;
  const tie = () => winners().length > 1;

  onMount(() => {
    fanfare();
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
    <Screen class="final">
      <div class="confetti" ref={confetti} aria-hidden="true" />
      <header class="topbar">
        <LeaveButton />
        <SoundToggle />
      </header>

      <div class="winner">
        <p class="overline winner__label rise" style={{ "--i": 0 }}>
          {tie() ? "Berabere" : "Kazanan"}
        </p>
        <div class="winner__avatars rise" style={{ "--i": 1 }} data-many={tie() ? "1" : undefined}>
          <For each={winners()}>
            {(w) => (
              <div class="winner__one">
                <Avatar
                  index={w.player.avatar}
                  size={tie() ? "clamp(64px, 22vw, 96px)" : "clamp(96px, min(38vw, 22dvh), 168px)"}
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
          {winners()[0]?.score ?? 0} puan
        </p>
      </div>

      <ul class="rows rows--final">
        <For each={ranked()}>
          {(r, i) => (
            <li
              class="row rise"
              style={{ "--i": 4 + i() }}
              data-me={r.player.id === props.snap.selfId ? "1" : undefined}
            >
              <span class="row__rank">{r.rank}</span>
              <Avatar index={r.player.avatar} size={40} connected={r.player.connected} />
              <span class="row__name">
                {r.player.nickname}
                <Show when={r.player.id === props.snap.selfId}>
                  <em class="row__me">Sen</em>
                </Show>
              </span>
              <span class="row__score row__score--big">{r.score}</span>
            </li>
          )}
        </For>
      </ul>

      <footer class="final__foot">
        <Show when={isHost()} fallback={<p class="waiting">Host seni lobiye alacak</p>}>
          <PrimaryButton onClick={() => returnToLobby()}>Lobiye dön</PrimaryButton>
        </Show>
      </footer>
    </Screen>
  );
}
