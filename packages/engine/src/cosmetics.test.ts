import { describe, expect, it } from "vitest";
import {
  CLOTHING_COLOURS,
  COLOUR_MODE,
  COSMETIC_ITEMS,
  COSMETIC_PRICES,
  COSMETIC_TYPES,
  cleanEquipped,
  colourUnlocked,
  cosmeticAssetFiles,
  cosmeticsFromEquipped,
  coveredSlots,
  currentPrice,
  DEFAULT_COLOUR,
  DEFAULT_DANCE,
  dailyDeals,
  dealPrice,
  equippedValue,
  GIYSI_SIRASI,
  isEquippable,
  istanbulDayNumber,
  itemsOfType,
  nextIstanbulMidnight,
  PLACE_DANCE,
  parseCosmetics,
  parseStickerId,
  STICKER_NAMES,
  STICKERS_PER_PACK,
  slotOfBone,
  splitEquipped,
  stickerFile,
  stickerId,
} from "./cosmetics.js";

const DAY = 24 * 3600 * 1000;
const at = (iso: string) => Date.parse(iso);

describe("kozmetik kataloğu", () => {
  it("kimlikler benzersiz kebab-case, fiyat nadirlikten gelir, her türün ürünü var", () => {
    const ids = COSMETIC_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of COSMETIC_ITEMS) {
      expect(i.id).toMatch(/^[a-z]+(-[a-z]+)+$/);
      expect(i.price).toBe(COSMETIC_PRICES[i.rarity]);
      expect(i.name.length).toBeGreaterThan(0);
    }
    // Giysi yuvalarından henüz ürünü olmayanlar olabilir (arayüz onları göstermez); diğer türlerin hepsinde ürün var.
    for (const t of COSMETIC_TYPES.filter((x) => x.group !== "giysi"))
      expect(COSMETIC_ITEMS.some((i) => i.type === t.id)).toBe(true);
    expect(COSMETIC_ITEMS).toHaveLength(52);
  });

  it("parseCosmetics: bilinmeyen ya da yanlış türdeki kimlik atılır", () => {
    expect(parseCosmetics({ title: "unvan-efsane", nameFx: "ad-neon-mavi", frame: "cerceve-cift" })).toEqual({
      title: "unvan-efsane",
      nameFx: "ad-neon-mavi",
      frame: "cerceve-cift",
    });
    expect(parseCosmetics({ title: "yok-boyle", nameFx: "unvan-efsane", frame: 3 })).toBeUndefined();
    expect(parseCosmetics({ title: "unvan-sansli", frame: "x" })).toEqual({ title: "unvan-sansli" });
    expect(parseCosmetics(null)).toBeUndefined();
    expect(parseCosmetics([])).toBeUndefined();
    expect(parseCosmetics("unvan-efsane")).toBeUndefined();
  });

  it("cosmeticsFromEquipped: tür başına kuşanılan alanlara çevrilir", () => {
    expect(cosmeticsFromEquipped({ unvan: "unvan-sansli", cerceve: "cerceve-cift" })).toEqual({
      title: "unvan-sansli",
      frame: "cerceve-cift",
    });
    expect(cosmeticsFromEquipped({})).toBeUndefined();
    expect(cosmeticsFromEquipped({ unvan: "cerceve-cift" })).toBeUndefined();
  });
});

