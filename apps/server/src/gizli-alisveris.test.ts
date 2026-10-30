import { type AlisverisPublicView, type AlisverisView, couponPrice } from "@glix/engine";
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

type Pub = AlisverisPublicView;
type Priv = AlisverisView;

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
  it("raf, kupon, vitrin ateşi ve sonuç: sepetler gizli kalır, en değerli +2, ikinci +1", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    await startGame(cs);
    const pub = () => a.room.match?.publicView as Pub;
    const mine = (x: Client) => x.room.match?.view as Priv | undefined;
    const ids = cs.map((x) => x.session.playerId) as [string, string, string];

    // Raf: 12 ürün, herkes için aynı; herkesin kuponu farklı ve yalnız kendinde.
    expect(pub().products).toHaveLength(12);
    for (const x of cs) expect(x.room.match?.publicView).toEqual(pub());
    const coupons = cs.map((x) => mine(x)?.coupon);
    expect(new Set(coupons).size).toBe(3);
    for (const cp of coupons) expect(pub().products.some((p) => p.id === cp)).toBe(true);
    expect(JSON.stringify(pub())).not.toContain("coupon");

    const price = (id: number) => pub().products.find((p) => p.id === id)?.price ?? 0;
    const paid = (x: Client, id: number) => (mine(x)?.coupon === id ? couponPrice(price(id)) : price(id));
    // a: kendisi için en ucuz iki ürün; b: a'nın ilk ürünü (ortak); c: ikisinin almadığı bir ürün.
    const byPaid = [...pub().products].sort((p, q) => paid(a, p.id) - paid(a, q.id));
    const [x1, x2] = byPaid.map((p) => p.id) as [number, number];
    const z = byPaid.map((p) => p.id).find((id) => id !== x1 && id !== x2 && paid(c, id) <= 60) as number;
    expect(await send(a, "add", x1)).toBe(true);
    expect(await send(a, "add", x2)).toBe(true);
    expect(await send(a, "add", x2)).toBe(false); // aynı ürün
    const left = 60 - paid(a, x1) - paid(a, x2);
    await until(() => mine(a)?.remaining === left, "özel görünüm");
    const dear = pub().products.find((p) => p.id !== x1 && p.id !== x2 && paid(a, p.id) > left);
    if (dear) expect(await send(a, "add", dear.id)).toBe(false); // bütçe aşılır
    expect(await send(b, "add", x1)).toBe(true);
    expect(await send(c, "add", z)).toBe(true);
    expect(await send(c, "add", 20)).toBe(false); // geçersiz ürün
    const off = Array.from({ length: 20 }, (_, i) => i).find((i) => !pub().products.some((p) => p.id === i));
    expect(await send(c, "add", off as number)).toBe(false); // rafta yok
    expect(mine(a)?.basket).toEqual([x1, x2]);
    await until(() => mine(b)?.basket.length === 1, "b sepeti");
    for (const x of cs) {
      expect((x.room.match?.publicView as Pub | undefined)?.reveal).toBeNull();
      expect((x.room.match?.publicView as Pub | undefined)?.heat).toBeNull();
      const raw = JSON.stringify(x.room.match?.publicView);
      expect(raw).not.toContain('"baskets"');
      expect(raw).not.toContain('"buyers"');
    }

    // 15. saniye: vitrin fısıltısı yalnız seviye taşır.
    k.clock.advance(15_100);
    await until(() => pub().heat !== null, "vitrin ateşi");
    const heat = pub().heat ?? {};
    expect(heat[String(x1)]).toBe(3); // 2/3 kişi
    expect(heat[String(x2)]).toBe(2); // 1/3 kişi
    expect(heat[String(z)]).toBe(2);
    expect(JSON.stringify(heat)).not.toMatch(new RegExp(ids.join("|")));

    k.clock.advance(15_000);
    await until(() => pub().reveal !== null, "sepetler açıldı");
    expect(await send(c, "add", x2)).toBe(false); // geç
    const r = pub().reveal;
    expect(r?.baskets).toEqual({
      [ids[0]]: [x1, x2].sort((p, q) => p - q),
      [ids[1]]: [x1],
      [ids[2]]: [z],
    });
    expect(r?.buyers[String(x1)]).toBe(2);
    expect(r?.coupons).toEqual({ [ids[0]]: coupons[0], [ids[1]]: coupons[1], [ids[2]]: coupons[2] });
    // Değer tam fiyat ÷ alıcı (kupon değeri düşürmez).
    expect(r?.values[ids[0]]).toBe(price(x1) * 420 + price(x2) * 840);
    expect(r?.values[ids[1]]).toBe(price(x1) * 420);
    expect(r?.values[ids[2]]).toBe(price(z) * 840);

    k.clock.advance(8_000);
    await until(() => a.room.phase === "results", "sonuç");
    const awards = a.room.match?.result?.awards ?? {};
    expect(awards).toEqual(r?.points);
    for (const v of Object.values(awards)) expect([0, 1, 2]).toContain(v);
    // a'nın sepeti b'ninkinden her zaman değerlidir: a ödül alır, b en çok +1.
    expect(awards[ids[0]]).toBeGreaterThan(0);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => awards[id] ?? 0));
    expect(c.room.players.map((p) => p.score)).toEqual(ids.map((id) => awards[id] ?? 0));
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
