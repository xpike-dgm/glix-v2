import { SOZLUK_ENTRIES } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 7000;
async function act(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  return ack?.reason === undefined ? { ok: ack?.ok === true } : { ok: ack.ok, reason: ack.reason };
}

interface Pub {
  phase: string;
  word: string;
  ready: string[];
  cards: null | { id: string; text: string }[];
  reveal: null | {
    realCard: string;
    authors: Record<string, string>;
    picks: Record<string, string>;
    scores: Record<string, number>;
  };
}
interface Priv {
  myBluff: string | null;
  myCard: string | null;
  myPick: string | null;
  locked: boolean;
}
const pubOf = (c: Client): Pub => c.room.match?.publicView as Pub;
const privOf = (c: Client): Priv => c.room.match?.view as Priv;

async function startGame(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["sozluk-blofu"] });
  await until(() => host.room.gameIds.join() === "sozluk-blofu", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
}

describe("sozluk-blofu: oda içinde tam maç", () => {
  it("sahte tanımlar temizlenir, gerçeğin aynısı reddedilir, kartlar sahipsiz karışık gelir, puanlar genel skora eklenir", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    await startGame(cs);
    const ids = cs.map((x) => x.session.playerId) as string[];
    await sync();

    const entry = SOZLUK_ENTRIES.find((e) => e.word === pubOf(a).word);
    expect(entry).toBeDefined();
    const definition = (entry as NonNullable<typeof entry>).definition;
    expect(pubOf(a).phase).toBe("write");
    expect(pubOf(a).cards).toBeNull();
    for (const x of cs) expect(JSON.stringify(x.room.match)).not.toContain(definition);

    // Gerçek tanımın aynısı (büyük harf, noktalı) dostça reddedilir; tanım kaydedilmez.
    const clash = await act(a, { kind: "bluff", text: `${definition.toLocaleUpperCase("tr-TR")}.` });
    expect(clash).toEqual({ ok: false, reason: "same_as_real" });
    expect((await act(a, { kind: "bluff", text: "x".repeat(101) })).reason).toBe("too_long");
    expect((await act(a, { kind: "bluff", text: "  \t " })).reason).toBe("empty");
    expect(privOf(a).myBluff).toBeNull();

    // Üç kişi yazar (D yazmaz): kartlar 4 olur. Temizlik sunucuda yapılır.
    expect((await act(a, { kind: "bluff", text: "  Eski\tbir   kayık türü.  " })).ok).toBe(true);
    expect((await act(b, { kind: "bluff", text: "dağda yaşayan bir kuş" })).ok).toBe(true);
    expect((await act(c, { kind: "bluff", text: "kumaştan dikilen bir şapka" })).ok).toBe(true);
    expect((await act(a, { kind: "bluff", text: "ikinci deneme" })).reason).toBe("already_written"); // kesin
    await sync();
    expect(privOf(a).myBluff).toBe("eski bir kayık türü");
    expect(privOf(b).myBluff).toBe("dağda yaşayan bir kuş");
    expect(pubOf(a).ready.length).toBe(3);
    expect(pubOf(a).cards).toBeNull();
    for (const x of [b, c, d]) expect(JSON.stringify(x.room.match)).not.toContain("eski bir kayık");

    k.clock.advance(50_000);
    await until(() => pubOf(a).phase === "pick", "seçme başladı");
    const cards = pubOf(a).cards as NonNullable<Pub["cards"]>;
    expect(cards.length).toBe(4);
    expect(cards.map((x) => x.text)).toContain(definition);
    expect((await act(a, { kind: "bluff", text: "geç kaldım" })).ok).toBe(false);
    for (const x of cs) {
      const raw = JSON.stringify(x.room.match);
      expect(raw).not.toContain('"authors"');
      expect(raw).not.toContain('"realCard"');
      expect(pubOf(x).reveal).toBeNull();
    }
    // Yazmayan D'nin kartı yoktur; yazanların kendi kartı vardır ve seçemezler.
    expect(privOf(d).myCard).toBeNull();
    const own = [a, b, c].map((x) => privOf(x).myCard as string);
    expect(new Set(own).size).toBe(3);
    expect((await act(a, { kind: "pick", card: own[0] as string })).reason).toBe("own_card");
    expect((await act(a, { kind: "pick", card: "k99" })).reason).toBe("unknown_card");

    // Herkes kendi kartı dışındaki ilk kartı seçer; D hepsini seçebilir.
    for (const x of cs) {
      const mine = privOf(x).myCard;
      const target = cards.find((card) => card.id !== mine) as { id: string };
      expect((await act(x, { kind: "pick", card: target.id })).ok).toBe(true);
    }
    await sync();
    expect(privOf(a).myPick).not.toBeNull();
    for (const x of cs) expect(pubOf(x).reveal).toBeNull();

    k.clock.advance(30_000);
    await until(() => pubOf(a).reveal !== null, "açıldı");
    expect((await act(d, { kind: "pick", card: cards[0]?.id })).ok).toBe(false); // geç seçim
    const r = pubOf(a).reveal as NonNullable<Pub["reveal"]>;
    expect(Object.keys(r.authors).length).toBe(3);
    expect(cards.find((x) => x.id === r.realCard)?.text).toBe(definition);

    // Beklenen puan: gerçeği seçen +1; blöfü seçilen her seçim için sahibine +1.
    const expected: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
    for (const [pid, card] of Object.entries(r.picks)) {
      if (card === r.realCard) expected[pid] = (expected[pid] ?? 0) + 1;
      else {
        const owner = r.authors[card] as string;
        expected[owner] = (expected[owner] ?? 0) + 1;
      }
    }
    expect(r.scores).toEqual(expected);

    k.clock.advance(12_000);
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.match?.result?.miniScores).toEqual(expected);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => expected[id]));
    expect(d.room.players.map((p) => p.score)).toEqual(a.room.players.map((p) => p.score));
  });

  it("herkes yazıp Tamam deyince aşamalar erken biter", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a] = cs as [Client, ...Client[]];
    await startGame(cs);
    await sync();
    for (const [i, x] of cs.entries()) {
      expect((await act(x, { kind: "bluff", text: `uydurma anlam ${i}` })).ok).toBe(true);
    }
    k.clock.advance(1_100);
    await until(() => pubOf(a).phase === "pick", "yazma erken bitti");
    const cards = pubOf(a).cards as NonNullable<Pub["cards"]>;
    expect(cards.length).toBe(4);
    for (const x of cs) {
      const target = cards.find((card) => card.id !== privOf(x).myCard) as { id: string };
      expect((await act(x, { kind: "pick", card: target.id })).ok).toBe(true);
      expect((await act(x, { kind: "lock" })).ok).toBe(true);
    }
    k.clock.advance(1_100);
    await until(() => pubOf(a).reveal !== null, "seçme erken bitti");
    k.clock.advance(12_000);
    await until(() => a.room.phase === "results", "sonuç");
    const total = Object.values(a.room.match?.result?.awards ?? {}).reduce((x, y) => x + y, 0);
    expect(total).toBe(3); // her seçim tam bir puan
  });
});
