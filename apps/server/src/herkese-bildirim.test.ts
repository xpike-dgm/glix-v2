/** Yönetici paneli A3: kalıcı hesap bildirim abonelikleri ve "Herkese bildirim". */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AdminBroadcastStatus } from "@glix/engine";
import { afterAll, describe, expect, it } from "vitest";
import { parseBroadcastBody } from "./admin.js";
import { createManualClock } from "./clock.js";
import { buildExport } from "./kvkk.js";
import { BROADCAST_MIN_GAP_MS } from "./pushBroadcast.js";
import { invitePayload } from "./pushText.js";
import { startServer } from "./server.js";
import { noopSocial } from "./social.js";
import { Client, k, loginCookie, sleep, until, useServer } from "./testkit.js";
import type { PushGateway, PushResult, PushTarget } from "./webpush.js";
import { ADMIN, createAdminKit, MAIL } from "./yoneticiKit.js";

const kit = createAdminKit();
const { get, post, adminLogin } = kit;
const P256DH = "B".repeat(87);
const AUTH = "a".repeat(22);
const ep = (name: string): string => `https://fcm.googleapis.com/fcm/send/${name}`;
const target = (name: string): PushTarget => ({ endpoint: ep(name), p256dh: P256DH, auth: AUTH });
const dir = mkdtempSync(join(tmpdir(), "glix-bildirim-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Uç nokta adına göre sonuç veren sahte gönderici: "gone-*" 410, "fail-*" hata, gerisi tamam. */
function gateway(enabled = true) {
  const sent: { target: PushTarget; payload: string }[] = [];
  const gw: PushGateway = {
    enabled,
    publicKey: enabled ? "SAHTE" : null,
    send: (t, payload) => {
      sent.push({ target: t, payload });
      const result: PushResult = t.endpoint.includes("/gone-")
        ? "gone"
        : t.endpoint.includes("/fail-")
          ? "error"
          : "ok";
      return Promise.resolve(result);
    },
  };
  return { gw, sent };
}

const subscribeMsg = (name: string) => ({
  type: "pushSubscribe",
  endpoint: ep(name),
  p256dh: P256DH,
  auth: AUTH,
});
let seq = 0;

/** Hesap açar; kimliğini ve oturum çerezini döner. */
function makeAccount(): { id: number; name: string; cookie: string } {
  const name = `h${++seq}_${Date.now().toString(36)}`;
  const cookie = loginCookie(name);
  const found = k.srv.accounts.findByUsername(name);
  if (!found) throw new Error("hesap yok");
  return { id: found.id, name, cookie };
}

describe("herkese bildirim girdileri", () => {
  it("başlık ≤40, metin ≤120, düz metin; bağlantı yalnız site içi yol", () => {
    expect(parseBroadcastBody({ title: " Yeni  oyun ", body: "Gel oyna", url: "/?oda=ABCDE" })).toEqual({
      title: "Yeni oyun",
      body: "Gel oyna",
      url: "/?oda=ABCDE",
    });
    expect(parseBroadcastBody({ title: "a", body: "b", url: null })).toEqual({
      title: "a",
      body: "b",
      url: null,
    });
    expect(parseBroadcastBody({ title: "x".repeat(40), body: "y".repeat(120), url: null })).not.toBeNull();
    for (const bad of [
      { title: "x".repeat(41), body: "b", url: null },
      { title: "a", body: "y".repeat(121), url: null },
      { title: "", body: "b", url: null },
      { title: "a", body: "", url: null },
      { title: "<b>", body: "b", url: null },
      { title: "a", body: "b", url: "//kotu.example" },
      { title: "a", body: "b", url: "https://kotu.example" },
      { title: "a", body: "b", url: "javascript:alert(1)" },
      { title: "a", body: "b", url: "/a b" },
      { title: "a", body: "b" },
      { title: "a", body: "b", url: null, x: 1 },
      null,
    ])
      expect(parseBroadcastBody(bad)).toBeNull();
  });
});

describe("hesap bildirim abonelikleri kalıcıdır", () => {
  const g = gateway();
  useServer({ push: g.gw });

  it("hesaplı bağlantının aboneliği veritabanına yazılır, değişir ve silinir; misafirinki yazılmaz", async () => {
    const a = makeAccount();
    const c = await Client.connect(a.cookie);
    c.send(subscribeMsg("cihaz-1"));
    await until(() => k.srv.accounts.pushGet(a.id) !== null, "yazıldı");
    expect(k.srv.accounts.pushGet(a.id)).toEqual(target("cihaz-1"));
    c.send(subscribeMsg("cihaz-2"));
    await until(() => k.srv.accounts.pushGet(a.id)?.endpoint === ep("cihaz-2"), "değişti");
    expect(k.srv.accounts.pushCount()).toBe(1);
    c.send({ type: "pushUnsubscribe" });
    await until(() => k.srv.accounts.pushGet(a.id) === null, "silindi");

    const guest = await Client.connect();
    guest.send(subscribeMsg("misafir"));
    await sleep(40);
    expect(k.srv.accounts.pushCount()).toBe(0);
  });

  it("aynı cihaz başka hesaba geçince eski hesaptan düşer", async () => {
    const a = makeAccount();
    const b = makeAccount();
    const ca = await Client.connect(a.cookie);
    ca.send(subscribeMsg("ortak"));
    await until(() => k.srv.accounts.pushGet(a.id) !== null, "a");
    const cb = await Client.connect(b.cookie);
    cb.send(subscribeMsg("ortak"));
    await until(() => k.srv.accounts.pushGet(b.id) !== null, "b");
    expect(k.srv.accounts.pushGet(a.id)).toBeNull();
    expect(k.srv.accounts.pushCount()).toBe(1);
  });

  it("çıkış yapınca hesabın aboneliği silinir", async () => {
    const a = makeAccount();
    k.srv.accounts.pushSet(a.id, target("cikis"), 1);
    const res = await fetch(`http://127.0.0.1:${k.srv.port}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: a.cookie, Origin: `http://127.0.0.1:${k.srv.port}` },
    });
    expect(res.status).toBe(200);
    expect(k.srv.accounts.pushGet(a.id)).toBeNull();
  });

  it("bağlantısı olmayan arkadaşa davet, kalıcı abonelikten bildirim olarak gider", async () => {
    const host = makeAccount();
    const friend = makeAccount();
    expect(k.srv.accounts.requestFriend(host.id, friend.id, 1)).toBeDefined();
    k.srv.accounts.acceptFriend(friend.id, host.id, 2);
    k.srv.accounts.pushSet(friend.id, target("arkadas"), 3);
    const c = await Client.connect(host.cookie);
    c.send({ type: "createRoom", nickname: host.name });
    await until(() => c.updates.length > 0, "oda");
    c.send({ type: "inviteFriend", username: friend.name });
    await until(() => c.of("inviteSent").length > 0, "davet gitti");
    const sent = g.sent.filter((s) => s.target.endpoint === ep("arkadas"));
    expect(sent).toHaveLength(1);
    expect(sent[0]?.payload).toBe(invitePayload(host.name, c.session.roomCode));
  });

  it("KVKK: döküme ne zaman eklendiği yazılır, hesap silinince abonelik gider", () => {
    const a = makeAccount();
    expect(buildExport(k.srv.accounts, noopSocial, a.id, 5)).toMatchObject({
      push_subscription: false,
      push_subscription_since: null,
    });
    k.srv.accounts.pushSet(a.id, target("kvkk"), 1_700_000_000_000);
    const dump = buildExport(k.srv.accounts, noopSocial, a.id, 5);
    expect(dump).toMatchObject({
      push_subscription: true,
      push_subscription_since: new Date(1_700_000_000_000).toISOString(),
    });
    // Uç nokta ve anahtarlar dökümde yoktur.
    expect(JSON.stringify(dump)).not.toContain(ep("kvkk"));
    expect(JSON.stringify(dump)).not.toContain(P256DH);
    expect(k.srv.accounts.deleteAccount(a.id)).toBe(true);
    expect(k.srv.accounts.pushGet(a.id)).toBeNull();
    expect(k.srv.accounts.pushCount()).toBe(0);
  });
});

describe("herkese bildirim", () => {
  const g = gateway();
  useServer({
    push: g.gw,
    adminAccountIds: ADMIN,
    mail: MAIL,
    mailFetch: kit.mailFetch,
    statsDb: ":memory:",
  });

  const status = async (cookie: string) => (await get<AdminBroadcastStatus>("push/status", cookie)).body;
  async function finished(cookie: string): Promise<AdminBroadcastStatus> {
    for (let i = 0; i < 300; i++) {
      const s = await status(cookie);
      if (s.last?.finished) return s;
      await sleep(10);
    }
    throw new Error("gönderim bitmedi");
  }
  const body = { title: "Yeni oyun geldi", body: "Hemen gir ve dene", url: "/" };

  it("kalıcı + oda abonelikleri, uç noktaya göre tekilleştirilerek gider; 410 olan silinir; sonuç özeti", async () => {
    const cookie = await adminLogin();
    g.sent.length = 0;
    const a1 = makeAccount();
    const a2 = makeAccount();
    const a3 = makeAccount();
    const a4 = makeAccount();
    k.srv.accounts.pushSet(a1.id, target("iyi-1"), 1);
    k.srv.accounts.pushSet(a2.id, target("gone-2"), 1);
    k.srv.accounts.pushSet(a3.id, target("fail-3"), 1);
    k.srv.accounts.pushSet(a4.id, target("iyi-4"), 1);
    // Odadaki misafirin aboneliği (bellekte) ve hesapla aynı uç noktayı kullanan yinelenen oyuncu.
    const host = await Client.connect(a1.cookie);
    host.send({ type: "createRoom", nickname: a1.name });
    await until(() => host.updates.length > 0, "oda");
    const guest = await Client.connect();
    guest.send({ type: "joinRoom", code: host.session.roomCode, nickname: "Misafir" });
    await until(() => guest.updates.length > 0, "misafir");
    guest.send(subscribeMsg("misafir-5"));
    host.send(subscribeMsg("iyi-1")); // kalıcı kayıtla aynı uç nokta
    await sleep(40);

    const before = await status(cookie);
    expect(before).toMatchObject({ enabled: true, subscribers: 4, nextAllowedAt: null, last: null });
    const r = await post("push/broadcast", cookie, body);
    expect(r.status).toBe(202);
    expect(r.body.total).toBe(5); // 4 hesap + 1 misafir; yinelenen sayılmaz
    const done = await finished(cookie);
    expect(done.last).toMatchObject({
      total: 5,
      sent: 3,
      failed: 1,
      removed: 1,
      finished: true,
      title: "Yeni oyun geldi",
    });
    expect(g.sent.map((s) => s.target.endpoint).sort()).toEqual(
      ["gone-2", "fail-3", "iyi-1", "iyi-4", "misafir-5"].map(ep).sort(),
    );
    expect(JSON.parse(g.sent[0]?.payload ?? "{}")).toEqual({
      title: "Yeni oyun geldi",
      body: "Hemen gir ve dene",
      tag: "glix-duyuru",
      url: "/",
    });
    // 410 dönen abonelik silindi, diğerleri durur.
    expect(k.srv.accounts.pushGet(a2.id)).toBeNull();
    expect(k.srv.accounts.pushGet(a3.id)).not.toBeNull();
    expect(done.subscribers).toBe(3);
    // İşlem kaydı: başlık/metin yazılmaz, yalnız sayılar.
    const rows = k.srv.accounts.adminAuditTail(10).filter((x) => x.action.startsWith("push_broadcast"));
    expect(rows.map((x) => `${x.action}:${x.detail}`).sort()).toEqual([
      "push_broadcast:5",
      "push_broadcast_done:3/1/1",
    ]);
    expect(JSON.stringify(rows)).not.toContain("Yeni oyun");
  });

  it("saatte en çok bir kez; süre dolunca yeniden gönderilebilir", async () => {
    const cookie = await adminLogin();
    const a = makeAccount();
    k.srv.accounts.pushSet(a.id, target("saat-1"), 1);
    expect((await post("push/broadcast", cookie, body)).status).toBe(202);
    await finished(cookie);
    const again = await post("push/broadcast", cookie, body);
    expect(again.status).toBe(429);
    expect(again.body.code).toBe("broadcast_cooldown");
    const s = await status(cookie);
    expect(s.nextAllowedAt).toBe((s.last?.at ?? 0) + BROADCAST_MIN_GAP_MS);
    k.clock.advance(BROADCAST_MIN_GAP_MS + 1000);
    expect((await status(cookie)).nextAllowedAt).toBeNull();
    expect((await post("push/broadcast", cookie, body)).status).toBe(202);
  });

  it("geçersiz gövde 400; abonesiz 409; kapalı gönderici 503", async () => {
    const cookie = await adminLogin();
    expect((await post("push/broadcast", cookie, { ...body, title: "x".repeat(41) })).status).toBe(400);
    expect((await post("push/broadcast", cookie, { ...body, url: "https://kotu.example" })).status).toBe(400);
    const empty = await post("push/broadcast", cookie, body);
    expect(empty.status).toBe(409);
    expect(empty.body.code).toBe("broadcast_empty");
    // Hiçbiri saat sınırını tüketmez.
    expect((await status(cookie)).nextAllowedAt).toBeNull();
    expect(k.srv.accounts.adminAuditTail(10).some((x) => x.action === "push_broadcast")).toBe(false);
  });
});

describe("herkese bildirim: gönderici kapalıyken", () => {
  const g = gateway(false);
  useServer({
    push: g.gw,
    adminAccountIds: ADMIN,
    mail: MAIL,
    mailFetch: kit.mailFetch,
    statsDb: ":memory:",
  });
  it("503 ve durum 'kapalı' der", async () => {
    const cookie = await adminLogin();
    const r = await post("push/broadcast", cookie, { title: "a", body: "b", url: null });
    expect(r.status).toBe(503);
    expect((await get<AdminBroadcastStatus>("push/status", cookie)).body.enabled).toBe(false);
  });
});

describe("herkese bildirim: hız sınırı", () => {
  const g = gateway();
  useServer({
    push: g.gw,
    adminAccountIds: ADMIN,
    mail: MAIL,
    mailFetch: kit.mailFetch,
    statsDb: ":memory:",
    broadcastPerSecond: 5,
  });

  it("saniyede en çok 5 gönderim; her parti arası 1 sn", async () => {
    const cookie = await adminLogin();
    g.sent.length = 0;
    for (let i = 0; i < 12; i++) k.srv.accounts.pushSet(makeAccount().id, target(`hiz-${i}`), 1);
    expect((await post("push/broadcast", cookie, { title: "a", body: "b", url: null })).status).toBe(202);
    await sleep(60);
    expect(g.sent.length).toBe(5);
    k.clock.advance(999);
    await sleep(40);
    expect(g.sent.length).toBe(5);
    k.clock.advance(1);
    await sleep(40);
    expect(g.sent.length).toBe(10);
    // Gönderim sürerken ikincisi başlamaz.
    const during = await post("push/broadcast", cookie, { title: "a", body: "b", url: null });
    expect([409, 429]).toContain(during.status);
    k.clock.advance(1000);
    await sleep(40);
    expect(g.sent.length).toBe(12);
    const s = (await get<AdminBroadcastStatus>("push/status", cookie)).body;
    expect(s.last).toMatchObject({ total: 12, sent: 12, finished: true });
  });
});

describe("kalıcılık", () => {
  it("abonelikler ve son gönderim yeniden başlatmada korunur", async () => {
    const db = join(dir, "bildirim.db");
    const g = gateway();
    const open = async () => {
      k.clock = createManualClock();
      k.srv = await startServer({
        host: "127.0.0.1",
        port: 0,
        clientDir: dir,
        allowedOrigins: null,
        revision: "r",
        clock: k.clock,
        heartbeatMs: 1_000_000_000,
        accountsDb: db,
        statsDb: null,
        push: g.gw,
        adminAccountIds: ADMIN,
        mail: MAIL,
        mailFetch: kit.mailFetch,
      });
    };
    await open();
    const cookie = await adminLogin(); // ilk hesap = yönetici
    const a = makeAccount();
    const c = await Client.connect(a.cookie);
    c.send(subscribeMsg("kalici"));
    await until(() => k.srv.accounts.pushGet(a.id) !== null, "yazıldı");
    expect((await post("push/broadcast", cookie, { title: "a", body: "b", url: null })).status).toBe(202);
    for (
      let i = 0;
      i < 100 && !(await get<AdminBroadcastStatus>("push/status", cookie)).body.last?.finished;
      i++
    )
      await sleep(10);
    c.ws.terminate();
    await k.srv.close();

    await open();
    try {
      expect(k.srv.accounts.pushGet(a.id)).toEqual(target("kalici"));
      expect(k.srv.accounts.pushCount()).toBe(1);
      // Saat sınırı yeniden başlatmada da geçerli (sahte saat aynı başlangıçtan başlar).
      const cookie2 = await adminLogin("yonetici_1");
      const s = (await get<AdminBroadcastStatus>("push/status", cookie2)).body;
      expect(s.last).toMatchObject({ total: 1, sent: 1, finished: true });
      expect(s.nextAllowedAt).not.toBeNull();
    } finally {
      await k.srv.close();
    }
  });
});
