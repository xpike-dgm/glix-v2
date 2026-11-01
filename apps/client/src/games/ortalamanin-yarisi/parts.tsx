import type { OrtalamaRoundSummary } from "@glix/engine";
import { For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import {
  exampleLine,
  formatNumber,
  lastChoice,
  leadersTied,
  multiplierLabel,
  multiplierWord,
  roundTable,
  shortName,
  targetName,
} from "./view.js";

/** Küçük zar simgesi (rastgele atanan sayı, OY-M2/U6): metin değil SVG, her boyda okunur. */
export function DiceIcon(props: { size?: number; class?: string }) {
  const n = () => props.size ?? 14;
  return (
    <svg class={props.class} width={n()} height={n()} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="1" width="14" height="14" rx="3.5" fill="#f3f5ff" stroke="#0a1030" stroke-width="1.2" />
      <circle cx="5" cy="5" r="1.4" fill="#0a1030" />
      <circle cx="8" cy="8" r="1.4" fill="#0a1030" />
      <circle cx="11" cy="11" r="1.4" fill="#0a1030" />
    </svg>
  );
}

export interface Entry {
  id: string;
  avatar: number;
  nickname: string;
  connected: boolean;
}

type Mult = { num: number; den: number };

/** Tur kartı (OY-U3): tam ekran "TUR 2 / 3", kesir kadar dolan çubuk, hedefin adı ve sabit örnek. */
export function RoundCard(props: { round: number; rounds: number; multiplier: Mult; leaving?: boolean }) {
  return (
    <div class="ort-card" role="status" aria-live="polite" data-leaving={props.leaving ? "1" : undefined}>
      <b class="ort-card__no">
        TUR {props.round} / {props.rounds}
      </b>
      <div
        class="ort-card__bar"
        style={{ "--f": props.multiplier.num / props.multiplier.den }}
        aria-hidden="true"
      >
        <i />
        <span>{multiplierLabel(props.multiplier)}</span>
      </div>
      <p class="ort-card__goal">Hedef: {targetName(props.multiplier)}</p>
      <p class="ort-card__ex">{exampleLine(props.multiplier)}</p>
    </div>
  );
}

/** Kartın yerleştiği üst şerit: "Tur 2/3 · ⅔ · üçte iki" (glif en az 24 px). */
export function RoundStrip(props: { round: number; rounds: number; multiplier: Mult }) {
  return (
    <div class="ort-strip">
      <span class="ort-strip__no">
        Tur {props.round}/{props.rounds}
      </span>
      <span class="ort-strip__frac" aria-hidden="true">
        {multiplierLabel(props.multiplier)}
      </span>
      <span class="ort-strip__word">
        hedef ortalamanın <b>{multiplierWord(props.multiplier)}</b>
      </span>
    </div>
  );
}

/**
 * Oyuncu kapsülleri (OY-U2, OY-U14): kısa ad, 2. turdan itibaren geçen turun sayısı (rastgeleyse 🎲); kilitleyenin
 * kapsülü ✓, bağlantısı kopanın gri ve "kopuk". 8 kişide iki satır (4 + 4).
 */
export function Pods(props: {
  entries: Entry[];
  selfId: string;
  lockedIds: readonly string[];
  previous: readonly OrtalamaRoundSummary[];
}) {
  return (
    <ul class="ort__pods" data-n={props.entries.length}>
      <For each={props.entries}>
        {(e) => {
          const prev = () => lastChoice(props.previous, e.id);
          const ready = () => props.lockedIds.includes(e.id);
          return (
            <li
              class="ort__podw"
              data-me={e.id === props.selfId ? "1" : undefined}
              data-off={e.connected ? undefined : "1"}
            >
              <span
                class="ort__pod"
                data-ready={ready() ? "1" : undefined}
                style={{ "--c": look(e.avatar).color }}
              >
                {ready() ? "✓" : "?"}
              </span>
              <span class="ort__podname">{e.id === props.selfId ? "Sen" : shortName(e.nickname)}</span>
              <Show when={e.connected} fallback={<span class="ort__podprev ort__podprev--off">kopuk</span>}>
                <Show when={prev()}>
                  {(p) => (
                    <span class="ort__podprev">
                      {p().random ? "🎲" : ""}
                      {p().value}
                    </span>
                  )}
                </Show>
              </Show>
            </li>
          );
        }}
      </For>
    </ul>
  );
}

/**
 * Turların tablosu (OY-U8; izleyicide ara hâli, OY-U13): avatar, ad, tur kutuları (●● = +2, ● = +1, boş = 0, alev =
 * yandı, 🎲 = rastgele), toplam ve sonda genel skora eklenen. Üstte turların hedefleri.
 */
export function RoundsTable(props: {
  entries: Entry[];
  selfId: string;
  played: readonly Pick<OrtalamaRoundSummary, "points" | "burned" | "random" | "target">[];
  rounds: number;
  final: Record<string, number> | null;
  tv?: boolean;
}) {
  const byId = () => new Map(props.entries.map((e) => [e.id, e]));
  const rows = () =>
    roundTable(
      props.entries.map((e) => e.id),
      props.played,
      props.rounds,
      props.final,
    );
  return (
    <div class="ort-tab" data-tv={props.tv ? "1" : undefined}>
      <p class="ort-tab__targets">
        <span>Hedefler</span> {props.played.map((p) => formatNumber(p.target)).join(" → ")}
      </p>
      <Show when={leadersTied(props.final)}>
        <p class="ort-tab__tie">Berabere! Liderler +1</p>
      </Show>
      <ol class="ort-tab__rows" data-n={props.entries.length} data-scroll>
        <For each={rows()}>
          {(row, i) => {
            const e = () => byId().get(row.id);
            const prevTotal = () => rows()[i() - 1]?.total;
            return (
              <li
                class="ort-tab__row"
                data-me={row.id === props.selfId ? "1" : undefined}
                data-same={prevTotal() === row.total ? "1" : undefined}
                data-award={row.award ?? undefined}
                style={{ "--c": look(e()?.avatar ?? 0).color, "--o": `${i() * 70}ms` }}
              >
                <Avatar
                  index={e()?.avatar ?? 0}
                  size={props.tv ? 44 : 26}
                  connected={e()?.connected ?? true}
                />
                <span class="ort-tab__name">
                  {row.id === props.selfId ? "Sen" : (e()?.nickname ?? "Oyuncu")}
                </span>
                <span class="ort-tab__cells">
                  <For each={row.rounds}>
                    {(c, r) => (
                      <span
                        class="ort-tab__cell"
                        data-pts={c?.points ?? undefined}
                        data-burned={c?.burned ? "1" : undefined}
                        data-random={c?.random ? "1" : undefined}
                        data-empty={c ? undefined : "1"}
                        title={`${r() + 1}. tur`}
                      >
                        {c?.random ? <DiceIcon size={16} /> : null}
                        {c?.burned
                          ? "🔥"
                          : c?.random
                            ? ""
                            : c && c.points >= 2
                              ? "●●"
                              : c?.points === 1
                                ? "●"
                                : ""}
                      </span>
                    )}
                  </For>
                </span>
                <span class="ort-tab__total">{row.total}</span>
                <span class="ort-tab__award" data-on={row.award ? "1" : undefined}>
                  <Show when={row.award}>+{row.award}</Show>
                </span>
              </li>
            );
          }}
        </For>
      </ol>
    </div>
  );
}
