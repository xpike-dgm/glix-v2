import { describe, expect, it } from "vitest";
import type { CardId } from "./catalog.js";
import { type PlayedCard, type ResolveInput, resolveCards } from "./resolve.js";

const P = ["A", "B", "C", "D"];

/** A birinci, B-C ikinci, D son (A=10, B=C=6, D=0). */
function input(over: Partial<ResolveInput> = {}): ResolveInput {
  return {
    participants: P,
    present: P,
    miniScores: { A: 10, B: 6, C: 6, D: 0 },
    awards: { A: 3, B: 1, C: 1, D: 0 },
    plays: [],
    pending: {},
    hands: {},
    seed: 7,
    gameIndex: 0,
    ...over,
  };
}
const play = (playerId: string, cardId: CardId, extra: Partial<PlayedCard> = {}): PlayedCard => ({
  playerId,
  cardId,
  ...extra,
});
const run = (over: Partial<ResolveInput>) => resolveCards(input(over));

describe("temel", () => {
  it("kart yoksa puanlar değişmez ve satır yoktur", () => {
    const out = run({});
    expect(out.awards).toEqual({ A: 3, B: 1, C: 1, D: 0 });
    expect(out.lines).toEqual([]);
  });

  it("aynı girdi aynı çıktıyı verir", () => {
    const over = {
      plays: [play("A", "celme", { target: "B" }), play("B", "kart-cal", { target: "C" })],
      hands: { C: ["kalkan"] as CardId[] },
    };
    expect(run(over)).toEqual(run(over));
  });

  it("girdiyi değiştirmez", () => {
    const i = input({ plays: [play("A", "cift-puan")], pending: { B: ["talihsizlik"] } });
    const copy = JSON.stringify(i);
    resolveCards(i);
    expect(JSON.stringify(i)).toBe(copy);
  });
});

describe("sabit eklemeler", () => {
  it("Takviye +1", () => {
    expect(run({ plays: [play("B", "takviye")] }).awards.B).toBe(2);
  });
  it("Sigorta yalnız sonuncuya +1", () => {
    expect(run({ plays: [play("D", "sigorta")] }).awards.D).toBe(1);
    expect(run({ plays: [play("B", "sigorta")] }).awards.B).toBe(1);
  });
  it("Sigorta: herkes eşitse kimse sonuncu değildir", () => {
    const out = run({ miniScores: { A: 1, B: 1, C: 1, D: 1 }, plays: [play("A", "sigorta")] });
    expect(out.awards.A).toBe(3);
  });
  it("Kendine Güven: birinci +2, değilse −1; eşit birinciler ikisi de +2", () => {
    expect(run({ plays: [play("A", "kendine-guven")] }).awards.A).toBe(5);
    expect(run({ plays: [play("B", "kendine-guven")] }).awards.B).toBe(0);
    const tie = run({
      miniScores: { A: 5, B: 5, C: 0, D: 0 },
      plays: [play("A", "kendine-guven"), play("B", "kendine-guven")],
    });
    expect([tie.awards.A, tie.awards.B]).toEqual([5, 3]);
  });
  it("Tahmin: hedef birinciyse +2, değilse 0; kendine ya da ayrılana oynanamaz", () => {
    expect(run({ plays: [play("B", "tahmin", { target: "A" })] }).awards.B).toBe(3);
    expect(run({ plays: [play("B", "tahmin", { target: "C" })] }).awards.B).toBe(1);
    expect(run({ plays: [play("B", "tahmin", { target: "B" })] }).lines[0]?.note).toBe("etkisiz");
    expect(
      run({ present: ["A", "B", "C"], plays: [play("B", "tahmin", { target: "D" })] }).lines[0]?.note,
    ).toBe("etkisiz");
  });
  it("Kötü kartlar: Talihsizlik −1, Kumarbaz −2, Lanetli Hediye −1", () => {
    const out = run({ pending: { A: ["talihsizlik"], B: ["kumarbaz"], C: ["lanetli-hediye"] } });
    expect([out.awards.A, out.awards.B, out.awards.C]).toEqual([2, -1, 0]);
  });
  it("aynı oyuna birden çok kötü kart bekliyorsa hepsi işler", () => {
    expect(run({ pending: { A: ["talihsizlik", "kumarbaz"] } }).awards.A).toBe(0);
  });
});

