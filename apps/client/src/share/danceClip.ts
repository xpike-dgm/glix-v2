/**
 * Dans klibi: podyumu ekran dışında çizer ve cihazda kaydeder (hiçbir görüntü sunucuya gitmez).
 * Karakterler (Pixi, elle sürülen sahne) + zafer parçacıkları + logo/ad/puan tek 2B tuvalde birleşir;
 * `captureStream` + `MediaRecorder` ile kaydedilir. Dans zamanı duvar saatinden gelir (bkz. clipTiming.ts).
 * Bitince sahne, tuvaller, akış ve kaydedici bırakılır. MediaRecorder yoksa podyumun PNG afişi üretilir.
 */
import type { Cosmetics } from "@glix/engine";
import { cosmeticItem } from "@glix/engine";
import { hueShiftFor, lookOf } from "../character/look.js";
import type { CharacterStage, StageSlot } from "../character/stage.js";
import {
  celebrationKind,
  createParticles,
  type Particle,
  particleAt,
  spriteUrl,
  totalDuration,
} from "../fx/celebration.js";
import { look } from "../ui/avatars.js";
import { bitrateFor, type ClipFormat, containerOf } from "./clipFormat.js";
import { type Column, clipColumns, DESIGN_H, DESIGN_W } from "./clipLayout.js";
import {
  CELEBRATION_AT,
  CLIP_FPS,
  clipDone,
  clipFade,
  clipProgress,
  clipTime,
  stepSeconds,
} from "./clipTiming.js";
import { browserEnv, FOOTER_TEXT } from "./drawCard.js";

export interface ClipPerson {
  id: string;
  nickname: string;
  avatar: number;
  cosmetics: Cosmetics | undefined;
  rank: number;
  /** Biçimlenmiş puan ("12", "−3"). */
  score: string;
}

export interface ClipInput {
  /** En çok ilk 3, sıralı (iyiden kötüye). */
  people: readonly ClipPerson[];
  /** Kazanan kutlaması (mağaza kimliği); yoksa parçacık yok. */
  celebration?: string | undefined;
}

export interface ClipResult {
  blob: Blob;
  kind: "video" | "poster";
  /** Dosya uzantısı ve türü. */
  ext: "mp4" | "webm" | "png";
  mime: string;
}

export interface ClipOptions {
  mode: { kind: "video"; format: ClipFormat } | { kind: "poster" };
  signal?: AbortSignal;
  /** 0..1 */
  onProgress?: (p: number) => void;
  /** Düşük donanım: daha küçük çözünürlük, daha az parçacık. */
  low?: boolean;
}

const DISPLAY = '"Unbounded", "Inter Variable", system-ui, sans-serif';
const TEXT = '"Inter Variable", system-ui, sans-serif';
const CYAN = "#2ef2ff";
const GOLD = "#ffc23b";
const WHITE = "#f3f5ff";

export const clipSizeFor = (low: boolean): { w: number; h: number } =>
  low ? { w: 540, h: 960 } : { w: 720, h: 1280 };

const aborted = (): DOMException => new DOMException("Klip iptal edildi", "AbortError");

/** Sabit tohumlu rastgele sayı (aynı klip her seferinde aynı parçacıkları verir). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fit(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  family: string,
  start: number,
  min: number,
  maxW: number,
): void {
  for (let size = start; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) return;
  }
  ctx.font = `${weight} ${min}px ${family}`;
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Podyum madalyası rengi (oyundaki kürsüyle aynı: altın, gümüş, bronz). Sıra numarası yazılmaz. */
const medalColor = (rank: number): string => (rank === 1 ? "#ffc23b" : rank === 2 ? "#c9d2ff" : "#ff8a3b");

