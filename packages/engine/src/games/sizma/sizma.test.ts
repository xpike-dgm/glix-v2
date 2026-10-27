import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { sizma, sizmaOutcome } from "./index.js";
import {
  SIZMA_CLUE_CAP_MS,
  SIZMA_MAX_DURATION_MS,
  SIZMA_NOTICE_MS,
  SIZMA_REVEAL_MS,
  SIZMA_VOTE_MS,
  type SizmaPublicView,
  type SizmaView,
} from "./types.js";
import { SIZMA_PAIRS } from "./words.js";

const T0 = 1_000_000;
const ctx = (now: number, connected: readonly string[] = ["a", "b", "c", "d", "e"], seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
type S = ReturnType<typeof sizma.setup>;

/** Sızma ve kelimeler sabitlenmiş durum (setup'ın rastgele seçimi yerine). */
function start(players: string[] = ["a", "b", "c"], infiltrator = "c", seed = 1): S {
  const s = sizma.setup(players, ctx(T0, players, seed));
  return { ...s, infiltrator, commonWord: "ÇAY", infiltratorWord: "KAHVE" };
}
const tick = (s: S, at: number, connected: readonly string[] = s.players) =>
  sizma.tick(s, ctx(at, connected));
const pub = (s: S, at: number): SizmaPublicView => sizma.publicView(tick(s, at), ctx(at, s.players));
const priv = (s: S, who: string | null, at: number): SizmaView =>
  sizma.view(tick(s, at), who, ctx(at, s.players));

function ok(s: S, id: string, action: unknown, at: number, connected: readonly string[] = s.players): S {
  const parsed = sizma.parseAction(action);
  if (!parsed) throw new Error("parseAction reddetti");
  const r = sizma.reduce(s, id, parsed, ctx(at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
function rej(s: S, id: string, action: unknown, at: number, connected: readonly string[] = s.players) {
  const parsed = sizma.parseAction(action);
  if (!parsed) throw new Error("parseAction reddetti");
  const r = sizma.reduce(s, id, parsed, ctx(at, connected));
  return isRejected(r) ? r.rejected : null;
}

const VOTE_AT = T0 + SIZMA_CLUE_CAP_MS + 1_000;
const VOTE_END = T0 + SIZMA_CLUE_CAP_MS + SIZMA_VOTE_MS;
const NOTICE_END = VOTE_END + SIZMA_NOTICE_MS;
const vote = (s: S, from: string, to: string, at = VOTE_AT, connected?: readonly string[]) =>
  ok(s, from, { kind: "vote", target: to }, at, connected);
const cast = (players: string[], infiltrator: string, edges: [string, string][]): S => {
  let s = start(players, infiltrator);
  for (const [from, to] of edges) s = vote(s, from, to);
  return s;
};
const finalAwards = (s: S) => sizma.result(tick(s, VOTE_END + 1)).awards;

describe("sızma meta ve kurulum", () => {
  it("3-8 oyuncu, dikey, açılış en çok 3 madde ve teknik kelime yok", () => {
    expect(sizma.minPlayers).toBe(3);
    expect(sizma.maxPlayers).toBe(8);
    expect(sizma.orientation).toBe("portrait");
    expect(sizma.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(sizma.briefing)).not.toMatch(/protocol|server|debug|stage/i);
  });

  it("süreler: 5 dk teknik tavan, 30 sn oylama, 8 sn fark ettin mi", () => {
    expect(SIZMA_NOTICE_MS).toBe(8_000);
    expect(SIZMA_CLUE_CAP_MS).toBe(300_000);
    expect(SIZMA_VOTE_MS).toBe(30_000);
    const s = sizma.setup(["a", "b", "c"], ctx(T0));
    expect(s.clueEndsAt).toBe(T0 + 300_000);
    expect(s.voteEndsAt).toBe(T0 + 330_000);
    expect(s.noticeEndsAt).toBe(T0 + 338_000);
    expect(s.finishAt).toBe(T0 + SIZMA_MAX_DURATION_MS);
  });

  it("havuzdaki bir çift seçilir; ortak/sızma tarafı rastgele, iki kelime farklı", () => {
    const pool = new Set(
      SIZMA_PAIRS.map(([x, y]) => `${x.toLocaleUpperCase("tr-TR")}|${y.toLocaleUpperCase("tr-TR")}`),
    );
    const sides = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const s = sizma.setup(["a", "b", "c", "d"], ctx(T0, ["a", "b", "c", "d"], seed));
      const forward = `${s.commonWord}|${s.infiltratorWord}`;
      const backward = `${s.infiltratorWord}|${s.commonWord}`;
      expect(pool.has(forward) || pool.has(backward)).toBe(true);
      expect(s.commonWord).not.toBe(s.infiltratorWord);
      sides.add(pool.has(forward) ? "ilk-ortak" : "ikinci-ortak");
    }
    expect([...sides].sort()).toEqual(["ikinci-ortak", "ilk-ortak"]);
  });

  it("havuz: çiftler dolu, kendi içinde farklı ve tekrarsız", () => {
    expect(SIZMA_PAIRS.length).toBeGreaterThanOrEqual(150);
    const seen = new Set<string>();
    for (const [x, y] of SIZMA_PAIRS) {
      expect(x.length).toBeGreaterThan(0);
      expect(x).not.toBe(y);
      const key = [x, y].sort().join("|");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("tam bir sızma: her oyuncu eşit olasılıkla sızma olabilir; söyleme sırası oyuncuların permütasyonu", () => {
    const players = ["a", "b", "c", "d", "e"];
    const hits: Record<string, number> = {};
    for (let seed = 1; seed <= 300; seed++) {
      const s = sizma.setup(players, ctx(T0, players, seed));
      hits[s.infiltrator] = (hits[s.infiltrator] ?? 0) + 1;
      expect([...s.order].sort()).toEqual(players);
    }
    for (const id of players) expect(hits[id]).toBeGreaterThan(30);
  });

  it("kelimelerin görünümleri: sızma farklı kelimeyi, diğerleri ortak kelimeyi görür", () => {
    const s = start(["a", "b", "c", "d"], "c");
    expect(priv(s, "a", T0).word).toBe("ÇAY");
    expect(priv(s, "b", T0).word).toBe("ÇAY");
    expect(priv(s, "d", T0).word).toBe("ÇAY");
    expect(priv(s, "c", T0).word).toBe("KAHVE");
    expect(priv(s, null, T0).word).toBeNull();
    expect(priv(s, "ghost", T0).word).toBeNull();
  });

  it("kelimeler büyük harf (tr-TR) gösterilir", () => {
    const s = sizma.setup(["a", "b", "c"], ctx(T0));
    expect(s.commonWord).toBe(s.commonWord.toLocaleUpperCase("tr-TR"));
    expect(s.infiltratorWord).toBe(s.infiltratorWord.toLocaleUpperCase("tr-TR"));
  });
});

describe("sızma ipucu aşaması (süresiz)", () => {
  it("ekranda rastgele söyleme sırası var; iki turda aynı sıra tek listedir", () => {
    const p = pub(start(["a", "b", "c", "d"]), T0 + 10);
    expect([...p.order].sort()).toEqual(["a", "b", "c", "d"]);
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      orders.add(sizma.setup(["a", "b", "c", "d"], ctx(T0, ["a", "b", "c", "d"], seed)).order.join(""));
    }
    expect(orders.size).toBeGreaterThan(5);
  });

  it("süre göstergesi yok: ipucu aşaması teknik tavana kadar sürer, tavanda oylama kendiliğinden başlar", () => {
    const s = start();
    expect(pub(s, T0 + 4 * 60_000 + 59_999).phase).toBe("clue");
    expect(pub(s, T0 + SIZMA_CLUE_CAP_MS).phase).toBe("vote");
  });

  it("tick aşama sınırlarında durumu bir kez değiştirir (yayın tetiklemek için)", () => {
    const s = start();
    expect(tick(s, T0 + SIZMA_CLUE_CAP_MS - 1)).toBe(s);
    const voting = tick(s, T0 + SIZMA_CLUE_CAP_MS);
    expect(voting).not.toBe(s);
    expect(tick(voting, VOTE_END - 1)).toBe(voting);
    const noticing = tick(voting, VOTE_END);
    expect(noticing).not.toBe(voting);
    expect(noticing.stage).toBe("notice");
    expect(tick(noticing, NOTICE_END - 1)).toBe(noticing);
    const done = tick(noticing, NOTICE_END);
    expect(done).not.toBe(noticing);
    expect(tick(done, NOTICE_END + 99_999)).toBe(done);
    // Seyrek tick: ipucundan doğrudan açılışa atlayabilir.
    expect(tick(s, NOTICE_END + 5).stage).toBe("reveal");
  });

  it("ipucu aşamasında oy ve Tamam reddedilir", () => {
    const s = start();
    expect(rej(s, "a", { kind: "vote", target: "b" }, T0 + 1_000)).toBe("not_voting_yet");
    expect(rej(s, "a", { kind: "lock" }, T0 + 1_000)).toBe("not_voting_yet");
  });

  it("oylama başlayınca Oylamaya geç reddedilir", () => {
    expect(rej(start(), "a", { kind: "skip" }, T0 + SIZMA_CLUE_CAP_MS)).toBe("not_clue");
  });

  it("herkes (bağlı) Oylamaya geç'e basınca oylama 1 sn sonra başlar; oylama süresi 30 sn kalır", () => {
    let s = start();
    for (const id of s.players) s = ok(s, id, { kind: "skip" }, T0 + 20_000);
    expect(s.clueEndsAt).toBe(T0 + 21_000);
    expect(pub(s, T0 + 20_999).phase).toBe("clue");
    expect(pub(s, T0 + 21_000).phase).toBe("vote");
    expect(pub(s, T0 + 21_000).voteEndsAt).toBe(T0 + 21_000 + SIZMA_VOTE_MS);
    expect(pub(s, T0 + 21_000).finishAt).toBe(
      T0 + 21_000 + SIZMA_VOTE_MS + SIZMA_NOTICE_MS + SIZMA_REVEAL_MS,
    );
    expect(rej(s, "a", { kind: "vote", target: "b" }, T0 + 21_000)).toBeNull();
  });

  it("bir kişi eksikken oylama başlamaz", () => {
    let s = start();
    s = ok(s, "a", { kind: "skip" }, T0 + 20_000);
    s = ok(s, "b", { kind: "skip" }, T0 + 20_000);
    expect(s.clueEndsAt).toBe(T0 + SIZMA_CLUE_CAP_MS);
    expect(pub(s, T0 + 60_000).phase).toBe("clue");
    expect(pub(s, T0 + 60_000).ready).toEqual(["a", "b"]);
  });

  it("bağlantısı kopan oyuncu beklenmez", () => {
    let s = start();
    const conn = ["a", "b"];
    s = ok(s, "a", { kind: "skip" }, T0 + 20_000, conn);
    s = ok(s, "b", { kind: "skip" }, T0 + 20_000, conn);
    expect(s.clueEndsAt).toBe(T0 + 21_000);
  });

  it("kimse bağlı değilken oylama kendiliğinden başlamaz", () => {
    expect(ok(start(), "a", { kind: "skip" }, T0 + 20_000, []).clueEndsAt).toBe(T0 + SIZMA_CLUE_CAP_MS);
  });

  it("yeniden basmak yeniden kontrol eder: sonradan kopan oyuncudan sonra kalanların basması yeter", () => {
    let s = start();
    s = ok(s, "a", { kind: "skip" }, T0 + 20_000);
    s = ok(s, "b", { kind: "skip" }, T0 + 20_000);
    expect(s.clueEndsAt).toBe(T0 + SIZMA_CLUE_CAP_MS);
    // c koptu; a yeniden basar.
    const again = ok(s, "a", { kind: "skip" }, T0 + 30_000, ["a", "b"]);
    expect(again.clueEndsAt).toBe(T0 + 31_000);
    // Aynı bağlı kümede tekrar basmak durumu değiştirmez.
    expect(ok(s, "a", { kind: "skip" }, T0 + 30_000)).toBe(s);
  });

  it("kapanış penceresinde yeni Oylamaya geç reddedilir; basanlar herkese açık", () => {
    let s = start();
    const conn = ["a", "b"];
    s = ok(s, "a", { kind: "skip" }, T0 + 20_000, conn);
    s = ok(s, "b", { kind: "skip" }, T0 + 20_000, conn);
    expect(rej(s, "c", { kind: "skip" }, T0 + 20_500)).toBe("closed");
    expect(pub(s, T0 + 20_100).ready).toEqual(["a", "b"]);
  });

  it("kendi view'ında geçtiğini görür", () => {
    const s = ok(start(), "b", { kind: "skip" }, T0 + 5_000);
    expect(priv(s, "b", T0 + 6_000).locked).toBe(true);
    expect(priv(s, "a", T0 + 6_000).locked).toBe(false);
  });

  it("teknik tavan: kimse basmazsa 5 dk sonra oylama, 30 sn sonra açılış, 8 sn sonra biter", () => {
    const s = start();
    expect(sizma.isFinished(s, ctx(T0 + SIZMA_MAX_DURATION_MS - 1))).toBe(false);
    expect(sizma.isFinished(s, ctx(T0 + SIZMA_MAX_DURATION_MS))).toBe(true);
  });
});

describe("sızma oylama", () => {
  it("kendine oy serbest ve sayılır", () => {
    const s = vote(start(), "c", "c");
    expect(priv(s, "c", VOTE_AT).myVote).toBe("c");
    expect(sizmaOutcome(s.players, "c", s.votes).tally.c).toBe(1);
  });

  it("oy değiştirilebilir (son oy geçerli)", () => {
    let s = vote(start(), "a", "b");
    s = vote(s, "a", "c");
    expect(priv(s, "a", VOTE_AT).myVote).toBe("c");
    expect(vote(s, "a", "c")).toBe(s);
  });

  it("bilinmeyen hedef, katılımcı olmayan ve bağlı olmayan hedef reddedilir", () => {
    const s = start();
    expect(rej(s, "a", { kind: "vote", target: "zzz" }, VOTE_AT)).toBe("unknown_target");
    expect(rej(s, "ghost", { kind: "vote", target: "a" }, VOTE_AT)).toBe("not_participant");
    expect(rej(s, "a", { kind: "vote", target: "b" }, VOTE_AT, ["a", "c"])).toBe("target_offline");
    expect(rej(s, "a", { kind: "vote", target: "b" }, VOTE_AT, ["a", "b", "c"])).toBeNull();
    // Kendine oy, bağlantı listesinde olmasa da geçer.
    expect(rej(s, "a", { kind: "vote", target: "a" }, VOTE_AT, ["b"])).toBeNull();
  });

  it("oylama süresi (30 sn) bitince oy reddedilir; 1 ms önce kabul edilir", () => {
    const s = start();
    expect(rej(s, "a", { kind: "vote", target: "b" }, VOTE_END - 1)).toBeNull();
    expect(rej(s, "a", { kind: "vote", target: "b" }, VOTE_END)).toBe("ended");
    expect(rej(s, "a", { kind: "vote", target: "b" }, T0 + SIZMA_MAX_DURATION_MS + 5)).toBe("ended");
    expect(rej(s, "a", { kind: "lock" }, VOTE_END)).toBe("ended");
    expect(rej(s, "a", { kind: "skip" }, VOTE_END)).toBe("ended");
  });

  it("oylar süre bitene kadar yalnız sahibine görünür", () => {
    const s = cast(["a", "b", "c"], "c", [["a", "c"]]);
    expect(priv(s, "a", VOTE_AT).myVote).toBe("c");
    expect(priv(s, "b", VOTE_AT).myVote).toBeNull();
    expect(priv(s, "c", VOTE_AT).myVote).toBeNull();
    expect(priv(s, null, VOTE_AT).myVote).toBeNull();
    expect(pub(s, VOTE_AT).reveal).toBeNull();
  });

  it("bağlantısı kopmuş oyuncunun oyu da sayılır", () => {
    let s = start();
    s = vote(s, "a", "c");
    s = vote(s, "b", "c");
    const done = tick(s, VOTE_END + 1, ["c"]);
    expect(sizma.result(done).awards).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("parseAction yalnız tam biçimi kabul eder", () => {
    expect(sizma.parseAction({ kind: "vote", target: "b" })).toEqual({ kind: "vote", target: "b" });
    expect(sizma.parseAction({ kind: "skip" })).toEqual({ kind: "skip" });
    expect(sizma.parseAction({ kind: "lock" })).toEqual({ kind: "lock" });
    for (const bad of [
      { kind: "vote" },
      { kind: "vote", target: "" },
      { kind: "vote", target: 3 },
      { kind: "vote", target: "b", extra: 1 },
      { kind: "skip", target: "b" },
      { kind: "lock", extra: 1 },
      { kind: "clue", text: "x" },
      { kind: "vote", target: "x".repeat(65) },
      ["vote", "b"],
      "b",
    ]) {
      expect(sizma.parseAction(bad)).toBeNull();
    }
  });

  it("yazılı ipucu eylemi yoktur", () => {
    for (const kind of ["clue", "hint", "say", "write"]) {
      expect(sizma.parseAction({ kind, text: "x" })).toBeNull();
    }
  });
});

describe("sızma puanlama", () => {
  it("sızma tek başına en çok oyu alırsa yakalanır: diğerleri +1, sızma 0", () => {
    const s = cast(["a", "b", "c", "d"], "c", [
      ["a", "c"],
      ["b", "c"],
      ["c", "a"],
      ["d", "b"],
    ]);
    expect(finalAwards(s)).toEqual({ a: 1, b: 1, c: 0, d: 1 });
    expect(sizma.result(tick(s, VOTE_END + 1)).miniScores).toEqual({ a: 1, b: 1, c: 0, d: 1 });
  });

  it("tek oyla bile (diğerleri dağılmışsa) en çok oyu alan sızma yakalanır", () => {
    const s = cast(["a", "b", "c", "d"], "c", [["a", "c"]]);
    expect(finalAwards(s)).toEqual({ a: 1, b: 1, c: 0, d: 1 });
  });

  it("sızma kendine oy verip tek başına en çok oyu alırsa da yakalanır", () => {
    const s = cast(["a", "b", "c"], "c", [["c", "c"]]);
    expect(finalAwards(s)).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("sızma yakalanmazsa sızma +2, diğerleri 0; yanlış oy eksi puan doğurmaz", () => {
    const s = cast(["a", "b", "c", "d"], "c", [
      ["a", "b"],
      ["b", "b"],
      ["c", "a"],
      ["d", "b"],
    ]);
    expect(finalAwards(s)).toEqual({ a: 0, b: 0, c: 2, d: 0 });
  });

  it("eşitlik: sızma eşit adaylar arasında olsa da sızma kazanır", () => {
    const withInfiltrator = cast(["a", "b", "c", "d"], "c", [
      ["a", "c"],
      ["b", "a"],
      ["c", "a"],
      ["d", "c"],
    ]);
    expect(finalAwards(withInfiltrator)).toEqual({ a: 0, b: 0, c: 2, d: 0 });
    const without = cast(["a", "b", "c", "d"], "c", [
      ["a", "b"],
      ["b", "a"],
      ["c", "a"],
      ["d", "b"],
    ]);
    expect(finalAwards(without)).toEqual({ a: 0, b: 0, c: 2, d: 0 });
  });

  it("hiç oy yoksa sızma +2", () => {
    expect(finalAwards(start())).toEqual({ a: 0, b: 0, c: 2 });
    expect(sizmaOutcome(["a", "b", "c"], "c", {}).caught).toBe(false);
  });

  it("toplam puan: yakalanınca oyuncu sayısı - 1, yakalanmayınca 2", () => {
    for (const n of [3, 5, 8]) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      const caught = cast(players, "p0", [
        ["p1", "p0"],
        ["p2", "p0"],
      ]);
      expect(Object.values(finalAwards(caught)).reduce((x, y) => x + y, 0)).toBe(n - 1);
      expect(Object.values(finalAwards(start(players, "p0"))).reduce((x, y) => x + y, 0)).toBe(2);
    }
  });

  it("sonuç tick'ten bağımsız: tick'lenmemiş durumdan da aynı sonuç", () => {
    const s = cast(["a", "b", "c"], "c", [["a", "c"]]);
    expect(sizma.result(s)).toEqual(sizma.result(tick(s, VOTE_END + 1)));
  });
});

describe("sızma sonuç açılışı", () => {
  const s = cast(["a", "b", "c", "d"], "c", [
    ["a", "c"],
    ["b", "c"],
    ["d", "a"],
  ]);

  it("oylama bitince tick'ten sonra sızma, kelimeler, oy akışı ve puanlar herkese açılır", () => {
    expect(pub(s, VOTE_END).phase).toBe("notice");
    expect(pub(s, VOTE_END).reveal).toBeNull();
    const p = pub(s, NOTICE_END);
    expect(p.phase).toBe("reveal");
    expect(p.reveal?.infiltrator).toBe("c");
    expect(p.reveal?.commonWord).toBe("ÇAY");
    expect(p.reveal?.infiltratorWord).toBe("KAHVE");
    expect(p.reveal?.votes).toEqual({ a: "c", b: "c", d: "a" });
    expect(p.reveal?.tally).toEqual({ a: 1, b: 0, c: 2, d: 0 });
    expect(p.reveal?.caught).toBe(true);
    expect(p.reveal?.scores).toEqual({ a: 1, b: 1, c: 0, d: 1 });
  });

  it("tick atılmadan açılış görünmez (aşama sunucu yayınıyla değişir)", () => {
    expect(sizma.publicView(s, ctx(NOTICE_END, s.players)).reveal).toBeNull();
  });

  it("açılış süresi dolana kadar bitmez", () => {
    expect(sizma.isFinished(s, ctx(VOTE_END))).toBe(false);
    expect(sizma.isFinished(s, ctx(NOTICE_END + SIZMA_REVEAL_MS - 1))).toBe(false);
    expect(sizma.isFinished(s, ctx(NOTICE_END + SIZMA_REVEAL_MS))).toBe(true);
  });
});

describe("sızma gizlilik (sızma kimliği kısa; yapısal kontrol)", () => {
  const players = ["pa1", "pb2", "pc3", "pd4"];
  const A = start(players, "pc3");
  const B: S = { ...A, infiltrator: "pa1", commonWord: "KAHVE", infiltratorWord: "ÇAY" };

  it("publicView sızmayı, kelimeleri ve oyları açılana kadar içermez: sızma kimse olsun aynı çıkar", () => {
    for (const at of [T0 + 1, T0 + 60_000, VOTE_AT, VOTE_END - 1]) {
      const a = JSON.stringify(sizma.publicView(tick(A, at), ctx(at, players)));
      // Aynı sıra ve aynı zaman çizelgesi, farklı sızma ve kelime: ortak görünüm birebir aynı.
      const b = JSON.stringify(sizma.publicView(tick(B, at), ctx(at, players)));
      expect(a).toBe(b);
      expect(a).not.toMatch(/ÇAY|KAHVE|infiltrator|Word|votes|tally/);
    }
  });

  it("view yalnız word, myVote, myNotice ve locked verir; kimse sızma olduğunu görmez", () => {
    for (const who of players) {
      expect(Object.keys(priv(A, who, VOTE_AT)).sort()).toEqual(["locked", "myNotice", "myVote", "word"]);
    }
    // Sızma farklı kelimeyi görür ama bunun "sızma kelimesi" olduğu belirtilmez: görünüm biçimi aynıdır.
    expect(Object.keys(priv(A, "pc3", VOTE_AT))).toEqual(Object.keys(priv(A, "pa1", VOTE_AT)));
    expect(JSON.stringify(priv(A, "pc3", VOTE_AT))).not.toMatch(/infiltr|sızma|odd|fake/i);
  });

  it("başka oyuncunun view'ında kelimesi geçmez; izleyicide hiç kelime yok", () => {
    for (const who of ["pa1", "pb2", "pd4"]) {
      expect(JSON.stringify(priv(A, who, VOTE_AT))).not.toContain("KAHVE");
    }
    expect(JSON.stringify(priv(A, "pc3", VOTE_AT))).not.toContain("ÇAY");
    expect(JSON.stringify(priv(A, null, VOTE_AT))).not.toMatch(/ÇAY|KAHVE/);
  });

  it("secrets: ortak kelime sızma dışındakilere, sızma kelimesi yalnız sızmaya ait; açılışta boş", () => {
    const secrets = sizma.secrets(A);
    const common = secrets.find((x) => x.value === "ÇAY");
    const odd = secrets.find((x) => x.value === "KAHVE");
    expect(common?.ownerIds).toEqual(["pa1", "pb2", "pd4"]);
    expect(odd?.ownerIds).toEqual(["pc3"]);
    expect(sizma.secrets(tick(A, NOTICE_END))).toEqual([]);
  });

  it("çok kısa kelimeler (2 harf) secrets()'a girmez ama görünümlerde yine yalnız sahibine gider", () => {
    const short: S = { ...A, commonWord: "AT", infiltratorWord: "EŞEK" };
    expect(sizma.secrets(short).map((x) => x.value)).toEqual(["EŞEK"]);
    expect(priv(short, "pa1", T0).word).toBe("AT");
    expect(priv(short, "pc3", T0).word).toBe("EŞEK");
    expect(JSON.stringify(sizma.publicView(short, ctx(T0, players)))).not.toContain("AT");
  });

  it("havuzda kelimesi 3 harften kısa olanlar kontrollü: tüm kelimeler büyük harf ve görünümde yalnız word alanında", () => {
    for (const [x, y] of SIZMA_PAIRS) {
      for (const w of [x, y]) {
        const s: S = { ...A, commonWord: w.toLocaleUpperCase("tr-TR"), infiltratorWord: "ZZZZ" };
        const json = JSON.stringify(sizma.publicView(s, ctx(T0, players)));
        expect(json).not.toContain(s.commonWord);
      }
    }
  });

  it("oy ve Tamam listesi: kilitleyenler görünür, oylar değil", () => {
    let s = vote(A, "pa1", "pb2");
    s = ok(s, "pa1", { kind: "lock" }, VOTE_AT + 500);
    const p = pub(s, VOTE_AT + 600);
    expect(p.ready).toEqual(["pa1"]);
    expect(JSON.stringify(p)).not.toMatch(/votes|tally|myVote/);
    expect(priv(s, "pb2", VOTE_AT + 600)).toEqual({
      word: "ÇAY",
      myVote: null,
      myNotice: null,
      locked: false,
    });
  });
});

describe("sızma erken bitiş: oylamada Tamam", () => {
  const P = ["a", "b", "c"];

  it("(a) herkes kilitleyince oylama 1 sn sonra biter, oylar açılır; puanlama aynı", () => {
    let s = cast(P, "c", [
      ["a", "c"],
      ["b", "c"],
      ["c", "a"],
    ]);
    for (const id of P) s = ok(s, id, { kind: "lock" }, VOTE_AT + 2_000);
    expect(s.voteEndsAt).toBe(VOTE_AT + 3_000);
    expect(pub(s, VOTE_AT + 2_999).phase).toBe("vote");
    expect(pub(s, VOTE_AT + 3_000).phase).toBe("notice");
    const ne = VOTE_AT + 3_000 + SIZMA_NOTICE_MS;
    expect(pub(s, ne).phase).toBe("reveal");
    expect(pub(s, ne).reveal?.scores).toEqual({ a: 1, b: 1, c: 0 });
    expect(sizma.isFinished(s, ctx(ne + SIZMA_REVEAL_MS - 1, P))).toBe(false);
    expect(sizma.isFinished(s, ctx(ne + SIZMA_REVEAL_MS, P))).toBe(true);
    expect(sizma.result(s).awards).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("(b) bir kişi eksikken bitmez; oysuz kilitlenemez", () => {
    let s = cast(P, "c", [
      ["a", "b"],
      ["b", "a"],
    ]);
    s = ok(s, "a", { kind: "lock" }, VOTE_AT + 2_000);
    s = ok(s, "b", { kind: "lock" }, VOTE_AT + 2_000);
    expect(s.voteEndsAt).toBe(VOTE_END);
    expect(rej(start(P), "a", { kind: "lock" }, VOTE_AT)).toBe("nothing_to_lock");
  });

  it("(c) bağlantısı kopan oyuncu beklenmez", () => {
    const conn = ["a", "b"];
    let s = start(P);
    s = vote(s, "a", "b", VOTE_AT, conn);
    s = vote(s, "b", "a", VOTE_AT, conn);
    s = ok(s, "a", { kind: "lock" }, VOTE_AT + 1_000, conn);
    s = ok(s, "b", { kind: "lock" }, VOTE_AT + 1_000, conn);
    expect(s.voteEndsAt).toBe(VOTE_AT + 2_000);
  });

  it("(d) kilitten sonra oy değiştirme ve ikinci kilit reddedilir; kapanış penceresinde yeni oy kabul edilmez", () => {
    let s = cast(P, "c", [["a", "b"]]);
    s = ok(s, "a", { kind: "lock" }, VOTE_AT + 500);
    expect(rej(s, "a", { kind: "lock" }, VOTE_AT + 600)).toBe("locked");
    expect(rej(s, "a", { kind: "vote", target: "c" }, VOTE_AT + 600)).toBe("locked");
    const conn = ["a", "b"];
    let t = start(P);
    t = vote(t, "a", "b", VOTE_AT, conn);
    t = vote(t, "b", "a", VOTE_AT, conn);
    t = ok(t, "a", { kind: "lock" }, VOTE_AT + 500, conn);
    t = ok(t, "b", { kind: "lock" }, VOTE_AT + 500, conn);
    expect(rej(t, "c", { kind: "vote", target: "a" }, VOTE_AT + 800)).toBe("closed");
    expect(rej(t, "c", { kind: "vote", target: "a" }, VOTE_AT + 1_500)).toBe("ended");
  });

  it("(e) kilit listesi oyları sızdırmaz", () => {
    let s = cast(P, "c", [
      ["a", "b"],
      ["b", "c"],
    ]);
    s = ok(s, "a", { kind: "lock" }, VOTE_AT + 500);
    const p = pub(s, VOTE_AT + 600);
    expect(p.ready).toEqual(["a"]);
    expect(JSON.stringify(p)).not.toMatch(/votes|tally|myVote/);
    expect(priv(s, "a", VOTE_AT + 600)).toMatchObject({ myVote: "b", locked: true });
    expect(priv(s, "b", VOTE_AT + 600)).toMatchObject({ myVote: "c", locked: false });
  });

  it("(f) tick bağlantıya bakmaz", () => {
    let s = cast(P, "c", [["a", "b"]]);
    s = ok(s, "a", { kind: "lock" }, VOTE_AT + 500);
    expect(tick(s, VOTE_END + 5, [])).toEqual(tick(s, VOTE_END + 5, P));
  });

  it("ipucundan oylamaya erken geçiş sonrası da Tamam ile hızlı kapanış zinciri çalışır", () => {
    let s = start(P);
    for (const id of P) s = ok(s, id, { kind: "skip" }, T0 + 10_000);
    const base = T0 + 11_000;
    for (const id of P) s = ok(s, id, { kind: "vote", target: "a" }, base + 100);
    for (const id of P) s = ok(s, id, { kind: "lock" }, base + 2_000);
    expect(s.voteEndsAt).toBe(base + 3_000);
    expect(sizma.isFinished(s, ctx(base + 3_000 + SIZMA_NOTICE_MS + SIZMA_REVEAL_MS, P))).toBe(true);
  });
});

describe("sızma: fark ettin mi? (O11)", () => {
  const P = ["a", "b", "c", "d"];
  const N_AT = VOTE_END + 1_000;
  const notice = (s: S, id: string, yes: boolean, at = N_AT, connected?: readonly string[]) =>
    ok(s, id, { kind: "notice", yes }, at, connected);
  /** c sızma; oylar: a ve b c'ye (yakalanır) ya da dağınık (kurtulur). */
  const caught = () =>
    cast(P, "c", [
      ["a", "c"],
      ["b", "c"],
      ["d", "a"],
    ]);
  const escaped = () =>
    cast(P, "c", [
      ["a", "b"],
      ["b", "a"],
      ["d", "a"],
    ]);

  it("oylamadan sonra 8 sn'lik aşama gelir, sonra sonuç; aşama sırası vote -> notice -> reveal", () => {
    const s = caught();
    expect(pub(s, VOTE_END - 1).phase).toBe("vote");
    expect(pub(s, VOTE_END).phase).toBe("notice");
    expect(pub(s, NOTICE_END - 1).phase).toBe("notice");
    expect(pub(s, NOTICE_END).phase).toBe("reveal");
    expect(pub(s, VOTE_END).noticeEndsAt).toBe(NOTICE_END);
    expect(s.finishAt).toBe(NOTICE_END + SIZMA_REVEAL_MS);
  });

  it("cevap yalnız bu aşamada kabul edilir", () => {
    const s = caught();
    expect(rej(s, "a", { kind: "notice", yes: true }, VOTE_AT)).toBe("not_notice_yet");
    expect(rej(s, "a", { kind: "notice", yes: true }, VOTE_END - 1)).toBe("not_notice_yet");
    expect(rej(s, "a", { kind: "notice", yes: true }, NOTICE_END)).toBe("ended");
    expect(rej(s, "ghost", { kind: "notice", yes: true }, N_AT)).toBe("not_participant");
    // oylama bittikten sonra oy ve Tamam reddedilir
    expect(rej(s, "a", { kind: "vote", target: "b" }, N_AT)).toBe("ended");
  });

  it("cevap tek seferliktir", () => {
    let s = caught();
    s = notice(s, "a", false);
    expect(rej(s, "a", { kind: "notice", yes: true }, N_AT + 100)).toBe("locked");
  });

  it("sızma Evet derse +1: yakalanmışsa 0+1, kurtulmuşsa 2+1", () => {
    let c = caught();
    c = notice(c, "c", true);
    expect(sizma.result(tick(c, NOTICE_END)).awards).toEqual({ a: 1, b: 1, c: 1, d: 1 });
    let e = escaped();
    e = notice(e, "c", true);
    expect(sizma.result(tick(e, NOTICE_END)).awards).toEqual({ a: 0, b: 0, c: 3, d: 0 });
  });

  it("sızma Hayır derse ya da cevap vermezse ek puan yok", () => {
    const hayir = notice(caught(), "c", false);
    expect(sizma.result(hayir).awards).toEqual({ a: 1, b: 1, c: 0, d: 1 });
    expect(sizma.result(caught()).awards).toEqual({ a: 1, b: 1, c: 0, d: 1 });
    expect(sizma.result(notice(escaped(), "c", false)).awards).toEqual({ a: 0, b: 0, c: 2, d: 0 });
  });

  it("sızma olmayanlar Evet ya da Hayır derse hiçbir şey kazanmaz ya da kaybetmez", () => {
    let s = caught();
    s = notice(s, "a", true);
    s = notice(s, "b", false);
    s = notice(s, "d", true);
    expect(sizma.result(s).awards).toEqual({ a: 1, b: 1, c: 0, d: 1 });
    let e = escaped();
    e = notice(e, "a", true);
    e = notice(e, "b", true);
    e = notice(e, "d", true);
    expect(sizma.result(e).awards).toEqual({ a: 0, b: 0, c: 2, d: 0 });
  });

  it("herkes cevaplayınca aşama 1 sn sonra biter, sonuç süresi buna göre kayar", () => {
    let s = caught();
    for (const id of P) s = notice(s, id, id === "c", N_AT);
    expect(s.noticeEndsAt).toBe(N_AT + 1_000);
    expect(pub(s, N_AT + 999).phase).toBe("notice");
    expect(pub(s, N_AT + 1_000).phase).toBe("reveal");
    expect(sizma.isFinished(s, ctx(N_AT + 1_000 + SIZMA_REVEAL_MS - 1, P))).toBe(false);
    expect(sizma.isFinished(s, ctx(N_AT + 1_000 + SIZMA_REVEAL_MS, P))).toBe(true);
    expect(pub(s, N_AT + 1_000).reveal?.selfNoticed).toBe(true);
  });

  it("bir kişi eksikken bitmez; kopuk oyuncu beklenmez", () => {
    let s = caught();
    for (const id of ["a", "b", "c"]) s = notice(s, id, false);
    expect(s.noticeEndsAt).toBe(NOTICE_END);
    let t = caught();
    const conn = ["a", "b", "c"];
    for (const id of conn) t = notice(t, id, false, N_AT, conn);
    expect(t.noticeEndsAt).toBe(N_AT + 1_000);
  });

  it("tick bağlantıya bakmaz", () => {
    const s = notice(caught(), "a", true);
    expect(tick(s, NOTICE_END + 5, [])).toEqual(tick(s, NOTICE_END + 5, P));
  });

  it("sonuçta yalnız sızmanın cevabı açılır (selfNoticed); diğerlerinin cevabı hiçbir alanda yok", () => {
    let s = caught();
    s = notice(s, "a", true);
    s = notice(s, "b", true);
    s = notice(s, "c", false);
    const r = pub(s, NOTICE_END).reveal;
    expect(r?.selfNoticed).toBe(false);
    expect(Object.keys(r ?? {}).sort()).toEqual(
      [
        "caught",
        "commonWord",
        "infiltrator",
        "infiltratorWord",
        "scores",
        "selfNoticed",
        "tally",
        "votes",
      ].sort(),
    );
    const yes = notice(caught(), "c", true);
    expect(pub(yes, NOTICE_END).reveal?.selfNoticed).toBe(true);
  });

  it("parseAction: notice yalnız {kind, yes: boolean}", () => {
    expect(sizma.parseAction({ kind: "notice", yes: true })).toEqual({ kind: "notice", yes: true });
    expect(sizma.parseAction({ kind: "notice", yes: false })).toEqual({ kind: "notice", yes: false });
    for (const bad of [
      { kind: "notice" },
      { kind: "notice", yes: "evet" },
      { kind: "notice", yes: 1 },
      { kind: "notice", yes: true, x: 1 },
    ])
      expect(sizma.parseAction(bad)).toBeNull();
  });

  it("tekrar oynatma: aynı tohum ve eylemler aynı sonucu verir", () => {
    const run = () => {
      let s = sizma.setup(P, ctx(T0, P, 21));
      s = notice(s, s.infiltrator, true);
      return JSON.stringify([s, pub(s, NOTICE_END), sizma.result(s)]);
    };
    expect(run()).toBe(run());
  });

  describe("gizlilik", () => {
    const players = ["pa1", "pb2", "pc3", "pd4"];
    /** pc3 ve pa1 sızma; her iki durumda herkes Evet derse ve iki farklı cevap kümesiyle ortak görünüm aynı olmalı. */
    const make = (infiltrator: string, answers: Record<string, boolean>): S => {
      let s: S = { ...start(players, infiltrator) };
      for (const [id, yes] of Object.entries(answers)) s = notice(s, id, yes, N_AT);
      return s;
    };
    const A = make("pc3", { pa1: true, pc3: true });
    const B = make("pa1", { pa1: false, pc3: false });

    it("aşama sürerken publicView hangi cevapların ne olduğunu ve sızmayı içermez; cevaplar değişince birebir aynı", () => {
      for (const at of [VOTE_END, N_AT + 100, NOTICE_END - 1]) {
        const a = JSON.stringify(sizma.publicView(tick(A, at), ctx(at, players)));
        const b = JSON.stringify(sizma.publicView(tick(B, at), ctx(at, players)));
        expect(a).toBe(b);
        expect(a).not.toMatch(/selfNoticed|infiltrator|"yes|myNotice/);
        expect(sizma.publicView(tick(A, at), ctx(at, players)).reveal).toBeNull();
      }
    });

    it("kimlerin cevapladığı görünür (hepsi cevaplar), ne cevapladığı değil", () => {
      const p = pub(A, N_AT + 100);
      expect(p.ready.sort()).toEqual(["pa1", "pc3"]);
      expect(pub(start(players, "pc3"), VOTE_END).ready).toEqual([]);
    });

    it("myNotice yalnız sahibinin görünümünde; başkalarının cevabı görünümde yok", () => {
      const at = N_AT + 100;
      expect(priv(A, "pa1", at).myNotice).toBe(true);
      expect(priv(A, "pc3", at).myNotice).toBe(true);
      for (const who of ["pb2", "pd4", null, "ghost"]) expect(priv(A, who, at).myNotice).toBeNull();
      expect(priv(B, "pa1", at).myNotice).toBe(false);
      // Sızma olan ile olmayanın görünümü biçim olarak aynıdır
      expect(Object.keys(priv(A, "pc3", at))).toEqual(Object.keys(priv(A, "pa1", at)));
      // Cevap vermeyenin görünümü sızma/cevap bilgisi taşımaz
      expect(JSON.stringify(priv(A, "pb2", at))).toBe(JSON.stringify(priv(B, "pb2", at)));
    });

    it("sızma ile olmayanın cevabı dışarıdan ayırt edilemez: aynı cevap, farklı sızma -> ortak görünüm aynı", () => {
      const x = make("pc3", { pa1: true });
      const y = make("pa1", { pa1: true });
      for (const at of [N_AT + 100, NOTICE_END - 1]) {
        expect(JSON.stringify(sizma.publicView(tick(x, at), ctx(at, players)))).toBe(
          JSON.stringify(sizma.publicView(tick(y, at), ctx(at, players))),
        );
      }
    });

    it("sonuç açılana kadar bütün cevaplar gizli; secrets() sonuç açılınca boş", () => {
      expect(sizma.secrets(tick(A, NOTICE_END))).toEqual([]);
      expect(pub(A, NOTICE_END).reveal?.selfNoticed).toBe(true);
    });
  });
});