describe("kürsü karakteri ürünleri", () => {
  it("dans fiyatları ve dağılımı: 3 sıradan, 3 nadir, 2 efsanevi", () => {
    const dances = itemsOfType("dans");
    expect(dances).toHaveLength(8);
    const price = (r: string) => dances.filter((d) => d.rarity === r).map((d) => d.price);
    expect(price("siradan")).toEqual([150, 150, 150]);
    expect(price("nadir")).toEqual([400, 400, 400]);
    expect(price("efsanevi")).toEqual([1000, 1000]);
    expect(dances.map((d) => d.name)).toEqual([
      "Twist",
      "Tavuk Dansı",
      "Neşeli Adım",
      "Charleston",
      "Lambada",
      "Makarena",
      "Kazaçok",
      "Çizgi Film Dansı",
    ]);
  });

  it("dans ve giysi ürünlerinin karakter varlığı adı var; varsayılan ve selam satılmaz", () => {
    for (const d of itemsOfType("dans")) expect(d.asset).toMatch(/^[a-z]{2,16}$/);
    for (const t of COSMETIC_TYPES.filter((x) => x.group === "giysi"))
      for (const i of itemsOfType(t.id)) expect(i.asset).toMatch(/^[a-z]+(-[a-z]+)*$/);
    // selam satılmaz, varsayılan dans katalogda ürün değildir
    expect(itemsOfType("dans").some((d) => d.asset === PLACE_DANCE || d.asset === DEFAULT_DANCE)).toBe(false);
    expect(DEFAULT_DANCE).toBe("sevinc");
    expect(PLACE_DANCE).toBe("selam");
  });

  it("her giysi yuvası ayrı bir türdür ve giysi grubundadır", () => {
    expect(COSMETIC_TYPES.filter((t) => t.group === "giysi").map((t) => t.id)).toEqual([
      "sapka",
      "ust",
      "alt",
      "ayakkabi",
      "aksesuar",
      "kostum",
    ]);
    expect(itemsOfType("sapka").map((i) => [i.id, i.rarity])).toEqual([
      ["sapka-neon-kep", "siradan"],
      ["sapka-bere", "siradan"],
      ["sapka-fotr", "siradan"],
      ["sapka-parti", "siradan"],
      ["sapka-kovboy", "nadir"],
      ["sapka-kulaklikli-kask", "nadir"],
      ["sapka-korsan", "nadir"],
      ["sapka-tac", "efsanevi"],
    ]);
    expect(itemsOfType("ust").map((i) => [i.id, i.rarity])).toEqual([["ust-neon-bomber", "nadir"]]);
  });

  it("cosmeticsFromEquipped / parseCosmetics yeni alanları taşır, yanlış türü atar", () => {
    const eq = { dans: "dans-twist", sapka: "sapka-neon-kep", ust: "ust-neon-bomber" };
    const want = { dance: "dans-twist", hat: "sapka-neon-kep", top: "ust-neon-bomber" };
    expect(cosmeticsFromEquipped(eq)).toEqual(want);
    expect(parseCosmetics(want)).toEqual(want);
    expect(parseCosmetics({ dance: "sapka-neon-kep", hat: "dans-twist", top: "yok-boyle" })).toBeUndefined();
  });
});

