import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  gizliKareler as g,
  type KarelerState,
  kareCompass,
  karelerPhase,
  kareSettle,
  kareSettle2,
} from "./index.js";
import {
  hintAllows,
  hintCells,
  KARELER_BAND_MS,
  KARELER_BETWEEN_MS,
  KARELER_DURATION_MS,
  KARELER_FINAL_MS,
  KARELER_REVEAL1_MS,
  KARELER_STAGE_MS,
  kareCells,
  kareHintPool,
  kareHintsFor,
  kareSize,
} from "./types.js";

const T0 = 1_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const ctx = (now: number, connected: readonly string[] = ids(8)) => ({ now, rng: createRng(1), connected });
/** Eski testler ödül karesinden bağımsız: ödül karesi ızgara dışına (-1) çekilir. Ödül testleri `withBonus` kullanır. */
const start = (n = 4): KarelerState => ({ ...g.setup(ids(n), ctx(T0)), bonusCell: -1 });
const withBonus = (s: KarelerState, cell: number): KarelerState => ({ ...s, bonusCell: cell });
const S1 = KARELER_STAGE_MS;
const S2_START = S1 + KARELER_BETWEEN_MS;
const S2_END = S2_START + KARELER_STAGE_MS;

function pick(state: KarelerState, id: string, cell: number, at: number): KarelerState {
  const r = g.reduce(state, id, { kind: "pick", cell }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const tryPick = (state: KarelerState, id: string, cell: number, at: number) =>
  g.reduce(state, id, { kind: "pick", cell }, ctx(T0 + at));
const pub = (s: KarelerState, at: number) => g.publicView(s, ctx(T0 + at));
const priv = (s: KarelerState, id: string | null, at: number) => g.view(s, id, ctx(T0 + at));

/** Birinci aşama seçimleri: `cells[i]` null ise oyuncu seçmez. */
function stage1(cells: (number | null)[]): KarelerState {
  let s = start(cells.length);
  cells.forEach((c, i) => {
    if (c !== null) s = pick(s, `p${i + 1}`, c, 1_000 + i);
  });
  return s;
}
/** İkinci aşama seçimleri (oyuncu kimliğine göre). */
function stage2(s: KarelerState, picks: Record<string, number>): KarelerState {
  let out = s;
  for (const [id, c] of Object.entries(picks)) out = pick(out, id, c, S2_START + 500);
  return out;
}
const final = (s: KarelerState) => g.result(s);
/** Bağlantı değişimi (GK-M2: 1. aşama kapanırken bağlı hayalet var mı). */
function presence(s: KarelerState, connected: readonly string[], at: number): KarelerState {
  const fn = g.onPresence;
  if (!fn) throw new Error("onPresence yok");
  return fn(g.tick(s, ctx(T0 + at, connected)), ctx(T0 + at, connected));
}
/** Verilen oyuncular 1. aşama bitmeden kopar. */
const drop = (s: KarelerState, gone: readonly string[]): KarelerState =>
  presence(
    s,
    s.players.filter((id) => !gone.includes(id)),
    S1 - 500,
  );

describe("gizli-kareler kuralları", () => {
  it("katılım 2–8, dikey, anlatım ≤ 3 madde ve teknik kelime yok", () => {
    expect([g.minPlayers, g.maxPlayers, g.orientation]).toEqual([2, 8, "portrait"]);
    expect(g.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(g.briefing)).not.toMatch(/mayın|server|protocol|debug|stage/i);
  });

  it("alan: 2–4 oyuncu 3×3, 5–8 oyuncu 4×4", () => {
    expect([2, 3, 4].map(kareSize)).toEqual([3, 3, 3]);
    expect([5, 6, 7, 8].map(kareSize)).toEqual([4, 4, 4, 4]);
    expect([kareCells(3), kareCells(4)]).toEqual([9, 16]);
    for (const n of [2, 3, 4]) expect(pub(start(n), 0).size).toBe(3);
    for (const n of [5, 8]) expect(pub(start(n), 0).size).toBe(4);
  });

  it("hücre numarası ızgara içinde olmalı: 3×3'te 9 reddedilir, 4×4'te 15 kabul", () => {
    const a = start(3);
    expect(tryPick(a, "p1", 8, 100)).not.toHaveProperty("rejected");
    expect(tryPick(a, "p1", 9, 100)).toEqual({ rejected: "out_of_range" });
    const b = start(6);
    expect(tryPick(b, "p1", 15, 100)).not.toHaveProperty("rejected");
    expect(tryPick(b, "p1", 16, 100)).toEqual({ rejected: "out_of_range" });
  });

  it("parseAction yalnız { kind: pick, cell: 0..15 tam sayı } kabul eder", () => {
    expect(g.parseAction({ kind: "pick", cell: 0 })).toEqual({ kind: "pick", cell: 0 });
    expect(g.parseAction({ kind: "pick", cell: 15 })).toEqual({ kind: "pick", cell: 15 });
    for (const bad of [-1, 16, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "3", null, undefined, [3]]) {
      expect(g.parseAction({ kind: "pick", cell: bad })).toBeNull();
    }
    expect(g.parseAction({ kind: "pick", cell: 3, extra: 1 })).toBeNull();
    expect(g.parseAction({ kind: "choose", cell: 3 })).toBeNull();
    expect(g.parseAction({ kind: "pick" })).toBeNull();
  });

  it("iki aşama, her biri 20 sn; aralarında 6 sn (5 sn açılış + 1 sn bant); son sonuç 8 sn", () => {
    expect([KARELER_STAGE_MS, KARELER_BETWEEN_MS, KARELER_FINAL_MS]).toEqual([20_000, 6_000, 8_000]);
    expect([KARELER_REVEAL1_MS, KARELER_BAND_MS]).toEqual([5_000, 1_000]);
    const s = stage1([0, 1, 2, 3]);
    expect(s.stage1EndsAt - s.startedAt).toBe(20_000);
    const p = pub(s, S1);
    expect(p.stage2).toEqual({
      startsAt: T0 + S2_START,
      endsAt: T0 + S2_END,
      players: ["p1", "p2", "p3", "p4"],
      ghosts: [],
    });
    expect(p.finishesAt).toBe(T0 + KARELER_DURATION_MS);
    expect(KARELER_DURATION_MS).toBe(54_000);
    const at = (t: number) => karelerPhase(s, T0 + t);
    expect([at(0), at(S1 - 1), at(S1), at(S2_START - 1), at(S2_START), at(S2_END - 1), at(S2_END)]).toEqual([
      0, 0, 1, 1, 2, 2, 3,
    ]);
    expect(g.isFinished(s, ctx(T0 + KARELER_DURATION_MS - 1))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + KARELER_DURATION_MS))).toBe(true);
  });

  it("seçim süre bitene kadar değiştirilebilir: son seçim geçerli", () => {
    let s = start(3);
    s = pick(s, "p1", 4, 1_000);
    s = pick(s, "p1", 5, 19_999);
    s = pick(s, "p2", 4, 2_000);
    expect(priv(s, "p1", 19_999).myChoice).toBe(5);
    expect(pub(s, S1).stage1?.choices).toEqual({ p1: 5, p2: 4, p3: null });
    // Aynı seçimi tekrarlamak durumu değiştirmez.
    expect(pick(s, "p2", 4, 3_000)).toBe(s);
  });

  it("aşama sonunda tek kalan hücredekiler +1, çakışanlar elenir, seçmeyen pasif", () => {
    // p1+p2 aynı kare, p3 ve p4 tek, p5 seçmedi.
    const s = stage1([2, 2, 5, 6, null]);
    const r = pub(s, S1).stage1;
    expect(r?.status).toEqual({ p1: "clash", p2: "clash", p3: "solo", p4: "solo", p5: "passive" });
    expect(r?.choices).toEqual({ p1: 2, p2: 2, p3: 5, p4: 6, p5: null });
    expect(pub(s, S1).points).toEqual({ p1: 0, p2: 0, p3: 1, p4: 1, p5: 0 });
  });

  it("üç kişi aynı karede: üçü de elenir; birden çok çakışma grubu birbirinden bağımsızdır", () => {
    const s = stage1([1, 1, 1, 7, 7, 3]);
    expect(pub(s, S1).stage1?.status).toEqual({
      p1: "clash",
      p2: "clash",
      p3: "clash",
      p4: "clash",
      p5: "clash",
      p6: "solo",
    });
  });

  it("seçmeyen pasif kare çakışmasına katılmaz: boş bırakmak kimseyi çakıştırmaz", () => {
    expect(kareSettle(["a", "b", "c"], { a: 4, c: 4 }).status).toEqual({
      a: "clash",
      b: "passive",
      c: "clash",
    });
    expect(kareSettle(["a", "b"], {}).status).toEqual({ a: "passive", b: "passive" });
  });

  it("2. aşamada yalnız 1. aşamada tek kalanlar yarışır; çakışan ve pasifler hayalet olur (GK-M2)", () => {
    let s = stage1([0, 0, 1, 2, null]);
    expect(pub(s, S1).stage2?.players).toEqual(["p3", "p4"]);
    expect(pub(s, S1).stage2?.ghosts).toEqual(["p1", "p2", "p5"]);
    // Hayaletler de gizlice seçer; katılımcı olmayan seçemez.
    s = pick(s, "p1", 3, S2_START + 100);
    s = pick(s, "p5", 3, S2_START + 100);
    expect(tryPick(s, "nobody", 3, S2_START + 100)).toEqual({ rejected: "not_participant" });
    s = pick(s, "p3", 6, S2_START + 100);
    expect(priv(s, "p3", S2_START + 100).myChoice).toBe(6);
    expect(priv(s, "p1", S2_START + 100).myChoice).toBe(3);
    expect(priv(s, "p2", S2_START + 100).myChoice).toBeNull();
  });

  it("2. aşamada tek kalanlar bir +1 daha alır (toplam 2); çakışanlar 1. aşama puanını korur", () => {
    let s = stage1([0, 1, 2, 3]);
    s = stage2(s, { p1: 5, p2: 5, p3: 6, p4: 7 });
    const r = final(s);
    expect(r.awards).toEqual({ p1: 1, p2: 1, p3: 2, p4: 2 });
    expect(r.miniScores).toEqual(r.awards);
    expect(pub(s, S2_END).stage2Reveal?.status).toEqual({ p1: "clash", p2: "clash", p3: "solo", p4: "solo" });
  });

  it("2. aşamada seçim yapmayan pasif: puan almaz, çakışmaya girmez", () => {
    let s = stage1([0, 1, 2, 3]);
    s = stage2(s, { p1: 5, p2: 5, p3: 5 }); // p4 seçmedi; p3 ile p1+p2 çakışır
    const rev = pub(s, S2_END).stage2Reveal;
    expect(rev?.status).toEqual({ p1: "clash", p2: "clash", p3: "clash", p4: "passive" });
    expect(final(s).awards).toEqual({ p1: 1, p2: 1, p3: 1, p4: 1 });
    // Hiçbiri seçmezse yalnız 1. aşama puanları kalır.
    expect(final(stage1([0, 1, 2, 3])).awards).toEqual({ p1: 1, p2: 1, p3: 1, p4: 1 });
  });

  it("2. aşama seçimi süre bitene kadar değiştirilebilir", () => {
    let s = stage1([0, 1, 2]);
    s = pick(s, "p1", 4, S2_START + 10);
    s = pick(s, "p1", 8, S2_END - 1);
    s = pick(s, "p2", 4, S2_START + 20);
    expect(priv(s, "p1", S2_END - 1).myChoice).toBe(8);
    expect(final(s).awards).toEqual({ p1: 2, p2: 2, p3: 1 });
  });

  it("1. aşamada herkes aynı kareyi seçtiyse oyun biter, kimse puan almaz", () => {
    const s = stage1([4, 4, 4, 4]);
    const p = pub(s, S1);
    expect(p.stage2).toBeNull();
    expect(p.walkover).toBeNull();
    expect(p.finishesAt).toBe(T0 + S1 + KARELER_FINAL_MS);
    expect(final(s).awards).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 });
    expect(g.isFinished(s, ctx(T0 + S1 + KARELER_FINAL_MS - 1))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + S1 + KARELER_FINAL_MS))).toBe(true);
    // Sonradan hiçbir seçim kabul edilmez (2. aşama hiç başlamaz).
    expect(tryPick(s, "p1", 1, S2_START + 10)).toEqual({ rejected: "closed" });
    expect(tryPick(s, "p1", 1, S1 + KARELER_FINAL_MS)).toEqual({ rejected: "ended" });
  });

  it("1. aşamada hiç canlı kalmazsa (çift çakışmalar, pasifler) oyun puansız biter", () => {
    const s = stage1([0, 0, 1, 1, null, null]);
    expect(pub(s, S1).stage2).toBeNull();
    expect(pub(s, S1).walkover).toBeNull();
    expect(final(s).awards).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 });
    // Kimse hiç seçmezse de aynı.
    expect(final(start(3)).awards).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(g.isFinished(start(3), ctx(T0 + S1 + KARELER_FINAL_MS))).toBe(true);
  });

  it("1. aşamadan sonra tek canlı kalan, bağlı hayalet yoksa rakipsiz sayılır: otomatik +1 (toplam 2) ve oyun biter", () => {
    const s = drop(stage1([3, 3, 5, 3]), ["p1", "p2", "p4"]);
    const p = pub(s, S1);
    expect(p.walkover).toBe("p3");
    expect(p.stage2).toBeNull();
    expect(p.points).toEqual({ p1: 0, p2: 0, p3: 2, p4: 0 });
    expect(p.finishesAt).toBe(T0 + S1 + KARELER_FINAL_MS);
    expect(final(s).awards).toEqual({ p1: 0, p2: 0, p3: 2, p4: 0 });
    expect(tryPick(s, "p3", 1, S2_START + 10)).toEqual({ rejected: "closed" });
    expect(tryPick(s, "p3", 1, S1 + KARELER_FINAL_MS)).toEqual({ rejected: "ended" });
  });

  it("iki oyuncuda: biri seçmeyip koptuysa diğeri rakipsiz kalır; farklı kareler iki aşamada da +1", () => {
    expect(final(drop(stage1([4, null]), ["p2"])).awards).toEqual({ p1: 2, p2: 0 });
    // Seçmeyen bağlıysa hayalet olur: 2. aşama oynanır, p1 seçmezse yalnız 1. aşama puanı kalır.
    expect(final(stage1([4, null])).awards).toEqual({ p1: 1, p2: 0 });
    expect(final(stage2(stage1([4, null]), { p1: 2, p2: 3 })).awards).toEqual({ p1: 2, p2: 0 });
    expect(final(stage2(stage1([4, 0]), { p1: 1, p2: 2 })).awards).toEqual({ p1: 2, p2: 2 });
    expect(final(stage1([4, 4])).awards).toEqual({ p1: 0, p2: 0 });
  });

  it("5–8 oyuncuda 4×4: sekiz kişi farklı kareleri seçince hepsi ikinci aşamaya geçer", () => {
    const s = stage1([0, 3, 6, 9, 12, 15, 1, 14]);
    expect(pub(s, S1).stage2?.players).toHaveLength(8);
    expect(final(s).awards).toEqual(Object.fromEntries(ids(8).map((id) => [id, 1])));
  });

  it("aşama aralarında (açılış penceresinde) ve oyun bitince eylem reddedilir", () => {
    const s = stage1([0, 1, 2]);
    expect(tryPick(s, "p1", 4, S1)).toEqual({ rejected: "closed" });
    expect(tryPick(s, "p1", 4, S2_START - 1)).toEqual({ rejected: "closed" });
    expect(tryPick(s, "p1", 4, S2_END)).toEqual({ rejected: "closed" });
    expect(tryPick(s, "p1", 4, KARELER_DURATION_MS)).toEqual({ rejected: "ended" });
    expect(tryPick(s, "p1", 4, KARELER_DURATION_MS + 9_999)).toEqual({ rejected: "ended" });
    // 1. aşama bitince 1. aşama seçimi değişmez.
    expect(tryPick(start(3), "p1", 4, S1)).toEqual({ rejected: "closed" });
  });

  it("katılımcı olmayan reddedilir", () => {
    expect(tryPick(start(3), "ghost", 1, 100)).toEqual({ rejected: "not_participant" });
  });

  it("bağlantısı kopan oyuncu seçmediyse pasif sayılır (bağlantı listesi sonucu etkilemez)", () => {
    const s = pick(pick(start(3), "p1", 1, 1_000), "p2", 2, 2_000);
    // p3 hiç bağlı değil ve seçmedi.
    const withConn = g.publicView(s, ctx(T0 + S1, ["p1"]));
    const noConn = g.publicView(s, ctx(T0 + S1, []));
    expect(withConn).toEqual(noConn);
    expect(withConn.stage1?.status).toEqual({ p1: "solo", p2: "solo", p3: "passive" });
  });

  it("tick aşama geçişlerinde durumu değiştirir, arada aynı nesneyi döner", () => {
    const s = stage1([0, 1, 2]);
    const t = (state: KarelerState, at: number) => g.tick(state, ctx(T0 + at));
    expect(t(s, 5_000)).toBe(s);
    const a = t(s, S1);
    expect(a).not.toBe(s);
    expect(t(a, S1 + 100)).toBe(a);
    const b = t(a, S2_START);
    expect(b).not.toBe(a);
    const c = t(b, S2_END);
    expect(c).not.toBe(b);
    const d = t(c, KARELER_DURATION_MS);
    expect(d).not.toBe(c);
    expect(t(d, KARELER_DURATION_MS + 1)).toBe(d);
    // Oyun 1. aşamada bitiyorsa da bitiş anında durum değişir.
    const e = stage1([1, 1, 1]);
    expect(t(t(e, S1), S1 + KARELER_FINAL_MS)).not.toBe(t(e, S1));
  });

  it("sonuç tick'e bağlı değildir", () => {
    const s = stage2(stage1([0, 1, 2, 3]), { p1: 5, p2: 6, p3: 7, p4: 7 });
    let ticked = s;
    for (const t of [S1, S2_START, S2_END, KARELER_DURATION_MS]) ticked = g.tick(ticked, ctx(T0 + t));
    expect(final(ticked)).toEqual(final(s));
  });
});

