import { ittifakAwards } from "@glix/engine";
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
  reveal: null | {
    votes: Record<string, string>;
    scores: Record<string, number>;
    awards: Record<string, number>;
    random: string[];
    promises: Record<string, { to: string; kept: boolean }[]>;
  };
}

async function act(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
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
  it("oylar gizli kalır, eksik oy zarla atanır ve işaretlenir, genel skora +2/+1/0 gider", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    await startGame(cs);
    const pub = () => a.room.match?.publicView as Pub;
    const ids = cs.map((x) => x.session.playerId) as [string, string, string, string];

    expect(pub().phase).toBe("talk");
    expect(await vote(a, ids[1])).toBe(false); // pazarlık sürerken oy yok

    // Söz işaretleri: 4 kişide en çok 1 (IT-M5), kendine yok, yalnız sahibi görür (alıcı dahil kimse görmez).
    const my = (x: Client) => (x.room.match?.view as { myPromises: string[] } | undefined)?.myPromises;
    expect(await act(a, { kind: "promise", target: ids[1], on: true })).toBe(true);
    expect(await act(a, { kind: "promise", target: ids[2], on: true })).toBe(false); // ikinci söz yok
    expect(await act(a, { kind: "promise", target: ids[0], on: true })).toBe(false); // kendine yok
    expect(await act(c, { kind: "promise", target: ids[0], on: true })).toBe(true);
    await sync();
    expect(my(a)).toEqual([ids[1]]);
    for (const x of [b, d]) expect(my(x)).toEqual([]); // alıcı b bile görmez
    expect(JSON.stringify(b.room.match)).not.toContain("kept");
    expect(JSON.stringify(b.room.match?.publicView)).not.toContain("promise");
    // 4 kişide pazarlık 45 sn (IT-M4); ardından 1 sn geçiş bandı.
    k.clock.advance(45_100);
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

    k.clock.advance(16_000);
    await until(() => pub().reveal !== null, "oylar açıldı");
    expect(await vote(d, ids[0])).toBe(false); // geç oy

    const r = pub().reveal as NonNullable<Pub["reveal"]>;
    // a: ids[1]'e tuttu (oy ids[1]); c: ids[0]'a bozdu (oy ids[1]).
    expect(r.promises[ids[0]]).toEqual([{ to: ids[1], kept: true }]);
    expect(r.random).toEqual([ids[3]]); // IT-M3: d oy vermedi
    expect(r.promises[ids[2]]).toEqual([{ to: ids[0], kept: false }]);
    expect(r.votes[ids[0]]).toBe(ids[1]);
    expect(r.votes[ids[1]]).toBe(ids[0]);
    expect(r.votes[ids[2]]).toBe(ids[1]);
    const forced = r.votes[ids[3]] as string;
    expect(forced).not.toBe(ids[3]);
    expect(ids).toContain(forced);

    k.clock.advance(3_000 + 900 * 4);
    await until(() => a.room.phase === "results", "sonuç");
    const votes: Record<string, number> = { [ids[0]]: 1, [ids[1]]: 2, [ids[2]]: 0, [ids[3]]: 0 };
    votes[forced] = (votes[forced] ?? 0) + 1;
    const expected = ittifakAwards(votes);
    expect(r.awards).toEqual(expected);
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.match?.result?.miniScores).toEqual(votes);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => expected[id]));
    expect(d.room.players.map((p) => p.score)).toEqual(a.room.players.map((p) => p.score));
  });
});
