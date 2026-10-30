import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, untrack } from "solid-js";
import { hapticError, hapticMatch, hapticPress, hapticSolo } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { currentShakeGain } from "../../fx/shake.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { CbState } from "../../ui/CbState.js";
import { Screen } from "../../ui/Screen.js";
import type { GameScreenProps } from "../registry.js";
import "./asiri-yukleme.css";
import { Ambience } from "./Ambience.js";
import { BoomScene } from "./BoomScene.js";
import { createTapBatcher } from "./batcher.js";
import { Core } from "./Core.js";
import { type CoreFx, createCoreFx, pokeDirection } from "./coreFx.js";
import { createHum } from "./hum.js";
import { createInflow, type Inflow } from "./inflow.js";
import { createTapRhythm, hapticMs } from "./rhythm.js";
import { alarm, beat, blast, zap } from "./sounds.js";
import { revealSchedule } from "./timeline.js";
import { barParts, parseAsiriYuklemeView, pointsText, resultRows } from "./view.js";

/** Ses/titreşim ve ağır görsel efektlerin en sık aralığı (ms); tıklamaların kendisi sınırlanmaz. */
const FX_GAP_MS = 55;

export default function AsiriYuklemeScreen(props: GameScreenProps) {
  const view = createMemo(() => parseAsiriYuklemeView(props.match.publicView, props.match.view));
  const reveal = () => view()?.reveal ?? null;
  const danger = () => (view()?.danger ?? false) && !reveal();
  const exploders = () => reveal()?.exploders ?? [];
  const boom = () => exploders().length > 0;
  const iExploded = () => exploders().includes(props.selfId);

  // Tıklamalar yerelde anında görünür; sunucuya toplu ve sınırlı hızda gider (batcher.ts).
  const batcher = createTapBatcher({
    send: (count) => {
      sendAction(count === 1 ? { kind: "tap" } : { kind: "tap", count });
    },
    now: () => performance.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });
  onCleanup(() => batcher.dispose());

  const rhythm = createTapRhythm();
  const hum = createHum();
  onCleanup(() => hum.stop());

  let body: HTMLDivElement | undefined;
  let motesEl: HTMLDivElement | undefined;
  let coreEl: HTMLDivElement | undefined;
  let coreFx: CoreFx | null = null;
  let inflow: Inflow | null = null;
  let lastFx = 0;
  onCleanup(() => inflow?.dispose());

  const ensureFx = (): void => {
    if (!coreFx && coreEl) coreFx = createCoreFx(coreEl);
    if (!inflow && motesEl) inflow = createInflow(motesEl);
  };

  /** Bir dokunuşun yerel tepkisi: çekirdek, parçacıklar, vınlama, ritim, titreşim (yalnız kendi hızın). */
  const feel = (x: number | null, y: number | null): void => {
    ensureFx();
    const now = performance.now();
    const pulse = rhythm.push(now);
    hum.feed(pulse.rate);
    const box = motesEl?.getBoundingClientRect();
    const cbox = coreEl?.getBoundingClientRect();
    const cx = cbox && box ? cbox.left + cbox.width / 2 - box.left : 0;
    const cy = cbox && box ? cbox.top + cbox.height / 2 - box.top : 0;
    const px = x !== null && box ? x - box.left : cx;
    const py = y !== null && box ? y - box.top : cy;
    if (!reducedMotion()) {
      const dir = pokeDirection(cx, cy, px, py);
      coreFx?.poke(dir.dx, dir.dy, 0.7 + Math.min(pulse.rate, 12) / 20);
      if (x !== null && y !== null) inflow?.emit(px, py, cx, cy);
      if (pulse.rhythm) coreFx?.beat();
    }
    if (pulse.rhythm) beat();
    if (now - lastFx >= FX_GAP_MS) {
      lastFx = now;
      zap();
      hapticPress(hapticMs(pulse));
    }
  };

  const hit = (e: PointerEvent): void => {
    e.preventDefault();
    if (props.spectator || reveal()) return;
    unlockAudio();
    // Her dokunuş sunucuya gidecek tıklama sayılır; görsel/ses/titreşim yalnız sıklığı sınırlı verilir.
    batcher.tap();
    feel(e.clientX, e.clientY);
  };

  // Tehlike başlayınca bir kez uyarı.
  createEffect(
    on(
      danger,
      (now, prev) => {
        if (now && !prev && !props.spectator) {
          alarm();
          hapticError();
        }
      },
      { defer: true },
    ),
  );

  // ---- Sonuç açılışı ----
  // Ekran sonuç zaten açıkken kurulduysa (yeniden bağlanma) açılış oynatılmaz; her şey bir arada görünür.
  const animate = untrack(() => reveal() === null);
  const rows = createMemo(() => {
    const r = reveal();
    return r ? resultRows(r, props.match.participants) : [];
  });
  const [boomOn, setBoomOn] = createSignal(false);
  const [countOn, setCountOn] = createSignal(!animate);
  const [shownRows, setShownRows] = createSignal(animate ? 0 : Number.POSITIVE_INFINITY);
  const [flown, setFlown] = createSignal(!animate);
  let totalEl: HTMLSpanElement | undefined;
  let subEl: HTMLParagraphElement | undefined;
  const ownPtsEl = new Map<string, HTMLSpanElement>();
  let flyingChip: HTMLElement | null = null;
  onCleanup(() => flyingChip?.remove());

  const countUp = (to: number, ms: number): (() => void) => {
    let raf = 0;
    const t0 = performance.now();
    const frame = (): void => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const eased = 1 - (1 - k) ** 3;
      if (totalEl) totalEl.textContent = String(Math.round(to * eased));
      if (k < 1) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  };

  const fly = (): void => {
    const from = ownPtsEl.get(props.selfId);
    if (!from || !subEl || reducedMotion()) {
      setFlown(true);
      return;
    }
    const a = from.getBoundingClientRect();
    const b = subEl.getBoundingClientRect();
    const chip = document.createElement("span");
    chip.className = "ay__fly";
    chip.dataset.pts = from.dataset.pts ?? "0";
    chip.textContent = from.textContent;
    chip.style.left = `${a.left}px`;
    chip.style.top = `${a.top}px`;
    chip.style.width = `${a.width}px`;
    chip.style.height = `${a.height}px`;
    document.body.appendChild(chip);
    flyingChip = chip;
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const anim = chip.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 30}px) scale(1.6)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px,${dy}px) scale(1.1)`, opacity: 0.2 },
      ],
      { duration: 500, easing: "cubic-bezier(.4,0,.2,1)" },
    );
    const done = (): void => {
      chip.remove();
      flyingChip = null;
      setFlown(true);
    };
    anim.onfinish = done;
    anim.oncancel = done;
  };

  const shake = (): void => {
    const g = currentShakeGain();
    if (!body || g <= 0) return;
    const p = (px: number): string => `${Math.round(px * g)}px`;
    body.animate(
      [
        { transform: "translate(0,0)" },
        { transform: `translate(${p(-22)},${p(10)}) rotate(-0.6deg)` },
        { transform: `translate(${p(20)},${p(-12)}) rotate(0.5deg)` },
        { transform: `translate(${p(-16)},${p(8)})` },
        { transform: `translate(${p(12)},${p(-6)})` },
        { transform: `translate(${p(-6)},${p(3)})` },
        { transform: "translate(0,0)" },
      ],
      { duration: 640, easing: "ease-out" },
    );
  };

  let announced = false;
  createEffect(() => {
    const r = reveal();
    if (!r || announced) return;
    announced = true;
    batcher.drop();
    hum.stop();
    const exploded = r.exploders.length > 0;
    const mine = r.points[props.selfId] ?? 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void): void => {
      timers.push(setTimeout(fn, ms));
    };
    let stopCount: (() => void) | undefined;
    onCleanup(() => {
      for (const t of timers) clearTimeout(t);
      stopCount?.();
    });
    if (exploded) blast();
    at(300, () => {
      if (props.spectator) return;
      if (mine > 0) hapticMatch();
      else hapticSolo();
    });
    if (!animate) return;
    if (exploded) {
      setBoomOn(true);
      shake();
    }
    const plan = revealSchedule(
      rows().map((row) => row.exploded),
      exploded,
    );
    if (exploded) at(plan.countAt, () => setBoomOn(false));
    at(plan.countAt, () => {
      setCountOn(true);
      stopCount = countUp(r.total, plan.countMs);
    });
    plan.rowAt.forEach((ms, i) => {
      at(ms, () => setShownRows(i + 1));
    });
    at(plan.flyAt, fly);
  });

  const avatarOf = (id: string) => props.players.find((p) => p.id === id)?.avatar ?? 0;
  const connectedOf = (id: string) => props.players.find((p) => p.id === id)?.connected ?? true;
  const myPoints = () => reveal()?.points[props.selfId] ?? 0;
  const isRowShown = (i: number) => shownRows() > i;

  const headline = () => {
    if (iExploded()) return "Patlattın!";
    if (boom()) return "Çekirdek patladı!";
    return "Reaktör dayandı";
  };

  return (
    <Screen class={reveal() ? "ay" : "ay ay--play"}>
      <div class="ay__edge" data-on={danger() ? "1" : undefined} aria-hidden="true" />
      <Show when={!reveal()}>
        <Ambience />
      </Show>
      <div class="ay__body" ref={body}>
        <Show when={view()}>
          <Show
            when={reveal()}
            fallback={
              <>
                <div class="ay__stage">
                  <button
                    type="button"
                    class="ay__hit"
                    disabled={props.spectator}
                    aria-label="Tıkla"
                    onPointerDown={hit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (props.spectator) return;
                        batcher.tap();
                        feel(null, null);
                      }
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <Core
                      danger={danger()}
                      ref={(el) => {
                        coreEl = el;
                      }}
                    />
                  </button>
                  <div class="ay__motes" ref={motesEl} aria-hidden="true" />
                </div>
                <p class="ay__hint" role="status">
                  {props.spectator ? "Herkes çekirdeği dolduruyor…" : "Çekirdeğe hızlıca dokun!"}
                </p>
              </>
            }
          >
            {(r) => (
              <div class="ay__result">
                <div class="ay__head" data-boom={boom() ? "1" : "0"}>
                  <p class="ay__verdict">{headline()}</p>
                  <Show when={!props.spectator}>
                    <p
                      class="ay__sub"
                      ref={subEl}
                      data-win={myPoints() > 0 ? "1" : myPoints() < 0 ? "-1" : "0"}
                      data-on={flown() ? "1" : undefined}
                    >
                      {myPoints() === 0 ? "Puan yok" : `${pointsText(myPoints())} puan`}
                    </p>
                  </Show>
                </div>
                <div
                  class="ay__meter"
                  data-on={countOn() ? "1" : undefined}
                  data-over={r().total > 100 ? "1" : undefined}
                >
                  <div class="ay__core-small">
                    <Core boom={boom()} />
                  </div>
                  <p class="ay__total">
                    <span class="ay__total-num" ref={totalEl}>
                      {animate ? "0" : String(r().total)}
                    </span>
                    <span class="ay__total-lbl">toplam tık</span>
                  </p>
                </div>
                <ol class="ay__rows">
                  <For each={rows()}>
                    {(row, i) => {
                      const parts = () => barParts(row, rows());
                      return (
                        <li
                          class="ay__row"
                          data-seq={animate ? (isRowShown(i()) ? "in" : "out") : undefined}
                          data-me={row.playerId === props.selfId ? "1" : undefined}
                          data-boom={row.exploded ? "1" : undefined}
                        >
                          <span class="ay__av">
                            <Avatar
                              index={avatarOf(row.playerId)}
                              size="var(--ay-av, 36px)"
                              connected={connectedOf(row.playerId)}
                              mood={row.exploded && isRowShown(i()) ? "out" : undefined}
                            />
                            <Show when={row.exploded}>
                              <svg class="ay__crack" viewBox="0 0 40 40" aria-hidden="true">
                                <path d="M21 2 L18 13 L24 18 L16 26 L20 38" />
                                <path d="M24 18 L34 14 M18 13 L8 9 M16 26 L6 30" />
                              </svg>
                              <span class="ay__stamp">PATLATTI</span>
                            </Show>
                          </span>
                          <div class="ay__bar" aria-hidden="true">
                            <i class="ay__bar-before" style={{ width: `${parts().before * 100}%` }} />
                            <i class="ay__bar-after" style={{ width: `${parts().after * 100}%` }} />
                          </div>
                          <span class="ay__clicks">
                            {row.before}
                            <Show when={row.exploded}>
                              <b class="ay__over">+{row.after}</b>
                              <CbState kind="bad" size={14} />
                            </Show>
                          </span>
                          <span
                            class="ay__pts"
                            data-pts={row.points}
                            ref={(el) => {
                              if (row.playerId === props.selfId) ownPtsEl.set(row.playerId, el);
                            }}
                          >
                            {pointsText(row.points)}
                          </span>
                        </li>
                      );
                    }}
                  </For>
                </ol>
              </div>
            )}
          </Show>
        </Show>
      </div>
      <Show when={boomOn()}>
        <BoomScene />
      </Show>
    </Screen>
  );
}
