// biome-ignore-all lint/a11y/noSvgWithoutTitle: çizgiler ve koyun simgesi dekoratif; anlamı yanındaki metin taşır
import type { CagrisimGroup, CagrisimReveal, PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { createSequence } from "../../fx/sequence.js";
import { Avatar } from "../../ui/Avatar.js";
import { CbMarker } from "../../ui/CbMarker.js";
import { Hub } from "./Hub.js";
import { burstSound, fizzSound, flipTick, linkSound } from "./sounds.js";
import { chipList, ringPlan, ringPoint, type Stamp, shortName } from "./view.js";

/** Ağları ayıran neon renkler (oyuncu renk dizisiyle aynı palet). */
export const GROUP_COLORS = [
  "var(--cyan)",
  "var(--magenta)",
  "var(--amber)",
  "var(--lime)",
  "var(--violet)",
  "var(--p6)",
];
export const groupColor = (i: number): string => GROUP_COLORS[i % GROUP_COLORS.length] ?? "var(--cyan)";

/** Küçük koyun simgesi (CG-U7). Görsel gelene kadar SVG; puan etkisi yok. */
export function SheepIcon(props: { size?: number }) {
  const s = () => props.size ?? 22;
  return (
    <svg class="cgsheep" width={s()} height={s()} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="11" r="4.2" fill="currentColor" />
      <circle cx="13" cy="9.5" r="4.4" fill="currentColor" />
      <circle cx="15.5" cy="12.5" r="3.8" fill="currentColor" />
      <circle cx="11" cy="14" r="4" fill="currentColor" />
      <ellipse cx="18.6" cy="10.6" rx="2.6" ry="2.2" fill="#2a2440" />
      <circle cx="19.3" cy="10.1" r="0.55" fill="#fff" />
      <path d="M9 17.5v3M14 17.5v3" stroke="#2a2440" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  );
}

const byId = (players: PlayerInfo[], id: string): PlayerInfo | undefined => players.find((p) => p.id === id);

/** Ağ kutusu: cevap, "n kişi", birleşen yazılışlar, avatarlar ve kısa isimler (CG-U6, CG-U8, CG-M3). */
export function Cluster(props: {
  group: CagrisimGroup;
  index: number;
  players: PlayerInfo[];
  selfId: string;
  compact?: boolean;
  /** Mini açılış: isim çipleri (en çok `chips`), avatar yok. */
  chips?: number;
  seq?: "in" | "out" | undefined;
  final?: boolean;
}) {
  const color = () => groupColor(props.index);
  const members = () =>
    props.group.members.map((id) => byId(props.players, id)).filter((p): p is PlayerInfo => p !== undefined);
  const size = () =>
    `min(${props.compact ? 36 : 40}px, calc((100vw - 96px) / ${Math.min(4, Math.max(2, members().length))}))`;
  const chips = () => chipList(members(), props.chips ?? 0);
  return (
    <li
      class="cl"
      style={{
        "--gc": color(),
        "--i": props.seq === undefined ? props.index : 0,
        "--n": Math.min(4, members().length),
      }}
      data-seq={props.seq}
      data-final={props.final ? "1" : undefined}
      data-me={props.group.members.includes(props.selfId) ? "1" : undefined}
      data-chips={props.chips ? "1" : undefined}
    >
      <div class="cl__top">
        <CbMarker index={props.index} size={16} class="cl__cb" />
        <span class="cl__text">{props.group.text}</span>
        <span class="cl__pts">{props.group.members.length} kişi</span>
      </div>
      <Show when={props.group.variants.length > 1}>
        <p class="cl__vars">({props.group.variants.join(", ")})</p>
      </Show>
      <Show
        when={props.chips}
        fallback={
          <div class="cl__row" data-many={members().length > 4 ? "1" : undefined}>
            <For each={members()}>
              {(p) => (
                <div class={p.id === props.selfId ? "cl__m cl__me" : "cl__m"}>
                  <Avatar
                    index={p.avatar}
                    size={size()}
                    ring={p.id === props.selfId ? "#ffffff" : color()}
                    connected={p.connected}
                  />
                  <span class="cl__name">{shortName(p.nickname, p.id === props.selfId)}</span>
                </div>
              )}
            </For>
          </div>
        }
      >
        <div class="cgnchips">
          <For each={chips().shown}>
            {(p) => (
              <span class="cgnchip" data-me={p.id === props.selfId ? "1" : undefined}>
                {shortName(p.nickname, p.id === props.selfId)}
              </span>
            )}
          </For>
          <Show when={chips().more > 0}>
            <span class="cgnchip cgnchip--more">+{chips().more} kişi</span>
          </Show>
        </div>
      </Show>
    </li>
  );
}

/** Tek kalanlar ("Elif · ördek") ve yazmayanlar: "Yazmadı" / "Bağlantı koptu" (CG-U8, CG-U12). */
export function LoneList(props: {
  reveal: CagrisimReveal;
  players: PlayerInfo[];
  selfId: string;
  stamp: Stamp;
  seq?: "in" | "out" | undefined;
}) {
  const name = (id: string): string => {
    const p = byId(props.players, id);
    return p ? shortName(p.nickname, id === props.selfId) : "Oyuncu";
  };
  const offline = (id: string): boolean => byId(props.players, id)?.connected === false;
  return (
    <Show when={props.reveal.singles.length + props.reveal.silent.length > 0}>
      <ul class="lone" data-seq={props.seq}>
        <For each={props.reveal.singles}>
          {(s) => (
            <li class="lone__it" data-me={s.playerId === props.selfId ? "1" : undefined}>
              <Avatar index={byId(props.players, s.playerId)?.avatar ?? 0} size={30} ring="var(--text-dim)" />
              <span class="lone__text">
                <b>{name(s.playerId)}</b> · {s.text}
              </span>
              <Show when={props.stamp?.kind === "sheep" && props.stamp.playerId === s.playerId}>
                <SheepIcon size={20} />
              </Show>
            </li>
          )}
        </For>
        <For each={props.reveal.silent}>
          {(id) => (
            <li class="lone__it lone__it--silent" data-me={id === props.selfId ? "1" : undefined}>
              <Avatar
                index={byId(props.players, id)?.avatar ?? 0}
                size={30}
                ring="var(--text-dim)"
                connected={!offline(id)}
              />
              <span class="lone__text">
                <b>{name(id)}</b> · {offline(id) ? "Bağlantı koptu" : "Yazmadı"}
              </span>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}

/** Damga satırı (CG-U7): "TEK YÜREK" ya da "KARA KOYUN · bu sefer farklı düşündü". */
export function StampLine(props: { stamp: Stamp; players: PlayerInfo[]; selfId: string }) {
  return (
    <Show when={props.stamp}>
      {(s) => (
        <p class="cgstamp" data-kind={s().kind} role="status">
          <Show
            when={s().kind === "sheep" ? (s() as { playerId: string }) : null}
            fallback={<span class="cgstamp__big">TEK YÜREK</span>}
          >
            {(sheep) => (
              <>
                <SheepIcon size={22} />
                <span class="cgstamp__big">KARA KOYUN</span>
                <span class="cgstamp__small">
                  {shortName(
                    byId(props.players, sheep().playerId)?.nickname ?? "Biri",
                    sheep().playerId === props.selfId,
                  )}{" "}
                  bu sefer farklı düşündü
                </span>
              </>
            )}
          </Show>
        </p>
      )}
    </Show>
  );
}

interface NodeGeom {
  x: number;
  y: number;
}

/**
 * Gerçek ağ açılışı (CG-U5): küre ortada, oyuncular çevresinde halka. Önce herkesin kartı ters belirir, tek kalanlar tek
 * tek söner, ağlar küçükten büyüğe neon çizgilerle küreye bağlanır (düğümde cevap ve kişi sayısı), en büyük ağ en son
 * "EN BÜYÜK AĞ" ve kısa patlama. Hareket azaltmada her şey çizili gelir. Bitince `onDone`.
 */
export function NetworkRing(props: {
  reveal: CagrisimReveal;
  word: string;
  players: PlayerInfo[];
  /** Halkadaki oyuncular (sıra sabit). */
  order: string[];
  selfId: string;
  startedAt: number;
  budgetMs: number;
  stamp: Stamp;
  sound: boolean;
  onDone?: () => void;
}) {
  const plan = createMemo(() => ringPlan(props.reveal));
  const seq = createSequence({
    steps: () => plan().steps,
    startAt: () => props.startedAt,
    budgetMs: () => props.budgetMs,
  });
  const n = () => props.order.length;
  const point = (id: string): NodeGeom => ringPoint(Math.max(0, props.order.indexOf(id)), n(), 40);
  const shown = (step: number): boolean => seq.shown() > step;
  const groupOf = (id: string): number => props.reveal.groups.findIndex((g) => g.members.includes(id));
  const textOf = (id: string): string | null => {
    const g = groupOf(id);
    if (g >= 0) return props.reveal.groups[g]?.text ?? null;
    return props.reveal.singles.find((s) => s.playerId === id)?.text ?? null;
  };
  /**
   * Ağ düğümleri: üyelerin ortalama yönünde, küre ile halka arasında. Üyeler karşılıklı duruyorsa (ortalama küreye
   * düşer) ilk üyenin yönü; iki düğüm üst üste gelecekse sonraki 40° kaydırılır.
   */
  const nodes = createMemo((): NodeGeom[] => {
    const taken: number[] = [];
    return props.reveal.groups.map((g) => {
      let sx = 0;
      let sy = 0;
      for (const id of g.members) {
        const p = point(id);
        sx += p.x - 50;
        sy += p.y - 50;
      }
      if (Math.hypot(sx, sy) < 10) {
        const first = point(g.members[0] ?? "");
        sx = first.x - 50;
        sy = first.y - 50;
      }
      let angle = Math.atan2(sy, sx);
      const near = (a: number): boolean =>
        taken.some((t) => Math.abs(Math.atan2(Math.sin(a - t), Math.cos(a - t))) < (35 * Math.PI) / 180);
      for (let k = 0; k < 8 && near(angle); k++) angle += (40 * Math.PI) / 180;
      taken.push(angle);
      return { x: 50 + Math.cos(angle) * 24, y: 50 + Math.sin(angle) * 24 };
    });
  });
  const nodeOf = (i: number): NodeGeom => nodes()[i] ?? { x: 50, y: 50 };
  const heart = () => props.stamp?.kind === "heart";

  // Sesler: adım ilerledikçe (yalnız oynayan dizide).
  createEffect(
    on(seq.shown, (count, prev) => {
      if (!props.sound || prev === undefined || seq.attr(0) === undefined) return;
      for (let step = prev; step < count; step++) {
        if (step === 0) flipTick();
        const g = plan().groupStep.indexOf(step);
        if (g >= 0) {
          if (plan().champion === g) burstSound();
          else linkSound(props.reveal.groups[g]?.members.length ?? 2);
        } else if (step > 0) fizzSound();
      }
    }),
  );
  createEffect(
    on(seq.done, (done) => {
      if (done) props.onDone?.();
    }),
  );

  return (
    <div
      class="cgring"
      data-heart={heart() ? "1" : undefined}
      data-anim={seq.attr(0) === undefined ? undefined : "1"}
    >
      <svg class="cgring__lines" viewBox="0 0 100 100" aria-hidden="true">
        <For each={props.reveal.groups}>
          {(g, i) => {
            const node = () => (heart() ? { x: 50, y: 50 } : nodeOf(i()));
            return (
              <g
                class="cgring__net"
                style={{ "--gc": groupColor(i()) }}
                data-on={shown(plan().groupStep[i()] ?? 0) ? "1" : undefined}
              >
                <For each={g.members}>
                  {(id) => {
                    const p = point(id);
                    return <line x1={p.x} y1={p.y} x2={node().x} y2={node().y} pathLength="1" />;
                  }}
                </For>
                <Show when={!heart()}>
                  <line x1={node().x} y1={node().y} x2="50" y2="50" pathLength="1" />
                </Show>
              </g>
            );
          }}
        </For>
      </svg>
      <div class="cgring__hub">
        <Hub word={props.word} gold={heart()} />
      </div>
      <For each={props.reveal.groups}>
        {(g, i) => {
          const node = () => nodeOf(i());
          return (
            <Show when={!heart()}>
              <div
                class="cgring__node"
                style={{ "--gc": groupColor(i()), left: `${node().x}%`, top: `${node().y}%` }}
                data-on={shown(plan().groupStep[i()] ?? 0) ? "1" : undefined}
                data-champ={plan().champion === i() ? "1" : undefined}
              >
                <CbMarker index={i()} size={12} />
                <span class="cgring__nodetext">{g.text}</span>
                <span class="cgring__nodecount">{g.members.length} kişi</span>
              </div>
            </Show>
          );
        }}
      </For>
      <For each={props.order}>
        {(id) => {
          const p = point(id);
          const player = () => byId(props.players, id);
          const g = () => groupOf(id);
          const flip = () => plan().flipAt[id] ?? 0;
          const state = (): string =>
            !shown(0) ? "hidden" : !shown(flip()) ? "back" : g() >= 0 ? "net" : "lone";
          return (
            <div
              class="cgring__p"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                "--gc": g() >= 0 ? groupColor(g()) : "var(--text-dim)",
              }}
              data-state={state()}
              data-me={id === props.selfId ? "1" : undefined}
            >
              <Avatar
                index={player()?.avatar ?? 0}
                size="var(--cgav)"
                ring={id === props.selfId ? "#ffffff" : undefined}
                connected={player()?.connected !== false}
              />
              <span class="cgring__card">
                <span class="cgring__back" aria-hidden="true">
                  ?
                </span>
                <span class="cgring__face">{textOf(id) ?? "—"}</span>
              </span>
              <Show when={props.stamp?.kind === "sheep" && props.stamp.playerId === id && shown(flip())}>
                <span class="cgring__sheep">
                  <SheepIcon size={18} />
                </span>
              </Show>
            </div>
          );
        }}
      </For>
      <Show when={plan().champion !== null && shown(plan().steps - 1)}>
        <p class="cgring__champ" role="status">
          {heart() ? "TEK YÜREK" : "EN BÜYÜK AĞ"}
        </p>
      </Show>
      <Show when={plan().champion !== null && shown(plan().steps - 1) && !reducedMotion()}>
        <i class="cgring__burst" aria-hidden="true" />
      </Show>
    </div>
  );
}

/** Dizi bittikten sonra kısa bir okuma payıyla listeye geçmek için. */
export function createAfter(ms: number): { ready: () => boolean; arm: () => void } {
  const [ready, setReady] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  return {
    ready,
    arm: () => {
      if (ready() || timer !== undefined) return;
      timer = setTimeout(() => setReady(true), reducedMotion() ? 0 : ms);
    },
  };
}
