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

describe("ortalamaya en yakın: oda içinde tam maç", () => {
  it("seçimler gizli kalır; sonuç açılır, puanlar genel skora eklenir; göndermeyene sayı atanır", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    await startGame(cs);
    const pub = () => a.room.match?.publicView as Pub;

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

    k.clock.advance(20_100 - 60 * 5);
    await until(() => pub().reveal !== null, "seçimler açıldı");
    expect(await choose(d, 10)).toBe(false); // süre doldu

    const ids = cs.map((x) => x.session.playerId) as [string, string, string, string];
    const r = pub().reveal as Reveal;
    expect([r.choices[ids[0]], r.choices[ids[1]], r.choices[ids[2]]]).toEqual([20, 22, 60]);
    const dv = r.choices[ids[3]] as number;
    expect(Number.isInteger(dv) && dv >= 0 && dv <= 100).toBe(true);
    const sum = 20 + 22 + 60 + dv;
    expect(r.mean).toBeCloseTo(sum / 4, 10);
    expect(r.target).toBeCloseTo(sum / 8, 10);
    expect(r.order[0]).toBe(
      [...ids].sort(
        (x, y) =>
          Math.abs((r.choices[x] as number) - r.target) - Math.abs((r.choices[y] as number) - r.target),
      )[0],
    );

    k.clock.advance(7_000);
    await until(() => a.room.phase === "results", "sonuç");
    const result = a.room.match?.result;
    expect(result?.awards).toEqual(r.points);
    expect(result?.miniScores).toEqual(r.points);
    const total = Object.values(r.points).reduce((x, y) => x + y, 0);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(4);
    const expectScores = ids.map((id) => r.points[id] ?? 0);
    expect(a.room.players.map((p) => p.score)).toEqual(expectScores);
    expect(d.room.players.map((p) => p.score)).toEqual(expectScores);
    expect(b.room.phase).toBe("results");
  });

  it("en yakınlar eşitse hepsi +1 alır", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    await startGame(cs);
    for (const c of cs) expect(await choose(c, 40)).toBe(true); // ortalama 40, hedef 20; üçü de eşit
    k.clock.advance(20_100);
    const a = cs[0] as Client;
    k.clock.advance(7_000);
    await until(() => a.room.phase === "results", "sonuç");
    expect(Object.values(a.room.match?.result?.awards ?? {})).toEqual([1, 1, 1]);
    expect(a.room.players.map((p) => p.score)).toEqual([1, 1, 1]);
  });
});
