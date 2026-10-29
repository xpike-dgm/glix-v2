/**
 * Kürsü karakterinin iskeleti ve esneyen ağın (mesh) saf hesapları. Pixi'ye dokunmaz; testlenebilir.
 *
 * Yöntem (sahip onaylı deneme, tools/karakter-deneme/mesh.html): her gövde ve giysi parçası kendi görseliyle tek ağda
 * çizilir; köşelerin kemik ağırlıkları yalnız KONUMA ve parçanın kemiğine bağlıdır. Böylece bir eklemde ebeveyn ve
 * çocuk parçanın aynı konumdaki köşeleri aynı hareket eder (dikiş ya da kesik görünmez). Her karede doğrusal
 * harmanlı kemik dönüşümüyle (linear blend skinning) köşeler yeniden hesaplanır.
 */

import { GIYSI_SIRASI } from "@glix/engine";

/** `rig.json` içindeki gövde parçası. Konumlar yarım boy (512x768) piksel cinsindendir. */
export interface RigPart {
  name: string;
  file: string;
  size: readonly [number, number];
  /** Ebeveyn kemik adı; kök için "root". */
  parent: string;
  /** Ebeveyne göre dinlenme konumu. */
  position: readonly [number, number];
  /** Parça görselinin tuval içindeki sol üst köşesi. */
  sourceOrigin: readonly [number, number];
}

export interface WardrobePiece {
  file: string;
  size: readonly [number, number];
  bone: string;
  /** Hangi gövde parçasından hemen sonra çizilir (`behind` ise yok sayılır). */
  drawAfter: string;
  sourceOrigin: readonly [number, number];
  /** `layer: "arka"`: gövdenin ARKASINA çizilir (pelerin, kanat, sırt çantası); "on" kendi kemiğinin önüne. */
  behind: boolean;
  /** Katmanın giysi yuvası (`GIYSI_SIRASI` türü): aynı kemikteki parçaların sırasını belirler. */
  slot: string;
}

