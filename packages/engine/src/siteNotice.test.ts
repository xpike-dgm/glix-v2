import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_MAX,
  cleanAnnouncementText,
  cleanPlainText,
  cleanSitePath,
  isAnnouncementKind,
} from "./siteNotice.js";

describe("duyuru metni", () => {
  it("kırpar, boşlukları tek boşluğa indirir, kod noktasıyla sayar", () => {
    expect(cleanAnnouncementText("  Merhaba   dünya ")).toBe("Merhaba dünya");
    expect(cleanAnnouncementText("😀".repeat(ANNOUNCEMENT_MAX))).not.toBeNull();
    expect(cleanAnnouncementText("😀".repeat(ANNOUNCEMENT_MAX + 1))).toBeNull();
  });

  it("boş, HTML, denetim ve biçim karakterini reddeder", () => {
    for (const bad of ["", "   ", "<b>", "a>b", "a\nb", "a\tb", "x‍y", "a‮b", "a b", 5, null, undefined])
      expect(cleanAnnouncementText(bad)).toBeNull();
  });

  it("cleanPlainText sınırı çağıran verir", () => {
    expect(cleanPlainText("x".repeat(40), 40)).toBe("x".repeat(40));
    expect(cleanPlainText("x".repeat(41), 40)).toBeNull();
  });
});

describe("site içi yol", () => {
  it("yalnız tek eğik çizgiyle başlayan güvenli yollar", () => {
    for (const ok of ["/", "/?oda=ABCDE", "/profil", "/a/b?x=1&y=2#z"]) expect(cleanSitePath(ok)).toBe(ok);
    for (const bad of [
      "",
      "profil",
      "//x.example",
      "https://x.example",
      "/a b",
      "/\\x",
      "/a\nb",
      `/${"x".repeat(100)}`,
      5,
      null,
    ])
      expect(cleanSitePath(bad)).toBeNull();
  });
});

describe("duyuru türü", () => {
  it("bilgi ve uyarı", () => {
    expect(isAnnouncementKind("bilgi")).toBe(true);
    expect(isAnnouncementKind("uyari")).toBe(true);
    expect(isAnnouncementKind("uyarı")).toBe(false);
    expect(isAnnouncementKind(1)).toBe(false);
  });
});
