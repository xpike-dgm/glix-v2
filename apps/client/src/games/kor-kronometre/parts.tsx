import type { KorKronometreEntry, KorKronometreStanding, PlayerInfo } from "@glix/engine";
import { createEffect, For, type JSX, Show } from "solid-js";
import { colorBlind } from "../../settings/settings.js";
import { Avatar } from "../../ui/Avatar.js";
import {
  dropped,
  formatOffset,
  formatSeconds,
  markOf,
  needleFrac,
  ordinal,
  pointsLabel,
  targetPercent,
  targetSeconds,
  trackPercent,
} from "./view.js";

const LockIcon = (p: { size?: number }) => (
  <svg width={p.size ?? 22} height={p.size ?? 22} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="10.5" width="14" height="10" rx="2.2" fill="currentColor" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.6" />
  </svg>
);

export type PressState = "wait" | "live" | "locked" | "try" | "tried";

/**
 * KR-U2: metal kronometre düğmesi (gümüş kenar, kalın "BAS", en az 96 px). Basınca yeşil bir düğmeye dönmez: gömülü,
 * soluk bir plaka ve kilit simgesiyle "KİLİTLENDİ". "Hazır ol"da soluk "Bekle…" (KR-U3). Basma alanı yalnız düğmedir
 * (KR-U8). İzleyicide "Sen de dene" (KR-U9).
 */
export function PressButton(props: { state: PressState; onPress: () => void }): JSX.Element {
  const label = (): string =>
    props.state === "wait"
      ? "Bekle…"
      : props.state === "locked"
        ? "KİLİTLENDİ"
        : props.state === "try"
          ? "Sen de dene"
          : props.state === "tried"
            ? "Denedin"
            : "BAS";
  const aria = (): string =>
    props.state === "locked"
      ? "Basışın kilitlendi"
      : props.state === "wait"
        ? "Bekle"
        : props.state === "try"
          ? "Sen de dene"
          : props.state === "tried"
            ? "Denedin"
            : "Bas";
  const active = () => props.state === "live" || props.state === "try";
  const down = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    if (active()) props.onPress();
  };
  return (
    <button
      type="button"
      class="kro-btn"
      data-state={props.state}
      aria-label={aria()}
      aria-disabled={active() ? undefined : "true"}
      onPointerDown={down}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (active()) props.onPress();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span class="kro-btn__face">
        <Show when={props.state === "locked" || props.state === "tried"}>
          <LockIcon />
        </Show>
        <span class="kro-btn__label">{label()}</span>
      </span>
    </button>
  );
}

/**
 * KR-U5 / KR-U16: zaman çizgisi. Hedef beyaz kesik çizgi ve "11" etiketi; ibre soldan sağa koşar, geçtiği basış
 * anında oyuncunun avatarı çizgiye düşer. İşaretler ★ (+2), ● (2. derece), ○ (diğerleri); renk körü modunda nokta
 * üstünde derece. `elapsed` null ise ibre yok, hepsi yerinde (hareket azaltma ya da sabit görünüm).
 */
export function Track(props: {
  entries: readonly KorKronometreEntry[];
  targetMs: number;
  /** Açılışın başından geçen süre (ms); null: sabit. */
  elapsed: number | null;
  playerOf: (id: string) => PlayerInfo | undefined;
  selfId: string;
  avatar: number;
  /** İzleyicinin kendi denemesi (KR-U9; "BAŞLA!"dan ms). */
  trial?: number | null;
  tv?: boolean;
}): JSX.Element {
  const pressed = () => props.entries.filter((e) => e.pressed && e.ms !== null);
  const frac = () => (props.elapsed === null ? 1 : needleFrac(props.elapsed));
  const isDown = (pct: number) => props.elapsed === null || dropped(props.elapsed, pct);
  const tPct = () => targetPercent(props.targetMs);
  return (
    <div class="kro-track" data-tv={props.tv ? "1" : undefined} style={{ "--av": `${props.avatar}px` }}>
      <div class="kro-track__line" aria-hidden="true">
        <i
          class="kro-track__target"
          style={{ left: `${tPct()}%` }}
          data-hit={frac() * 100 >= tPct() ? "1" : undefined}
        >
          <span class="kro-track__tlabel">{targetSeconds(props.targetMs)}</span>
        </i>
        <Show when={props.elapsed !== null && frac() < 1}>
          <i class="kro-track__needle" style={{ left: `${frac() * 100}%` }} />
        </Show>
        <i class="kro-track__trail" style={{ width: `${frac() * 100}%` }} />
        <For each={pressed()}>
          {(e, i) => {
            const pct = () => trackPercent(e.ms ?? 0, props.targetMs);
            const p = () => props.playerOf(e.playerId);
            return (
              <span
                class="kro-track__pin"
                data-down={isDown(pct()) ? "1" : undefined}
                data-me={e.playerId === props.selfId ? "1" : undefined}
                data-mark={markOf(e) ?? undefined}
                data-lift={i() % 2 === 1 ? "1" : undefined}
                style={{ left: `${pct()}%` }}
              >
                <span class="kro-track__av">
                  <Avatar index={p()?.avatar ?? 0} size={props.avatar} connected={p()?.connected ?? true} />
                </span>
                <i class="kro-track__mark">
                  {markOf(e) === "star" ? "★" : markOf(e) === "dot" ? "●" : "○"}
                  <Show when={colorBlind() && e.rank !== null}>
                    <sup class="kro-track__rank">{e.rank}</sup>
                  </Show>
                </i>
              </span>
            );
          }}
        </For>
        <Show when={props.trial != null && frac() >= 1}>
          <span
            class="kro-track__pin kro-track__pin--trial"
            data-down="1"
            style={{ left: `${trackPercent(props.trial ?? 0, props.targetMs)}%` }}
          >
            <i class="kro-track__mark">◇</i>
          </span>
        </Show>
      </div>
    </div>
  );
}

