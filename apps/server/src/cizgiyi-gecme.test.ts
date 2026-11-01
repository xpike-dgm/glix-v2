import { type CizgiPublicView, type CizgiView, createRng, type Rng } from "@glix/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

/** Oyun tohumu sabit (oyun rastgelelik kullanmasa da odanın diğer çekilişleri her testte aynı gelsin). */
const SEED = 1;
let seeded: Rng = createRng(SEED);
beforeEach(() => {
  seeded = createRng(SEED);
});
useServer({ randomInt: (max) => seeded.int(max) });

let seq = 3000;
async function send(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}
const choose = (c: Client, value: number) => send(c, { kind: "choose", value });
const pub = (c: Client) => c.room.match?.publicView as CizgiPublicView;
const view = (c: Client) => c.room.match?.view as CizgiView | undefined;
const goTo = (t: number) => k.clock.advance(Math.max(0, t - k.clock.now()));

async function newMatch(names: string[]): Promise<{ cs: Client[]; ids: string[] }> {
  const cs = await setupRoom(names);
  const a = cs[0] as Client;
  a.send({ type: "setGames", gameIds: ["cizgiyi-gecme"] });
  await until(() => a.room.gameIds.join() === "cizgiyi-gecme", "oyun seçildi");
  await startPlaying(cs);
  return { cs, ids: cs.map((c) => c.session.playerId) };
}

describe("çizgiyi geçme: oda içinde tam maç (2 tur)", () => {
  it("seçimler gizli; radar herkese aynı; iki turun toplamına göre genel skor +2 / +1 / 0", async () => {
    const { cs, ids } = await newMatch(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    expect(pub(a)).toMatchObject({ round: 1, rounds: 2, zoneWidth: 10, reveal: null, radar: null });

    // 1. tur: A ve B aynı platform (40–49), C 72 tek → C +2; D seçmez.
    expect(await choose(a, 95)).toBe(true);
    expect(await choose(a, 45)).toBe(true); // değiştirilebilir
    expect(await choose(b, 41)).toBe(true);
    expect(await choose(c, 101)).toBe(false); // aralık dışı
    expect(await choose(c, 72)).toBe(true);
    await sync();
    expect(cs.map((x) => view(x)?.myChoice)).toEqual([45, 41, 72, null]);
    for (const x of cs) {
      const raw = JSON.stringify(x.room.match);
      expect(raw).not.toContain('"choices"');
      expect(raw).not.toContain('"status"');
    }

    // Radar (15. sn): 40–49 kalabalık; herkese aynı, kimin olduğu yok.
    goTo(pub(a).radarAt ?? 0);
    await until(() => pub(a).radar !== null, "radar");
    for (const x of cs) expect(pub(x).radar?.zones).toEqual([4]);

    goTo(pub(a).endsAt + 50);
    await until(() => pub(a).reveal !== null, "1. tur açıldı");
    expect(await choose(d, 99)).toBe(false); // ara açılışta seçim yok
    expect(pub(a).reveal?.status).toEqual({
      [ids[0] as string]: "crashed",
      [ids[1] as string]: "crashed",
      [ids[2] as string]: "first",
      [ids[3] as string]: "none",
    });
    expect(pub(a).final).toBeNull();

    // 2. tur: seçimler boşaldı. A 90, B 60 tek; C ve D 31/35 çarpışır → A +2, B +1.
    goTo(pub(a).revealEndsAt + 50);
    await until(() => pub(a).round === 2, "2. tur");
    expect(view(a)?.myChoice).toBeNull();
    expect(await choose(a, 90)).toBe(true);
    expect(await choose(b, 60)).toBe(true);
    expect(await choose(c, 31)).toBe(true);
    expect(await choose(d, 35)).toBe(true);
    goTo(pub(a).endsAt + 50);
    await until(() => pub(a).reveal !== null && pub(a).round === 2, "2. tur açıldı");
    // Toplam: A 2, B 1, C 2, D 0 → A ve C eşit lider → ikisi +1.
    expect(pub(a).totals).toEqual({
      [ids[0] as string]: 2,
      [ids[1] as string]: 1,
      [ids[2] as string]: 2,
      [ids[3] as string]: 0,
    });

    goTo(pub(a).revealEndsAt + 50);
    await until(() => a.room.phase === "results", "sonuç");
    const awards = {
      [ids[0] as string]: 1,
      [ids[1] as string]: 0,
      [ids[2] as string]: 1,
      [ids[3] as string]: 0,
    };
    expect(a.room.match?.result?.awards).toEqual(awards);
    expect(a.room.players.map((p) => p.score)).toEqual([1, 0, 1, 0]);
    expect(d.room.players.map((p) => p.score)).toEqual([1, 0, 1, 0]);
  });

  it("iki oyuncu: radar yok; Zirve 100 ile 99 ayrı platform", async () => {
    const { cs } = await newMatch(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    expect(pub(a).radarAt).toBeNull();
    for (let r = 1; r <= 2; r++) {
      await until(() => pub(a).round === r && pub(a).reveal === null, `tur ${r}`);
      expect(await choose(a, 100)).toBe(true);
      expect(await choose(b, 99)).toBe(true);
      goTo(pub(a).endsAt + 50);
      await until(() => pub(a).reveal !== null, `tur ${r} açıldı`);
      expect(pub(a).radar).toBeNull();
      goTo(pub(a).revealEndsAt + 50);
    }
    await until(() => a.room.phase === "results", "sonuç");
    // A iki kez +2 (4), B iki kez +1 (2) → A +2, B +1.
    expect(a.room.players.map((p) => p.score)).toEqual([2, 1]);
  });
});
