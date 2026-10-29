/** Ağ (mesh) üretimi (saf): parça başına ızgara köşeleri, UV ve ağırlıklar; kıyafete göre birleştirme. */
import { GIYSI_SIRASI } from "@glix/engine";
import {
  BODY_DRAW_ORDER,
  buildSkinData,
  type Rig,
  type Skeleton,
  type SkinData,
  type VertexWeights,
  vertexWeights,
} from "./rig.js";

/** Izgara aralığı (rig pikseli). Tüm parçalar aynı küresel ızgarayı kullanır: komşu köşeler çakışır. */
export const GRID = 5;

/** Atlasa yerleşmiş parça. `layer`: "body" ya da giysi katmanı adı (ör. "sapka", "ceket"). */
export interface PieceSpec {
  key: string;
  layer: string;
  /** Kemik dizini. */
  bone: number;
  /** Bu parçadan hemen sonra çizilen gövde parçası kemiği adı (giysi için `drawAfter`). */
  after: string;
  w: number;
  h: number;
  /** Tuval içinde sol üst köşe. */
  ox: number;
  oy: number;
  /** Atlas içinde sol üst köşe. */
  ax: number;
  ay: number;
}

export interface PieceGeo {
  key: string;
  layer: string;
  after: string;
  count: number;
  rest: Float32Array;
  uvs: Float32Array;
  /** Parça içi köşe dizinleri. */
  idx: Uint32Array;
  wts: VertexWeights[];
}

/** Parçanın görünür (şeffaf olmayan) hücrelerinden ızgara ağı üretir. `opaque(x, y)`: parça yerel pikseli dolu mu. */
export function buildPieceGeometry(
  sk: Skeleton,
  p: PieceSpec,
  atlas: { w: number; h: number },
  opaque: (lx: number, ly: number) => boolean,
): PieceGeo {
  const rest: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const wts: VertexWeights[] = [];
  const map = new Map<number, number>();
  const vtx = (gx: number, gy: number): number => {
    const k = gy * 100000 + gx;
    const hit = map.get(k);
    if (hit !== undefined) return hit;
    const x = gx * GRID;
    const y = gy * GRID;
    const i = wts.length;
    rest.push(x, y);
    uvs.push((p.ax + x - p.ox) / atlas.w, (p.ay + y - p.oy) / atlas.h);
    wts.push(vertexWeights(sk, x, y, p.bone));
    map.set(k, i);
    return i;
  };
  const gx0 = Math.floor(p.ox / GRID);
  const gy0 = Math.floor(p.oy / GRID);
  const gx1 = Math.ceil((p.ox + p.w) / GRID);
  const gy1 = Math.ceil((p.oy + p.h) / GRID);
  for (let cy = gy0; cy < gy1; cy++) {
    for (let cx = gx0; cx < gx1; cx++) {
      let any = false;
      for (let y = cy * GRID; y < (cy + 1) * GRID && !any; y++) {
        for (let x = cx * GRID; x < (cx + 1) * GRID; x++) {
          const lx = x - p.ox;
          const ly = y - p.oy;
          if (lx < 0 || ly < 0 || lx >= p.w || ly >= p.h) continue;
          if (opaque(lx, ly)) {
            any = true;
            break;
          }
        }
      }
      if (!any) continue;
      const a = vtx(cx, cy);
      const b = vtx(cx + 1, cy);
      const d = vtx(cx, cy + 1);
      const e = vtx(cx + 1, cy + 1);
      idx.push(a, b, e, a, e, d);
    }
  }
  return {
    key: p.key,
    layer: p.layer,
    after: p.after,
    count: wts.length,
    rest: Float32Array.from(rest),
    uvs: Float32Array.from(uvs),
    idx: Uint32Array.from(idx),
    wts,
  };
}

/** Parça anahtarı: katman adı ve parçanın katmandaki sırası (aynı kemikte birden çok parça olabilir). */
export const pieceKey = (layer: string, index: number): string => `${layer}#${index}`;

/**
 * Giyilen katmanlara göre parça sırası (arkadan öne):
 * 1. `arka` parçalar (pelerin, kanat, sırt çantası): tüm gövdenin arkasında;
 * 2. gövde sırası; her gövde parçasının ardına, o kemiğe bağlı giysi parçaları yuva sırasıyla
 *    (kostüm, alt, ayakkabı, üst, aksesuar, şapka; bkz. `GIYSI_SIRASI`).
 */
export function drawKeys(rig: Rig, layers: readonly string[]): string[] {
  const rank = (l: string): number =>
    (GIYSI_SIRASI as readonly string[]).indexOf(rig.wardrobe[l]?.[0]?.slot ?? "");
  const wanted = [...new Set(layers)]
    .filter((l) => rig.wardrobe[l] !== undefined)
    .sort((a, b) => rank(a) - rank(b));
  const out: string[] = [];
  for (const layer of wanted)
    (rig.wardrobe[layer] ?? []).forEach((q, i) => {
      if (q.behind) out.push(pieceKey(layer, i));
    });
  for (const bone of BODY_DRAW_ORDER) {
    out.push(`body:${bone}`);
    for (const layer of wanted)
      (rig.wardrobe[layer] ?? []).forEach((q, i) => {
        if (!q.behind && q.drawAfter === bone) out.push(pieceKey(layer, i));
      });
  }
  return out;
}

export interface MeshData {
  rest: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  skin: SkinData;
  /** Çizilen giysi katmanlarının adları (ağdaki ilk görünme sırasıyla). */
  layerNames: string[];
  /** Köşe başına katman: -1 gövde, yoksa `layerNames` dizini (renk süzgeci için). */
  vertexLayer: Int16Array;
}

/** Hazır parça geometrilerini verilen sırayla tek ağa birleştirir; bilinmeyen anahtar atlanır. */
export function assembleMesh(
  sk: Skeleton,
  geos: ReadonlyMap<string, PieceGeo>,
  keys: readonly string[],
): MeshData {
  const parts = keys.map((k) => geos.get(k)).filter((g): g is PieceGeo => g !== undefined);
  const nv = parts.reduce((n, g) => n + g.count, 0);
  const ni = parts.reduce((n, g) => n + g.idx.length, 0);
  const rest = new Float32Array(nv * 2);
  const uvs = new Float32Array(nv * 2);
  const indices = new Uint32Array(ni);
  const wts: VertexWeights[] = [];
  const layerNames: string[] = [];
  const vertexLayer = new Int16Array(nv).fill(-1);
  let vo = 0;
  let io = 0;
  for (const g of parts) {
    if (g.layer !== "body") {
      let li = layerNames.indexOf(g.layer);
      if (li < 0) li = layerNames.push(g.layer) - 1;
      vertexLayer.fill(li, vo, vo + g.count);
    }
    rest.set(g.rest, vo * 2);
    uvs.set(g.uvs, vo * 2);
    for (let i = 0; i < g.idx.length; i++) indices[io + i] = (g.idx[i] ?? 0) + vo;
    for (const w of g.wts) wts.push(w);
    vo += g.count;
    io += g.idx.length;
  }
  return { rest, uvs, indices, skin: buildSkinData(sk, rest, wts), layerNames, vertexLayer };
}
