import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 5000;
async function vote(c: Client, target: string): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload: { kind: "vote", target } });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

interface Pub {
  phase: string;
  reveal: null | { votes: Record<string, string>; scores: Record<string, number> };
}

async function startGame(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["ittifak"] });
  await until(() => host.room.gameIds.join() === "ittifak", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
}

describe("ittifak: oda içinde tam maç", () => {
  it("oylar gizli kalır, eksik oy rastgele atanır, alınan oy genel skora eklenir", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    await startGame(cs);
    const pub = () => a.room.match?.publicView as Pub;
    const ids = cs.map((x) => x.session.playerId) as [string, string, string, string];

    expect(pub().phase).toBe("talk");
    expect(await vote(a, ids[1])).toBe(false); // pazarlık sürerken oy yok
    k.clock.advance(60_100);
    await until(() => pub().phase === "vote", "oylama başladı");

    expect(await vote(a, ids[0])).toBe(false); // kendine oy yok
    expect(await vote(a, ids[2])).toBe(true);
    expect(await vote(a, ids[1])).toBe(true); // değiştirilebilir
    expect(await vote(b, ids[0])).toBe(true);
    expect(await vote(c, ids[1])).toBe(true);
    // d oy vermez -> rastgele bir rakibe gider
    await sync();

    expect(cs.map((x) => (x.room.match?.view as { myVote: string | null } | undefined)?.myVote)).toEqual([
      ids[1],
      ids[0],
      ids[1],
      null,
    ]);
    for (const x of cs) {
      expect((x.room.match?.publicView as Pub | undefined)?.reveal).toBeNull();
      const raw = JSON.stringify(x.room.match);
      expect(raw).not.toContain('"votes"');
      expect(raw).not.toContain('"scores"');
    }

    k.clock.advance(15_000);
    await until(() => pub().reveal !== null, "oylar açıldı");
    expect(await vote(d, ids[0])).toBe(false); // geç oy

    const r = pub().reveal as NonNullable<Pub["reveal"]>;
    expect(r.votes[ids[0]]).toBe(ids[1]);
    expect(r.votes[ids[1]]).toBe(ids[0]);
    expect(r.votes[ids[2]]).toBe(ids[1]);
    const forced = r.votes[ids[3]] as string;
    expect(forced).not.toBe(ids[3]);
    expect(ids).toContain(forced);

    k.clock.advance(8_000);
    await until(() => a.room.phase === "results", "sonuç");
    const expected: Record<string, number> = { [ids[0]]: 1, [ids[1]]: 2, [ids[2]]: 0, [ids[3]]: 0 };
    expected[forced] = (expected[forced] ?? 0) + 1;
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.match?.result?.miniScores).toEqual(expected);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => expected[id]));
    expect(d.room.players.map((p) => p.score)).toEqual(a.room.players.map((p) => p.score));
  });
});
