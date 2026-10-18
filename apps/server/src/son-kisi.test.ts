import type { SonKisiPublicView, SonKisiView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 3000;
async function send(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return { ok: ack.ok, ...(ack.reason ? { reason: ack.reason } : {}) };
}

const pub = (c: Client) => c.room.match?.publicView as SonKisiPublicView;
const view = (c: Client) => c.room.match?.view as SonKisiView;

/** Gizli bitiş bilinmediği için saati küçük adımlarla ilerletir; sonuç aşaması başlayınca durur. */
async function runToResults(a: Client, startedAt: number): Promise<void> {
  for (let t = 500; t <= 21_000 && a.room.phase === "playing"; t += 250) {
    k.clock.advance(Math.max(0, startedAt + t - k.clock.now()));
    await sync();
  }
  await until(() => a.room.phase === "results", "sonuç");
}

async function newMatch(): Promise<{ cs: Client[]; ids: string[]; startedAt: number }> {
  const cs = await setupRoom(["A", "B", "C", "D"]);
  const [a] = cs as [Client, ...Client[]];
  a.send({ type: "setGames", gameIds: ["son-kisi"] });
  await until(() => a.room.gameIds[0] === "son-kisi", "oyun seçildi");
  const { startedAt } = await startPlaying(cs);
  expect(a.room.match?.gameId).toBe("son-kisi");
  return { cs, ids: cs.map((c) => c.session.playerId), startedAt };
}

describe("son-kisi tam maç", () => {
  it("son kaçan(lar) +1, hiç kaçmayan -1; bitiş zamanı ağdan hiç geçmez", async () => {
    const { cs, ids, startedAt } = await newMatch();
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    const goTo = (t: number) => k.clock.advance(Math.max(0, t - k.clock.now()));

    expect(pub(a).tension).toBe(0);
    expect(pub(a).escaped).toEqual([]);
    expect(await send(a, { kind: "bogus" })).toMatchObject({ ok: false });

    goTo(startedAt + 2_000);
    expect((await send(a, { kind: "escape" })).ok).toBe(true);
    expect((await send(a, { kind: "escape" })).ok).toBe(true); // yok sayılır
    await until(() => pub(b).escaped.length === 1, "ilk kaçış");
    expect(pub(b).escaped).toEqual([a.session.playerId]);
    expect(view(a)).toEqual({ escaped: true });
    expect(view(b)).toEqual({ escaped: false });

    // B ve D aynı sunucu milisaniyesinde kaçar: eşit zaman damgası.
    goTo(startedAt + 5_000);
    expect((await send(b, { kind: "escape" })).ok).toBe(true);
    expect((await send(d, { kind: "escape" })).ok).toBe(true);
    await until(() => pub(c).escaped.length === 3, "üç kaçış");

    // Oyun sürerken hiçbir görünümde süre/bitiş alanı yok; yalnız 0-3 gerilim.
    for (const o of cs) {
      expect([0, 1, 2, 3]).toContain(pub(o).tension);
      expect(pub(o).result).toBeNull();
      expect(pub(o).finished).toBe(false);
      const json = JSON.stringify(
        o.updates.map((u) => [u.snapshot.match?.publicView, u.snapshot.match?.view]),
      );
      expect(json).not.toMatch(/endsAt|remaining|duration|deadline/i);
    }

    // Oyun gizli bitişte kesin biter; geç basış reddedilir.
    await runToResults(a, startedAt);
    expect(await send(c, { kind: "escape" })).toMatchObject({ ok: false });

    const [aid, bid, cid, did] = ids as [string, string, string, string];
    const expected = { [aid]: 0, [bid]: 1, [cid]: -1, [did]: 1 };
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.match?.result?.miniScores).toEqual(expected);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => expected[id]));
    const r = pub(a).result;
    expect(r?.missed).toEqual([cid]);
    expect([...(r?.last ?? [])].sort()).toEqual([bid, did].sort());
    expect(r?.escapes.map((e) => e.ms)).toEqual([2_000, 5_000, 5_000]);
    // Sonuçta da bitiş zamanı yok.
    await sync();
    expect(JSON.stringify(a.room.match)).not.toMatch(/endsAt/);
  });

  it("kimse kaçmazsa herkes -1 alır", async () => {
    const { cs, ids, startedAt } = await newMatch();
    const a = cs[0] as Client;
    await runToResults(a, startedAt);
    expect(a.room.match?.result?.awards).toEqual(Object.fromEntries(ids.map((id) => [id, -1])));
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map(() => -1));
    expect(pub(a).result?.last).toEqual([]);
  });

  it("gerilim süre ilerledikçe yükselir ve oyun 10-20 sn içinde biter", async () => {
    const { cs, startedAt } = await newMatch();
    const a = cs[0] as Client;
    let max = 0;
    let endedAt = 0;
    for (let t = 500; t <= 20_500; t += 500) {
      k.clock.advance(startedAt + t - k.clock.now());
      await sync();
      if (a.room.phase !== "playing") {
        endedAt = t;
        break;
      }
      expect(pub(a).tension).toBeGreaterThanOrEqual(max);
      max = pub(a).tension;
    }
    expect(endedAt).toBeGreaterThanOrEqual(10_000);
    expect(endedAt).toBeLessThanOrEqual(20_500);
    expect(max).toBe(3);
  });
});
