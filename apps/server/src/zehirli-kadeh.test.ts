import type { ZehirliKadehPublicView, ZehirliKadehView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 7000;
async function send(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return { ok: ack.ok, ...(ack.reason ? { reason: ack.reason } : {}) };
}

const pub = (c: Client) => c.room.match?.publicView as ZehirliKadehPublicView;
const view = (c: Client) => c.room.match?.view as ZehirliKadehView;

describe("zehirli-kadeh tam maç", () => {
  it("takaslar süreyi uzatır, geçmiş herkese açıktır, zehir sonuca kadar ağdan geçmez, temiz kadeh +1", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    a.send({ type: "setGames", gameIds: ["zehirli-kadeh"] });
    await until(() => a.room.gameIds[0] === "zehirli-kadeh", "oyun seçildi");
    const { startedAt } = await startPlaying(cs);
    const ids = cs.map((x) => x.session.playerId);
    const [ia, ib, ic, id] = ids as [string, string, string, string];

    expect(pub(a)).toMatchObject({ endsAt: startedAt + 20_000, poisonCount: 2, ended: false, result: null });
    expect(pub(a).holdings).toEqual({ [ia]: 0, [ib]: 1, [ic]: 2, [id]: 3 });
    for (const x of cs) expect(view(x)).toEqual({ role: "player" });

    // Reddedilenler: kendiyle, bilinmeyen hedef, çöp.
    expect(await send(a, { kind: "swap", target: ia })).toEqual({ ok: false, reason: "self_target" });
    expect(await send(a, { kind: "swap", target: "yok" })).toEqual({ ok: false, reason: "bad_target" });
    expect(await send(a, { kind: "swap" })).toMatchObject({ ok: false });

    k.clock.advance(3_000);
    expect(await send(a, { kind: "swap", target: ib })).toEqual({ ok: true });
    await until(() => pub(c).swaps.length === 1, "takas yayınlandı");
    expect(pub(c).swaps[0]).toMatchObject({ seq: 1, from: ia, to: ib });
    expect(pub(c).holdings).toEqual({ [ia]: 1, [ib]: 0, [ic]: 2, [id]: 3 });
    expect(pub(c).endsAt).toBe(startedAt + 25_000);
    expect(await send(a, { kind: "swap", target: ic })).toEqual({ ok: false, reason: "already_swapped" });

    // Hedef olan b hâlâ kendi takasını yapabilir.
    expect(await send(b, { kind: "swap", target: id })).toEqual({ ok: true });
    await until(() => pub(a).swaps.length === 2, "ikinci takas");
    expect(pub(a).endsAt).toBe(startedAt + 30_000);
    expect(pub(a).holdings).toEqual({ [ia]: 1, [ib]: 3, [ic]: 2, [id]: 0 });
    expect(pub(a).swapped.sort()).toEqual([ia, ib].sort());

    // Süre bitmeden zehir bilgisi hiçbir istemciye gitmedi.
    for (const x of [a, b, c, d]) {
      const all = JSON.stringify(x.msgs);
      expect(all).not.toMatch(/poisonedCups|"poisoned"|"clean"/);
    }

    // 29,9 sn: oyun sürer; bitişte sonuç açılır ve geç takas reddedilir.
    k.clock.advance(startedAt + 29_900 - k.clock.now());
    await sync();
    expect(a.room.phase).toBe("playing");
    k.clock.advance(startedAt + 30_000 - k.clock.now());
    expect(await send(c, { kind: "swap", target: ia })).toMatchObject({ ok: false });
    await until(() => a.room.phase === "results", "sonuç");

    const r = pub(a).result;
    if (!r) throw new Error("sonuç yok");
    expect(r.poisonedCups).toHaveLength(2);
    const holdings = pub(a).holdings;
    const expected = Object.fromEntries(
      ids.map((p) => [p, r.poisonedCups.includes(holdings[p] as number) ? 0 : 1]),
    );
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.match?.result?.miniScores).toEqual(expected);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((p) => expected[p]));
    expect([...r.clean].sort()).toEqual(ids.filter((p) => expected[p] === 1).sort());
  });

  it("izleyici ve kimse takas yapmasa da oyun 20 sn'de biter", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a] = cs as [Client, ...Client[]];
    a.send({ type: "setGames", gameIds: ["zehirli-kadeh"] });
    await until(() => a.room.gameIds[0] === "zehirli-kadeh", "oyun seçildi");
    const { startedAt } = await startPlaying(cs);
    k.clock.advance(startedAt + 19_900 - k.clock.now());
    await sync();
    expect(a.room.phase).toBe("playing");
    k.clock.advance(300);
    await until(() => a.room.phase === "results", "sonuç");
    expect(pub(a).poisonCount).toBe(1);
    expect(pub(a).swaps).toEqual([]);
    expect(Object.values(a.room.match?.result?.awards ?? {}).sort()).toEqual([0, 1, 1]);
  });
});
