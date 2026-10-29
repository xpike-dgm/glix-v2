import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import {
  COSMETIC_ITEMS,
  coveredSlots,
  DEFAULT_DANCE,
  isClothingType,
  itemsOfType,
  PLACE_DANCE,
  slotOfBone,
} from "@glix/engine";
import { describe, expect, it } from "vitest";
import { BONE_SLOT, coversOfBones, pieceRelative } from "../../../../tools/karakter-deneme/giysiEkle.mjs";
import { parseDance } from "./dance.js";

/** Katalog ile karakter varlıkları (public/assets/karakter) birbirini tutar. */
const root = new URL("../../public/assets/karakter/", import.meta.url);
const file = (p: string) => new URL(p, root);

describe("katalog ve karakter varlıkları", () => {
  it("her dans ürününün dosyası var ve geçerli; varsayılan dans ve selam da", () => {
    const ids = [...itemsOfType("dans").map((d) => d.asset), DEFAULT_DANCE, PLACE_DANCE];
    for (const id of ids) {
      expect(id).toBeDefined();
      const path = file(`dans/${id}.json`);
      expect(existsSync(path)).toBe(true);
      expect(parseDance(JSON.parse(readFileSync(path, "utf8")))).not.toBeNull();
    }
  });

  it("dans dosyaları küçük (toplam 100 KB altı) ve her dosya satılan ya da kullanılan bir dans", () => {
    const names = readdirSync(file("dans/")).map((n) => n.replace(".json", ""));
    const known = new Set<string | undefined>([
      ...itemsOfType("dans").map((d) => d.asset),
      DEFAULT_DANCE,
      PLACE_DANCE,
    ]);
    for (const n of names) expect(known.has(n)).toBe(true);
    const total = names.reduce((n, f) => n + statSync(file(`dans/${f}.json`)).size, 0);
    expect(total).toBeLessThan(100_000);
  });

  const rig = JSON.parse(readFileSync(file("rig.json"), "utf8")) as {
    parts: Record<string, { pivot: [number, number]; sourceOrigin: [number, number] }>;
    wardrobe: Record<
      string,
      {
        slot: string;
        pieces: {
          file: string;
          bone: string;
          layer?: string;
          size: [number, number];
          pivot: [number, number];
          sourceOrigin: [number, number];
        }[];
      }
    >;
  };
  const clothes = COSMETIC_ITEMS.filter((i) => isClothingType(i.type));

  it("her giysi ürününün katmanı rig.json'da tanımlı, yuvası türüyle aynı, parça görselleri var", () => {
    for (const it of clothes) {
      const layer = rig.wardrobe[it.asset ?? ""];
      expect(layer, it.id).toBeDefined();
      expect(layer?.slot, it.id).toBe(it.type);
      expect(layer?.pieces.length, it.id).toBeGreaterThan(0);
      for (const p of layer?.pieces ?? []) {
        expect(existsSync(file(p.file)), p.file).toBe(true);
        expect(rig.parts[p.bone], p.bone).toBeDefined();
        expect(["on", "arka", undefined]).toContain(p.layer);
      }
    }
  });

  it("rig.json'daki her giysi katmanı katalogda bir ürüne bağlı (artık dosya yok)", () => {
    const assets = new Set(clothes.map((i) => i.asset));
    for (const name of Object.keys(rig.wardrobe)) expect(assets.has(name), name).toBe(true);
    const used = new Set(
      Object.values(rig.wardrobe).flatMap((l) => l.pieces.map((p) => p.file.split("/")[1])),
    );
    for (const f of readdirSync(file("giysi/"))) expect(used.has(f), f).toBe(true);
  });

  it("pivot, parçanın kemiğe göre yerleşiminden türer (içe aktarıcı çıktısı baş ile hizalı)", () => {
    for (const layer of Object.values(rig.wardrobe))
      for (const p of layer.pieces) {
        const bone = rig.parts[p.bone];
        if (!bone) throw new Error(p.bone);
        const want = pieceRelative(p.sourceOrigin, bone);
        expect(p.pivot).toEqual(want.pivot);
      }
  });

  it("kostüm covers alanı, parçalarının kemiklerinden türeyen yuvalarla aynı; bone->yuva tablosu motorla aynı", () => {
    for (const it of clothes.filter((i) => i.type === "kostum")) {
      const bones = rig.wardrobe[it.asset ?? ""]?.pieces.map((p) => p.bone) ?? [];
      expect([...(it.covers ?? [])].sort()).toEqual(coveredSlots(bones).sort());
      expect(it.covers).not.toContain("aksesuar");
    }
    for (const bone of Object.keys(rig.parts)) expect(BONE_SLOT[bone] ?? null).toBe(slotOfBone(bone));
    expect(coversOfBones(["torso", "head", "left_foot"]).sort()).toEqual(
      coveredSlots(["torso", "head", "left_foot"]).sort(),
    );
  });
});
