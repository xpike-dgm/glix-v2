import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, until, useServer } from "./testkit.js";

useServer();

let seq = 9000;
async function send(c: Client, kind: "add" | "remove", product: number): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload: { kind, product } });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

interface Pub {
  products: { id: number; price: number }[];
  reveal: null | {
    baskets: Record<string, number[]>;
    buyers: Record<string, number>;
    values: Record<string, number>;
    winners: string[];
  };
}
interface Priv {
  basket: number[];
  remaining: number;
}

async function startGame(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["gizli-alisveris"] });
  await until(() => host.room.gameIds.join() === "gizli-alisveris", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
}

describe("gizli alışveriş: oda içinde tam maç", () => {
  it("sepetler gizli kalır, bütçe aşılamaz, süre dolunca açılır ve en değerli sepet +1 alır", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    await startGame(cs);
    const pub = () => a.room.match?.publicView as Pub;
    const mine = (x: Client) => x.room.match?.view as Priv | undefined;
    const ids = cs.map((x) => x.session.playerId) as [string, string, string];

    expect(pub().products).toHaveLength(12);
    expect(await send(a, "add", 7)).toBe(true); // 24
    expect(await send(a, "add", 5)).toBe(true); // 20
    expect(await send(a, "add", 5)).toBe(false); // aynı ürün
    expect(await send(a, "add", 11)).toBe(false); // bütçe aşılır (80)
    expect(await send(b, "add", 7)).toBe(true); // a ile ortak: 12
    expect(await send(c, "add", 2)).toBe(true);
    expect(await send(c, "add", 12)).toBe(false); // geçersiz ürün
    await until(() => mine(a)?.remaining === 16, "özel görünüm");
    expect(mine(a)?.basket).toEqual([7, 5]);
    expect(mine(b)?.basket).toEqual([7]);
    for (const x of cs) {
      expect((x.room.match?.publicView as Pub | undefined)?.reveal).toBeNull();
      const raw = JSON.stringify(x.room.match?.publicView);
      expect(raw).not.toContain('"baskets"');
      expect(raw).not.toContain('"buyers"');
    }

    k.clock.advance(30_100);
    await until(() => pub().reveal !== null, "sepetler açıldı");
    expect(await send(c, "add", 0)).toBe(false); // geç
    const r = pub().reveal;
    expect(r?.baskets).toEqual({ [ids[0]]: [5, 7], [ids[1]]: [7], [ids[2]]: [2] });
    expect(r?.buyers["7"]).toBe(2);
    expect(r?.winners).toEqual([ids[0]]);

    k.clock.advance(8_000);
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.match?.result?.awards).toEqual({ [ids[0]]: 1, [ids[1]]: 0, [ids[2]]: 0 });
    expect(a.room.players.map((p) => p.score)).toEqual([1, 0, 0]);
    expect(c.room.players.map((p) => p.score)).toEqual([1, 0, 0]);
  });

  it("kimse ürün almazsa kimse puan almaz", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a] = cs as [Client, Client, Client];
    await startGame(cs);
    k.clock.advance(30_100);
    await until(() => (a.room.match?.publicView as Pub | undefined)?.reveal != null, "açıldı");
    k.clock.advance(8_000);
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.players.map((p) => p.score)).toEqual([0, 0, 0]);
  });
});
