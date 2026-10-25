// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import {
  KARALAMA_COLORS,
  KARALAMA_MAX_STROKES,
  KARALAMA_MAX_TOTAL_POINTS,
  type KaralamaStroke,
} from "@glix/engine";
import { createEffect, createSignal, For, type JSX, onCleanup, onMount, untrack } from "solid-js";
import { hapticReady, hapticTap, hapticTick } from "../../fx/haptics.js";
import { tap, tick, unlockAudio } from "../../fx/sound.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { serverNow, toast } from "../../net/store.js";
import type { AckLike } from "../../ui/optimistic.js";
import { TamamBar } from "../../ui/TamamBar.js";
import {
  MIN_STEP,
  PEN_COLORS,
  PEN_NAMES,
  paintAll,
  paintStroke,
  SIMPLIFY_EPS,
  SIZE_UNITS,
  simplify,
  toGrid,
  toStrokeChunks,
} from "./draw.js";
import { penIdOf } from "./view.js";

/** Bir çizgi bu kadar noktaya ulaşınca (sadeleştirmeden önce) parça parça gönderilir. */
const FLUSH_AT = 600;
const ERASER = KARALAMA_COLORS.length;

/**
 * Ortak çizim tahtası (Karalama Defteri ve Bozuk Telefon): üst şerit dışarıdan verilir, kotalar ve kilit durumu
 * çağıran oyunun görünümünden gelir.
 */
export interface DrawBoardProps {
  /** Sunucudaki darbelerim (sıra numarasına göre). */
  strokes: KaralamaStroke[];
  /** Çizim süresinin bitişi (sunucu saati). */
  endsAt: number;
  /** Çizimi "Bitti" ile kesinleştirdim mi. */
  done: boolean;
  /** "Bitti" diyenler / toplam. */
  readyCount: number;
  total: number;
  /** Sunucudaki darbe ve nokta kotaları (dolunca uyarı). */
  maxStrokes?: number;
  maxPoints?: number;
  /** Tahtanın üstündeki şerit (başlık + süre). */
  header: JSX.Element;
  now: () => number;
}

const EraserIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M8.5 20h11M5.2 14.3l8.4-8.4a2 2 0 012.8 0l3.7 3.7a2 2 0 010 2.8L12.6 20H8.7l-3.5-3.5a2 2 0 010-2.2z" />
    <path d="M9 11.2l5.8 5.8" />
  </svg>
);
const UndoIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M9 7L4.5 11.5 9 16M5 11.5h9a5.5 5.5 0 010 11" transform="translate(0 -3)" />
  </svg>
);
const TrashIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.8 12.2h9.4L17.5 7M10 11v5M14 11v5" />
  </svg>
);

