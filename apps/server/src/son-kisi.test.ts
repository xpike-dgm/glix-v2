import { createRng, type Rng, type SonKisiPublicView, type SonKisiView } from "@glix/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

/**
 * Oyun tohumu sabit (`rt.randomInt` üzerinden; üretimde crypto). Gizli bitiş anı tohumdan gelir; rastgele tohumda
 * bitiş 20 sn sınırına çok yakın düştüğünde "10-20 sn içinde biter" testi ara sıra düşüyordu. Her test aynı tohum
 * dizisiyle başlar (rus-ruleti.test.ts ile aynı yöntem).
 */
const SEED = 1;
let seeded: Rng = createRng(SEED);
beforeEach(() => {
  seeded = createRng(SEED);
});
useServer({ randomInt: (max) => seeded.int(max) });

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
const goTo = (t: number) => k.clock.advance(Math.max(0, t - k.clock.now()));

/** Alarm bilinmediği için saati küçük adımlarla ilerletir; `stop` sağlanınca durur. */
async function runUntil(a: Client, stop: () => boolean, limitMs = 80_000): Promise<void> {
  const from = k.clock.now();
  while (!stop() && k.clock.now() - from < limitMs) {
    k.clock.advance(250);
    await sync();
  }
  await until(stop, "beklenen evre");
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
  it("üç alarm; kimin kaçtığı oyun sırasında ağdan geçmez; alarm anı ve puanlar tur sonunda açılır", async () => {
    const { cs, ids, startedAt } = await newMatch();
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    const [aid, bid, , did] = ids as [string, string, string, string];

    expect(pub(a)).toMatchObject({ round: 0, phase: "play", tension: 0, escapedCount: 0, results: [] });
    expect(await send(a, { kind: "bogus" })).toMatchObject({ ok: false });

    goTo(startedAt + 2_000);
    expect((await send(a, { kind: "escape" })).ok).toBe(true);
    expect((await send(a, { kind: "escape" })).ok).toBe(true); // yok sayılır
    await until(() => pub(b).escapedCount === 1, "ilk kaçış");
    expect(view(a)).toEqual({ escaped: true, myMs: 2_000 });
    expect(view(b)).toEqual({ escaped: false, myMs: null });

    // B ve D aynı sunucu milisaniyesinde kaçar: eşit zaman damgası.
    goTo(startedAt + 5_000);
    expect((await send(b, { kind: "escape" })).ok).toBe(true);
    expect((await send(d, { kind: "escape" })).ok).toBe(true);
    await until(() => pub(c).escapedCount === 3, "üç kaçış");

    // Tur sürerken: kimin kaçtığı, alarm, süre yok; yalnız sayı ve 0-3 gerilim.
    for (const o of cs) {
      expect([0, 1, 2, 3]).toContain(pub(o).tension);
      expect(pub(o).results).toEqual([]);
      // `totals` (kapanmış turların toplamı) herkesi listeler; onun dışında hiçbir alanda oyuncu kimliği yok.
      const json = JSON.stringify(
        o.updates.map((u) => ({ ...(u.snapshot.match?.publicView as object | null), totals: null })),
      );
      expect(json).not.toMatch(/endsAt|remaining|duration|deadline|alarm/i);
      expect(json).not.toContain(aid);
    }

    // 1. alarm: tur arası açılışı.
    await runUntil(a, () => pub(a)?.phase === "gap");
    expect(await send(c, { kind: "escape" })).toMatchObject({ ok: false, reason: "between_rounds" });
    const r0 = pub(a).results[0];
    expect(r0?.alarmMs).toBeGreaterThanOrEqual(8_000);
    expect(r0?.alarmMs).toBeLessThanOrEqual(16_000);
    expect(r0?.rang).toBe(true);
    expect([...(r0?.last ?? [])].sort()).toEqual([bid, did].sort());
    expect(r0?.second).toEqual([aid]);
    expect(r0?.points[bid]).toBe(2);
    expect(r0?.points[aid]).toBe(1);
    expect(r0?.escapes.map((e) => e.ms)).toEqual([2_000, 5_000, 5_000]);
    expect(Object.values(r0?.points ?? {}).every((p) => p >= 0)).toBe(true);

    // 2. ve 3. turda kimse kaçmaz; oyun son açılıştan sonra (Devam et ya da süre) biter.
    await runUntil(a, () => a.room.phase === "results", 120_000);
    const expected = { [aid]: 1, [bid]: 2, [ids[2] as string]: 0, [did]: 2 };
    expect(a.room.match?.result?.miniScores).toEqual(expected);
    // B ve D birincide eşit: ikisi +2, sonraki A +1, C 0 ödülsüz.
    expect(a.room.match?.result?.awards).toEqual({ [aid]: 1, [bid]: 2, [ids[2] as string]: 0, [did]: 2 });
    expect(pub(a).results).toHaveLength(3);
    expect(JSON.stringify(a.room.match)).not.toMatch(/endsAt|alarmAt/);
  });

  it("kimse kaçmazsa kimse puan almaz (eksi yok)", async () => {
    const { cs, ids } = await newMatch();
    const a = cs[0] as Client;
    await runUntil(a, () => a.room.phase === "results", 120_000);
    expect(a.room.match?.result?.awards).toEqual(Object.fromEntries(ids.map((id) => [id, 0])));
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map(() => 0));
  });

  it("gerilim tur içinde yükselir; her tur 8-16 sn sürer", async () => {
    const { cs, startedAt } = await newMatch();
    const a = cs[0] as Client;
    let max = 0;
    let endedAt = 0;
    for (let t = 250; t <= 16_500; t += 250) {
      goTo(startedAt + t);
      await sync();
      if (pub(a).phase !== "play") {
        endedAt = t;
        break;
      }
      expect(pub(a).tension).toBeGreaterThanOrEqual(max);
      max = pub(a).tension;
    }
    expect(endedAt).toBeGreaterThanOrEqual(8_000);
    expect(endedAt).toBeLessThanOrEqual(16_250);
    expect(max).toBe(3);
  });
});
