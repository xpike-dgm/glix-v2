import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { hapticMatch, hapticSingle, hapticSolo } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { BottomSheet } from "../../ui/BottomSheet.js";
import { AllianceBadge, Seal } from "./Art.js";
import type { CrewMember } from "./Pazarlik.js";
import { allianceChime, betrayal, cardRustle, counterTick, ding, keptBell } from "./sounds.js";
import {
  alliancesOf,
  arrowPath,
  awardText,
  CARD_LEAD_MS,
  CARD_MS,
  CARD_NAME_MS,
  cardAt,
  cardVerdict,
  finalAt,
  genitive,
  type IttifakScreenView,
  LABEL_ICON,
  LABEL_ORDER,
  LABEL_TEXT,
  labelsOf,
  promiseRows,
  readingOrder,
  ringPosition,
  type Story,
  storyOf,
  summaryLine,
} from "./view.js";

interface Props {
  view: IttifakScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  now: () => number;
  /** Oyun sonu yorumu (IT-AI1, ihanet muhabiri); yoksa null. */
  comment: string | null;
  /** Büyük ekran: kendi hikâye kartı ve düğmeler yok. */
  tv?: boolean;
}

/**
 * "Oylar okunuyor" (IT-U5): oylar tek tek, en az oy alanlara gidenlerden lider(ler)e doğru okunur; her kartta söz
 * denetimi (SÖZ TUTULDU / İHANET! / zar attı). Son tabloda oklar, İTTİFAK bağları, etiketler (IT-U6), ödüller (IT-M1)
 * ve kendi hikâyen (IT-U7).
 */