/** Çizim tahtası: tek parmakla/kalemle çizim, 6 renk + silgi, 3 kalınlık, geri al, temizle. */
export function DrawBoard(props: DrawBoardProps) {
  let base: HTMLCanvasElement | undefined;
  let live: HTMLCanvasElement | undefined;
  let stage: HTMLDivElement | undefined;
  let board: HTMLDivElement | undefined;

  const [pen, setPen] = createSignal(0);
  const [size, setSize] = createSignal<1 | 2 | 3>(2);
  const [count, setCount] = createSignal(0);
  const [confirmClear, setConfirmClear] = createSignal(false);
  const [box, setBox] = createSignal(0);

  let local: KaralamaStroke[] = [];
  let localPoints = 0;
  let lastSentAt = 0;
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;
  let reconcileTimer: ReturnType<typeof setTimeout> | undefined;

  // --- tahta boyutu ---
  const dpr = (): number => Math.min(window.devicePixelRatio || 1, 3);
  const repaint = (): void => {
    const ctx = base?.getContext("2d");
    const px = box();
    if (!ctx || px < 2) return;
    paintAll(ctx, local, px, base ? base.width / px : dpr());
  };
  const clearLive = (): void => {
    const ctx = live?.getContext("2d");
    if (ctx && live) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, live.width, live.height);
    }
  };
  const resizeBoard = (): void => {
    if (!stage || !base || !live) return;
    const side = Math.floor(Math.min(stage.clientWidth, stage.clientHeight));
    if (side < 2) return;
    setBox(side);
    const backing = Math.round(side * dpr());
    for (const c of [base, live]) {
      c.width = backing;
      c.height = backing;
    }
    repaint();
  };
  onMount(() => {
    resizeBoard();
    const ro = new ResizeObserver(resizeBoard);
    if (stage) ro.observe(stage);
    onCleanup(() => ro.disconnect());
  });
  onCleanup(() => {
    clearTimeout(confirmTimer);
    clearTimeout(reconcileTimer);
    cancelAnimationFrame(raf);
  });

  // --- sunucuyla uzlaşma: yerel çizim doğru kabul edilir; yalnız uzun süre sessizlikten sonra sunucuya uyulur ---
  const syncFromServer = (): void => {
    const server = untrack(() => props.strokes);
    if (serverNow() - lastSentAt < 2_000 && lastSentAt !== 0) return;
    if (server.length === local.length && lastSentAt !== 0) return;
    if (server.length === local.length && local.length === 0) return;
    local = [...server];
    localPoints = local.reduce((n, s) => n + (s.length - 2) / 2, 0);
    setCount(local.length);
    repaint();
  };
  createEffect(() => {
    void props.strokes;
    syncFromServer();
  });
  const scheduleReconcile = (): void => {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(syncFromServer, 2_400);
  };

  const maxStrokes = (): number => props.maxStrokes ?? KARALAMA_MAX_STROKES;
  const maxPoints = (): number => props.maxPoints ?? KARALAMA_MAX_TOTAL_POINTS;
  const [sentLock, setSentLock] = createSignal(false);
  const locked = (): boolean => props.done || sentLock();
  const over = (): boolean => props.now() >= props.endsAt;
  const lockDone = (): AckLike => {
    if (locked() || over() || count() === 0) return false;
    setSentLock(true);
    hapticReady();
    const ack = sendActionAck({ kind: "lock" });
    void ack.then((a) => {
      if (!a.ok && a.reason !== "timeout") setSentLock(false);
    });
    return ack;
  };

  // --- gönderme ---
  const commitPoints = (points: number[], final: boolean): void => {
    const simple = simplify(points, SIMPLIFY_EPS);
    const chunks = toStrokeChunks(simple);
    const erase = pen() === ERASER;
    for (const chunk of chunks) {
      const n = chunk.length / 2;
      if (local.length >= maxStrokes() || localPoints + n > maxPoints()) {
        toast("Defter doldu: geri al ya da temizle");
        break;
      }
      const stroke: KaralamaStroke = [pen(), size(), ...chunk];
      local.push(stroke);
      localPoints += n;
      lastSentAt = serverNow();
      sendAction({ kind: "stroke", color: penIdOf(pen()), size: size(), points: chunk });
      if (!erase) {
        const ctx = base?.getContext("2d");
        if (ctx) {
          ctx.setTransform(base ? base.width / 1000 : 1, 0, 0, base ? base.width / 1000 : 1, 0, 0);
          paintStroke(ctx, stroke);
        }
      }
    }
    setCount(local.length);
    if (erase && final) repaint();
    if (!final) return;
    clearLive();
    scheduleReconcile();
  };

  // --- işaretçi ---
  let activeId = -1;
  let cur: number[] = [];
  let rect: DOMRect | null = null;
  let sawPen = false;
  let raf = 0;
  let painted = 0;

  const drawLive = (): void => {
    raf = 0;
    if (activeId === -1 || cur.length < 2) return;
    const erase = pen() === ERASER;
    const px = box();
    if (erase) {
      // Silgi doğrudan tahtadan siler (yalnız yeni eklenen kısım).
      const ctx = base?.getContext("2d");
      if (!ctx || !base) return;
      const from = Math.max(0, painted - 1);
      const part = cur.slice(from * 2);
      if (part.length >= 4) {
        const k = base.width / 1000;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        paintStroke(ctx, [pen(), size(), ...part]);
      }
      painted = cur.length / 2;
      return;
    }
    const ctx = live?.getContext("2d");
    if (!ctx || !live || px < 2) return;
    const k = live.width / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, live.width, live.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const pts =
      cur.length === 2 ? [cur[0] as number, cur[1] as number, cur[0] as number, cur[1] as number] : cur;
    paintStroke(ctx, [pen(), size(), ...pts]);
  };
  const schedule = (): void => {
    if (!raf) raf = requestAnimationFrame(drawLive);
  };

  const addPoint = (clientX: number, clientY: number): void => {
    if (!rect) return;
    const x = toGrid(clientX, rect.left, rect.width);
    const y = toGrid(clientY, rect.top, rect.height);
    const n = cur.length;
    if (n >= 2) {
      const dx = x - (cur[n - 2] as number);
      const dy = y - (cur[n - 1] as number);
      if (dx * dx + dy * dy < MIN_STEP * MIN_STEP) return;
    }
    cur.push(x, y);
  };

  const accepts = (e: PointerEvent): boolean => {
    if (props.endsAt <= props.now() || locked()) return false;
    if (e.pointerType === "pen") {
      sawPen = true;
      return true;
    }
    // Kalem kullanıldıysa avuç içi (dokunma) yok sayılır; çok geniş temas da avuç sayılır.
    if (e.pointerType === "touch") {
      if (sawPen) return false;
      if (e.width > 70 && e.height > 70) return false;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return false;
    return true;
  };

  const onDown = (e: PointerEvent): void => {
    if (activeId !== -1 || !accepts(e)) return;
    e.preventDefault();
    unlockAudio();
    live?.setPointerCapture(e.pointerId);
    activeId = e.pointerId;
    rect = board?.getBoundingClientRect() ?? null;
    cur = [];
    painted = 0;
    addPoint(e.clientX, e.clientY);
    if (cur.length === 0) return;
    hapticTick();
    schedule();
  };
  const onMove = (e: PointerEvent): void => {
    if (e.pointerId !== activeId) return;
    e.preventDefault();
    const list = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    for (const ev of list.length > 0 ? list : [e]) addPoint(ev.clientX, ev.clientY);
    if (cur.length / 2 >= FLUSH_AT) {
      const lastTwo = cur.slice(-2);
      commitPoints(cur, false);
      cur = lastTwo;
      painted = 1;
    }
    schedule();
  };
  const onUp = (e: PointerEvent): void => {
    if (e.pointerId !== activeId) return;
    if (e.type === "pointerup") addPoint(e.clientX, e.clientY);
    activeId = -1;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    const pts = cur;
    cur = [];
    painted = 0;
    if (pts.length >= 2 && e.type === "pointerup") commitPoints(pts, true);
    else clearLive();
  };

  // --- araçlar ---
  const undo = (): void => {
    if (local.length === 0 || over() || locked()) return;
    const last = local.pop() as KaralamaStroke;
    localPoints -= (last.length - 2) / 2;
    lastSentAt = serverNow();
    setCount(local.length);
    repaint();
    tap();
    hapticTap();
    sendAction({ kind: "undo" });
    scheduleReconcile();
  };
  const clearAll = (): void => {
    if (local.length === 0 || over() || locked()) return;
    if (!confirmClear()) {
      setConfirmClear(true);
      hapticTap();
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => setConfirmClear(false), 2_200);
      return;
    }
    clearTimeout(confirmTimer);
    setConfirmClear(false);
    local = [];
    localPoints = 0;
    lastSentAt = serverNow();
    setCount(0);
    repaint();
    hapticReady();
    tick();
    sendAction({ kind: "clear" });
    scheduleReconcile();
  };
  const choosePen = (i: number): void => {
    if (locked()) return;
    unlockAudio();
    setPen(i);
    tap();
    hapticTap();
  };
  const chooseSize = (s: 1 | 2 | 3): void => {
    if (locked()) return;
    unlockAudio();
    setSize(s);
    tap();
    hapticTap();
  };

  const penColor = (): string => PEN_COLORS[pen()] ?? "#8E97C7";
  const dot = (s: number): string => `${Math.round((SIZE_UNITS[s] ?? 15) * 0.55 + 4)}px`;

  return (
    <>
      {props.header}
      <div class="kd__stage" ref={stage}>
        <div
          class="kd__board"
          ref={board}
          style={{ "--pen": penColor(), width: `${box()}px`, height: `${box()}px` }}
        >
          <canvas class="kd__ink" ref={base} />
          <canvas
            class="kd__ink kd__live"
            ref={live}
            aria-label="Çizim tahtası"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      </div>
      <div class="kd__side">
        <div
          class="kd__tools"
          role="toolbar"
          aria-label="Kalem araçları"
          data-frozen={locked() ? "1" : undefined}
        >
          <For each={PEN_COLORS}>
            {(c, i) => (
              <button
                type="button"
                class="kd__tool kd__swatch"
                style={{ "--sw": c }}
                data-on={pen() === i() ? "1" : undefined}
                aria-label={PEN_NAMES[i()]}
                aria-pressed={pen() === i()}
                disabled={locked()}
                onClick={() => choosePen(i())}
              >
                <i />
              </button>
            )}
          </For>
          <button
            type="button"
            class="kd__tool"
            data-on={pen() === ERASER ? "1" : undefined}
            aria-label="Silgi"
            aria-pressed={pen() === ERASER}
            disabled={locked()}
            onClick={() => choosePen(ERASER)}
          >
            <EraserIcon />
          </button>
          <For each={[1, 2, 3] as const}>
            {(s) => (
              <button
                type="button"
                class="kd__tool kd__size"
                data-on={size() === s ? "1" : undefined}
                aria-label={`Kalınlık ${s}`}
                aria-pressed={size() === s}
                disabled={locked()}
                onClick={() => chooseSize(s)}
              >
                <i style={{ width: dot(s), height: dot(s) }} />
              </button>
            )}
          </For>
          <button
            type="button"
            class="kd__tool"
            aria-label="Geri al"
            disabled={count() === 0 || locked()}
            onClick={undo}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            class="kd__tool kd__tool--clear"
            data-on={confirmClear() ? "1" : undefined}
            aria-label={confirmClear() ? "Silmek için tekrar dokun" : "Temizle"}
            disabled={count() === 0 || locked()}
            onClick={clearAll}
          >
            <TrashIcon />
          </button>
        </div>
        <TamamBar
          label="Bitti"
          locked={locked()}
          disabled={count() === 0 || over()}
          ready={props.readyCount}
          total={props.total}
          onLock={lockDone}
        />
      </div>
    </>
  );
}
