import { describe, expect, it, vi } from "vitest";
import type { AiFetch } from "./aiComment.js";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

// Sahte yapay zekâ ucu (canlı API asla çağrılmaz): spiker yorumu yer tutucu adla döner, sunucu gerçek adı koyar.
const aiFetch = vi.fn<AiFetch>(async () => ({
  status: 200,
  json: async () => ({
    stop_reason: "end_turn",
    content: [{ type: "text", text: "Oyuncu1 maskeyi düşürdü ama kelime çoktan cebe girmişti." }],
  }),
}));
useServer({ aiKey: "test-anahtar", aiFetch });

let seq = 9000;
async function act(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

interface Pub {
  phase: string;
  order: string[];
  turn: number;
  runoff: string[] | null;
  ready: string[];
  reveal: null | {
    infiltrator: string;
    caught: boolean;
    selfNoticed: boolean;
    runoff: string[] | null;
    final: null | {
      commonWord: string;
      infiltratorWord: string;
      guess: string | null;
      stole: boolean;
      scores: Record<string, number>;
    };
  };
}
interface Priv {
  word: string | null;
  myVote: string | null;
  myNotice: boolean | null;
  locked: boolean;
}
const pubOf = (c: Client): Pub => c.room.match?.publicView as Pub;
const privOf = (c: Client): Priv => c.room.match?.view as Priv;

async function startGame(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["sizma"] });
  await until(() => host.room.gameIds.join() === "sizma", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
}