describe("çarpanlar", () => {
  it("Çift Puan eksiyi de ikiler", () => {
    expect(run({ plays: [play("A", "cift-puan")] }).awards.A).toBe(6);
    expect(run({ awards: { A: -2, B: 0, C: 0, D: 0 }, plays: [play("A", "cift-puan")] }).awards.A).toBe(-4);
  });
  it("Altın Dokunuş yalnız artıyı üçler", () => {
    expect(run({ plays: [play("A", "altin-dokunus")] }).awards.A).toBe(9);
    expect(run({ awards: { A: -2, B: 0, C: 0, D: 0 }, plays: [play("A", "altin-dokunus")] }).awards.A).toBe(
      -2,
    );
  });
  it("Ağır Yük sıfıra doğru yarılar", () => {
    const f = (n: number) =>
      run({ awards: { A: n, B: 0, C: 0, D: 0 }, pending: { A: ["agir-yuk"] } }).awards.A;
    expect([f(3), f(-3), f(1), f(-1), f(4), f(0)]).toEqual([1, -1, 0, 0, 2, 0]);
  });
  it("çarpanlar sabit eklemelerden önce işler (Çift Puan −1'i ikilemez)", () => {
    const out = run({ plays: [play("A", "cift-puan")], pending: { A: ["talihsizlik"] } });
    expect(out.awards.A).toBe(5);
  });
  it("Ağır Yük, Çift Puan'dan önce yarılar", () => {
    const out = run({ plays: [play("A", "cift-puan")], pending: { A: ["agir-yuk"] } });
    expect(out.awards.A).toBe(2);
  });
  it("etki satırı önceki → sonraki değeri taşır", () => {
    expect(run({ plays: [play("A", "cift-puan")] }).lines).toEqual([
      { cardId: "cift-puan", owner: "A", subject: "A", before: 3, after: 6 },
    ]);
  });
});

describe("Ters Köşe", () => {
  it("sıralamayı tamamen tersine çevirir", () => {
    const out = run({
      miniScores: { A: 9, B: 6, C: 3, D: 0 },
      awards: { A: 3, B: 2, C: 1, D: 0 },
      plays: [play("C", "ters-kose")],
    });
    expect(out.awards).toEqual({ A: 0, B: 1, C: 2, D: 3 });
  });
  it("beraberlik grubu aynadaki toplamı eşit paylaşır; kalan ilk üyelere", () => {
    const even = run({ plays: [play("A", "ters-kose")] });
    expect(even.awards).toEqual({ A: 0, B: 1, C: 1, D: 3 });
    const odd = run({ awards: { A: 3, B: 2, C: 1, D: 0 }, plays: [play("A", "ters-kose")] });
    // B-C grubu: aynadaki sıralar B,C → toplam 3 → 2 ve 1
    expect(odd.awards).toEqual({ A: 0, B: 2, C: 1, D: 3 });
  });
  it("toplam korunur", () => {
    const out = run({ awards: { A: 5, B: -2, C: 3, D: 1 }, plays: [play("A", "ters-kose")] });
    expect(Object.values(out.awards).reduce((a, b) => a + b, 0)).toBe(7);
  });
  it("iki Ters Köşe birbirini götürür (beraberliksiz)", () => {
    const out = run({
      miniScores: { A: 9, B: 6, C: 3, D: 0 },
      awards: { A: 3, B: 2, C: 1, D: 0 },
      plays: [play("C", "ters-kose"), play("D", "ters-kose")],
    });
    expect(out.awards).toEqual({ A: 3, B: 2, C: 1, D: 0 });
  });
  it("Ters Köşe'den sonra çarpan yeni puana işler", () => {
    const out = run({
      miniScores: { A: 9, B: 6, C: 3, D: 0 },
      awards: { A: 3, B: 2, C: 1, D: 0 },
      plays: [play("C", "ters-kose"), play("D", "cift-puan")],
    });
    expect(out.awards.D).toBe(6);
  });
});

