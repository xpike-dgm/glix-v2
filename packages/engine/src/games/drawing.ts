/**
 * Ortak çizim tuvali: Karalama Defteri ve Bozuk Telefon aynı darbe biçimini ve aynı sunucu tarafı doğrulamayı kullanır.
 * Darbe biçimi: `[kalemDizini (DRAW_PENS sırası: 0..5 ilk renkler, 6 silgi, 7..10 yeni renkler), kalınlık (1..4),
 * x0, y0, x1, y1, …]`, koordinatlar 0..GRID tam sayı. Silgi dizini (6) ilk sürümden beri değişmez.
 * Her oyun kendi paletini (`DrawPalette`: ilk kaç renk, en büyük kalınlık) seçer; sunucu yalnız onu kabul eder.
 */

/** Çizim ızgarası: 0..GRID tam sayı, kare. */
export const DRAW_GRID = 1000;
/** Bir darbedeki nokta sayısı (x,y çifti). */
export const DRAW_MIN_POINTS = 2;
export const DRAW_MAX_POINTS = 120;

/** Renk kimlikleri, araç çubuğu sırasıyla (ilk 6'sı ilk palet). */
export const DRAW_COLORS = [
  "beyaz",
  "pembe",
  "sari",
  "yesil",
  "mavi",
  "turuncu",
  "kirmizi",
  "mor",
  "kahverengi",
  "gri",
] as const;
export type DrawColor = (typeof DRAW_COLORS)[number];
export type DrawPen = DrawColor | "eraser";
/**
 * Sıkıştırılmış darbedeki kalem dizini = bu dizideki sıra. İlk palet (0..5) ve silgi (6) eski biçimle aynı kalır;
 * sonradan eklenen renkler silgiden sonra gelir.
 */
export const DRAW_PENS: readonly DrawPen[] = [
  "beyaz",
  "pembe",
  "sari",
  "yesil",
  "mavi",
  "turuncu",
  "eraser",
  "kirmizi",
  "mor",
  "kahverengi",
  "gri",
];
/** Kalem kimliğinin sıkıştırılmış darbedeki dizini. */
export const drawPenIndex = (pen: DrawPen): number => DRAW_PENS.indexOf(pen);
/** Kalınlık kademesi: 1 ince … 4 çok kalın. */
export type DrawSize = 1 | 2 | 3 | 4;

/** Bir oyunun kabul ettiği kalemler: paletin ilk `colors` rengi (+ silgi) ve 1..`maxSize` kalınlık. */
export interface DrawPalette {
  colors: number;
  maxSize: DrawSize;
}
/** Tam palet: 10 renk, 4 kalınlık (Bozuk Telefon). */
export const DRAW_PALETTE_FULL: DrawPalette = { colors: DRAW_COLORS.length, maxSize: 4 };
/** İlk palet: 6 renk, 3 kalınlık (Karalama Defteri; kuralı değişmedi). */
export const DRAW_PALETTE_CLASSIC: DrawPalette = { colors: 6, maxSize: 3 };
/** Sıkıştırılmış darbede silgi dizini. */
export const DRAW_ERASER_INDEX = 6;
export type DrawStroke = number[];

export interface StrokeFields {
  color: DrawPen;
  size: DrawSize;
  points: number[];
}

/** Bir oyuncunun duran çizim sınırları. */
export interface DrawLimits {
  /** Aynı anda duran en çok darbe. */
  maxStrokes: number;
  /** Duran darbelerdeki toplam nokta üst sınırı. */
  maxTotalPoints: number;
  /** Kabul edilen toplam çizim eylemi (darbe + geri al + temizle); kayıt boyutunu sınırlar. */
  maxActions: number;
}

export interface PlayerDrawing {
  /** Bir sonraki darbe numarası (hiç azalmaz). */
  next: number;
  /** Duran darbeler: numara (metin) -> sıkıştırılmış darbe. */
  strokes: Record<string, DrawStroke>;
  /** Duran darbelerdeki toplam nokta. */
  points: number;
  /** Kabul edilen toplam çizim eylemi. */
  actions: number;
}

