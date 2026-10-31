import { describe, expect, it, vi } from "vitest";
import type { AiFetch } from "./aiComment.js";
import { type Client, k, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

// Sahte yapay zekâ ucu: düello spikeri yorumu yer tutucu adla döner, sunucu gerçek adı koyar.
const aiFetch = vi.fn<AiFetch>(async () => ({
  status: 200,
  json: async () => ({
    stop_reason: "end_turn",
    content: [
      { type: "text", text: "Oyuncu3 iki turda da tetiğe ilk basan oldu, sipere bile gerek duymadı." },
    ],
  }),
}));
useServer({ aiKey: "test-anahtar", aiFetch });

let seq = 1000;
async function send(c: Client, payload: unknown): Promise<{ ok: boolean; reason: string | undefined }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  await until(() => c.of("actionAck").some((a) => a.seq === n), "eylem onayı");
  const ack = c.of("actionAck").find((a) => a.seq === n);
  return { ok: ack?.ok === true, reason: ack?.reason };
}
const aim = (c: Client, target: string) => send(c, { kind: "target", target });
const cover = (c: Client) => send(c, { kind: "cover" });

interface Round {
  targets: Record<string, string | null>;
  cover: string[];
  scores: Record<string, number>;
}
const pubOf = (c: Client) => {
  const match = c.room.match;
  if (!match) throw new Error("oyun yok");
  return match.publicView as { rounds: Round[]; totals: Record<string, number> | null };
};

describe("Çapraz Ateş: tam oda maçı", () => {
  it("iki tur: seçimler gizli kalır, her tur bitince açılır, toplam genel skora eklenir", async () => {
    aiFetch.mockClear();
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

    // Tur 1: A önce C'yi, sonra B'yi seçer; B → A (karşılıklı); C siper alır.
    at(2_000);
    expect((await aim(a, ic)).ok).toBe(true);
    at(3_000);
    expect((await aim(a, ib)).ok).toBe(true);
    expect((await aim(b, ia)).ok).toBe(true);
    expect((await cover(c)).ok).toBe(true);
    await sync();

    // Tur bitmeden: kimse başkasının seçimini görmez.
    for (const [client, own, ownCover, other] of [
      [a, ib, false, ic],
      [b, ia, false, ic],
      [c, null, true, ia],
    ] as const) {
      const match = client.room.match;
      if (!match) throw new Error("oyun yok");
      expect(match.view).toEqual({ myTarget: own, cover: ownCover, locked: false });
      const pub = JSON.stringify(match.publicView);
      for (const id of [ia, ib, ic]) expect(pub).not.toContain(id);
      expect(JSON.stringify(match.view)).not.toContain(other);
      expect(pubOf(client).rounds).toEqual([]);
    }

    // 20 sn: tur 1 açılır (kısa açılış); bu sırada seçim reddedilir.
    at(20_000);
    await sync();
    expect((await aim(c, ib)).ok).toBe(false);
    expect(a.room.phase).toBe("playing");
    const first = pubOf(a).rounds[0];
    expect(first?.targets).toEqual({ [ia]: ib, [ib]: ia, [ic]: null });
    expect(first?.cover).toEqual([ic]);
    expect(first?.scores).toEqual({ [ia]: 0, [ib]: 0, [ic]: 0 });
    expect(a.room.match?.view).toEqual({ myTarget: null, cover: false, locked: false });

    // Tur 2 (25 sn): C, A'yı hedefler; A ile B seçmez. Tur 1 bilgisi açık kalır, tur 2 seçimi gizli.
    at(26_000);
    expect((await aim(c, ia)).ok).toBe(true);
    await sync();
    expect(pubOf(b).rounds).toHaveLength(1);
    expect(JSON.stringify(pubOf(b).rounds)).toBe(JSON.stringify([first]));
    expect(b.room.match?.view).toEqual({ myTarget: null, cover: false, locked: false });

    // 45 sn: tur 2 açılır; geç eylem reddedilir; oyun final açılışı için sürer.
    at(45_000);
    await sync();
    expect((await aim(a, ic)).ok).toBe(false);
    expect(a.room.phase).toBe("playing");
    expect(pubOf(a).rounds[1]?.scores).toEqual({ [ia]: -1, [ib]: 0, [ic]: 1 });
    expect(pubOf(a).totals).toEqual({ [ia]: -1, [ib]: 0, [ic]: 1 });

    // Düello spikeri: final açılınca tek istek; modele yalnız yer tutucu adlar gider; yorum açılış sırasında gelir.
    await until(() => a.room.match?.comment !== undefined, "yorum");
    expect(a.room.match?.comment).toBe("Can iki turda da tetiğe ilk basan oldu, sipere bile gerek duymadı.");
    expect(aiFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(aiFetch.mock.calls[0]?.[1]?.body ?? "{}") as { messages: { content: string }[] };
    const prompt = body.messages[0]?.content ?? "";
    expect(prompt).toContain("Çapraz Ateş");
    expect(prompt).toContain("tur 2: Oyuncu1 hedefine ateş etti");
    expect(prompt).toContain("siper aldı");
    for (const s of [ia, ib, ic, "Ali", "Banu", "Can"]) expect(prompt).not.toContain(s);

    // Final açılışı bitince sonuç: toplamlar.
    at(53_000);
    await until(() => a.room.phase === "results", "sonuçlar");
    const result = a.room.match?.result;
    expect(result?.miniScores).toEqual({ [ia]: -1, [ib]: 0, [ic]: 1 });
    expect(result?.awards).toEqual({ [ia]: -1, [ib]: 0, [ic]: 1 });
    expect(a.room.players.map((p) => p.score)).toEqual([-1, 0, 1]);
  });
});
