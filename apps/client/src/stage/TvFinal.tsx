import type { RoomSnapshot } from "@glix/engine";
import { createMemo, For, onCleanup, onMount, Show } from "solid-js";
import { playFinalFx, winnerCelebration } from "../fx/finalFx.js";
import { fanfare } from "../fx/sound.js";
import { matchRounds } from "../net/matchHistory.js";
import { formatScore, playersOnly, podiumOrder, rankPlayers, winnersOf } from "../screens/ranking.js";
import { deriveTitles } from "../screens/titles.js";
import { Avatar } from "../ui/Avatar.js";
import type { Mood } from "../ui/avatars.js";
import { CharacterStage, type PodiumChar } from "../ui/CharacterStage.js";
import { PodiumBlock } from "../ui/PodiumBlock.js";

/** Final: kazanan, dev podyum, geri kalan sıralama ve unvanlar. Konfeti ve fanfar TV'de çalar. */
export function TvFinal(props: { snap: RoomSnapshot }) {
  let confetti: HTMLDivElement | undefined;
  const players = createMemo(() => playersOnly(props.snap.players));
  const ranked = createMemo(() => rankPlayers(players(), (p) => p.score));
  const winners = () => winnersOf(ranked());
  const top = () => ranked().slice(0, 3);
  const rest = () => ranked().slice(3);
  const tie = () => winners().length > 1;
  const titles = createMemo(() =>
    deriveTitles(
      matchRounds(),
      players().map((p) => p.id),
    ),
  );
  const playerOf = (id: string) => props.snap.players.find((p) => p.id === id);
  const mood = (rank: number, score: number): Mood =>
    rank === 1
      ? "happy"
      : rank === (ranked().at(-1)?.rank ?? 0) && ranked().length > 1 && score < 0
        ? "out"
        : "idle";
  /** Kürsü karakterleri: 1. sıradakiler dans eder, 2. ve 3. alkışlar (telefondaki kürsüyle aynı). */
  const stageChars = (): PodiumChar[] =>
    top().map((r, i) => ({
      key: r.player.id,
      avatar: r.player.avatar,
      cosmetics: r.player.cosmetics,
      act: r.rank === 1 ? "dance" : "ovation",
      offset: i * 1.3,
      dim: !r.player.connected,
    }));
  onMount(() => {
    fanfare();
    if (!confetti) return;
    let stop: (() => void) | undefined;
    let gone = false;
    playFinalFx(confetti, winnerCelebration(winners()))
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
    <div class="tv__cols tv__cols--final">
      <div class="tv__confetti" ref={confetti} aria-hidden="true" />
      <main class="tv__finalmain">
        <header class="tv__finalhead">
          <p class="tv__overline">{tie() ? "Berabere" : "Kazanan"}</p>
          <h1 class="tv__winner">
            {winners()
              .map((w) => w.player.nickname)
              .join(" ve ")}
          </h1>
          <p class="tv__winscore">{formatScore(winners()[0]?.score ?? 0)} puan</p>
        </header>
        <section class="tv__podium tv__podium--final" aria-label="Final sıralaması">
          <For each={podiumOrder(top())}>
            {(r) => (
              <div class="tv__pod" data-rank={r.rank} data-pid={r.player.id}>
                <span class="tv__podwho">
                  <Avatar
                    index={r.player.avatar}
                    size={72}
                    winner={r.rank === 1}
                    connected={r.player.connected}
                  />
                  <span class="tv__podname">{r.player.nickname}</span>
                  <span class="tv__podscore">{formatScore(r.score)}</span>
                </span>
                <div class="tv__podchar" data-cslot={r.player.id}>
                  <div class="tv__podph">
                    <Avatar
                      index={r.player.avatar}
                      size={r.rank === 1 ? 220 : 170}
                      mood={mood(r.rank, r.score)}
                      live={r.rank === 1 ? "joy" : undefined}
                      winner={r.rank === 1}
                      connected={r.player.connected}
                    />
                  </div>
                </div>
                <PodiumBlock class="tv__podblock" rank={r.rank} />
              </div>
            )}
          </For>
          <CharacterStage chars={stageChars()} />
        </section>
      </main>
      <aside class="tv__side tv__side--final" aria-label="Sıralama ve unvanlar">
        <Show when={rest().length > 0}>
          <p class="tv__overline">Sıralama</p>
          <ul class="tv__board" data-dense="1">
            <For each={rest()}>
              {(r) => (
                <li class="tv__prow" data-pid={r.player.id}>
                  <span class="tv__prank">{r.rank}</span>
                  <Avatar index={r.player.avatar} size={52} mood={mood(r.rank, r.score)} />
                  <span class="tv__pname">
                    <span class="tv__pnick">{r.player.nickname}</span>
                  </span>
                  <span class="tv__pscore">{formatScore(r.score)}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
        <Show when={titles().length > 0}>
          <p class="tv__overline">Unvanlar</p>
          <ul class="tv__titles">
            <For each={titles().slice(0, 3)}>
              {(t) => (
                <li class="tv__title-chip">
                  <Show when={playerOf(t.playerId)}>
                    {(p) => <Avatar index={p().avatar} size={44} connected={p().connected} />}
                  </Show>
                  <span>
                    <b>{t.label}</b>
                    <em>{playerOf(t.playerId)?.nickname}</em>
                  </span>
                </li>
              )}
            </For>
          </ul>
        </Show>
        <p class="tv__lead tv__lead--small">Ev sahibi telefonundan yeni maçı başlatır.</p>
      </aside>
    </div>
  );
}