/** KR-U6: oyun sonu satırları (toplam sıralaması): derece rozeti, avatar, ad, son elin farkı ve anı, el puanları, ödül. */
export function FinalRows(props: {
  standings: readonly KorKronometreStanding[];
  lastEntries: readonly KorKronometreEntry[];
  lastTargetMs: number;
  playerOf: (id: string) => PlayerInfo | undefined;
  selfId: string;
  /** Hareket azaltma: görünen satır sayısı (satırlar 0,3 sn arayla belirir); null: hepsi. */
  visible: number | null;
  /** İzleyici satırı (KR-U9): son eldeki deneme farkı. */
  trial?: string | null;
  tv?: boolean;
}): JSX.Element {
  let list: HTMLOListElement | undefined;
  createEffect(() => {
    // Kendi satırın ekran dışına taşarsa liste ona kayar.
    if (props.standings.length === 0) return;
    queueMicrotask(() => {
      // Yalnız listenin kendisi kayar (scrollIntoView ekranın kaydırılabilir atalarını da kaydırırdı).
      const row = list?.querySelector<HTMLElement>('[data-me="1"]');
      if (!list || !row) return;
      const top = row.offsetTop - list.offsetTop;
      const bottom = top + row.offsetHeight;
      if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
      else if (top < list.scrollTop) list.scrollTop = top;
    });
  });
  return (
    <ol class="kro-rows" ref={list} data-scroll data-tv={props.tv ? "1" : undefined}>
      <For each={props.standings}>
        {(s, i) => {
          const p = () => props.playerOf(s.playerId);
          const last = () => props.lastEntries.find((e) => e.playerId === s.playerId) ?? null;
          return (
            <li
              class="kro-row rise"
              style={{ "--i": i() }}
              data-hidden={props.visible !== null && i() >= props.visible ? "1" : undefined}
              data-me={s.playerId === props.selfId ? "1" : undefined}
              data-award={s.award}
              data-missed={s.pressedHands === 0 ? "1" : undefined}
            >
              <span class="kro-row__avwrap">
                <Avatar
                  index={p()?.avatar ?? 0}
                  size={props.tv ? 64 : 34}
                  connected={p()?.connected ?? true}
                />
                <span class="kro-row__rank" data-r={s.rank <= 2 && s.total > 0 ? s.rank : undefined}>
                  {ordinal(s.rank)}
                </span>
              </span>
              <span class="kro-row__who">
                <span class="kro-row__name">{p()?.nickname ?? "Oyuncu"}</span>
                <span class="kro-row__sub">
                  <Show
                    when={last()?.pressed && last()?.ms != null}
                    fallback={<span class="kro-row__off">son el: basmadı</span>}
                  >
                    <Show
                      when={last()?.bullseye}
                      fallback={
                        <span class="kro-row__off">
                          son el: {formatOffset(last()?.ms ?? 0, props.lastTargetMs)}
                        </span>
                      }
                    >
                      <b class="kro-row__stamp">TAM İSABET</b>
                    </Show>
                    <span class="kro-row__at">{formatSeconds(last()?.ms ?? 0)}</span>
                  </Show>
                </span>
              </span>
              <span class="kro-row__hands">
                <For each={s.handPoints}>
                  {(hp) => (
                    <i class="kro-row__hp" data-p={hp ?? "x"}>
                      {hp === null ? "–" : hp}
                    </i>
                  )}
                </For>
              </span>
              <span class="kro-row__total">{s.total}</span>
              <b class="kro-row__award" data-pts={s.award}>
                {s.total > 0 || s.pressedHands > 0 ? pointsLabel(s.award) : "–"}
              </b>
            </li>
          );
        }}
      </For>
      <Show when={props.trial}>
        {(t) => (
          <li class="kro-row kro-row--trial">
            <span class="kro-row__who">
              <span class="kro-row__name">Sen (izleyici) · {t()}</span>
            </span>
          </li>
        )}
      </Show>
    </ol>
  );
}

/** KR-M3 şerit: avatarlar ve toplam el puanları; kopan oyuncu gri (KR-U11). */
export function Strip(props: {
  players: readonly PlayerInfo[];
  totals: Record<string, number>;
  selfId: string;
  /** Az önce kazanılan el puanı (el arasında "+2"). */
  gains?: Record<string, number> | null;
}): JSX.Element {
  return (
    <ul class="kro-strip" aria-label="Toplam el puanları">
      <For each={props.players}>
        {(p) => (
          <li
            class="kro-strip__cell"
            data-me={p.id === props.selfId ? "1" : undefined}
            data-off={p.connected ? undefined : "1"}
          >
            <span class="kro-strip__av">
              <Avatar index={p.avatar} size={30} connected={p.connected} />
              <Show when={(props.gains?.[p.id] ?? 0) > 0}>
                <b class="kro-strip__gain">+{props.gains?.[p.id]}</b>
              </Show>
            </span>
            <span class="kro-strip__pts">{props.totals[p.id] ?? 0}</span>
          </li>
        )}
      </For>
    </ul>
  );
}
