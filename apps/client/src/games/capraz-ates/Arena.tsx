import type { CaprazAtesRoundReveal, PlayerInfo } from "@glix/engine";
import { For, type JSX, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { cxArtSrc, hasArt } from "./art.js";
import { OutcomeIcon } from "./Icons.js";
import type { RevealTimeline } from "./timeline.js";
import {
  type Outcome,
  outcomeOf,
  RING,
  ringAvatar,
  ringAvatarPct,
  ringPosition,
  scoreText,
  tracersOf,
} from "./view.js";

interface Props {
  /** Halkadaki oyuncular (katılım sırasıyla; ilk oyuncu üstte). */
  crew: readonly PlayerInfo[];
  /** Kendi kimliğin; izleyicide null. */
  selfId: string | null;
  reveal: CaprazAtesRoundReveal;
  /** Verilirse rozetler `totalAt` anında iki turun toplamına döner. */
  totals?: Record<string, number> | null;
  timeline: RevealTimeline & { totalAt?: number };
  /** Açılış başından bu yana geçen süre (ms); geç açılan ekran sahneyi o andan sürdürür. */
  elapsed: number;
  /** `final` ağır çekim, `short` tur 1 kısa açılışı, `still` hareketsiz (tur 1 halkasının büyük hâli). */
  mode: "final" | "short" | "still";
  class?: string;
}

/** Siperdeki oyuncunun kalkanı (mermiler buradan seker): görsel varsa o, yoksa CSS kabarcık. */
function Shield() {
  return (
    <Show when={hasArt("kalkan")} fallback={<i class="cx__shield" aria-hidden="true" />}>
      <img class="cx__shield cx__shield--art" src={cxArtSrc("kalkan")} alt="" aria-hidden="true" />
    </Show>
  );
}

/**
 * Açılış halkası: oyuncular dairede; her atış için namlu ateşi, iz çizerek giden mermi, isabet / çarpışma /
 * sekme; ardından puan rozetleri. Bütün anlar `timeline`dan gelir (CSS değişkenleri), geç açılışta negatif
 * gecikmeyle o ana atlanır.
 */
export function Arena(props: Props) {
  const ids = () => props.crew.map((p) => p.id);
  const nodes = () =>
    props.crew.map((p, i) => ({
      p,
      pos: ringPosition(i, props.crew.length, RING.radius, RING.cy),
      color: look(p.avatar).color,
    }));
  const at = (id: string) => nodes().find((n) => n.p.id === id);

  const shots = () =>
    tracersOf(props.reveal, ids()).flatMap((t) => {
      const a = at(t.from);
      const b = at(t.to);
      if (!a || !b) return [];
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const half = ringAvatarPct(props.crew.length) / 2;
      const start = half + 2;
      const stop = t.cover ? half * 1.5 + 1 : half + 1;
      const x1 = a.pos.x + ux * start;
      const y1 = a.pos.y + uy * start;
      const x2 = t.mutual ? (a.pos.x + b.pos.x) / 2 - ux * 1.2 : b.pos.x - ux * stop;
      const y2 = t.mutual ? (a.pos.y + b.pos.y) / 2 - uy * 1.2 : b.pos.y - uy * stop;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      return [{ ...t, x1, y1, x2, y2, angle, color: a.color }];
    });
  const bursts = () =>
    props.reveal.mutual.flatMap(([x, y]) => {
      const a = at(x);
      const b = at(y);
      return a && b ? [{ x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2 }] : [];
    });
  const outcome = (id: string): Outcome => outcomeOf(props.reveal, id);
  const targeted = (id: string) => shots().some((s) => s.to === id && !s.mutual);

  const vars = (): JSX.CSSProperties => {
    const t = props.timeline;
    return {
      "--cx-rav": ringAvatar(props.crew.length),
      "--el": `${props.mode === "still" ? 600_000 : Math.max(0, props.elapsed)}ms`,
      "--grow": `${t.growMs}ms`,
      "--muzzle": `${t.muzzleAt}ms`,
      "--flight": `${t.flightMs}ms`,
      "--impact": `${t.impactAt}ms`,
      "--chips": `${t.chipsAt}ms`,
      "--total": `${t.totalAt ?? 600_000}ms`,
    };
  };

  return (
    <div class={`cx__arena ${props.class ?? ""}`} data-mode={props.mode} style={vars()}>
      <svg class="cx__lines" viewBox="0 0 100 100" aria-hidden="true">
        <For each={shots()}>
          {(s) => (
            <g style={{ color: s.color }}>
              <line class="cx__glow" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} pathLength="1" />
              <line class="cx__beam" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} pathLength="1" />
            </g>
          )}
        </For>
      </svg>

      <For each={shots()}>
        {(s) => (
          <>
            <i
              class="cx__muzzle"
              aria-hidden="true"
              style={{ left: `${s.x1}%`, top: `${s.y1}%`, "--ang": `${s.angle}deg`, color: s.color }}
            >
              <Show when={hasArt("namlu-atesi")}>
                <img class="cx__muzzle-art" src={cxArtSrc("namlu-atesi")} alt="" />
              </Show>
            </i>
            <i
              class="cx__bullet"
              aria-hidden="true"
              style={{
                left: `${s.x1}%`,
                top: `${s.y1}%`,
                "--tx": `${s.x2 - s.x1}cqw`,
                "--ty": `${s.y2 - s.y1}cqh`,
                "--ang": `${s.angle}deg`,
                color: s.color,
              }}
            >
              <Show when={hasArt("mermi-parilti")}>
                <img class="cx__bullet-art" src={cxArtSrc("mermi-parilti")} alt="" />
              </Show>
            </i>
            <Show when={s.cover}>
              <i
                class="cx__ricochet"
                aria-hidden="true"
                style={{
                  left: `${s.x2}%`,
                  top: `${s.y2}%`,
                  "--ang": `${s.angle + (s.from < s.to ? 140 : -140)}deg`,
                  color: s.color,
                }}
              />
            </Show>
          </>
        )}
      </For>

      <For each={bursts()}>
        {(b) => <i class="cx__burst" aria-hidden="true" style={{ left: `${b.x}%`, top: `${b.y}%` }} />}
      </For>

      <For each={nodes()}>
        {(n) => {
          const o = () => outcome(n.p.id);
          const score = () => props.reveal.scores[n.p.id] ?? 0;
          const total = () => props.totals?.[n.p.id];
          const sign = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "zero");
          return (
            <div
              class="cx__node"
              data-me={n.p.id === props.selfId ? "1" : undefined}
              data-o={o()}
              data-shot={targeted(n.p.id) ? "1" : undefined}
              style={{ left: `${n.pos.x}%`, top: `${n.pos.y}%` }}
            >
              <span class="cx__body">
                <Avatar index={n.p.avatar} size="var(--cx-rav)" connected={n.p.connected} />
              </span>
              <Show when={o() === "cover"}>
                <Shield />
              </Show>
              <Show when={o() === "hit"}>
                <i class="cx__impact" aria-hidden="true" />
              </Show>
              <span class="cx__rname">
                <span class="cx__rname-t">{n.p.nickname}</span>
                <span
                  class="cx__chip"
                  data-s={sign(score())}
                  data-has-total={total() !== undefined ? "1" : undefined}
                >
                  <span class="cx__chip-r">
                    <OutcomeIcon outcome={o()} />
                    {scoreText(score())}
                  </span>
                  <Show when={total() !== undefined}>
                    <span class="cx__chip-t" data-s={sign(total() ?? 0)}>
                      {scoreText(total() ?? 0)}
                    </span>
                  </Show>
                </span>
              </span>
            </div>
          );
        }}
      </For>
    </div>
  );
}

