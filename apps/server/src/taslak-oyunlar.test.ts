import { GAMES } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { effectiveCatalog } from "./gameSwitches.js";
import { pickRandomGames } from "./match.js";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

// Taslak yolu AÇIK sunucu (GLIX_TASLAK_OYUNLAR=1 karşılığı): oyunlar yalnız elle seçilebilir ve gerçek protokolle
// oynanır. Bu dosya `GAMES`'i değiştirir; kapalı yol testleri taslak-kapali.test.ts'tedir.
useServer({ draftGames: true });

let seq = 9000;
async function send(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

async function startGame(cs: Client[], gameId: string): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: [gameId] });
  await until(() => host.room.gameIds.join() === gameId, "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
}

describe("taslak yolu açıkken", () => {
  it("oyunlar katalogda randomPool:false ile görünür, rastgele havuza girmez", async () => {
    const [host] = await setupRoom(["A", "B", "C"]);
    for (const id of ["ortak-nokta", "tek-ve-kucuk", "sessiz-sira"]) {
      expect(Object.hasOwn(GAMES, id)).toBe(true);
      expect(host?.room.catalog.find((g) => g.id === id)?.randomPool).toBe(false);
    }
    expect(pickRandomGames(k.srv.runtime, 5, 500).filter((id) => GAMES[id]?.randomPool === false)).toEqual(
      [],
    );
  });

  it("yönetici 'rastgele seçimde' dese bile taslak oyun havuza giremez", () => {
    const eff = effectiveCatalog({
      "ortak-nokta": { random: true },
      "tek-ve-kucuk": { random: true },
      "sessiz-sira": { random: true },
    });
    for (const id of ["ortak-nokta", "tek-ve-kucuk", "sessiz-sira"]) {
      expect(eff.find((g) => g.id === id)?.randomPool).toBe(false);
    }
  });
});

describe("ortak nokta: oda içinde tam maç", () => {
  it("seçimler gizli kalır, kutu sırası kişiye özel; sonuç herkese açılır; maç sonunda puanlar işlenir", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    await startGame(cs, "ortak-nokta");
    interface Pub {
      round: number;
      phase: string;
      reveal: null | { picks: Record<string, number>; points: Record<string, number> };
      final: null | Record<string, number>;
      totals: Record<string, number>;
      board: unknown[];
    }
    interface Priv {
      layout: number[];
      myTile: number | null;
    }
    const pub = () => a.room.match?.publicView as Pub;
    const priv = (x: Client) => x.room.match?.view as Priv;
    const ids = cs.map((x) => x.session.playerId);

    for (let round = 1; round <= 4; round++) {
      await until(() => pub().round === round && pub().phase === "choose", `${round}. tur seçim`);
      expect(pub().board).toHaveLength(6);
      for (const x of cs) expect([...priv(x).layout].sort()).toEqual([0, 1, 2, 3, 4, 5]);
      expect(await send(a, { kind: "choose", tile: 2 })).toBe(true);
      expect(await send(b, { kind: "choose", tile: 2 })).toBe(true);
      expect(await send(c, { kind: "choose", tile: 2 })).toBe(true);
      expect(await send(d, { kind: "choose", tile: 9 })).toBe(false);
      expect(await send(d, { kind: "choose", tile: round % 2 === 0 ? 4 : 5 })).toBe(true);
      await sync();
      // Süre bitmeden kimse başkasının seçimini görmez.
      expect(priv(a).myTile).toBe(2);
      expect(priv(d).myTile).toBe(round % 2 === 0 ? 4 : 5);
      for (const x of cs) {
        expect(pub().reveal).toBeNull();
        const raw = JSON.stringify(x.room.match);
        expect(raw).not.toContain('"picks"');
        expect(raw).not.toContain('"groups"');
      }
      expect(await send(a, { kind: "lock" })).toBe(true);
      expect(await send(b, { kind: "lock" })).toBe(true);
      expect(await send(c, { kind: "lock" })).toBe(true);
      expect(await send(d, { kind: "lock" })).toBe(true);
      k.clock.advance(1_100);
      await until(() => pub().reveal !== null, `${round}. tur açıldı`);
      const rev = pub().reveal;
      expect(rev?.picks[ids[0] as string]).toBe(2);
      expect(rev?.points[ids[0] as string]).toBe(3 + 0); // 2 eşleşen + 1 bonus
      expect(await send(a, { kind: "choose", tile: 0 })).toBe(false); // sonuç aşamasında seçim yok
      k.clock.advance(round === 4 ? 7_000 : 5_000);
      await sync();
    }
    await until(() => a.room.phase === "results", "sonuç");
    const result = a.room.match?.result;
    expect(result?.miniScores[ids[0] as string]).toBe(12);
    expect(result?.miniScores[ids[3] as string]).toBe(0);
    // Üç lider eşit -> liderler +1.
    expect(a.room.players.map((p) => p.score)).toEqual([1, 1, 1, 0]);
  });
});

