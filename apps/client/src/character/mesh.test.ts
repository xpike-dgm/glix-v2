import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assembleMesh, buildPieceGeometry, drawKeys, GRID, type PieceGeo, type PieceSpec } from "./mesh.js";
import { buildSkeleton, parseRig, type Rig } from "./rig.js";

const rig = parseRig(
  JSON.parse(readFileSync(new URL("../../public/assets/karakter/rig.json", import.meta.url), "utf8")),
);
if (!rig) throw new Error("rig");
const sk = buildSkeleton(rig);

const spec = (key: string, bone: string, ox: number, oy: number, w: number, h: number): PieceSpec => ({
  key,
  layer: key.split(/[:#]/)[0] ?? "body",
  bone: sk.index.get(bone) ?? 0,
  after: bone,
  w,
  h,
  ox,
  oy,
  ax: 10,
  ay: 10,
});
const ATLAS = { w: 256, h: 256 };

describe("ağ üretimi", () => {
  it("dolu parça: hücre başına iki üçgen; komşu hücreler köşe paylaşır", () => {
    const g = buildPieceGeometry(sk, spec("body:head", "head", 100, 100, 20, 10), ATLAS, () => true);
    expect(g.idx.length).toBe(4 * 2 * 2 * 3); // 4x2 hücre
    expect(g.count).toBe(5 * 3);
    expect(g.rest.length).toBe(g.count * 2);
    expect(g.uvs.length).toBe(g.count * 2);
  });

  it("şeffaf hücreler ağa girmez", () => {
    const half = buildPieceGeometry(sk, spec("body:head", "head", 100, 100, 20, 10), ATLAS, (x) => x < 10);
    expect(half.idx.length).toBe(2 * 2 * 2 * 3);
    const none = buildPieceGeometry(sk, spec("body:head", "head", 100, 100, 20, 10), ATLAS, () => false);
    expect(none.count).toBe(0);
  });

  it("ondalıklı köken (yarım piksel) hücreleri bozmaz: küresel ızgaraya oturur", () => {
    const g = buildPieceGeometry(sk, spec("body:head", "head", 100.5, 100.5, 20, 10), ATLAS, () => true);
    for (let i = 0; i < g.count; i++) {
      expect((g.rest[i * 2] ?? 0) % GRID).toBe(0);
      expect((g.rest[i * 2 + 1] ?? 0) % GRID).toBe(0);
    }
  });

  it("iki parçanın ortak ızgara köşeleri aynı konumdadır (eklem dikişsiz)", () => {
    const a = buildPieceGeometry(sk, spec("body:torso", "torso", 100, 100, 40, 40), ATLAS, () => true);
    const b = buildPieceGeometry(sk, spec("body:head", "head", 120, 120, 40, 40), ATLAS, () => true);
    const key = (g: PieceGeo) =>
      new Set(Array.from({ length: g.count }, (_, i) => `${g.rest[i * 2]},${g.rest[i * 2 + 1]}`));
    const ka = key(a);
    const shared = [...key(b)].filter((k) => ka.has(k));
    expect(shared.length).toBeGreaterThan(0);
  });

  it("çizim sırası: gövde arkadan öne, giysi kendi kemiğinin hemen arkasında", () => {
    const keys = drawKeys(rig, ["sapka", "ceket"]);
    expect(keys[0]).toBe("body:left_thigh");
    expect(keys.indexOf("sapka#0")).toBe(keys.indexOf("body:head") + 1);
    expect(keys.indexOf("ceket#0")).toBe(keys.indexOf("body:torso") + 1);
    expect(keys.indexOf("ceket#2")).toBe(keys.indexOf("body:left_forearm") + 1);
    expect(drawKeys(rig, [])).toHaveLength(14);
    expect(drawKeys(rig, ["yok-boyle"])).toHaveLength(14);
  });

  it("yeni şapkalar başın hemen arkasında, katmanlar rig'de tanımlı", () => {
    for (const l of ["bere", "fotr", "parti", "kovboy", "kulaklikli-kask", "korsan", "tac"]) {
      expect(rig.wardrobe[l]?.[0]?.slot).toBe("sapka");
      const keys = drawKeys(rig, [l]);
      expect(keys.indexOf(`${l}#0`)).toBe(keys.indexOf("body:head") + 1);
    }
  });

  describe("yuva sırası, arka katman ve kostüm", () => {
    const piece = (bone: string, slot: string, behind = false) => ({
      file: "giysi/x.webp",
      size: [10, 10] as const,
      bone,
      drawAfter: bone,
      sourceOrigin: [0, 0] as const,
      behind,
      slot,
    });
    const synth: Rig = {
      ...rig,
      wardrobe: {
        ...rig.wardrobe,
        pelerin: [piece("torso", "aksesuar", true)],
        pantolon: [piece("left_thigh", "alt"), piece("torso", "alt")],
        bot: [piece("left_foot", "ayakkabi")],
        kolye: [piece("torso", "aksesuar")],
        takim: [piece("torso", "kostum"), piece("head", "kostum")],
      },
    };

    it("arka katman tüm gövdeden önce çizilir", () => {
      const keys = drawKeys(synth, ["ceket", "pelerin"]);
      expect(keys[0]).toBe("pelerin#0");
      expect(keys.indexOf("pelerin#0")).toBeLessThan(keys.indexOf("body:left_thigh"));
      expect(keys).toHaveLength(14 + 1 + 5);
    });

    it("aynı kemikte: alt, üstün altında; aksesuar üstün üstünde; şapka en üstte", () => {
      const keys = drawKeys(synth, ["kolye", "ceket", "pantolon", "sapka"]);
      const t = keys.indexOf("body:torso");
      expect(keys.slice(t, t + 4)).toEqual(["body:torso", "pantolon#1", "ceket#0", "kolye#0"]);
      expect(keys.indexOf("sapka#0")).toBe(keys.indexOf("body:head") + 1);
      // ayakkabı ayağın hemen arkasında, pantolon bacakta
      expect(drawKeys(synth, ["bot"]).indexOf("bot#0")).toBe(
        drawKeys(synth, ["bot"]).indexOf("body:left_foot") + 1,
      );
      expect(keys.indexOf("pantolon#0")).toBe(keys.indexOf("body:left_thigh") + 1);
    });

    it("kostüm yuvası aynı kemikte en altta çizilir", () => {
      const keys = drawKeys(synth, ["ceket", "takim"]);
      const t = keys.indexOf("body:torso");
      expect(keys.slice(t, t + 3)).toEqual(["body:torso", "takim#0", "ceket#0"]);
    });
  });

  it("birleştirme: indeksler parça kaymasıyla yeniden numaralanır", () => {
    const a = buildPieceGeometry(sk, spec("body:head", "head", 100, 100, 10, 10), ATLAS, () => true);
    const b = buildPieceGeometry(sk, spec("sapka:head", "head", 100, 100, 10, 10), ATLAS, () => true);
    const m = assembleMesh(
      sk,
      new Map([
        [a.key, a],
        [b.key, b],
      ]),
      [a.key, "yok", b.key],
    );
    expect(m.rest.length).toBe((a.count + b.count) * 2);
    expect(m.indices.length).toBe(a.idx.length + b.idx.length);
    expect(Math.max(...m.indices)).toBe(a.count + b.count - 1);
    expect(m.indices[a.idx.length]).toBe((b.idx[0] ?? 0) + a.count);
    expect(m.skin.count).toBe(a.count + b.count);
    // köşe katmanları: gövde -1, giysi katmanın dizini (renk süzgeci için)
    expect(m.layerNames).toEqual(["sapka"]);
    expect(Array.from(m.vertexLayer.slice(0, a.count)).every((v) => v === -1)).toBe(true);
    expect(Array.from(m.vertexLayer.slice(a.count)).every((v) => v === 0)).toBe(true);
  });
});