/** Tur 1'in küçük halkası (tur 2 seçimi sırasında üstte; dokununca büyür). Yalnız SVG; isimler büyük hâlde. */
export function MiniRing(props: { crew: readonly PlayerInfo[]; reveal: CaprazAtesRoundReveal }) {
  const ids = () => props.crew.map((p) => p.id);
  const pos = (id: string) => {
    const i = ids().indexOf(id);
    return ringPosition(Math.max(0, i), props.crew.length, 36);
  };
  return (
    <svg class="cx__mini-svg" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="36" class="cx__mini-orbit" />
      <For each={tracersOf(props.reveal, ids())}>
        {(t) => {
          const a = pos(t.from);
          const b = pos(t.to);
          const mx = t.mutual ? (a.x + b.x) / 2 : b.x - (b.x - a.x) * 0.22;
          const my = t.mutual ? (a.y + b.y) / 2 : b.y - (b.y - a.y) * 0.22;
          const p = props.crew.find((q) => q.id === t.from);
          return (
            <line
              x1={a.x}
              y1={a.y}
              x2={mx}
              y2={my}
              class="cx__mini-line"
              style={{ stroke: p ? look(p.avatar).color : "#fff" }}
            />
          );
        }}
      </For>
      <For each={props.crew}>
        {(p) => {
          const c = () => pos(p.id);
          const sheltered = () => props.reveal.cover.includes(p.id);
          return (
            <>
              <Show when={sheltered()}>
                <circle cx={c().x} cy={c().y} r="12" class="cx__mini-shield" />
              </Show>
              <circle
                cx={c().x}
                cy={c().y}
                r="8"
                style={{ fill: look(p.avatar).color }}
                class="cx__mini-dot"
              />
            </>
          );
        }}
      </For>
    </svg>
  );
}
