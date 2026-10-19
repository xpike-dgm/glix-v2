import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { gizliKareler as g, type KarelerState, karelerPhase, kareSettle } from "./index.js";
import {
  KARELER_BETWEEN_MS,
  KARELER_DURATION_MS,
  KARELER_FINAL_MS,
  KARELER_STAGE_MS,
  kareCells,
  kareSize,
} from "./types.js";

const T0 = 1_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const ctx = (now: number, connected: readonly string[] = ids(8)) => ({ now, rng: createRng(1), connected });
const start = (n = 4): KarelerState => g.setup(ids(n), ctx(T0));
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

  it("iki aşama, her biri 20 sn; aralarında 4 sn açılış; son sonuç 5 sn", () => {
    expect([KARELER_STAGE_MS, KARELER_BETWEEN_MS, KARELER_FINAL_MS]).toEqual([20_000, 4_000, 5_000]);
    const s = stage1([0, 1, 2, 3]);
    expect(s.stage1EndsAt - s.startedAt).toBe(20_000);
    const p = pub(s, S1);
    expect(p.stage2).toEqual({
      startsAt: T0 + S2_START,
      endsAt: T0 + S2_END,
      players: ["p1", "p2", "p3", "p4"],
    });
    expect(p.finishesAt).toBe(T0 + KARELER_DURATION_MS);
    expect(KARELER_DURATION_MS).toBe(49_000);
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

  it("2. aşamaya yalnız 1. aşamada tek kalanlar geçer; çakışan ve pasifler seçemez", () => {
    let s = stage1([0, 0, 1, 2, null]);
    expect(pub(s, S1).stage2?.players).toEqual(["p3", "p4"]);
    expect(tryPick(s, "p1", 3, S2_START + 100)).toEqual({ rejected: "eliminated" });
    expect(tryPick(s, "p5", 3, S2_START + 100)).toEqual({ rejected: "eliminated" });
    s = pick(s, "p3", 6, S2_START + 100);
    expect(priv(s, "p3", S2_START + 100).myChoice).toBe(6);
    expect(priv(s, "p1", S2_START + 100).myChoice).toBeNull();
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

  it("1. aşamadan sonra tek canlı kalan 2. aşamada rakipsiz sayılır: otomatik +1 (toplam 2) ve oyun biter", () => {
    const s = stage1([3, 3, 5, 3]);
    const p = pub(s, S1);
    expect(p.walkover).toBe("p3");
    expect(p.stage2).toBeNull();
    expect(p.points).toEqual({ p1: 0, p2: 0, p3: 2, p4: 0 });
    expect(p.finishesAt).toBe(T0 + S1 + KARELER_FINAL_MS);
    expect(final(s).awards).toEqual({ p1: 0, p2: 0, p3: 2, p4: 0 });
    expect(tryPick(s, "p3", 1, S2_START + 10)).toEqual({ rejected: "closed" });
    expect(tryPick(s, "p3", 1, S1 + KARELER_FINAL_MS)).toEqual({ rejected: "ended" });
  });

  it("iki oyuncuda: biri seçmezse diğeri rakipsiz kalır; farklı kareler iki aşamada da +1", () => {
    expect(final(stage1([4, null])).awards).toEqual({ p1: 2, p2: 0 });
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
        "finishesAt",
        "points",
        "size",
        "stage1",
        "stage2",
        "stage2Reveal",
        "startedAt",
        "walkover",
      ].sort(),
    );
    const raw = cellsOf(JSON.stringify(p));
    expect(raw).not.toContain("choices");
    expect(raw).not.toContain("status");
    // Her oyuncu yalnız kendi seçimini görür; izleyici hiçbir şey görmez.
    expect(priv(s, "p1", S1 - 1)).toEqual({ myChoice: 2 });
    expect(priv(s, "p3", S1 - 1)).toEqual({ myChoice: 5 });
    expect(priv(s, "p4", S1 - 1)).toEqual({ myChoice: 7 });
    expect(priv(s, null, S1 - 1)).toEqual({ myChoice: null });
    for (const id of ids(4)) expect(Object.keys(priv(s, id, S1 - 1))).toEqual(["myChoice"]);
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
    // Elenmiş oyuncu 2. aşamada başkasının seçimini görmez.
    const s2 = stage1([0, 0, 2, 3]);
    const s3 = stage2(s2, { p3: 5, p4: 6 });
    expect(priv(s3, "p1", S2_START + 100)).toEqual({ myChoice: null });
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
