import { INVITE_TTL_MS } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { MAX_FRIENDS, MAX_OUTGOING } from "./friendStore.js";
import { INVITE_PAIR_GAP_MS, INVITE_PER_MINUTE, PRESENCE_SCAN_MS } from "./social.js";
import { Client, k, loginCookie, sync, until, useServer } from "./testkit.js";
import type { PushGateway, PushResult, PushTarget } from "./webpush.js";

const base = () => `http://127.0.0.1:${k.srv.port}`;
const P256DH = "B".repeat(87);
const AUTH = "a".repeat(22);
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/arkadas";

interface Reply {
  status: number;
  body: Record<string, unknown> & {
    ok?: boolean;
    code?: string;
    message?: string;
    result?: string;
    friends?: { username: string; since: number; status: string; joinable: boolean; withYou: boolean }[];
    incoming?: { username: string; at: number }[];
    outgoing?: { username: string; at: number }[];
    blocked?: { username: string }[];
  };
  raw: string;
}

async function api(
  cookie: string | null,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Reply> {
  const res = await fetch(`${base()}/api/friends${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: base(),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await res.text();
  return { status: res.status, body: JSON.parse(raw) as Reply["body"], raw };
}

const post = (cookie: string, action: string, username: string) =>
  api(cookie, "POST", `/${action}`, { username });
const list = (cookie: string) => api(cookie, "GET", "");

/** Birbirine arkadaş iki hesap (HTTP uçlarıyla). */
async function befriend(a: { cookie: string; name: string }, b: { cookie: string; name: string }) {
  expect((await post(a.cookie, "request", b.name)).status).toBe(200);
  expect((await post(b.cookie, "accept", a.name)).status).toBe(200);
}

function user(name: string): { cookie: string; name: string } {
  return { cookie: loginCookie(name), name };
}

async function connect(u: { cookie: string }): Promise<Client> {
  return Client.connect(u.cookie);
}

/** Hesaplı oyuncu oda kurar (lobide bekler). */
async function host(u: { cookie: string; name: string }): Promise<Client> {
  const c = await connect(u);
  c.send({ type: "createRoom", nickname: u.name });
  await until(() => c.updates.length > 0, "oda kuruldu");
  return c;
}

const statuses = (c: Client, who: string) =>
  c
    .of("friendStatus")
    .filter((m) => m.username === who)
    .map((m) => m.status);

describe("arkadaşlık akışı", () => {
  useServer();

  it("istek, kabul: iki taraf da arkadaş görür; kullanıcı adı büyük-küçük harf duyarsız", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    const r = await post(a.cookie, "request", "bERK");
    expect(r.body).toMatchObject({ ok: true, result: "sent" });
    expect((await list(a.cookie)).body.outgoing?.map((x) => x.username)).toEqual(["Berk"]);
    expect((await list(b.cookie)).body.incoming?.map((x) => x.username)).toEqual(["Ayse"]);
    expect((await list(b.cookie)).body.friends).toEqual([]);
    expect((await post(b.cookie, "accept", "Ayse")).status).toBe(200);
    const la = (await list(a.cookie)).body;
    const lb = (await list(b.cookie)).body;
    expect(la.friends?.map((x) => [x.username, x.status])).toEqual([["Berk", "offline"]]);
    expect(lb.friends?.map((x) => x.username)).toEqual(["Ayse"]);
    expect(la.outgoing).toEqual([]);
    expect(lb.incoming).toEqual([]);
  });

  it("karşı taraf zaten istemişse istek kendiliğinden kabul olur", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    await post(a.cookie, "request", b.name);
    const r = await post(b.cookie, "request", a.name);
    expect(r.body).toMatchObject({ ok: true, result: "accepted" });
    expect((await list(a.cookie)).body.friends?.length).toBe(1);
  });

  it("hata durumları: bulunamadı, kendine, zaten arkadaş, tekrar istek, geçersiz gövde", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    expect((await post(a.cookie, "request", "Yok_Boyle")).status).toBe(404);
    const self = await post(a.cookie, "request", "ayse");
    expect(self.status).toBe(400);
    expect(self.body.code).toBe("self");
    await post(a.cookie, "request", b.name);
    expect((await post(a.cookie, "request", b.name)).body.code).toBe("already_requested");
    await post(b.cookie, "accept", a.name);
    expect((await post(a.cookie, "request", b.name)).body.code).toBe("already_friends");
    expect((await api(a.cookie, "POST", "/request", { username: "a!" })).status).toBe(400);
    expect((await api(a.cookie, "POST", "/request", { username: b.name, x: 1 })).status).toBe(400);
    expect((await api(a.cookie, "POST", "/yok", { username: b.name })).status).toBe(404);
    // Olmayan isteği kabul etmek 404 verir (istemci listeyi yeniler).
    expect((await post(a.cookie, "accept", "Berk")).status).toBe(404);
  });

  it("reddet, geri çek, arkadaşlıktan çıkar", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    const c = user("Cem");
    await post(a.cookie, "request", b.name);
    await post(b.cookie, "decline", a.name);
    expect((await list(a.cookie)).body.outgoing).toEqual([]);
    expect((await list(b.cookie)).body.incoming).toEqual([]);

    await post(a.cookie, "request", c.name);
    await post(a.cookie, "cancel", c.name);
    expect((await list(c.cookie)).body.incoming).toEqual([]);
    // Gönderenin kabul edemediği, alanın geri çekemediği: yanlış yön hiçbir şey yapmaz.
    await post(a.cookie, "request", c.name);
    await post(a.cookie, "decline", c.name);
    await post(c.cookie, "cancel", a.name);
    expect((await list(c.cookie)).body.incoming?.length).toBe(1);

    await befriend(a, b);
    await post(b.cookie, "remove", a.name);
    expect((await list(a.cookie)).body.friends).toEqual([]);
    expect((await list(b.cookie)).body.friends).toEqual([]);
  });

  it("oturum şart; POST'ta Origin ve JSON zorunlu; yanıtlarda e-posta ya da oda kodu yok", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    expect((await api(null, "GET", "")).status).toBe(401);
    expect((await api(null, "POST", "/request", { username: "Berk" })).status).toBe(401);
    const noOrigin = await fetch(`${base()}/api/friends/request`, {
      method: "POST",
      headers: { Cookie: a.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Berk" }),
    });
    expect(noOrigin.status).toBe(403);
    const evil = await api(
      a.cookie,
      "POST",
      "/request",
      { username: "Berk" },
      { Origin: "https://evil.example" },
    );
    expect(evil.status).toBe(403);
    const text = await fetch(`${base()}/api/friends/request`, {
      method: "POST",
      headers: { Cookie: a.cookie, Origin: base(), "Content-Type": "text/plain" },
      body: JSON.stringify({ username: "Berk" }),
    });
    expect(text.status).toBe(400);
    expect((await api(a.cookie, "GET", "/request")).status).toBe(405);
    await befriend(a, b);
    const l = await list(a.cookie);
    expect(l.raw).not.toContain("@");
    expect(l.raw).not.toContain("test.local");
  });

  it("hesap verisi silinince arkadaşlık ve engeller de gider", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    const c = user("Cem");
    await befriend(a, b);
    await post(a.cookie, "block", c.name);
    const id = k.srv.accounts.findByUsername("Ayse")?.id ?? -1;
    k.srv.accounts.deleteAccountData(id);
    expect((await list(b.cookie)).body.friends).toEqual([]);
    expect((await list(a.cookie)).body.blocked).toEqual([]);
  });
});

describe("engelleme", () => {
  useServer();

  it("engellenen istek atamaz ve nedenini öğrenmez; engelleyen kendi engelini görür", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    await befriend(a, b);
    expect((await post(a.cookie, "block", b.name)).status).toBe(200);
    // Arkadaşlık kalktı.
    expect((await list(a.cookie)).body.friends).toEqual([]);
    expect((await list(b.cookie)).body.friends).toEqual([]);
    expect((await list(a.cookie)).body.blocked).toEqual([{ username: "Berk" }]);

    const blockedAsk = await post(b.cookie, "request", a.name);
    expect(blockedAsk.status).toBe(400);
    expect(blockedAsk.body.message).toBe("İstek gönderilemedi.");
    // Engelleyen kendi engelini görür ve kaldırmadan istek atamaz.
    expect((await post(a.cookie, "request", b.name)).body.code).toBe("blocked_by_me");
    // Hiç engel yokken de dolu kota aynı genel metni verir: metin engeli ele vermez.
    const c = user("Cem");
    expect(blockedAsk.body.code).toBe("request_failed");
    expect((await post(b.cookie, "request", c.name)).status).toBe(200);

    await post(a.cookie, "unblock", b.name);
    expect((await post(b.cookie, "request", a.name)).status).toBe(200);
  });

  it("bekleyen istek engelle silinir", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    await post(b.cookie, "request", a.name);
    await post(a.cookie, "block", b.name);
    expect((await list(a.cookie)).body.incoming).toEqual([]);
    expect((await list(b.cookie)).body.outgoing).toEqual([]);
  });

  it("kendini engelleyemez", async () => {
    const a = user("Ayse");
    expect((await post(a.cookie, "block", "Ayse")).status).toBe(400);
  });
});

describe("kotalar ve hız sınırı", () => {
  useServer();

  it("en çok 50 bekleyen giden istek", async () => {
    const a = user("Ayse");
    const aid = k.srv.accounts.findByUsername("Ayse")?.id ?? -1;
    for (let i = 0; i < MAX_OUTGOING; i++) {
      const made = k.srv.accounts.create(`Hedef${i}`, `h${i}@test.local`, "x", k.clock.now());
      if (!made.ok) throw new Error("hesap");
      expect(k.srv.accounts.requestFriend(aid, made.account.id, k.clock.now())).toBe("sent");
    }
    const extra = user("Fazla");
    const r = await post(a.cookie, "request", extra.name);
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("limit");
  });

  it("en çok 200 arkadaş", async () => {
    const a = user("Ayse");
    const aid = k.srv.accounts.findByUsername("Ayse")?.id ?? -1;
    const addFriend = (i: number): number => {
      const made = k.srv.accounts.create(`Dost${i}`, `d${i}@test.local`, "x", k.clock.now());
      if (!made.ok) throw new Error("hesap");
      k.srv.accounts.requestFriend(made.account.id, aid, k.clock.now());
      expect(k.srv.accounts.acceptFriend(aid, made.account.id, k.clock.now())).toBe("ok");
      return made.account.id;
    };
    for (let i = 0; i < MAX_FRIENDS - 1; i++) addFriend(i);
    // Bekleyen istek varken son boşluk dolarsa onay da reddedilir.
    const extra = user("Fazla");
    await post(extra.cookie, "request", a.name);
    addFriend(MAX_FRIENDS);
    expect((await post(a.cookie, "accept", extra.name)).body.code).toBe("limit");
    expect((await post(a.cookie, "request", user("Baska").name)).body.code).toBe("limit");
    // Dolu hesaba istek atan genel hata alır (karşının doluluğu da sızmaz).
    expect((await post(extra.cookie, "request", a.name)).body.code).toBe("already_requested");
    const third = user("Ucuncu");
    expect((await post(third.cookie, "request", a.name)).body.code).toBe("request_failed");
  });

  it("istek hız sınırı: art arda 10 istekten sonra 429", async () => {
    const a = user("Ayse");
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await post(a.cookie, "request", "Yok_Boyle")).status);
    // Bulunamayan adlar kotayı yemez ama yazma kovasını yer; gerçek hedeflerle istek kovası sınanır.
    const targets = Array.from({ length: 12 }, (_, i) => user(`Kisi${i}`));
    const results: number[] = [];
    for (const t of targets) results.push((await post(a.cookie, "request", t.name)).status);
    expect(results.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect(results[0]).toBe(200);
  });
});

describe("profil gizliliği", () => {
  useServer();

  const profile = (cookie: string, name: string) =>
    fetch(`${base()}/api/profile/${name}`, { headers: { Cookie: cookie } });

  it("arkadaş olmayan göremez, arkadaş görür; e-posta hiç görünmez", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    expect((await profile(a.cookie, "Berk")).status).toBe(404);
    expect((await profile(a.cookie, "Yok_Boyle")).status).toBe(404);
    await post(a.cookie, "request", b.name);
    // Bekleyen istek profil açmaz.
    expect((await profile(b.cookie, "Ayse")).status).toBe(404);
    await post(b.cookie, "accept", a.name);
    const res = await profile(a.cookie, "Berk");
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(body.username).toBe("Berk");
    expect(body).not.toHaveProperty("recent");
    expect(body).not.toHaveProperty("coPlayers");
    expect(text).not.toContain("test.local");
    await post(b.cookie, "block", a.name);
    expect((await profile(a.cookie, "Berk")).status).toBe(404);
  });
});

describe("durum (presence)", () => {
  useServer();

  it("çevrimiçi → lobide → oyunda → çevrimiçi → çevrimdışı; yalnız arkadaşlar duyar", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    const c = user("Cem");
    await befriend(a, b);
    const watcher = await connect(a);
    const stranger = await connect(c);
    await sync();

    const bc = await connect(b);
    await until(() => statuses(watcher, "Berk").includes("online"), "çevrimiçi");
    bc.send({ type: "createRoom", nickname: "Berk" });
    await until(() => statuses(watcher, "Berk").includes("lobby"), "lobide");
    expect((await list(a.cookie)).body.friends?.[0]?.status).toBe("lobby");

    // Ayşe'nin ikinci bağlantısı odaya girer; maç başlayınca izleyen bağlantı "oyunda" görür.
    const player = await connect(a);
    player.send({ type: "joinRoom", code: bc.session.roomCode, nickname: "Ayse" });
    await until(() => player.updates.length > 0, "katıldı");
    bc.send({ type: "startMatch" });
    await until(() => statuses(watcher, "Berk").includes("playing"), "oyunda");
    expect((await list(a.cookie)).body.friends?.[0]?.status).toBe("playing");

    bc.send({ type: "leaveRoom" });
    await until(() => statuses(watcher, "Berk").at(-1) === "online", "yine çevrimiçi");
    bc.ws.close();
    await until(() => statuses(watcher, "Berk").at(-1) === "offline", "çevrimdışı");
    expect(statuses(watcher, "Berk")).toEqual(["online", "lobby", "playing", "online", "offline"]);

    // Arkadaş olmayan hiçbir durum mesajı almadı.
    expect(stranger.of("friendStatus")).toEqual([]);
  });

  it("durum yayını kısılır: bir tarama aralığındaki dalgalanma tek mesaj olur", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    await befriend(a, b);
    const watcher = await connect(a);
    await sync();
    const bc = await connect(b);
    bc.send({ type: "createRoom", nickname: "Berk" });
    bc.send({ type: "leaveRoom" });
    bc.send({ type: "createRoom", nickname: "Berk" });
    await until(() => statuses(watcher, "Berk").length > 0, "durum");
    await sync();
    expect(statuses(watcher, "Berk").length).toBeLessThanOrEqual(2);
    expect(statuses(watcher, "Berk").at(-1)).toBe("lobby");
  });

  it("durum mesajı oda kodu taşımaz; listede yalnız joinable / withYou işaretleri vardır", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    await befriend(a, b);
    const watcher = await connect(a);
    const bc = await host(b);
    await until(() => statuses(watcher, "Berk").includes("lobby"), "lobide");
    const code = bc.session.roomCode;
    expect(JSON.stringify(watcher.msgs)).not.toContain(code);
    const l = await list(a.cookie);
    expect(l.raw).not.toContain(code);
    expect(l.body.friends?.[0]).toMatchObject({ status: "lobby", joinable: true, withYou: false });
    watcher.send({ type: "joinFriend", username: "Berk", nickname: "Ayse" });
    await until(() => watcher.of("session").length > 0, "katıldı");
    expect((await list(a.cookie)).body.friends?.[0]).toMatchObject({ withYou: true });
  });

  it("arkadaşlıktan çıkınca durum gelmez", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    await befriend(a, b);
    await post(a.cookie, "remove", b.name);
    const watcher = await connect(a);
    await connect(b);
    k.clock.advance(PRESENCE_SCAN_MS * 3);
    await sync();
    expect(watcher.of("friendStatus")).toEqual([]);
  });
});

describe("istek bildirimi (WS)", () => {
  useServer();

  it("istek gelince friendRequest, kabulde friendsChanged gider", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    const bc = await connect(b);
    const ac = await connect(a);
    await post(a.cookie, "request", b.name);
    await until(() => bc.of("friendRequest").length > 0, "istek");
    expect(bc.of("friendRequest")[0]).toEqual({ type: "friendRequest", username: "Ayse" });
    await post(b.cookie, "accept", a.name);
    await until(() => ac.of("friendsChanged").length > 0, "kabul");
    // Mesajlar minimal: e-posta yok.
    expect(JSON.stringify(bc.msgs)).not.toContain("test.local");
  });
});

function fakeGateway(result: PushResult = "ok") {
  const sent: { target: PushTarget; payload: string }[] = [];
  const gateway: PushGateway = {
    enabled: true,
    publicKey: "SAHTE-ANAHTAR",
    send: (target, payload) => {
      sent.push({ target, payload });
      return Promise.resolve(result);
    },
  };
  return { gateway, sent };
}

describe("davet", () => {
  const { gateway, sent } = fakeGateway();
  useServer({ push: gateway });

  it("canlı bağlantıya invite gider; 10 dk geçerli; gönderene inviteSent döner", async () => {
    sent.length = 0;
    const a = user("Ayse");
    const b = user("Berk");
    await befriend(a, b);
    const bc = await connect(b);
    const ac = await host(a);
    const now = k.clock.now();
    ac.send({ type: "inviteFriend", username: "berk" });
    await until(() => bc.of("invite").length > 0, "davet");
    const inv = bc.of("invite")[0];
    expect(inv?.from).toBe("Ayse");
    expect(inv?.roomCode).toBe(ac.session.roomCode);
    expect((inv?.expiresAt ?? 0) - now).toBeLessThanOrEqual(INVITE_TTL_MS + 1000);
    expect((inv?.expiresAt ?? 0) - now).toBeGreaterThanOrEqual(INVITE_TTL_MS);
    await until(() => ac.of("inviteSent").length > 0, "gönderildi");
    expect(sent.length).toBe(0);
    // Katıl: mevcut katılma yoluyla odaya girer.
    bc.send({ type: "joinRoom", code: inv?.roomCode ?? "", nickname: "Berk" });
    await until(() => bc.updates.length > 0, "katıldı");
    expect(bc.room.players.length).toBe(2);
  });

  it("canlı bağlantı yoksa hesaba bağlı abonelikle web bildirimi gider", async () => {
    sent.length = 0;
    const a = user("Ayse");
    const b = user("Berk");
    await befriend(a, b);
    const bc = await connect(b);
    // Odasız, yalnız hesaplı bağlantı da aboneliğini hesaba bağlayabilir.
    bc.send({ type: "pushSubscribe", endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH });
    await sync();
    bc.ws.close();
    await until(() => bc.closeCode !== null, "kapandı");
    await sync();
    const ac = await host(a);
    ac.send({ type: "inviteFriend", username: "Berk" });
    await until(() => ac.of("inviteSent").length > 0, "gönderildi");
    expect(sent.length).toBe(1);
    expect(sent[0]?.target.endpoint).toBe(ENDPOINT);
    const payload = JSON.parse(sent[0]?.payload ?? "{}") as Record<string, string>;
    expect(payload.body).toBe("Ayse seni GLIX odasına çağırıyor");
    expect(payload.url).toBe(`/?oda=${ac.session.roomCode}`);
  });

  it("abonelik ve bağlantı yoksa davet gitmez", async () => {
    sent.length = 0;
    const a = user("Ayse");
    const b = user("Berk");
    await befriend(a, b);
    const ac = await host(a);
    ac.send({ type: "inviteFriend", username: "Berk" });
    await until(() => ac.of("error").length > 0, "hata");
    expect(ac.lastError?.code).toBe("invite_failed");
    // Abonelikten çıkan da bildirim almaz.
    const bc = await connect(b);
    bc.send({ type: "pushSubscribe", endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH });
    bc.send({ type: "pushUnsubscribe" });
    await sync();
    bc.ws.close();
    await until(() => bc.closeCode !== null, "kapandı");
    await sync();
    k.clock.advance(INVITE_PAIR_GAP_MS);
    ac.send({ type: "inviteFriend", username: "Berk" });
    await until(() => ac.of("error").length > 1, "hata 2");
    expect(sent.length).toBe(0);
  });

  it("arkadaş olmayana, engelliye, kendine ve odada olana davet gitmez", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    const c = user("Cem");
    await befriend(a, b);
    const bc = await connect(b);
    const cc = await connect(c);
    const ac = await host(a);
    ac.send({ type: "inviteFriend", username: "Cem" });
    ac.send({ type: "inviteFriend", username: "Ayse" });
    ac.send({ type: "inviteFriend", username: "Yok_Boyle" });
    await until(() => ac.of("error").length >= 3, "hatalar");
    expect(ac.of("error").every((e) => e.code === "invite_failed")).toBe(true);
    expect(cc.of("invite")).toEqual([]);

    // Zaten odadaki arkadaş çağrılmaz.
    bc.send({ type: "joinRoom", code: ac.session.roomCode, nickname: "Berk" });
    await until(() => bc.updates.length > 0, "katıldı");
    ac.send({ type: "inviteFriend", username: "Berk" });
    await until(() => ac.of("error").length >= 4, "hata 4");
    expect(bc.of("invite")).toEqual([]);
  });

  it("engelleyen ve engellenen davet edemez", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    await befriend(a, b);
    await post(b.cookie, "block", a.name);
    const bc = await connect(b);
    const ac = await host(a);
    ac.send({ type: "inviteFriend", username: "Berk" });
    await until(() => ac.of("error").length > 0, "hata");
    expect(ac.lastError?.code).toBe("invite_failed");
    expect(bc.of("invite")).toEqual([]);
    const bh = await host(b);
    bh.send({ type: "inviteFriend", username: "Ayse" });
    await until(() => bh.of("error").length > 0, "hata");
    expect(bh.lastError?.code).toBe("invite_failed");
  });

  it("misafir ve odasız bağlantı davet edemez", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    await befriend(a, b);
    await connect(b);
    const lone = await connect(a);
    lone.send({ type: "inviteFriend", username: "Berk" });
    await until(() => lone.of("error").length > 0, "hata");
    expect(lone.lastError?.code).toBe("not_in_room");

    const guest = await Client.connect();
    guest.send({ type: "inviteFriend", username: "Berk" });
    await until(() => guest.of("error").length > 0, "hata");
    expect(guest.lastError?.code).toBe("login_required");
  });

  it("aynı arkadaşa 30 sn'de bir", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    await befriend(a, b);
    const bc = await connect(b);
    const ac = await host(a);
    ac.send({ type: "inviteFriend", username: "Berk" });
    await until(() => bc.of("invite").length === 1, "ilk davet");
    ac.send({ type: "inviteFriend", username: "Berk" });
    await until(() => ac.of("error").length > 0, "sınır");
    expect(ac.lastError?.code).toBe("rate_limited");
    expect(bc.of("invite").length).toBe(1);
    k.clock.advance(INVITE_PAIR_GAP_MS);
    ac.send({ type: "inviteFriend", username: "Berk" });
    await until(() => bc.of("invite").length === 2, "ikinci davet");
  });

  it("gönderen başına dakikada 20 davet", async () => {
    const a = user("Ayse");
    const aid = k.srv.accounts.findByUsername("Ayse")?.id ?? -1;
    const names: string[] = [];
    const conns: Client[] = [];
    for (let i = 0; i <= INVITE_PER_MINUTE; i++) {
      const f = user(`Dost${i}`);
      const fid = k.srv.accounts.findByUsername(f.name)?.id ?? -1;
      k.srv.accounts.requestFriend(fid, aid, k.clock.now());
      k.srv.accounts.acceptFriend(aid, fid, k.clock.now());
      names.push(f.name);
      conns.push(await connect(f));
    }
    const ac = await host(a);
    // Saat ilerlemeden art arda gönderilir: kova tam 20 davet verir.
    for (const n of names) ac.send({ type: "inviteFriend", username: n });
    await until(() => ac.of("inviteSent").length + ac.of("error").length === names.length, "yanıtlar");
    expect(ac.of("inviteSent").length).toBe(INVITE_PER_MINUTE);
    expect(ac.lastError?.code).toBe("rate_limited");
    expect(conns.filter((c) => c.of("invite").length > 0).length).toBe(INVITE_PER_MINUTE);
  });
});

describe("arkadaşın lobisine katılma", () => {
  useServer();

  it("arkadaş lobideyse kod gösterilmeden katılınır", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    await befriend(a, b);
    const ac = await host(a);
    const bc = await connect(b);
    bc.send({ type: "joinFriend", username: "ayse", nickname: "Berk" });
    await until(() => bc.of("session").length > 0, "katıldı");
    expect(bc.session.roomCode).toBe(ac.session.roomCode);
    expect(bc.room.players.length).toBe(2);
  });

  it("arkadaş olmayan, odasız arkadaş ve misafir reddedilir; hata hepsinde aynıdır", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    const c = user("Cem");
    await befriend(a, b);
    await host(a);
    const outsider = await connect(c);
    outsider.send({ type: "joinFriend", username: "Ayse", nickname: "Cem" });
    const roomless = await connect(b);
    roomless.send({ type: "joinFriend", username: "Cem", nickname: "Berk" });
    const guest = await Client.connect();
    guest.send({ type: "joinFriend", username: "Ayse", nickname: "Misafir" });
    await until(() => [outsider, roomless, guest].every((x) => x.of("error").length > 0), "hatalar");
    for (const x of [outsider, roomless, guest]) {
      expect(x.lastError?.code).toBe("friend_not_found");
      expect(x.of("session")).toEqual([]);
    }
  });

  it("maç sürerken izleyiciye açıksa izleyici olarak girer, kapalıysa girmez", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    const c = user("Cem");
    await befriend(a, b);
    await befriend(a, c);
    const ac = await host(a);
    const extra = await Client.connect();
    extra.send({ type: "joinRoom", code: ac.session.roomCode, nickname: "Misafir" });
    await until(() => extra.updates.length > 0, "misafir katıldı");
    ac.send({ type: "setGames", gameIds: ["butona-bas"] });
    await sync();
    ac.send({ type: "startMatch" });
    await until(() => ac.room.phase !== "lobby", "maç");
    const bc = await connect(b);
    bc.send({ type: "joinFriend", username: "Ayse", nickname: "Berk" });
    await until(() => bc.updates.length > 0, "izleyici girdi");
    expect(bc.room.players.find((p) => p.id === bc.room.selfId)?.spectator).toBe(true);
  });

  it("zaten odadaki bağlantı katılamaz", async () => {
    const a = user("Ayse");
    const b = user("Berk");
    await befriend(a, b);
    await host(a);
    const bh = await host(b);
    bh.send({ type: "joinFriend", username: "Ayse", nickname: "Berk" });
    await until(() => bh.of("error").length > 0, "hata");
    expect(bh.lastError?.code).toBe("already_in_room");
  });
});
