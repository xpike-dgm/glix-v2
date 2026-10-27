import { describe, expect, it } from "vitest";
import { pageTitle, settingsCategories, visiblePage } from "./settingsPages.js";

const ids = (loggedIn: boolean, pushVisible: boolean) =>
  settingsCategories({ loggedIn, pushVisible }).map((c) => c.id);

describe("ayarlar kategorileri", () => {
  it("misafir: Hesap yok, Çıkış kategori değil", () => {
    expect(ids(false, true)).toEqual(["oyuncu", "cihaz", "bildirim", "hakkinda"]);
  });
  it("girişli: Hesap Hakkında'dan önce gelir", () => {
    expect(ids(true, true)).toEqual(["oyuncu", "cihaz", "bildirim", "hesap", "hakkinda"]);
  });
  it("bildirim desteklenmiyorsa satır gizlenir", () => {
    expect(ids(true, false)).toEqual(["oyuncu", "cihaz", "hesap", "hakkinda"]);
  });
  it("özet metinleri boş değil ve teknik söz içermez", () => {
    for (const c of settingsCategories({ loggedIn: true, pushVisible: true })) {
      expect(c.summary.length).toBeGreaterThan(0);
      expect(`${c.title} ${c.summary}`).not.toMatch(/debug|protocol|server|stage|push/i);
    }
  });
  it("oyuncu özeti girişliyken takma adı anmaz", () => {
    const [first] = settingsCategories({ loggedIn: true, pushVisible: false });
    expect(first?.summary).toBe("Karakterin");
  });
});

describe("açık sayfa", () => {
  const cats = settingsCategories({ loggedIn: false, pushVisible: false });
  it("kategori kalktıysa ana listeye döner", () => {
    expect(visiblePage("hesap", cats)).toBe("main");
    expect(visiblePage("bildirim", cats)).toBe("main");
    expect(visiblePage("cihaz", cats)).toBe("cihaz");
    expect(visiblePage("main", cats)).toBe("main");
  });
  it("başlık", () => {
    expect(pageTitle("main", cats)).toBe("Ayarlar");
    expect(pageTitle("cihaz", cats)).toBe("Cihaz");
    expect(pageTitle("hesap", cats)).toBe("Ayarlar");
  });
});
