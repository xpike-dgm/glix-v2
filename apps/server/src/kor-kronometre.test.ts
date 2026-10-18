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

    at(9_400);
    expect((await send(a, { kind: "press" })).ok).toBe(true); // 600 uzak
    expect(await send(a, { kind: "press" })).toEqual({ ok: false, reason: "already_pressed" });
    at(10_150);
    expect((await send(b, { kind: "press" })).ok).toBe(true); // 150 uzak
    at(12_000);
    expect((await send(c, { kind: "press" })).ok).toBe(true); // 2000 uzak
    expect(await send(c, { kind: "tap" })).toMatchObject({ ok: false });
    await sync();

    // Süre dolmadan: kimsenin basışı ya da kimin bastığı ağdan geçmez.
    expect(pub(d).reveal).toBeNull();
    expect(view(a)).toEqual({ pressed: true });
    expect(view(d)).toEqual({ pressed: false });
    for (const x of cs) {
      const json = JSON.stringify(x.msgs);
      expect(json).not.toContain("9400");
      expect(json).not.toContain("10150");
    }

    at(17_999);
    expect((await send(d, { kind: "press" })).ok).toBe(true); // 7999 uzak
    at(18_000);
    await until(() => pub(a).reveal !== null, "basışlar açıldı");
    expect(await send(b, { kind: "press" })).toMatchObject({ ok: false });
    const rows = pub(a).reveal?.entries ?? [];
    expect(rows.map((r) => [r.ms, r.points])).toEqual([
      [10_150, 2],
      [9_400, 1],
      [12_000, 0],
      [17_999, 0],
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

  it("kimse basmazsa hepsi 18 sn sayılır ve eşit derece aynı ödülü alır", async () => {
    const cs = await setupRoom(["A", "B"], ["kor-kronometre"]);
    const a = cs[0] as Client;
    await startPlaying(cs);
    k.clock.advance(18_000);
    await until(() => pub(a).reveal !== null, "açıldı");
    k.clock.advance(6_100);
    await until(() => a.room.phase === "results", "sonuç");
    expect(Object.values(a.room.match?.result?.awards ?? {})).toEqual([2, 2]);
  });
});
