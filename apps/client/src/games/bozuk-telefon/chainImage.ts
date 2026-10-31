import { browserEnv, type CardEnv, FOOTER_TEXT, wrapLines } from "../../share/drawCard.js";
import { look, moodSrc } from "../../ui/avatars.js";
import { paintAll } from "../karalama-defteri/draw.js";
import type { ParsedRecap } from "./view.js";

/**
 * "Zinciri kaydet" (BT-U7): zincirin tamamı telefonda tek uzun PNG olarak çizilir. Sunucuya hiçbir şey gitmez;
 * çağıran Web Share API varsa paylaşım menüsünü, yoksa indirmeyi açar.
 */

export const CHAIN_W = 1080;
const PAD = 60;
const CARD = CHAIN_W - PAD * 2;
const HEAD_H = 230;
const AUTHOR_H = 96;
const ARROW_H = 70;
const TEXT_PAD = 56;
const FOOT_H = 200;
const ROBUST_H = 130;

const DISPLAY = '"Unbounded", "Inter Variable", system-ui, sans-serif';
const TEXT = '"Inter Variable", system-ui, sans-serif';
const CYAN = "#2ef2ff";
const MAGENTA = "#ff2bd6";
const AMBER = "#ffc23b";
const LIME = "#b6ff3b";
const WHITE = "#f3f5ff";
const DIM = "#8e97c7";
const BOARD = "#060a20";

export interface ChainPerson {
  id: string;
  nickname: string;
  avatar: number;
}

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Yazı kartı: kelime sınırında satırlara bölünür, en çok 4 satıra sığana kadar küçülür. */
function textLayout(ctx: Ctx, text: string): { size: number; lines: string[] } {
  for (let size = 76; size >= 36; size -= 4) {
    ctx.font = `800 ${size}px ${DISPLAY}`;
    const lines = wrapLines(ctx, text, CARD - TEXT_PAD * 2, 99);
    const fits = lines.length <= 4 && lines.every((l) => ctx.measureText(l).width <= CARD - TEXT_PAD * 2);
    if (fits) return { size, lines };
  }
  ctx.font = `800 36px ${DISPLAY}`;
  return { size: 36, lines: wrapLines(ctx, text, CARD - TEXT_PAD * 2, 5) };
}

/** Her adım kartının yüksekliği (yazar satırı hariç). */
export function stepHeights(ctx: Ctx, recap: ParsedRecap): number[] {
  return recap.steps.map((s) => {
    if (s.kind === "draw") return CARD;
    const { size, lines } = textLayout(ctx, s.text);
    return Math.max(220, lines.length * size * 1.25 + TEXT_PAD * 2);
  });
}

/** Görselin toplam yüksekliği. */
export function chainHeight(heights: readonly number[], robust: boolean): number {
  const steps = heights.reduce((a, h) => a + h + AUTHOR_H, 0) + Math.max(0, heights.length - 1) * ARROW_H;
  return HEAD_H + steps + (robust ? ROBUST_H : 0) + FOOT_H;
}

