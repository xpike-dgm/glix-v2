import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 1000;
async function aim(c: Client, target: string): Promise<{ ok: boolean; reason: string | undefined }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload: { kind: "target", target } });
  await until(() => c.of("actionAck").some((a) => a.seq === n), "eylem onayı");
  const ack = c.of("actionAck").find((a) => a.seq === n);
  return { ok: ack?.ok === true, reason: ack?.reason };
}

describe("Çapraz Ateş: tam oda maçı", () => {
  it("hedefler gizli kalır, süre bitince açılır, puanlar genel skora eklenir", async () => {
    const [a, b, c] = await setupRoom(["Ali", "Banu", "Can"]);
    if (!a || !b || !c) throw new Error("oyuncular kurulamadı");
    a.send({ type: "setGames", gameIds: ["capraz-ates"] });
    await until(() => a.room.gameIds.includes("capraz-ates") && a.room.gameIds.length === 1, "oyun seçildi");
    const { startedAt } = await startPlaying([a, b, c]);
    const [ia, ib, ic] = [a.session.playerId, b.session.playerId, c.session.playerId];
    const at = (ms: number) => k.clock.advance(startedAt + ms - k.clock.now());

    // Kendini hedefleme ve bilinmeyen hedef reddedilir.
    at(1_000);
    expect((await aim(a, ia)).ok).toBe(false);
    expect((await aim(a, "yok-boyle-biri")).ok).toBe(false);

    // A önce C'yi seçer, sonra B'yi (son seçim geçerli); B → A (karşılıklı); C → A.
    at(2_000);
    expect((await aim(a, ic)).ok).toBe(true);
    at(3_000);
    expect((await aim(a, ib)).ok).toBe(true);
    expect((await aim(b, ia)).ok).toBe(true);
    expect((await aim(c, ia)).ok).toBe(true);
    await sync();

    // Süre bitmeden: kimse başkasının hedefini görmez.
    for (const [client, own, other] of [
      [a, ib, ic],
      [b, ia, ic],
      [c, ia, ib],
    ] as const) {
      const match = client.room.match;
      if (!match) throw new Error("oyun yok");
      expect(match.view).toEqual({ myTarget: own });
      const pub = JSON.stringify(match.publicView);
      expect(pub).not.toContain(ia);
      expect(pub).not.toContain(ib);
      expect(pub).not.toContain(ic);
      expect(JSON.stringify(match.view)).not.toContain(other);
      expect((match.publicView as { reveal: unknown }).reveal).toBeNull();
    }

    // 25 sn dolunca hedefler açılır ve geç eylem reddedilir; oyun hâlâ sürer (izler gösterilir).
    at(25_000);
    await sync();
    const rejected = await aim(c, ib);
    expect(rejected.ok).toBe(false);
    expect(a.room.phase).toBe("playing");
    const shared = a.room.match;
    if (!shared) throw new Error("oyun yok");
    const reveal = (
      shared.publicView as {
        reveal: { targets: Record<string, string | null>; scores: Record<string, number> };
      }
    ).reveal;
    expect(reveal.targets).toEqual({ [ia]: ib, [ib]: ia, [ic]: ia });
    expect(reveal.scores).toEqual({ [ia]: 0, [ib]: 0, [ic]: 1 });

    // İzleme süresi bitince sonuç: karşılıklı çift 0, C +1.
    at(32_000);
    await until(() => a.room.phase === "results", "sonuçlar");
    const result = a.room.match?.result;
    expect(result?.miniScores).toEqual({ [ia]: 0, [ib]: 0, [ic]: 1 });
    expect(result?.awards).toEqual({ [ia]: 0, [ib]: 0, [ic]: 1 });
    expect(a.room.players.map((p) => p.score)).toEqual([0, 0, 1]);
  });
});
