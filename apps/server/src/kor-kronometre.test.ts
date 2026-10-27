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

describe("kor-kronometre tam maç", () => {
  it("basışlar sunucu saatiyle ölçülür, süre dolana kadar gizli kalır, +2/+1 genel skora işlenir", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    a.send({ type: "setGames", gameIds: ["kor-kronometre"] });
    await until(() => a.room.gameIds[0] === "kor-kronometre", "oyun seçildi");
    const { startedAt } = await startPlaying(cs);
    expect(a.room.match?.gameId).toBe("kor-kronometre");
    const at = (ms: number) => k.clock.advance(startedAt + ms - k.clock.now());

    // Hedef her oyunda 7–13 sn arası rastgeledir ve baştan herkese açıktır; süre = hedef + 8 sn.
    const T = pub(a).targetMs;
    expect(T % 1000).toBe(0);
    expect(T).toBeGreaterThanOrEqual(7_000);
    expect(T).toBeLessThanOrEqual(13_000);
    expect(pub(d).targetMs).toBe(T);
    const dur = T + 8_000;
    expect(pub(a).endsAt - pub(a).startedAt).toBe(dur);

    at(T - 600);
    expect((await send(a, { kind: "press" })).ok).toBe(true); // 600 uzak
    expect(await send(a, { kind: "press" })).toEqual({ ok: false, reason: "already_pressed" });
    at(T + 150);
    expect((await send(b, { kind: "press" })).ok).toBe(true); // 150 uzak
    at(T + 2_000);
    expect((await send(c, { kind: "press" })).ok).toBe(true); // 2000 uzak
    expect(await send(c, { kind: "tap" })).toMatchObject({ ok: false });
    await sync();

    // Süre dolmadan: kimsenin basışı ya da kimin bastığı ağdan geçmez.
    expect(pub(d).reveal).toBeNull();
    expect(view(a)).toEqual({ pressed: true });
    expect(view(d)).toEqual({ pressed: false });
    for (const x of cs) {
      const json = JSON.stringify(x.msgs);
      expect(json).not.toContain(`"ms":${T - 600}`);
      expect(json).not.toContain(`"ms":${T + 150}`);
    }

    // D hiç basmaz: sıralamaya girmez, puan almaz.
    at(dur - 1);
    expect(pub(a).reveal).toBeNull();
    at(dur);
    await until(() => pub(a).reveal !== null, "basışlar açıldı");
    expect(await send(b, { kind: "press" })).toMatchObject({ ok: false });
    const rows = pub(a).reveal?.entries ?? [];
    expect(rows.map((r) => [r.ms, r.points, r.rank])).toEqual([
      [T + 150, 2, 1],
      [T - 600, 1, 2],
      [T + 2_000, 0, 3],
      [null, 0, null],
    ]);

    k.clock.advance(6_100);
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
    const dur = pub(a).endsAt - pub(a).startedAt;
    expect(dur).toBe(pub(a).targetMs + 8_000);
    k.clock.advance(dur);
    await until(() => pub(a).reveal !== null, "açıldı");
    expect(pub(a).reveal?.entries.every((e) => !e.pressed && e.rank === null)).toBe(true);
    k.clock.advance(6_100);
    await until(() => a.room.phase === "results", "sonuç");
    expect(Object.values(a.room.match?.result?.awards ?? {})).toEqual([0, 0]);
  });

  it("tek kişi bastıysa yalnız o +2 alır", async () => {
    const cs = await setupRoom(["A", "B"], ["kor-kronometre"]);
    const [a, b] = cs as [Client, Client];
    const { startedAt } = await startPlaying(cs);
    k.clock.advance(startedAt + 3_000 - k.clock.now());
    expect((await send(b, { kind: "press" })).ok).toBe(true);
    k.clock.advance(pub(a).endsAt - k.clock.now());
    await until(() => pub(a).reveal !== null, "açıldı");
    k.clock.advance(6_100);
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.match?.result?.awards).toEqual({
      [a.session.playerId]: 0,
      [b.session.playerId]: 2,
    });
  });
});
