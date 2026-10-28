import { createEffect, createSignal, For, Match, onMount, Show, Switch } from "solid-js";
import { earnedSummary } from "../net/badgeRules.js";
import { incomingCount } from "../net/friends.js";
import { badgeText } from "../net/friendsRules.js";
import { balanceText } from "../net/glixRules.js";
import { setLeaderboardFrom } from "../net/leaderboard.js";
import { loadProfile, profileBack, profileOf, profileState, setProfileOf } from "../net/profile.js";
import {
  isEmptyProfile,
  matchLine,
  memberSince,
  type ProfileGame,
  type ProfileInfo,
  percentText,
  whenText,
} from "../net/profileRules.js";
import { goHome, setState, state } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { avatarFromName } from "../ui/avatars.js";
import { BadgeMedal } from "../ui/BadgeMedal.js";
import { frameOf, PlayerName, PlayerTitle } from "../ui/Cosmetic.js";
import { GhostButton } from "../ui/GhostButton.js";
import {
  BackIcon,
  ChevronRightIcon,
  CoinIcon,
  CrownIcon,
  HangerIcon,
  PencilIcon,
  UsersIcon,
} from "../ui/Icons.js";
import { Mascot } from "../ui/Mascot.js";
import { Screen } from "../ui/Screen.js";
import { worldAllowed } from "../ui/world.js";
import { formatScore } from "./ranking.js";
import { UsernameSheet } from "./UsernameSheet.js";

/** Oyun kartı küçük görseli; yüklenemezse (ya da veri tasarrufunda) boş çerçeve kalır. */
function Thumb(props: { id: string }) {
  const [ok, setOk] = createSignal(worldAllowed());
  return (
    <span class="pf__art" aria-hidden="true">
      <Show when={ok()}>
        <img
          src={`/assets/cards/${props.id}.webp`}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          width="800"
          height="450"
          onError={() => setOk(false)}
        />
      </Show>
    </span>
  );
}

function Tile(props: { label: string; value: string; wide?: boolean }) {
  return (
    <div class="pf__tile" data-wide={props.wide ? "1" : undefined}>
      <span class="pf__value" data-text={props.wide ? "1" : undefined}>
        {props.value}
      </span>
      <span class="pf__label">{props.label}</span>
    </div>
  );
}

function GameRow(props: { game: ProfileGame }) {
  return (
    <li class="pf__row">
      <Thumb id={props.game.gameId} />
      <span class="pf__text">
        <span class="pf__name">{props.game.name}</span>
        <span class="pf__meta">
          {props.game.plays} oynama · {props.game.wins} birincilik · en iyi {formatScore(props.game.bestMini)}
        </span>
      </span>
    </li>
  );
}

