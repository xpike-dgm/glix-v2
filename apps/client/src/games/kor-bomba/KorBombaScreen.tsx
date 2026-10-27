import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, untrack } from "solid-js";
import { Dynamic } from "solid-js/web";
import { hapticError, hapticPress, hapticSolo, hapticTap } from "../../fx/haptics.js";
import { fail, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { BlastArt, BombArt } from "../../ui/BombArt.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { pressable } from "../../ui/press.js";
import type { GameScreenProps } from "../registry.js";
import "./kor-bomba.css";
import { reducedMotion } from "../../fx/motion.js";
import { boom, spark, tak } from "./sounds.js";
import {
  formatBonus,
  formatRemaining,
  parseKorBombaView,
  remainingMs,
  type SeatPos,
  seatPositions,
} from "./view.js";

interface Bonus {
  id: number;
  text: string;
}

/** Bomba, taşıyıcının koltuğuyla masa merkezi arasında, taşıyıcının önünde durur. */
function bombSpot(seat: SeatPos | undefined): { x: number; y: number } {
  if (!seat) return { x: 50, y: 50 };
  return { x: 50 + (seat.x - 50) * 0.36, y: 50 + (seat.y - 50) * 0.36 };
}

export default function KorBombaScreen(props: GameScreenProps) {
  const view = createMemo(() => parseKorBombaView(props.match.publicView, props.match.view));
  const seats = createMemo(() => seatPositions(props.match.participants, props.selfId));
  const seatOf = (id: string): SeatPos | undefined => seats().find((s) => s.id === id);
  const playerOf = (id: string) => props.players.find((p) => p.id === id);

  // Pas verince bomba hemen yeni taşıyıcıya gider (sunucu aynı sonucu onaylar; reddedilirse geri döner).
  const [holderId, setHolder] = createOptimistic<string>(() => view()?.pub.holder ?? "", {
    onReject: () => {
      localPass = false;
      fail();
      hapticError();
    },
  });
  const exploded = () => view()?.pub.exploded ?? false;
  const iAmHolder = () =>
    !props.spectator && view()?.priv.role === "holder" && !exploded() && holderId() === props.selfId;
  const left = () => {
    const v = view();
    return v ? remainingMs(v, props.now()) : null;
  };
  const bomb = () => bombSpot(seatOf(holderId()));
  const skin = () => (left() !== null ? "glow" : "core");
  const urgent = () => {
    const l = left();
    return l !== null && l < 5_000 && !exploded();
  };

  const [bonuses, setBonuses] = createSignal<Bonus[]>([]);
  const [blast, setBlast] = createSignal(false);
  const [lit, setLit] = createSignal<string | null>(null);
  let counter = 0;
  let sparkEl: HTMLDivElement | undefined;
  let lastSeq: number | null = null;
  let localPass = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number): void => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
  });

  // Yeni pas: ışık kablodan yeni taşıyıcıya akar, "tak"; eklenen süre yalnız süreyi görenlerde kıvılcım olur.
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      const pass = v.pub.lastPass;
      if (lastSeq === null) {
        lastSeq = pass?.seq ?? 0;
        return;
      }
      if (!pass || pass.seq <= lastSeq) return;
      lastSeq = pass.seq;
      const from = seatOf(pass.from);
      const to = seatOf(pass.to);
      // Kendi pasımın sesi dokunuşta zaten çalındı.
      if (pass.from === props.selfId && localPass) localPass = false;
      else {
        tak();
        if (pass.to === props.selfId && !props.spectator) hapticSolo();
        else hapticTap();
      }
      setLit(pass.to);
      later(() => setLit(null), 520);
      if (from && to && sparkEl && !reducedMotion()) {
        const at = (p: { x: number; y: number }, opacity: number) => ({
          left: `${p.x}%`,
          top: `${p.y}%`,
          opacity,
        });
        sparkEl.animate([at(from, 0), at(from, 1), at({ x: 50, y: 50 }, 1), at(to, 1), at(to, 0)], {
          duration: 460,
          easing: "cubic-bezier(.4,.1,.3,1)",
        });
      }
      if (v.priv.role === "watcher" && v.priv.lastBonusMs !== null) {
        const id = ++counter;
        const text = formatBonus(v.priv.lastBonusMs);
        later(() => {
          spark();
          setBonuses((b) => [...b.slice(-2), { id, text }]);
          later(() => setBonuses((b) => b.filter((x) => x.id !== id)), 1000);
        }, 200);
      }
    });
  });

  // Patlama: taşıyıcının avatarı beyaz siluete döner, kısa sarsıntı. Ekran patlamış açılırsa yalnız son hâl gösterilir.
  let firstBlast = true;
  createEffect(
    on(exploded, (now) => {
      const initial = firstBlast;
      firstBlast = false;
      if (!now) {
        setBlast(false);
        return;
      }
      setBlast(true);
      if (initial) return;
      boom();
      hapticSolo();
    }),
  );

  const pass = (id: string): void => {
    if (!iAmHolder() || id === props.selfId) return;
    const target = playerOf(id);
    if (!target || target.connected === false) return;
    unlockAudio();
    tak();
    hapticPress();
    localPass = true;
    setHolder(id, () => sendActionAck({ kind: "pass", to: id }));
    setLit(id);
    later(() => setLit(null), 520);
  };

  return (
    <div
      class="kb"
      data-role={view()?.priv.role ?? "spectator"}
      data-blast={blast() ? "1" : undefined}
      data-urgent={urgent() ? "1" : undefined}
    >
      <div class="kb__felt" aria-hidden="true" />
      <svg class="kb__cables" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <title>Kablolar</title>
        <For each={seats()}>
          {(s) => (
            <line
              class="kb__cable"
              classList={{ "kb__cable--on": lit() === s.id, "kb__cable--holder": holderId() === s.id }}
              x1="50"
              y1="50"
              x2={s.x}
              y2={s.y}
              vector-effect="non-scaling-stroke"
            />
          )}
        </For>
      </svg>
      <div class="kb__hub" aria-hidden="true" />

      <For each={seats()}>
        {(s) => {
          const player = () => playerOf(s.id);
          const isHolder = () => holderId() === s.id;
          const isSelf = () => s.id === props.selfId && !props.spectator;
          const press = pressable(() => pass(s.id));
          const tappable = () => iAmHolder() && !isSelf() && player()?.connected !== false;
          return (
            <Dynamic
              component={iAmHolder() && !isSelf() ? "button" : "div"}
              class="kb__seat"
              type={iAmHolder() && !isSelf() ? "button" : undefined}
              disabled={iAmHolder() && !isSelf() ? !tappable() : undefined}
              aria-label={
                iAmHolder() && !isSelf() ? `${player()?.nickname ?? ""} kişisine pas ver` : undefined
              }
              data-holder={isHolder() ? "1" : undefined}
              data-tap={tappable() ? "1" : undefined}
              data-white={blast() && isHolder() ? "1" : undefined}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              onPointerDown={press.onPointerDown}
              onClick={press.onClick}
            >
              <Avatar
                index={player()?.avatar ?? 0}
                size="var(--seat)"
                connected={player()?.connected ?? true}
                self={isSelf()}
                ring={isHolder() ? "#FF3B5C" : undefined}
              />
              <span class="kb__name">{player()?.nickname ?? ""}</span>
            </Dynamic>
          );
        }}
      </For>

      <Show when={!blast()}>
        <div class="kb__bomb" data-skin={skin()} style={{ left: `${bomb().x}%`, top: `${bomb().y}%` }}>
          <BombArt>
            <Show when={left() !== null}>
              <span class="kb__time">{formatRemaining(left() ?? 0)}</span>
            </Show>
          </BombArt>
        </div>
      </Show>
      <Show when={blast()}>
        <div class="kb__blast" style={{ left: `${bomb().x}%`, top: `${bomb().y}%` }} aria-hidden="true">
          <BlastArt />
        </div>
      </Show>

      <div class="kb__spark" ref={sparkEl} aria-hidden="true" />
      <div class="kb__bonuses" style={{ left: `${bomb().x}%`, top: `${bomb().y}%` }} aria-hidden="true">
        <For each={bonuses()}>{(b) => <span class="kb__bonus">{b.text}</span>}</For>
      </div>

      <Show when={iAmHolder()}>
        <div class="kb__cta" aria-hidden="true">
          PAS VER
        </div>
      </Show>
    </div>
  );
}