describe("giysi yuvaları ve renkleri", () => {
  it("kemikten yuva: kostümün kapladığı yuvalar parçalarının kemiklerinden türer, aksesuar kaplanmaz", () => {
    expect(slotOfBone("head")).toBe("sapka");
    expect(slotOfBone("left_forearm")).toBe("ust");
    expect(slotOfBone("right_hand")).toBe("ust");
    expect(slotOfBone("right_shin")).toBe("alt");
    expect(slotOfBone("left_foot")).toBe("ayakkabi");
    expect(slotOfBone("root")).toBeNull();
    expect(coveredSlots(["torso", "head", "left_upper_arm", "left_foot"])).toEqual([
      "ayakkabi",
      "ust",
      "sapka",
    ]);
    expect(coveredSlots([])).toEqual([]);
    expect(GIYSI_SIRASI).not.toContain("dans");
    // aynı kemikte: alt < ayakkabı < üst < aksesuar < şapka
    expect(GIYSI_SIRASI.indexOf("alt")).toBeLessThan(GIYSI_SIRASI.indexOf("ust"));
    expect(GIYSI_SIRASI.indexOf("ust")).toBeLessThan(GIYSI_SIRASI.indexOf("aksesuar"));
  });

  it("kostüm ürünlerinin covers alanı vardır; diğer türlerde yoktur", () => {
    for (const i of COSMETIC_ITEMS) {
      if (i.type === "kostum") expect(i.covers?.length ?? 0).toBeGreaterThan(0);
      else expect(i.covers).toBeUndefined();
    }
  });

  it("renkler: beş neon renk, ilki varsayılan; kimlik~renk ayrıştırılır ve kanonikleşir", () => {
    expect(CLOTHING_COLOURS.map((c) => c.id)).toEqual(["camgobegi", "pembe", "altin", "yesil", "mor"]);
    expect(DEFAULT_COLOUR).toBe("camgobegi");
    expect(splitEquipped("sapka-bere~pembe")).toEqual({ id: "sapka-bere", colour: "pembe" });
    expect(splitEquipped("sapka-bere")).toEqual({ id: "sapka-bere", colour: "camgobegi" });
    expect(splitEquipped("sapka-bere~kirmizi")).toBeNull();
    expect(splitEquipped("~pembe")).toBeNull();
    expect(equippedValue("sapka-bere", "camgobegi")).toBe("sapka-bere");
    expect(equippedValue("sapka-bere", "mor")).toBe("sapka-bere~mor");
  });

  it("cleanEquipped: yalnız giysi türlerinde ve bilinen renkle; varsayılan renk yazılmaz", () => {
    expect(cleanEquipped("sapka", "sapka-bere~altin")).toBe("sapka-bere~altin");
    expect(cleanEquipped("sapka", "sapka-bere~camgobegi")).toBe("sapka-bere");
    expect(cleanEquipped("sapka", "sapka-bere~kirmizi")).toBeNull();
    expect(cleanEquipped("sapka", "sapka-bere~")).toBeNull();
    expect(cleanEquipped("ust", "sapka-bere~altin")).toBeNull();
    expect(cleanEquipped("cerceve", "cerceve-cift~pembe")).toBeNull();
    expect(cleanEquipped("cerceve", "cerceve-cift")).toBe("cerceve-cift");
    expect(cleanEquipped("sapka", 5)).toBeNull();
    expect(cleanEquipped("sapka", `${"x".repeat(70)}`)).toBeNull();
  });

  it("renkli değer Cosmetics'e taşınır, bilinmeyen renkli değer atılır", () => {
    expect(cosmeticsFromEquipped({ sapka: "sapka-tac~mor", ust: "ust-neon-bomber~pembe" })).toEqual({
      hat: "sapka-tac~mor",
      top: "ust-neon-bomber~pembe",
    });
    expect(parseCosmetics({ hat: "sapka-tac~mor" })).toEqual({ hat: "sapka-tac~mor" });
    expect(parseCosmetics({ hat: "sapka-tac~turuncu" })).toBeUndefined();
    expect(parseCosmetics({ hat: "sapka-tac~camgobegi" })).toEqual({ hat: "sapka-tac" });
  });

  it("colourUnlocked: serbest kipte ürüne sahip olmak tüm renkleri açar", () => {
    expect(COLOUR_MODE).toBe("free");
    const owns = (id: string) => id === "sapka-bere";
    expect(colourUnlocked(owns, "sapka-bere", "pembe")).toBe(true);
    expect(colourUnlocked(owns, "sapka-fotr", "camgobegi")).toBe(false);
    expect(colourUnlocked(owns, "sapka-fotr", "pembe")).toBe(false);
  });
});

describe("günün fırsatı", () => {
  it("aynı İstanbul gününde hep aynı, iki farklı ücretli ürün", () => {
    const a = dailyDeals(at("2026-10-28T00:00:00+03:00"));
    const b = dailyDeals(at("2026-10-28T23:59:59+03:00"));
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
    expect(a[0]?.itemId).not.toBe(a[1]?.itemId);
    for (const d of a) {
      const it = COSMETIC_ITEMS.find((i) => i.id === d.itemId);
      expect(it).toBeDefined();
      expect(d.listPrice).toBe(it?.price);
      expect(d.price).toBeLessThan(d.listPrice);
    }
  });

  it("gün sınırı İstanbul gece yarısıdır (21:00 UTC)", () => {
    const before = at("2026-10-28T20:59:59Z");
    const after = at("2026-10-28T21:00:00Z");
    expect(istanbulDayNumber(after)).toBe(istanbulDayNumber(before) + 1);
    expect(nextIstanbulMidnight(before)).toBe(after);
    expect(nextIstanbulMidnight(after)).toBe(after + DAY);
    expect(dailyDeals(before)).toEqual(dailyDeals(at("2026-10-28T00:00:00+03:00")));
    expect(dailyDeals(after)).toEqual(dailyDeals(at("2026-10-29T12:00:00+03:00")));
  });

  it("günler arasında fırsat değişir (60 günde birden çok farklı çift)", () => {
    const start = at("2026-11-01T12:00:00Z");
    const pairs = new Set<string>();
    for (let d = 0; d < 60; d++)
      pairs.add(
        dailyDeals(start + d * DAY)
          .map((x) => x.itemId)
          .join("+"),
      );
    expect(pairs.size).toBeGreaterThan(30);
  });

  it("indirimli fiyat %70, en yakın 5'e yuvarlanır", () => {
    expect([150, 400, 1000].map(dealPrice)).toEqual([105, 280, 700]);
    expect(dealPrice(155)).toBe(110); // 108,5 -> 110
    expect(dealPrice(151)).toBe(105); // 105,7 -> 105
    expect(dealPrice(10)).toBe(5); // 7 -> 5
    for (const d of dailyDeals(Date.now())) expect(d.price % 5).toBe(0);
  });

  it("currentPrice: fırsattaki indirimli, diğeri liste fiyatı, bilinmeyen null", () => {
    const now = at("2026-10-28T12:00:00Z");
    const deals = dailyDeals(now);
    const first = deals[0];
    if (!first) throw new Error("fırsat yok");
    expect(currentPrice(first.itemId, now)).toBe(first.price);
    const other = COSMETIC_ITEMS.find((i) => !deals.some((d) => d.itemId === i.id));
    expect(currentPrice(other?.id ?? "", now)).toBe(other?.price);
    expect(currentPrice("yok", now)).toBeNull();
  });
});