describe("gizli-kareler gizlilik", () => {
  const cellsOf = (json: string) => json;

  it("1. aşama bitmeden hiçbir görünümde seçim, durum ya da puan yoktur", () => {
    const s = stage1([2, 2, 5, 7]);
    const p = pub(s, S1 - 1);
    expect(p.stage1).toBeNull();
    expect(p.stage2).toBeNull();
    expect(p.stage2Reveal).toBeNull();
    expect(p.points).toBeNull();
    expect(p.walkover).toBeNull();
    expect(p.finishesAt).toBeNull();
    expect(Object.keys(p).sort()).toEqual(
      [
        "endsAt",
        "ready",
        "finishesAt",
        "points",
        "size",
        "stage1",
        "stage2",
        "stage2Reveal",
        "startedAt",
        "walkover",
        "bonus",
      ].sort(),
    );
    const raw = cellsOf(JSON.stringify(p));
    expect(raw).not.toContain("choices");
    expect(raw).not.toContain("status");
    // Her oyuncu yalnız kendi seçimini görür; izleyici hiçbir şey görmez.
    expect(priv(s, "p1", S1 - 1)).toEqual({ myChoice: 2, locked: false, compass: null });
    expect(priv(s, "p3", S1 - 1)).toEqual({ myChoice: 5, locked: false, compass: null });
    expect(priv(s, "p4", S1 - 1)).toEqual({ myChoice: 7, locked: false, compass: null });
    expect(priv(s, null, S1 - 1)).toEqual({ myChoice: null, locked: false, compass: null });
    for (const id of ids(4)) {
      expect(Object.keys(priv(s, id, S1 - 1))).toEqual(["myChoice", "locked", "compass"]);
    }
    expect(p.bonus).toBeNull();
  });

  it("2. aşama bitmeden 2. aşama seçimleri hiçbir ortak görünümde yoktur; başkasının seçimi başkasına gitmez", () => {
    let s = stage1([0, 1, 2, 3]);
    s = stage2(s, { p1: 5, p2: 6, p3: 7, p4: 8 });
    for (const at of [S2_START, S2_START + 5_000, S2_END - 1]) {
      const p = pub(s, at);
      expect(p.stage2Reveal).toBeNull();
      expect(JSON.stringify(p)).not.toContain('"5"');
      expect(p.points).toEqual({ p1: 1, p2: 1, p3: 1, p4: 1 });
      expect(priv(s, "p1", at).myChoice).toBe(5);
      expect(priv(s, "p2", at).myChoice).toBe(6);
      expect(priv(s, null, at).myChoice).toBeNull();
    }
    // Hayalet 2. aşamada başkasının seçimini görmez; pusulası da yoktur.
    const s2 = stage1([0, 0, 2, 3]);
    const s3 = stage2(s2, { p3: 5, p4: 6 });
    expect(priv(s3, "p1", S2_START + 100)).toEqual({ myChoice: null, locked: false, compass: null });
    expect(pub(s3, S2_START + 100).stage2Reveal).toBeNull();
  });

  it("1. aşama açıldıktan sonra 1. aşama seçimleri ortaktır; 2. aşama bitince 2. aşama açılır", () => {
    const s = stage2(stage1([0, 1, 2, 3]), { p1: 5, p2: 5, p3: 6, p4: 7 });
    expect(pub(s, S1).stage1?.choices).toEqual({ p1: 0, p2: 1, p3: 2, p4: 3 });
    expect(pub(s, S2_END - 1).stage2Reveal).toBeNull();
    expect(pub(s, S2_END).stage2Reveal?.choices).toEqual({ p1: 5, p2: 5, p3: 6, p4: 7 });
    expect(pub(s, S2_END).points).toEqual({ p1: 1, p2: 1, p3: 2, p4: 2 });
  });

  it("oyun bitişinde sonuç ile ortak puanlar aynıdır", () => {
    const s = stage2(stage1([0, 1, 2, 3, 4]), { p1: 5, p2: 5, p3: 6 });
    expect(pub(s, KARELER_DURATION_MS).points).toEqual(final(s).awards);
    const w = stage1([3, 3, 5]);
    expect(pub(w, KARELER_DURATION_MS).points).toEqual(final(w).awards);
  });
});

