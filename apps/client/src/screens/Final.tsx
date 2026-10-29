import type { RoomSnapshot } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { playFinalFx, winnerCelebration } from "../fx/finalFx.js";
import { hapticFinal } from "../fx/haptics.js";
import { fanfare } from "../fx/sound.js";
import { dismissBadges } from "../net/badges.js";
import { leaveRoom, returnToLobby } from "../net/client.js";
import { clearGlix } from "../net/glix.js";
import { guestGlixText } from "../net/glixRules.js";
import { matchRounds } from "../net/matchHistory.js";
import { clearQuestsDone } from "../net/quests.js";
import { openReport } from "../net/reportUi.js";
import { setState, state } from "../net/store.js";
import { noteMatchFinished } from "../pwa/pwa.js";
import type { ClipInput } from "../share/danceClip.js";
import { selectMoments } from "../share/momentCards.js";
import { ShareSheet } from "../share/ShareSheet.js";
import { Avatar } from "../ui/Avatar.js";
import type { Mood } from "../ui/avatars.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { CharacterStage, type PodiumChar } from "../ui/CharacterStage.js";
import { frameOf, PlayerName, PlayerTitle } from "../ui/Cosmetic.js";
import { EmojiFan } from "../ui/EmojiFan.js";
import { FeedbackRow } from "../ui/FeedbackRow.js";
import { GhostButton } from "../ui/GhostButton.js";
import { GlixSummary } from "../ui/GlixSummary.js";
import { ShareIcon } from "../ui/Icons.js";
import { LeaveButton } from "../ui/LeaveButton.js";
import { Mascot } from "../ui/Mascot.js";
import { MatchGallery } from "../ui/MatchGallery.js";
import { galleryItems } from "../ui/matchGallery.js";
import { NewBadgeCard } from "../ui/NewBadgeCard.js";
import { PodiumBlock } from "../ui/PodiumBlock.js";
import { PodiumPerson } from "../ui/PodiumPerson.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { QuestsDone } from "../ui/QuestsDone.js";
import { ReactionLayer } from "../ui/ReactionLayer.js";
import { FlagIcon } from "../ui/ResultIcons.js";
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

  /** Kendi sıran (izleyiciyse yok). */
  const myPlace = (): number | null => ranked().find((r) => r.player.id === props.snap.selfId)?.rank ?? null;

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
    // Final'den ayrılınca (lobi, çıkış) rozet kartı bir sonraki maça taşınmaz.
    onCleanup(dismissBadges);
    onCleanup(clearGlix);
    onCleanup(clearQuestsDone);
    const t = setTimeout(() => setAnnounce(spoken()), 250);
    onCleanup(() => clearTimeout(t));
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

  const top = () => ranked().slice(0, 3);
  const rest = () => ranked().slice(3);
  /** Kürsü karakterleri: 1. sıradaki herkes (beraberlik dahil) dans eder, diğerleri alkışlar. */
  const stageChars = (): PodiumChar[] =>
    top().map((r, i) => ({
      key: r.player.id,
      avatar: r.player.avatar,
      cosmetics: r.player.cosmetics,
      act: r.rank === 1 ? "dance" : "ovation",
      offset: i * 1.3,
      dim: !r.player.connected,
    }));
  const podiumAvatar = (rank: number) =>
    rank === 1 ? "var(--pod-big, clamp(72px, 22vw, 100px))" : "var(--pod-small, clamp(56px, 17vw, 72px))";
  const titles = createMemo(() =>
    deriveTitles(
      matchRounds(),
      playersOnly(props.snap.players).map((p) => p.id),
    ),
  );
  const moments = () =>
    selectMoments({
      ranked: ranked(),
      titles: titles(),
      rounds: matchRounds(),
      drawings: galleryItems(),
      gameNames: Object.fromEntries(props.snap.catalog.map((g) => [g.id, g.name])),
    });
  const clipInput = (): ClipInput => ({
    people: top().map((r) => ({
      id: r.player.id,
      nickname: r.player.nickname,
      avatar: r.player.avatar,
      cosmetics: r.player.cosmetics,
      rank: r.rank,
      score: formatScore(r.score),
    })),
    celebration: winnerCelebration(winners()),
  });
  const [shareOpen, setShareOpen] = createSignal(false);
  const [inviteOpen, setInviteOpen] = createSignal(false);
  /** Kayıt ekranı oda dışındadır: önce odadan çıkılır, sonra kayıt açılır. */
  const goRegister = (): void => {
    leaveRoom();
    setState("nav", "register");
  };
  const playerOf = (id: string) => props.snap.players.find((p) => p.id === id);

  return (
    <Screen class="final fin">
      <div class="confetti" ref={confetti} aria-hidden="true" />
      <p class="sr-only" role="status" aria-live="polite">
        {announce()}
      </p>
      <header class="topbar">
        <LeaveButton />
        <div class="topbar__end">
          <Show when={ranked().length > 0}>
            <button
              type="button"
              class="icon-btn fin__share"
              aria-label="Anları paylaş"
              onClick={() => setShareOpen(true)}
            >
              <ShareIcon size={22} />
            </button>
          </Show>
          <SoundToggle />
        </div>
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
                  <PodiumPerson
                    player={r.player}
                    rank={r.rank}
                    score={r.score}
                    self={r.player.id === props.snap.selfId}
                    mood={rowMood(r.rank, r.score)}
                    live={r.rank === 1 ? "joy" : undefined}
                    avatarSize={podiumAvatar(r.rank)}
                  />
                  <PodiumBlock rank={r.rank} />
                </div>
              )}
            </For>
            <CharacterStage chars={stageChars()} />
          </div>
        </div>

        <div class="fin__b">
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
                      size={frameOf(r.player.cosmetics) ? 28 : 36}
                      mood={rowMood(r.rank, r.score)}
                      connected={r.player.connected}
                      frame={frameOf(r.player.cosmetics)}
                    />
                    <span class="row__name">
                      <span class="row__who">
                        <span class="row__nick">
                          <PlayerName name={r.player.nickname} cosmetics={r.player.cosmetics} />
                        </span>
                        <PlayerTitle cosmetics={r.player.cosmetics} />
                      </span>
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

          <Show when={state.account}>
            <GlixSummary place={myPlace()} />
            <QuestsDone />
          </Show>

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

          <MatchGallery players={props.snap.players} />

          <Show when={!state.account}>
            <p class="fin__guest">
              <span>
                <Show when={myPlace()} fallback="Hesap açsan Glix ve rozet kazanırdın">
                  {(place) => guestGlixText(place())}
                </Show>
                {" ·"}
              </span>
              <button type="button" class="fin__link" onClick={() => setInviteOpen(true)}>
                Kayıt ol
              </button>
            </p>
          </Show>

          <Show when={!watching()}>
            <FeedbackRow />
          </Show>
          <Watchers players={watchers()} selfId={props.snap.selfId} />
        </div>
      </div>

      <footer class="final__foot">
        <Show when={props.snap.players.length > 1}>
          <button type="button" class="corner-btn" aria-label="Oyuncuyu bildir" onClick={() => openReport()}>
            <FlagIcon size={22} />
          </button>
        </Show>
        <div class="final__main">
          <Show
            when={isHost()}
            fallback={
              <p class="waiting">
                {watching() ? "Lobiye dönünce oyuncu olursun" : "Ev sahibi yeni maçı başlatacak"}
              </p>
            }
          >
            <PrimaryButton class="pbtn--long" onClick={() => returnToLobby()}>
              Tekrar oyna
            </PrimaryButton>
          </Show>
        </div>
        <EmojiFan onPick={react} />
      </footer>
      <ReactionLayer />
      <NewBadgeCard />
      <BottomSheet open={inviteOpen()} onClose={() => setInviteOpen(false)} title="Hesap aç">
        <p class="acct__text">Kayıt olmak için bu odadan çıkman gerekir. Devam edelim mi?</p>
        <div class="sheet__actions">
          <PrimaryButton onClick={goRegister}>Kayıt ol</PrimaryButton>
          <GhostButton size="small" onClick={() => setInviteOpen(false)}>
            Vazgeç
          </GhostButton>
        </div>
      </BottomSheet>
      <ShareSheet open={shareOpen()} onClose={() => setShareOpen(false)} moments={moments} clip={clipInput} />
    </Screen>
  );
}
