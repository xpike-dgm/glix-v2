import type { KorBombaPublicView, KorBombaView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 1000;
async function send(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return { ok: ack.ok, ...(ack.reason ? { reason: ack.reason } : {}) };
}

const pub = (c: Client) => c.room.match?.publicView as KorBombaPublicView;
const view = (c: Client) => c.room.match?.view as KorBombaView;

describe("kor-bomba tam maç", () => {
  it("bomba pas edilir, patlayınca taşıyıcı -1 alır ve genel skora işlenir", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a] = cs as [Client, Client, Client];
    a.send({ type: "setGames", gameIds: ["kor-bomba"] });
    await until(() => a.room.gameIds[0] === "kor-bomba", "oyun seçildi");
    const { startedAt } = await startPlaying(cs);
    expect(a.room.match?.gameId).toBe("kor-bomba");
    expect(a.room.match?.orientation).toBe("landscape");

    const byId = new Map(cs.map((c) => [c.session.playerId, c] as const));
    const first = pub(a).holder;
    const holder = byId.get(first) as Client;
    const others = cs.filter((c) => c !== holder);
    const [x, y] = others as [Client, Client];

    // Taşıyıcı süre görmez; diğerleri görür. Gizli değer ağdan taşıyıcıya hiç gitmez.
    expect(view(holder)).toEqual({ role: "holder" });
    const w = view(x);
    if (w.role !== "watcher") throw new Error("izleyici rolü bekleniyordu");
    const explodeAt = w.explodeAt;
    expect(explodeAt - startedAt).toBeGreaterThanOrEqual(15_000);
    expect(explodeAt - startedAt).toBeLessThanOrEqual(20_000);
    for (const c of cs) expect(JSON.stringify(pub(c))).not.toContain(String(explodeAt));
    expect(JSON.stringify(holder.msgs)).not.toContain(String(explodeAt));

    // Taşıyıcı olmayan pas veremez; taşıyıcı kendine veremez.
    expect(await send(x, { kind: "pass", to: y.session.playerId })).toEqual({
      ok: false,
      reason: "not_holder",
    });
    expect(await send(holder, { kind: "pass", to: first })).toEqual({ ok: false, reason: "self_target" });
    expect(await send(holder, { kind: "pass", to: "yok" })).toEqual({ ok: false, reason: "bad_target" });

    // Pas: bomba x'e geçer, süre uzar.
    expect((await send(holder, { kind: "pass", to: x.session.playerId })).ok).toBe(true);
    await until(() => pub(a).holder === x.session.playerId, "bomba geçti");
    expect(pub(a).passes).toBe(1);
    expect(view(x)).toEqual({ role: "holder" });
    const wasHolder = view(holder);
    if (wasHolder.role !== "watcher") throw new Error("eski taşıyıcı süreyi görmeli");
    expect(wasHolder.explodeAt).toBeGreaterThan(explodeAt);
    expect(wasHolder.lastBonusMs).toBe(wasHolder.explodeAt - explodeAt);
    const newExplode = wasHolder.explodeAt;
    expect(JSON.stringify(x.msgs.slice(-2))).not.toContain(String(newExplode));

    // x, y'ye ve y geri x'e pas verir; son taşıyıcı x olsun.
    expect((await send(x, { kind: "pass", to: y.session.playerId })).ok).toBe(true);
    await until(() => pub(a).holder === y.session.playerId, "ikinci pas");
    expect((await send(y, { kind: "pass", to: x.session.playerId })).ok).toBe(true);
    await until(() => pub(a).passes === 3, "üçüncü pas");
    const finalExplode = (view(holder) as { explodeAt: number }).explodeAt;

    // Patlamadan 1 ms önce oyun sürer; patlamada biter ve aynı anki pas reddedilir.
    k.clock.advance(finalExplode - 1 - k.clock.now());
    await sync();
    expect(a.room.phase).toBe("playing");
    k.clock.advance(1);
    expect(await send(x, { kind: "pass", to: y.session.playerId })).toMatchObject({ ok: false });
    // Patlama gösterisi sürerken oyun ekranı açık kalır: patlama anı herkese açılır.
    await until(() => pub(a).exploded, "patlama");
    expect(a.room.phase).toBe("playing");
    k.clock.advance(2_000);
    await until(() => a.room.phase === "results", "sonuç");

    const result = a.room.match?.result;
    const xid = x.session.playerId;
    const expected = Object.fromEntries(
      cs.map((c) => [c.session.playerId, c.session.playerId === xid ? -1 : 0]),
    );
    expect(result?.miniScores).toEqual(expected);
    expect(result?.awards).toEqual(expected);
    expect(a.room.players.map((p) => p.score)).toEqual(cs.map((c) => expected[c.session.playerId]));
    expect(pub(a)).toMatchObject({ exploded: true, explodedAt: finalExplode, holder: xid });
    // Patlamadan sonra patlama anı herkese açıktır.
    expect(view(x)).toMatchObject({ role: "watcher", explodeAt: finalExplode });
  });
});