export function Sonuc(props: Props) {
  const reveal = () => props.view.reveal;
  const order = createMemo(() => props.crew.map((m) => m.id));
  const nameOf = (id: string) => props.crew.find((m) => m.id === id)?.nickname ?? "Oyuncu";
  const member = (id: string | null | undefined) => props.crew.find((m) => m.id === id) ?? null;
  const nodes = createMemo(() =>
    props.crew.map((m, i) => ({
      m,
      pos: ringPosition(i, props.crew.length, 37),
      color: look(m.avatar).color,
    })),
  );
  const at = (id: string) => nodes().find((n) => n.m.id === id);
  const cards = createMemo(() => {
    const r = reveal();
    return r ? readingOrder(r, order()) : [];
  });
  const elapsed = () => Math.max(0, props.now() - props.view.voteEndsAt);
  const step = () => cardAt(elapsed(), cards().length);
  const final = () => elapsed() >= finalAt(cards().length);
  /** Okunmuş kart sayısı (adı açılan kart dahil). */
  const read = () => {
    const s = step();
    return final() ? cards().length : Math.max(0, s.index + (s.named ? 1 : 0));
  };
  const current = () => {
    const s = step();
    return final() || s.index < 0 ? null : (cards()[s.index] ?? null);
  };
  const verdict = () => {
    const c = current();
    const r = reveal();
    return c && r ? cardVerdict(r, c.from) : null;
  };
  const counts = createMemo(() => {
    const out: Record<string, number> = {};
    for (const f of cards().slice(0, read())) out[f.to] = (out[f.to] ?? 0) + 1;
    return out;
  });

  /** Oklar: karşılıklı oylar yana kayar (üst üste binmez); zarla atananlar kesikli. */
  const arrows = createMemo(() => {
    const r = reveal();
    if (!r) return [];
    return cards().flatMap((f, idx) => {
      const a = at(f.from);
      const b = at(f.to);
      if (!a || !b) return [];
      const mutual = r.votes[f.to] === f.from;
      return [
        {
          ...f,
          idx,
          ...arrowPath(a.pos, b.pos, 9, mutual ? 1.6 : 0),
          color: a.color,
          random: r.random.includes(f.from),
        },
      ];
    });
  });
  const alliances = createMemo(() => {
    const r = reveal();
    return r ? alliancesOf(r, order()) : [];
  });
  const labels = createMemo(() => {
    const r = reveal();
    return r ? labelsOf(r, order()) : {};
  });
  const summary = () => summaryLine(alliances().length, labels());
  const rows = createMemo(() => {
    const r = reveal();
    return r ? promiseRows(r, order(), props.selfId) : [];
  });
  const story = createMemo(() => {
    const r = reveal();
    return r ? storyOf(r, order(), props.selfId) : null;
  });
  const leaders = createMemo(() => {
    const r = reveal();
    if (!r) return [];
    return order().filter((id) => (r.awards[id] ?? 0) === 2);
  });
  const [sheet, setSheet] = createSignal(false);
  const reduced = reducedMotion();
  /** 7–8 oyuncuda etiketler ad şeridine işlenir (renk + simge) ve altta açıklama satırı çıkar (IT-U9). */
  const crowd = () => props.crew.length >= 7;

  // Sesler ve titreşim: her olay bir kez; sayfa açılışın ortasında açılırsa geçmiş olaylar sessiz geçer.
  const fired = new Set<string>();
  const once = (key: string, dueAt: number, fn: () => void): void => {
    if (fired.has(key) || elapsed() < dueAt) return;
    fired.add(key);
    if (elapsed() - dueAt < 700) fn();
  };
  createEffect(
    on(elapsed, () => {
      const list = cards();
      const r = reveal();
      if (!r) return;
      for (const [i, f] of list.entries()) {
        const start = CARD_LEAD_MS + i * CARD_MS;
        once(`card${i}`, start, () => cardRustle(i));
        once(`name${i}`, start + CARD_NAME_MS, () => {
          counterTick();
          const v = cardVerdict(r, f.from);
          if (v.kind === "kept") keptBell();
          else if (v.kind === "betray" || v.others.length > 0) betrayal();
          if (!props.spectator && f.to === props.selfId) {
            ding();
            hapticSingle();
          }
        });
      }
      once("final", finalAt(list.length), () => {
        if (alliances().length > 0) allianceChime();
        if (props.spectator) return;
        if ((r.awards[props.selfId] ?? 0) > 0) {
          matchSound();
          hapticMatch();
        } else {
          soloSound();
          hapticSolo();
        }
      });
    }),
  );

  const storyCard = (s: Story, cls: string) => (
    <div class={`it__story ${cls}`}>
      <p class="it__story-row">
        <span class="it__story-k">Sana oy verenler</span>
        <Show when={s.voters.length > 0} fallback={<span>Kimse sana oy vermedi</span>}>
          <span class="it__story-v">
            <For each={s.voters}>
              {(id) => (
                <span class="it__who">
                  <Avatar index={member(id)?.avatar ?? 0} size={20} />
                  {nameOf(id)}
                </span>
              )}
            </For>
          </span>
        </Show>
      </p>
      <Show when={s.promisers.length > 0}>
        <p class="it__story-row">
          <span class="it__story-k">Sana söz verenler</span>
          <span class="it__story-v">
            <For each={s.promisers}>
              {(p) => (
                <span class="it__who" data-kept={p.kept ? "1" : "0"}>
                  <Show when={!p.kept}>
                    <Seal broken class="it__who-seal" />
                  </Show>
                  {nameOf(p.from)} {p.kept ? "✓" : "✗"}
                </span>
              )}
            </For>
          </span>
        </p>
      </Show>
      <Show when={s.myVote}>
        {(to) => (
          <p class="it__story-row">
            <span class="it__story-k">Senin oyun</span>
            <span class="it__story-v">
              {nameOf(to())}
              {s.random
                ? " · oy vermedin, zar attı 🎲"
                : s.myPromise === "kept"
                  ? " · sözünü tuttun ✓"
                  : s.myPromise === "broken"
                    ? " · sözünü bozdun ✗"
                    : ""}
            </span>
          </p>
        )}
      </Show>
    </div>
  );

  /** Ekran okuyucu için okunan kart. */
  const spoken = () => {
    const c = current();
    const v = verdict();
    if (!c || !v || !step().named) return "";
    const what =
      v.kind === "kept"
        ? " Söz tutuldu."
        : v.kind === "betray"
          ? " İhanet!"
          : v.kind === "dice"
            ? " Oy vermedi, zar attı."
            : "";
    return `${nameOf(c.from)}, ${nameOf(c.to)} adlı oyuncuya oy verdi.${what}`;
  };

  return (
    <div
      class="it__res"
      data-final={final() ? "1" : undefined}
      data-tv={props.tv ? "1" : undefined}
      data-reduced={reduced ? "1" : undefined}
    >
      <div class="it__head it__head--reveal">
        <Show
          when={final()}
          fallback={
            <>
              <span class="overline">Oylar okunuyor</span>
              <span class="it__title">
                {Math.min(cards().length, Math.max(0, step().index + 1))}/{cards().length}
              </span>
            </>
          }
        >
          <span class="overline">{summary() || "Oylar açıldı"}</span>
          <Show
            when={!props.spectator}
            fallback={
              <span class="it__title it__title--small">
                En çok oy: {leaders().map(nameOf).join(", ") || "yok"}
                {alliances().length > 0 ? ` · ${alliances().length} ittifak` : ""}
              </span>
            }
          >
            <span class="it__award" data-zero={(story()?.award ?? 0) === 0 ? "1" : undefined}>
              <Show when={reveal()}>{(r) => awardText(r(), props.selfId)}</Show>
            </span>
            <span class="it__verdict">
              {(story()?.votes ?? 0) === 0 ? "Kimse sana oy vermedi" : `${story()?.votes ?? 0} oy aldın`}
            </span>
          </Show>
        </Show>
      </div>

      <div class="it__stage">
        <div class="it__arena" data-crowd={props.crew.length >= 7 ? "1" : undefined}>
          <svg class="it__lines" viewBox="0 0 100 100" aria-hidden="true">
            <Show when={final()}>
              <For each={alliances()}>
                {([a, b]) => {
                  const p = () => at(a)?.pos;
                  const q = () => at(b)?.pos;
                  return (
                    <Show when={p() && q()}>
                      <g class="it__ally">
                        <line x1={p()?.x} y1={p()?.y} x2={q()?.x} y2={q()?.y} class="it__ally-glow" />
                        <line x1={p()?.x} y1={p()?.y} x2={q()?.x} y2={q()?.y} class="it__ally-line" />
                      </g>
                    </Show>
                  );
                }}
              </For>
            </Show>
            <For each={arrows()}>
              {(b) => (
                <Show when={b.idx < read()}>
                  <g
                    class="it__arrow"
                    data-random={b.random ? "1" : undefined}
                    data-now={!final() && b.idx === step().index ? "1" : undefined}
                    style={{ color: b.color }}
                  >
                    <line class="it__glow" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} pathLength="1" />
                    <line class="it__beam" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} pathLength="1" />
                    <polygon class="it__head-tip" points={b.head} />
                  </g>
                </Show>
              )}
            </For>
          </svg>

          <For each={nodes()}>
            {(n) => {
              const surprised = () => {
                const v = verdict();
                return step().named && v !== null && v.kind !== "dice" && v.others.includes(n.m.id);
              };
              const reading = () => current()?.from === n.m.id;
              const target = () => current()?.to === n.m.id && step().named;
              return (
                <div
                  class="it__node"
                  data-me={n.m.id === props.selfId ? "1" : undefined}
                  data-reading={reading() ? "1" : undefined}
                  data-target={target() ? "1" : undefined}
                  style={{ left: `${n.pos.x}%`, top: `${n.pos.y}%` }}
                >
                  <Avatar index={n.m.avatar} size="var(--it-av)" connected={n.m.connected} />
                  <Show when={surprised()}>
                    <span class="it__gasp" aria-hidden="true">
                      !
                    </span>
                  </Show>
                  <span class="it__name" data-label={final() && crowd() ? labels()[n.m.id] : undefined}>
                    {final() && crowd() && labels()[n.m.id]
                      ? `${LABEL_ICON[labels()[n.m.id] ?? "eri"]} ${n.m.nickname}`
                      : n.m.nickname}
                  </span>
                  <span class="it__chip" data-zero={(counts()[n.m.id] ?? 0) === 0 ? "1" : undefined}>
                    {counts()[n.m.id] ?? 0} oy
                  </span>
                  <Show when={final() && (reveal()?.awards[n.m.id] ?? 0) > 0}>
                    <span class="it__prize">+{reveal()?.awards[n.m.id] ?? 0}</span>
                  </Show>
                </div>
              );
            }}
          </For>

          <Show when={final() && !crowd()}>
            <For each={nodes()}>
              {(n) => (
                <Show when={labels()[n.m.id]}>
                  {(l) => (
                    <span
                      class="it__label"
                      data-label={l()}
                      style={{ left: `${n.pos.x}%`, top: `${n.pos.y}%` }}
                    >
                      {LABEL_TEXT[l()]}
                    </span>
                  )}
                </Show>
              )}
            </For>
          </Show>
          <Show when={final()}>
            <For each={alliances()}>
              {([a, b]) => {
                const p = () => at(a)?.pos;
                const q = () => at(b)?.pos;
                return (
                  <Show when={p() && q()}>
                    <span
                      class="it__ally-at"
                      style={{
                        // Kenardaki iki koltuğun ortası rozetin yarısını ekran dışına itiyordu: kenardan pay bırakılır.
                        left: `clamp(48px, ${((p()?.x ?? 0) + (q()?.x ?? 0)) / 2}%, calc(100% - 48px))`,
                        top: `${((p()?.y ?? 0) + (q()?.y ?? 0)) / 2}%`,
                      }}
                    >
                      <AllianceBadge />
                    </span>
                  </Show>
                );
              }}
            </For>
          </Show>

          <Show when={current()}>
            {(c) => (
              <div class="it__card" data-named={step().named ? "1" : undefined}>
                <span class="it__card-who">{genitive(nameOf(c().from))} oyu…</span>
                <Show when={step().named}>
                  <b class="it__card-to">→ {nameOf(c().to).toLocaleUpperCase("tr")}</b>
                  <Show when={verdict()}>
                    {(v) => (
                      <>
                        <Show when={v().kind === "kept"}>
                          <span class="it__stamp" data-k="kept">
                            SÖZ TUTULDU ✓
                          </span>
                        </Show>
                        <Show when={v().kind === "betray"}>
                          <span class="it__stamp" data-k="betray">
                            <Seal broken class="it__stamp-seal" />
                            İHANET!
                          </span>
                        </Show>
                        <Show when={v().kind === "dice"}>
                          <span class="it__stamp" data-k="dice">
                            🎲 oy vermedi, zar attı
                          </span>
                        </Show>
                        <Show when={v().kind === "kept" && v().others.length > 0}>
                          <small class="it__card-also">
                            ({v().others.map(nameOf).join(", ")} adlı oyuncuya da söz vermişti)
                          </small>
                        </Show>
                      </>
                    )}
                  </Show>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </div>

      <Show when={final() && crowd() && Object.keys(labels()).length > 0}>
        <p class="it__legend">
          <For each={LABEL_ORDER.filter((l) => Object.values(labels()).includes(l))}>
            {(l) => (
              <span data-label={l}>
                {LABEL_ICON[l]} {LABEL_TEXT[l]}
              </span>
            )}
          </For>
        </p>
      </Show>
      <Show when={final() && !props.tv}>
        <div class="it__after">
          <Show when={!props.spectator && story()}>{(st) => storyCard(st(), "it__story--inline")}</Show>
          <Show when={props.comment}>
            {(c) => (
              <p class="it__comment">
                <span class="it__comment-tag">Muhabir</span>
                <span>{c()}</span>
              </p>
            )}
          </Show>
          <Show when={!props.spectator}>
            <button type="button" class="it__all" onClick={() => setSheet(true)}>
              {rows().length > 0 ? `Hikâyen ve bütün sözler (${rows().length})` : "Senin hikâyen"}
            </button>
          </Show>
        </div>
      </Show>
      <p class="it__hint">En çok oy +2, ikinci +1</p>
      <p class="sr-only" aria-live="polite">
        {spoken()}
      </p>

      <BottomSheet open={sheet()} onClose={() => setSheet(false)} title="Hikâyen ve sözler">
        <Show when={story()}>{(st) => storyCard(st(), "it__story--sheet")}</Show>
        <ul class="it__promise-list">
          <For each={rows()}>
            {(r) => (
              <li
                class="it__promise"
                data-kept={r.kept ? "1" : "0"}
                data-me={r.from === props.selfId ? "1" : undefined}
              >
                <span class="it__promise-text">
                  {nameOf(r.from)} → {nameOf(r.to)}
                </span>
                <b class="it__promise-mark">
                  {r.kept ? "✓ tuttu" : "✗ bozdu"}
                  {r.random ? " · oy vermedi" : ""}
                </b>
              </li>
            )}
          </For>
        </ul>
      </BottomSheet>
    </div>
  );
}