describe("gizli-kareler erken bitiş (Tamam)", () => {
  const lockAt = (s: KarelerState, id: string, at: number, connected: readonly string[] = ids(8)) =>
    g.reduce(s, id, { kind: "lock" }, ctx(T0 + at, connected));
  const lock = (s: KarelerState, id: string, at: number, connected?: readonly string[]): KarelerState => {
    const r = lockAt(s, id, at, connected);
    if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
    return r;
  };
  /** Dört oyuncu: p1 ve p2 farklı, p3 ve p4 çakışır. */
  const picked = () => stage1([0, 1, 2, 2]);

  it("parseAction lock kabul eder, fazladan alanı reddeder", () => {
    expect(g.parseAction({ kind: "lock" })).toEqual({ kind: "lock" });
    expect(g.parseAction({ kind: "lock", cell: 1 })).toBeNull();
  });

  it("(a) herkes kilitleyince 1. aşama 1 sn sonra biter", () => {
    let s = picked();
    for (const id of ids(4)) s = lock(s, id, 3_000);
    expect(pub(s, 3_500).endsAt).toBe(T0 + 4_000);
    expect(karelerPhase(s, T0 + 3_999)).toBe(0);
    expect(karelerPhase(s, T0 + 4_000)).toBe(1);
    expect(pub(s, 3_999).stage1).toBeNull();
    expect(pub(s, 4_000).stage1?.status.p1).toBe("solo");
    // 2. aşama erken sonuca göre kayar.
    expect(pub(s, 4_000).stage2?.startsAt).toBe(T0 + 4_000 + KARELER_BETWEEN_MS);
    expect(g.isFinished(s, ctx(T0 + 4_000))).toBe(false);
  });

  it("(a) 2. aşamada da herkes kilitleyince 1 sn sonra biter ve oyun erken sonlanır", () => {
    let s = picked();
    for (const id of ids(4)) s = lock(s, id, 3_000);
    const start2 = 4_000 + KARELER_BETWEEN_MS;
    s = pick(s, "p1", 5, start2 + 100);
    s = pick(s, "p2", 6, start2 + 100);
    s = lock(s, "p1", start2 + 200);
    // Hayaletler (p3, p4) seçmeden kilitleyemez; bağlı hayaletler de Tamam demeden aşama bitmez.
    expect(lockAt(s, "p3", start2 + 200)).toEqual({ rejected: "nothing_to_lock" });
    s = lock(s, "p2", start2 + 300);
    expect(pub(s, start2 + 400).stage2?.endsAt).toBe(T0 + start2 + KARELER_STAGE_MS);
    s = pick(s, "p3", 7, start2 + 300);
    s = pick(s, "p4", 8, start2 + 300);
    s = lock(s, "p3", start2 + 300);
    s = lock(s, "p4", start2 + 300);
    expect(pub(s, start2 + 400).stage2?.endsAt).toBe(T0 + start2 + 1_300);
    expect(g.isFinished(s, ctx(T0 + start2 + 1_300 + KARELER_FINAL_MS - 1))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + start2 + 1_300 + KARELER_FINAL_MS))).toBe(true);
    expect(final(s).miniScores).toEqual({ p1: 2, p2: 2, p3: 0, p4: 0 });
  });

  it("(b) bir kişi eksikken aşama bitmez", () => {
    let s = picked();
    for (const id of ["p1", "p2", "p3"]) s = lock(s, id, 3_000);
    expect(pub(s, 3_000).endsAt).toBe(T0 + S1);
    expect(karelerPhase(s, T0 + 10_000)).toBe(0);
  });

  it("(c) bağlantısı kopan oyuncu beklenmez", () => {
    let s = picked();
    const conn = ["p1", "p2", "p3"];
    for (const id of conn) s = lock(s, id, 3_000, conn);
    expect(pub(s, 3_000).endsAt).toBe(T0 + 4_000);
    // Hiç bağlı katılımcı yoksa kilit bitirmez.
    const t = lock(picked(), "p1", 3_000, []);
    expect(pub(t, 3_000).endsAt).toBe(T0 + S1);
  });

  it("(d) kilitten sonra değişiklik ve ikinci kilit reddedilir; seçimsiz kilit olmaz", () => {
    let s = picked();
    s = lock(s, "p1", 3_000);
    expect(tryPick(s, "p1", 7, 3_100)).toEqual({ rejected: "locked" });
    expect(lockAt(s, "p1", 3_100)).toEqual({ rejected: "locked" });
    expect(lockAt(start(4), "p1", 100)).toEqual({ rejected: "nothing_to_lock" });
    // Herkes kilitledikten sonraki 1 sn içinde yeni eylem kapalıdır.
    let t = stage1([0, 1, 2, null]);
    for (const id of ["p1", "p2", "p3"]) t = lock(t, id, 3_000, ["p1", "p2", "p3"]);
    expect(tryPick(t, "p4", 3, 3_500)).toEqual({ rejected: "closed" });
    expect(tryPick(t, "p4", 3, 4_000)).toEqual({ rejected: "closed" });
  });

  it("(e) kilit listesi seçimleri sızdırmaz", () => {
    let s = picked();
    s = lock(s, "p1", 3_000);
    s = lock(s, "p3", 3_000);
    expect(pub(s, 3_100).ready).toEqual(["p1", "p3"]);
    expect(JSON.stringify(pub(s, 3_100))).not.toMatch(/choices|"cell"/);
    expect(priv(s, "p1", 3_100)).toEqual({ myChoice: 0, locked: true, compass: null });
    expect(priv(s, "p2", 3_100)).toEqual({ myChoice: 1, locked: false, compass: null });
    expect(priv(s, null, 3_100)).toEqual({ myChoice: null, locked: false, compass: null });
  });

  it("(f) tick bağlantıya bakmaz: erken bitiş yalnız kayıtlı anla belirlenir", () => {
    let s = picked();
    for (const id of ids(4)) s = lock(s, id, 3_000);
    expect(g.tick(s, ctx(T0 + 5_000, []))).toEqual(g.tick(s, ctx(T0 + 5_000, ids(4))));
  });
});

