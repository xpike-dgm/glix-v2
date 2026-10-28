import { CARD_IDS, CARDS, type CardLine } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  badSentence,
  cardLabel,
  cardsOfRarity,
  describeLine,
  gemCount,
  lineSentence,
  picksLeftText,
  playSentence,
  settingsSummary,
  signed,
  targetPrompt,
  toggleCard,
} from "./cards.js";

const nick = (id: string): string => ({ a: "Elif", b: "Mert" })[id] ?? id;
const line = (over: Partial<CardLine>): CardLine => ({
  cardId: "cift-puan",
  owner: "a",
  subject: "a",
  before: 2,
  after: 4,
  ...over,
});

describe("etki satırı", () => {
  it("kendi puanı: önceki → sonraki", () => {
    expect(describeLine(line({}), nick)).toEqual({
      card: "Çift Puan",
      who: "Elif",
      to: null,
      text: "+2 → +4",
      tone: "up",
    });
  });
  it("eksi değerler gerçek eksi işaretiyle", () => {
    expect(describeLine(line({ before: 1, after: -2 }), nick).text).toBe("+1 → −2");
    expect(describeLine(line({ before: 1, after: -2 }), nick).tone).toBe("down");
  });
  it("başkasına etki: hedef adı ayrı", () => {
    const t = describeLine(line({ cardId: "celme", subject: "b", before: 1, after: 0 }), nick);
    expect(t.to).toBe("Mert");
    expect(t.text).toBe("+1 → 0");
  });
  it("notlar ve değişmeyen puan", () => {
    expect(describeLine(line({ note: "korundu", after: 2 }), nick).text).toBe("korundu");
    expect(describeLine(line({ note: "yansidi" }), nick).text).toBe("yansıdı");
    expect(describeLine(line({ note: "etkisiz", after: 2 }), nick).text).toBe("etkisiz");
    expect(describeLine(line({ after: 2 }), nick).text).toBe("puan değişmedi");
  });
  it("cümle: sahibi → hedef: kart etki", () => {
    expect(lineSentence(line({ cardId: "celme", subject: "b", before: 1, after: 0 }), nick)).toBe(
      "Elif → Mert: Çelme +1 → 0",
    );
    expect(lineSentence(line({}), nick)).toBe("Elif: Çift Puan +2 → +4");
  });
});

describe("açıklamalar", () => {
  const game = (id: string): string => (id === "g" ? "Kör Bomba" : id);
  it("oynanan kart cümleleri", () => {
    expect(playSentence({ playerId: "a", cardId: "takviye" }, nick, game)).toBe("Elif, Takviye oynadı");
    expect(playSentence({ playerId: "a", cardId: "celme", target: "b" }, nick, game)).toBe(
      "Elif, Mert oyuncusuna Çelme oynadı",
    );
    expect(playSentence({ playerId: "a", cardId: "veto", gameId: "g" }, nick, game)).toBe(
      "Elif, Kör Bomba oyununu listeden çıkardı",
    );
    expect(playSentence({ playerId: "a", cardId: "oyunu-sec", gameId: "g" }, nick, game)).toBe(
      "Elif, sıradaki oyunu seçti: Kör Bomba",
    );
    expect(playSentence({ playerId: "a", cardId: "veto", gameId: "g", void: true }, nick, game)).toBe(
      "Elif: Veto (etkisiz)",
    );
  });
  it("kötü kart duyurusu", () => {
    expect(badSentence("Elif", "talihsizlik")).toBe("Elif kötü kart çekti: Talihsizlik");
  });
  it("her kartın ekran okuyucu etiketi adı ve metni içerir", () => {
    for (const id of CARD_IDS) {
      expect(cardLabel(id)).toContain(CARDS[id].name);
      expect(cardLabel(id)).toContain(CARDS[id].text);
    }
    expect(cardLabel("celme")).toContain("saldırı");
  });
  it("elmas sayısı nadirliğe göre; kötü kartta 0 (kırık elmas)", () => {
    expect([gemCount("kalkan"), gemCount("takas"), gemCount("ters-kose"), gemCount("talihsizlik")]).toEqual([
      1, 2, 3, 0,
    ]);
  });
  it("hedef yönergesi yalnız hedefli kartlarda", () => {
    expect(targetPrompt("takviye")).toBeNull();
    expect(targetPrompt("celme")).toBe("Kimi seçiyorsun?");
    expect(targetPrompt("koruma")).toBe("Kimi koruyacaksın?");
    expect(targetPrompt("veto")).toBe("Hangi oyun listeden çıksın?");
    expect(targetPrompt("oyunu-sec")).toBe("Sıradaki oyun hangisi olsun?");
  });
  it("işaretli puan", () => {
    expect([signed(3), signed(0), signed(-2)]).toEqual(["+3", "0", "−2"]);
  });
});

describe("kart ayarı yardımcıları", () => {
  it("özet", () => {
    expect(settingsSummary(undefined)).toBe("Hepsi açık");
    expect(settingsSummary({ enabled: false, off: [] })).toBe("Kapalı");
    expect(settingsSummary({ enabled: true, off: ["kalkan"] })).toBe(
      `${CARD_IDS.length - 1} / ${CARD_IDS.length} kart açık`,
    );
    expect(settingsSummary({ enabled: true, off: [...CARD_IDS] })).toBe("Kapalı");
  });
  it("toggleCard katalog sırasında, tekrarsız", () => {
    const a = toggleCard({ enabled: true, off: [] }, "ayna");
    const b = toggleCard(a, "kalkan");
    expect(b.off).toEqual(["kalkan", "ayna"]);
    expect(toggleCard(b, "kalkan").off).toEqual(["ayna"]);
  });
  it("nadirlik grupları tüm kartları kapsar", () => {
    const all = [
      ...cardsOfRarity("siradan"),
      ...cardsOfRarity("nadir"),
      ...cardsOfRarity("efsanevi"),
      ...cardsOfRarity("kotu"),
    ];
    expect([...all].sort()).toEqual([...CARD_IDS].sort());
  });
  it("seçim hakkı metni", () => {
    expect(picksLeftText(1, 0)).toBe("Bir kart seç");
    expect(picksLeftText(2, 0)).toBe("2 kart seç");
    expect(picksLeftText(2, 1)).toBe("1 kart daha seç");
  });
});