describe("Takas ve Ortaklık", () => {
  it("Takas puanları değiştirir", () => {
    const out = run({ plays: [play("D", "takas", { target: "A" })] });
    expect([out.awards.A, out.awards.D]).toEqual([0, 3]);
  });
  it("Takas'tan sonra çarpan yeni puana işler", () => {
    const out = run({ plays: [play("D", "takas", { target: "A" }), play("D", "cift-puan")] });
    expect(out.awards.D).toBe(6);
  });
  it("Ortaklık toplamı eşit böler", () => {
    const out = run({ awards: { A: 4, B: 2, C: 0, D: 0 }, plays: [play("B", "ortaklik", { target: "A" })] });
    expect([out.awards.A, out.awards.B]).toEqual([3, 3]);
  });
  it("tek toplamda tek puan mini puanı yüksek olana gider", () => {
    const out = run({ plays: [play("D", "ortaklik", { target: "A" })] }); // 3 + 0 = 3
    expect([out.awards.A, out.awards.D]).toEqual([2, 1]);
  });
  it("eşit mini puanda tek puan kartı oynayana gider", () => {
    const out = run({ awards: { A: 0, B: 2, C: 1, D: 0 }, plays: [play("C", "ortaklik", { target: "B" })] });
    expect([out.awards.B, out.awards.C]).toEqual([1, 2]);
  });
  it("eksi toplam: iyi oynayan daha az kaybeder, toplam korunur", () => {
    const out = run({
      awards: { A: -2, B: -1, C: 0, D: 0 },
      plays: [play("B", "ortaklik", { target: "A" })],
    });
    expect([out.awards.A, out.awards.B]).toEqual([-1, -2]);
  });
  it("hedef ayrıldıysa etkisiz", () => {
    const out = run({ present: ["A", "B", "C"], plays: [play("B", "takas", { target: "D" })] });
    expect(out.awards).toEqual({ A: 3, B: 1, C: 1, D: 0 });
    expect(out.lines).toEqual([
      { cardId: "takas", owner: "B", subject: "B", before: 1, after: 1, note: "etkisiz" },
    ]);
  });
});

describe("saldırılar", () => {
  it("Çelme hedefi −1 yapar", () => {
    const out = run({ plays: [play("D", "celme", { target: "A" })] });
    expect(out.awards.A).toBe(2);
  });
  it("Vergi yalnız hedef artı puan aldıysa 1 puan geçirir", () => {
    const out = run({ plays: [play("D", "vergi", { target: "A" })] });
    expect([out.awards.A, out.awards.D]).toEqual([2, 1]);
    const none = run({ plays: [play("A", "vergi", { target: "D" })] });
    expect([none.awards.A, none.awards.D]).toEqual([3, 0]);
  });
  it("Lanet artı puanı sıfırlar, eksiye dokunmaz", () => {
    expect(run({ plays: [play("D", "lanet", { target: "A" })] }).awards.A).toBe(0);
    expect(
      run({ awards: { A: -2, B: 0, C: 0, D: 0 }, plays: [play("D", "lanet", { target: "A" })] }).awards.A,
    ).toBe(-2);
  });
  it("Hırsız birinciden 1 puan alır (eksiye de düşürebilir)", () => {
    const out = run({ awards: { A: 0, B: 1, C: 1, D: 0 }, plays: [play("D", "hirsiz")] });
    expect([out.awards.A, out.awards.D]).toEqual([-1, 1]);
  });
  it("Hırsız: birinci birden çoksa ödülü en yüksek olandan, sahibi dışında", () => {
    const out = run({
      miniScores: { A: 5, B: 5, C: 0, D: 0 },
      awards: { A: 1, B: 2, C: 0, D: 0 },
      plays: [play("C", "hirsiz")],
    });
    expect([out.awards.A, out.awards.B, out.awards.C]).toEqual([1, 1, 1]);
    const owner = run({ plays: [play("A", "hirsiz")] });
    expect(owner.lines[0]?.note).toBe("etkisiz");
    expect(owner.awards.A).toBe(3);
  });
  it("Hırsız: sahibi de birincilerdense diğer birinciden alır", () => {
    const out = run({
      miniScores: { A: 5, B: 5, C: 0, D: 0 },
      awards: { A: 1, B: 2, C: 0, D: 0 },
      plays: [play("A", "hirsiz")],
    });
    expect([out.awards.A, out.awards.B]).toEqual([2, 1]);
  });
  it("Kart Çal hedefin rastgele kartını sahibine verir (deterministik)", () => {
    const i = {
      plays: [play("A", "kart-cal", { target: "B" })],
      hands: { A: [] as CardId[], B: ["kalkan", "takas"] as CardId[] },
    };
    const out = run(i);
    expect(out.hands.A).toHaveLength(1);
    expect(out.hands.B).toHaveLength(1);
    expect([...(out.hands.A ?? []), ...(out.hands.B ?? [])].sort()).toEqual(["kalkan", "takas"]);
    expect(run(i).hands).toEqual(out.hands);
  });
  it("Kart Çal: hedefin eli boşsa etkisiz; sahibin eli doluysa çalınan yanar", () => {
    const empty = run({ plays: [play("A", "kart-cal", { target: "B" })], hands: { B: [] } });
    expect(empty.hands.B).toEqual([]);
    const full = run({
      plays: [play("A", "kart-cal", { target: "B" })],
      hands: { A: ["kalkan", "sigorta"], B: ["takas"] },
    });
    expect(full.hands.A).toHaveLength(2);
    expect(full.hands.B).toEqual([]);
  });
  it("saldırılar oynanma sırasıyla işler (Çelme sonra Vergi)", () => {
    const out = run({ plays: [play("B", "celme", { target: "A" }), play("D", "vergi", { target: "A" })] });
    expect([out.awards.A, out.awards.D]).toEqual([1, 1]);
    const rev = run({ plays: [play("D", "vergi", { target: "A" }), play("B", "celme", { target: "A" })] });
    expect([rev.awards.A, rev.awards.D]).toEqual([1, 1]);
  });
  it("Lanet'ten sonra Vergi alacak puan bulamaz", () => {
    const out = run({ plays: [play("B", "lanet", { target: "A" }), play("D", "vergi", { target: "A" })] });
    expect([out.awards.A, out.awards.D]).toEqual([0, 0]);
  });
});