describe("gizli-kareler ödül karesi (O10)", () => {
  /** Dört oyuncu, 1. aşamada hepsi ayrı karede (hepsi 2. aşamaya geçer). */
  const base = () => stage1([0, 1, 2, 3]);
  const BONUS = 7;

  it("kurulumda ödül karesi ızgara içinde tohumlu rastgelelikle seçilir; aynı tohum aynı kare", () => {
    for (const n of [2, 4, 5, 8]) {
      const seen = new Set<number>();
      for (let seed = 1; seed <= 60; seed++) {
        const s = g.setup(ids(n), { now: T0, rng: createRng(seed), connected: ids(n) });
        expect(s.bonusCell).toBeGreaterThanOrEqual(0);
        expect(s.bonusCell).toBeLessThan(kareCells(kareSize(n)));
        expect(g.setup(ids(n), { now: T0, rng: createRng(seed), connected: ids(n) })).toEqual(s);
        seen.add(s.bonusCell);
      }
      expect(seen.size).toBeGreaterThan(1);
    }
  });

  it("2. aşamada ödül karesine tek başına basan +1 (tek kalan) ve +2 (ödül) = +3 ek alır", () => {
    const s = stage2(withBonus(base(), BONUS), { p1: BONUS, p2: 5, p3: 6, p4: 8 });
    expect(pub(s, S2_END).bonus).toEqual({ cell: BONUS, winner: "p1" });
    expect(pub(s, S2_END).points).toEqual({ p1: 4, p2: 2, p3: 2, p4: 2 });
    expect(final(s).awards).toEqual({ p1: 4, p2: 2, p3: 2, p4: 2 });
    expect(final(s).miniScores).toEqual(final(s).awards);
  });

  it("birden çok kişi ödül karesine basarsa kimse ödül almaz", () => {
    const s = stage2(withBonus(base(), BONUS), { p1: BONUS, p2: BONUS, p3: 6, p4: 8 });
    expect(pub(s, S2_END).bonus).toEqual({ cell: BONUS, winner: null });
    expect(final(s).awards).toEqual({ p1: 1, p2: 1, p3: 2, p4: 2 });
  });

  it("kimse ödül karesine basmazsa ödül verilmez ama kare yine de açılır", () => {
    const s = stage2(withBonus(base(), BONUS), { p1: 4, p2: 5, p3: 6, p4: 8 });
    expect(pub(s, S2_END).bonus).toEqual({ cell: BONUS, winner: null });
    expect(final(s).awards).toEqual({ p1: 2, p2: 2, p3: 2, p4: 2 });
  });

  it("ödül karesi 1. aşamada geçerli değildir: 1. aşamada o kareye basmak ödül getirmez", () => {
    const s = stage2(withBonus(stage1([BONUS, 1, 2, 3]), BONUS), { p1: 4, p2: 5, p3: 6, p4: 8 });
    expect(final(s).awards).toEqual({ p1: 2, p2: 2, p3: 2, p4: 2 });
  });

  it("2. aşama yoksa (tek kişi kaldı / kimse kalmadı) ödül karesi yoktur", () => {
    const walk = withBonus(stage1([0, 0, 2, 3]), 2);
    // p3 ve p4 kalır: 2. aşama var. Yalnız p5 kalır ve bağlı hayalet yoksa (rakipsiz geçiş) 2. aşama oynanmaz:
    const single = drop(withBonus(stage1([0, 0, 2, 2, 5]), 5), ["p1", "p2", "p3", "p4"]);
    expect(pub(single, KARELER_DURATION_MS).bonus).toBeNull();
    expect(final(single).awards).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0, p5: 2 });
    expect(pub(walk, S2_END).bonus).not.toBeNull();
    const none = withBonus(stage1([0, 0, 1, 1]), 0);
    expect(pub(none, KARELER_DURATION_MS).bonus).toBeNull();
  });

  it("hayalet ödül kazanamaz: ödül karesinde tek başına dursa da ödül kimseye gitmez", () => {
    const s = stage2(withBonus(stage1([0, 0, 2, 3]), BONUS), { p1: BONUS, p3: 4, p4: 5 });
    expect(pub(s, S2_END).bonus).toEqual({ cell: BONUS, winner: null });
    expect(final(s).awards).toEqual({ p1: 0, p2: 0, p3: 2, p4: 2 });
  });

  it("2. aşamayı oynayan ödül karesini yakalayamadan geçse bile puanlar yalnız açılışta artar", () => {
    const s = stage2(withBonus(base(), BONUS), { p1: BONUS, p2: 5, p3: 6, p4: 8 });
    // 2. aşama sürerken puan henüz yükselmemiştir
    expect(pub(s, S2_END - 1).points).toEqual({ p1: 1, p2: 1, p3: 1, p4: 1 });
    expect(pub(s, S2_END).points?.p1).toBe(4);
  });

  it("tekrar oynatma: aynı tohum ve eylemler aynı sonucu verir", () => {
    const run = () => {
      let s = g.setup(ids(4), { now: T0, rng: createRng(11), connected: ids(4) });
      for (const [i, id] of ids(4).entries()) s = pick(s, id, i, 1_000 + i);
      for (const [i, id] of ids(4).entries()) s = pick(s, id, 4 + i, S2_START + 500 + i);
      return JSON.stringify([s, pub(s, S2_END), g.result(s)]);
    };
    expect(run()).toBe(run());
  });

  describe("gizlilik", () => {
    /** Konumu belirgin yapmak için ödül karesi bilinen bir değer; JSON taraması ayırt edici sayı kullanır. */
    const s = stage2(withBonus(base(), BONUS), { p1: 5, p2: 6, p3: 8, p4: 4 });

    it("2. aşama sonuçlanana kadar ödül karesi hiçbir görünümde yoktur (publicView ve tüm view'lar)", () => {
      for (const at of [0, 5_000, S1 - 1, S1, S2_START - 1, S2_START, S2_START + 500, S2_END - 1]) {
        const p = pub(s, at);
        expect(p.bonus).toBeNull();
        expect(JSON.stringify(p)).not.toMatch(/bonus.*\d|ödül|odul/i);
        for (const who of [...ids(4), null, "ghost"]) {
          const v = priv(s, who, at);
          expect(Object.keys(v).sort()).toEqual(["compass", "locked", "myChoice"]);
          expect(JSON.stringify(v)).not.toMatch(/bonus|ödül/i);
        }
      }
    });

    it("ödül karesinin yerini sızdıran bir alan, puan ya da seçim farkı yoktur: iki farklı ödül karesi 2. aşama bitene kadar aynı görünüm verir (yarışanın kendi pusulası dışında)", () => {
      const a = stage2(withBonus(stage1([0, 1, 2, 2]), 7), { p1: 5, p2: 6, p3: 8 });
      const b = stage2(withBonus(stage1([0, 1, 2, 2]), 5), { p1: 5, p2: 6, p3: 8 });
      const noCompass = (v: object) => JSON.stringify({ ...v, compass: undefined });
      for (const at of [0, S1 - 1, S1, S2_START + 500, S2_END - 1]) {
        expect(JSON.stringify(pub(a, at))).toBe(JSON.stringify(pub(b, at)));
        // Hayaletler (p3, p4) ve izleyici birebir aynı görür; yarışan yalnız kendi pusulasıyla ayrışır.
        for (const who of ["p3", "p4", null]) {
          expect(JSON.stringify(priv(a, who, at))).toBe(JSON.stringify(priv(b, who, at)));
        }
        for (const who of ["p1", "p2"]) expect(noCompass(priv(a, who, at))).toBe(noCompass(priv(b, who, at)));
      }
    });

    it("kabul/ret sonuçları ödül karesini ele vermez", () => {
      const a = withBonus(base(), 7);
      const b = withBonus(base(), 5);
      for (const cell of [5, 7, 8]) {
        const ra = tryPick(a, "p1", cell, S2_START + 100);
        const rb = tryPick(b, "p1", cell, S2_START + 100);
        expect(ra).not.toHaveProperty("rejected");
        expect(rb).not.toHaveProperty("rejected");
      }
    });

    it("secrets() boştur ve ödül karesi sonuçta (S2_END) açılır", () => {
      expect(g.secrets(s)).toEqual([]);
      expect(pub(s, S2_END).bonus).toEqual({ cell: BONUS, winner: null });
    });
  });
});

