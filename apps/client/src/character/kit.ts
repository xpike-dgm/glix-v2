/**
 * Karakter takımı: iskelet, atlas ve parça geometrileri bir kez yüklenir ve önbelleğe alınır (tarayıcı tarafı,
 * Pixi'siz). Dans dosyaları da kimliğe göre bir kez okunur ve doğrulanır.
 */

import { type DanceClip, parseDance } from "./dance.js";
import { Lru } from "./lru.js";
import {
  assembleMesh,
  buildPieceGeometry,
  drawKeys,
  type MeshData,
  type PieceGeo,
  type PieceSpec,
  pieceKey,
} from "./mesh.js";
import { buildSkeleton, parseRig, type Rig, type Skeleton } from "./rig.js";

export const KARAKTER_YOLU = "/assets/karakter";

export interface CharacterKit {
  skeleton: Skeleton;
  /** Gövde ve tüm giysi parçalarının dizildiği görsel (tek doku). */
  atlas: HTMLCanvasElement;
  geos: ReadonlyMap<string, PieceGeo>;
  /** Çıplak gövdenin rig koordinatındaki sınırı: boy ve genişlik sığdırma buna göre. */
  figure: { top: number; bottom: number; left: number; right: number };
  /** Kıyafet katmanları için ağ (kıyafet başına önbellekli). */
  meshFor(layers: readonly string[]): MeshData;
}

/** Kıyafet birleşimi ağı önbelleği: parti boyunca görülen birleşimler sınırsız birikmesin (kullanan kukla ağı kendi tutar). */
export const MESH_CACHE_MAX = 48;
const PAD = 12;
const ATLAS_W = 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`görsel yüklenemedi: ${src}`));
    im.src = src;
  });
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`istek başarısız: ${url}`);
  return res.json();
}

async function buildKit(): Promise<CharacterKit> {
  const rig: Rig | null = parseRig(await fetchJson(`${KARAKTER_YOLU}/rig.json`));
  if (!rig) throw new Error("karakter iskeleti geçersiz");
  const sk = buildSkeleton(rig);
  const boneIx = (name: string): number => sk.index.get(name) ?? 0;

  const jobs: {
    key: string;
    layer: string;
    bone: string;
    after: string;
    file: string;
    ox: number;
    oy: number;
  }[] = [];
  for (const p of rig.parts)
    jobs.push({
      key: `body:${p.name}`,
      layer: "body",
      bone: p.name,
      after: p.name,
      file: p.file,
      ox: p.sourceOrigin[0],
      oy: p.sourceOrigin[1],
    });
  for (const [layer, pieces] of Object.entries(rig.wardrobe))
    for (const [i, q] of pieces.entries())
      jobs.push({
        key: pieceKey(layer, i),
        layer,
        bone: q.bone,
        after: q.drawAfter,
        file: q.file,
        ox: q.sourceOrigin[0],
        oy: q.sourceOrigin[1],
      });
  const images = await Promise.all(jobs.map((j) => loadImage(`${KARAKTER_YOLU}/${j.file}`)));

  // Raf paketleme: yüksekten alçağa, satır satır.
  const order = jobs.map((_, i) => i).sort((a, b) => (images[b]?.height ?? 0) - (images[a]?.height ?? 0));
  const specs: PieceSpec[] = new Array(jobs.length);
  let px = 0;
  let py = 0;
  let rowH = 0;
  for (const i of order) {
    const im = images[i];
    const j = jobs[i];
    if (!im || !j) continue;
    if (px + im.width + PAD * 2 > ATLAS_W) {
      px = 0;
      py += rowH + PAD * 2;
      rowH = 0;
    }
    specs[i] = {
      key: j.key,
      layer: j.layer,
      bone: boneIx(j.bone),
      after: j.after,
      w: im.width,
      h: im.height,
      ox: j.ox,
      oy: j.oy,
      ax: px + PAD,
      ay: py + PAD,
    };
    px += im.width + PAD * 2;
    rowH = Math.max(rowH, im.height);
  }
  const atlasH = py + rowH + PAD * 2;
  const atlas = document.createElement("canvas");
  atlas.width = ATLAS_W;
  atlas.height = atlasH;
  const g = atlas.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("tuval kullanılamıyor");
  specs.forEach((s, i) => {
    const im = images[i];
    if (im) g.drawImage(im, s.ax, s.ay);
  });
  const data = g.getImageData(0, 0, ATLAS_W, atlasH).data;

  const geos = new Map<string, PieceGeo>();
  for (const s of specs) {
    geos.set(
      s.key,
      buildPieceGeometry(
        sk,
        s,
        { w: ATLAS_W, h: atlasH },
        (lx, ly) => (data[((s.ay + Math.floor(ly)) * ATLAS_W + s.ax + Math.floor(lx)) * 4 + 3] ?? 0) > 4,
      ),
    );
  }

  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  for (const s of specs) {
    if (s.layer !== "body") continue;
    top = Math.min(top, s.oy);
    bottom = Math.max(bottom, s.oy + s.h);
    left = Math.min(left, s.ox);
    right = Math.max(right, s.ox + s.w);
  }

  const meshes = new Lru<string, MeshData>(MESH_CACHE_MAX);
  return {
    skeleton: sk,
    atlas,
    geos,
    figure: { top, bottom, left, right },
    meshFor(layers) {
      const wanted = [...new Set(layers.filter((l) => rig.wardrobe[l] !== undefined))].sort();
      const id = wanted.join("+");
      let m = meshes.get(id);
      if (!m) {
        m = assembleMesh(sk, geos, drawKeys(rig, wanted));
        meshes.set(id, m);
      }
      return m;
    },
  };
}

let kitPromise: Promise<CharacterKit> | null = null;
/** Takımı bir kez yükler; başarısız olursa bir sonraki çağrıda yeniden denenir. */
export function loadKit(): Promise<CharacterKit> {
  if (!kitPromise) {
    kitPromise = buildKit().catch((err: unknown) => {
      kitPromise = null;
      throw err;
    });
  }
  return kitPromise;
}

const dances = new Map<string, Promise<DanceClip>>();
/** Dans dosyasını (kimliğe göre) bir kez okur; kimlik biçimi doğrulanır. */
export function loadDance(id: string): Promise<DanceClip> {
  let p = dances.get(id);
  if (!p) {
    p = (async () => {
      if (!/^[a-z]{2,16}$/.test(id)) throw new Error("dans kimliği geçersiz");
      const clip = parseDance(await fetchJson(`${KARAKTER_YOLU}/dans/${id}.json`));
      if (!clip) throw new Error(`dans geçersiz: ${id}`);
      return clip;
    })();
    p.catch(() => dances.delete(id));
    dances.set(id, p);
  }
  return p;
}