describe("Koruma, Ayna, Açık Hedef", () => {
  it("Koruma saldırıyı engeller ve açılır", () => {
    const out = run({ plays: [play("B", "koruma", { target: "A" }), play("D", "celme", { target: "A" })] });
    expect(out.awards.A).toBe(3);
    expect(out.revealed.map((r) => r.cardId)).toEqual(["koruma"]);
    expect(out.lines.map((l) => [l.cardId, l.note])).toEqual([
      ["koruma", "korundu"],
      ["celme", "korundu"],
    ]);
  });
  it("kendini koruyabilir; tetiklenmeyen Koruma açılmaz ve satır yazmaz", () => {
    const out = run({ plays: [play("A", "koruma", { target: "A" }), play("D", "celme", { target: "B" })] });
    expect(out.awards).toEqual({ A: 3, B: 0, C: 1, D: 0 });
    expect(out.revealed).toEqual([]);
    expect(out.lines.every((l) => l.cardId !== "koruma")).toBe(true);
  });
  it("Koruma Hırsız'ı da engeller", () => {
    const out = run({ plays: [play("A", "koruma", { target: "A" }), play("D", "hirsiz")] });
    expect([out.awards.A, out.awards.D]).toEqual([3, 0]);
  });
  it("saldırı olmayan kartları engellemez (Takas)", () => {
    const out = run({ plays: [play("A", "koruma", { target: "A" }), play("D", "takas", { target: "A" })] });
    expect([out.awards.A, out.awards.D]).toEqual([0, 3]);
  });
  it("Ayna ilk saldırıyı saldırana çevirir", () => {
    const out = run({ plays: [play("A", "ayna"), play("D", "celme", { target: "A" })] });
    expect([out.awards.A, out.awards.D]).toEqual([3, -1]);
    expect(out.revealed.map((r) => r.cardId)).toEqual(["ayna"]);
    expect(out.lines.find((l) => l.cardId === "celme")?.note).toBe("yansidi");
  });
  it("Ayna yalnız ilk saldırıyı çevirir", () => {
    const out = run({
      plays: [play("A", "ayna"), play("D", "celme", { target: "A" }), play("B", "celme", { target: "A" })],
    });
    expect([out.awards.A, out.awards.D]).toEqual([2, -1]);
  });
  it("Ayna Vergi'yi çevirir: saldıran puanı varsa Ayna sahibine geçer", () => {
    const out = run({
      awards: { A: 0, B: 2, C: 0, D: 0 },
      plays: [play("A", "ayna"), play("B", "vergi", { target: "A" })],
    });
    expect([out.awards.A, out.awards.B]).toEqual([1, 1]);
  });
  it("Ayna Hırsız'ı çevirir: saldıran birinciye 1 puan öder", () => {
    const out = run({ plays: [play("A", "ayna"), play("D", "hirsiz")] });
    expect([out.awards.A, out.awards.D]).toEqual([4, -1]);
  });
  it("Ayna Kart Çal'ı çevirir: saldıranın kartı çalınır", () => {
    const out = run({
      plays: [play("A", "ayna"), play("D", "kart-cal", { target: "A" })],
      hands: { D: ["kalkan"], A: [] },
    });
    expect(out.hands.A).toEqual(["kalkan"]);
    expect(out.hands.D).toEqual([]);
  });
  it("Koruma varsa Ayna tetiklenmez", () => {
    const out = run({
      plays: [play("A", "ayna"), play("B", "koruma", { target: "A" }), play("D", "celme", { target: "A" })],
    });
    expect(out.awards.A).toBe(3);
    expect(out.revealed.map((r) => r.cardId)).toEqual(["koruma"]);
  });
  it("yansıyan saldırı saldıranın Koruması'na takılır", () => {
    const out = run({
      plays: [play("A", "ayna"), play("B", "koruma", { target: "B" }), play("B", "celme", { target: "A" })],
    });
    expect(out.awards).toEqual({ A: 3, B: 1, C: 1, D: 0 });
    expect(out.revealed.map((r) => r.cardId).sort()).toEqual(["ayna", "koruma"]);
  });
  it("Açık Hedef Çelme'yi, Vergi'yi ve Hırsız'ı iki katlar; Lanet'i etkilemez", () => {
    const aim = { A: ["acik-hedef" as CardId] };
    expect(run({ pending: aim, plays: [play("D", "celme", { target: "A" })] }).awards.A).toBe(1);
    const tax = run({ pending: aim, plays: [play("D", "vergi", { target: "A" })] });
    expect([tax.awards.A, tax.awards.D]).toEqual([1, 2]);
    const thief = run({ pending: aim, plays: [play("D", "hirsiz")] });
    expect([thief.awards.A, thief.awards.D]).toEqual([1, 2]);
    expect(run({ pending: aim, plays: [play("D", "lanet", { target: "A" })] }).awards.A).toBe(0);
  });
  it("Vergi iki katı hedefin puanını aşamaz", () => {
    const out = run({
      awards: { A: 1, B: 0, C: 0, D: 0 },
      pending: { A: ["acik-hedef"] },
      plays: [play("D", "vergi", { target: "A" })],
    });
    expect([out.awards.A, out.awards.D]).toEqual([0, 1]);
  });
});

