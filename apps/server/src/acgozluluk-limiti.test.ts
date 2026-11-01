import {
  type AcgozlulukPublicView,
  type AcgozlulukView,
  acgozlulukScoutWord,
  createRng,
  type Rng,
} from "@glix/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

/** Oyun tohumu sabit: gerçek limitler (AL-M4) ve Gözcü sırası (AL-M3) her testte aynı diziyle gelir. */
const SEED = 1;
let seeded: Rng = createRng(SEED);
beforeEach(() => {
  seeded = createRng(SEED);
});
useServer({ randomInt: (max) => seeded.int(max) });

let seq = 1000;
async function send(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}
const choose = (c: Client, value: number) => send(c, { kind: "choose", value });

const pub = (c: Client) => c.room.match?.publicView as AcgozlulukPublicView;
const view = (c: Client) => c.room.match?.view as AcgozlulukView;
const goTo = (t: number) => k.clock.advance(Math.max(0, t - k.clock.now()));

async function newMatch(names: string[]): Promise<{ cs: Client[]; ids: string[] }> {
  const cs = await setupRoom(names);
  const a = cs[0] as Client;
  a.send({ type: "setGames", gameIds: ["acgozluluk-limiti"] });
  await until(() => a.room.gameIds.join() === "acgozluluk-limiti", "oyun seçildi");
  await startPlaying(cs);
  return { cs, ids: cs.map((c) => c.session.playerId) };
}

describe("açgözlülük limiti: oda içinde tam maç (3 tur)", () => {
  it("üç tur oynanır, Gözcü yalnız kendi kelimesini görür, genel skor +2 / +1 / 0", async () => {
    const { cs, ids } = await newMatch(["A", "B", "C", "D"]);
    const [a] = cs as [Client, ...Client[]];
    const byId = new Map(cs.map((c) => [c.session.playerId, c] as const));
    expect(pub(a)).toMatchObject({ round: 1, rounds: 3, maxChoice: 4, band: { low: 10, high: 12 } });

    // Her tur: A 4, B 3, C 2, D seçmez → 9 (bant 10–12'nin altında, hiç taşmaz).
    const scouts: string[] = [];
    for (let r = 0; r < 3; r++) {
      await until(() => pub(a).round === r + 1 && pub(a).reveal === null, `tur ${r + 1}`);
      const scout = pub(a).scoutId as string;
      expect(ids).toContain(scout);
      scouts.push(scout);
      expect(await choose(cs[0] as Client, 4)).toBe(true);
      expect(await choose(cs[1] as Client, 3)).toBe(true);
      expect(await choose(cs[2] as Client, 5)).toBe(false); // aralık dışı
      expect(await choose(cs[2] as Client, 2)).toBe(true);
      await sync();
      // Seçimler sızmaz: herkes yalnız kendininkini görür; toplam ya da gerçek limit yok.
      expect(cs.map((c) => view(c).myChoice)).toEqual([4, 3, 2, null]);
      // (önceki turlar kasa defterinde açıktır; bu turun hiçbir şeyi yok)
      const open = { ...pub(a), history: [] };
      expect(pub(a).reveal).toBeNull();
      expect(JSON.stringify(open)).not.toContain('"choices"');
      expect(JSON.stringify(open)).not.toContain('"limit"');

      // 7. saniye: Gözcü bakar (kelime o anki toplam 9 ve gerçek limitten hesaplanır).
      goTo(pub(a).roundStartedAt + 7_050);
      await until(() => pub(a).scoutPeekedAt !== null, "Gözcü baktı");
      await until(() => view(byId.get(scout) as Client).scout !== null, "Gözcü kelimesi");
      for (const c of cs) {
        if (c.session.playerId !== scout) expect(view(c).scout).toBeNull();
      }
      expect(JSON.stringify(pub(a))).not.toMatch(/rahat|sinirda|tasiyor/);
      const word = view(byId.get(scout) as Client).scout?.word;

      goTo(pub(a).endsAt + 50);
      await until(() => pub(a).reveal !== null, "tur açıldı");
      const rv = pub(a).reveal;
      expect(rv).toMatchObject({ total: 9, over: false, missing: [ids[3]] });
      expect(rv?.limit).toBeGreaterThanOrEqual(10);
      expect(rv?.limit).toBeLessThanOrEqual(12);
      expect(word).toBe(acgozlulukScoutWord(9, rv?.limit ?? 0));
      expect(await choose(cs[3] as Client, 1)).toBe(false); // açılışta seçim yok
      if (r < 2) goTo(pub(a).revealEndsAt + 50);
    }
    expect(new Set(scouts).size).toBe(3);

    // Son açılış: genel puanlar bir kez, toplama göre.
    expect(pub(a).final).toEqual({
      [ids[0] as string]: 2,
      [ids[1] as string]: 1,
      [ids[2] as string]: 0,
      [ids[3] as string]: 0,
    });
    k.clock.advance(7_000);
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.match?.result?.miniScores).toEqual({
      [ids[0] as string]: 12,
      [ids[1] as string]: 9,
      [ids[2] as string]: 6,
      [ids[3] as string]: 0,
    });
    expect(a.room.players.map((p) => p.score)).toEqual([2, 1, 0, 0]);
  });

  it("her tur taşarsa herkes 0 alır, genel skor değişmez; erken bitiş tur başına", async () => {
    const { cs } = await newMatch(["A", "B", "C"]);
    const a = cs[0] as Client;
    for (let r = 0; r < 3; r++) {
      await until(() => pub(a).round === r + 1 && pub(a).reveal === null, `tur ${r + 1}`);
      const started = pub(a).roundStartedAt;
      for (const c of cs) expect(await choose(c, 3)).toBe(true); // 9 > 7
      for (const c of cs) expect(await send(c, { kind: "lock" })).toBe(true);
      await sync();
      // Hepsi kilitledi: tur 1 sn sonra kapanır (12 sn beklenmez).
      expect(pub(a).endsAt).toBeLessThan(started + 12_000);
      goTo(pub(a).endsAt + 50);
      await until(() => pub(a).reveal !== null, "açıldı");
      expect(pub(a).reveal).toMatchObject({ total: 9, over: true });
      expect([...(pub(a).reveal?.spillers ?? [])].sort()).toEqual(cs.map((c) => c.session.playerId).sort());
      if (r < 2) goTo(pub(a).revealEndsAt + 50);
    }
    k.clock.advance(7_100);
    await until(() => a.room.phase === "results", "sonuç");
    expect(Object.values(a.room.match?.result?.awards ?? {})).toEqual([0, 0, 0]);
    expect(a.room.players.map((p) => p.score)).toEqual([0, 0, 0]);
  });
});
