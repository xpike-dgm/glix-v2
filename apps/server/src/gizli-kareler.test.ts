import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, until, useServer } from "./testkit.js";

useServer();

let seq = 7000;
async function pick(c: Client, cell: number): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload: { kind: "pick", cell } });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

interface Reveal {
  choices: Record<string, number | null>;
  status: Record<string, string>;
}
interface Pub {
  size: number;
  stage1: null | Reveal;
  stage2: null | { players: string[] };
  stage2Reveal: null | Reveal;
  points: null | Record<string, number>;
}

async function startGame(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["gizli-kareler"] });
  await until(() => host.room.gameIds.join() === "gizli-kareler", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
}

describe("gizli kareler: oda içinde tam maç", () => {
  it("iki aşama: seçimler gizli, aşama sonunda açılır, puanlar genel skora eklenir", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    await startGame(cs);
    const pub = () => a.room.match?.publicView as Pub;
    const ids = cs.map((x) => x.session.playerId) as [string, string, string, string];
    const mine = (x: Client) => (x.room.match?.view as { myChoice: number | null } | undefined)?.myChoice;

    expect(pub().size).toBe(3);
    expect(await pick(a, 1)).toBe(true);
    expect(await pick(a, 2)).toBe(true); // değiştirilebilir
    expect(await pick(b, 2)).toBe(true); // a ile çakışır
    expect(await pick(c, 9)).toBe(false); // 3x3 dışı
    expect(await pick(c, 5)).toBe(true);
    expect(await pick(d, 8)).toBe(true);
    await until(() => mine(d) === 8, "özel görünüm");
    expect([mine(a), mine(b), mine(c), mine(d)]).toEqual([2, 2, 5, 8]);
    for (const x of cs) {
      expect((x.room.match?.publicView as Pub | undefined)?.stage1).toBeNull();
      const raw = JSON.stringify(x.room.match?.publicView);
      expect(raw).not.toContain('"choices"');
    }

    k.clock.advance(20_100);
    await until(() => pub().stage1 !== null, "1. aşama açıldı");
    expect(pub().stage1?.status).toEqual({
      [ids[0]]: "clash",
      [ids[1]]: "clash",
      [ids[2]]: "solo",
      [ids[3]]: "solo",
    });
    expect(pub().stage2?.players).toEqual([ids[2], ids[3]]);
    expect(await pick(a, 4)).toBe(false); // elendi / aşama kapalı

    k.clock.advance(4_000);
    await sleep(60);
    expect(await pick(a, 4)).toBe(false); // elenen oyuncu seçemez
    expect(await pick(c, 6)).toBe(true);
    expect(await pick(d, 6)).toBe(true); // c ile çakışır
    await sleep(20);
    expect(pub().stage2Reveal).toBeNull();

    k.clock.advance(20_000);
    await until(() => pub().stage2Reveal !== null, "2. aşama açıldı");
    expect(pub().stage2Reveal?.status).toEqual({ [ids[2]]: "clash", [ids[3]]: "clash" });

    k.clock.advance(5_000);
    await until(() => a.room.phase === "results", "sonuç");
    const awards = { [ids[0]]: 0, [ids[1]]: 0, [ids[2]]: 1, [ids[3]]: 1 };
    expect(a.room.match?.result?.awards).toEqual(awards);
    expect(a.room.players.map((p) => p.score)).toEqual([0, 0, 1, 1]);
    expect(d.room.players.map((p) => p.score)).toEqual([0, 0, 1, 1]);
    expect(b.room.phase).toBe("results");
  });

  it("1. aşamada tek kalan rakipsiz sayılır: +2 ve oyun erken biter", async () => {
    const cs = await setupRoom(["A", "B", "C", "D", "E"]);
    const [a, b, c, d, e] = cs as [Client, Client, Client, Client, Client];
    await startGame(cs);
    const pub = () => a.room.match?.publicView as Pub;
    expect(pub().size).toBe(4);
    expect(await pick(a, 15)).toBe(true);
    expect(await pick(b, 3)).toBe(true);
    expect(await pick(c, 3)).toBe(true);
    expect(await pick(d, 3)).toBe(true);
    // e seçmez
    k.clock.advance(20_100);
    await until(() => pub().stage1 !== null, "açıldı");
    expect(pub().stage2).toBeNull();
    k.clock.advance(5_000);
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.players.map((p) => p.score)).toEqual([2, 0, 0, 0, 0]);
    expect(e.room.phase).toBe("results");
  });
});
