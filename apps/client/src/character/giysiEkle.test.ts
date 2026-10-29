/** Giysi içe aktarıcısı (tools/karakter-deneme/giysiEkle.mjs): ofset hesabı, doğrulama, kostüm kapsamı. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  coversOfBones,
  formatRig,
  layerFromSpec,
  pieceRelative,
  type RigBone,
  webpSize,
} from "../../../../tools/karakter-deneme/giysiEkle.mjs";

const rig = JSON.parse(
  readFileSync(new URL("../../public/assets/karakter/rig.json", import.meta.url), "utf8"),
) as { parts: Record<string, RigBone> };
const head = rig.parts.head as RigBone;

describe("içe aktarıcı: pivot hesabı", () => {
  it("parça kemikle aynı köşedeyse pivot kemiğinkiyle aynıdır", () => {
    expect(pieceRelative(head.sourceOrigin, head)).toEqual({ pivot: [...head.pivot], position: [0, 0] });
  });

  it("parça kemiğin sağına/altına kayarsa pivot o kadar sola/yukarı gider", () => {
    // baş köşesi (172, 63), pivot (84, 169): parça (182, 52.5) -> pivot (74, 179.5) (eldeki şapka kaydıyla aynı)
    expect(pieceRelative([182, 52.5], head).pivot).toEqual([74, 179.5]);
    expect(pieceRelative([172 + 10, 63 + 20], head).pivot).toEqual([84 - 10, 169 - 20]);
  });

  it("elle çizilen kayıtlar yeniden üretilir: sapka ve ceket parçaları", () => {
    const wardrobe = JSON.parse(
      readFileSync(new URL("../../public/assets/karakter/rig.json", import.meta.url), "utf8"),
    ) as {
      wardrobe: Record<
        string,
        { pieces: { bone: string; sourceOrigin: [number, number]; pivot: number[] }[] }
      >;
    };
    for (const layer of ["sapka", "ceket"])
      for (const p of wardrobe.wardrobe[layer]?.pieces ?? [])
        expect(pieceRelative(p.sourceOrigin, rig.parts[p.bone] as RigBone).pivot).toEqual(p.pivot);
  });
});

describe("içe aktarıcı: ürün doğrulama", () => {
  const spec = (over: Record<string, unknown> = {}, piece: Record<string, unknown> = {}) => ({
    id: "deneme-bere",
    slot: "sapka",
    pieces: [
      { file: "a.webp", bone: "head", sourceOrigin: [179, 28], size: [152, 109], layer: "on", ...piece },
    ],
    ...over,
  });

  it("geçerli ürün: dosya adı alt çizgili, katman rig biçiminde, drawAfter kemiğin kendisi", () => {
    const r = layerFromSpec(spec(), rig.parts);
    expect(r.id).toBe("deneme-bere");
    expect(r.layer.slot).toBe("sapka");
    const p = r.layer.pieces[0];
    expect(p).toMatchObject({
      file: "giysi/deneme_bere_head.webp",
      bone: "head",
      parent: "head",
      drawAfter: "head",
      layer: "on",
      size: [152, 109],
      sourceOrigin: [179, 28],
      position: [0, 0],
      rotation: 0,
    });
    expect(p?.pivot).toEqual([84 - (179 - 172), 169 - (28 - 63)]);
    expect(r.copies).toEqual([{ from: "a.webp", to: "giysi/deneme_bere_head.webp" }]);
    expect(r.covers).toBeUndefined();
  });

  it("arka katman dosya adına _arka ekler; aynı kemikte ikinci parça numaralanır", () => {
    const r = layerFromSpec(
      {
        id: "pelerin",
        slot: "aksesuar",
        pieces: [
          { file: "a.webp", bone: "torso", sourceOrigin: [100, 100], size: [10, 10], layer: "arka" },
          { file: "b.webp", bone: "torso", sourceOrigin: [100, 100], size: [10, 10], layer: "arka" },
          { file: "c.webp", bone: "torso", sourceOrigin: [100, 100], size: [10, 10] },
        ],
      },
      rig.parts,
    );
    expect(r.layer.pieces.map((p) => p.file)).toEqual([
      "giysi/pelerin_torso_arka.webp",
      "giysi/pelerin_torso_arka_2.webp",
      "giysi/pelerin_torso.webp",
    ]);
    expect(r.layer.pieces.map((p) => p.layer)).toEqual(["arka", "arka", "on"]);
  });

  it("kostümün covers'ı parçalarının kemiklerinden türer", () => {
    const piece = (bone: string) => ({ file: `${bone}.webp`, bone, sourceOrigin: [0, 0], size: [4, 4] });
    const r = layerFromSpec(
      {
        id: "astronot",
        slot: "kostum",
        pieces: [
          piece("head"),
          piece("torso"),
          piece("left_upper_arm"),
          piece("left_shin"),
          piece("left_foot"),
        ],
      },
      rig.parts,
    );
    expect([...(r.covers ?? [])].sort()).toEqual(["alt", "ayakkabi", "sapka", "ust"]);
    expect(coversOfBones(["right_hand"])).toEqual(["ust"]);
    expect(coversOfBones(["nope"])).toEqual([]);
  });

  it("geçersiz girdiler açık hatayla reddedilir", () => {
    expect(() => layerFromSpec(spec({ id: "Kötü_Ad" }), rig.parts)).toThrow(/kimlik/);
    expect(() => layerFromSpec(spec({ slot: "pantolon" }), rig.parts)).toThrow(/yuva/);
    expect(() => layerFromSpec(spec({ pieces: [] }), rig.parts)).toThrow(/parça yok/);
    expect(() => layerFromSpec(spec({}, { bone: "kuyruk" }), rig.parts)).toThrow(/kemik/);
    expect(() => layerFromSpec(spec({}, { layer: "yan" }), rig.parts)).toThrow(/katman/);
    expect(() => layerFromSpec(spec({}, { sourceOrigin: [1] }), rig.parts)).toThrow(/sourceOrigin/);
    expect(() => layerFromSpec(spec({}, { file: "a.png" }), rig.parts)).toThrow(/webp/);
    expect(() => layerFromSpec(spec(), rig.parts, () => [10, 10])).toThrow(/10x10/);
    expect(() => layerFromSpec(spec(), rig.parts, () => [152, 109])).not.toThrow();
  });
});

describe("içe aktarıcı: dosya yardımcıları", () => {
  it("webpSize gerçek şapka görsellerinin boyutunu okur", () => {
    const bytes = readFileSync(new URL("../../public/assets/karakter/giysi/tac_head.webp", import.meta.url));
    expect(webpSize(bytes)).toEqual([167, 106]);
    expect(webpSize(Buffer.from("merhaba dünya, bu bir webp değil, hiç değil"))).toBeNull();
  });

  it("formatRig: nesneler girintili, sayı dizileri tek satır, JSON olarak geri okunur", () => {
    const v = { a: { b: [1, 2.5], c: [{ d: 1 }, { e: "x" }] }, f: [] };
    const text = formatRig(v);
    expect(text).toContain('"b": [1, 2.5]');
    expect(JSON.parse(text)).toEqual(v);
  });
});