describe("Hayırsever ve Kalkan", () => {
  it("Hayırsever 1 puanı sonuncuya verir", () => {
    const out = run({ pending: { A: ["hayirsever"] } });
    expect([out.awards.A, out.awards.D]).toEqual([2, 1]);
  });
  it("puan almıyorsa, kendisi sonuncuysa ya da sonuncu yoksa etkisiz", () => {
    expect(run({ pending: { D: ["hayirsever"] }, awards: { A: 3, B: 1, C: 1, D: 2 } }).awards.D).toBe(2);
    expect(run({ pending: { B: ["hayirsever"] }, awards: { A: 3, B: 0, C: 1, D: 0 } }).awards.D).toBe(0);
    expect(run({ miniScores: { A: 1, B: 1, C: 1, D: 1 }, pending: { A: ["hayirsever"] } }).awards.A).toBe(3);
  });
  it("birden çok sonuncudan ödülü en düşük olana gider", () => {
    const out = run({
      miniScores: { A: 9, B: 6, C: 0, D: 0 },
      awards: { A: 3, B: 1, C: 1, D: 0 },
      pending: { A: ["hayirsever"] },
    });
    expect([out.awards.C, out.awards.D]).toEqual([1, 1]);
  });
  it("Kalkan eksiyi sıfıra çeker, artıya dokunmaz", () => {
    expect(run({ awards: { A: 0, B: 0, C: 0, D: -3 }, plays: [play("D", "kalkan")] }).awards.D).toBe(0);
    expect(run({ plays: [play("A", "kalkan")] }).awards.A).toBe(3);
  });
  it("Kalkan en sonda: Çelme ve Talihsizlik'ten sonra da korur", () => {
    const out = run({
      awards: { A: 0, B: 0, C: 0, D: 0 },
      pending: { D: ["talihsizlik"] },
      plays: [play("D", "kalkan"), play("A", "celme", { target: "D" })],
    });
    expect(out.awards.D).toBe(0);
  });
  it("Kalkan Hayırsever'den sonra işler (sonuncu Kalkan sahibi)", () => {
    const out = run({
      awards: { A: 3, B: 1, C: 1, D: -1 },
      pending: { A: ["hayirsever"] },
      plays: [play("D", "kalkan")],
    });
    expect(out.awards.D).toBe(0);
  });
});

describe("ayrılan oyuncular", () => {
  it("sahibi ayrılan kart hiçbir şey yapmaz ve satır yazmaz", () => {
    const out = run({ present: ["A", "B", "C"], plays: [play("D", "celme", { target: "A" })] });
    expect(out.awards.A).toBe(3);
    expect(out.lines).toEqual([]);
  });
  it("hedefi ayrılan saldırı etkisiz kalır", () => {
    const out = run({ present: ["A", "B", "C"], plays: [play("A", "celme", { target: "D" })] });
    expect(out.lines[0]?.note).toBe("etkisiz");
  });
  it("ayrılan Hırsız'ın birincisi olamaz", () => {
    const out = run({ present: ["B", "C", "D"], plays: [play("D", "hirsiz")] });
    expect(out.lines[0]?.note).toBe("etkisiz");
  });
});
