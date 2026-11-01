import { CAGRISIM_POOL } from "@glix/engine";
import { describe, expect, it, vi } from "vitest";
import type { AiFetch } from "./aiComment.js";
import { RESULTS_MS } from "./match.js";
import { type Client, k, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

// Sahte yapay zekâ ucu (canlı API asla çağrılmaz): ağ spikeri yer tutucu adla döner, sunucu gerçek adı koyar.
const aiFetch = vi.fn<AiFetch>(async () => ({
  status: 200,
  json: async () => ({
    stop_reason: "end_turn",
    content: [
      { type: "text", text: "Oyuncu4 herkes maviye koşarken ördeği düşündü, kara koyun ama sevimli." },
    ],
  }),
}));
useServer({ statsDb: ":memory:", aiKey: "test-anahtar", aiFetch });

type Group = { text: string; members: string[]; points: number; variants: string[] };
type PubView = {
  round: number;
  roundStartedAt: number;
  answerEndsAt: number;
  word: string;
  phase: "answer" | "mini" | "final";
  answeredIds: string[];
  results: { word: string; reveal: { groups: Group[]; silent: string[] } }[];
  totals: Record<string, number>;
  awards: Record<string, number> | null;
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

describe("çağrışım ağı: oda içi tam maç (üç kelime)", () => {
  it("gizli cevaplar, mini açılışlar, büyük açılış, ödüller, karne, tekrar hafızası ve spiker", async () => {
    aiFetch.mockClear();
    const [a, b, c, d] = (await setupRoom(["Ali", "Banu", "Can", "Derya"])) as [
      Client,
      Client,
      Client,
      Client,
    ];
    a.send({ type: "setGames", gameIds: ["cagrisim-agi"] });
    await sync();
    const { startedAt } = await startPlaying([a, b, c, d]);
    const at = (offset: number) => k.clock.advance(startedAt + offset - k.clock.now());
    expect(a.room.match?.gameId).toBe("cagrisim-agi");
    const ids = [a, b, c, d].map((x) => x.session.playerId) as [string, string, string, string];
    const [ida, idb, idc, idd] = ids;
    const words: string[] = [pubOf(a).word];

    // Kelime 1: a ve b "Işık"/"IŞIK" (aynı ağ), c kısa cevap, d yazmaz.
    at(1_000);
    expect(await answer(a, "")).toEqual({ ok: false, reason: "empty" });
    expect(await answer(a, 5)).toMatchObject({ ok: false, reason: "invalid_action" });
    expect(await answer(a, "Işık")).toEqual({ ok: true });
    expect(await answer(a, "başka")).toMatchObject({ ok: false, reason: "already_answered" });
    at(2_000);
    expect(await answer(b, "  IŞIK ")).toEqual({ ok: true });
    expect(await answer(c, "ZZ")).toEqual({ ok: true });
    await sync();
    const pub = pubOf(a);
    expect(pub.phase).toBe("answer");
    expect(pub.results).toEqual([]);
    expect(pub.answeredIds).toEqual([ida, idb, idc]);
    for (const x of [b, c, d]) {
      const raw = JSON.stringify(x.room.match);
      if (x !== b) expect(raw).not.toContain("Işık");
    }
    expect(JSON.stringify(d.room.match)).not.toContain("ZZ");
    expect(viewOf(a).myAnswer).toBe("Işık");
    expect(viewOf(d).myAnswer).toBeNull();

    // 20. saniyede kelime kapanır, 4 sn'lik mini açılış.
    at(20_000);
    expect(await answer(d, "geç")).toMatchObject({ ok: false, reason: "ended" });
    await until(() => pubOf(a).phase === "mini", "mini açılış");
    expect(pubOf(d).results[0]?.reveal.groups).toEqual([
      { text: "Işık", members: [ida, idb], points: 2, variants: [] },
    ]);
    expect(pubOf(d).results[0]?.reveal.silent).toEqual([idd]);
    expect(a.room.phase).toBe("playing");

    // Kelime 2: herkes yazar ("dalgalar" = "dalga", "kumsal" = "kumsak") → erken biter.
    at(24_000);
    await until(() => pubOf(a).round === 1 && pubOf(a).phase === "answer", "kelime 2");
    words.push(pubOf(a).word);
    expect(viewOf(a).myAnswer).toBeNull();
    at(25_000);
    expect(await answer(a, "dalgalar")).toEqual({ ok: true });
    expect(await answer(b, "dalga")).toEqual({ ok: true });
    expect(await answer(c, "kumsal")).toEqual({ ok: true });
    expect(await answer(d, "kumsak")).toEqual({ ok: true });
    await sync();
    // Bağlı herkes yazdı: cevap aşaması 1 sn sonra biter.
    expect(pubOf(a).answerEndsAt).toBeLessThan(pubOf(a).roundStartedAt + 20_000);
    at(26_000);
    await until(() => pubOf(a).phase === "mini", "mini açılış 2");
    expect(pubOf(a).totals).toEqual({ [ida]: 4, [idb]: 4, [idc]: 2, [idd]: 2 });

    // Kelime 3: a, b, c "mavi"; d "ördek".
    at(30_000);
    await until(() => pubOf(a).round === 2, "kelime 3");
    words.push(pubOf(a).word);
    at(31_000);
    for (const x of [a, b, c]) expect(await answer(x, "mavi")).toEqual({ ok: true });
    expect(await answer(d, "ördek")).toEqual({ ok: true });
    at(32_000);
    await until(() => pubOf(a).phase === "final", "büyük açılış");
    expect(pubOf(a).awards).toEqual({ [ida]: 2, [idb]: 2, [idc]: 1, [idd]: 0 });

    // Ağ spikeri (CG-AI2): büyük açılışta tek istek; modele yalnız yer tutucu adlar gider.
    await until(() => a.room.match?.comment !== undefined, "yorum");
    expect(a.room.match?.comment).toBe(
      "Derya herkes maviye koşarken ördeği düşündü, kara koyun ama sevimli.",
    );
    expect(aiFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(aiFetch.mock.calls[0]?.[1]?.body ?? "{}") as { messages: { content: string }[] };
    const prompt = body.messages[0]?.content ?? "";
    expect(prompt).toContain("Çağrışım Ağı");
    expect(prompt).toContain('"mavi" ağı: Oyuncu1, Oyuncu2, Oyuncu3');
    expect(prompt).toContain('Oyuncu4 tek kaldı ("ördek")');
    for (const s of [...ids, "Ali", "Banu", "Can", "Derya"]) expect(prompt).not.toContain(s);

    // Büyük açılış (en az 8 sn) bitince sonuç: toplam ağ puanı mini puan, ödül +2/+1/0.
    at(40_000);
    await until(() => a.room.phase === "results", "sonuç");
    const result = a.room.match?.result;
    expect(result?.miniScores).toEqual({ [ida]: 7, [idb]: 7, [idc]: 5, [idd]: 2 });
    expect(result?.awards).toEqual({ [ida]: 2, [idb]: 2, [idc]: 1, [idd]: 0 });
    expect(a.room.players.map((p) => p.score)).toEqual([2, 2, 1, 0]);

    // Kelime karnesi (CG-M6): kelime başına iki oran; cevap metni yok.
    const cards = k.srv.runtime.stats.contentPlayStats(CAGRISIM_POOL.id);
    const key = (w: string) => CAGRISIM_POOL.key({ text: w, level: null });
    expect(cards.get(key(words[0] as string))).toEqual({ games: 1, top: 2 / 3, single: 1 / 3 });
    expect(cards.get(key(words[1] as string))).toEqual({ games: 1, top: 0.5, single: 0 });
    expect(cards.get(key(words[2] as string))).toEqual({ games: 1, top: 0.75, single: 0.25 });

    // Tekrar hafızası (CG-M4): üç kelime odada saklanır.
    const room = [...k.srv.runtime.rooms.values()][0];
    expect(room?.recentContent?.get(CAGRISIM_POOL.id)).toEqual(words.map(key));

    k.clock.advance(RESULTS_MS);
    await until(() => a.room.phase === "final", "final");
    expect(a.room.players.map((p) => p.score)).toEqual([2, 2, 1, 0]);
  });
});
