import type { RusvetReveal } from "@glix/engine";
import { createEffect, createMemo, For, on, onCleanup, Show } from "solid-js";
import { hapticMatch, hapticSolo, hapticTap } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { propSrc, rusvetProp } from "../../ui/props.js";
import { Ballot, Crown, Dice } from "./Art.js";
import type { CrewMember } from "./Seats.js";
import { coin, coupDrum, pledgeStamp, rustle, suppressed } from "./sounds.js";
import {
  loyaltyOf,
  PLEDGE_LABEL,
  REVEAL_SCENES,
  type RusvetScreenView,
  randomSummary,
  revealScene,
  ringPosition,
  storyLine,
} from "./view.js";

interface Props {
  view: RusvetScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  now: () => number;
}

const BEAM_STEP_MS = 180;
const COIN_STEP_MS = 160;
const COIN_MS = 650;

/**
 * Sahne sahne açılış (RD-U9, en az 11 sn): oklu oylar sandıktan akar (zarla atananlar kesikli, RD-M5) → başkan
 * tahta yükselir → jetonlar tahttan alıcılara uçup portrenin altına yığılır (rastgele olanlar gümüş) → darbe kutuları
 * dolar, "DARBE!" ya da "Darbe bastırıldı" → vaat damgası (RD-M3) → puanlar ve kendi hikâyen (RD-U10).
 */
