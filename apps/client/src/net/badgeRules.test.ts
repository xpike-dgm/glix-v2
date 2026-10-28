import { describe, expect, it } from "vitest";
import {
  badgeFamily,
  earnedSummary,
  medalGlyph,
  medalShape,
  newBadges,
  parseBadgeIds,
  parseBadges,
} from "./badgeRules.js";
import { parseServerMessage } from "./parse.js";

const good = {
  id: "ilk-mac",
  name: "İlk Adım",
  description: "İlk maçını bitir.",
  secret: false,
  earned: true,
};

describe("parseBadges", () => {
  it("geçerli listeyi okur, bozuk satırları atar", () => {
    const list = parseBadges([good, { ...good, id: "BÜYÜK" }, { ...good, earned: "evet" }, 5, null]);
    expect(list).toEqual([good]);
  });
  it("liste yoksa ya da dizi değilse boş döner (eski sunucu)", () => {
    expect(parseBadges(undefined)).toEqual([]);
    expect(parseBadges({})).toEqual([]);
  });
  it("aşırı uzun listeyi kırpar", () => {
    expect(parseBadges(Array.from({ length: 500 }, () => good))).toHaveLength(60);
  });
  it("gizli kazanılmamış rozet yer tutucu kimlikle gelir", () => {
    const hidden = { id: "gizli-1", name: "???", description: "Gizli rozet", secret: true, earned: false };
    expect(parseBadges([hidden])).toEqual([hidden]);
  });
});

describe("parseBadgeIds", () => {
  it("tekrarları atar", () => {
    expect(parseBadgeIds(["a-b", "a-b", "c"])).toEqual(["a-b", "c"]);
  });
  it("boş, çok uzun ya da bozuk listeyi reddeder", () => {
    expect(parseBadgeIds([])).toBeNull();
    expect(parseBadgeIds("x")).toBeNull();
    expect(parseBadgeIds(["ok", 3])).toBeNull();
    expect(parseBadgeIds(["Büyük Harf"])).toBeNull();
    expect(parseBadgeIds(Array.from({ length: 21 }, (_, i) => `r${i}`))).toBeNull();
  });
  it("badgesEarned mesajı doğrulanır", () => {
    const wire = (o: unknown) => JSON.stringify(o);
    expect(parseServerMessage(wire({ type: "badgesEarned", ids: ["ilk-mac"] }))).toEqual({
      type: "badgesEarned",
      ids: ["ilk-mac"],
    });
    expect(parseServerMessage(wire({ type: "badgesEarned", ids: [] }))).toBeNull();
    expect(parseServerMessage(wire({ type: "badgesEarned" }))).toBeNull();
  });
});

describe("newBadges", () => {
  it("kimlikleri profil listesiyle eşler; kazanılmamış ya da bilinmeyen atlanır", () => {
    const list = [good, { ...good, id: "on-mac", name: "Alışıyorum", earned: false }];
    expect(newBadges(["ilk-mac", "on-mac", "yok"], list).map((b) => b.id)).toEqual(["ilk-mac"]);
  });
});

describe("madalyon", () => {
  it("gizli rozet baklava, maç sayısı daire, galibiyet altıgen", () => {
    expect(medalShape("x", true)).toBe("diamond");
    expect(medalShape("on-mac", false)).toBe("circle");
    expect(medalShape("on-galibiyet", false)).toBe("hex");
    expect(medalShape("seri", false)).toBe("square");
  });
  it("aile şekilden türetilir", () => {
    expect(badgeFamily("on-mac", false)).toBe("mac");
    expect(badgeFamily("on-galibiyet", false)).toBe("galibiyet");
    expect(badgeFamily("seri", false)).toBe("ozel");
    expect(badgeFamily("gece-kusu", true)).toBe("gizli");
  });
  it("sayılı rozetler sayı gösterir, diğerleri çizim", () => {
    expect(medalGlyph("yuz-mac")).toEqual({ kind: "number", text: "100" });
    expect(medalGlyph("gece-kusu")).toEqual({ kind: "icon", name: "ay" });
    expect(medalGlyph("kahin-on")).toEqual({ kind: "icon", name: "goz" });
    expect(medalGlyph("kule-ustasi")).toEqual({ kind: "icon", name: "kule" });
    expect(medalGlyph("bilinmeyen")).toEqual({ kind: "icon", name: "yildiz" });
  });
  it("özet kazanılan / toplam", () => {
    expect(earnedSummary([good, { ...good, earned: false }, { ...good, earned: false }])).toBe("1 / 3 rozet");
  });
});