describe("gizli-kareler hayaletler (GK-M2)", () => {
  it("kareSettle2: tek kalan yarışanın karesinde hayalet varsa 'haunted'; hayaletler arası aynı kare önemsizdir", () => {
    const r = kareSettle2(["a", "b", "c", "d"], ["x", "y", "z"], { a: 1, b: 2, c: 2, x: 1, y: 5, z: 5 });
    expect(r.status).toEqual({ a: "haunted", b: "clash", c: "clash", d: "passive" });
    expect(r.ghosts).toEqual({ x: 1, y: 5, z: 5 });
    expect(kareSettle2(["a"], ["x"], { a: 1 }).ghosts).toEqual({ x: null });
  });

  it("hayalete çarpan yarışan 2. aşama puanını alamaz; hayalet puan almaz", () => {
    // p1, p2 yarışır; p3+p4 çakıştı, hayalet.
    const s = stage2(stage1([0, 1, 2, 2]), { p1: 5, p2: 6, p3: 5, p4: 5 });
    const r = pub(s, S2_END).stage2Reveal;
    expect(r?.status).toEqual({ p1: "haunted", p2: "solo" });
    expect(r?.ghosts).toEqual({ p3: 5, p4: 5 });
    expect(final(s).awards).toEqual({ p1: 1, p2: 2, p3: 0, p4: 0 });
  });

  it("ödül karesinde yarışanla birlikte duran hayalet ödülü düşürür", () => {
    const s = stage2(withBonus(stage1([0, 1, 2, 2]), 7), { p1: 7, p2: 6, p3: 7 });
    expect(pub(s, S2_END).bonus).toEqual({ cell: 7, winner: null });
    expect(pub(s, S2_END).stage2Reveal?.status.p1).toBe("haunted");
    expect(final(s).awards).toEqual({ p1: 1, p2: 2, p3: 0, p4: 0 });
  });

  it("seçmeyen hayaletin etkisi yoktur", () => {
    const s = stage2(withBonus(stage1([0, 1, 2, 2]), 7), { p1: 7, p2: 6 });
    expect(pub(s, S2_END).stage2Reveal?.ghosts).toEqual({ p3: null, p4: null });
    expect(final(s).awards).toEqual({ p1: 4, p2: 2, p3: 0, p4: 0 });
  });

  it("hayalet seçimleri 2. aşama bitene kadar hiçbir ortak görünümde ve başkasının görünümünde yoktur", () => {
    const s = stage2(stage1([0, 1, 2, 2]), { p3: 8, p4: 4 });
    for (const at of [S2_START, S2_END - 1]) {
      const p = pub(s, at);
      expect(p.stage2Reveal).toBeNull();
      expect(JSON.stringify(p)).not.toMatch(/ghosts":\{|"p3":8|"p4":4/);
      expect(priv(s, "p1", at).myChoice).toBeNull();
      expect(priv(s, "p3", at).myChoice).toBe(8);
      expect(priv(s, "p4", at).myChoice).toBe(4);
    }
  });

  it("tek kişi kaldı ve bağlı hayalet varsa 2. aşama oynanır: otomatik +1 yok, tek kalırsa +1 ve ödül şansı", () => {
    const s = withBonus(stage1([3, 3, 5, 3]), 2);
    const p = pub(s, S1);
    expect(p.walkover).toBeNull();
    expect(p.stage2?.players).toEqual(["p3"]);
    expect(p.stage2?.ghosts).toEqual(["p1", "p2", "p4"]);
    expect(p.points).toEqual({ p1: 0, p2: 0, p3: 1, p4: 0 });
    const lone = stage2(s, { p3: 2, p1: 0 });
    expect(final(lone).awards).toEqual({ p1: 0, p2: 0, p3: 4, p4: 0 });
    const hit = stage2(s, { p3: 2, p1: 2 });
    expect(final(hit).awards).toEqual({ p1: 0, p2: 0, p3: 1, p4: 0 });
  });

  it("rakipsiz kararı 1. aşama kapanınca donar: sonradan kopan ya da dönen hayalet değiştirmez", () => {
    // Hayaletlerin hepsi kapanıştan önce koptu: rakipsiz.
    const off = drop(stage1([3, 3, 5, 3]), ["p1", "p2", "p4"]);
    const back = presence(off, ids(4), S1 + 1_000);
    expect(back.ghostLive).toBe(false);
    expect(pub(back, S1 + 2_000).walkover).toBe("p3");
    // Kapanışta bağlıydılar: sonradan kopmaları 2. aşamayı kaldırmaz.
    const on = stage1([3, 3, 5, 3]);
    const gone = presence(on, ["p3"], S1 + 1_000);
    expect(gone.ghostLive).toBe(true);
    expect(pub(gone, S1 + 2_000).stage2?.players).toEqual(["p3"]);
    // tick de dondurur; aynı sonuç.
    const ticked = g.tick(on, ctx(T0 + S1));
    expect(ticked.ghostLive).toBe(true);
    expect(pub(ticked, S1)).toEqual(pub(on, S1));
  });

  it("erken bitiş: kopan hayalet beklenmez", () => {
    let s = drop(stage1([0, 1, 2, 2]), ["p4"]);
    const conn = ["p1", "p2", "p3"];
    const lockAt = (st: KarelerState, id: string, at: number) => {
      const r = g.reduce(st, id, { kind: "lock" }, ctx(T0 + at, conn));
      if (isRejected(r)) throw new Error(r.rejected);
      return r;
    };
    s = pick(s, "p1", 5, S2_START + 100);
    s = pick(s, "p2", 6, S2_START + 100);
    s = pick(s, "p3", 7, S2_START + 100);
    for (const id of ["p1", "p2"]) s = lockAt(s, id, S2_START + 200);
    expect(pub(s, S2_START + 300).stage2?.endsAt).toBe(T0 + S2_END);
    s = lockAt(s, "p3", S2_START + 300);
    expect(pub(s, S2_START + 400).stage2?.endsAt).toBe(T0 + S2_START + 1_300);
    expect(pub(s, S2_START + 400).ready).toEqual(["p1", "p2", "p3"]);
  });
});

describe("gizli-kareler pusula (GK-M1)", () => {
  it("ipucu türleri: her biri karelerin en az dörtte birini eler, en az 3 kareye izin verir", () => {
    for (const size of [3, 4]) {
      const cells = kareCells(size);
      for (const h of kareHintPool(size)) {
        const n = hintCells(h, size).length;
        expect(n).toBeGreaterThanOrEqual(3);
        expect(cells - n).toBeGreaterThanOrEqual(cells / 4);
      }
    }
    const kinds3 = new Set(kareHintPool(3).map((h) => h.kind));
    expect([...kinds3].sort()).toEqual(["corner", "notCol", "notCorner", "notRow"]);
    const kinds4 = new Set(kareHintPool(4).map((h) => h.kind));
    expect([...kinds4].sort()).toEqual(["corner", "edge", "half", "inner", "notCol", "notCorner", "notRow"]);
  });

  it("4×4'te kenar/iç, yarılar ve köşeler doğru sayılır", () => {
    expect(hintCells({ kind: "inner" }, 4)).toEqual([5, 6, 9, 10]);
    expect(hintCells({ kind: "corner" }, 4)).toEqual([0, 3, 12, 15]);
    expect(hintCells({ kind: "half", side: "top" }, 4)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(hintCells({ kind: "half", side: "right" }, 4)).toEqual([2, 3, 6, 7, 10, 11, 14, 15]);
    expect(hintAllows({ kind: "notCol", col: 1 }, 5, 4)).toBe(false);
    expect(hintAllows({ kind: "notRow", row: 2 }, 5, 4)).toBe(true);
  });

  it("verilen her ipucu ödül karesi için doğrudur; her karede yeterince farklı ipucu vardır", () => {
    for (const size of [3, 4]) {
      for (let cell = 0; cell < kareCells(size); cell++) {
        const hints = kareHintsFor(cell, size);
        expect(hints.length).toBeGreaterThanOrEqual(size === 3 ? 5 : 10);
        for (const h of hints) expect(hintAllows(h, cell, size)).toBe(true);
      }
    }
    expect(kareHintsFor(-1, 3)).toEqual([]);
  });

  it("yarışanlara mümkün olduğunca farklı ipucu verilir; tohum aynıysa dağıtım aynı", () => {
    const racers = ids(8);
    const a = kareCompass(racers, 6, 4, 12345);
    expect(Object.keys(a)).toEqual(racers);
    expect(new Set(Object.values(a).map((h) => JSON.stringify(h))).size).toBe(8);
    expect(kareCompass(racers, 6, 4, 12345)).toEqual(a);
    // 3×3'te 5 ipucu var: dört yarışan dördü de farklı alır.
    const b = kareCompass(ids(4), 4, 3, 99);
    expect(new Set(Object.values(b).map((h) => JSON.stringify(h))).size).toBe(4);
    for (const h of Object.values(b)) expect(hintAllows(h, 4, 3)).toBe(true);
  });

  it("pusula yalnız yarışanın kendi görünümünde, bant anından 2. aşama sonuna kadar; açılışta herkese açılır", () => {
    const s = stage2(withBonus(stage1([0, 1, 2, 2]), 7), { p1: 5, p2: 6 });
    const band = S1 + KARELER_REVEAL1_MS;
    expect(band).toBe(S2_START - KARELER_BAND_MS);
    for (const at of [S1, band - 1]) for (const id of ids(4)) expect(priv(s, id, at).compass).toBeNull();
    for (const at of [band, S2_START + 100, S2_END - 1]) {
      const c1 = priv(s, "p1", at).compass;
      const c2 = priv(s, "p2", at).compass;
      expect(c1).not.toBeNull();
      expect(c2).not.toBeNull();
      if (c1) expect(hintAllows(c1, 7, 3)).toBe(true);
      if (c2) expect(hintAllows(c2, 7, 3)).toBe(true);
      expect(c1).not.toEqual(c2);
      // Hayalet, izleyici ve ortak görünüm pusula görmez.
      expect(priv(s, "p3", at).compass).toBeNull();
      expect(priv(s, null, at).compass).toBeNull();
      expect(JSON.stringify(pub(s, at))).not.toMatch(/compass|notRow|notCol|corner|inner|edge|half/);
    }
    const open = pub(s, S2_END).stage2Reveal?.compass;
    expect(open?.p1).toEqual(priv(s, "p1", S2_END - 1).compass);
    expect(Object.keys(open ?? {}).sort()).toEqual(["p1", "p2"]);
    expect(priv(s, "p1", S2_END).compass).toBeNull();
  });

  it("rakipsiz bitişte pusula yoktur", () => {
    const s = drop(withBonus(stage1([3, 3, 5, 3]), 5), ["p1", "p2", "p4"]);
    for (const at of [S1, S1 + KARELER_REVEAL1_MS, S1 + KARELER_FINAL_MS - 1]) {
      expect(priv(s, "p3", at).compass).toBeNull();
    }
  });

  it("kurulumda pusula tohumu çekilir ve durumda kalır; kurulum belirleyicidir", () => {
    const a = g.setup(ids(5), { now: T0, rng: createRng(3), connected: ids(5) });
    expect(Number.isInteger(a.compassSeed)).toBe(true);
    expect(a.online).toEqual(ids(5));
    expect(a.ghostLive).toBeNull();
    const b = g.setup(ids(5), { now: T0, rng: createRng(3), connected: ["p1"] });
    expect(b.online).toEqual(["p1"]);
  });
});
