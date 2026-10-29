import { afterEach, describe, expect, it, vi } from "vitest";
import { equipItem, loadShop, resetShop, shop, shopLoad } from "./shop.js";

const state = (balance: number): string =>
  JSON.stringify({ ok: true, balance, owned: [], equipped: {}, serverNow: Date.now() });
const json = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  resetShop();
  vi.unstubAllGlobals();
});

describe("mağaza durumu", () => {
  it("çıkışta sıfırlanır; uçuştaki eski yanıt yeni durumu geri getirmez", async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((res) => (release = res))),
    );
    const pending = loadShop();
    resetShop();
    release(json(state(500)));
    await pending;
    expect(shop()).toBeNull();
    expect(shopLoad()).toBe("loading");
  });

  it("yüklenince bakiye gelir, sıfırlama temizler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(state(120))),
    );
    await loadShop();
    expect(shop()?.balance).toBe(120);
    resetShop();
    expect(shop()).toBeNull();
  });

  it("kuşanmalar sırayla gönderilir: ikinci istek birincinin bitmesini bekler", async () => {
    const order: string[] = [];
    const releases: (() => void)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body)) as { itemId: string | null };
          order.push(`başla:${body.itemId}`);
          await new Promise<void>((res) => releases.push(res));
          order.push(`bitti:${body.itemId}`);
          return json(JSON.stringify({ ok: true }));
        }
        return json(state(10));
      }),
    );
    const a = equipItem("sapka", "a");
    const b = equipItem("sapka", "b");
    await vi.waitFor(() => expect(order).toEqual(["başla:a"]));
    releases[0]?.();
    await vi.waitFor(() => expect(order).toEqual(["başla:a", "bitti:a", "başla:b"]));
    releases[1]?.();
    expect(await a).toEqual({ ok: true });
    expect(await b).toEqual({ ok: true });
    expect(order).toEqual(["başla:a", "bitti:a", "başla:b", "bitti:b"]);
  });

  it("bir kuşanma ağ hatasıyla düşse de sıradaki çalışır", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST" && n++ === 0) throw new Error("ağ yok");
        return json(init?.method === "POST" ? JSON.stringify({ ok: true }) : state(1));
      }),
    );
    const a = await equipItem("sapka", "a");
    const b = await equipItem("sapka", "b");
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(true);
  });
});