async function drawAvatar(
  ctx: Ctx,
  env: CardEnv,
  avatar: number,
  cx: number,
  cy: number,
  size: number,
): Promise<void> {
  const r = size / 2;
  const color = look(avatar).color;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = `${color}44`;
  ctx.fill();
  ctx.clip();
  const img = await env.loadImage(moodSrc(avatar, "happy"));
  if (img) ctx.drawImage(img, cx - r, cy - r, size, size);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Zinciri tek uzun PNG olarak çizer. */
export async function renderChainImage(
  recap: ParsedRecap,
  people: readonly ChainPerson[],
  env: CardEnv = browserEnv,
): Promise<Blob> {
  await env.fontsReady();
  const probe = env.makeCanvas(4, 4).getContext("2d");
  if (!probe) throw new Error("canvas yok");
  const heights = stepHeights(probe, recap);
  const H = Math.ceil(chainHeight(heights, recap.robust));
  const canvas = env.makeCanvas(CHAIN_W, H);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas yok");
  const who = (id: string): ChainPerson | undefined => people.find((p) => p.id === id);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a1030");
  bg.addColorStop(1, "#05081a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CHAIN_W, H);

  // Başlık
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = CYAN;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 24;
  ctx.font = `800 64px ${DISPLAY}`;
  ctx.fillText("BOZUK TELEFON", CHAIN_W / 2, 110);
  ctx.shadowBlur = 0;
  ctx.fillStyle = DIM;
  ctx.font = `700 38px ${TEXT}`;
  const starter = who(recap.starter)?.nickname ?? "";
  ctx.fillText(`Zincir ${recap.chain + 1}${starter ? ` · ${starter} başlattı` : ""}`, CHAIN_W / 2, 170);

  let y = HEAD_H;
  for (const [i, step] of recap.steps.entries()) {
    const h = heights[i] ?? 0;
    const crowned = recap.crowned.includes(i);
    const votes = recap.tally[i] ?? 0;
    const person = who(step.author);
    // Yazar satırı
    if (person) await drawAvatar(ctx, env, person.avatar, PAD + 36, y + 44, 72);
    ctx.textAlign = "left";
    ctx.fillStyle = WHITE;
    ctx.font = `800 40px ${DISPLAY}`;
    ctx.fillText(`${i + 1}. ${person?.nickname ?? ""}`, PAD + 92, y + 58);
    if (votes > 0 || crowned) {
      ctx.textAlign = "right";
      ctx.font = `800 40px ${TEXT}`;
      ctx.fillStyle = crowned ? AMBER : LIME;
      ctx.fillText(`${crowned ? "👑 EN KOMİK · " : ""}😂 ${votes}`, CHAIN_W - PAD, y + 58);
    }
    y += AUTHOR_H;
    // Kart
    const accent = crowned ? AMBER : step.kind === "draw" ? MAGENTA : "#8b5cff";
    ctx.save();
    roundRect(ctx, PAD, y, CARD, h, 36);
    ctx.fillStyle = BOARD;
    ctx.fill();
    ctx.clip();
    if (step.kind === "draw") {
      // Çizim kendi tuvalinde (koyu zemin, silgi yalnız mürekkebi siler), sonra karta konur.
      const layer = env.makeCanvas(CARD, CARD);
      const lctx = layer.getContext("2d");
      if (lctx) {
        paintAll(lctx, step.drawing.strokes, CARD, 1);
        ctx.drawImage(layer, PAD, y);
      }
      if (step.drawing.strokes.length === 0) {
        ctx.textAlign = "center";
        ctx.fillStyle = DIM;
        ctx.font = `700 48px ${DISPLAY}`;
        ctx.fillText("Boş tuval", CHAIN_W / 2, y + h / 2);
      }
    } else {
      const { size, lines } = textLayout(ctx, step.text);
      ctx.textAlign = "center";
      ctx.fillStyle = WHITE;
      ctx.font = `800 ${size}px ${DISPLAY}`;
      const top = y + h / 2 - ((lines.length - 1) * size * 1.25) / 2 + size * 0.36;
      lines.forEach((line, k) => {
        ctx.fillText(line, CHAIN_W / 2, top + k * size * 1.25);
      });
    }
    ctx.restore();
    roundRect(ctx, PAD, y, CARD, h, 36);
    ctx.lineWidth = crowned ? 10 : 4;
    ctx.strokeStyle = accent;
    ctx.stroke();
    y += h;
    if (i < recap.steps.length - 1) {
      ctx.strokeStyle = DIM;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(CHAIN_W / 2, y + 12);
      ctx.lineTo(CHAIN_W / 2, y + ARROW_H - 14);
      ctx.moveTo(CHAIN_W / 2 - 16, y + ARROW_H - 30);
      ctx.lineTo(CHAIN_W / 2, y + ARROW_H - 14);
      ctx.lineTo(CHAIN_W / 2 + 16, y + ARROW_H - 30);
      ctx.stroke();
      y += ARROW_H;
    }
  }
  if (recap.robust) {
    ctx.textAlign = "center";
    ctx.fillStyle = LIME;
    ctx.shadowColor = LIME;
    ctx.shadowBlur = 20;
    ctx.font = `800 48px ${DISPLAY}`;
    ctx.fillText("SAĞLAM ZİNCİR", CHAIN_W / 2, y + 90);
    ctx.shadowBlur = 0;
    y += ROBUST_H;
  }
  ctx.textAlign = "center";
  ctx.fillStyle = CYAN;
  ctx.font = `800 44px ${TEXT}`;
  ctx.fillText(FOOTER_TEXT, CHAIN_W / 2, y + 110);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("görüntü üretilemedi"))), "image/png");
  });
}
