import { createEffect, createMemo, For, onCleanup, Show, untrack } from "solid-js";
import { hapticMatch, hapticSolo, hapticTap, hapticTick } from "../../fx/haptics.js";
import { createOpening } from "../../fx/opening.js";
import { match as matchSound, solo as soloSound, tap, tick } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import type { AckLike } from "../../ui/optimistic.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { pressable } from "../../ui/press.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./capraz-ates.css";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Opening } from "./Opening.js";
import { Sight } from "./Sight.js";
import {
  gridColumns,
  type Outcome,
  outcomeOf,
  parseCaprazAtesView,
  ringPosition,
  tracersOf,
} from "./view.js";

const LOCK_RED = "#FF3B5C";
/** Ateş izi çizimi ve çarpışma, puan etiketleri (ms). */
const BEAM_MS = 520;
const BEAM_STEP_MS = 110;
const CHIP_AT_MS = 1300;

const VERDICT: Record<Outcome, { score: string; text: string }> = {
  hit: { score: "−1", text: "Seni hedef aldılar" },
  free: { score: "+1", text: "Kimse seni seçmedi" },
  clash: { score: "0", text: "Mermiler çarpıştı" },
  idle: { score: "0", text: "Ateş etmedin, seçilmedin" },
};

const chipText = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export default function CaprazAtesScreen(props: GameScreenProps) {
  const view = createMemo(() => parseCaprazAtesView(props.match.publicView, props.match.view));
  const reveal = () => view()?.reveal ?? null;
  // Aşama başlarken bir kez, dokunulmaz süs sahnesi; girişi beklemez.
  const opening = createOpening("capraz-ates", () => view()?.startedAt);
  const crew = createMemo(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [p] : [];
    }),
  );
  const others = () => crew().filter((p) => p.id !== props.selfId);
  const lockedIds = () => view()?.lockedIds ?? [];
  const locked = () => view()?.locked ?? false;
  const closed = () => {
    const v = view();
    return !v || props.now() >= v.endsAt;
  };

  // Seçim: sunucu onaylayana kadar yerel (iyimser) gösterilir; reddedilirse eski haline döner.
  const pick = createPendingPick({
    server: () => view()?.myTarget ?? null,
    send: (target) => sendActionAck({ kind: "target", target }),
    closed: () => props.spectator === true || closed() || locked(),
  });
  const mine = (): string | null => pick.value();

  const choose = (id: string, connected: boolean): void => {
    if (!connected) return;
    pick.pick(id);
  };

  const lock = (): AckLike => {
    if (props.spectator || closed() || locked() || mine() === null) return false;
    return sendActionAck({ kind: "lock" });
  };

  const targetPlayer = () => {
    const id = mine();
    return id === null ? null : (crew().find((p) => p.id === id) ?? null);
  };

  // Açılış: kısa bir tık, kendi sonucun için gecikmeli ses ve titreşim.
  let announced = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
  });
  createEffect(() => {
    const r = reveal();
    if (!r || announced) return;
    announced = true;
    untrack(() => {
      tick();
      hapticTick();
      if (props.spectator) return;
      const outcome = outcomeOf(r, props.selfId);
      const t = setTimeout(() => {
        timers.delete(t);
        if (outcome === "free") {
          matchSound();
          hapticMatch();
        } else if (outcome === "hit") {
          soloSound();
          hapticSolo();
        } else if (outcome === "clash") {
          tap();
          hapticTap();
        }
      }, CHIP_AT_MS);
      timers.add(t);
    });
  });

  const bar = () => {
    const v = view();
    if (!v) return { from: 0, to: 1 };
    return v.reveal ? { from: v.endsAt, to: v.finishAt } : { from: v.startedAt, to: v.endsAt };
  };

  const spectatorList = () => (props.spectator ? crew() : others());
  const gridVars = () => {
    const n = spectatorList().length;
    const tall = gridColumns(n);
    const wide = gridColumns(n, true);
    return {
      "--cols-tall": tall,
      "--rows-tall": Math.ceil(n / tall),
      "--cols-wide": wide,
      "--rows-wide": Math.ceil(n / wide),
    };
  };

  return (
    <Screen class="game cx">
      <Show when={opening() && !reveal()}>
        <Opening />
      </Show>
      <Show when={view()}>
        <PhaseClock startedAt={bar().from} endsAt={bar().to} urgency={!reveal()} />
      </Show>

      <Show
        when={reveal()}
        fallback={
          <>
            <div class="cx__head">
              <span class="overline">{props.spectator ? "Gizli nişan" : "Gizli hedefin"}</span>
              <Show
                when={targetPlayer()}
                fallback={
                  <span class="cx__title">
                    {props.spectator ? "Herkes nişan alıyor" : "Kimi vuracaksın?"}
                  </span>
                }
              >
                {(p) => (
                  <span class="cx__title cx__title--locked" style={{ "--tc": look(p().avatar).color }}>
                    {p().nickname}
                  </span>
                )}
              </Show>
            </div>

            <div class="cx__stage">
              <div class="cx__grid" style={gridVars()}>
                <For each={spectatorList()}>
                  {(p, i) => {
                    const aimed = () => mine() === p.id;
                    const ready = () => lockedIds().includes(p.id);
                    const press = pressable(() => choose(p.id, p.connected));
                    return (
                      <div
                        class="cx__slot"
                        data-locked={aimed() ? "1" : undefined}
                        data-off={p.connected ? undefined : "1"}
                        data-idle={props.spectator || closed() ? "1" : undefined}
                        style={{
                          "--dur": `${7.5 + ((i() * 1.3) % 4)}s`,
                          "--delay": `${-((i() * 1.7) % 6)}s`,
                          "--flip": i() % 2 === 0 ? 1 : -1,
                        }}
                      >
                        <button
                          type="button"
                          class="cx__cell"
                          data-locked={aimed() ? "1" : undefined}
                          data-off={p.connected ? undefined : "1"}
                          disabled={props.spectator || closed() || locked() || !p.connected}
                          aria-pressed={aimed()}
                          aria-label={`${p.nickname} hedef al`}
                          onPointerDown={press.onPointerDown}
                          onClick={press.onClick}
                        >
                          <span class="cx__portrait">
                            <Avatar
                              index={p.avatar}
                              size="var(--cx-av)"
                              connected={p.connected}
                              ring={aimed() ? LOCK_RED : undefined}
                              ready={ready()}
                            />
                          </span>
                          <span class="cx__name">{p.nickname}</span>
                        </button>
                        <span class="cx__sightbox" aria-hidden="true">
                          <span class="cx__sight">
                            <Sight />
                          </span>
                        </span>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>

            <p class="cx__hint" role="status">
              {props.spectator
                ? "Hedefler süre bitince açılır"
                : closed()
                  ? "Hedefler açılıyor…"
                  : locked()
                    ? "Hedefin kesinleşti"
                    : mine() === null
                      ? "Seçmezsen boşa sıkmış olursun"
                      : "Değiştirebilir ya da Tamam diyebilirsin"}
            </p>
            <TamamBar
              spectator={props.spectator ?? false}
              locked={locked()}
              disabled={closed() || mine() === null}
              ready={lockedIds().length}
              readyIds={lockedIds()}
              total={crew().length}
              onLock={lock}
            />
          </>
        }
      >
        {(r) => {
          const nodes = () =>
            crew().map((p, i) => ({ p, pos: ringPosition(i, crew().length), color: look(p.avatar).color }));
          const at = (id: string) => nodes().find((n) => n.p.id === id);
          const beams = () =>
            tracersOf(
              r(),
              crew().map((p) => p.id),
            ).flatMap((t, idx) => {
              const a = at(t.from);
              const b = at(t.to);
              if (!a || !b) return [];
              const dx = b.pos.x - a.pos.x;
              const dy = b.pos.y - a.pos.y;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const gap = 10;
              const x1 = a.pos.x + ux * gap;
              const y1 = a.pos.y + uy * gap;
              const x2 = t.mutual ? (a.pos.x + b.pos.x) / 2 : b.pos.x - ux * gap;
              const y2 = t.mutual ? (a.pos.y + b.pos.y) / 2 : b.pos.y - uy * gap;
              return [{ ...t, x1, y1, x2, y2, color: a.color, delay: idx * BEAM_STEP_MS }];
            });
          const lastDelay = () => Math.max(0, ...beams().map((b) => b.delay));
          const bursts = () =>
            r().mutual.flatMap(([x, y]) => {
              const a = at(x);
              const b = at(y);
              if (!a || !b) return [];
              return [{ x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2 }];
            });
          const impacts = () =>
            beams()
              .filter((b) => !b.mutual)
              .map((b) => ({ ...b, pos: at(b.to)?.pos ?? { x: 50, y: 50 } }));
          const verdict = () => VERDICT[outcomeOf(r(), props.selfId)];
          return (
            <>
              <div class="cx__head cx__head--reveal" style={{ "--at": `${CHIP_AT_MS}ms` }}>
                <Show when={!props.spectator} fallback={<span class="cx__title">Hedefler açıldı</span>}>
                  <span class="cx__score" data-o={outcomeOf(r(), props.selfId)}>
                    {verdict().score}
                  </span>
                  <span class="cx__verdict">{verdict().text}</span>
                </Show>
              </div>

              <div class="cx__stage">
                <div
                  class="cx__arena"
                  style={{ "--beam-ms": `${BEAM_MS}ms`, "--chip-at": `${CHIP_AT_MS + lastDelay() / 2}ms` }}
                >
                  <svg class="cx__lines" viewBox="0 0 100 100" aria-hidden="true">
                    <For each={beams()}>
                      {(b) => (
                        <g style={{ color: b.color, "--d": `${b.delay}ms` }}>
                          <line class="cx__glow" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} pathLength="1" />
                          <line class="cx__beam" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} pathLength="1" />
                        </g>
                      )}
                    </For>
                  </svg>

                  <For each={bursts()}>
                    {(b) => (
                      <i
                        class="cx__burst"
                        aria-hidden="true"
                        style={{ left: `${b.x}%`, top: `${b.y}%`, "--d": `${BEAM_MS + lastDelay() / 2}ms` }}
                      />
                    )}
                  </For>
                  <For each={impacts()}>
                    {(b) => (
                      <i
                        class="cx__impact"
                        aria-hidden="true"
                        style={{
                          left: `${b.pos.x}%`,
                          top: `${b.pos.y}%`,
                          "--d": `${b.delay + BEAM_MS}ms`,
                        }}
                      />
                    )}
                  </For>

                  <For each={nodes()}>
                    {(n) => {
                      const score = () => r().scores[n.p.id] ?? 0;
                      return (
                        <div
                          class="cx__node"
                          data-me={n.p.id === props.selfId ? "1" : undefined}
                          style={{ left: `${n.pos.x}%`, top: `${n.pos.y}%` }}
                        >
                          <Avatar index={n.p.avatar} size="var(--cx-rav)" connected={n.p.connected} />
                          <span class="cx__rname">{n.p.nickname}</span>
                          <span class="cx__chip" data-s={score() > 0 ? "up" : score() < 0 ? "down" : "zero"}>
                            {chipText(score())}
                          </span>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
              <p class="cx__hint" role="status">
                Puanlar genel skora eklenir
              </p>
            </>
          );
        }}
      </Show>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
