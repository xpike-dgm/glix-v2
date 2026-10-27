import { paintAll } from "../games/karalama-defteri/draw.js";
import { look, moodSrc } from "../ui/avatars.js";
import { worldSrc } from "../ui/world.js";
import type { Moment, MomentPerson } from "./momentCards.js";

/** Kart boyutu: 9:16. */
export const CARD_W = 1080;
export const CARD_H = 1920;
export const SITE = "glix.dgmcraft.online";
export const FOOTER_TEXT = `Sen de oyna: ${SITE}`;

const DISPLAY = '"Unbounded", "Inter Variable", system-ui, sans-serif';
const TEXT = '"Inter Variable", system-ui, sans-serif';
const CYAN = "#2ef2ff";
const MAGENTA = "#ff2bd6";
const WHITE = "#f3f5ff";

/** Çizime bağlı dış dünya: testte sahte, tarayıcıda gerçek. */
export interface CardEnv {
  makeCanvas(w: number, h: number): HTMLCanvasElement;
  loadImage(url: string): Promise<CanvasImageSource | null>;
  fontsReady(): Promise<void>;
}

const imageCache = new Map<string, Promise<CanvasImageSource | null>>();

export const browserEnv: CardEnv = {
  makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  },
  loadImage(url) {
    let p = imageCache.get(url);
    if (!p) {
      p = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });
      imageCache.set(url, p);
    }
    return p;
  },
  async fontsReady() {
    try {
      await Promise.all([
        document.fonts.load('800 80px "Unbounded"', "ĞÜŞİıÖÇğüşöç Kazanan 0123"),
        document.fonts.load('700 40px "Unbounded"', "ĞÜŞİıÖÇğüşöç"),
        document.fonts.load('800 40px "Inter Variable"', "ĞÜŞİıÖÇğüşöç Sen de oyna"),
        document.fonts.load('600 40px "Inter Variable"', "ĞÜŞİıÖÇğüşöç"),
      ]);
      await document.fonts.ready;
    } catch {
      // yazı tipleri yüklenemezse sistem yazı tipiyle çizilir
    }
  },
};

type Ctx = CanvasRenderingContext2D;

