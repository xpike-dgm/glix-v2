import { describe, expect, it } from "vitest";
import { EMPTY_SITE, parseDismissed, parseSiteNotice, shownAnnouncement } from "./siteRules.js";

const A = { id: 4, text: "Bu akşam kısa bakım var", kind: "uyari" as const, endsAt: null };

describe("site bildirimi doğrulama", () => {
  it("geçerli durumu olduğu gibi alır", () => {
    expect(parseSiteNotice({ announcement: A, maintenance: true })).toEqual({
      announcement: A,
      maintenance: true,
    });
    expect(parseSiteNotice({ announcement: null, maintenance: false })).toEqual(EMPTY_SITE);
  });

  it("duyuru yoksa ya da eksikse null duyuru", () => {
    expect(parseSiteNotice({ maintenance: false })).toEqual(EMPTY_SITE);
  });

  it("bozuk duyuru düşer ama bakım bayrağı korunur", () => {
    for (const bad of [
      { ...A, kind: "tehlike" },
      { ...A, text: "" },
      { ...A, text: "x".repeat(300) },
      { ...A, id: -1 },
      { ...A, id: "4" },
      { ...A, endsAt: "yarın" },
      "metin",
      [],
    ])
      expect(parseSiteNotice({ announcement: bad, maintenance: true })).toEqual({
        announcement: null,
        maintenance: true,
      });
  });

  it("bakım bayrağı yoksa ya da tür yanlışsa tümü geçersiz", () => {
    for (const bad of [null, [], "x", {}, { announcement: A }, { announcement: A, maintenance: "evet" }])
      expect(parseSiteNotice(bad)).toBeNull();
  });
});

describe("duyuru gösterimi", () => {
  const site = { announcement: A, maintenance: false };
  it("süresiz duyuru kapatılana dek görünür; yalnız o kimlik gizlenir", () => {
    expect(shownAnnouncement(site, 1000, null)).toEqual(A);
    expect(shownAnnouncement(site, 1000, 3)).toEqual(A);
    expect(shownAnnouncement(site, 1000, 4)).toBeNull();
  });

  it("yeni duyuru (yeni kimlik) önceden kapatılanı geri getirmez ama kendisi görünür", () => {
    const next = { announcement: { ...A, id: 5 }, maintenance: false };
    expect(shownAnnouncement(next, 1000, 4)?.id).toBe(5);
  });

  it("bitiş anı geçince görünmez", () => {
    const timed = { announcement: { ...A, endsAt: 5000 }, maintenance: false };
    expect(shownAnnouncement(timed, 4999, null)).not.toBeNull();
    expect(shownAnnouncement(timed, 5000, null)).toBeNull();
  });

  it("duyuru yoksa hiçbir şey", () => {
    expect(shownAnnouncement(EMPTY_SITE, 1, null)).toBeNull();
  });
});

describe("kapatılan duyuru kaydı", () => {
  it("yalnız sayı kabul edilir", () => {
    expect(parseDismissed("12")).toBe(12);
    for (const bad of [null, "", "-1", "1.5", "abc", "1e3", "9".repeat(20)])
      expect(parseDismissed(bad)).toBeNull();
  });
});