describe("sizma: oda içinde tam maç", () => {
  it("sıra uygulamada ilerler, yakalanan sızma son şansta kelimeyi çalar, yalnız doğru oy verenler puan alır", async () => {
    aiFetch.mockClear();
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a] = cs as [Client, ...Client[]];
    await startGame(cs);
    const pub = () => pubOf(a);
    const ids = cs.map((x) => x.session.playerId) as string[];
    const byId = (id: string) => cs[ids.indexOf(id)] as Client;
    await sync();

    // Herkes yalnız "kelimen"i görür; tam bir kişi farklı kelimeyi görür; kimlik hiçbir yerde yok.
    const words = cs.map((x) => privOf(x).word);
    const counts = new Map<string | null, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    expect([...counts.values()].sort()).toEqual([1, 3]);
    const oddIndex = words.findIndex((w) => counts.get(w) === 1);
    const infiltrator = ids[oddIndex] as string;
    const common = words.find((w) => counts.get(w) === 3) as string;
    for (const x of cs) expect(JSON.stringify(x.room.match)).not.toMatch(/"infiltrator"|commonWord/);

    // Konuşma sırası: yalnız konuşan "Söyledim" der; iki tur (8 konuşma) bitince 3 sn sonra oylama.
    expect(pub().phase).toBe("clue");
    const order = pub().order;
    const notSpeaker = byId(order[1] as string);
    expect(await act(notSpeaker, { kind: "said", turn: 0 })).toBe(false);
    for (let turn = 0; turn < 8; turn++) {
      await until(() => pub().turn === turn, `konuşma ${turn}`);
      expect(await act(byId(order[turn % 4] as string), { kind: "said", turn })).toBe(true);
    }
    await until(() => pub().turn === 8, "sıralar bitti");
    expect(pub().phase).toBe("clue");
    k.clock.advance(3_100);
    await until(() => pub().phase === "vote", "oylama başladı");

    // Oylar: üç kişi sızmaya, sızma başkasına; sızma tek başına en çok oy: yakalanır.
    const other = ids.find((id) => id !== infiltrator) as string;
    for (const [i, x] of cs.entries()) {
      expect(await act(x, { kind: "vote", target: i === oddIndex ? other : infiltrator })).toBe(true);
    }
    for (const x of cs) expect(await act(x, { kind: "lock" })).toBe(true);
    k.clock.advance(1_100);
    await until(() => pub().phase === "notice", "Sızma sen miydin?");
    expect(pub().reveal).toBeNull();

    // Sızma Evet; sızma olmayan biri de Evet (yakalama puanı yanar); diğerleri Hayır.
    const gambler = cs.find((_, i) => i !== oddIndex) as Client;
    for (const [i, x] of cs.entries())
      expect(await act(x, { kind: "notice", yes: i === oddIndex || x === gambler })).toBe(true);
    k.clock.advance(1_100);
    await until(() => pub().phase === "guess", "son şans");
    // Maske düştü: sızma açık, kelimeler kimsenin ekranında yok.
    expect(pub().reveal?.infiltrator).toBe(infiltrator);
    expect(pub().reveal?.final).toBeNull();
    for (const x of cs) {
      if (x === cs[oddIndex]) continue;
      expect(privOf(x).word).toBeNull();
      expect(JSON.stringify(x.room.match)).not.toContain(`"${common}"`);
    }
    // Açılış bitmeden tahmin olmaz; başkası tahmin edemez.
    expect(await act(cs[oddIndex] as Client, { kind: "guess", text: common })).toBe(false);
    k.clock.advance(7_000);
    await sync();
    expect(await act(gambler, { kind: "guess", text: common })).toBe(false);
    expect(
      await act(cs[oddIndex] as Client, { kind: "guess", text: common.toLocaleLowerCase("tr-TR") }),
    ).toBe(true);
    k.clock.advance(1_100);
    await until(() => pub().phase === "reveal", "son açılış");
    const f = pub().reveal?.final;
    expect(f?.stole).toBe(true);
    expect(f?.commonWord).toBe(common);

    // Spiker: son açılışta tek istek; modele yalnız yer tutucu adlar gider.
    await until(() => a.room.match?.comment !== undefined, "yorum");
    expect(aiFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(aiFetch.mock.calls[0]?.[1]?.body ?? "{}") as { messages: { content: string }[] };
    const prompt = body.messages[0]?.content ?? "";
    expect(prompt).toContain("Oyun: Sızma");
    expect(prompt).toContain("ortak kelimeyi bilip çaldı");
    for (const s of [...ids, '"A"', "- A:"]) expect(prompt).not.toContain(s);

    k.clock.advance(5_000);
    for (const x of cs) x.send({ type: "revealContinue", round: 0 });
    await until(() => a.room.phase === "results", "sonuç");
    const expected: Record<string, number> = {};
    for (const id of ids) {
      if (id === infiltrator)
        expected[id] = 2; // Evet +1, kelimeyi çaldı +1
      else expected[id] = byId(id) === gambler ? 0 : 1;
    }
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => expected[id]));
  });

  it("konuşma süresi dolunca sıra geçer; eşitlikte ikinci oylama; yine eşitse sızma kurtulur (+2)", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a] = cs as [Client, ...Client[]];
    await startGame(cs);
    const pub = () => pubOf(a);
    const ids = cs.map((x) => x.session.playerId) as string[];
    await sync();
    k.clock.advance(15_000);
    await until(() => pub().turn === 1, "süre doldu, sıra geçti");
    for (const x of cs) expect(await act(x, { kind: "skip" })).toBe(true);
    k.clock.advance(1_100);
    await until(() => pub().phase === "vote", "oylama");

    // 2-2 eşitlik: A ve B aday.
    const [ia, ib] = ids as [string, string];
    for (const [i, x] of cs.entries())
      expect(await act(x, { kind: "vote", target: i < 2 ? ib : ia })).toBe(true);
    k.clock.advance(30_000);
    await until(() => pub().phase === "runoff", "ikinci oylama");
    expect(pub().runoff).toEqual([ia, ib]);
    expect(privOf(a).myVote).toBeNull();
    expect(await act(a, { kind: "vote", target: ids[2] })).toBe(false); // aday değil
    for (const [i, x] of cs.entries())
      expect(await act(x, { kind: "vote", target: i < 2 ? ib : ia })).toBe(true);
    k.clock.advance(15_000);
    await until(() => pub().phase === "notice", "soru");
    k.clock.advance(10_000);
    await until(() => pub().phase === "reveal", "açılış");
    const r = pub().reveal;
    expect(r?.caught).toBe(false);
    expect(r?.runoff).toEqual([ia, ib]);
    const infiltrator = r?.infiltrator as string;
    k.clock.advance(9_000);
    for (const x of cs) x.send({ type: "revealContinue", round: 0 });
    await until(() => a.room.phase === "results", "sonuç");
    const expected: Record<string, number> = {};
    for (const id of ids) expected[id] = id === infiltrator ? 2 : 0;
    expect(a.room.match?.result?.awards).toEqual(expected);
  });
});