export interface Rig {
  root: readonly [number, number];
  /** Görsellerin ölçeği (tam boyun yarısı = 0,5); eklem yarıçapları buna göre küçülür. */
  scale: number;
  canvas: readonly [number, number];
  /** Ebeveyn her zaman çocuktan önce gelir. */
  parts: RigPart[];
  wardrobe: Record<string, WardrobePiece[]>;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
function pair(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = num(v[0]);
  const b = num(v[1]);
  return a === null || b === null ? null : [a, b];
}
/** Dosya yolu: yalnız klasör/ad.webp biçimi (ağdan gelen veri; yol kaçışı yok). */
const safeFile = (v: unknown): string | null =>
  typeof v === "string" && /^[a-z0-9_]+\/[a-z0-9_]+\.webp$/.test(v) ? v : null;

/** `rig.json`'ı doğrular (biçim `glix-parts-1`); geçersizse null. */
export function parseRig(raw: unknown): Rig | null {
  if (!isRec(raw) || raw.format !== "glix-parts-1" || !isRec(raw.parts) || !isRec(raw.root)) return null;
  const root = pair(raw.root.position);
  const canvas = pair(raw.canvas);
  const scale = raw.scale === undefined ? 1 : num(raw.scale);
  if (!root || !canvas || scale === null || scale <= 0) return null;
  const todo: RigPart[] = [];
  for (const [name, p] of Object.entries(raw.parts)) {
    if (!isRec(p)) return null;
    const file = safeFile(p.file);
    const size = pair(p.size);
    const position = pair(p.position);
    const sourceOrigin = pair(p.sourceOrigin);
    if (!file || !size || !position || !sourceOrigin || typeof p.parent !== "string") return null;
    todo.push({ name, file, size, parent: p.parent, position, sourceOrigin });
  }
  // Ebeveyn önce: dosya sırası ne olursa olsun sıralanır; döngü ya da eksik ebeveyn geçersizdir.
  const parts: RigPart[] = [];
  const done = new Set<string>(["root"]);
  while (todo.length > 0) {
    const i = todo.findIndex((p) => done.has(p.parent));
    const next = todo[i];
    if (i < 0 || !next) return null;
    todo.splice(i, 1);
    parts.push(next);
    done.add(next.name);
  }
  const wardrobe: Rig["wardrobe"] = {};
  if (isRec(raw.wardrobe)) {
    for (const [layer, w] of Object.entries(raw.wardrobe)) {
      if (!isRec(w) || !Array.isArray(w.pieces)) return null;
      const slot = typeof w.slot === "string" && GIYSI_SIRASI.some((t) => t === w.slot) ? w.slot : null;
      if (slot === null) return null;
      const pieces: WardrobePiece[] = [];
      for (const q of w.pieces) {
        if (!isRec(q)) return null;
        const file = safeFile(q.file);
        const size = pair(q.size);
        const sourceOrigin = pair(q.sourceOrigin);
        if (!file || !size || !sourceOrigin || typeof q.bone !== "string" || !done.has(q.bone)) return null;
        const drawAfter = typeof q.drawAfter === "string" ? q.drawAfter : q.bone;
        if (q.layer !== undefined && q.layer !== "on" && q.layer !== "arka") return null;
        pieces.push({ file, size, bone: q.bone, drawAfter, sourceOrigin, behind: q.layer === "arka", slot });
      }
      wardrobe[layer] = pieces;
    }
  }
  return { root, scale, canvas, parts, wardrobe };
}

/** Gövde parçalarının çizim sırası (arkadan öne); giysi parçaları `drawAfter` kemiğinin hemen arkasına girer. */
export const BODY_DRAW_ORDER: readonly string[] = [
  "left_thigh",
  "left_shin",
  "left_foot",
  "right_thigh",
  "right_shin",
  "right_foot",
  "head",
  "torso",
  "left_upper_arm",
  "left_forearm",
  "left_hand",
  "right_upper_arm",
  "right_forearm",
  "right_hand",
];

/** Eklem bölgesi yarıçapı (tam boy piksel; `Rig.scale` ile çarpılır): çocuk kemik adı -> yarıçap. */
const JOINT_RADIUS: Readonly<Record<string, number>> = {
  head: 46,
  left_upper_arm: 44,
  right_upper_arm: 44,
  left_forearm: 36,
  right_forearm: 36,
  left_hand: 26,
  right_hand: 26,
  left_thigh: 48,
  right_thigh: 48,
  left_shin: 38,
  right_shin: 38,
  left_foot: 30,
  right_foot: 30,
};

export interface Skeleton {
  rig: Rig;
  /** Kemik adı -> dizin (rig.parts sırası). */
  index: ReadonlyMap<string, number>;
  /** Ebeveyn dizini; kök için -1. */
  parent: Int16Array;
  /** Dinlenme konumunda eklem noktaları (mesh/tuval koordinatı). */
  restX: Float32Array;
  restY: Float32Array;
  /** Ebeveyne göre dinlenme ofseti. */
  offX: Float32Array;
  offY: Float32Array;
  /** Eklem yarıçapı (çocuk kemik için; yoksa 0). */
  radius: Float32Array;
  /** Çocuk kemiğin ebeveynden uzanma yönü (birim vektör). */
  dirX: Float32Array;
  dirY: Float32Array;
}

export function buildSkeleton(rig: Rig): Skeleton {
  const n = rig.parts.length;
  const index = new Map(rig.parts.map((p, i) => [p.name, i]));
  const parent = new Int16Array(n);
  const restX = new Float32Array(n);
  const restY = new Float32Array(n);
  const offX = new Float32Array(n);
  const offY = new Float32Array(n);
  const radius = new Float32Array(n);
  const dirX = new Float32Array(n);
  const dirY = new Float32Array(n);
  rig.parts.forEach((p, i) => {
    const pi = index.get(p.parent) ?? -1;
    parent[i] = pi;
    offX[i] = p.position[0];
    offY[i] = p.position[1];
    restX[i] = (pi >= 0 ? (restX[pi] ?? 0) : rig.root[0]) + p.position[0];
    restY[i] = (pi >= 0 ? (restY[pi] ?? 0) : rig.root[1]) + p.position[1];
    radius[i] = (JOINT_RADIUS[p.name] ?? 0) * rig.scale;
    const len = Math.hypot(p.position[0], p.position[1]) || 1;
    dirX[i] = p.position[0] / len;
    dirY[i] = p.position[1] / len;
  });
  return { rig, index, parent, restX, restY, offX, offY, radius, dirX, dirY };
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Bir köşenin en çok iki kemiğe ağırlığı. */
export interface VertexWeights {
  b0: number;
  w0: number;
  b1: number;
  w1: number;
}

/**
 * (x, y) konumundaki köşenin ağırlıkları; `bone` köşeyi çizen parçanın kemiği. Yalnız konuma ve `bone`a bağlıdır:
 * bir eklemin iki yanındaki parçaların aynı konumdaki köşeleri aynı eklem bölgesini seçer, aynı ağırlığı alır.
 */
export function vertexWeights(sk: Skeleton, x: number, y: number, bone: number): VertexWeights {
  let zone = -1;
  let best = Number.POSITIVE_INFINITY;
  for (let c = 0; c < sk.radius.length; c++) {
    const r = sk.radius[c] ?? 0;
    if (r === 0) continue;
    if (bone !== c && bone !== sk.parent[c]) continue;
    const d = Math.hypot(x - (sk.restX[c] ?? 0), y - (sk.restY[c] ?? 0));
    if (d < r * 1.5 && d < best) {
      best = d;
      zone = c;
    }
  }
  if (zone < 0) return { b0: bone, w0: 1, b1: bone, w1: 0 };
  const t =
    ((x - (sk.restX[zone] ?? 0)) * (sk.dirX[zone] ?? 0) +
      (y - (sk.restY[zone] ?? 0)) * (sk.dirY[zone] ?? 0)) /
    (sk.radius[zone] ?? 1);
  const wc = smooth(-0.9, 0.9, t);
  const par = sk.parent[zone] ?? -1;
  // Kökün altındaki ilk kemiğin ebeveyni kök (-1): ağırlık tümüyle kendisinde kalır.
  return par < 0 ? { b0: zone, w0: 1, b1: zone, w1: 0 } : { b0: zone, w0: wc, b1: par, w1: 1 - wc };
}

/** Kemik dönüşümleri: eklemin dünya konumu ve dönüşü (cos/sin). */
export interface BonePose {
  x: Float32Array;
  y: Float32Array;
  c: Float32Array;
  s: Float32Array;
}

export const createBonePose = (n: number): BonePose => ({
  x: new Float32Array(n),
  y: new Float32Array(n),
  c: new Float32Array(n),
  s: new Float32Array(n),
});

/**
 * Yerel açılardan (derece, ebeveyne göre, saat yönü pozitif) kemik dünya dönüşümleri. `rootY`: kök dikey kayması
 * (rig pikseli; aşağı pozitif). Ebeveyn önce sıralı olduğundan tek geçiş yeter.
 */
export function poseBones(sk: Skeleton, anglesDeg: ArrayLike<number>, rootY: number, out: BonePose): void {
  const n = sk.parent.length;
  const world = poseScratch(n);
  for (let i = 0; i < n; i++) {
    const p = sk.parent[i] ?? -1;
    let px = sk.rig.root[0];
    let py = sk.rig.root[1] + rootY;
    let pr = 0;
    if (p >= 0) {
      px = out.x[p] ?? 0;
      py = out.y[p] ?? 0;
      pr = world[p] ?? 0;
    }
    const co = Math.cos(pr);
    const si = Math.sin(pr);
    const ox = sk.offX[i] ?? 0;
    const oy = sk.offY[i] ?? 0;
    out.x[i] = px + co * ox - si * oy;
    out.y[i] = py + si * ox + co * oy;
    const r = pr + ((anglesDeg[i] ?? 0) * Math.PI) / 180;
    world[i] = r;
    out.c[i] = Math.cos(r);
    out.s[i] = Math.sin(r);
  }
}

let scratch = new Float32Array(32);
function poseScratch(n: number): Float32Array {
  if (scratch.length < n) scratch = new Float32Array(n);
  return scratch;
}

/** Ağ verisi: köşe başına iki kemik ve dinlenme konumuna göre ofsetler (kareler arası değişmez). */
export interface SkinData {
  count: number;
  /** Dinlenme konumları (x, y çiftleri). */
  rest: Float32Array;
  b0: Uint8Array;
  b1: Uint8Array;
  w0: Float32Array;
  w1: Float32Array;
  /** Köşenin kemiğin dinlenme noktasına göre ofseti: (dx0, dy0, dx1, dy1). */
  d: Float32Array;
}

export function buildSkinData(sk: Skeleton, rest: Float32Array, wts: readonly VertexWeights[]): SkinData {
  const count = wts.length;
  const data: SkinData = {
    count,
    rest,
    b0: new Uint8Array(count),
    b1: new Uint8Array(count),
    w0: new Float32Array(count),
    w1: new Float32Array(count),
    d: new Float32Array(count * 4),
  };
  for (let i = 0; i < count; i++) {
    const w = wts[i];
    if (!w) continue;
    const x = rest[i * 2] ?? 0;
    const y = rest[i * 2 + 1] ?? 0;
    data.b0[i] = w.b0;
    data.b1[i] = w.b1;
    data.w0[i] = w.w0;
    data.w1[i] = w.w1;
    data.d[i * 4] = x - (sk.restX[w.b0] ?? 0);
    data.d[i * 4 + 1] = y - (sk.restY[w.b0] ?? 0);
    data.d[i * 4 + 2] = x - (sk.restX[w.b1] ?? 0);
    data.d[i * 4 + 3] = y - (sk.restY[w.b1] ?? 0);
  }
  return data;
}

/** Doğrusal harmanlı kemik dönüşümü: `out` (x, y çiftleri) doldurulur. */
export function skin(data: SkinData, pose: BonePose, out: Float32Array): void {
  const { b0, b1, w0, w1, d, count } = data;
  for (let i = 0; i < count; i++) {
    const a = b0[i] ?? 0;
    const dx0 = d[i * 4] ?? 0;
    const dy0 = d[i * 4 + 1] ?? 0;
    const wa = w0[i] ?? 0;
    const ca = pose.c[a] ?? 1;
    const sa = pose.s[a] ?? 0;
    let x = wa * ((pose.x[a] ?? 0) + ca * dx0 - sa * dy0);
    let y = wa * ((pose.y[a] ?? 0) + sa * dx0 + ca * dy0);
    const wb = w1[i] ?? 0;
    if (wb > 0) {
      const b = b1[i] ?? 0;
      const dx1 = d[i * 4 + 2] ?? 0;
      const dy1 = d[i * 4 + 3] ?? 0;
      const cb = pose.c[b] ?? 1;
      const sb = pose.s[b] ?? 0;
      x += wb * ((pose.x[b] ?? 0) + cb * dx1 - sb * dy1);
      y += wb * ((pose.y[b] ?? 0) + sb * dx1 + cb * dy1);
    }
    out[i * 2] = x;
    out[i * 2 + 1] = y;
  }
}