describe("resimli mağaza türleri (M3)", () => {
  it("her türün ürün sayısı ve nadirlik dağılımı: sıradan, nadir, efsanevi", () => {
    const by = (t: Parameters<typeof itemsOfType>[0]) => itemsOfType(t).map((i) => i.rarity);
    expect(by("kart-arkasi")).toEqual(["siradan", "siradan", "nadir", "nadir", "efsanevi"]);
    expect(by("zafer")).toEqual(["siradan", "siradan", "nadir", "nadir", "efsanevi"]);
    expect(by("tepki")).toEqual(["siradan", "nadir", "efsanevi"]);
    expect(by("giris")).toEqual(["siradan", "siradan", "nadir", "nadir", "efsanevi"]);
  });

  it("görsel dosya listesi: kart arkası 1, zafer 4, paket 6, giriş 2", () => {
    const count = (id: string) =>
      cosmeticAssetFiles(COSMETIC_ITEMS.find((i) => i.id === id) ?? COSMETIC_ITEMS[0]!).length;
    expect(count("kart-elektrik")).toBe(1);
    expect(count("zafer-balon")).toBe(4);
    expect(count("tepki-efsane")).toBe(6);
    expect(count("giris-portal")).toBe(2);
    expect(count("unvan-efsane")).toBe(0);
  });

  it("kuşanılan alanlar: kart arkası, zafer ve giriş kuşanılır; tepki paketi kuşanılmaz", () => {
    expect(
      cosmeticsFromEquipped({ "kart-arkasi": "kart-elektrik", zafer: "zafer-balon", giris: "giris-portal" }),
    ).toEqual({ cardBack: "kart-elektrik", celebration: "zafer-balon", entry: "giris-portal" });
    expect(cosmeticsFromEquipped({ tepki: "tepki-parti" })).toBeUndefined();
    expect(
      parseCosmetics({ cardBack: "kart-elektrik", entry: "giris-duman", celebration: "kart-elektrik" }),
    ).toEqual({
      cardBack: "kart-elektrik",
      entry: "giris-duman",
    });
    expect(COSMETIC_TYPES.filter((t) => !isEquippable(t)).map((t) => t.id)).toEqual(["tepki"]);
  });

  it("çıkartma kimlikleri: geçerli biçim çözülür, bozuk olanlar reddedilir", () => {
    const pack = itemsOfType("tepki")[1];
    if (!pack) throw new Error("paket yok");
    expect(STICKER_NAMES[pack.asset ?? ""]).toHaveLength(STICKERS_PER_PACK);
    for (let n = 1; n <= STICKERS_PER_PACK; n++) {
      const ref = parseStickerId(stickerId(pack, n));
      expect(ref?.item.id).toBe("tepki-parti");
      expect(ref?.n).toBe(n);
      expect(stickerFile(ref ?? { item: pack, n })).toBe(`tepki/parti-${n}.webp`);
    }
    for (const bad of [
      "pack:parti:0",
      "pack:parti:7",
      "pack:parti:10",
      "pack:yok:1",
      "pack:parti",
      "pack::1",
      "pack:../x:1",
      "Pack:parti:1",
      "😂",
      "",
      null,
      3,
    ])
      expect(parseStickerId(bad)).toBeNull();
  });
});
