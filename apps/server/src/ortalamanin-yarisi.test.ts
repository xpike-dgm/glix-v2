import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 2000;
async function choose(c: Client, value: number): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload: { kind: "choose", value } });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

interface Reveal {
  choices: Record<string, number>;
  mean: number;
  target: number;
  order: string[];
  points: Record<string, number>;
}
interface Pub {
  endsAt: number;
  round: number;
  rounds: number;
  multiplier: { num: number; den: number };
  previous: { mean: number; target: number; multiplier: { num: number; den: number } }[];
  totals: Record<string, number>;
  final: null | Record<string, number>;
  reveal: null | Reveal;
}

async function startGame(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["ortalamanin-yarisi"] });
  await until(() => host.room.gameIds.join() === "ortalamanin-yarisi", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
}

describe("ortalamaya en yakın: oda içinde tam maç (3 tur)", () => {
  it("seçimler gizli kalır; 3 tur çarpan ½, ⅔, ¾; genel skor yalnız sonda toplamdan verilir; göndermeyene sayı atanır", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    await startGame(cs);
    const pub = () => a.room.match?.publicView as Pub;
    const ids = cs.map((x) => x.session.playerId) as [string, string, string, string];

    // Tur 1
    expect(pub()).toMatchObject({ round: 1, rounds: 3, multiplier: { num: 1, den: 2 }, previous: [] });
    expect(await choose(a, 90)).toBe(true);
    expect(await choose(a, 20)).toBe(true); // değiştirilebilir
    expect(await choose(b, 22)).toBe(true);
    expect(await choose(c, 101)).toBe(false); // aralık dışı
    expect(await choose(c, 1.5)).toBe(false);
    expect(await choose(c, 60)).toBe(true);
    // d göndermez -> sunucu atar
    await sync();

    // Süre bitmeden: herkes yalnız kendi seçimini görür; ortak görünüm seçim taşımaz.
    expect(cs.map((x) => (x.room.match?.view as { myChoice: number | null } | undefined)?.myChoice)).toEqual([
      20,
      22,
      60,
      null,
    ]);
    for (const x of cs) {
      expect((x.room.match?.publicView as Pub | undefined)?.reveal).toBeNull();
      const raw = JSON.stringify(x.room.match);
      expect(raw).not.toContain('"choices"');
      expect(raw).not.toContain('"target"');
      expect(raw).not.toContain('"mean"');
    }

    k.clock.advance(10_100 - 60 * 5);
    await until(() => pub().reveal !== null, "1. tur açıldı");
    expect(await choose(d, 10)).toBe(false); // süre doldu

    const r1 = pub().reveal as Reveal;
    expect([r1.choices[ids[0]], r1.choices[ids[1]], r1.choices[ids[2]]]).toEqual([20, 22, 60]);
    const dv = r1.choices[ids[3]] as number;
    expect(Number.isInteger(dv) && dv >= 0 && dv <= 100).toBe(true);
    const sum = 20 + 22 + 60 + dv;
    expect(r1.mean).toBeCloseTo(sum / 4, 10);
    expect(r1.target).toBeCloseTo(sum / 8, 10);
    expect(pub().final).toBeNull();
    // Tur puanı mini puana yazılır; genel skor henüz değişmez.
    expect(pub().totals).toEqual(r1.points);
    expect(a.room.players.map((p) => p.score)).toEqual([0, 0, 0, 0]);

    // Tur 2: önceki ortalama ve hedef görünür, çarpan ⅔.
    k.clock.advance(5_000);
    await until(() => pub().round === 2, "2. tur");
    expect(pub()).toMatchObject({ reveal: null, multiplier: { num: 2, den: 3 } });
    expect(pub().previous).toHaveLength(1);
    expect(pub().previous[0]?.mean).toBeCloseTo(r1.mean, 10);
    expect(pub().previous[0]?.target).toBeCloseTo(r1.target, 10);
    expect(await choose(a, 30)).toBe(true);
    expect(await choose(b, 31)).toBe(true);
    expect(await choose(c, 80)).toBe(true);
    expect(await choose(d, 33)).toBe(true);
    k.clock.advance(10_100);
    await until(() => pub().reveal !== null, "2. tur açıldı");
    const r2 = pub().reveal as Reveal;
    expect(r2.target).toBeCloseTo(((30 + 31 + 80 + 33) / 4) * (2 / 3), 10);

    // Tur 3: ¾; son sonuç genel skoru getirir.
    k.clock.advance(5_000);
    await until(() => pub().round === 3, "3. tur");
    expect(pub().multiplier).toEqual({ num: 3, den: 4 });
    expect(pub().previous).toHaveLength(2);
    for (const [i, x] of [a, b, c, d].entries())
      expect(await choose(x, [10, 50, 90, 50][i] as number)).toBe(true);
    k.clock.advance(10_100);
    await until(() => pub().reveal !== null, "3. tur açıldı");
    const r3 = pub().reveal as Reveal;
    expect(r3.target).toBeCloseTo(37.5, 10);
    const totals = Object.fromEntries(
      ids.map((id) => [id, (r1.points[id] ?? 0) + (r2.points[id] ?? 0) + (r3.points[id] ?? 0)]),
    );
    expect(pub().totals).toEqual(totals);
    const final = pub().final as Record<string, number>;
    expect(Math.max(...Object.values(final))).toBeLessThanOrEqual(2);

    k.clock.advance(7_000);
    await until(() => a.room.phase === "results", "sonuç");
    const result = a.room.match?.result;
    expect(result?.miniScores).toEqual(totals);
    expect(result?.awards).toEqual(final);
    const expectScores = ids.map((id) => final[id] ?? 0);
    expect(a.room.players.map((p) => p.score)).toEqual(expectScores);
    expect(d.room.players.map((p) => p.score)).toEqual(expectScores);
    expect(b.room.phase).toBe("results");
  });

  it("herkes aynı sayıyı seçerse her tur eşit; toplamda eşitlik: liderlerin hepsi +1", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    await startGame(cs);
    const a = cs[0] as Client;
    for (let round = 0; round < 3; round++) {
      for (const c of cs) expect(await choose(c, 40)).toBe(true);
      k.clock.advance(10_100);
      await sync();
      k.clock.advance(round < 2 ? 5_000 : 7_000);
      await sync();
    }
    await until(() => a.room.phase === "results", "sonuç");
    // Her turda üçü de eşit en yakın: +1 x 3 tur = 3'er; toplam eşit -> hepsi +1.
    expect(Object.values(a.room.match?.result?.miniScores ?? {})).toEqual([3, 3, 3]);
    expect(Object.values(a.room.match?.result?.awards ?? {})).toEqual([1, 1, 1]);
    expect(a.room.players.map((p) => p.score)).toEqual([1, 1, 1]);
  });

  it("bağlı herkes kilitleyince o tur erken biter ve sonraki tur erken başlar", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    await startGame(cs);
    const a = cs[0] as Client;
    const pub = () => a.room.match?.publicView as Pub;
    for (const c of cs) expect(await choose(c, 40)).toBe(true);
    for (const c of cs) c.send({ type: "action", seq: ++seq, payload: { kind: "lock" } });
    await sync();
    k.clock.advance(1_100);
    await until(() => pub().reveal !== null, "erken açıldı");
    expect(pub().round).toBe(1);
    k.clock.advance(5_000);
    await until(() => pub().round === 2, "2. tur erken başladı");
  });
});