/** Metni verilen genişliğe sığacak satırlara böler (kelime sınırında; çok uzun tek kelime harf harf). */
export function wrapLines(
  ctx: Pick<Ctx, "measureText">,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter((w) => w !== "");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur === "" ? word : `${cur} ${word}`;
    if (ctx.measureText(test).width <= maxWidth || cur === "") {
      cur = test;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${(kept[maxLines - 1] ?? "").replace(/[\s.,]+$/, "")}…`;
    return kept;
  }
  return lines;
}

/** Tek satıra sığana kadar yazıyı küçültür; en küçükte keser. */
function fitFont(
  ctx: Ctx,
  text: string,
  weight: number,
  family: string,
  start: number,
  min: number,
  maxW: number,
): number {
  let size = start;
  for (; size > min; size -= 4) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) return size;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return min;
}

function cover(ctx: Ctx, img: CanvasImageSource, w: number, h: number): void {
  const iw = (img as { width: number }).width || w;
  const ih = (img as { height: number }).height || h;
  const s = Math.max(w / iw, h / ih);
  ctx.drawImage(img, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function background(ctx: Ctx, env: CardEnv, world: string | null, accent: string): Promise<void> {
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, "#0a1030");
  g.addColorStop(1, "#05081a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const img = world ? await env.loadImage(worldSrc(world, "portrait")) : null;
  if (img) {
    ctx.globalAlpha = 0.55;
    cover(ctx, img, CARD_W, CARD_H);
    ctx.globalAlpha = 1;
  }
  // Okunurluk için üstten alta koyu perde; renkli neon parıltı.
  const veil = ctx.createLinearGradient(0, 0, 0, CARD_H);
  veil.addColorStop(0, "rgba(5,8,26,0.7)");
  veil.addColorStop(0.45, "rgba(5,8,26,0.45)");
  veil.addColorStop(1, "rgba(5,8,26,0.92)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(CARD_W / 2, 780, 60, CARD_W / 2, 780, 760);
  glow.addColorStop(0, `${accent}55`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // Neon çerçeve.
  ctx.strokeStyle = `${accent}aa`;
  ctx.lineWidth = 6;
  roundRect(ctx, 24, 24, CARD_W - 48, CARD_H - 48, 56);
  ctx.stroke();
}

async function drawLogo(ctx: Ctx, env: CardEnv): Promise<void> {
  const logo = await env.loadImage("/assets/brand/logo.webp");
  if (logo) {
    ctx.drawImage(logo, CARD_W / 2 - 230, 70, 460, 230);
    return;
  }
  ctx.fillStyle = CYAN;
  ctx.textAlign = "center";
  ctx.font = `800 120px ${DISPLAY}`;
  ctx.fillText("GLIX", CARD_W / 2, 220);
}

function title(ctx: Ctx, text: string, y: number, color: string): number {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const size = fitFont(ctx, text, 800, DISPLAY, 104, 48, CARD_W - 140);
  ctx.shadowColor = color;
  ctx.shadowBlur = 36;
  ctx.fillStyle = WHITE;
  ctx.fillText(text, CARD_W / 2, y + size);
  ctx.shadowBlur = 0;
  return y + size;
}

async function drawAvatar(
  ctx: Ctx,
  env: CardEnv,
  p: MomentPerson,
  cx: number,
  cy: number,
  size: number,
  happy: boolean,
): Promise<void> {
  const r = size / 2;
  const color = look(p.avatar).color;
  const disc = ctx.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r);
  disc.addColorStop(0, `${color}66`);
  disc.addColorStop(1, "#0a1030");
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = disc;
  ctx.fill();
  ctx.clip();
  const img = await env.loadImage(moodSrc(p.avatar, happy ? "happy" : "idle"));
  if (img) ctx.drawImage(img, cx - r, cy - r, size, size);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(6, size * 0.035);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/** Avatar + ad + küçük yazı; sütun genişliği `colW`. Alt kenarın y'sini döner. */
async function drawPerson(
  ctx: Ctx,
  env: CardEnv,
  p: MomentPerson,
  cx: number,
  top: number,
  size: number,
  colW: number,
  nameSize: number,
  happy: boolean,
): Promise<number> {
  await drawAvatar(ctx, env, p, cx + 0, top + size / 2, size, happy);
  ctx.textAlign = "center";
  let y = top + size + nameSize * 1.25;
  const fs = fitFont(ctx, p.nickname, 800, DISPLAY, nameSize, 30, colW);
  ctx.fillStyle = WHITE;
  ctx.fillText(p.nickname, cx, y);
  y += fs * 0.3;
  if (p.caption) {
    const cs = Math.round(nameSize * 0.6);
    ctx.font = `700 ${cs}px ${TEXT}`;
    ctx.fillStyle = look(p.avatar).color;
    y += cs * 1.1;
    ctx.fillText(p.caption, cx, y);
  }
  return y;
}

function bodyLines(ctx: Ctx, lines: readonly string[], y: number, maxLines: number, size = 62): number {
  ctx.textAlign = "center";
  ctx.font = `800 ${size}px ${TEXT}`;
  ctx.fillStyle = WHITE;
  let cur = y;
  for (const line of lines) {
    for (const l of wrapLines(ctx, line, CARD_W - 180, maxLines)) {
      cur += size * 1.3;
      ctx.fillText(l, CARD_W / 2, cur);
    }
  }
  return cur;
}

function footer(ctx: Ctx): void {
  const y = CARD_H - 150;
  ctx.font = `800 52px ${TEXT}`;
  ctx.textAlign = "center";
  const w = ctx.measureText(FOOTER_TEXT).width + 90;
  ctx.fillStyle = "rgba(5,8,26,0.85)";
  roundRect(ctx, (CARD_W - w) / 2, y - 66, w, 100, 50);
  ctx.fill();
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = CYAN;
  ctx.fillText(FOOTER_TEXT, CARD_W / 2, y);
}

async function drawWinner(ctx: Ctx, env: CardEnv, m: Moment, y0: number): Promise<void> {
  const firsts = m.people.filter((p) => p.rank === 1);
  const rest = m.people.filter((p) => p.rank !== 1);
  const big = firsts.length === 1 ? (rest.length > 0 ? 430 : 520) : firsts.length === 2 ? 380 : 300;
  const colW = firsts.length === 1 ? 900 : CARD_W / firsts.length - 40;
  let bottom = y0;
  for (const [i, p] of firsts.entries()) {
    const cx = (CARD_W / firsts.length) * (i + 0.5);
    bottom = Math.max(
      bottom,
      await drawPerson(ctx, env, p, cx, y0, big, colW, firsts.length === 1 ? 76 : 56, true),
    );
  }
  let y = bottom + 50;
  const label = m.lines[0];
  if (label) {
    ctx.font = `800 54px ${TEXT}`;
    const w = ctx.measureText(label).width + 80;
    ctx.fillStyle = "rgba(255,194,59,0.18)";
    roundRect(ctx, (CARD_W - w) / 2, y, w, 90, 45);
    ctx.fill();
    ctx.strokeStyle = "#ffc23b";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#ffc23b";
    ctx.textAlign = "center";
    ctx.fillText(label, CARD_W / 2, y + 63);
    y += 130;
  }
  if (rest.length > 0) {
    const size = 210;
    for (const [i, p] of rest.entries()) {
      const cx = CARD_W / 2 + (i - (rest.length - 1) / 2) * 440;
      await drawPerson(ctx, env, p, cx, Math.min(y + 60, CARD_H - 520), size, 400, 44, false);
      ctx.fillStyle = MAGENTA;
      ctx.font = `800 40px ${DISPLAY}`;
      ctx.textAlign = "center";
      ctx.fillText(`${p.rank}.`, cx - size / 2 - 36, Math.min(y + 60, CARD_H - 520) + 52);
    }
  }
}

async function drawDrawing(ctx: Ctx, env: CardEnv, m: Moment, y0: number): Promise<void> {
  const board = 840;
  const x = (CARD_W - board) / 2;
  ctx.save();
  roundRect(ctx, x, y0, board, board, 44);
  ctx.fillStyle = "#070b22";
  ctx.fill();
  ctx.clip();
  const layer = env.makeCanvas(board, board);
  const lctx = layer.getContext("2d");
  if (lctx && m.strokes) {
    paintAll(lctx, m.strokes, board, 1, true);
    ctx.drawImage(layer, x, y0);
  }
  ctx.restore();
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 6;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 24;
  roundRect(ctx, x, y0, board, board, 44);
  ctx.stroke();
  ctx.shadowBlur = 0;
  const p = m.people[0];
  if (p) {
    const top = y0 + board + 60;
    const fs = fitFont(ctx, p.nickname, 800, DISPLAY, 72, 32, 560);
    const nameW = ctx.measureText(p.nickname).width;
    const total = 140 + 28 + nameW;
    const left = (CARD_W - total) / 2;
    await drawAvatar(ctx, env, p, left + 70, top + 70, 140, true);
    ctx.textAlign = "left";
    ctx.fillStyle = WHITE;
    ctx.fillText(p.nickname, left + 168, top + 70 + fs * 0.35);
  }
}

async function drawSolo(ctx: Ctx, env: CardEnv, m: Moment, y0: number): Promise<void> {
  const p = m.people[0];
  let y = y0;
  if (p) y = await drawPerson(ctx, env, p, CARD_W / 2, y0, 440, 900, 76, true);
  ctx.save();
  bodyLines(ctx, m.lines, y + 40, 4);
  ctx.restore();
}

/** Bir an için 1080x1920 kartı çizer ve PNG olarak döner. Hiçbir şey ağa gitmez. */
export async function renderMomentCard(m: Moment, env: CardEnv = browserEnv): Promise<Blob> {
  await env.fontsReady();
  const canvas = env.makeCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas yok");
  const accent = m.kind === "comeback" ? MAGENTA : m.kind === "winner" ? "#ffc23b" : CYAN;
  await background(ctx, env, m.world, accent);
  await drawLogo(ctx, env);
  const ty = title(ctx, m.title, 340, accent);
  const y0 = ty + 70;
  if (m.kind === "winner") await drawWinner(ctx, env, m, y0);
  else if (m.kind === "drawing") await drawDrawing(ctx, env, m, y0);
  else await drawSolo(ctx, env, m, y0);
  footer(ctx);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("görüntü üretilemedi"))), "image/jpeg", 0.9);
  });
}