/** `MedalIcon` (ResultIcons.tsx) ile aynı çizim: kurdele + yuvarlak + yıldız; `size` px, üst-ortası (cx, top). */
function drawMedal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  size: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(cx - size / 2, top);
  ctx.scale(size / 24, size / 24);
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.fill(new Path2D("M7 2h4l1.4 5.2-3 .8L7 2zM17 2h-4l-1.4 5.2 3 .8L17 2z"));
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(12, 15, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(12, 15, 4.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.fill(new Path2D("M12 11.6l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z"));
  ctx.restore();
}

/** Karelerde değişmeyen her şey (arka plan, logo, başlık, podyum blokları, adlar, puanlar, alt yazı) bir kez çizilir. */
async function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  input: ClipInput,
  cols: readonly Column[],
): Promise<void> {
  const W = DESIGN_W;
  const H = DESIGN_H;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0a1030");
  g.addColorStop(1, "#05081a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const winner = input.people[0];
  const accent = winner ? look(winner.avatar).color : CYAN;
  const glow = ctx.createRadialGradient(W / 2, 760, 40, W / 2, 760, 560);
  glow.addColorStop(0, `${accent}55`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = `${accent}aa`;
  ctx.lineWidth = 4;
  pill(ctx, 16, 16, W - 32, H - 32, 38);
  ctx.stroke();

  const logo = await browserEnv.loadImage("/assets/brand/logo.webp");
  if (logo) ctx.drawImage(logo, W / 2 - 150, 44, 300, 150);
  else {
    ctx.fillStyle = CYAN;
    ctx.textAlign = "center";
    ctx.font = `800 80px ${DISPLAY}`;
    ctx.fillText("GLIX", W / 2, 140);
  }

  const winners = input.people.filter((p) => p.rank === 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = GOLD;
  ctx.font = `800 26px ${TEXT}`;
  ctx.fillText(winners.length > 1 ? "BERABERE" : "KAZANAN", W / 2, 244);
  const names = winners.map((p) => p.nickname).join(" ve ");
  fit(ctx, names, 800, DISPLAY, 64, 28, W - 100);
  ctx.shadowColor = accent;
  ctx.shadowBlur = 24;
  ctx.fillStyle = WHITE;
  ctx.fillText(names, W / 2, 314);
  ctx.shadowBlur = 0;
  const first = winners[0];
  if (first) {
    ctx.font = `700 32px ${TEXT}`;
    ctx.fillStyle = CYAN;
    ctx.fillText(`${first.score} puan`, W / 2, 364);
  }

  // Zemin çizgisi ve podyum blokları
  ctx.fillStyle = "rgba(46,242,255,0.08)";
  ctx.fillRect(40, 1150, W - 80, 4);
  for (const c of cols) {
    const p = input.people[c.index];
    if (!p) continue;
    const color = look(p.avatar).color;
    const x = c.cx - c.blockW / 2;
    const bg = ctx.createLinearGradient(0, c.blockTop, 0, c.blockTop + c.blockH);
    bg.addColorStop(0, `${color}44`);
    bg.addColorStop(1, "#0a1030");
    ctx.fillStyle = bg;
    pill(ctx, x, c.blockTop, c.blockW, c.blockH, 18);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    drawMedal(ctx, c.cx, c.blockTop + 8, p.rank === 1 ? 84 : 64, medalColor(p.rank));
    ctx.textAlign = "center";
    ctx.fillStyle = WHITE;
    fit(ctx, p.nickname, 800, DISPLAY, 26, 16, c.blockW - 20);
    ctx.fillText(p.nickname, c.cx, c.blockTop + c.blockH - 42);
    ctx.fillStyle = color;
    ctx.font = `700 22px ${TEXT}`;
    ctx.fillText(`${p.score} puan`, c.cx, c.blockTop + c.blockH - 14);
  }

  // Alt yazı
  ctx.font = `800 28px ${TEXT}`;
  const w = ctx.measureText(FOOTER_TEXT).width + 56;
  ctx.fillStyle = "rgba(5,8,26,0.85)";
  pill(ctx, (W - w) / 2, 1186, w, 56, 28);
  ctx.fill();
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = CYAN;
  ctx.textAlign = "center";
  ctx.fillText(FOOTER_TEXT, W / 2, 1223);
}

function slotsFor(
  input: ClipInput,
  cols: readonly Column[],
  anchors: readonly HTMLElement[],
  still: boolean,
  stillAt: (dance: string) => number,
): StageSlot[] {
  const out: StageSlot[] = [];
  for (const c of cols) {
    const p = input.people[c.index];
    const anchor = anchors[c.index];
    if (!p || !anchor) continue;
    const lk = lookOf(p.cosmetics);
    out.push({
      key: p.id,
      anchor,
      layers: lk.layers,
      tints: lk.tints,
      hue: hueShiftFor(look(p.avatar).color),
      act: c.dances
        ? still
          ? { kind: "still", id: lk.dance, at: stillAt(lk.dance) }
          : { kind: "dance", id: lk.dance }
        : still
          ? { kind: "still", id: "selam", at: 0 }
          : { kind: "ovation", offset: c.index * 1.3 },
    });
  }
  return out;
}

/** Klibi (ya da afişi) üretir. İptalde AbortError fırlatır. Her durumda çizim kaynakları bırakılır. */
export async function makeClip(input: ClipInput, opts: ClipOptions): Promise<ClipResult> {
  const { signal } = opts;
  const check = (): void => {
    if (signal?.aborted) throw aborted();
  };
  check();
  const { w: OW, h: OH } = clipSizeFor(opts.low === true);
  const S = OW / DESIGN_W;
  const cols = clipColumns(input.people.map((p) => p.rank));

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  // Ekran dışında ama yerleşimli (Pixi alanını ve kutu ölçülerini ister); kullanıcı görmez.
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${DESIGN_W / 2}px;height:${DESIGN_H / 2}px;pointer-events:none;contain:strict`;
  const anchors: HTMLElement[] = [];
  for (const c of cols) {
    const a = document.createElement("div");
    a.style.cssText = `position:absolute;left:${(c.cx - c.figW / 2) / 2}px;top:${(c.blockTop + 8 - c.figH) / 2}px;width:${c.figW / 2}px;height:${c.figH / 2}px`;
    host.appendChild(a);
    anchors[c.index] = a;
  }
  document.body.appendChild(host);

  let stage: CharacterStage | null = null;
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let out: HTMLCanvasElement | null = null;
  let back: HTMLCanvasElement | null = null;
  const onHidden = (): void => {
    if (document.hidden) aborter.abort();
  };
  const aborter = new AbortController();
  const stop = (): boolean => signal?.aborted === true || aborter.signal.aborted;
  const guard = (): void => {
    if (stop()) throw aborted();
  };
  signal?.addEventListener("abort", () => aborter.abort(), { once: true });

  try {
    const celebration = input.celebration ? cosmeticItem(input.celebration) : undefined;
    const kind = celebration?.type === "zafer" ? celebrationKind(celebration.asset) : null;
    const [{ mountCharacterStage }, { loadDance }, { posterTime }] = await Promise.all([
      import("../character/stage.js"),
      import("../character/kit.js"),
      import("../character/dance.js"),
      browserEnv.fontsReady(),
    ]);
    guard();
    const poster = opts.mode.kind === "poster";
    stage = await mountCharacterStage(host, {
      reduced: poster,
      manual: true,
      resolution: OW / (DESIGN_W / 2),
    });
    guard();

    out = document.createElement("canvas");
    out.width = OW;
    out.height = OH;
    back = document.createElement("canvas");
    back.width = OW;
    back.height = OH;
    const octx = out.getContext("2d");
    const bctx = back.getContext("2d");
    if (!octx || !bctx) throw new Error("tuval yok");
    bctx.scale(S, S);
    await drawBackdrop(bctx, input, cols);
    guard();

    // Afişte dans karesi: dansın en dinamik anı
    const stillTimes = new Map<string, number>();
    if (poster) {
      for (const p of input.people) {
        const id = lookOf(p.cosmetics).dance;
        if (stillTimes.has(id)) continue;
        try {
          stillTimes.set(id, posterTime(await loadDance(id)));
        } catch {
          stillTimes.set(id, 0);
        }
      }
    }
    stage.update(slotsFor(input, cols, anchors, poster, (d) => stillTimes.get(d) ?? 0));
    await stage.settled();
    guard();

    // Parçacıklar (2B tuvalde; saf kural + sabit tohum)
    let parts: Particle[] = [];
    const sprites: (CanvasImageSource | null)[] = [];
    const asset = celebration?.asset;
    if (kind && asset) {
      parts = createParticles(kind, DESIGN_W, DESIGN_H, opts.low === true, mulberry32(1337), 1);
      for (let i = 0; i < 4; i++) sprites.push(await browserEnv.loadImage(spriteUrl(asset, i)));
      guard();
    }
    const partEnd = totalDuration(parts);

    const compose = (t: number, poster1: boolean): void => {
      octx.globalAlpha = 1;
      octx.drawImage(back as HTMLCanvasElement, 0, 0);
      // Pixi tuvali çizimden hemen sonra okunur (tampon henüz bırakılmadı)
      octx.drawImage((stage as CharacterStage).canvas, 0, 0, OW, OH);
      if (!poster1 && parts.length > 0 && t - CELEBRATION_AT <= partEnd + 0.1) {
        for (const p of parts) {
          const st = particleAt(p, t - CELEBRATION_AT);
          if (!st) continue;
          const img = sprites[p.sprite % Math.max(1, sprites.length)];
          if (!img) continue;
          octx.save();
          octx.globalAlpha = st.alpha;
          octx.translate(st.x * S, st.y * S);
          octx.rotate(st.rot);
          const sz = st.size * S;
          octx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
          octx.restore();
        }
      }
      if (!poster1) {
        const f = clipFade(t);
        if (f < 1) {
          octx.globalAlpha = 1 - f;
          octx.fillStyle = "#05081a";
          octx.fillRect(0, 0, OW, OH);
          octx.globalAlpha = 1;
        }
      }
    };

    if (poster) {
      stage.step(0);
      compose(0, true);
      opts.onProgress?.(1);
      const blob = await new Promise<Blob | null>((res) =>
        (out as HTMLCanvasElement).toBlob(res, "image/png"),
      );
      if (!blob) throw new Error("afiş üretilemedi");
      return { blob, kind: "poster", ext: "png", mime: "image/png" };
    }

    if (opts.mode.kind !== "video") throw new Error("kip");
    const format = opts.mode.format;
    stream = out.captureStream(CLIP_FPS);
    recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: bitrateFor(OW, OH) });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e: BlobEvent): void => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<void>((res, rej) => {
      (recorder as MediaRecorder).onstop = () => res();
      (recorder as MediaRecorder).onerror = () => rej(new Error("kayıt hatası"));
    });
    document.addEventListener("visibilitychange", onHidden);

    // İlk kareyi çiz, sonra kaydı başlat; duvar saati ilk kareden sayılır.
    stage.step(0);
    compose(0, false);
    recorder.start(250);
    const t0 = performance.now();
    let prev = 0;
    await new Promise<void>((resolve, reject) => {
      const loop = (): void => {
        if (stop()) {
          reject(aborted());
          return;
        }
        const ms = performance.now() - t0;
        const t = clipTime(ms);
        (stage as CharacterStage).step(stepSeconds(prev, t));
        prev = t;
        compose(t, false);
        opts.onProgress?.(clipProgress(t));
        if (clipDone(ms)) resolve();
        else requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    guard();
    // Son kare akışa girsin diye kısa bekleyip durdur.
    await new Promise((r) => setTimeout(r, 300));
    recorder.stop();
    await stopped;
    guard();
    const real = containerOf(recorder.mimeType || format.mime, format);
    const blob = new Blob(chunks, { type: real.mime });
    if (blob.size === 0) throw new Error("boş klip");
    return { blob, kind: "video", ext: real.ext, mime: real.mime };
  } finally {
    document.removeEventListener("visibilitychange", onHidden);
    try {
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      }
    } catch {
      // kaydedici zaten durmuş
    }
    for (const t of stream?.getTracks() ?? []) t.stop();
    stage?.destroy();
    host.remove();
    for (const c of [out, back]) {
      if (c) {
        c.width = 0;
        c.height = 0;
      }
    }
  }
}
