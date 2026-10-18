import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 3000;
async function choose(c: Client, value: number): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload: { kind: "choose", value } });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

interface Reveal {
  choices: Record<string, number | null>;
  status: Record<string, string>;
  points: Record<string, number>;
}
interface Pub {
  reveal: null | Reveal;
}

async function startGame(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["cizgiyi-gecme"] });
  await until(() => host.room.gameIds.join() === "cizgiyi-gecme", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
}

describe("çizgiyi geçme: oda içinde tam maç", () => {
  it("seçimler gizli kalır; aynı bölge pasif, tek kalanlar +2/+1 genel skora eklenir", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    await startGame(cs);
    const pub = () => a.room.match?.publicView as Pub;

    expect(await choose(a, 95)).toBe(true);
    expect(await choose(a, 45)).toBe(true); // değiştirilebilir
    expect(await choose(b, 41)).toBe(true); // a ile aynı bölge (40–49)
    expect(await choose(c, 101)).toBe(false); // aralık dışı
    expect(await choose(c, 72)).toBe(true);
    // d seçmez -> pasif
    await sync();

    expect(cs.map((x) => (x.room.match?.view as { myChoice: number | null } | undefined)?.myChoice)).toEqual([
      45,
      41,
      72,
      null,
    ]);
    for (const x of cs) {
      expect((x.room.match?.publicView as Pub | undefined)?.reveal).toBeNull();
      const raw = JSON.stringify(x.room.match);
      expect(raw).not.toContain('"choices"');
      expect(raw).not.toContain('"status"');
    }

    k.clock.advance(30_100 - 60 * 5);
    await until(() => pub().reveal !== null, "seçimler açıldı");
    expect(await choose(d, 99)).toBe(false); // geç seçim

    const ids = cs.map((x) => x.session.playerId) as [string, string, string, string];
    const r = pub().reveal as Reveal;
    expect(r.choices).toEqual({ [ids[0]]: 45, [ids[1]]: 41, [ids[2]]: 72, [ids[3]]: null });
    expect(r.status).toEqual({
      [ids[0]]: "crashed",
      [ids[1]]: "crashed",
      [ids[2]]: "first",
      [ids[3]]: "none",
    });

    k.clock.advance(7_000);
    await until(() => a.room.phase === "results", "sonuç");
    const awards = { [ids[0]]: 0, [ids[1]]: 0, [ids[2]]: 2, [ids[3]]: 0 };
    expect(a.room.match?.result?.awards).toEqual(awards);
    expect(a.room.match?.result?.miniScores).toEqual(awards);
    expect(a.room.players.map((p) => p.score)).toEqual([0, 0, 2, 0]);
    expect(d.room.players.map((p) => p.score)).toEqual([0, 0, 2, 0]);
    expect(b.room.phase).toBe("results");
  });

  it("iki oyuncu farklı bölgelerde: yüksek +2, düşük +1", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await startGame(cs);
    expect(await choose(a, 100)).toBe(true);
    expect(await choose(b, 99)).toBe(true);
    k.clock.advance(30_100);
    await until(
      () => a.room.match?.publicView !== undefined && (a.room.match.publicView as Pub).reveal !== null,
      "açıldı",
    );
    k.clock.advance(7_000);
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.players.map((p) => p.score)).toEqual([2, 1]);
  });
});