export const EMPTY_DRAWING: PlayerDrawing = { next: 0, strokes: {}, points: 0, actions: 0 };

export function isPlainObject(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

export function hasExactKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(obj);
  return own.length === keys.length && keys.every((k) => Object.hasOwn(obj, k));
}

function parsePoints(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const n = raw.length;
  if (n % 2 !== 0 || n < DRAW_MIN_POINTS * 2 || n > DRAW_MAX_POINTS * 2) return null;
  const out: number[] = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const v: unknown = raw[i];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > DRAW_GRID) return null;
    out[i] = v;
  }
  return out;
}

/** Paletteki kalem kimlikleri (renkler + silgi). */
export function penIdsOf(palette: DrawPalette): DrawPen[] {
  return [...DRAW_COLORS.slice(0, palette.colors), "eraser"];
}

/**
 * `{kind:"stroke", color, size, points}` eyleminin alanlarını doğrular (tam anahtar kümesi); geçersizse null.
 * Renk ve kalınlık oyunun paletiyle sınırlıdır.
 */
export function parseStrokeFields(raw: Record<string, unknown>, palette: DrawPalette): StrokeFields | null {
  if (!hasExactKeys(raw, ["kind", "color", "size", "points"])) return null;
  const color = raw.color;
  if (typeof color !== "string") return null;
  const pen = penIdsOf(palette).find((p) => p === color);
  if (pen === undefined) return null;
  const size = raw.size;
  if (size !== 1 && size !== 2 && size !== 3 && size !== 4) return null;
  if (size > palette.maxSize) return null;
  const points = parsePoints(raw.points);
  if (points === null) return null;
  return { color: pen, size, points };
}

export type DrawResult = { drawing: PlayerDrawing } | { rejected: string };

/** Darbe ekler: eylem, darbe ve nokta kotaları sunucuda uygulanır. */
export function addStroke(mine: PlayerDrawing, stroke: StrokeFields, limits: DrawLimits): DrawResult {
  if (mine.actions >= limits.maxActions) return { rejected: "too_many_actions" };
  if (Object.keys(mine.strokes).length >= limits.maxStrokes) return { rejected: "too_many_strokes" };
  const pointCount = stroke.points.length / 2;
  if (mine.points + pointCount > limits.maxTotalPoints) return { rejected: "too_many_points" };
  const colorIndex = drawPenIndex(stroke.color);
  const packed: DrawStroke = [colorIndex, stroke.size, ...stroke.points];
  return {
    drawing: {
      next: mine.next + 1,
      strokes: { ...mine.strokes, [String(mine.next)]: packed },
      points: mine.points + pointCount,
      actions: mine.actions + 1,
    },
  };
}

/** Son darbeyi geri alır (boş çizimde "empty"). */
export function undoStroke(mine: PlayerDrawing, limits: DrawLimits): DrawResult {
  if (mine.actions >= limits.maxActions) return { rejected: "too_many_actions" };
  const keys = Object.keys(mine.strokes);
  const lastKey = keys[keys.length - 1];
  if (lastKey === undefined) return { rejected: "empty" };
  const last = mine.strokes[lastKey] as DrawStroke;
  const rest = { ...mine.strokes };
  delete rest[lastKey];
  return {
    drawing: {
      ...mine,
      strokes: rest,
      points: mine.points - (last.length - 2) / 2,
      actions: mine.actions + 1,
    },
  };
}

/** Tüm darbeleri temizler (boş çizimde "empty"). */
export function clearStrokes(mine: PlayerDrawing, limits: DrawLimits): DrawResult {
  if (mine.actions >= limits.maxActions) return { rejected: "too_many_actions" };
  if (Object.keys(mine.strokes).length === 0) return { rejected: "empty" };
  return { drawing: { ...mine, strokes: {}, points: 0, actions: mine.actions + 1 } };
}
