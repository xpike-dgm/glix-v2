import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 1000;
async function choose(c: Client, value: number): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload: { kind: "choose", value } });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

interface Pub {
  startedAt: number;
  endsAt: number;
  limit: number;
  maxChoice: number;
  reveal: null | { choices: Record<string, number>; total: number; over: boolean };
}

async function startGame(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["acgozluluk-limiti"] });
  await until(() => host.room.gameIds.join() === "acgozluluk-limiti", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
}

describe("açgözlülük limiti: oda içinde tam maç", () => {
  it("limit altında: seçtiği kadar puan genel skora eklenir; seçimler süre bitene kadar sızmaz", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    await startGame(cs);
    const pub = () => a.room.match?.publicView as Pub;
    expect(pub().limit).toBe(11);
    expect(pub().maxChoice).toBe(4);

    expect(await choose(a, 4)).toBe(true);
    expect(await choose(a, 3)).toBe(true); // değiştirilebilir
    expect(await choose(b, 2)).toBe(true);
    expect(await choose(c, 5)).toBe(false); // aralık dışı
    expect(await choose(c, 4)).toBe(true);
    // d seçmez -> 0
    await sync();

    // Süre bitmeden: herkesin görünümünde yalnız kendi seçimi vardır.
    const views = cs.map((x) => ({
      pub: JSON.stringify(x.room.match?.publicView),
      view: x.room.match?.view as { myChoice: number | null },
    }));
    expect(views.map((x) => x.view.myChoice)).toEqual([3, 2, 4, null]);
    for (const x of views) expect(JSON.parse(x.pub).reveal).toBeNull();
    expect(JSON.stringify(a.room.match)).not.toContain('"choices"');

    k.clock.advance(20_100 - 60 * 5);
    await until(() => pub().reveal !== null, "seçimler açıldı");
    const ids = cs.map((x) => x.session.playerId);
    expect(pub().reveal).toEqual({
      choices: { [ids[0] as string]: 3, [ids[1] as string]: 2, [ids[2] as string]: 4, [ids[3] as string]: 0 },
      total: 9,
      over: false,
    });
    // Süre dolduktan sonra seçim reddedilir.
    expect(await choose(d, 1)).toBe(false);

    // Açılış animasyonu (5 sn) kesilmez; herkes "Devam et" dedi (test istemcileri), ardından 1 sn.
    k.clock.advance(5_000);
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.match?.result?.miniScores).toEqual({
      [ids[0] as string]: 3,
      [ids[1] as string]: 2,
      [ids[2] as string]: 4,
      [ids[3] as string]: 0,
    });
    expect(a.room.match?.result?.awards).toEqual(a.room.match?.result?.miniScores);
    expect(a.room.players.map((p) => p.score)).toEqual([3, 2, 4, 0]);
    expect(d.room.players.map((p) => p.score)).toEqual([3, 2, 4, 0]);
    expect(b.room.phase).toBe("results");
  });

  it("limit aşılırsa herkes 0 alır, genel skor değişmez", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    await startGame(cs);
    for (const c of cs) expect(await choose(c, 3)).toBe(true); // 9 > 6
    k.clock.advance(20_100);
    const a = cs[0] as Client;
    await until(() => a.room.phase === "results", "sonuç");
    const reveal = (a.room.match?.publicView as Pub | undefined)?.reveal;
    expect(reveal).toMatchObject({ total: 9, over: true });
    expect(Object.values(a.room.match?.result?.awards ?? {})).toEqual([0, 0, 0]);
    expect(a.room.players.map((p) => p.score)).toEqual([0, 0, 0]);
  });
});
