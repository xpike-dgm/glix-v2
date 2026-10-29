import type { AdminAccountDetail } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { playerListPath } from "./api.js";
import {
  defaultDir,
  fmtRemaining,
  groupOwned,
  liveText,
  parseBalanceTarget,
  wornItemId,
} from "./playerRules.js";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("askı kalan süresi", () => {
  it("süresiz, gün/saat, saat/dakika, dakika ve dolmuş", () => {
    const now = 1_000_000;
    expect(fmtRemaining(null, now)).toBe("süresiz");
    expect(fmtRemaining(now + 2 * DAY + 3 * HOUR + 5 * MIN, now)).toBe("2 gün 3 sa kaldı");
    expect(fmtRemaining(now + 7 * DAY, now)).toBe("7 gün kaldı");
    expect(fmtRemaining(now + 5 * HOUR + 10 * MIN, now)).toBe("5 sa 10 dk kaldı");
    expect(fmtRemaining(now + 2 * HOUR, now)).toBe("2 sa kaldı");
    expect(fmtRemaining(now + 45 * MIN + 59_000, now)).toBe("45 dk kaldı");
    expect(fmtRemaining(now + 30_000, now)).toBe("1 dk'dan az kaldı");
    expect(fmtRemaining(now, now)).toBe("süresi doldu");
    expect(fmtRemaining(now - 5, now)).toBe("süresi doldu");
  });
});

describe("canlı durum metni ve sıralama yönü", () => {
  it("çevrimdışı, odasız ve odada rol", () => {
    expect(liveText({ online: false, room: null })).toBe("Çevrimdışı");
    expect(liveText({ online: true, room: null })).toBe("Çevrimiçi");
    expect(liveText({ online: true, room: { code: "ABCD", role: "host", playerId: "a".repeat(12) } })).toBe(
      "Odada: ABCD (Oda sahibi)",
    );
    expect(
      liveText({ online: true, room: { code: "ABCD", role: "spectator", playerId: "a".repeat(12) } }),
    ).toBe("Odada: ABCD (İzleyici)");
  });
  it("ad A'dan Z'ye, diğerleri yeniden eskiye", () => {
    expect(defaultDir("name")).toBe("asc");
    expect(defaultDir("glix")).toBe("desc");
    expect(defaultDir("seen")).toBe("desc");
    expect(defaultDir("created")).toBe("desc");
  });
});

describe("kozmetik gruplama", () => {
  const cosmetics: AdminAccountDetail["cosmetics"] = {
    owned: [
      { itemId: "unvan-sansli", acquiredAt: 1, pricePaid: 100 },
      { itemId: "unvan-efsane", acquiredAt: 2, pricePaid: 0 },
      { itemId: "yok-boyle-urun", acquiredAt: 3, pricePaid: 0 },
    ],
    equipped: { unvan: "unvan-efsane" },
  };
  it("türe göre gruplar, kuşanılanı işaretler, bilinmeyeni Diğer'e koyar", () => {
    const groups = groupOwned(cosmetics);
    expect(groups.map((g) => g.slot)).toEqual(["unvan", "diger"]);
    const unvan = groups[0];
    expect(unvan?.worn).toBe("unvan-efsane");
    expect(unvan?.items.map((i) => [i.itemId, i.equipped])).toEqual([
      ["unvan-sansli", false],
      ["unvan-efsane", true],
    ]);
    expect(groups[1]?.items[0]).toMatchObject({
      itemId: "yok-boyle-urun",
      name: "yok-boyle-urun",
      equipped: false,
    });
  });
  it("renk ekli kuşanma değeri ürün kimliğiyle eşleşir", () => {
    expect(wornItemId("kazak~mavi")).toBe("kazak");
    expect(wornItemId("kazak")).toBe("kazak");
  });
  it("boş liste boş döner", () => {
    expect(groupOwned({ owned: [], equipped: {} })).toEqual([]);
  });
});

describe("bakiye hedefi alanı", () => {
  it("0 ve pozitif tamsayı; işaret, ondalık, taşma ve boş reddedilir", () => {
    expect(parseBalanceTarget("0")).toBe(0);
    expect(parseBalanceTarget(" 250 ")).toBe(250);
    expect(parseBalanceTarget("10000000")).toBe(10_000_000);
    for (const bad of ["", "-1", "+5", "1.5", "10000001", "99999999", "abc", "1e3"])
      expect(parseBalanceTarget(bad), bad).toBeNull();
  });
});

describe("liste adresi", () => {
  it("süzgeç, sıralama, ad ve imleç kodlanır; boş ad ve imleç eklenmez", () => {
    expect(playerListPath({ filter: "all", sort: "seen", dir: "desc", q: " ", after: null })).toBe(
      "accounts/list?filter=all&sort=seen&dir=desc",
    );
    expect(playerListPath({ filter: "online", sort: "name", dir: "asc", q: "Ali_1", after: "abc-_9" })).toBe(
      "accounts/list?filter=online&sort=name&dir=asc&q=Ali_1&after=abc-_9",
    );
  });
});
