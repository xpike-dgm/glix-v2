/**
 * Küçük QR kod üreticisi (ISO/IEC 18004): bayt kipi, hata düzeltme düzeyi M, sürüm 1–6.
 * Oda bağlantısı gibi kısa metinler için yeterlidir (en çok 106 bayt). Dış bağımlılık yok.
 */

export type QrMatrix = readonly (readonly boolean[])[];

interface VersionSpec {
  /** Her blokta hata düzeltme kod sözcüğü sayısı. */
  ecPerBlock: number;
  /** Veri sözcüğü sayısı (blok başına) — blok grupları. */
  blocks: readonly number[];
}

/** Düzey M, sürüm 1–6 (indeks = sürüm - 1). */
const SPECS: readonly VersionSpec[] = [
  { ecPerBlock: 10, blocks: [16] },
  { ecPerBlock: 16, blocks: [28] },
  { ecPerBlock: 26, blocks: [44] },
  { ecPerBlock: 18, blocks: [32, 32] },
  { ecPerBlock: 24, blocks: [43, 43] },
  { ecPerBlock: 16, blocks: [27, 27, 27, 27] },
];
/** Hizalama deseni merkezleri (sürüm 2–6: 6 ve bir daha). */
const ALIGN: readonly number[] = [0, 0, 18, 22, 26, 30, 34];

export const QR_MAX_BYTES = 106;

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const dataWords = (spec: VersionSpec): number => sum(spec.blocks);

/** Bu uzunlukta bayt dizisi için en küçük sürüm (1–6); sığmazsa 0. */
export function versionFor(byteLength: number): number {
  for (let v = 1; v <= SPECS.length; v++) {
    const spec = SPECS[v - 1];
    if (spec && byteLength <= dataWords(spec) - 2) return v;
  }
  return 0;
}

// GF(256), indirgeyici çokterimli 0x11D.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] ?? 0;
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] ?? 0) + (LOG[b] ?? 0)] ?? 0;
}

function generator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      const c = poly[j] ?? 0;
      next[j] = (next[j] ?? 0) ^ c;
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(c, EXP[i] ?? 0);
    }
    poly = next;
  }
  return poly;
}

/** Reed-Solomon hata düzeltme sözcükleri. */
export function reedSolomon(data: readonly number[], ecLen: number): number[] {
  const gen = generator(ecLen);
  const rem = new Array<number>(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ (rem[0] ?? 0);
    rem.shift();
    rem.push(0);
    for (let i = 0; i < ecLen; i++) rem[i] = (rem[i] ?? 0) ^ gfMul(gen[i + 1] ?? 0, factor);
  }
  return rem;
}

function utf8(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

/** Bit akışı → veri sözcükleri (kip, uzunluk, veri, bitiş, dolgu). */
function buildData(bytes: readonly number[], capacity: number): number[] {
  const bits: number[] = [];
  const push = (value: number, count: number): void => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  const total = capacity * 8;
  push(0, Math.min(4, total - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const words: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let w = 0;
    for (let j = 0; j < 8; j++) w = (w << 1) | (bits[i + j] ?? 0);
    words.push(w);
  }
  for (let pad = 0; words.length < capacity; pad++) words.push(pad % 2 === 0 ? 0xec : 0x11);
  return words;
}

/** Blokları ayırır, hata düzeltmeyi ekler ve sözcükleri aralıklı dizer. */
function interleave(words: readonly number[], spec: VersionSpec): number[] {
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let at = 0;
  for (const len of spec.blocks) {
    const block = words.slice(at, at + len);
    at += len;
    dataBlocks.push(block);
    ecBlocks.push(reedSolomon(block, spec.ecPerBlock));
  }
  const out: number[] = [];
  const longest = Math.max(...spec.blocks);
  for (let i = 0; i < longest; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i] ?? 0);
  for (let i = 0; i < spec.ecPerBlock; i++) for (const b of ecBlocks) out.push(b[i] ?? 0);
  return out;
}

/** 15 bitlik biçim bilgisi (düzey M = 00, maske 0–7), BCH(15,5) ve 0x5412 maskesi. */
export function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

const MASKS: readonly ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

class Grid {
  readonly size: number;
  readonly dark: boolean[][];
  readonly fixed: boolean[][];

  constructor(version: number) {
    this.size = 17 + 4 * version;
    this.dark = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  set(r: number, c: number, v: boolean): void {
    const row = this.dark[r];
    const fx = this.fixed[r];
    if (!row || !fx) return;
    row[c] = v;
    fx[c] = true;
  }

  get(r: number, c: number): boolean {
    return this.dark[r]?.[c] ?? false;
  }
}

function placeFinder(g: Grid, top: number, left: number): void {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const r = top + dr;
      const c = left + dc;
      if (r < 0 || c < 0 || r >= g.size || c >= g.size) continue;
      const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const ring = dr === 0 || dr === 6 || dc === 0 || dc === 6;
      const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      g.set(r, c, inside && (ring || core));
    }
  }
}

function placeAlignment(g: Grid, cr: number, cc: number): void {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const edge = Math.max(Math.abs(dr), Math.abs(dc));
      g.set(cr + dr, cc + dc, edge !== 1);
    }
  }
}

