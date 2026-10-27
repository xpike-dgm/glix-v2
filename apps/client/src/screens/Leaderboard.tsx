import { createEffect, For, onCleanup, onMount, Show } from "solid-js";
import {
  chooseMetric,
  choosePeriod,
  leaderboardFrom,
  leaderboardLoad,
  leaderGames,
  leaderRows,
  loadLeaderboard,
  metric,
  period,
  resetLeaderboard,
} from "../net/leaderboard.js";
import {
  allZero,
  isAlone,
  type LeaderRow,
  METRIC_LABEL,
  METRICS,
  PERIOD_LABEL,
  PERIODS,
  rowLabel,
  showsCrown,
  valueText,
} from "../net/leaderboardRules.js";
import { setProfileBack, setProfileOf } from "../net/profile.js";
import { goHome, setState, state } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { avatarFromName } from "../ui/avatars.js";
import { GhostButton } from "../ui/GhostButton.js";
import { BackIcon, CrownIcon } from "../ui/Icons.js";
import { Mascot } from "../ui/Mascot.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";

/** Arkadaş sıralaması: sen + kabul edilmiş arkadaşların. Satıra dokununca o kişinin profili açılır. */
export function Leaderboard() {
  onMount(() => void loadLeaderboard());
  onCleanup(resetLeaderboard);
  // Oturum düşerse (başka sekmede çıkış) ana sayfaya dönülür.
  createEffect(() => {
    if (!state.account) goHome();
  });

  const back = (): void => setState("nav", leaderboardFrom());
  const openProfile = (r: LeaderRow): void => {
    setProfileOf(r.you ? null : r.username);
    setProfileBack("leaderboard");
    setState("nav", "profile");
  };
  const alone = () => leaderboardLoad() === "ready" && isAlone(leaderRows());
  const showList = () => leaderboardLoad() === "ready" && !isAlone(leaderRows());

  return (
    <Screen class="set lb">
      <header class="topbar">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={back}>
          <BackIcon size={26} />
        </button>
        <h1 class="set__title display">Sıralama</h1>
        <span class="set__spacer" aria-hidden="true" />
      </header>

      <div class="set__body" data-scroll>
        <div class="lb__tabs rise" style={{ "--i": 0 }} role="tablist" aria-label="Dönem">
          <For each={PERIODS}>
            {(p) => (
              <button
                type="button"
                role="tab"
                class="lb__tab"
                aria-selected={period() === p}
                onClick={() => choosePeriod(p)}
              >
                {PERIOD_LABEL[p]}
              </button>
            )}
          </For>
        </div>
        <div class="lb__chips rise" style={{ "--i": 1 }} role="group" aria-label="Ölçü">
          <For each={METRICS}>
            {(m) => (
              <button
                type="button"
                class="lb__chip"
                aria-pressed={metric() === m}
                onClick={() => chooseMetric(m)}
              >
                {METRIC_LABEL[m]}
              </button>
            )}
          </For>
        </div>

        <Show when={leaderboardLoad() === "loading"}>
          <p class="pf__note" role="status">
            Yükleniyor…
          </p>
        </Show>

        <Show when={leaderboardLoad() === "error"}>
          <div class="pf__empty" role="alert">
            <Mascot pose="baglanti-koptu" size="var(--mascot-sm, 72px)" />
            <p class="pf__note">Sıralama şu an yüklenemedi.</p>
            <GhostButton onClick={() => void loadLeaderboard()}>Tekrar dene</GhostButton>
          </div>
        </Show>

        <Show when={alone()}>
          <div class="pf__empty rise" style={{ "--i": 2 }}>
            <Mascot pose="merhaba" size="var(--mascot-lg, clamp(96px, 30vw, 150px))" />
            <p class="pf__note">Sıralama için arkadaş ekle</p>
            <PrimaryButton onClick={() => setState("nav", "friends")}>Arkadaşlar</PrimaryButton>
          </div>
        </Show>

        <Show when={showList()}>
          <Show when={allZero(leaderRows())}>
            <p class="lb__hint" role="status">
              {period() === "week" ? "Bu hafta henüz maç oynanmadı." : "Henüz maç oynanmadı."}
            </p>
          </Show>
          <ol class="set__card pf__list lb__list" aria-label="Sıralama">
            <For each={leaderRows()}>
              {(r) => (
                <li
                  class="lb__li"
                  data-you={r.you ? "1" : undefined}
                  data-first={showsCrown(r) ? "1" : undefined}
                >
                  <button
                    type="button"
                    class="lb__row"
                    aria-label={rowLabel(metric(), r)}
                    onClick={() => openProfile(r)}
                  >
                    {/* Birincilik rengin yanında tacla da belirtilir (renk körlüğü). */}
                    <span class="pf__place" aria-hidden="true">
                      <Show when={showsCrown(r)} fallback={<span>{r.rank}.</span>}>
                        <CrownIcon size={24} />
                      </Show>
                    </span>
                    <Avatar index={avatarFromName(r.username)} size={36} />
                    <span class="pf__text">
                      <span class="pf__name">{r.username}</span>
                      <Show when={r.you}>
                        <span class="lb__you">Sen</span>
                      </Show>
                    </span>
                    <span class="lb__value">{valueText(metric(), r.value)}</span>
                  </button>
                </li>
              )}
            </For>
          </ol>

          <Show when={leaderGames().length > 0}>
            <section class="set__group">
              <h2 class="set__head">Oyun liderleri</h2>
              <ul class="set__card pf__list">
                <For each={leaderGames()}>
                  {(g) => (
                    <li class="pf__row lb__game">
                      <Avatar index={avatarFromName(g.leader.username)} size={36} />
                      <span class="pf__text">
                        <span class="pf__name">{g.name}</span>
                        <span class="pf__meta">
                          {g.leader.username} · {g.leader.wins} birincilik
                          <Show when={g.you.wins > 0 && g.leader.username !== state.account?.username}>
                            {" "}
                            · Sen {g.you.wins}
                          </Show>
                        </span>
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>
        </Show>
      </div>
    </Screen>
  );
}
