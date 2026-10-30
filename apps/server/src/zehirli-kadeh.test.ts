import { ZEHIRLI_KADEH_REVEAL, type ZehirliKadehPublicView, type ZehirliKadehView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { Client, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

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
    for (const x of cs) expect(view(x)).toEqual({ role: "player", check: null });

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
    // Geç gelen eylem payı (250 ms): özgün bitişte faz sürer; pay dolunca sonuç açılır ve geç takas reddedilir.
    k.clock.advance(startedAt + 30_000 - k.clock.now());
    await sleep(30);
    expect(a.room.phase).toBe("playing");
    k.clock.advance(250);
    // Süre bitti: "Şerefe!" açılış evresi başlar. Sonuç görünümü hemen açılır, faz oyunda kalır, eylem reddedilir.
    await until(() => pub(a).ended && pub(a).result !== null, "açılış evresi");
    expect(a.room.phase).toBe("playing");
    expect(await send(c, { kind: "swap", target: ia })).toEqual({ ok: false, reason: "ended" });
    expect(await send(c, { kind: "check", target: ia })).toEqual({ ok: false, reason: "ended" });
    k.clock.advance(ZEHIRLI_KADEH_REVEAL.totalMs - 300);
    await sleep(30);
    expect(a.room.phase).toBe("playing");
    k.clock.advance(300);
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
    await until(() => pub(a).ended, "açılış evresi");
    expect(a.room.phase).toBe("playing");
    k.clock.advance(ZEHIRLI_KADEH_REVEAL.totalMs);
    await until(() => a.room.phase === "results", "sonuç");
    expect(pub(a).poisonCount).toBe(1);
    expect(pub(a).swaps).toEqual([]);
    expect(Object.values(a.room.match?.result?.awards ?? {}).sort()).toEqual([0, 1, 1]);
  });
});

describe("zehirli-kadeh kontrol hakkı", () => {
  it("doğrulanır, sonucu yalnız kontrol edene gider; başka oyunculara ve sahneye hiçbir ileti gitmez", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    a.send({ type: "setGames", gameIds: ["zehirli-kadeh"] });
    await until(() => a.room.gameIds[0] === "zehirli-kadeh", "oyun seçildi");
    const tv = await Client.connect();
    tv.send({ type: "joinStage", code: a.session.roomCode });
    await until(() => tv.updates.length > 0, "sahne katılımı");
    const { startedAt } = await startPlaying(cs);
    await until(() => tv.room.phase === "playing", "sahne oyunda");
    const [ia, ib] = cs.map((x) => x.session.playerId) as [string, string, string];

    // Bozuk ve kurala aykırı kontroller reddedilir.
    expect(await send(a, { kind: "check" })).toMatchObject({ ok: false });
    expect(await send(a, { kind: "check", target: 5 })).toMatchObject({ ok: false });
    expect(await send(a, { kind: "check", target: ib, extra: 1 })).toMatchObject({ ok: false });
    expect(await send(a, { kind: "check", target: ia })).toEqual({ ok: false, reason: "self_target" });
    expect(await send(a, { kind: "check", target: "yok" })).toEqual({ ok: false, reason: "bad_target" });
    await sync();

    const marks = [b, c, tv].map((x) => x.mark());
    const before = JSON.stringify([b, c, tv].map((x) => x.room.match));
    expect(await send(a, { kind: "check", target: ib })).toEqual({ ok: true });
    await until(() => view(a).check !== null, "kontrol sonucu");
    const result = view(a).check;
    expect(result?.cup).toBe(1);
    expect(typeof result?.poisoned).toBe("boolean");
    expect(await send(a, { kind: "check", target: ib })).toEqual({ ok: false, reason: "already_checked" });
    await sync();
    await sync();
    // b, c ve TV: kontrolden sonra hiçbir ileti almadı, görüntüleri aynı.
    [b, c, tv].forEach((x, i) => {
      expect(x.since(marks[i] as number)).toEqual([]);
    });
    expect(JSON.stringify([b, c, tv].map((x) => x.room.match))).toBe(before);
    for (const x of [b, c, tv]) expect(JSON.stringify(x.msgs)).not.toMatch(/"check":\{/);
    expect(view(b).check).toBeNull();

    // Kopuk oyuncunun kadehi de kontrol edilebilir.
    c.ws.close();
    await until(() => a.room.players.find((p) => p.nickname === "C")?.connected === false, "C koptu");
    expect(await send(b, { kind: "check", target: c.session.playerId })).toEqual({ ok: true });
    await until(() => view(b).check !== null, "b kontrol sonucu");
    expect(view(b).check?.cup).toBe(2);

    // Süre bitince kontrol reddedilir; kontrol sonuçta da kimseye açılmaz.
    k.clock.advance(startedAt + 20_000 + 250 - k.clock.now());
    await until(() => pub(a).ended, "açılış evresi");
    expect(await send(b, { kind: "check", target: a.session.playerId })).toEqual({
      ok: false,
      reason: "ended",
    });
    k.clock.advance(ZEHIRLI_KADEH_REVEAL.totalMs);
    await until(() => a.room.phase === "results", "sonuç");
    expect(view(a).check).toEqual(result);
    const r = pub(a).result;
    expect(r?.poisonedCups.includes(1)).toBe(result?.poisoned);
    for (const x of [tv]) expect(JSON.stringify(x.msgs)).not.toMatch(/"check":\{/);
  });
});
