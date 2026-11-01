import type { KorKronometrePublicView, KorKronometreView } from "@glix/engine";
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

const pub = (c: Client) => c.room.match?.publicView as KorKronometrePublicView;
const view = (c: Client) => c.room.match?.view as KorKronometreView;
const handOf = (c: Client, i: number) => {
  const h = pub(c).played[i];
  if (!h) throw new Error(`el ${i} görünmüyor`);
  return h;
};
const to = (t: number) => k.clock.advance(Math.max(0, t - k.clock.now()));

describe("kor-kronometre tam maç", () => {
  it("3 el: 'BAŞLA!'dan ölçülür, el kapanana kadar gizli, dokunma anı sayılır, toplamla +2/+1 genel skora işlenir", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    a.send({ type: "setGames", gameIds: ["kor-kronometre"] });
    await until(() => a.room.gameIds[0] === "kor-kronometre", "oyun seçildi");
    const { startedAt } = await startPlaying(cs);
    expect(a.room.match?.gameId).toBe("kor-kronometre");

    // 1. el: "Hazır ol" 3 sn; hedef baştan herkese açık; gelecek eller ve oyunun bitişi görünmez.
    const h0 = handOf(a, 0);
    expect(pub(a).phase).toBe("ready");
    expect(pub(a).played).toHaveLength(1);
    expect(pub(a).endsAt).toBeNull();
    expect(h0.goAt - startedAt).toBe(3_000);
    expect(h0.targetMs % 1000).toBe(0);
    expect(h0.endsAt - h0.goAt).toBe(h0.targetMs + 8_000);
    expect(pub(d).played[0]?.targetMs).toBe(h0.targetMs);
    const T = h0.targetMs;

    // "Hazır ol" sırasında basış hak yakmaz.
    to(h0.goAt - 500);
    expect(await send(a, { kind: "press" })).toEqual({ ok: false, reason: "not_started" });

    // A: sunucuya 300 ms geç ulaşan basış, dokunma anıyla sayılır (KR-M1).
    to(h0.goAt + T - 300);
    expect((await send(a, { kind: "press", at: h0.goAt + T - 600 })).ok).toBe(true); // 600 uzak
    expect(await send(a, { kind: "press" })).toEqual({ ok: false, reason: "already_pressed" });
    to(h0.goAt + T + 150);
    expect((await send(b, { kind: "press" })).ok).toBe(true); // 150 uzak
    to(h0.goAt + T + 2_000);
    expect((await send(c, { kind: "press" })).ok).toBe(true); // 2000 uzak
    expect(await send(c, { kind: "tap" })).toMatchObject({ ok: false });
    await sync();

    // El kapanmadan: kimsenin basışı ya da kimin bastığı ağdan geçmez.
    expect(handOf(d, 0).reveal).toBeNull();
    expect(view(a)).toEqual({ pressed: true });
    expect(view(d)).toEqual({ pressed: false });
    for (const x of cs) {
      const json = JSON.stringify(x.msgs);
      expect(json).not.toContain(`"ms":${T - 600}`);
      expect(json).not.toContain(`"ms":${T + 150}`);
    }

    // D basmaz: sıralanmaz. El kapanınca açılır; el arasında basış sayılmaz.
    to(h0.endsAt);
    await until(() => handOf(a, 0).reveal !== null, "1. el açıldı");
    expect(pub(a).phase).toBe("gap");
    expect(await send(d, { kind: "press" })).toEqual({ ok: false, reason: "between_hands" });
    expect(handOf(a, 0).reveal?.entries.map((r) => [r.ms, r.points, r.rank])).toEqual([
      [T + 150, 2, 1],
      [T - 600, 1, 2],
      [T + 2_000, 0, 3],
      [null, 0, null],
    ]);

    // 2. ve 3. el: yalnız B basar.
    for (const i of [1, 2]) {
      await until(() => pub(a).played.length > i, `${i + 1}. el`);
      const h = handOf(a, i);
      expect(h.goAt - h.startAt).toBe(2_000);
      to(h.goAt + h.targetMs);
      await until(() => pub(a).phase === "count", "sayma");
      // Dokunma anı tam hedefte (sunucuya biraz geç ulaşsa da): tam isabet.
      expect((await send(b, { kind: "press", at: h.goAt + h.targetMs })).ok).toBe(true);
      to(h.endsAt);
      await until(() => handOf(a, i).reveal !== null, `${i + 1}. el açıldı`);
    }
    await until(() => pub(a).final !== null, "son açılış");
    expect(pub(a).totals).toEqual(
      Object.fromEntries([
        [a.session.playerId, 1],
        [b.session.playerId, 2 + 3 + 3], // 2. ve 3. elde tek basan + tam isabet (KR-M5)
        [c.session.playerId, 0],
        [d.session.playerId, 0],
      ]),
    );

    to(pub(a).revealEndsAt ?? 0);
    k.clock.advance(100);
    await until(() => a.room.phase === "results", "sonuç");
    const ids = cs.map((x) => x.session.playerId);
    expect(a.room.match?.result?.awards).toEqual({
      [ids[0] as string]: 1,
      [ids[1] as string]: 2,
      [ids[2] as string]: 0,
      [ids[3] as string]: 0,
    });
    expect(a.room.players.map((p) => p.score)).toEqual([1, 2, 0, 0]);
    expect(d.room.players.map((p) => p.score)).toEqual([1, 2, 0, 0]);
  });

  it("kimse basmazsa kimse sıralanmaz ve kimse puan almaz", async () => {
    const cs = await setupRoom(["A", "B"], ["kor-kronometre"]);
    const a = cs[0] as Client;
    await startPlaying(cs);
    for (const i of [0, 1, 2]) {
      await until(() => pub(a).played.length > i, `${i + 1}. el`);
      to(handOf(a, i).endsAt);
      await until(() => handOf(a, i).reveal !== null, "açıldı");
      expect(handOf(a, i).reveal?.entries.every((e) => !e.pressed && e.rank === null)).toBe(true);
    }
    to(pub(a).revealEndsAt ?? 0);
    k.clock.advance(100);
    await until(() => a.room.phase === "results", "sonuç");
    expect(Object.values(a.room.match?.result?.awards ?? {})).toEqual([0, 0]);
  });
});
