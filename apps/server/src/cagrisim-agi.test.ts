import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

type PubView = {
  startedAt: number;
  answerEndsAt: number;
  word: string;
  phase: "answer" | "reveal";
  answeredIds: string[];
  reveal: { groups: { text: string; members: string[]; points: number }[]; silent: string[] } | null;
};

const viewOf = (c: Client): { myAnswer: string | null } => c.room.match?.view as { myAnswer: string | null };
const pubOf = (c: Client): PubView => c.room.match?.publicView as PubView;

let seq = 100;
async function answer(c: Client, text: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload: { kind: "answer", text } });
  await until(() => c.of("actionAck").some((a) => a.seq === n), "ack");
  const ack = c.of("actionAck").find((a) => a.seq === n);
  return { ok: ack?.ok === true, ...(ack && "reason" in ack && ack.reason ? { reason: ack.reason } : {}) };
}

describe("çağrışım ağı: oda içi tam maç", () => {
  it("gizli cevaplar, açılış, gruplar ve ödüller genel skora işlenir", async () => {
    const [a, b, c, d] = (await setupRoom(["A", "B", "C", "D"])) as [Client, Client, Client, Client];
    a.send({ type: "setGames", gameIds: ["cagrisim-agi"] });
    await sync();
    const { startedAt } = await startPlaying([a, b, c, d]);
    const at = (offset: number) => k.clock.advance(startedAt + offset - k.clock.now());
    expect(a.room.match?.gameId).toBe("cagrisim-agi");
    const [ida, idb, idc, idd] = [a, b, c, d].map((x) => x.session.playerId) as [
      string,
      string,
      string,
      string,
    ];

    at(1_000);
    expect(await answer(a, "")).toEqual({ ok: false, reason: "empty" });
    expect(await answer(a, 5)).toMatchObject({ ok: false, reason: "invalid_action" });
    expect(await answer(a, "Işık")).toEqual({ ok: true });
    expect(await answer(a, "başka")).toMatchObject({ ok: false, reason: "already_answered" });
    at(2_000);
    expect(await answer(b, "  IŞIK ")).toEqual({ ok: true });
    expect(await answer(c, "ZZ")).toEqual({ ok: true });
    await sync();

    // Süre bitene kadar kimsenin cevabı başkasına gitmez.
    const pub = a.room.match?.publicView as PubView;
    expect(pub.phase).toBe("answer");
    expect(pub.reveal).toBeNull();
    expect(pub.answeredIds).toEqual([ida, idb, idc]);
    for (const x of [b, c, d]) {
      const raw = JSON.stringify(x.room.match);
      if (x !== b) expect(raw).not.toContain("Işık");
      expect(raw).not.toContain("IŞIK ");
    }
    expect(JSON.stringify(d.room.match)).not.toContain("ZZ");
    expect(viewOf(a).myAnswer).toBe("Işık");
    expect(viewOf(d).myAnswer).toBeNull();

    // 30. saniyede cevap kapanır ve açılış başlar.
    at(29_900);
    await sync();
    expect(pubOf(a).phase).toBe("answer");
    at(30_000);
    expect(await answer(d, "geç")).toMatchObject({ ok: false, reason: "ended" });
    await until(() => pubOf(a).phase === "reveal", "açılış");
    const revealed = pubOf(d).reveal;
    expect(revealed?.groups).toEqual([{ text: "ışık", members: [ida, idb], points: 2 }]);
    expect(revealed?.silent).toEqual([idd]);
    expect(a.room.phase).toBe("playing");

    // Açılış bitince sonuç: ödüller genel skora eklenir.
    at(36_000);
    await until(() => a.room.phase === "results", "sonuç");
    const result = a.room.match?.result;
    expect(result?.miniScores).toEqual({ [ida]: 2, [idb]: 2, [idc]: 0, [idd]: 0 });
    expect(result?.awards).toEqual(result?.miniScores);
    expect(a.room.players.map((p) => p.score)).toEqual([2, 2, 0, 0]);
    k.clock.advance(7_000);
    await until(() => a.room.phase === "final", "final");
    expect(a.room.players.map((p) => p.score)).toEqual([2, 2, 0, 0]);
  });
});