/** Rozetler: kazanılan parlak ve adlı; kazanılmamış sönük ve açıklamalı; gizli olan "???". */
function Badges(props: { profile: ProfileInfo; own: boolean }) {
  const list = () => props.profile.badges;
  return (
    <Show when={list().length > 0}>
      <section class="set__group">
        <div class="bd__head">
          <h2 class="set__head">Rozetler</h2>
          <Show when={props.own}>
            <span class="bd__count">{earnedSummary(list())}</span>
          </Show>
        </div>
        <ul class="bd__grid">
          <For each={list()}>
            {(b) => (
              <li class="bd__item" data-earned={b.earned ? "1" : "0"}>
                <BadgeMedal id={b.id} earned={b.earned} secret={b.secret} />
                <span class="bd__name">{b.name}</span>
                <Show when={!b.earned}>
                  <span class="bd__desc">{b.description}</span>
                </Show>
                <Show when={b.earned}>
                  <span class="sr-only">Kazanıldı</span>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}

function Details(props: { profile: ProfileInfo }) {
  const now = Date.now();
  const p = () => props.profile;
  return (
    <>
      <div class="pf__tiles">
        <Tile label="Maç" value={String(p().totals.matches)} />
        <Tile label="Galibiyet" value={String(p().totals.wins)} />
        <Tile label="Galibiyet oranı" value={`%${percentText(p().totals.winRate)}`} />
        <Tile wide label="Favori oyun" value={p().favoriteGame?.name ?? "—"} />
      </div>

      <Show when={p().perGame.length > 0}>
        <section class="set__group">
          <h2 class="set__head">Oyunlar</h2>
          <ul class="set__card pf__list">
            <For each={p().perGame}>{(g) => <GameRow game={g} />}</For>
          </ul>
        </section>
      </Show>

      <Show when={p().recent.length > 0}>
        <section class="set__group">
          <h2 class="set__head">Son maçlar</h2>
          <ul class="set__card pf__list">
            <For each={p().recent}>
              {(m) => (
                <li class="pf__row" data-first={m.place === 1 ? "1" : undefined}>
                  {/* Birincilik rengin yanında tacla da belirtilir (renk körlüğü). */}
                  <span class="pf__place" aria-hidden="true">
                    <Show when={m.place === 1} fallback={<span>{m.place}.</span>}>
                      <CrownIcon size={24} />
                    </Show>
                  </span>
                  <span class="pf__text">
                    <span class="pf__name">{m.place}. sıra</span>
                    <span class="pf__meta">{matchLine(m)}</span>
                  </span>
                  <span class="pf__when">{whenText(m.endedAt, now)}</span>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      <Show when={p().coPlayers.length > 0}>
        <section class="set__group">
          <h2 class="set__head">En çok birlikte oynadıkların</h2>
          <ul class="set__card pf__list">
            <For each={p().coPlayers}>
              {(c) => (
                <li class="pf__row">
                  <Avatar index={avatarFromName(c.username)} size={36} />
                  <span class="pf__text">
                    <span class="pf__name">{c.username}</span>
                  </span>
                  <span class="pf__when">{c.matches} maç</span>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </>
  );
}

/** Kendi profilinin üstündeki iki kapı: Arkadaşlar (istek sayısıyla) ve Kullanıcı adını değiştir. */
function Hub(props: { onRename: () => void }) {
  const count = (): number => incomingCount();
  return (
    <section class="pf__hub rise" style={{ "--i": 1 }} aria-label="Hesabım">
      <div class="set__card">
        <button
          type="button"
          class="set__row set__row--btn hub__row"
          aria-label={count() > 0 ? `Arkadaşlar, ${count()} yeni istek` : "Arkadaşlar"}
          onClick={() => setState("nav", "friends")}
        >
          <span class="hub__icon" aria-hidden="true">
            <UsersIcon size={24} />
          </span>
          <span class="set__text">
            <span class="set__label">Arkadaşlar</span>
            <span class="set__hint">Ekle, davet et, birlikte oyna</span>
          </span>
          <Show when={badgeText(count())}>
            {(text) => (
              <b class="home__badge" aria-hidden="true">
                {text()}
              </b>
            )}
          </Show>
          <ChevronRightIcon size={20} class="hub__chev" />
        </button>
        <button
          type="button"
          class="set__row set__row--btn hub__row"
          onClick={() => {
            setLeaderboardFrom("profile");
            setState("nav", "leaderboard");
          }}
        >
          <span class="hub__icon" aria-hidden="true">
            <CrownIcon size={24} />
          </span>
          <span class="set__text">
            <span class="set__label">Arkadaş sıralaması</span>
            <span class="set__hint">Bu hafta ve tüm zamanlar</span>
          </span>
          <ChevronRightIcon size={20} class="hub__chev" />
        </button>
        <button
          type="button"
          class="set__row set__row--btn hub__row"
          onClick={() => setState("nav", "locker")}
        >
          <span class="hub__icon" aria-hidden="true">
            <HangerIcon size={24} />
          </span>
          <span class="set__text">
            <span class="set__label">Dolabım</span>
            <span class="set__hint">Lakap, ad efekti ve çerçeveni seç</span>
          </span>
          <ChevronRightIcon size={20} class="hub__chev" />
        </button>
        <button type="button" class="set__row set__row--btn hub__row" onClick={props.onRename}>
          <span class="hub__icon" aria-hidden="true">
            <PencilIcon size={24} />
          </span>
          <span class="set__text">
            <span class="set__label">Kullanıcı adını değiştir</span>
            <span class="set__hint">Oyunda ve arkadaş listelerinde bu adla görünürsün</span>
          </span>
          <ChevronRightIcon size={20} class="hub__chev" />
        </button>
      </div>
    </section>
  );
}

export function Profile() {
  const [renameOpen, setRenameOpen] = createSignal(false);
  onMount(() => void loadProfile());
  // Arkadaşın profilinden geri: arkadaş listesine; kendi profilinden: ana sayfaya.
  const back = (): void => {
    if (profileOf() === null) {
      goHome();
      return;
    }
    setProfileOf(null);
    setState("nav", profileBack());
  };
  // Oturum düşerse (başka sekmede çıkış) ana sayfaya dönülür.
  createEffect(() => {
    if (!state.account) goHome();
  });
  const ready = (): ProfileInfo | null => {
    const s = profileState();
    return s.kind === "ready" ? s.profile : null;
  };
  const failure = (): string | null => {
    const s = profileState();
    return s.kind === "error" ? s.message : null;
  };
  const username = (): string => ready()?.username ?? profileOf() ?? state.account?.username ?? "";

  return (
    <Screen class="set pf">
      <header class="topbar">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={back}>
          <BackIcon size={26} />
        </button>
        <h1 class="set__title display">Profil</h1>
        <span class="set__spacer" aria-hidden="true" />
      </header>

      <div class="set__body" data-scroll>
        <div class="pf__head rise" style={{ "--i": 0 }}>
          <Avatar index={avatarFromName(username())} size={72} frame={frameOf(ready()?.cosmetics)} />
          <h2 class="pf__user">
            <PlayerName name={username()} cosmetics={ready()?.cosmetics} />
          </h2>
          <PlayerTitle cosmetics={ready()?.cosmetics} plate />
          <Show when={ready()}>
            {(p) => (
              <p class="pf__since">
                Üyelik: {memberSince(p().createdAt)}
                <Show when={p().glix !== null}>
                  <span
                    class="pf__bal"
                    role="status"
                    aria-label={`Glix bakiyen ${balanceText(p().glix ?? 0)}`}
                  >
                    <CoinIcon size={14} />
                    {balanceText(p().glix ?? 0)}
                  </span>
                </Show>
              </p>
            )}
          </Show>
        </div>

        <Show when={profileOf() === null && state.account}>
          <Hub onRename={() => setRenameOpen(true)} />
        </Show>

        <Switch>
          <Match when={failure()}>
            {(message) => (
              <div class="pf__empty" role="alert">
                <Mascot pose="baglanti-koptu" size="var(--mascot-sm, 72px)" />
                <p class="pf__note">{message()}</p>
                <GhostButton onClick={() => void loadProfile()}>Tekrar dene</GhostButton>
              </div>
            )}
          </Match>
          <Match when={ready()}>
            {(p) => (
              <>
                <Show
                  when={!isEmptyProfile(p())}
                  fallback={
                    <div class="pf__empty rise" style={{ "--i": 1 }}>
                      <Mascot pose="merhaba" size="var(--mascot-lg, clamp(96px, 30vw, 150px))" />
                      <p class="pf__note">
                        {profileOf() === null ? "Henüz maç yok — bir oda kur!" : "Henüz maç yok."}
                      </p>
                    </div>
                  }
                >
                  <Details profile={p()} />
                </Show>
                <Badges profile={p()} own={profileOf() === null} />
              </>
            )}
          </Match>
          <Match when={true}>
            <p class="pf__note" role="status">
              Yükleniyor…
            </p>
          </Match>
        </Switch>
      </div>

      <UsernameSheet open={renameOpen()} onClose={() => setRenameOpen(false)} />
    </Screen>
  );
}
