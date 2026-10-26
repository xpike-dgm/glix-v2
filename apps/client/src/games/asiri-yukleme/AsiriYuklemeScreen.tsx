import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { hapticError, hapticMatch, hapticSolo, hapticTap } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { Screen } from "../../ui/Screen.js";
import { SoundToggle } from "../../ui/SoundToggle.js";
import type { GameScreenProps } from "../registry.js";
import "./asiri-yukleme.css";
import { reducedMotion } from "../../fx/motion.js";
import { createTapBatcher } from "./batcher.js";
import { Core } from "./Core.js";
import { alarm, blast, zap } from "./sounds.js";
import { barRatio, parseAsiriYuklemeView, resultRows } from "./view.js";

const SPARK_COLORS = ["#2ef2ff", "#ffffff", "#b6ff3b", "#ff2bd6"];
const MAX_SPARKS = 24;
const FX_GAP_MS = 55;

export default function AsiriYuklemeScreen(props: GameScreenProps) {
  const view = createMemo(() => parseAsiriYuklemeView(props.match.publicView, props.match.view));
  const reveal = () => view()?.reveal ?? null;
  const danger = () => (view()?.danger ?? false) && !reveal();
  const exploder = () => reveal()?.exploder ?? null;
  const iExploded = () => exploder() !== null && exploder() === props.selfId;

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

  const [pressed, setPressed] = createSignal(false);
  let sparksEl: HTMLDivElement | undefined;
  let coreWrap: HTMLDivElement | undefined;
  let lastFx = 0;
  let alive = 0;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(releaseTimer));

  const spark = (x: number, y: number): void => {
    if (!sparksEl || reducedMotion() || alive >= MAX_SPARKS) return;
    const n = 4;
    for (let i = 0; i < n; i++) {
      const el = document.createElement("i");
      el.className = "ay__spark";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.background = SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0] ?? "#2ef2ff";
      sparksEl.appendChild(el);
      alive++;
      const angle = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * 46;
      const anim = el.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0.2)`,
            opacity: 0,
          },
        ],
        { duration: 340 + Math.random() * 160, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
      anim.onfinish = () => {
        alive--;
        el.remove();
      };
    }
  };

  const hit = (e: PointerEvent): void => {
    e.preventDefault();
    if (props.spectator || reveal()) return;
    unlockAudio();
    // Her dokunuş sunucuya gidecek tıklama sayılır; görsel/ses/titreşim yalnız sıklığı sınırlı verilir.
    batcher.tap();
    setPressed(true);
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => setPressed(false), 70);
    const now = performance.now();
    if (now - lastFx >= FX_GAP_MS) {
      lastFx = now;
      zap();
      hapticTap();
    }
    const box = sparksEl?.getBoundingClientRect();
    if (box) spark(e.clientX - box.left, e.clientY - box.top);
  };

  // Tehlike başlayınca bir kez uyarı; tur bitince bekleyen tıklamalar atılır.
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

  let announced = false;
  createEffect(() => {
    const r = reveal();
    if (!r || announced) return;
    announced = true;
    batcher.drop();
    blast();
    if (!reducedMotion()) {
      coreWrap?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-14px)" },
          { transform: "translateX(12px)" },
          { transform: "translateX(-8px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 420, easing: "ease-out" },
      );
    }
    const mine = r.points[props.selfId] ?? 0;
    const timer = setTimeout(() => {
      if (props.spectator) return;
      if (mine > 0) hapticMatch();
      else hapticSolo();
    }, 300);
    onCleanup(() => clearTimeout(timer));
  });

  const rows = createMemo(() => {
    const r = reveal();
    return r ? resultRows(r, props.match.participants) : [];
  });
  const avatarOf = (id: string) => props.players.find((p) => p.id === id)?.avatar ?? 0;
  const connectedOf = (id: string) => props.players.find((p) => p.id === id)?.connected ?? true;
  const myPoints = () => reveal()?.points[props.selfId] ?? 0;

  const headline = () => {
    if (iExploded()) return "Patlattın!";
    if (exploder()) return "Çekirdek patladı!";
    return "Reaktör dayandı";
  };

  return (
    <Screen class={reveal() ? "ay" : "ay ay--play"}>
      <div class="ay__edge" data-on={danger() ? "1" : undefined} aria-hidden="true" />
      <header class="game__top">
        <div class="game__tools">
          <SoundToggle />
        </div>
      </header>

      <Show when={view()}>
        <Show
          when={reveal()}
          fallback={
            <>
              <div class="ay__stage" ref={coreWrap}>
                <button
                  type="button"
                  class="ay__hit"
                  disabled={props.spectator}
                  aria-label="Tıkla"
                  onPointerDown={hit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      batcher.tap();
                      zap();
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <Core danger={danger()} pressed={pressed()} />
                </button>
                <div class="ay__sparks" ref={sparksEl} aria-hidden="true" />
              </div>
              <p class="ay__hint" role="status">
                {props.spectator ? "Herkes çekirdeği dolduruyor…" : "Çekirdeğe hızlıca dokun!"}
              </p>
            </>
          }
        >
          {(r) => (
            <div class="ay__result">
              <div class="ay__core-small" ref={coreWrap}>
                <Core boom={r().exploder !== null} />
              </div>
              <div class="ay__head" data-boom={r().exploder ? "1" : "0"}>
                <p class="ay__verdict">{headline()}</p>
                <Show when={!props.spectator} fallback={<p class="ay__sub">Toplam {r().total} tık</p>}>
                  <p class="ay__sub" data-win={myPoints() > 0 ? "1" : myPoints() < 0 ? "-1" : "0"}>
                    {myPoints() > 0
                      ? `+${myPoints()} puan`
                      : myPoints() < 0
                        ? `${myPoints()} puan`.replace("-", "−")
                        : "Puan yok"}
                  </p>
                </Show>
              </div>
              <ol class="ay__rows">
                <For each={rows()}>
                  {(row, i) => (
                    <li
                      class="ay__row rise"
                      style={{ "--i": i() }}
                      data-me={row.playerId === props.selfId ? "1" : undefined}
                      data-boom={row.exploded ? "1" : undefined}
                    >
                      <Avatar
                        index={avatarOf(row.playerId)}
                        size="var(--ay-av, 36px)"
                        connected={connectedOf(row.playerId)}
                      />
                      <div class="ay__bar" aria-hidden="true">
                        <i style={{ width: `${row.exploded ? 100 : barRatio(row.clicks, rows()) * 100}%` }} />
                      </div>
                      <span class="ay__clicks">{row.clicks}</span>
                      <span class="ay__pts" data-pts={row.points}>
                        {row.points > 0 ? `+${row.points}` : row.points < 0 ? "−1" : "0"}
                      </span>
                    </li>
                  )}
                </For>
              </ol>
            </div>
          )}
        </Show>
      </Show>
    </Screen>
  );
}
