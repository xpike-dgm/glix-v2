import type { BorsaPublicView, BorsaView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 7_000;
async function send(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return ack.reason === undefined ? { ok: ack.ok } : { ok: ack.ok, reason: ack.reason };
}

const pub = (c: Client) => c.room.match?.publicView as BorsaPublicView;
const mine = (c: Client) => c.room.match?.view as BorsaView;

async function startBorsa(names: string[]): Promise<Client[]> {
  const cs = await setupRoom(names);
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["kara-borsa"] });
  await until(() => host.room.gameIds[0] === "kara-borsa", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
  return cs;
}

describe("kara-borsa sunucu entegrasyonu", () => {
  it("tam maç: gizli teklifler, erken bitiş, açılış, 5 tur; puanlar genel skora eklenir", async () => {
    const cs = await startBorsa(["Ayşe", "Mehmet", "Zeynep"]);
    const [a, b, c] = cs as [Client, Client, Client];
    const ids = cs.map((x) => x.session.playerId);
    expect(pub(a).phase).toBe("bid");
    expect(pub(a).reveal).toBeNull();
    expect(pub(a).coins[ids[0] as string]).toBe(100);
    for (const x of cs) expect(mine(x).hint).not.toBeNull();

    const wealth: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 100]));
    for (let round = 0; round < 5; round++) {
      await until(() => pub(a).round === round && pub(a).phase === "bid", `tur ${round} teklif`);
      expect(await send(a, { kind: "bid", amount: 101 })).toEqual({ ok: false, reason: "insufficient" });
      expect(await send(a, { kind: "bid", amount: -1 })).toEqual({ ok: false, reason: "invalid_action" });
      const bids = [10 + round, 10 + round, 5];
      expect(await send(a, { kind: "bid", amount: bids[0] })).toEqual({ ok: true });
      expect(await send(a, { kind: "bid", amount: 3 })).toEqual({ ok: false, reason: "already_bid" });
      expect(await send(b, { kind: "bid", amount: bids[1] })).toEqual({ ok: true });
      await until(() => pub(c).bidIds.length === 2, "teklifler");
      // Teklif miktarı başkasının akışında yok; yalnız kendi görünümünde.
      expect(mine(a).myBid).toBe(bids[0]);
      expect(mine(c).myBid).toBeNull();
      expect(pub(c).reveal).toBeNull();
      expect(await send(c, { kind: "bid", amount: bids[2] })).toEqual({ ok: true });
      // Herkes verdi: 1 sn sonra açılış (20 sn beklemeden).
      k.clock.advance(1_000);
      await until(() => pub(a).phase === "reveal", "açılış");
      const reveal = pub(a).reveal;
      // Eşitlikte önce veren (a) kazanır.
      expect(reveal?.winner).toBe(ids[0]);
      expect(reveal?.price).toBe(bids[0]);
      expect(reveal?.bids).toEqual({
        [ids[0] as string]: bids[0],
        [ids[1] as string]: bids[1],
        [ids[2] as string]: bids[2],
      });
      wealth[ids[0] as string] = (wealth[ids[0] as string] ?? 0) - (bids[0] ?? 0) + (reveal?.value ?? 0);
      expect(await send(a, { kind: "bid", amount: 1 })).toEqual({ ok: false, reason: "wrong_phase" });
      k.clock.advance(5_000);
      if (round < 4) await until(() => pub(a).round === round + 1, "sonraki tur");
    }
    await until(() => a.room.phase === "results", "sonuç");
    const mini = a.room.match?.result?.miniScores ?? {};
    for (const id of ids) expect(mini[id]).toBe(wealth[id]);
    const awards = a.room.match?.result?.awards ?? {};
    const total = Object.values(awards).reduce((x, y) => x + y, 0);
    expect(total).toBeGreaterThanOrEqual(3);
    await sync();
    for (const x of cs) {
      const me = x.room.players.find((p) => p.id === x.session.playerId);
      expect(me?.score).toBe(awards[x.session.playerId]);
    }
    expect((await send(a, { kind: "bid", amount: 1 })).ok).toBe(false);
  });

  it("kimse teklif vermezse kutu kimseye gitmez ve oyun süreyle biter", async () => {
    const cs = await startBorsa(["A", "B", "C"]);
    const a = cs[0] as Client;
    k.clock.advance(20_000);
    await until(() => pub(a).phase === "reveal", "açılış");
    expect(pub(a).reveal?.winner).toBeNull();
    k.clock.advance(5_000 + 4 * 25_000);
    await until(() => a.room.phase === "results", "sonuç");
    expect(Object.values(a.room.match?.result?.awards ?? {})).toEqual([2, 2, 2]);
  });
});
