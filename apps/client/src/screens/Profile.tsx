import { createEffect, createSignal, For, Match, onMount, Show, Switch } from "solid-js";
import { loadProfile, profileState } from "../net/profile.js";
import {
  isEmptyProfile,
  matchLine,
  memberSince,
  type ProfileGame,
  type ProfileInfo,
  percentText,
  whenText,
} from "../net/profileRules.js";
import { goHome, state } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { avatarFromName } from "../ui/avatars.js";
import { GhostButton } from "../ui/GhostButton.js";
import { BackIcon, CrownIcon } from "../ui/Icons.js";
import { Mascot } from "../ui/Mascot.js";
import { Screen } from "../ui/Screen.js";
import { worldAllowed } from "../ui/world.js";
import { formatScore } from "./ranking.js";

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

export function Profile() {
  onMount(() => void loadProfile());
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
  const username = (): string => ready()?.username ?? state.account?.username ?? "";

  return (
    <Screen class="set pf">
      <header class="topbar">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={goHome}>
          <BackIcon size={26} />
        </button>
        <h1 class="set__title display">Profil</h1>
        <span class="set__spacer" aria-hidden="true" />
      </header>

      <div class="set__body" data-scroll>
        <div class="pf__head rise" style={{ "--i": 0 }}>
          <Avatar index={avatarFromName(username())} size={72} />
          <h2 class="pf__user">{username()}</h2>
          <Show when={ready()}>{(p) => <p class="pf__since">Üyelik: {memberSince(p().createdAt)}</p>}</Show>
        </div>

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
              <Show
                when={!isEmptyProfile(p())}
                fallback={
                  <div class="pf__empty rise" style={{ "--i": 1 }}>
                    <Mascot pose="merhaba" size="var(--mascot-lg, clamp(96px, 30vw, 150px))" />
                    <p class="pf__note">Henüz maç yok — bir oda kur!</p>
                  </div>
                }
              >
                <Details profile={p()} />
              </Show>
            )}
          </Match>
          <Match when={true}>
            <p class="pf__note" role="status">
              Yükleniyor…
            </p>
          </Match>
        </Switch>
      </div>
    </Screen>
  );
}