function placeFunctionPatterns(g: Grid, version: number): void {
  placeFinder(g, 0, 0);
  placeFinder(g, 0, g.size - 7);
  placeFinder(g, g.size - 7, 0);
  for (let i = 8; i < g.size - 8; i++) {
    g.set(6, i, i % 2 === 0);
    g.set(i, 6, i % 2 === 0);
  }
  const mid = ALIGN[version] ?? 0;
  if (version >= 2) placeAlignment(g, mid, mid);
  // Biçim bilgisi alanlarını ayır (değer sonra yazılır) ve karanlık modül.
  for (let i = 0; i < 9; i++) {
    if (!g.fixed[8]?.[i]) g.set(8, i, false);
    if (!g.fixed[i]?.[8]) g.set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    g.set(8, g.size - 1 - i, false);
    g.set(g.size - 1 - i, 8, false);
  }
  g.set(g.size - 8, 8, true);
}

function placeData(g: Grid, words: readonly number[], version: number): void {
  const bits: boolean[] = [];
  for (const w of words) for (let i = 7; i >= 0; i--) bits.push(((w >>> i) & 1) === 1);
  // Kalan bitler (sürüm 2–6 için 7) sıfırdır.
  const remainder = version >= 2 ? 7 : 0;
  for (let i = 0; i < remainder; i++) bits.push(false);
  let k = 0;
  let upward = true;
  for (let right = g.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let i = 0; i < g.size; i++) {
      const r = upward ? g.size - 1 - i : i;
      for (let dc = 0; dc < 2; dc++) {
        const c = right - dc;
        if (g.fixed[r]?.[c]) continue;
        put(g.dark, r, c, bits[k++] ?? false);
      }
    }
    upward = !upward;
  }
}

function applyMask(g: Grid, mask: number): boolean[][] {
  const fn = MASKS[mask] ?? MASKS[0];
  const out = g.dark.map((row) => [...row]);
  for (let r = 0; r < g.size; r++) {
    for (let c = 0; c < g.size; c++) {
      if (g.fixed[r]?.[c]) continue;
      if (fn?.(r, c)) put(out, r, c, !out[r]?.[c]);
    }
  }
  return out;
}

function put(m: boolean[][], r: number, c: number, v: boolean): void {
  const row = m[r];
  if (row) row[c] = v;
}

function writeFormat(m: boolean[][], size: number, mask: number): void {
  const bits = formatBits(mask);
  const bit = (i: number): boolean => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) put(m, i, 8, bit(i));
  put(m, 7, 8, bit(6));
  put(m, 8, 8, bit(7));
  put(m, 8, 7, bit(8));
  for (let i = 9; i < 15; i++) put(m, 8, 14 - i, bit(i));
  for (let i = 0; i < 8; i++) put(m, 8, size - 1 - i, bit(i));
  for (let i = 8; i < 15; i++) put(m, size - 15 + i, 8, bit(i));
  put(m, size - 8, 8, true);
}

function penalty(m: readonly (readonly boolean[])[]): number {
  const n = m.length;
  let score = 0;
  const line = (get: (i: number) => boolean): void => {
    let run = 1;
    for (let i = 1; i < n; i++) {
      if (get(i) === get(i - 1)) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else run = 1;
    }
    // 1:1:3:1:1 deseni + 4 açık boşluk
    for (let i = 0; i + 11 <= n; i++) {
      const a = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
      const b = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      let ma = true;
      let mb = true;
      for (let j = 0; j < 11; j++) {
        const v = get(i + j) ? 1 : 0;
        if (v !== a[j]) ma = false;
        if (v !== b[j]) mb = false;
      }
      if (ma) score += 40;
      if (mb) score += 40;
    }
  };
  for (let r = 0; r < n; r++) line((i) => m[r]?.[i] ?? false);
  for (let c = 0; c < n; c++) line((i) => m[i]?.[c] ?? false);
  let darkCount = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = m[r]?.[c];
      if (v) darkCount++;
      if (r + 1 < n && c + 1 < n) {
        const w = m[r]?.[c + 1];
        if (v === w && v === m[r + 1]?.[c] && v === m[r + 1]?.[c + 1]) score += 3;
      }
    }
  }
  const pct = (darkCount * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/** Metni QR matrisine çevirir (`true` = koyu modül). Sığmazsa `null`. */
export function encodeQr(text: string): QrMatrix | null {
  const bytes = utf8(text);
  const version = versionFor(bytes.length);
  if (version === 0) return null;
  const spec = SPECS[version - 1];
  if (!spec) return null;
  const words = interleave(buildData(bytes, dataWords(spec)), spec);
  const g = new Grid(version);
  placeFunctionPatterns(g, version);
  placeData(g, words, version);
  let best: boolean[][] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    const m = applyMask(g, mask);
    writeFormat(m, g.size, mask);
    const s = penalty(m);
    if (s < bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}

/** Sessiz bölge (modül) — telefon kameraları için en az 4. */
export const QR_QUIET = 4;

/** SVG yol verisi: koyu modüller birleşik satır parçaları olarak. Sessiz bölge dahil boyut `size + 8`. */
export function qrPath(matrix: QrMatrix): { d: string; size: number } {
  const n = matrix.length;
  let d = "";
  for (let r = 0; r < n; r++) {
    const row = matrix[r];
    if (!row) continue;
    let c = 0;
    while (c < n) {
      if (!row[c]) {
        c++;
        continue;
      }
      let end = c;
      while (end < n && row[end]) end++;
      d += `M${c + QR_QUIET} ${r + QR_QUIET}h${end - c}v1h${c - end}z`;
      c = end;
    }
  }
  return { d, size: n + QR_QUIET * 2 };
}
