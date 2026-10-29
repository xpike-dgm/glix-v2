/**
 * Karakter takımı: iskelet, gövde ve atlas yerleşimi bir kez kurulur; giysi görselleri katman katman, ilk istekte
 * yüklenip önbelleğe alınır (tarayıcı tarafı, Pixi'siz). Dans dosyaları da kimliğe göre bir kez okunur ve doğrulanır.
 */

import { packAtlas } from "./atlasLayout.js";
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
  /**
   * Gövde ve giysi parçalarının dizildiği görsel (tek doku). Yerleşim rig boyutlarından baştan bellidir; giysi
   * görselleri yüklendikçe kendi yerlerine çizilir, bu yüzden `atlasVersion` artınca doku yeniden yüklenmelidir.
   */
  atlas: HTMLCanvasElement;
  /** Atlasa her yeni katman çizildiğinde artar (GPU dokusunu tazelemek için). */
  atlasVersion(): number;
  geos: ReadonlyMap<string, PieceGeo>;
  /** Çıplak gövdenin rig koordinatındaki sınırı: boy ve genişlik sığdırma buna göre. */
  figure: { top: number; bottom: number; left: number; right: number };
  /**
   * Katmanların görsellerini (yüklü değillerse) indirir; aynı katman için eşzamanlı istekler tek yüklemeyi paylaşır.
   * Hiç reddetmez: yüklenemeyen katman çizimden çıkar (`meshFor` onu atlar) ve sonraki istekte yeniden denenir.
   */
  ensureLayers(layers: readonly string[]): Promise<void>;
  /** İstenen bilinen katmanların hepsi yüklü mü (yüklenemeyenler için false). */
  layersReady(layers: readonly string[]): boolean;
  /** İstenenlerden gerçekten çizilebilecek (bilinen ve yüklü) katmanlar: sıralı, tekil. */
  drawable(layers: readonly string[]): string[];
  /** Kıyafet katmanları için ağ (kıyafet başına önbellekli); yüklü olmayan katman atlanır. */
  meshFor(layers: readonly string[]): MeshData;
}

/** Dış dünya (testte değiştirilir): ağ ve tuval. */
export interface KitIO {
  json(url: string): Promise<unknown>;
  image(url: string): Promise<{ width: number; height: number } & CanvasImageSource>;
  canvas(w: number, h: number): HTMLCanvasElement;
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

const browserIO: KitIO = {
  json: fetchJson,
  image: loadImage,
  canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  },
};

interface Piece {
  spec: PieceSpec;
  file: string;
}

export async function buildKit(io: KitIO = browserIO): Promise<CharacterKit> {
  const rig: Rig | null = parseRig(await io.json(`${KARAKTER_YOLU}/rig.json`));
  if (!rig) throw new Error("karakter iskeleti geçersiz");
  const sk = buildSkeleton(rig);
  const boneIx = (name: string): number => sk.index.get(name) ?? 0;

  // Yerleşim rig boyutlarından baştan çıkar: gövde ve tüm giysi parçalarının atlas konumu sabittir.
  const raw: { piece: Omit<PieceSpec, "ax" | "ay">; file: string }[] = [];
  for (const p of rig.parts)
    raw.push({
      file: p.file,
      piece: {
        key: `body:${p.name}`,
        layer: "body",
        bone: boneIx(p.name),
        after: p.name,
        w: p.size[0],
        h: p.size[1],
        ox: p.sourceOrigin[0],
        oy: p.sourceOrigin[1],
      },
    });
  for (const [layer, pieces] of Object.entries(rig.wardrobe))
    for (const [i, q] of pieces.entries())
      raw.push({
        file: q.file,
        piece: {
          key: pieceKey(layer, i),
          layer,
          bone: boneIx(q.bone),
          after: q.drawAfter,
          w: q.size[0],
          h: q.size[1],
          ox: q.sourceOrigin[0],
          oy: q.sourceOrigin[1],
        },
      });
  const { slots, height: atlasH } = packAtlas(
    raw.map((r) => ({ w: r.piece.w, h: r.piece.h })),
    ATLAS_W,
    PAD,
  );
  const byLayer = new Map<string, Piece[]>();
  raw.forEach((r, i) => {
    const s = slots[i];
    if (!s) return;
    const list = byLayer.get(r.piece.layer) ?? [];
    list.push({ spec: { ...r.piece, ...s }, file: r.file });
    byLayer.set(r.piece.layer, list);
  });

  const atlas = io.canvas(ATLAS_W, atlasH);
  const g = atlas.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("tuval kullanılamıyor");

  const geos = new Map<string, PieceGeo>();
  const loaded = new Set<string>();
  let version = 0;

  /** Bir katmanın (ya da gövdenin) görsellerini indirir, atlastaki yerlerine çizer ve geometrilerini üretir. Hepsi ya da hiçbiri. */
  async function loadPieces(layer: string): Promise<void> {
    const pieces = byLayer.get(layer) ?? [];
    const images = await Promise.all(pieces.map((p) => io.image(`${KARAKTER_YOLU}/${p.file}`)));
    pieces.forEach((p, i) => {
      const im = images[i];
      if (!im || im.width !== p.spec.w || im.height !== p.spec.h)
        throw new Error(`görsel boyutu rig ile uyuşmuyor: ${p.file}`);
    });
    const made = new Map<string, PieceGeo>();
    pieces.forEach((p, i) => {
      const s = p.spec;
      const im = images[i];
      if (im) g?.drawImage(im, s.ax, s.ay);
      const data = g?.getImageData(s.ax, s.ay, s.w, s.h).data;
      made.set(
        s.key,
        buildPieceGeometry(
          sk,
          s,
          { w: ATLAS_W, h: atlasH },
          (lx, ly) => (data?.[(Math.floor(ly) * s.w + Math.floor(lx)) * 4 + 3] ?? 0) > 4,
        ),
      );
    });
    for (const [k, v] of made) geos.set(k, v);
    loaded.add(layer);
    version++;
  }

  await loadPieces("body");

  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  for (const { spec: s } of byLayer.get("body") ?? []) {
    top = Math.min(top, s.oy);
    bottom = Math.max(bottom, s.oy + s.h);
    left = Math.min(left, s.ox);
    right = Math.max(right, s.ox + s.w);
  }

  const inflight = new Map<string, Promise<void>>();
  const known = (l: string): boolean => rig.wardrobe[l] !== undefined;
  const drawable = (layers: readonly string[]): string[] =>
    [...new Set(layers.filter((l) => known(l) && loaded.has(l)))].sort();
  const meshes = new Lru<string, MeshData>(MESH_CACHE_MAX);
  return {
    skeleton: sk,
    atlas,
    atlasVersion: () => version,
    geos,
    figure: { top, bottom, left, right },
    async ensureLayers(layers) {
      const jobs: Promise<void>[] = [];
      for (const l of new Set(layers)) {
        if (!known(l) || loaded.has(l)) continue;
        let job = inflight.get(l);
        if (!job) {
          // Hata önbelleğe girmez: iş biter bitmez kayıt silinir, sonraki istek yeniden dener.
          const started: Promise<void> = loadPieces(l)
            .catch(() => undefined)
            .finally(() => {
              if (inflight.get(l) === started) inflight.delete(l);
            });
          inflight.set(l, started);
          job = started;
        }
        jobs.push(job);
      }
      await Promise.all(jobs);
    },
    layersReady: (layers) => layers.every((l) => !known(l) || loaded.has(l)),
    drawable,
    meshFor(layers) {
      const wanted = drawable(layers);
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