export function Sonuc(props: Props) {
  const reveal = () => props.view.reveal;
  const president = () => props.view.president ?? "";
  const nameOf = (id: string) => props.crew.find((m) => m.id === id)?.nickname ?? "Oyuncu";
  const elapsed = () => Math.max(0, props.now() - props.view.phaseStartedAt);
  const scene = () => revealScene(elapsed());
  const past = (k: keyof typeof REVEAL_SCENES) => elapsed() >= REVEAL_SCENES[k];
  const nodes = createMemo(() =>
    props.crew.map((m, i) => ({
      m,
      pos: ringPosition(i, props.crew.length, 34),
      color: look(m.avatar).color,
    })),
  );
  const at = (id: string) => nodes().find((n) => n.m.id === id);

  const beams = createMemo(() => {
    const r = reveal();
    if (!r) return [];
    return props.crew.flatMap((m, idx) => {
      const to = r.votes[m.id];
      const a = at(m.id);
      const b = to === undefined || to === m.id ? undefined : at(to);
      if (!a || !b) return [];
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const gap = 9;
      const x2 = b.pos.x - ux * gap;
      const y2 = b.pos.y - uy * gap;
      const s = 2.6;
      const head = `${x2},${y2} ${x2 - ux * s - uy * s * 0.6},${y2 - uy * s + ux * s * 0.6} ${x2 - ux * s + uy * s * 0.6},${y2 - uy * s - ux * s * 0.6}`;
      return [
        {
          x1: a.pos.x + ux * gap,
          y1: a.pos.y + uy * gap,
          x2,
          y2,
          head,
          color: a.color,
          random: r.randomVoters.includes(m.id),
          delay: idx * BEAM_STEP_MS,
        },
      ];
    });
  });

  const coins = createMemo(() => {
    const r = reveal();
    const p = at(president());
    if (!r || !p) return [];
    let k = 0;
    return nodes().flatMap((n) => {
      const total = r.tokens[n.m.id] ?? 0;
      const silver = r.randomTokens[n.m.id] ?? 0;
      return Array.from({ length: total }, (_, j) => ({
        id: `${n.m.id}-${j}`,
        x: n.pos.x + 10 + j * 3.6,
        y: n.pos.y + 5,
        dx: p.pos.x - n.pos.x - 10 - j * 3.6,
        dy: p.pos.y - n.pos.y - 5,
        silver: j >= total - silver,
        delay: k++ * COIN_STEP_MS,
      }));
    });
  });
  const coinCount = () => coins().length;

  const coup = () => reveal()?.coup ?? null;
  const coupStep = () => Math.min(350, 1800 / Math.max(1, coup()?.eligible.length ?? 1));
  const coupFilled = () => {
    const c = coup();
    if (!c || !past("coup")) return 0;
    return Math.min(c.yes, Math.floor((elapsed() - REVEAL_SCENES.coup - 300) / coupStep()) + 1);
  };
  const coupStampAt = () => REVEAL_SCENES.coup + 300 + (coup()?.eligible.length ?? 0) * coupStep() + 200;
  const coupStamp = () => coup() !== null && elapsed() >= coupStampAt();
  const fallen = () => coupStamp() && coup()?.success === true;

  const pledge = () => reveal()?.pledge ?? null;
  const loyalty = createMemo(() => {
    const r = reveal();
    return r ? loyaltyOf(r, president()) : {};
  });
  const mine = () => reveal()?.scores[props.selfId] ?? 0;
  const story = () => {
    const r = reveal();
    return r ? storyLine(r, president(), props.selfId, nameOf) : "";
  };

  // Sesler ve titreşim: her sahnede bir kez (sayfa açılışın ortasında açılırsa geçmiş sahneler sessiz geçer).
  const fired = new Set<string>();
  const once = (key: string, due: boolean, fn: () => void): void => {
    if (!due || fired.has(key)) return;
    fired.add(key);
    if (elapsed() < REVEAL_SCENES.scores + 1500) fn();
  };
  createEffect(
    on(elapsed, (t) => {
      const b = beams();
      for (let i = 0; i < b.length; i++)
        once(`v${i}`, t >= i * BEAM_STEP_MS && t < REVEAL_SCENES.throne, rustle);
      for (let i = 0; i < coinCount(); i++)
        once(`c${i}`, t >= REVEAL_SCENES.coins + i * COIN_STEP_MS + COIN_MS, () => {
          coin(i);
          const c = coins()[i];
          if (c?.id.startsWith(`${props.selfId}-`) && !props.spectator) hapticTap();
        });
      once("coup", coupStamp(), () => (coup()?.success ? coupDrum() : suppressed()));
      once("pledge", pledge() !== null && t >= REVEAL_SCENES.pledge, () =>
        pledgeStamp(pledge()?.kept === true),
      );
      once("final", t >= REVEAL_SCENES.scores && !props.spectator, () => {
        if (mine() > 0) {
          matchSound();
          hapticMatch();
        } else {
          soloSound();
          hapticSolo();
        }
      });
    }),
  );
  onCleanup(() => fired.clear());

  const devrik = rusvetProp("taht-devrik");

  return (
    <div class="rd__reveal" data-scene={scene()}>
      <div class="rd__head rd__head--reveal">
        <Show
          when={!props.spectator}
          fallback={
            <>
              <span class="rd__title">Başkan: {nameOf(president())}</span>
              <Show when={past("scores")}>
                <span class="rd__verdict">{coup()?.success ? "Tahtı devrildi" : "Jetonlar dağıtıldı"}</span>
              </Show>
            </>
          }
        >
          <span
            class="rd__score"
            data-zero={mine() === 0 ? "1" : undefined}
            data-on={past("scores") ? "1" : undefined}
          >
            +{mine()}
          </span>
          <span class="rd__verdict" data-on={past("scores") ? "1" : undefined} role="status">
            {past("scores") ? story() : "Sandık açılıyor…"}
          </span>
          <span class="rd__sub">Başkan: {nameOf(president())}</span>
        </Show>
      </div>

      <div class="rd__stage">
        <div class="rd__arena" style={{ "--coin-ms": `${COIN_MS}ms` }}>
          <span class="rd__arena-ballot" data-out={past("throne") ? "1" : undefined}>
            <Ballot size="100%" />
          </span>
          <svg class="rd__lines" viewBox="0 0 100 100" aria-hidden="true">
            <For each={beams()}>
              {(b) => (
                <g style={{ color: b.color, "--d": `${b.delay}ms` }} data-random={b.random ? "1" : undefined}>
                  <line class="rd__glow" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} pathLength="1" />
                  <line class="rd__beam" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} pathLength="1" />
                  <polygon class="rd__arrow" points={b.head} />
                </g>
              )}
            </For>
          </svg>
          <For each={nodes()}>
            {(n) => {
              const votes = () => reveal()?.counts[n.m.id] ?? 0;
              const score = () => reveal()?.scores[n.m.id] ?? 0;
              const isPres = () => n.m.id === president();
              const random = () => reveal()?.randomVoters.includes(n.m.id) === true;
              return (
                <div
                  class="rd__node"
                  data-me={n.m.id === props.selfId ? "1" : undefined}
                  data-pres={isPres() ? "1" : undefined}
                  data-fallen={isPres() && fallen() ? "1" : undefined}
                  style={{ left: `${n.pos.x}%`, top: `${n.pos.y}%` }}
                >
                  <Show when={isPres()}>
                    <span class="rd__node-throne" data-on={past("throne") ? "1" : undefined}>
                      <img
                        src={fallen() && devrik ? devrik : propSrc("genel/taht")}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                      />
                    </span>
                  </Show>
                  <Avatar index={n.m.avatar} size="var(--rd-av)" connected={n.m.connected} />
                  <Show when={isPres() && past("throne")}>
                    <span class="rd__node-crown" data-fall={fallen() ? "1" : undefined}>
                      <Crown size="100%" />
                    </span>
                  </Show>
                  <span class="rd__name">{n.m.nickname}</span>
                  <Show when={random()}>
                    <span class="rd__node-dice" title="Oyu rastgele atandı">
                      <Dice size="100%" />
                    </span>
                  </Show>
                  <Show when={votes() > 0 && elapsed() >= 1_800}>
                    <span class="rd__votes">{votes()} oy</span>
                  </Show>
                  <Show when={past("scores")}>
                    <span class="rd__chip" data-zero={score() === 0 ? "1" : undefined}>
                      +{score()}
                    </span>
                    <Show when={loyalty()[n.m.id]}>
                      {(l) => (
                        <span class="rd__tag" data-l={l()}>
                          {l() === "paid" ? "Karşılığını aldı" : "Nankörlük!"}
                        </span>
                      )}
                    </Show>
                  </Show>
                </div>
              );
            }}
          </For>
          <For each={past("coins") ? coins() : []}>
            {(c) => (
              <i
                class="rd__coin rd__coin--fly"
                data-silver={c.silver ? "1" : undefined}
                aria-hidden="true"
                style={{
                  left: `${c.x}%`,
                  top: `${c.y}%`,
                  "--dx": c.dx,
                  "--dy": c.dy,
                  "--d": `${c.delay}ms`,
                }}
              />
            )}
          </For>
          <Show when={coupStamp() && !past("scores")}>
            <span class="rd__stamp rd__stamp--big" data-hit={coup()?.success ? "1" : undefined}>
              {coup()?.success ? "DARBE!" : "Darbe bastırıldı"}
            </span>
          </Show>
          <Show when={pledge() && past("pledge") && !past("scores")}>
            <span class="rd__stamp rd__stamp--pledge" data-kept={pledge()?.kept ? "1" : undefined}>
              {pledge()?.kept ? "TUTTU ✓" : "BOZDU ✗"}
            </span>
          </Show>
        </div>
      </div>

      <div class="rd__reveal-foot">
        <Show when={coup() && past("coup")}>
          {(_) => (
            <div class="rd__coup-boxes" role="status">
              <span>Darbe</span>
              <For each={Array.from({ length: coup()?.eligible.length ?? 0 }, (_, i) => i)}>
                {(i) => <i class="rd__box" data-on={i < coupFilled() ? "1" : undefined} />}
              </For>
              <Show when={coupStamp()}>
                <b data-hit={coup()?.success ? "1" : undefined}>
                  {coup()?.yes}/{coup()?.eligible.length}
                  {coup()?.success ? " · başkanın puanı gitti" : " · tutmadı"}
                </b>
              </Show>
            </div>
          )}
        </Show>
        <Show when={pledge() && past("pledge")}>
          <p class="rd__note" data-kept={pledge()?.kept ? "1" : undefined}>
            Vaat: {PLEDGE_LABEL[pledge()?.pledge ?? "voters"]} · {pledge()?.kept ? "tuttu" : "bozdu"}
            {pledge()?.timedOut ? " · süre doldu" : ""}
          </p>
        </Show>
        <Show when={past("coins") && reveal() && randomSummary(reveal() as RusvetReveal, nameOf)}>
          {(line) => (
            <p class="rd__note rd__note--dim">
              <Dice size="16px" /> {line()}
            </p>
          )}
        </Show>
      </div>
    </div>
  );
}