describe("tek ve küçük: oda içinde tam maç", () => {
  it("en küçük tek sayı kazanır; seçimler süre dolana kadar gizli", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    await startGame(cs, "tek-ve-kucuk");
    interface Pub {
      round: number;
      phase: string;
      max: number;
      reveal: null | { winner: string | null; winningValue: number | null };
    }
    const pub = () => a.room.match?.publicView as Pub;
    const ids = cs.map((x) => x.session.playerId);
    expect(pub().max).toBe(6);

    for (let round = 1; round <= 5; round++) {
      await until(() => pub().round === round && pub().phase === "choose", `${round}. tur`);
      expect(await send(a, { kind: "choose", value: 1 })).toBe(true);
      expect(await send(b, { kind: "choose", value: 1 })).toBe(true);
      expect(await send(c, { kind: "choose", value: 3 })).toBe(true);
      expect(await send(d, { kind: "choose", value: 7 })).toBe(false); // aralık dışı (4 kişide 1–6)
      expect(await send(d, { kind: "choose", value: 4 })).toBe(true);
      await sync();
      const raw = JSON.stringify(b.room.match);
      expect(raw).not.toContain('"picks"');
      expect(raw).not.toContain('"counts"');
      expect((b.room.match?.view as { myValue: number } | undefined)?.myValue).toBe(1);
      k.clock.advance(10_100);
      await until(() => pub().reveal !== null, `${round}. tur açıldı`);
      expect(pub().reveal?.winningValue).toBe(3);
      expect(pub().reveal?.winner).toBe(ids[2]);
      k.clock.advance(round === 5 ? 6_000 : 4_000);
      await sync();
    }
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.match?.result?.miniScores[ids[2] as string]).toBe(15);
    expect(a.room.players.map((p) => p.score)).toEqual([0, 0, 2, 0]);
  });
});

describe("sessiz sıra: oda içinde tam maç", () => {
  it("elleri yalnız sahibi görür; doğru sırayla oynanırsa takım canı korunur ve ödül verilir", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    await startGame(cs, "sessiz-sira");
    const a = cs[0] as Client;
    interface Pub {
      round: number;
      phase: string;
      lives: number;
      counts: Record<string, number>;
      plays: { playerId: string; card: number; ok: boolean }[];
      final: null | Record<string, number>;
      dead: boolean;
    }
    const pub = () => a.room.match?.publicView as Pub;
    const hand = (x: Client) => (x.room.match?.view as { hand: number[] } | undefined)?.hand ?? [];
    const ids = cs.map((x) => x.session.playerId);

    for (let round = 1; round <= 3; round++) {
      await until(() => pub().round === round && pub().phase === "look", `${round}. tur bakma`);
      const per = round === 1 ? 1 : 2;
      for (const x of cs) expect(hand(x)).toHaveLength(per);
      // Ortak görünüm elleri taşımaz; kişisel görünüm yalnız sahibinin elini taşır.
      const allCards = cs.flatMap(hand);
      expect(new Set(allCards).size).toBe(allCards.length);
      for (const x of cs) {
        const publicView = x.room.match?.publicView as Record<string, unknown>;
        expect(Object.keys(publicView)).not.toContain("hand");
        expect(publicView.plays).toEqual([]);
        expect(publicView.missed).toEqual([]);
        expect(x.room.match?.view).toEqual({ hand: hand(x) });
      }
      expect(await send(a, { kind: "play" })).toBe(false); // bakma aşamasında oynanmaz
      k.clock.advance(3_100);
      await until(() => pub().phase === "play", `${round}. tur oynama`);
      const order = cs.flatMap((x) => hand(x).map((card) => ({ x, card }))).sort((p, q) => p.card - q.card);
      for (const { x, card } of order) {
        expect(await send(x, { kind: "play" })).toBe(true);
        await sync();
        expect(pub().plays.at(-1)).toMatchObject({ card, ok: true });
      }
      expect(pub().lives).toBe(3);
      k.clock.advance(1_100);
      await until(() => pub().phase === "reveal", `${round}. tur sonucu`);
      k.clock.advance(round === 3 ? 5_100 : 3_100);
      await sync();
    }
    await until(() => a.room.phase === "results", "sonuç");
    const result = a.room.match?.result;
    // Herkes 5 doğru hamle yaptı (1+2+2): eşit liderler +1.
    expect(Object.values(result?.miniScores ?? {})).toEqual([5, 5, 5]);
    expect(a.room.players.map((p) => p.score)).toEqual([1, 1, 1]);
    void ids;
  });

  it("hatalı hamle can götürür; süre dolması da; canlar bitince takım batar ve kimse genel skor almaz", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    await startGame(cs, "sessiz-sira");
    const a = cs[0] as Client;
    interface Pub {
      phase: string;
      lives: number;
      dead: boolean;
      round: number;
      missed: unknown[];
    }
    const pub = () => a.room.match?.publicView as Pub;
    const hand = (x: Client) => (x.room.match?.view as { hand: number[] } | undefined)?.hand ?? [];
    k.clock.advance(3_100);
    await until(() => pub().phase === "play", "oynama");
    // 1. tur: en büyük kartı en önce oynatır -> hata, diğer iki kart açılır.
    const biggest = [...cs].sort((p, q) => (hand(q)[0] ?? 0) - (hand(p)[0] ?? 0))[0] as Client;
    expect(await send(biggest, { kind: "play" })).toBe(true);
    await sync();
    expect(pub().lives).toBe(2);
    expect(pub().missed).toHaveLength(2);
    for (const x of cs) expect(hand(x)).toEqual([]);
    k.clock.advance(1_100);
    await until(() => pub().phase === "reveal", "tur sonucu");
    // 2. ve 3. turlar: kimse oynamaz, süre dolar, her seferinde 1 can gider.
    for (const round of [2, 3]) {
      k.clock.advance(round === 2 ? 3_100 : 3_100);
      await until(() => pub().round === round && pub().phase === "look", `${round}. tur`);
      k.clock.advance(3_100);
      await until(() => pub().phase === "play", `${round}. tur oynama`);
      k.clock.advance(22_100);
      await until(() => pub().phase === "reveal", `${round}. tur süre doldu`);
      expect(pub().lives).toBe(3 - round);
    }
    expect(pub().dead).toBe(true);
    k.clock.advance(5_100);
    await until(() => a.room.phase === "results", "sonuç");
    expect(Object.values(a.room.match?.result?.awards ?? {})).toEqual([0, 0, 0]);
    expect(a.room.players.map((p) => p.score)).toEqual([0, 0, 0]);
  });
});
