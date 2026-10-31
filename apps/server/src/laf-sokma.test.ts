import { lafAwards } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 9000;
async function act(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  return ack?.reason === undefined ? { ok: ack?.ok === true } : { ok: ack.ok, reason: ack.reason };
}

interface Card {
  id: string;
  text: string | null;
}
interface RevealCard extends Card {
  author: string;
  voters: string[];
  points: number;
  master: boolean;
}
interface Pub {
  phase: string;
  index: number | null;
  total: number;
  ready: string[];
  voters: string[];
  duel: null | { id: string; prompt: string; cards: Card[] };
  reveal: null | { id: string; prompt: string; cards: RevealCard[] };
  history: { id: string; cards: RevealCard[] }[];
  scores: Record<string, number>;
}
interface Priv {
  tasks: { id: string; prompt: string; answer: string | null }[];
  locked: boolean;
  myCard: string | null;
  myVote: string | null;
}
const pubOf = (c: Client): Pub => c.room.match?.publicView as Pub;
const privOf = (c: Client): Priv => c.room.match?.view as Priv;

async function startGame(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["laf-sokma"] });
  await until(() => host.room.gameIds.join() === "laf-sokma", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
}

describe("laf-sokma: oda içinde tam maç", () => {
  it("yazma, düellolar, final; kahkaha puanının sıralaması genel skora eklenir; yazarlar açılışa kadar gizli", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, , d] = cs as [Client, Client, Client, Client];
    await startGame(cs);
    const ids = cs.map((x) => x.session.playerId) as string[];
    await sync();

    expect(pubOf(a).phase).toBe("write");
    expect(pubOf(a).total).toBe(4);
    for (const x of cs) expect(privOf(x).tasks).toHaveLength(2);

    // Moderasyon ve temizlik sunucuda.
    const first = privOf(a).tasks[0]?.id as string;
    expect(await act(a, { kind: "answer", prompt: first, text: "siktir" })).toEqual({
      ok: false,
      reason: "inappropriate",
    });
    expect((await act(a, { kind: "answer", prompt: first, text: "x".repeat(81) })).reason).toBe("too_long");
    expect((await act(a, { kind: "lock" })).reason).toBe("nothing_to_lock");
    expect((await act(a, { kind: "answer", prompt: "final", text: "erken" })).reason).toBe("not_yours");

    // D yalnız bir soruyu yanıtlar (öbürü "Cevap yok" olur); diğerleri ikisini.
    const written: Record<string, string> = {};
    for (const x of cs) {
      const pid = x.session.playerId as string;
      const tasks = privOf(x).tasks;
      for (const [i, t] of tasks.entries()) {
        if (x === d && i === 1) continue;
        const text = `  Cevap   ${t.id}  ${pid.slice(0, 4)} `;
        expect((await act(x, { kind: "answer", prompt: t.id, text })).ok).toBe(true);
        written[`${t.id}|${pid}`] = text.replace(/\s+/g, " ").trim();
      }
    }
    await sync();
    expect(privOf(b).tasks.every((t) => t.answer?.startsWith("Cevap q"))).toBe(true);
    for (const x of cs) {
      const raw = JSON.stringify(x.room.match);
      for (const [key, text] of Object.entries(written)) {
        if (key.endsWith(x.session.playerId as string)) continue;
        expect(raw).not.toContain(text);
      }
    }

    // Herkes Tamam der: yazma 1 sn sonra biter.
    for (const x of cs) expect((await act(x, { kind: "lock" })).ok).toBe(true);
    expect((await act(a, { kind: "answer", prompt: first, text: "geç" })).reason).toBe("locked");
    await sync();
    expect(pubOf(a).ready).toHaveLength(4);
    k.clock.advance(1_100);
    await until(() => pubOf(a).phase !== "write", "yazma erken bitti");

    // Düellolar: oy verebilenler ilk dolu karta oy verir.
    const expected: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
    let sawEmptyCard = false;
    for (let i = 0; i < 4; i++) {
      await until(
        () => (pubOf(a).phase === "vote" || pubOf(a).phase === "reveal") && pubOf(a).index === i,
        `düello ${i}`,
      );
      if (pubOf(a).phase === "vote") {
        expect(pubOf(a).index).toBe(i);
        const duel = pubOf(a).duel as NonNullable<Pub["duel"]>;
        expect(duel.cards).toHaveLength(2);
        if (duel.cards.some((c) => c.text === null)) sawEmptyCard = true;
        for (const x of cs) {
          expect(JSON.stringify(pubOf(x).duel)).not.toContain("author");
          expect(JSON.stringify(pubOf(x).history)).not.toContain(duel.id);
          expect(pubOf(x).reveal).toBeNull();
        }
        const voters = pubOf(a).voters;
        expect(voters).toHaveLength(2);
        const target = duel.cards.find((c) => c.text !== null);
        for (const x of cs) {
          const pid = x.session.playerId as string;
          if (voters.includes(pid)) {
            expect((await act(x, { kind: "vote", card: target?.id as string })).ok).toBe(true);
            expect((await act(x, { kind: "vote", card: target?.id as string })).reason).toBe("already_voted");
            // Onaylanan oy kesindir: başka karta geçmek de reddedilir.
            const other = duel.cards.find((c) => c.id !== target?.id)?.id as string;
            expect((await act(x, { kind: "vote", card: other })).reason).toBe("already_voted");
          } else {
            expect((await act(x, { kind: "vote", card: target?.id as string })).reason).toBe("cannot_vote");
          }
        }
        k.clock.advance(1_100); // oy verebilen herkes verdi: erken biter
      }
      await until(() => pubOf(a).phase === "reveal" && pubOf(a).index === i, "açılış");
      const r = pubOf(a).reveal as NonNullable<Pub["reveal"]>;
      if (r.cards.some((c) => c.text === null)) sawEmptyCard = true;
      for (const c of r.cards) expected[c.author] = (expected[c.author] ?? 0) + c.points;
      expect(pubOf(a).scores).toEqual(expected);
      k.clock.advance(7_100);
    }
    expect(sawEmptyCard).toBe(true);

    // Final: herkes yazar, kilitler, oy verir.
    await until(() => pubOf(a).phase === "finalWrite", "final yazma");
    expect(privOf(a).tasks).toHaveLength(1);
    expect(privOf(a).tasks[0]?.id).toBe("final");
    for (const x of cs) {
      const pid = x.session.playerId as string;
      expect((await act(x, { kind: "answer", prompt: "final", text: `Final ${pid.slice(0, 4)}` })).ok).toBe(
        true,
      );
      expect((await act(x, { kind: "lock" })).ok).toBe(true);
    }
    k.clock.advance(1_100);
    await until(() => pubOf(a).phase === "finalVote", "final oylama");
    const finalCards = (pubOf(a).duel as NonNullable<Pub["duel"]>).cards;
    expect(finalCards).toHaveLength(4);
    expect(pubOf(a).voters).toHaveLength(4);
    const own = privOf(a).myCard as string;
    expect((await act(a, { kind: "vote", card: own })).reason).toBe("own_card");
    const mostVoted = finalCards[0] as Card;
    for (const x of cs) {
      const mine = privOf(x).myCard;
      const target = mine === mostVoted.id ? finalCards[1] : mostVoted;
      expect((await act(x, { kind: "vote", card: (target as Card).id })).ok).toBe(true);
    }
    k.clock.advance(1_100);
    await until(() => pubOf(a).phase === "finalReveal", "final açılış");
    const fr = pubOf(a).reveal as NonNullable<Pub["reveal"]>;
    for (const c of fr.cards) {
      expect(c.master).toBe(false);
      expected[c.author] = (expected[c.author] ?? 0) + c.points;
    }
    expect(fr.cards.reduce((sum, c) => sum + c.points, 0)).toBe(4);

    k.clock.advance(12_000);
    await until(() => a.room.phase === "results", "sonuç");
    // Oyun içi puan kahkaha puanıdır; genel skora sıralama ödülü (+2 / +1 / 0) gider.
    const awards = lafAwards(expected);
    expect(a.room.match?.result?.miniScores).toEqual(expected);
    expect(a.room.match?.result?.awards).toEqual(awards);
    for (const v of Object.values(a.room.match?.result?.awards ?? {})) expect([0, 1, 2]).toContain(v);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => awards[id]));
    expect(d.room.players.map((p) => p.score)).toEqual(a.room.players.map((p) => p.score));
  });
});
