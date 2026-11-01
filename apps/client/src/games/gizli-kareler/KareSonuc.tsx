import type { KarelerPublicView, KareReveal } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { hapticJackpot, hapticLong, hapticMatch, hapticTick } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { Avatar } from "../../ui/Avatar.js";
import { CbState } from "../../ui/CbState.js";
import { karelerProp } from "../../ui/props.js";
import { Ozet } from "./Ozet.js";
import {
  beamSweep,
  chestBreak,
  chestClose,
  chestOpen,
  clashGlass,
  flipClick,
  ghostHum,
  goldNote,
} from "./sounds.js";
import {
  bonusLine,
  bonusOutcome,
  cellCard,
  cellCrowd,
  cellGain,
  cellName,
  flipPlan,
  ghostHits,
  ghostsByCell,
  groupByCell,
  hintText,
  shortName,
  stageHead,
  statusOf,
  whoColumns,
} from "./view.js";

export interface SonucEntry {
  id: string;
  avatar: number;
  nickname: string;
  connected: boolean;
}

interface Props {
  v: KarelerPublicView;
  /** 1. aşama sonucu mu (false), son sonuç mu (true: 2. aşama). */
  final: boolean;
  entries: SonucEntry[];
  selfId: string;
  spectator: boolean;
  /** Ekranın saati (sunucu saati, sık güncellenir). */
  now: () => number;
  /** TV: büyük düzen, dokunma kartı yok. */
  tv?: boolean;
}

/** GK-U7 zaman çizelgesi (kareler döndükten sonra, ms). */
export const BEAM_DELAY_MS = 300;
export const BEAM_MS = 1_500;
export const COMPASS_DELAY_MS = 700;
export const COMPASS_STEP_MS = 450;

const OfflineIcon = () => (
  <svg class="koff" viewBox="0 0 24 24" aria-hidden="true">
    <title>Bağlantı yok</title>
    <path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0" />
    <circle cx="12" cy="19" r="1.4" />
    <path d="M3 3l18 18" />
  </svg>
);

