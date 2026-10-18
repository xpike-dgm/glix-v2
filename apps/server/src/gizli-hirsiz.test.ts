import type { GizliHirsizPublicView, GizliHirsizView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 2000;
async function send(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return { ok: ack.ok, ...(ack.reason ? { reason: ack.reason } : {}) };
}

const pub = (c: Client) => c.room.match?.publicView as GizliHirsizPublicView;
const view = (c: Client) => c.room.match?.view as GizliHirsizView;

/** Bir oyuncunun oyun boyunca aldığı tüm oyun görünümleri (herkese açık + kişisel). */
function seenViews(c: Client): string {
  return JSON.stringify(c.updates.map((u) => [u.snapshot.match?.publicView, u.snapshot.match?.view]));
}

async function newMatch(): Promise<{ cs: Client[]; ids: string[] }> {
  const cs = await setupRoom(["A", "B", "C", "D"]);
  const [a] = cs as [Client, ...Client[]];
  a.send({ type: "setGames", gameIds: ["gizli-hirsiz"] });
  await until(() => a.room.gameIds[0] === "gizli-hirsiz", "oyun seçildi");
  await startPlaying(cs);
  expect(a.room.match?.gameId).toBe("gizli-hirsiz");
  return { cs, ids: cs.map((c) => c.session.playerId) };
}

describe("gizli-hirsiz tam maç", () => {
  it("tek hırsız +1 alır, basış sona kadar gizli kalır ve skor genel puana işlenir", async () => {
    const { cs, ids } = await newMatch();
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    const start = pub(a).startedAt;
    expect(pub(a).endsAt - start).toBe(30_000);

    expect(await send(b, { kind: "bogus" })).toMatchObject({ ok: false });
    expect((await send(b, { kind: "steal" })).ok).toBe(true);
    // İkinci basış yok sayılır ama hata vermez (gizlilik: aynı cevap).
    expect((await send(b, { kind: "steal" })).ok).toBe(true);
    await until(() => view(b).pressed, "kendi basışım");
    k.clock.advance(10_000);
    await sync();

    // Basan kendi basışını bilir; diğerleri ve izleyen kimse bilmez.
    expect(view(b)).toEqual({ pressed: true });
    for (const o of [a, c, d]) expect(view(o)).toEqual({ pressed: false });
    for (const o of cs) expect(pub(o).reveal).toBeNull();
    const bId = b.session.playerId;
    for (const o of [a, c, d]) {
      const seen = seenViews(o);
      expect(seen).not.toContain(bId);
    }

    k.clock.advance(start + 30_000 - 500 - k.clock.now());
    await sync();
    expect(a.room.phase).toBe("playing");
    k.clock.advance(Math.max(0, start + 30_000 - k.clock.now()));
    expect(await send(c, { kind: "steal" })).toMatchObject({ ok: false });
    await until(() => a.room.phase === "results", "sonuç");

    const expected = Object.fromEntries(ids.map((id) => [id, id === bId ? 1 : 0]));
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.match?.result?.miniScores).toEqual(expected);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => expected[id]));
    expect(pub(a).reveal).toEqual({ thieves: [bId], outcome: "solo", scores: expected });
  });

  it("birden çok hırsız -1 alır; basmayan 0", async () => {
    const { cs, ids } = await newMatch();
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    const start = pub(a).startedAt;
    expect((await send(d, { kind: "steal" })).ok).toBe(true);
    k.clock.advance(5_000);
    expect((await send(b, { kind: "steal" })).ok).toBe(true);
    k.clock.advance(start + 30_600 - k.clock.now());
    await until(() => a.room.phase === "results", "sonuç");
    const expected = Object.fromEntries(
      ids.map((id) => [id, id === b.session.playerId || id === d.session.playerId ? -1 : 0]),
    );
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => expected[id]));
    expect(view(c)).toEqual({ pressed: false });
    expect(pub(a).reveal?.outcome).toBe("multi");
  });

  it("kimse basmazsa herkes 0 alır", async () => {
    const { cs, ids } = await newMatch();
    const a = cs[0] as Client;
    k.clock.advance(pub(a).endsAt + 600 - k.clock.now());
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.match?.result?.awards).toEqual(Object.fromEntries(ids.map((id) => [id, 0])));
    expect(pub(a).reveal?.outcome).toBe("none");
  });
});
