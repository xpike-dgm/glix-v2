import { createMemo, For, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound, tick } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import type { CrewMember } from "./Pazarlik.js";
import { flowsOf, type IttifakScreenView, promiseRows, ringPosition } from "./view.js";

/** Oy akışı: her oy bir enerji ipiyle hedefin portresine akar (ms). */
const BEAM_MS = 520;
const BEAM_STEP_MS = 110;
const CHIP_AT_MS = 1300;

interface Props {
  view: IttifakScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
}

export function Sonuc(props: Props) {
  const reveal = () => props.view.reveal;
  const order = () => props.crew.map((m) => m.id);
  const nodes = createMemo(() =>
    props.crew.map((m, i) => ({ m, pos: ringPosition(i, props.crew.length), color: look(m.avatar).color })),
  );
  const at = (id: string) => nodes().find((n) => n.m.id === id);
  const beams = createMemo(() => {
    const r = reveal();
    if (!r) return [];
    return flowsOf(r, order()).flatMap((f, idx) => {
      const a = at(f.from);
      const b = at(f.to);
      if (!a || !b) return [];
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const gap = 10;
      return [
        {
          ...f,
          x1: a.pos.x + ux * gap,
          y1: a.pos.y + uy * gap,
          x2: b.pos.x - ux * gap,
          y2: b.pos.y - uy * gap,
          color: a.color,
          delay: idx * BEAM_STEP_MS,
        },
      ];
    });
  });
  const rows = createMemo(() => {
    const r = reveal();
    return r ? promiseRows(r, order(), props.selfId) : [];
  });
  const nameOf = (id: string) => props.crew.find((m) => m.id === id)?.nickname ?? "";
  const kept = () => rows().filter((r) => r.kept).length;
  const lastDelay = () => Math.max(0, ...beams().map((b) => b.delay));
  const mine = () => reveal()?.scores[props.selfId] ?? 0;
  const myVote = () => {
    const to = reveal()?.votes[props.selfId];
    return to === undefined ? null : (props.crew.find((m) => m.id === to) ?? null);
  };

  const timers = new Set<ReturnType<typeof setTimeout>>();
  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
  });
  onMount(() => {
    tick();
    hapticTick();
    if (props.spectator) return;
    const t = setTimeout(
      () => {
        timers.delete(t);
        if (mine() > 0) {
          matchSound();
          hapticMatch();
        } else {
          soloSound();
          hapticSolo();
        }
      },
      CHIP_AT_MS + lastDelay() / 2,
    );
    timers.add(t);
  });

  return (
    <>
      <div class="it__head it__head--reveal" style={{ "--at": `${CHIP_AT_MS + lastDelay() / 2}ms` }}>
        <Show when={!props.spectator} fallback={<span class="it__title">Oylar açıldı</span>}>
          <span class="it__score" data-zero={mine() === 0 ? "1" : undefined}>
            +{mine()}
          </span>
          <span class="it__verdict">
            {mine() === 0 ? "Kimse sana oy vermedi" : mine() === 1 ? "1 oy aldın" : `${mine()} oy aldın`}
          </span>
          <Show when={myVote()}>
            {(p) => (
              <span class="it__sub" style={{ "--tc": look(p().avatar).color }}>
                Oyun: <b>{p().nickname}</b>
              </span>
            )}
          </Show>
        </Show>
      </div>

      <div class="it__stage">
        <div class="it__arena" style={{ "--beam-ms": `${BEAM_MS}ms` }}>
          <svg class="it__lines" viewBox="0 0 100 100" aria-hidden="true">
            <For each={beams()}>
              {(b) => (
                <g style={{ color: b.color, "--d": `${b.delay}ms` }}>
                  <line class="it__glow" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} pathLength="1" />
                  <line class="it__beam" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} pathLength="1" />
                </g>
              )}
            </For>
          </svg>
          <For each={nodes()}>
            {(n) => {
              const score = () => reveal()?.scores[n.m.id] ?? 0;
              return (
                <div
                  class="it__node"
                  data-me={n.m.id === props.selfId ? "1" : undefined}
                  style={{ left: `${n.pos.x}%`, top: `${n.pos.y}%` }}
                >
                  <Avatar index={n.m.avatar} size="var(--it-av)" connected={n.m.connected} />
                  <span class="it__name">{n.m.nickname}</span>
                  <span
                    class="it__chip"
                    data-zero={score() === 0 ? "1" : undefined}
                    style={{ "--chip-at": `${CHIP_AT_MS + lastDelay() / 2}ms` }}
                  >
                    +{score()}
                  </span>
                </div>
              );
            }}
          </For>
        </div>
      </div>
      <Show when={rows().length > 0}>
        <div class="it__promises" style={{ "--p-at": `${CHIP_AT_MS + lastDelay() / 2 + 500}ms` }}>
          <p class="it__promises-head">
            Sözler · {kept()} tutuldu, {rows().length - kept()} bozuldu
          </p>
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
                  <b class="it__promise-mark" role="img" aria-label={r.kept ? "tutuldu" : "bozuldu"}>
                    {r.kept ? "✓" : "✗"}
                  </b>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
      <p class="it__hint" role="status">
        Alınan her oy genel skora eklenir
      </p>
    </>
  );
}