export function KareSonuc(props: Props) {
  const size = () => props.v.size;
  const reveal = (): KareReveal | null => (props.final ? props.v.stage2Reveal : props.v.stage1);
  const r2 = () => (props.final ? props.v.stage2Reveal : null);
  const anchor = () => (props.final ? (props.v.stage2?.endsAt ?? props.v.endsAt) : props.v.endsAt);
  const byId = createMemo(() => new Map(props.entries.map((e) => [e.id, e])));
  const nameOf = (id: string): string => byId().get(id)?.nickname ?? "Oyuncu";
  const groups = createMemo(() => {
    const rv = reveal();
    return rv ? groupByCell(rv) : new Map<number, string[]>();
  });
  const ghostCells = createMemo(() => ghostsByCell(r2()));
  const cells = () => Array.from({ length: size() * size() }, (_, i) => i);
  const amGhost = () => !props.spectator && r2() !== null && props.selfId in (r2()?.ghosts ?? {});
  const myStatus = () => (props.spectator ? null : statusOf(reveal(), props.selfId));
  const myCell = (): number | null => {
    if (props.spectator) return null;
    const c = reveal()?.choices[props.selfId];
    if (c !== undefined && c !== null) return c;
    return r2()?.ghosts[props.selfId] ?? null;
  };
  const plan = createMemo(() => flipPlan(size(), groups(), myCell(), ghostCells()));
  const reduced = reducedMotion();
  const t = () => (reduced ? Number.POSITIVE_INFINITY : props.now() - anchor());
  const flipped = (cell: number): boolean => t() >= (plan().at.get(cell) ?? 0);
  const headOn = () => t() >= plan().end;

  const bonus = () => (props.final ? props.v.bonus : null);
  const beamAt = () => plan().end + BEAM_DELAY_MS;
  const chestAt = () => beamAt() + BEAM_MS;
  const beamOn = () => bonus() !== null && t() >= beamAt() && t() < chestAt();
  const chestOn = () => bonus() !== null && t() >= chestAt();
  const outcome = () => {
    const b = bonus();
    return b ? bonusOutcome(b, groups(), ghostCells()) : null;
  };
  const compassIds = createMemo(() => Object.keys(r2()?.compass ?? {}));
  const compassAt = () => chestAt() + COMPASS_DELAY_MS;
  const compassShown = () =>
    Math.max(0, Math.min(compassIds().length, Math.floor((t() - compassAt()) / COMPASS_STEP_MS) + 1));
  const summaryAt = () => {
    if (props.final) return compassAt() + compassIds().length * COMPASS_STEP_MS + 300;
    // Oyun 1. aşamada bitiyorsa özet başlıktan biraz sonra.
    return plan().end + 1_500;
  };
  const isEnd = () => props.final || props.v.stage2 === null;
  const summaryOn = () => isEnd() && t() >= summaryAt();

  const total = () => props.v.points?.[props.selfId] ?? 0;
  const wonBonus = () => bonus()?.winner === props.selfId && bonus() !== null;

  const head = () => {
    const cell = myCell();
    const mates = cell === null ? [] : (groups().get(cell) ?? []).filter((id) => id !== props.selfId);
    const rv = r2();
    return stageHead({
      final: props.final,
      status: myStatus(),
      cell,
      size: size(),
      mates: mates.map(nameOf),
      walkover: !props.final && props.v.walkover === props.selfId,
      // Ödül başlığı ödül anına kadar beklenir.
      wonBonus: wonBonus() && chestOn(),
      ghost: amGhost(),
      ghostHits: rv && amGhost() ? ghostHits(rv, props.selfId).map(nameOf) : [],
      ghostPicked: myCell() !== null,
      spectator: props.spectator,
      soloCount: Object.values(reveal()?.status ?? {}).filter((s) => s === "solo").length,
    });
  };
  const note = (): string => {
    if (!headOn() || props.final) return "";
    if (props.v.stage2 !== null) {
      return props.v.stage2.players.length === 1
        ? `${nameOf(props.v.stage2.players[0] ?? "")} hayaletlere karşı yarışacak`
        : "Tek kalanlar 2. aşamaya geçti · elenenler hayalet olur";
    }
    if (props.v.walkover !== null) {
      return props.v.walkover === props.selfId
        ? "Rakipsiz kaldın: bir +1 daha!"
        : `${nameOf(props.v.walkover)} rakipsiz kaldı: +1 daha`;
    }
    return "Kimse kalmadı, puan yok";
  };

  // GK-U11: açılıştan sonra kareye dokun → kart.
  const [picked, setPicked] = createSignal<number | null>(null);
  const card = () => {
    const c = picked();
    if (c === null || !headOn()) return null;
    return cellCard(
      c,
      size(),
      (groups().get(c) ?? []).map(nameOf),
      (ghostCells().get(c) ?? []).map(nameOf),
      chestOn() && bonus()?.cell === c,
    );
  };

  const passive = createMemo(() =>
    Object.keys(reveal()?.status ?? {}).filter((id) => statusOf(reveal(), id) === "passive"),
  );

  // GK-U16: sesler ve titreşim yalnız canlı geçişlerde (geç katılan ya da hareket azaltmada sessiz başlar).
  const flipCount = () => [...plan().at.values()].filter((at) => t() >= at).length;
  createEffect(
    on(flipCount, (n, prev) => {
      if (prev === undefined || n <= prev || reduced) return;
      flipClick();
    }),
  );
  createEffect(
    on(headOn, (onNow, prev) => {
      if (!onNow || prev !== false) return;
      if (r2() && Object.values(r2()?.ghosts ?? {}).some((c) => c !== null)) ghostHum();
      const s = myStatus();
      if (s === "solo") {
        goldNote();
        hapticMatch();
      } else if (s === "clash" || s === "haunted") {
        clashGlass();
        hapticLong();
      } else if ([...groups().values()].some((g) => g.length > 1)) {
        clashGlass();
        hapticTick();
      } else goldNote();
    }),
  );
  createEffect(
    on(beamOn, (b, prev) => {
      if (b && prev === false) beamSweep();
    }),
  );
  createEffect(
    on(chestOn, (c, prev) => {
      if (!c || prev !== false) return;
      const o = outcome();
      if (o === "win") {
        chestOpen();
        if (wonBonus()) hapticJackpot();
      } else if (o === "clash" || o === "haunted") chestBreak();
      else chestClose();
    }),
  );

  const chestSrc = () => {
    const o = outcome();
    return o === "win" ? karelerProp("sandik-acik") : karelerProp("sandik-kapali");
  };
  const bonusText = () => {
    const b = bonus();
    const o = outcome();
    if (!b || !o) return null;
    return bonusLine(
      o,
      b.winner === null ? null : nameOf(b.winner),
      (groups().get(b.cell) ?? []).includes(props.selfId),
    );
  };

  return (
    <div
      class="kres"
      data-final={props.final ? "1" : undefined}
      data-tv={props.tv ? "1" : undefined}
      data-beam={beamOn() ? "1" : undefined}
      data-summary={summaryOn() ? "1" : undefined}
    >
      <div class="kres__head" role="status" aria-live="polite">
        <span class="overline">{props.final ? "2. aşama sonucu" : "1. aşama sonucu"}</span>
        <Show
          when={headOn()}
          fallback={
            <span class="kres__val" data-k="n">
              Kareler açılıyor…
            </span>
          }
        >
          <span class="kres__val" data-k={head().kind}>
            {head().text}
          </span>
        </Show>
        <Show when={!props.spectator}>
          <span class="kres__total" data-pos={total() > 0 ? "1" : undefined}>
            Toplam: +{total()}
          </span>
        </Show>
        <Show when={note()}>
          <span class="kres__note">{note()}</span>
        </Show>
      </div>

      <div class="kstage">
        <div class="kboard" style={{ "--n": size() }} data-tv={props.tv ? "1" : undefined}>
          <span class="kboard__corner" aria-hidden="true" />
          <For each={Array.from({ length: size() }, (_, i) => i)}>
            {(c) => (
              <span class="kboard__col" aria-hidden="true">
                {String.fromCharCode(65 + c)}
              </span>
            )}
          </For>
          <For each={Array.from({ length: size() }, (_, i) => i)}>
            {(r) => (
              <span class="kboard__row" aria-hidden="true" style={{ "grid-row": r + 2 }}>
                {r + 1}
              </span>
            )}
          </For>
          <div class="kgrid" style={{ "--n": size() }}>
            <For each={cells()}>
              {(cell) => {
                const ids = () => groups().get(cell) ?? [];
                const gh = () => ghostCells().get(cell) ?? [];
                const state = (): "empty" | "solo" | "clash" =>
                  ids().length === 0 ? "empty" : ids().length === 1 ? "solo" : "clash";
                const haunted = () => state() === "solo" && gh().length > 0;
                const isBonus = () => chestOn() && bonus()?.cell === cell;
                const crowd = () => cellCrowd(ids());
                const gain = () =>
                  haunted() ? "" : cellGain(state(), chestOn() && bonus()?.winner === ids()[0]);
                const label = () =>
                  `${cellName(cell, size())}: ${
                    ids().length === 0
                      ? "boş"
                      : `${ids().map(nameOf).join(" ve ")}${ids().length > 1 ? " çakıştı" : ""}`
                  }${gh().length > 0 ? `, hayalet ${gh().map(nameOf).join(" ve ")}` : ""}${isBonus() ? ", ödül karesi" : ""}`;
                return (
                  <button
                    type="button"
                    class="kcell kcell--res"
                    data-flip={flipped(cell) ? "1" : undefined}
                    data-state={state()}
                    data-haunted={haunted() ? "1" : undefined}
                    data-has={ids().length + gh().length > 0 ? "1" : undefined}
                    data-mine={myCell() === cell ? "1" : undefined}
                    data-picked={picked() === cell ? "1" : undefined}
                    data-bonus={isBonus() ? (outcome() ?? "none") : undefined}
                    style={{
                      "--i": cell,
                      "--ph": `${((cell * 7919) % 23) * -170}ms`,
                      "--cols": whoColumns(crowd().shown.length + (crowd().more > 0 ? 1 : 0)),
                    }}
                    aria-label={label()}
                    disabled={props.tv === true}
                    onClick={() => setPicked((p) => (p === cell ? null : cell))}
                  >
                    <i class="kcell__back" aria-hidden="true" />
                    <Show when={state() === "empty"}>
                      <i class="kcell__core" />
                    </Show>
                    <em class="kcell__name" aria-hidden="true">
                      {cellName(cell, size())}
                    </em>
                    <Show when={state() === "solo" && !haunted()}>
                      <i class="kcell__beam" />
                    </Show>
                    <span class="kcell__who">
                      <For each={crowd().shown}>
                        {(id, k) => {
                          const e = () => byId().get(id);
                          return (
                            <span
                              class="kwho"
                              data-status={statusOf(reveal(), id) ?? undefined}
                              data-me={id === props.selfId ? "1" : undefined}
                              style={{ "--k": k() }}
                            >
                              <Avatar
                                index={e()?.avatar ?? 0}
                                size="var(--as)"
                                connected={e()?.connected ?? true}
                              />
                              <Show when={state() === "solo"}>
                                <span class="kwho__name">{shortName(e()?.nickname ?? "")}</span>
                              </Show>
                            </span>
                          );
                        }}
                      </For>
                      <Show when={crowd().more > 0}>
                        <span class="kwho kwho--more">+{crowd().more}</span>
                      </Show>
                    </span>
                    <Show when={gh().length > 0}>
                      <span class="kcell__ghosts" aria-hidden="true">
                        <For each={gh().slice(0, 3)}>
                          {(id) => (
                            <span class="kghost" data-me={id === props.selfId ? "1" : undefined}>
                              <Avatar index={byId().get(id)?.avatar ?? 0} size="var(--gs)" />
                            </span>
                          )}
                        </For>
                        <i class="kghost__mark">👻</i>
                      </span>
                    </Show>
                    <Show when={isBonus()}>
                      <span class="kchest" data-o={outcome() ?? "none"} aria-hidden="true">
                        <Show when={chestSrc()} fallback={<i class="kchest__css" />}>
                          {(src) => <img class="kchest__img" src={src()} alt="" draggable={false} />}
                        </Show>
                      </span>
                      <CbState kind="star" size={24} class="kcell__cb kcell__cb--bonus" />
                    </Show>
                    <Show when={state() === "clash" || haunted()}>
                      <CbState kind="bad" size={16} class="kcell__cb kcell__cb--clash" />
                    </Show>
                    <Show when={gain()}>
                      <em class="kcell__pts">{gain()}</em>
                    </Show>
                  </button>
                );
              }}
            </For>
            <Show when={beamOn() && bonus()}>
              {(b) => (
                <i
                  class="kbeam"
                  aria-hidden="true"
                  style={{ "--bx": b().cell % size(), "--by": Math.floor(b().cell / size()) }}
                />
              )}
            </Show>
          </div>
          <Show when={chestOn() && outcome() === "win"}>
            <span class="kconfetti" aria-hidden="true">
              <For each={Array.from({ length: 18 }, (_, i) => i)}>{(i) => <i style={{ "--c": i }} />}</For>
            </span>
          </Show>
        </div>
      </div>

      <Show when={card()}>
        {(c) => (
          <p class="kcard" role="status">
            {c()}
          </p>
        )}
      </Show>

      <Show when={chestOn() && !summaryOn() && bonusText()}>
        {(b) => (
          <p class="kbonus" data-o={outcome() ?? "none"} role="status">
            <b>{b().title}</b> {b().sub}
          </p>
        )}
      </Show>

      <Show when={compassShown() > 0 && !summaryOn()}>
        <ul class="kcomp" aria-label="Pusulalar">
          <For each={compassIds().slice(0, compassShown())}>
            {(id) => {
              const h = () => r2()?.compass[id];
              return (
                <li class="kcomp__row" data-me={id === props.selfId ? "1" : undefined}>
                  <span class="kcomp__ico" aria-hidden="true">
                    🧭
                  </span>
                  <b>{id === props.selfId ? "Sen" : nameOf(id)}:</b>{" "}
                  <Show when={h()}>{(x) => hintText(x())}</Show>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>

      <Show when={summaryOn()}>
        <Ozet v={props.v} entries={props.entries} selfId={props.selfId} spectator={props.spectator} />
      </Show>

      <Show when={!summaryOn() && passive().length > 0 && headOn()}>
        <div class="kpassive">
          <span class="kpassive__label">Seçmedi</span>
          <For each={passive()}>
            {(id) => {
              const off = () => byId().get(id)?.connected === false;
              return (
                <span
                  class="kpassive__who"
                  data-me={id === props.selfId ? "1" : undefined}
                  data-off={off() ? "1" : undefined}
                  title={off() ? `${nameOf(id)}: bağlantı yok` : `${nameOf(id)}: seçmedi`}
                >
                  <Avatar
                    index={byId().get(id)?.avatar ?? 0}
                    size="clamp(20px, 3.2dvh, 24px)"
                    connected={byId().get(id)?.connected ?? true}
                  />
                  <Show when={off()}>
                    <OfflineIcon />
                    <span class="sr-only">bağlantı yok</span>
                  </Show>
                </span>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
