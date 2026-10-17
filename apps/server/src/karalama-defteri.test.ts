import type { KaralamaPublicView, KaralamaView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 1_000;
async function send(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return ack.reason === undefined ? { ok: ack.ok } : { ok: ack.ok, reason: ack.reason };
}

const pub = (c: Client) => c.room.match?.publicView as KaralamaPublicView;
const mine = (c: Client) => c.room.match?.view as KaralamaView;

async function startKaralama(names: string[]): Promise<Client[]> {
  const cs = await setupRoom(names);
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["karalama-defteri"] });
  await until(() => host.room.gameIds[0] === "karalama-defteri", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
  return cs;
}

const stroke = (n: number) => ({
  kind: "stroke",
  color: "pembe",
  size: 2,
  points: Array.from({ length: n * 2 }, (_, i) => (i * 13) % 1001),
});

describe("karalama-defteri sunucu entegrasyonu", () => {
  it("tam maç: çizim, oylama, açılış; puanlar genel skora eklenir", async () => {
    const cs = await startKaralama(["Ayşe", "Mehmet", "Zeynep"]);
    const ids = cs.map((c) => c.session.playerId);
    const [a, b, c] = cs as [Client, Client, Client];

    // Herkes kendi kelimesini görür; yalnız biri yakın sinyal alır.
    expect(cs.filter((x) => mine(x).near)).toHaveLength(1);
    const outsiderClient = cs.find((x) => mine(x).near) as Client;
    const outsiderId = outsiderClient.session.playerId;
    const words = new Set(cs.map((x) => mine(x).word));
    expect(words.size).toBe(2);
    expect(pub(a).phase).toBe("draw");
    expect(pub(a).drawings).toBeNull();
    expect(pub(a).reveal).toBeNull();

    // Çizim: darbe, geri al; yalnız kendi görünümünde.
    expect(await send(a, stroke(5))).toEqual({ ok: true });
    expect(await send(a, stroke(9))).toEqual({ ok: true });
    expect(await send(b, stroke(3))).toEqual({ ok: true });
    expect(await send(a, { kind: "undo" })).toEqual({ ok: true });
    await until(() => Object.keys(mine(a).strokes).length === 1, "kendi darbem");
    expect(Object.keys(mine(b).strokes)).toHaveLength(1);
    expect(mine(c).strokes).toEqual({});
    // Geçersiz ve fazla uzun darbe reddedilir, oylama çizim süresince reddedilir.
    expect(await send(a, stroke(121))).toEqual({ ok: false, reason: "invalid_action" });
    expect(await send(a, { kind: "vote", target: ids[1] })).toEqual({ ok: false, reason: "wrong_phase" });
    // Bilgisiz oyuncu ağ üzerinden ele verilmez: publicView'da çizim ve kimlik yok.
    expect(JSON.stringify(pub(c))).not.toContain("outsider");

    // Çizim süresi biter -> oylama; çizimler açılır.
    k.clock.advance(75_000);
    await until(() => pub(a).phase === "vote", "oylama");
    expect(pub(a).drawings?.[ids[0] as string]).toHaveLength(1);
    expect(pub(a).drawings?.[ids[1] as string]).toHaveLength(1);
    expect(pub(a).drawings?.[ids[2] as string]).toEqual([]);
    expect(await send(a, stroke(3))).toEqual({ ok: false, reason: "wrong_phase" });

    // Oylama: kendine yok, bilgisiz olmayanlar bilgisizi seçer (değiştirerek).
    const voters = cs.filter((x) => x !== outsiderClient);
    for (const v of voters) {
      expect(await send(v, { kind: "vote", target: v.session.playerId })).toEqual({
        ok: false,
        reason: "self_vote",
      });
    }
    const decoy = ids.find((id) => id !== outsiderId && id !== voters[0]?.session.playerId) as string;
    expect(await send(voters[0] as Client, { kind: "vote", target: decoy })).toEqual({ ok: true });
    for (const v of voters) expect(await send(v, { kind: "vote", target: outsiderId })).toEqual({ ok: true });
    const other = ids.find((id) => id !== outsiderId) as string;
    expect(await send(outsiderClient, { kind: "vote", target: other })).toEqual({ ok: true });
    await until(() => pub(a).voted.length === 3, "oylar");
    // Çizimler oylama sırasında değişmez: oy değişimi küçük bir yama olarak iner.
    const mark = a.mark();
    expect(await send(voters[0] as Client, { kind: "vote", target: decoy })).toEqual({ ok: true });
    await until(() => mine(voters[0] as Client).myVote === decoy, "oy değişti");
    expect(await send(voters[0] as Client, { kind: "vote", target: outsiderId })).toEqual({ ok: true });
    await until(() => mine(voters[0] as Client).myVote === outsiderId, "oy geri");
    const patches = a.since(mark).filter((m) => m.type === "patch");
    for (const m of patches) expect(JSON.stringify(m).length).toBeLessThan(600);
    expect(pub(a).reveal).toBeNull();
    expect(mine(voters[0] as Client).myVote).toBe(outsiderId);

    // Oylama bitince sonuç: bilgisiz yakalandı, diğerleri +1.
    k.clock.advance(20_000);
    await until(() => a.room.phase === "results", "sonuç");
    const reveal = pub(a).reveal;
    expect(reveal?.outsider).toBe(outsiderId);
    expect(reveal?.caught).toBe(true);
    expect(reveal?.tally[outsiderId]).toBe(2);
    const expected: Record<string, number> = {};
    for (const id of ids) expected[id] = id === outsiderId ? 0 : 1;
    expect(a.room.match?.result?.awards).toEqual(expected);
    for (const x of cs) {
      const me = x.room.players.find((p) => p.id === x.session.playerId);
      expect(me?.score).toBe(expected[x.session.playerId]);
    }
    // Bitişten sonra eylem reddedilir.
    expect((await send(a, { kind: "vote", target: ids[1] })).ok).toBe(false);
  });

  it("kimse oy vermezse bilgisiz +1 alır", async () => {
    const cs = await startKaralama(["A", "B", "C"]);
    const outsiderId = (cs.find((x) => mine(x).near) as Client).session.playerId;
    k.clock.advance(95_000);
    await until(() => (cs[0] as Client).room.phase === "results", "sonuç");
    const expected: Record<string, number> = {};
    for (const x of cs) expected[x.session.playerId] = x.session.playerId === outsiderId ? 1 : 0;
    expect((cs[0] as Client).room.match?.result?.awards).toEqual(expected);
    await sync();
    for (const x of cs) {
      expect(x.room.players.find((p) => p.id === x.session.playerId)?.score).toBe(
        expected[x.session.playerId],
      );
    }
  });

  it("bağlantısı kopan oyuncuya oy verilemez", async () => {
    const cs = await startKaralama(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    k.clock.advance(75_000);
    await until(() => pub(a).phase === "vote", "oylama");
    c.ws.terminate();
    await until(() => a.room.players[2]?.connected === false, "kopma");
    expect(await send(a, { kind: "vote", target: c.session.playerId })).toEqual({
      ok: false,
      reason: "not_connected",
    });
    expect(await send(a, { kind: "vote", target: b.session.playerId })).toEqual({ ok: true });
  });
});
