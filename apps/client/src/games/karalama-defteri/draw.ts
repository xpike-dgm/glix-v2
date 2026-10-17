import { KARALAMA_ERASER_INDEX, KARALAMA_GRID, KARALAMA_MAX_POINTS, type KaralamaStroke } from "@glix/engine";

/** Palet: sıra `KARALAMA_COLORS` ile aynı. Neon kalem rengi + çevresindeki koyu hale. */
export const PEN_COLORS = ["#F3F5FF", "#FF2BD6", "#FFC23B", "#B6FF3B", "#2EF2FF", "#FF8A3B"] as const;
export const PEN_HALOS = ["#5B6396", "#7D1B6B", "#8A6414", "#5C8A1B", "#157C85", "#8A4A1B"] as const;
export const PEN_NAMES = ["Beyaz", "Pembe", "Sarı", "Yeşil", "Mavi", "Turuncu"] as const;
/** Kalınlık kademesi -> ızgara birimi (1000 üzerinden). */
export const SIZE_UNITS: Record<number, number> = { 1: 7, 2: 15, 3: 30 };
export const ERASER_FACTOR = 1.8;
/** Çizerken yeni nokta için en küçük uzaklık (ızgara birimi). */
export const MIN_STEP = 3;
/** Bitirilen darbeyi sadeleştirme eşiği (ızgara birimi). */
export const SIMPLIFY_EPS = 1.6;

/** Ekran koordinatını 0..1000 tam sayı ızgarasına çevirir. */
export function toGrid(client: number, origin: number, extent: number): number {
  if (extent <= 0) return 0;
  const v = Math.round(((client - origin) / extent) * KARALAMA_GRID);
  return Math.min(KARALAMA_GRID, Math.max(0, v));
}

/** Douglas-Peucker (yinelemeli); düz `[x0,y0,x1,y1,…]` dizisi alır ve verir. İlk ve son nokta korunur. */
export function simplify(points: readonly number[], eps: number): number[] {
  const n = points.length / 2;
  if (n <= 2) return [...points];
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop() as [number, number];
    const ax = points[a * 2] as number;
    const ay = points[a * 2 + 1] as number;
    const bx = points[b * 2] as number;
    const by = points[b * 2 + 1] as number;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let far = -1;
    let farD = eps;
    for (let i = a + 1; i < b; i++) {
      const px = points[i * 2] as number;
      const py = points[i * 2 + 1] as number;
      const d =
        len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i * 2] as number, points[i * 2 + 1] as number);
  return out;
}

/**
 * Bitmiş çizgiyi gönderilecek darbelere böler: tek noktaysa nokta olarak iki kez yazılır, 120 noktadan
 * uzunsa parçalar bir noktayı paylaşır (çizgi kopmaz).
 */
export function toStrokeChunks(points: readonly number[], maxPoints = KARALAMA_MAX_POINTS): number[][] {
  let pts = [...points];
  if (pts.length < 2) return [];
  if (pts.length === 2) pts = [pts[0] as number, pts[1] as number, pts[0] as number, pts[1] as number];
  const total = pts.length / 2;
  if (total <= maxPoints) return [pts];
  const out: number[][] = [];
  let start = 0;
  while (start < total - 1) {
    const end = Math.min(total, start + maxPoints);
    out.push(pts.slice(start * 2, end * 2));
    start = end - 1;
  }
  return out;
}

export interface StrokeStyle {
  color: string;
  halo: string;
  width: number;
  erase: boolean;
}

/** Sıkıştırılmış darbenin çizim biçimi (ızgara birimi cinsinden kalınlık). */
export function styleOf(stroke: KaralamaStroke): StrokeStyle {
  const idx = stroke[0] as number;
  const erase = idx === KARALAMA_ERASER_INDEX;
  const unit = SIZE_UNITS[stroke[1] as number] ?? SIZE_UNITS[2] ?? 15;
  return {
    color: PEN_COLORS[idx] ?? PEN_COLORS[0],
    halo: PEN_HALOS[idx] ?? PEN_HALOS[0],
    width: erase ? unit * ERASER_FACTOR : unit,
    erase,
  };
}

/** Çizgiyi yumuşatarak yola ekler (orta noktalardan geçen ikinci derece eğriler). */
export function tracePath(ctx: CanvasRenderingContext2D, stroke: readonly number[], from = 2): void {
  const n = (stroke.length - from) / 2;
  const at = (i: number): [number, number] => [
    stroke[from + i * 2] as number,
    stroke[from + i * 2 + 1] as number,
  ];
  ctx.beginPath();
  const [x0, y0] = at(0);
  ctx.moveTo(x0, y0);
  if (n === 2) {
    const [x1, y1] = at(1);
    if (x0 === x1 && y0 === y1) {
      ctx.lineTo(x0 + 0.01, y0);
    } else ctx.lineTo(x1, y1);
    return;
  }
  for (let i = 1; i < n - 1; i++) {
    const [x, y] = at(i);
    const [nx, ny] = at(i + 1);
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  const [lx, ly] = at(n - 1);
  ctx.lineTo(lx, ly);
}

/**
 * Tek darbeyi çizer. `ctx` ızgara birimine (0..1000) ölçeklenmiş olmalı. Silgi önceki mürekkebi siler;
 * kalem önce koyu bir hale, sonra parlak çekirdek çizer (opak: üst üste binince lekelenmez).
 */
export function paintStroke(ctx: CanvasRenderingContext2D, stroke: KaralamaStroke, halo = true): void {
  const st = styleOf(stroke);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (st.erase) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = st.width;
    tracePath(ctx, stroke);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    return;
  }
  if (halo) {
    ctx.strokeStyle = st.halo;
    ctx.lineWidth = st.width * 1.7;
    tracePath(ctx, stroke);
    ctx.stroke();
  }
  ctx.strokeStyle = st.color;
  ctx.lineWidth = st.width;
  tracePath(ctx, stroke);
  ctx.stroke();
}

/**
 * Silgi hale çizimini de silsin diye: önce her darbenin halesi, sonra çekirdeği DEĞİL; darbeler sırayla
 * (hale+çekirdek) çizilir. Bu, katmanlar arası siyah kenar bırakmaz.
 */
export function paintAll(
  ctx: CanvasRenderingContext2D,
  strokes: readonly KaralamaStroke[],
  px: number,
  dpr: number,
  halo = true,
): void {
  const scale = (px * dpr) / KARALAMA_GRID;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  for (const s of strokes) paintStroke(ctx, s, halo);
}
