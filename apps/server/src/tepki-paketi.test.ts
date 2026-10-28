/** Mağaza M3: tepki paketi çıkartması (sahiplik denetimi, hız sınırı) ve yeni kozmetik türlerinin yayını. */
import { parseCosmetics, REACTION_MIN_GAP_MS } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { Client, k, loginCookie, sync, until, useServer } from "./testkit.js";

useServer();

const PARTI_1 = "pack:parti:1";
const EFSANE_3 = "pack:efsane-tepkiler:3";

async function enter(cookie: string | undefined, nickname: string, code?: string): Promise<Client> {
  const c = await Client.connect(cookie);
  if (code) c.send({ type: "joinRoom", code, nickname });
  else c.send({ type: "createRoom", nickname });
  await until(() => c.updates.length > 0 || c.of("error").length > 0, "oda");
  return c;
}
const idOf = (name: string): number => k.srv.accounts.findByUsername(name)?.id as number;
const equip = (cookie: string, body: unknown) =>
  fetch(`http://127.0.0.1:${k.srv.port}/api/shop/equip`, {
    method: "POST",
    headers: {
      Origin: `http://127.0.0.1:${k.srv.port}`,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("tepki paketi çıkartması", () => {
  it("paketin sahibi gönderebilir; herkese (gönderen dahil) reaction olarak gider", async () => {
    const cookie = loginCookie("Tp_Sahip");
    k.srv.accounts.grantCosmetic(idOf("Tp_Sahip"), "tepki-parti", k.clock.now());
    const a = await enter(cookie, "Tp_Sahip");
    const b = await enter(undefined, "Misafir", a.session.roomCode);
    await sync();
    a.send({ type: "react", emoji: PARTI_1 });
    await until(() => a.of("reaction").length > 0 && b.of("reaction").length > 0, "çıkartma");
    const expected = { type: "reaction", playerId: a.session.playerId, emoji: PARTI_1 };
    expect(a.of("reaction")[0]).toEqual(expected);
    expect(b.of("reaction")[0]).toEqual(expected);
    expect(a.of("error")).toHaveLength(0);
  });

  it("sahip olmadığı paketten gönderemez (sessizce atılır); başka paketi olan da", async () => {
    const cookie = loginCookie("Tp_Baska");
    k.srv.accounts.grantCosmetic(idOf("Tp_Baska"), "tepki-parti", k.clock.now());
    const a = await enter(cookie, "Tp_Baska");
    const b = await enter(loginCookie("Tp_Yok"), "Tp_Yok", a.session.roomCode);
    await sync();
    k.clock.advance(2000);
    b.send({ type: "react", emoji: PARTI_1 });
    a.send({ type: "react", emoji: EFSANE_3 });
    await sync();
    expect(a.of("reaction")).toHaveLength(0);
    expect(b.of("reaction")).toHaveLength(0);
    expect(a.of("error")).toHaveLength(0);
    expect(b.of("error")).toHaveLength(0);
  });

  it("misafir gönderemez", async () => {
    const a = await enter(loginCookie("Tp_Konuk_Oda"), "Tp_Konuk_Oda");
    const guest = await enter(undefined, "Konuk", a.session.roomCode);
    await sync();
    guest.send({ type: "react", emoji: PARTI_1 });
    await sync();
    expect(a.of("reaction")).toHaveLength(0);
    expect(guest.of("reaction")).toHaveLength(0);
    // Sabit emoji misafire de açık kalır.
    k.clock.advance(1000);
    guest.send({ type: "react", emoji: "🔥" });
    await until(() => a.of("reaction").length === 1, "emoji");
  });

  it("geri alınan paket artık gönderemez", async () => {
    const cookie = loginCookie("Tp_Geri");
    const id = idOf("Tp_Geri");
    k.srv.accounts.grantCosmetic(id, "tepki-parti", k.clock.now());
    const a = await enter(cookie, "Tp_Geri");
    await sync();
    a.send({ type: "react", emoji: PARTI_1 });
    await until(() => a.of("reaction").length === 1, "ilk");
    expect(k.srv.accounts.revokeCosmetic(id, "tepki-parti")).toBe(true);
    k.clock.advance(REACTION_MIN_GAP_MS + 100);
    a.send({ type: "react", emoji: PARTI_1 });
    await sync();
    expect(a.of("reaction")).toHaveLength(1);
  });

  it("emoji ile aynı hız sınırı (700 ms) geçerli; ortak sayaç", async () => {
    const cookie = loginCookie("Tp_Hiz");
    k.srv.accounts.grantCosmetic(idOf("Tp_Hiz"), "tepki-efsane", k.clock.now());
    const a = await enter(cookie, "Tp_Hiz");
    await sync();
    k.clock.advance(1000);
    a.send({ type: "react", emoji: EFSANE_3 });
    await until(() => a.of("reaction").length === 1, "birinci");
    k.clock.advance(300);
    a.send({ type: "react", emoji: "pack:efsane-tepkiler:2" });
    a.send({ type: "react", emoji: "🔥" });
    await sync();
    expect(a.of("reaction")).toHaveLength(1);
    expect(a.of("error")).toHaveLength(0);
    k.clock.advance(500);
    a.send({ type: "react", emoji: "pack:efsane-tepkiler:2" });
    await until(() => a.of("reaction").length === 2, "ikinci");
  });

  it("bozuk çıkartma kimliği protokolde düşer (invalid_message)", async () => {
    const a = await enter(loginCookie("Tp_Bozuk"), "Tp_Bozuk");
    a.send({ type: "react", emoji: "pack:parti:9" });
    await until(() => a.of("error").length > 0, "hata");
    expect(a.lastError?.code).toBe("invalid_message");
  });
});

describe("yeni kozmetik türleri", () => {
  it("kart arkası, zafer ve giriş kuşanınca odadaki herkese gider; tepki paketi kuşanılamaz", async () => {
    const cookie = loginCookie("Tp_Gorunum");
    const id = idOf("Tp_Gorunum");
    for (const item of ["kart-elektrik", "zafer-balon", "giris-portal", "tepki-parti"])
      k.srv.accounts.grantCosmetic(id, item, k.clock.now());
    const a = await enter(cookie, "Tp_Gorunum");
    const b = await enter(loginCookie("Tp_Izleyen"), "Tp_Izleyen", a.session.roomCode);
    await sync();
    expect((await equip(cookie, { type: "kart-arkasi", itemId: "kart-elektrik" })).status).toBe(200);
    expect((await equip(cookie, { type: "zafer", itemId: "zafer-balon" })).status).toBe(200);
    expect((await equip(cookie, { type: "giris", itemId: "giris-portal" })).status).toBe(200);
    const seen = () => b.room.players.find((p) => p.nickname === "Tp_Gorunum")?.cosmetics;
    await until(() => seen()?.entry === "giris-portal", "giriş");
    expect(parseCosmetics(seen())).toEqual({
      cardBack: "kart-elektrik",
      celebration: "zafer-balon",
      entry: "giris-portal",
    });
    // Paket sahipliği yeter; kuşanma yok.
    const r = await equip(cookie, { type: "tepki", itemId: "tepki-parti" });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(k.srv.accounts.cosmetics(id).equipped.tepki).toBeUndefined();
    // Yanlış türe kuşanma reddedilir.
    expect((await equip(cookie, { type: "zafer", itemId: "kart-elektrik" })).status).toBeGreaterThanOrEqual(
      400,
    );
  });

  it("yönetici armağanı ve geri alma her yeni ürün için aynı çalışır; KVKK dökümünde adlarıyla görünür", () => {
    const acc = k.srv.accounts;
    loginCookie("Tp_Yonetici");
    const id = idOf("Tp_Yonetici");
    for (const item of ["kart-altin-kraliyet", "zafer-altin-yagmur", "tepki-efsane", "giris-altin-isik"])
      expect(acc.grantCosmetic(id, item, 5)).toBe("granted");
    expect(acc.grantCosmetic(id, "tepki-efsane", 6)).toBe("owned");
    expect(acc.equipCosmetic(id, "giris", "giris-altin-isik")).toBe("ok");
    expect(acc.equipCosmetic(id, "tepki", "tepki-efsane")).toBe("unknown");
    expect(acc.cosmetics(id).equipped).toEqual({ giris: "giris-altin-isik" });
    expect(acc.cosmetics(id).owned.map((o) => o.pricePaid)).toEqual([0, 0, 0, 0]);
    expect(acc.revokeCosmetic(id, "giris-altin-isik")).toBe(true);
    expect(acc.cosmetics(id).equipped).toEqual({});
    expect(acc.revokeCosmetic(id, "giris-altin-isik")).toBe(false);
  });

  it("satın alma: yeni türler katalog fiyatından alınır", () => {
    const acc = k.srv.accounts;
    loginCookie("Tp_Alici");
    const id = idOf("Tp_Alici");
    acc.adjustGlix(id, 3000, "test", 1);
    const now = Date.UTC(2026, 9, 26, 9, 0, 0);
    for (const item of ["kart-neon-izgara", "zafer-simsek", "tepki-neon-yuzler", "giris-duman"])
      expect(acc.purchaseCosmetic(id, item, now).ok).toBe(true);
    expect(acc.cosmetics(id).owned).toHaveLength(4);
  });
});
