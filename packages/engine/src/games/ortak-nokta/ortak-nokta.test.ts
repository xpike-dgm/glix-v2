import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { ortakNokta as g, type OrtakState, ortakSettle } from "./index.js";
import {
  ORTAK_CHOOSE_MS,
  ORTAK_COLORS,
  ORTAK_DURATION_MS,
  ORTAK_LAST_REVEAL_MS,
  ORTAK_REVEAL_MS,
  ORTAK_ROUNDS,
  ORTAK_SHAPES,
  ORTAK_TILES,
} from "./types.js";

const T0 = 1_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const ctx = (now: number, connected: readonly string[] = ids(8), seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (n = 4, seed = 1): OrtakState => g.setup(ids(n), ctx(T0, ids(8), seed));

function act(
  state: OrtakState,
  id: string,
  action: Parameters<typeof g.reduce>[2],
  at: number,
  connected?: readonly string[],
) {
  const r = g.reduce(state, id, action, ctx(T0 + at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r as OrtakState;
}
const pick = (s: OrtakState, id: string, tile: number, at = 1_000) =>
  act(s, id, { kind: "choose", tile }, at);

describe("ortak-nokta kuralları", () => {
  it("katılım 3–8, dikey, anlatım ≤ 3 madde, rastgele havuz dışı (taslak)", () => {
    expect([g.minPlayers, g.maxPlayers, g.orientation]).toEqual([3, 8, "portrait"]);
    expect(g.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(g.randomPool).toBe(false);
  });

  it("4 tur: seçim 12 sn + sonuç 5 sn (son tur 7 sn); toplam 70 sn", () => {
    expect(ORTAK_ROUNDS).toBe(4);
    expect(ORTAK_DURATION_MS).toBe(4 * 12_000 + 3 * 5_000 + 7_000);
    const s = start();
    expect(g.isFinished(s, ctx(T0 + ORTAK_DURATION_MS - 1))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + ORTAK_DURATION_MS))).toBe(true);
    expect(g.publicView(s, ctx(T0 + ORTAK_CHOOSE_MS)).phase).toBe("reveal");
    expect(g.publicView(s, ctx(T0 + ORTAK_CHOOSE_MS + ORTAK_REVEAL_MS)).round).toBe(2);
  });

  it("her turda 6 kutu: renkler ve şekiller birbirinden farklı", () => {
    const s = start(5, 9);
    for (const board of s.boards) {
      expect(board).toHaveLength(ORTAK_TILES);
      expect(new Set(board.map((t) => t.color)).size).toBe(ORTAK_TILES);
      expect(new Set(board.map((t) => t.shape)).size).toBe(ORTAK_TILES);
      for (const t of board) {
        expect(t.color).toBeLessThan(ORTAK_COLORS);
        expect(t.shape).toBeLessThan(ORTAK_SHAPES);
      }
    }
  });

  it("kutu ekranı oyuncuya göre karışıktır ama her biri 0–5'in bir dizilimidir", () => {
    const s = start(6, 3);
    const layouts = ids(6).map((id) => g.view(s, id, ctx(T0)).layout);
    for (const l of layouts) expect([...l].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(layouts.map((l) => l.join())).size).toBeGreaterThan(1);
    expect(g.view(s, null, ctx(T0)).layout).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("puan: eşleştiğin kişi sayısı; tek en kalabalık grup +1; yalnız kalan 0", () => {
    // p1,p2,p3 -> kutu 2; p4,p5 -> kutu 4; p6 -> kutu 0
    const r = ortakSettle(ids(6), { p1: 2, p2: 2, p3: 2, p4: 4, p5: 4, p6: 0 });
    expect(r.points).toEqual({ p1: 3, p2: 3, p3: 3, p4: 1, p5: 1, p6: 0 });
    expect(r.topTile).toBe(2);
    expect(r.groups.map((x) => [x.tile, x.ids.length])).toEqual([
      [2, 3],
      [4, 2],
      [0, 1],
    ]);
  });

  it("en kalabalık gruplar eşitse bonus yok", () => {
    const r = ortakSettle(ids(4), { p1: 1, p2: 1, p3: 3, p4: 3 });
    expect(r.topTile).toBeNull();
    expect(r.points).toEqual({ p1: 1, p2: 1, p3: 1, p4: 1 });
  });

  it("herkes dağınık seçerse ve seçmeyen varsa puan yok", () => {
    const r = ortakSettle(ids(4), { p1: 0, p2: 1, p3: 2 });
    expect(r.topTile).toBeNull();
    expect(Object.values(r.points)).toEqual([0, 0, 0, 0]);
    expect(r.picks).toEqual({ p1: 0, p2: 1, p3: 2 });
  });

  it("herkes aynı kutuyu seçerse n-1 + 1 bonus", () => {
    const r = ortakSettle(ids(5), { p1: 3, p2: 3, p3: 3, p4: 3, p5: 3 });
    expect(Object.values(r.points)).toEqual([5, 5, 5, 5, 5]);
  });

  it("seçim değiştirilebilir; kilitlenince değişmez; seçimsiz kilitlenemez", () => {
    let s = start();
    s = pick(s, "p1", 1);
    s = pick(s, "p1", 4, 2_000);
    expect(g.view(s, "p1", ctx(T0 + 2_100)).myTile).toBe(4);
    expect(g.reduce(s, "p2", { kind: "lock" }, ctx(T0 + 2_000))).toEqual({ rejected: "nothing_to_lock" });
    s = act(s, "p1", { kind: "lock" }, 3_000);
    expect(g.reduce(s, "p1", { kind: "choose", tile: 2 }, ctx(T0 + 4_000))).toEqual({ rejected: "locked" });
    expect(g.view(s, "p1", ctx(T0 + 4_000)).locked).toBe(true);
  });

  it("katılımcı olmayan reddedilir; süre bitince seçim alınmaz; çöp eylem ayrıştırılmaz", () => {
    const s = start();
    expect(g.reduce(s, "ghost", { kind: "choose", tile: 0 }, ctx(T0 + 100))).toEqual({
      rejected: "not_participant",
    });
    expect(g.reduce(s, "p1", { kind: "choose", tile: 0 }, ctx(T0 + ORTAK_CHOOSE_MS))).toEqual({
      rejected: "ended",
    });
    for (const raw of [
      { kind: "choose", tile: 6 },
      { kind: "choose", tile: -1 },
      { kind: "choose", tile: 1.5 },
      { kind: "choose" },
      { kind: "choose", tile: 1, x: 1 },
      { kind: "lock", tile: 1 },
      null,
      3,
    ]) {
      expect(g.parseAction(raw)).toBeNull();
    }
    expect(g.parseAction({ kind: "choose", tile: 5 })).toEqual({ kind: "choose", tile: 5 });
  });

  it("bağlı herkes kilitleyince seçim 1 sn sonra biter, sonraki tur öne gelir", () => {
    const players = ids(3);
    let s = start(3);
    for (const id of players) s = act(s, id, { kind: "choose", tile: 0 }, 1_000, players);
    s = act(s, "p1", { kind: "lock" }, 2_000, players);
    s = act(s, "p2", { kind: "lock" }, 2_100, players);
    expect(g.publicView(s, ctx(T0 + 2_200)).phase).toBe("choose");
    s = act(s, "p3", { kind: "lock" }, 2_500, players);
    expect(g.publicView(s, ctx(T0 + 3_499)).phase).toBe("choose");
    const pub = g.publicView(s, ctx(T0 + 3_500));
    expect(pub.phase).toBe("reveal");
    expect(pub.reveal?.points).toEqual({ p1: 3, p2: 3, p3: 3 });
    // Sonuç 5 sn sonra bitince 2. tur başlar.
    expect(g.publicView(s, ctx(T0 + 3_500 + ORTAK_REVEAL_MS)).round).toBe(2);
    // Oyun, tam süreden 8,5 sn önce biter (kilit sonrası kazanılan zaman).
    expect(g.isFinished(s, ctx(T0 + ORTAK_DURATION_MS - 8_500))).toBe(true);
  });

  it("kopuk oyuncu beklenmez: kalan bağlılar kilitleyince tur biter", () => {
    const online = ["p1", "p2"];
    let s = start(3);
    s = act(s, "p1", { kind: "choose", tile: 1 }, 500, online);
    s = act(s, "p2", { kind: "choose", tile: 1 }, 600, online);
    s = act(s, "p1", { kind: "lock" }, 700, online);
    s = act(s, "p2", { kind: "lock" }, 800, online);
    expect(g.publicView(s, ctx(T0 + 1_800)).phase).toBe("reveal");
  });

  it("4 turun toplamı genel skora çevrilir: en yüksek +2, ikinci +1; eşitse liderler +1", () => {
    let s = start(4, 5);
    // Her turda p1,p2,p3 aynı kutuyu seçer; p4 başka.
    for (let round = 0; round < ORTAK_ROUNDS; round++) {
      const base = round * (ORTAK_CHOOSE_MS + ORTAK_REVEAL_MS);
      for (const id of ["p1", "p2", "p3"]) s = act(s, id, { kind: "choose", tile: 2 }, base + 1_000);
      s = act(s, "p4", { kind: "choose", tile: 5 }, base + 1_000);
    }
    const end = g.tick(s, ctx(T0 + ORTAK_DURATION_MS));
    expect(g.isFinished(end, ctx(T0 + ORTAK_DURATION_MS))).toBe(true);
    const res = g.result(end);
    expect(res.miniScores).toEqual({ p1: 12, p2: 12, p3: 12, p4: 0 });
    // Üç lider eşit: yalnız liderler +1.
    expect(res.awards).toEqual({ p1: 1, p2: 1, p3: 1, p4: 0 });
    const pub = g.publicView(end, ctx(T0 + ORTAK_DURATION_MS));
    expect(pub.final).toEqual(res.awards);
    expect(pub.round).toBe(4);
  });

  it("tek lider +2, ikinci +1", () => {
    let s = start(4, 5);
    for (let round = 0; round < ORTAK_ROUNDS; round++) {
      const base = round * (ORTAK_CHOOSE_MS + ORTAK_REVEAL_MS);
      for (const id of ["p1", "p2", "p3"]) s = act(s, id, { kind: "choose", tile: 2 }, base + 1_000);
      s = act(s, "p4", { kind: "choose", tile: round === 0 ? 2 : 5 }, base + 1_000);
    }
    const res = g.result(g.tick(s, ctx(T0 + ORTAK_DURATION_MS)));
    expect(res.awards.p4).toBe(0);
    expect(res.miniScores.p1).toBeGreaterThan(res.miniScores.p4 ?? 0);
  });

  it("tick takvimi sonucu değiştirmez: seyrek ve sık tick aynı sonuç", () => {
    let s = start(4, 8);
    s = pick(s, "p1", 1);
    s = pick(s, "p2", 1);
    const dense = Array.from({ length: 80 }, (_, i) => T0 + i * 1_000).reduce(
      (st, t) => g.tick(st, ctx(t)),
      s,
    );
    const sparse = g.tick(s, ctx(T0 + 79_000));
    expect(g.result(dense)).toEqual(g.result(sparse));
  });
});

describe("ortak-nokta gizlilik (yapısal)", () => {
  it("secrets() boştur (gerekçe: değerler kısa kutu numaraları)", () => {
    expect(g.secrets(start())).toEqual([]);
  });

  it("seçim süresince ortak görünümde kimsenin seçimi yok; yalnız kimlerin kilitlediği bilinir", () => {
    let s = start(5, 11);
    s = pick(s, "p1", 3);
    s = pick(s, "p2", 3);
    s = act(s, "p2", { kind: "lock" }, 1_500);
    for (const at of [0, 1_000, 11_999]) {
      const pub = g.publicView(s, ctx(T0 + at));
      expect(pub.reveal).toBeNull();
      expect(pub.lockedIds).toEqual(["p2"]);
      const flat = JSON.stringify(pub);
      expect(flat).not.toContain("picks");
      expect(flat).not.toContain("groups");
      expect(flat).not.toContain("layout");
      expect(flat).not.toContain("choices");
    }
  });

  it("kişisel görünüm yalnız sahibinin seçimini taşır; izleyici ve diğerleri göremez", () => {
    let s = start(4, 2);
    s = pick(s, "p1", 3);
    expect(g.view(s, "p1", ctx(T0 + 2_000)).myTile).toBe(3);
    expect(g.view(s, "p2", ctx(T0 + 2_000)).myTile).toBeNull();
    expect(g.view(s, null, ctx(T0 + 2_000)).myTile).toBeNull();
  });

  it("sonuç açılınca herkes seçimleri görür; sonraki turda seçimler sıfırlanır", () => {
    let s = start(4, 2);
    s = pick(s, "p1", 3);
    s = pick(s, "p2", 3);
    const open = g.publicView(s, ctx(T0 + ORTAK_CHOOSE_MS));
    expect(open.reveal?.picks).toEqual({ p1: 3, p2: 3 });
    const next = g.publicView(s, ctx(T0 + ORTAK_CHOOSE_MS + ORTAK_REVEAL_MS));
    expect(next.reveal).toBeNull();
    expect(next.round).toBe(2);
    expect(g.view(s, "p1", ctx(T0 + ORTAK_CHOOSE_MS + ORTAK_REVEAL_MS)).myTile).toBeNull();
  });

  it("gelecek turların kutuları görünümde yok", () => {
    const s = start(4, 4);
    const futureBoard = JSON.stringify(s.boards[2]);
    const pub = JSON.stringify(g.publicView(s, ctx(T0 + 500)));
    expect(pub).not.toContain(futureBoard);
    expect(g.publicView(s, ctx(T0 + 500)).board).toEqual(s.boards[0]);
  });

  it("son sonuç süresi 7 sn", () => {
    expect(ORTAK_LAST_REVEAL_MS).toBe(7_000);
  });
});
