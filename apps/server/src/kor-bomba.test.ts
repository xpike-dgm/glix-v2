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
    expect(view(holder)).toEqual({ role: "holder", betUsed: false, lastResult: null });
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

    // BM-M1: ilk 1,5 sn fitil tutuşuyor, pas yok.
    expect(await send(holder, { kind: "pass", to: x.session.playerId })).toEqual({
      ok: false,
      reason: "locked",
    });
    expect(pub(a).lockedUntil).toBe(startedAt + 1_500);
    k.clock.advance(startedAt + 1_500 - k.clock.now());
    await sync();

    // Pas: bomba x'e geçer, süre uzar.
    expect((await send(holder, { kind: "pass", to: x.session.playerId })).ok).toBe(true);
    await until(() => pub(a).holder === x.session.playerId, "bomba geçti");
    expect(pub(a).passes).toBe(1);
    expect(view(x)).toEqual({ role: "holder", betUsed: false, lastResult: null });
    const wasHolder = view(holder);
    if (wasHolder.role !== "watcher") throw new Error("eski taşıyıcı süreyi görmeli");
    expect(wasHolder.explodeAt).toBeGreaterThan(explodeAt);
    expect(wasHolder.lastBonusMs).toBe(wasHolder.explodeAt - explodeAt);
    const newExplode = wasHolder.explodeAt;
    expect(JSON.stringify(x.msgs.slice(-2))).not.toContain(String(newExplode));

    // x, y'ye; y hemen x'e geri veremez (BM-M1), holder'a verir; holder x'e verir. Son taşıyıcı x.
    k.clock.advance(1_500);
    await sync();
    expect((await send(x, { kind: "pass", to: y.session.playerId })).ok).toBe(true);
    await until(() => pub(a).holder === y.session.playerId, "ikinci pas");
    k.clock.advance(1_500);
    await sync();
    expect(await send(y, { kind: "pass", to: x.session.playerId })).toEqual({
      ok: false,
      reason: "no_return",
    });
    expect((await send(y, { kind: "pass", to: holder.session.playerId })).ok).toBe(true);
    await until(() => pub(a).passes === 3, "üçüncü pas");
    k.clock.advance(1_500);
    await sync();
    expect((await send(holder, { kind: "pass", to: x.session.playerId })).ok).toBe(true);
    await until(() => pub(a).passes === 4, "dördüncü pas");
    expect(pub(a).trail).toEqual([first, x.session.playerId, y.session.playerId, first, x.session.playerId]);
    const finalExplode = (view(y) as { explodeAt: number }).explodeAt;

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
    // BM-U6: yolculuk ancak şimdi açık.
    expect(pub(a).journey?.hands.map((h) => h.holder)).toEqual(pub(a).trail);
    expect(pub(a).journey?.totalMs).toBe(finalExplode - startedAt);
    // Patlamadan sonra patlama anı herkese açıktır.
    expect(view(x)).toMatchObject({ role: "watcher", explodeAt: finalExplode });
  });
});

describe("kor-bomba bahsi (BM-M3)", () => {
  it("bahis gizli kalır, taşıyıcı göremez; patlamada tutan +1 alır ve adı açılır", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a] = cs as [Client, Client, Client, Client];
    a.send({ type: "setGames", gameIds: ["kor-bomba"] });
    await until(() => a.room.gameIds[0] === "kor-bomba", "oyun seçildi");
    await startPlaying(cs);

    const byId = new Map(cs.map((c) => [c.session.playerId, c] as const));
    const holder = byId.get(pub(a).holder) as Client;
    const [x, y, z] = cs.filter((c) => c !== holder) as [Client, Client, Client];
    const turn = pub(a).passes;
    const final = (view(x) as { explodeAt: number }).explodeAt;

    expect(await send(holder, { kind: "bet", turn })).toEqual({ ok: false, reason: "holder_cannot_bet" });
    expect(await send(x, { kind: "bet", turn: turn + 3 })).toEqual({ ok: false, reason: "stale_turn" });
    expect(await send(x, { kind: "predict", turn, explodes: true })).toMatchObject({ ok: false });

    expect(await send(x, { kind: "bet", turn })).toEqual({ ok: true });
    expect(await send(x, { kind: "bet", turn })).toEqual({ ok: false, reason: "already_bet" });
    await until(() => (view(x) as { bet: unknown }).bet !== null, "bahis görünümde");
    expect(view(x)).toMatchObject({ role: "watcher", bet: { turn }, betUsed: true });
    expect(view(z)).toMatchObject({ bet: null, betUsed: false });

    // Son 3 sn: y'nin bahsi kabul edilmez, hakkı durur.
    k.clock.advance(final - 2_000 - k.clock.now());
    await sync();
    expect(await send(y, { kind: "bet", turn })).toEqual({ ok: false, reason: "too_late" });
    expect(view(y)).toMatchObject({ betUsed: false });

    // Gizlilik: taşıyıcıya ve diğerlerine giden hiçbir ileti bahis içermez.
    expect(JSON.stringify(holder.msgs)).not.toContain('"bet":{');
    expect(JSON.stringify(z.msgs)).not.toContain('"bet":{');
    for (const c of cs) expect(pub(c).correctPredictors).toEqual([]);

    k.clock.advance(final - k.clock.now());
    await until(() => pub(a).exploded, "patlama");
    const xid = x.session.playerId;
    expect(pub(a).correctPredictors).toEqual([xid]);
    expect(view(x)).toMatchObject({ lastResult: { turn, correct: true } });
    k.clock.advance(2_000);
    await until(() => a.room.phase === "results", "sonuç");
    const expected = Object.fromEntries(
      cs.map((c) => [c.session.playerId, c === holder ? -1 : c.session.playerId === xid ? 1 : 0]),
    );
    expect(a.room.match?.result?.awards).toEqual(expected);
  });

  it("pasla bahis yanar: sahibi kendi sonucunu görür, hak geri gelmez", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a] = cs as [Client, Client, Client];
    a.send({ type: "setGames", gameIds: ["kor-bomba"] });
    await until(() => a.room.gameIds[0] === "kor-bomba", "oyun seçildi");
    const { startedAt } = await startPlaying(cs);
    const byId = new Map(cs.map((c) => [c.session.playerId, c] as const));
    const holder = byId.get(pub(a).holder) as Client;
    const [x, y] = cs.filter((c) => c !== holder) as [Client, Client];
    expect(await send(x, { kind: "bet", turn: 0 })).toEqual({ ok: true });
    k.clock.advance(startedAt + 1_500 - k.clock.now());
    await sync();
    expect((await send(holder, { kind: "pass", to: y.session.playerId })).ok).toBe(true);
    await until(() => pub(a).passes === 1, "pas");
    expect(view(x)).toMatchObject({ bet: null, betUsed: true, lastResult: { turn: 0, correct: false } });
    expect(view(y)).toEqual({ role: "holder", betUsed: false, lastResult: null });
    expect(await send(x, { kind: "bet", turn: 1 })).toEqual({ ok: false, reason: "already_bet" });
  });
});
