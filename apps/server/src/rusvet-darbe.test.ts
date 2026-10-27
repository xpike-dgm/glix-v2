import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 7000;
async function send(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

interface Pub {
  phase: string;
  president: string | null;
  budget: number | null;
  duel: null | { hand: number; candidates: string[]; signs: Record<string, string> | null };
  coup: null | { tokens: Record<string, number>; eligible: string[] };
  ready: string[];
  reveal: null | {
    tokens: Record<string, number>;
    scores: Record<string, number>;
    coup: null | { eligible: string[]; yes: number; success: boolean };
  };
}
interface Priv {
  myVote: string | null;
  mySign: string | null;
  myTokens: { to: string; n: number }[] | null;
  myCoup: boolean | null;
  canCoup: boolean;
}

async function startGame(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["rusvet-darbe"] });
  await until(() => host.room.gameIds.join() === "rusvet-darbe", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
}

describe("rüşvet ve darbe: oda içinde tam maç", () => {
  it("eşitlik -> taş-kağıt-makas -> başkan -> gizli dağıtım -> puanlar genel skora eklenir", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    await startGame(cs);
    const pub = (x: Client = a) => x.room.match?.publicView as Pub;
    const priv = (x: Client) => x.room.match?.view as Priv | undefined;
    const ids = cs.map((x) => x.session.playerId) as [string, string, string, string];

    // Halka: herkes bir sonrakine oy verir -> dörtlü eşitlik.
    expect(await send(a, { kind: "vote", target: ids[0] })).toBe(false); // kendine oy yok
    expect(await send(a, { kind: "vote", target: ids[1] })).toBe(true);
    expect(await send(b, { kind: "vote", target: ids[2] })).toBe(true);
    expect(await send(c, { kind: "vote", target: ids[3] })).toBe(true);
    expect(await send(d, { kind: "vote", target: ids[0] })).toBe(true);
    expect(await send(a, { kind: "sign", sign: "tas" })).toBe(false); // oy aşamasında işaret yok
    await sync();
    expect(cs.map((x) => priv(x)?.myVote)).toEqual([ids[1], ids[2], ids[3], ids[0]]);
    for (const x of cs) {
      const raw = JSON.stringify(x.room.match);
      expect(raw).not.toContain('"votes"');
      expect(raw).not.toContain('"counts"');
      expect(pub(x).president).toBeNull();
    }

    k.clock.advance(20_100);
    await until(() => pub().phase === "duel", "düello");
    expect(pub().duel?.candidates).toEqual(ids);
    expect(pub().budget).toBeNull();

    // El 1: üç taş bir makas -> taş verenler (a, c, d) devam eder. İşaretler açılana kadar gizli.
    expect(await send(a, { kind: "sign", sign: "tas" })).toBe(true);
    expect(await send(b, { kind: "sign", sign: "makas" })).toBe(true);
    expect(await send(c, { kind: "sign", sign: "tas" })).toBe(true);
    await sync();
    expect(pub().duel?.signs).toBeNull();
    expect(priv(b)?.mySign).toBe("makas");
    expect(priv(a)?.mySign).toBe("tas");
    expect(JSON.stringify(a.room.match?.publicView)).not.toContain("makas");

    // Son aday da işaret verince (herkes verdi) işaretler hemen açılır; süre dolmasını beklemez.
    expect(await send(d, { kind: "sign", sign: "tas" })).toBe(true);
    await until(() => pub().duel?.signs !== null, "işaretler açıldı");
    expect(pub().duel?.signs).toEqual({
      [ids[0]]: "tas",
      [ids[1]]: "makas",
      [ids[2]]: "tas",
      [ids[3]]: "tas",
    });
    expect(await send(a, { kind: "sign", sign: "kagit" })).toBe(false); // işaretler açıldı

    k.clock.advance(2_500);
    await until(() => pub().duel?.hand === 2, "ikinci el");
    expect(pub().duel?.candidates).toEqual([ids[0], ids[2], ids[3]]);
    expect(await send(b, { kind: "sign", sign: "tas" })).toBe(false); // elendi

    // El 2: a taş, c ve d makas -> a kazanır ve başkan olur (bütçe 1).
    expect(await send(a, { kind: "sign", sign: "tas" })).toBe(true);
    expect(await send(c, { kind: "sign", sign: "makas" })).toBe(true);
    expect(await send(d, { kind: "sign", sign: "makas" })).toBe(true);
    k.clock.advance(2_500);
    await until(() => pub().phase === "give", "dağıtım");
    expect(pub().president).toBe(ids[0]);
    expect(pub().budget).toBe(1);

    // Dağıtım yalnız başkandan kabul edilir ve gizlidir.
    expect(await send(b, { kind: "give", tokens: [{ to: ids[2], n: 1 }] })).toBe(false);
    expect(await send(a, { kind: "give", tokens: [{ to: ids[0], n: 1 }] })).toBe(false);
    expect(await send(a, { kind: "give", tokens: [{ to: ids[1], n: 2 }] })).toBe(false); // bütçe aşımı
    expect(await send(a, { kind: "give", tokens: [{ to: ids[2], n: 1 }] })).toBe(true);
    expect(await send(a, { kind: "give", tokens: [{ to: ids[1], n: 1 }] })).toBe(true); // değiştirilebilir
    await sync();
    expect(priv(a)?.myTokens).toEqual([{ to: ids[1], n: 1 }]);
    for (const x of [b, c, d]) {
      expect(priv(x)?.myTokens).toBeNull();
      expect(JSON.stringify(x.room.match)).not.toContain('"tokens"');
    }

    k.clock.advance(25_000);
    await until(() => pub().phase === "coup", "darbe oylaması");
    // Dağılım açıldı; jeton almayan c ve d (başkan a ve alıcı b hariç) oy hakkına sahip.
    expect(pub().coup?.tokens[ids[1]]).toBe(1);
    expect(pub().coup?.eligible).toEqual([ids[2], ids[3]]);
    expect(pub().reveal).toBeNull();
    expect(await send(a, { kind: "give", tokens: [] })).toBe(false);
    expect(await send(a, { kind: "coup", yes: true })).toBe(false); // başkan oy kullanamaz
    expect(await send(b, { kind: "coup", yes: true })).toBe(false); // jeton aldı
    expect(await send(c, { kind: "coup", yes: true })).toBe(true);
    expect(await send(c, { kind: "coup", yes: false })).toBe(false); // tek seferlik
    await sync();
    // Oy gizli: yalnız sahibi görür, ortak görünümde yalnız kimin oy verdiği var.
    expect(priv(c)?.myCoup).toBe(true);
    for (const x of [a, b, d]) {
      expect(priv(x)?.myCoup).toBeNull();
      expect(JSON.stringify(x.room.match)).not.toMatch(/"yes"|"success"/);
    }
    expect(pub().ready).toEqual([ids[2]]);
    expect(priv(d)?.canCoup).toBe(true);
    expect(priv(a)?.canCoup).toBe(false);
    expect(await send(d, { kind: "coup", yes: true })).toBe(true);
    // Hak sahiplerinin hepsi oy verdi: aşama kısa sürede biter.
    k.clock.advance(1_000);
    await until(() => pub().reveal !== null, "sonuç açıldı");
    expect(pub().reveal?.tokens[ids[1]]).toBe(1);
    expect(pub().reveal?.coup).toEqual({ eligible: [ids[2], ids[3]], yes: 2, success: true });

    k.clock.advance(8_000);
    await until(() => a.room.phase === "results", "sonuç");
    // Darbe başarılı: başkanın +1'i iptal; jeton etkilenmez.
    const awards = { [ids[0]]: 0, [ids[1]]: 1, [ids[2]]: 0, [ids[3]]: 0 };
    expect(a.room.match?.result?.awards).toEqual(awards);
    expect(a.room.match?.result?.miniScores).toEqual(awards);
    expect(a.room.players.map((p) => p.score)).toEqual([0, 1, 0, 0]);
    expect(d.room.players.map((p) => p.score)).toEqual([0, 1, 0, 0]);
  }, 30_000);
});
