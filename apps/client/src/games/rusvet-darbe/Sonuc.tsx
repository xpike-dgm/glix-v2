import { createMemo, For, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound, tick } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { propSrc } from "../../ui/props.js";
import type { CrewMember } from "./Duello.js";
import { type RusvetScreenView, ringPosition } from "./view.js";

/** Zaman çizelgesi (ms): oy akışı → oy sayıları → jetonlar başkandan uçar → puanlar. */
const BEAM_MS = 480;
const BEAM_STEP_MS = 90;
const VOTES_AT = 1100;
const COINS_AT = 3300;
const COIN_MS = 700;
const FINAL_AT = 4700;

interface Props {
  view: RusvetScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
}

export function Sonuc(props: Props) {
  const reveal = () => props.view.reveal;
  const nodes = createMemo(() =>
    props.crew.map((m, i) => ({ m, pos: ringPosition(i, props.crew.length), color: look(m.avatar).color })),
  );
  const at = (id: string) => nodes().find((n) => n.m.id === id);
  const president = () => at(props.view.president ?? "");
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
      const gap = 10;
      return [
        {
          x1: a.pos.x + (dx / len) * gap,
          y1: a.pos.y + (dy / len) * gap,
          x2: b.pos.x - (dx / len) * gap,
          y2: b.pos.y - (dy / len) * gap,
          color: a.color,
          delay: idx * BEAM_STEP_MS,
        },
      ];
    });
  });
  const coins = createMemo(() => {
    const r = reveal();
    const p = president();
    if (!r || !p) return [];
    return nodes().flatMap((n) =>
      Array.from({ length: r.tokens[n.m.id] ?? 0 }, (_, k) => ({
        id: `${n.m.id}-${k}`,
        pos: n.pos,
        dx: p.pos.x - n.pos.x,
        dy: p.pos.y - n.pos.y,
        shift: (k - 0.5) * 3.2,
        delay: COINS_AT + k * 140 + (props.crew.findIndex((c) => c.id === n.m.id) % 4) * 60,
      })),
    );
  });
  const mine = () => reveal()?.scores[props.selfId] ?? 0;
  const iAmPresident = () => props.view.president === props.selfId;
  const presidentName = () => props.crew.find((m) => m.id === props.view.president)?.nickname ?? "";

  const timers = new Set<ReturnType<typeof setTimeout>>();
  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
  });
  onMount(() => {
    tick();
    hapticTick();
    if (props.spectator) return;
    const t = setTimeout(() => {
      timers.delete(t);
      if (mine() > 0) {
        matchSound();
        hapticMatch();
      } else {
        soloSound();
        hapticSolo();
      }
    }, FINAL_AT);
    timers.add(t);
  });

  return (
    <>
      <div class="rd__head rd__head--reveal" style={{ "--at": `${FINAL_AT}ms` }}>
        <Show
          when={!props.spectator}
          fallback={
            <>
              <span class="rd__title">Başkan: {presidentName()}</span>
              <span class="rd__verdict rd__verdict--on">Jetonlar dağıtıldı</span>
            </>
          }
        >
          <span class="rd__score" data-zero={mine() === 0 ? "1" : undefined}>
            +{mine()}
          </span>
          <span class="rd__verdict">
            {iAmPresident()
              ? "Başkan oldun"
              : mine() === 0
                ? "Jeton gelmedi"
                : mine() === 1
                  ? "1 jeton aldın"
                  : `${mine()} jeton aldın`}
          </span>
          <span class="rd__sub">Başkan: {presidentName()}</span>
        </Show>
      </div>

      <div class="rd__stage">
        <div class="rd__arena" style={{ "--beam-ms": `${BEAM_MS}ms`, "--coin-ms": `${COIN_MS}ms` }}>
          <svg class="rd__lines" viewBox="0 0 100 100" aria-hidden="true">
            <For each={beams()}>
              {(b) => (
                <g style={{ color: b.color, "--d": `${b.delay}ms` }}>
                  <line class="rd__glow" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} pathLength="1" />
                  <line class="rd__beam" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} pathLength="1" />
                </g>
              )}
            </For>
          </svg>
          <For each={nodes()}>
            {(n) => {
              const votes = () => reveal()?.counts[n.m.id] ?? 0;
              const score = () => reveal()?.scores[n.m.id] ?? 0;
              return (
                <div
                  class="rd__node"
                  data-me={n.m.id === props.selfId ? "1" : undefined}
                  data-pres={n.m.id === props.view.president ? "1" : undefined}
                  style={{ left: `${n.pos.x}%`, top: `${n.pos.y}%` }}
                >
                  <Avatar index={n.m.avatar} size="var(--rd-av)" connected={n.m.connected} />
                  <Show when={n.m.id === props.view.president}>
                    <img
                      class="rd__seat rd__seat--node"
                      src={propSrc("genel/taht")}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      width="384"
                      height="384"
                    />
                  </Show>
                  <span class="rd__name">{n.m.nickname}</span>
                  <span
                    class="rd__votes"
                    style={{ "--v-at": `${VOTES_AT}ms`, "--v-out": `${FINAL_AT - 200}ms` }}
                  >
                    {votes()} oy
                  </span>
                  <span
                    class="rd__chip"
                    data-zero={score() === 0 ? "1" : undefined}
                    style={{ "--chip-at": `${FINAL_AT}ms` }}
                  >
                    +{score()}
                  </span>
                </div>
              );
            }}
          </For>
          <For each={coins()}>
            {(c) => (
              <i
                class="rd__coin rd__coin--fly"
                aria-hidden="true"
                style={{
                  left: `${c.pos.x + c.shift}%`,
                  top: `${c.pos.y}%`,
                  "--dx": c.dx,
                  "--dy": c.dy,
                  "--d": `${c.delay}ms`,
                }}
              />
            )}
          </For>
        </div>
      </div>
      <p class="rd__hint" role="status">
        Puanlar genel skora eklenir
      </p>
    </>
  );
}
