import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

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
  ready: string[];
  reveal: null | {
    infiltrator: string;
    commonWord: string;
    infiltratorWord: string;
    caught: boolean;
    selfNoticed: boolean;
    scores: Record<string, number>;
  };
}
const pubOf = (c: Client): Pub => c.room.match?.publicView as Pub;
const privOf = (c: Client): Priv => c.room.match?.view as Priv;

interface Priv {
  word: string | null;
  myVote: string | null;
  myNotice: boolean | null;
  locked: boolean;
}

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
  it("sızma kimseye söylenmez, herkes bastıysa oylama başlar, Tamam ile erken biter, puan genel skora eklenir", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a] = cs as [Client, ...Client[]];
    await startGame(cs);
    const pub = () => a.room.match?.publicView as Pub;
    const ids = cs.map((x) => x.session.playerId) as string[];
    await sync();

    // Herkes yalnız "kelimen"i görür; tam bir kişi farklı kelimeyi görür; kimlik hiçbir yerde yok.
    const words = cs.map((x) => privOf(x).word);
    expect(words.every((w) => typeof w === "string" && w.length > 0)).toBe(true);
    const counts = new Map<string | null, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    expect([...counts.values()].sort()).toEqual([1, 3]);
    const oddIndex = words.findIndex((w) => counts.get(w) === 1);
    const infiltrator = ids[oddIndex] as string;
    for (const x of cs) {
      const raw = JSON.stringify(x.room.match);
      expect(raw).not.toContain('"infiltrator"');
      expect(raw).not.toContain('"commonWord"');
      expect(raw).not.toContain('"infiltratorWord"');
    }
    expect([...pub().order].sort()).toEqual([...ids].sort());
    expect(pub().phase).toBe("clue");

    // İpucu aşaması süresiz: uzun süre geçse de oylamaya kendiliğinden geçmez.
    k.clock.advance(120_000);
    await sync();
    expect(pub().phase).toBe("clue");
    expect(await act(a, { kind: "vote", target: ids[1] })).toBe(false); // oylama henüz yok

    // Üç kişi basar: bekler; dördüncü basınca oylama başlar.
    for (const x of cs.slice(0, 3)) expect(await act(x, { kind: "skip" })).toBe(true);
    await sync();
    expect(pub().phase).toBe("clue");
    expect(pub().ready.length).toBe(3);
    expect(await act(cs[3] as Client, { kind: "skip" })).toBe(true);
    k.clock.advance(1_100);
    await until(() => pub().phase === "vote", "oylama başladı");

    // Oy: sızmayı herkes seçer ama sızma kendine oy verir (tek başına en çok oy: yakalanır).
    for (const [i, x] of cs.entries()) {
      const target = i === oddIndex ? ids[i] : infiltrator;
      expect(await act(x, { kind: "vote", target })).toBe(true);
    }
    await sync();
    for (const x of cs) {
      expect(pubOf(x).reveal).toBeNull();
      expect(JSON.stringify(x.room.match)).not.toContain('"tally"');
    }
    expect(privOf(cs[1] as Client).myVote).toBe(infiltrator);
    for (const x of cs) expect(await act(x, { kind: "lock" })).toBe(true);
    k.clock.advance(1_100);
    // Sızma açıklanmadan önce herkese "Sızma sen miydin?" sorulur.
    await until(() => pub().phase === "notice", "fark ettin mi aşaması");
    expect(pub().reveal).toBeNull();
    expect(await act(a, { kind: "vote", target: ids[1] })).toBe(false); // geç oy
    // Sızma (ve ikinci kişi) Evet der; diğerleri Hayır. Cevaplar gizli.
    expect(await act(cs[oddIndex] as Client, { kind: "notice", yes: true })).toBe(true);
    expect(await act(cs[oddIndex] as Client, { kind: "notice", yes: false })).toBe(false); // tek seferlik
    await sync();
    const others = cs.filter((_, i) => i !== oddIndex);
    expect(privOf(cs[oddIndex] as Client).myNotice).toBe(true);
    for (const x of others) {
      expect(privOf(x).myNotice).toBeNull();
      const raw = JSON.stringify(x.room.match);
      expect(raw).not.toContain("selfNoticed");
      expect(raw).not.toContain('"infiltrator"');
    }
    expect(pub().ready).toEqual([infiltrator]);
    for (const [i, x] of others.entries()) expect(await act(x, { kind: "notice", yes: i === 0 })).toBe(true);
    // Herkes cevapladı: kısa sürede sızma açılır.
    k.clock.advance(1_100);
    await until(() => pub().reveal !== null, "açıldı");
    const r = pub().reveal as NonNullable<Pub["reveal"]>;
    expect(r.infiltrator).toBe(infiltrator);
    expect(r.caught).toBe(true);
    expect(r.selfNoticed).toBe(true);

    k.clock.advance(8_000);
    await until(() => a.room.phase === "results", "sonuç");
    const expected: Record<string, number> = {};
    // Yakalanan sızma 0, ama kendini fark etti: +1.
    for (const id of ids) expected[id] = 1;
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => expected[id]));
  });

  it("sızma yakalanmazsa +2 alır (oy yok: teknik tavan 5 dk, 30 sn oylama)", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a] = cs as [Client, ...Client[]];
    await startGame(cs);
    const pub = () => a.room.match?.publicView as Pub;
    const ids = cs.map((x) => x.session.playerId) as string[];
    k.clock.advance(300_000);
    await until(() => pub().phase === "vote", "tavan: oylama başladı");
    k.clock.advance(30_000);
    await until(() => pub().phase === "notice", "fark ettin mi aşaması");
    k.clock.advance(8_000); // kimse cevap vermedi: Hayır sayılır
    await until(() => pub().reveal !== null, "açıldı");
    expect((pub().reveal as NonNullable<Pub["reveal"]>).selfNoticed).toBe(false);
    const infiltrator = (pub().reveal as NonNullable<Pub["reveal"]>).infiltrator;
    k.clock.advance(8_000);
    await until(() => a.room.phase === "results", "sonuç");
    const expected: Record<string, number> = {};
    for (const id of ids) expected[id] = id === infiltrator ? 2 : 0;
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => expected[id]));
  });
});
