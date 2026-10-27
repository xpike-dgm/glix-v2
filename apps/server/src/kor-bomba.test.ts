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
    expect(view(holder)).toEqual({ role: "holder", lastResult: null });
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
    expect(view(x)).toEqual({ role: "holder", lastResult: null });
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

describe("kor-bomba tahmini (O9)", () => {
  it("tahmin gizli kalır, taşıyıcı göremez; patlamada doğru bilen +1 alır ve adı açılır", async () => {
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

    // Taşıyıcı tahmin veremez; yanlış el ve çöp reddedilir.
    expect(await send(holder, { kind: "predict", turn, explodes: true })).toEqual({
      ok: false,
      reason: "holder_cannot_predict",
    });
    expect(await send(x, { kind: "predict", turn: turn + 3, explodes: true })).toEqual({
      ok: false,
      reason: "stale_turn",
    });
    expect(await send(x, { kind: "predict", turn, explodes: "evet" })).toMatchObject({ ok: false });

    // x "patlar", y "patlamaz" der; ikinci tahmin reddedilir.
    expect(await send(x, { kind: "predict", turn, explodes: true })).toEqual({ ok: true });
    expect(await send(y, { kind: "predict", turn, explodes: false })).toEqual({ ok: true });
    expect(await send(x, { kind: "predict", turn, explodes: false })).toEqual({
      ok: false,
      reason: "already_predicted",
    });
    await until(() => (view(x) as { prediction: unknown }).prediction !== null, "tahmin görünümde");
    expect(view(x)).toMatchObject({ role: "watcher", prediction: { turn, explodes: true } });
    expect(view(y)).toMatchObject({ prediction: { turn, explodes: false } });
    expect(view(z)).toMatchObject({ prediction: null });

    // Gizlilik: taşıyıcıya giden hiçbir ileti tahmin içermez; z'ye başkasının tahmini gitmez; publicView temiz.
    const holderMsgs = JSON.stringify(holder.msgs);
    expect(holderMsgs).not.toContain('"prediction":{');
    expect(holderMsgs).not.toContain("correctPredictors\":[\"");
    expect(JSON.stringify(z.msgs)).not.toContain('"prediction":{');
    expect(JSON.stringify(y.msgs)).not.toContain('"explodes":true');
    for (const c of cs) expect(pub(c).correctPredictors).toEqual([]);

    // Patlama: x +1, taşıyıcı -1, y (patlamaz) 0.
    k.clock.advance(final - k.clock.now());
    await until(() => pub(a).exploded, "patlama");
    const xid = x.session.playerId;
    expect(pub(a).correctPredictors).toEqual([xid]);
    expect(view(x)).toMatchObject({ lastResult: { turn, correct: true } });
    expect(view(y)).toMatchObject({ lastResult: { turn, correct: false } });
    expect(await send(z, { kind: "predict", turn, explodes: true })).toMatchObject({ ok: false });
    k.clock.advance(2_000);
    await until(() => a.room.phase === "results", "sonuç");
    const hid = holder.session.playerId;
    const expected = Object.fromEntries(
      cs.map((c) => [c.session.playerId, c === holder ? -1 : c.session.playerId === xid ? 1 : 0]),
    );
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.players.find((p) => p.id === xid)?.score).toBe(1);
    expect(a.room.players.find((p) => p.id === hid)?.score).toBe(-1);
  });

  it("pasla tahminler çözülür: sahibi kendi sonucunu görür, kimse başkasınınkini görmez", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a] = cs as [Client, Client, Client];
    a.send({ type: "setGames", gameIds: ["kor-bomba"] });
    await until(() => a.room.gameIds[0] === "kor-bomba", "oyun seçildi");
    await startPlaying(cs);
    const byId = new Map(cs.map((c) => [c.session.playerId, c] as const));
    const holder = byId.get(pub(a).holder) as Client;
    const [x, y] = cs.filter((c) => c !== holder) as [Client, Client];
    expect(await send(x, { kind: "predict", turn: 0, explodes: true })).toEqual({ ok: true });
    expect((await send(holder, { kind: "pass", to: y.session.playerId })).ok).toBe(true);
    await until(() => pub(a).passes === 1, "pas");
    expect(view(x)).toMatchObject({ prediction: null, lastResult: { turn: 0, correct: false } });
    expect(view(y)).toEqual({ role: "holder", lastResult: null });
    expect(pub(a).correctPredictors).toEqual([]);
    // Yeni el: eski tahmin yeni ele sayılmaz; x yeniden tahmin verebilir.
    expect(await send(x, { kind: "predict", turn: 0, explodes: true })).toEqual({
      ok: false,
      reason: "stale_turn",
    });
    expect(await send(x, { kind: "predict", turn: 1, explodes: true })).toEqual({ ok: true });
  });
});
