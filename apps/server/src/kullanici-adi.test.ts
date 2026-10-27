import { describe, expect, it } from "vitest";
import { USERNAME_COOLDOWN_MS } from "./accountStore.js";
import { parseUsernameChange, turkishDateTime } from "./auth.js";
import { Client, k, loginCookie, sync, until, useServer } from "./testkit.js";

const base = () => `http://127.0.0.1:${k.srv.port}`;
const DAY = 24 * 3600 * 1000;

interface Reply {
  status: number;
  body: {
    ok?: boolean;
    code?: string;
    message?: string;
    field?: string;
    availableAt?: number;
    usernameAvailableAt?: number | null;
    account?: { username: string; email: string } | null;
  };
}

async function call(
  method: "GET" | "POST",
  path: string,
  cookie: string | null,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Reply> {
  const res = await fetch(`${base()}/api/auth/${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: base(),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: (await res.json()) as Reply["body"] };
}

const rename = (cookie: string | null, username: unknown) => call("POST", "username", cookie, { username });

describe("kullanıcı adı doğrulaması", () => {
  it("yalnız geçerli tek alanlı gövde kabul edilir", () => {
    expect(parseUsernameChange({ username: "Yeni_Ad" })).toBe("Yeni_Ad");
    expect(parseUsernameChange({ username: "ab" })).toBeNull();
    expect(parseUsernameChange({ username: "a".repeat(21) })).toBeNull();
    expect(parseUsernameChange({ username: "bos luk" })).toBeNull();
    expect(parseUsernameChange({ username: "çğş_ad" })).toBeNull();
    expect(parseUsernameChange({ username: 5 })).toBeNull();
    expect(parseUsernameChange({ username: "Ali", ekstra: 1 })).toBeNull();
    expect(parseUsernameChange("Ali")).toBeNull();
    expect(parseUsernameChange(null)).toBeNull();
  });

  it("tarih Türkiye saatiyle yazılır", () => {
    // 2026-11-03T11:05:00Z = 14:05 (UTC+3)
    expect(turkishDateTime(Date.UTC(2026, 10, 3, 11, 5))).toBe("3 Kasım 2026 14:05");
    expect(turkishDateTime(Date.UTC(2026, 11, 31, 22, 0))).toBe("1 Ocak 2027 01:00");
  });
});

describe("kullanıcı adı değiştirme ucu", () => {
  useServer();

  it("oturum, Origin ve JSON zorunlu; geçersiz ad 400", async () => {
    const cookie = loginCookie("Ayse");
    expect((await rename(null, "Yeni_Ad")).status).toBe(401);
    expect(
      (await call("POST", "username", cookie, { username: "Yeni_Ad" }, { Origin: "https://kotu.example" }))
        .status,
    ).toBe(403);
    const bad = await rename(cookie, "a b");
    expect(bad.status).toBe(400);
    expect(bad.body.field).toBe("username");
    expect((await rename(cookie, "ab")).status).toBe(400);
    expect((await call("GET", "username", cookie)).status).toBe(405);
    // Hiçbiri bekleme süresini başlatmadı.
    expect((await rename(cookie, "Yeni_Ad")).status).toBe(200);
  });

  it("ilk değişiklik hemen serbest; ikincisi 7 gün sonra, tarihli Türkçe hatayla", async () => {
    const cookie = loginCookie("Ayse");
    // Hesap şimdi açıldı; yine de ilk değişiklik hemen serbest.
    expect((await call("GET", "me", cookie)).body.usernameAvailableAt).toBeNull();
    const first = await rename(cookie, "Ayse_Yeni");
    expect(first.status).toBe(200);
    expect(first.body.account?.username).toBe("Ayse_Yeni");
    const openAt = k.clock.now() + USERNAME_COOLDOWN_MS;
    expect(first.body.usernameAvailableAt).toBe(openAt);

    const me = await call("GET", "me", cookie);
    expect(me.body.account?.username).toBe("Ayse_Yeni");
    expect(me.body.usernameAvailableAt).toBe(openAt);

    const early = await rename(cookie, "Ayse_Ucuncu");
    expect(early.status).toBe(429);
    expect(early.body.code).toBe("username_cooldown");
    expect(early.body.availableAt).toBe(openAt);
    expect(early.body.message).toBe(
      `Kullanıcı adını ${turkishDateTime(openAt)} tarihinde tekrar değiştirebilirsin.`,
    );

    k.clock.advance(7 * DAY - 1000);
    expect((await rename(cookie, "Ayse_Ucuncu")).status).toBe(429);
    k.clock.advance(1000);
    expect((await call("GET", "me", cookie)).body.usernameAvailableAt).toBeNull();
    expect((await rename(cookie, "Ayse_Ucuncu")).status).toBe(200);
  });

  it("benzersizlik büyük-küçük harf duyarsız; başarısız deneme beklemeyi başlatmaz; harf boyu değişebilir", async () => {
    const a = loginCookie("Ayse");
    loginCookie("Berk");
    const taken = await rename(a, "bERK");
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe("username_taken");
    // Aynı ad: değişiklik değil.
    expect((await rename(a, "Ayse")).status).toBe(400);
    // Yalnız harf boyu değişimi serbest ve aynı hesapla çakışmaz.
    expect((await rename(a, "AYSE")).status).toBe(200);
    k.clock.advance(7 * DAY);
    // Eski ad serbest kalır, yeni adla girilebilir.
    expect((await rename(a, "Ayse_2")).status).toBe(200);
    const login = k.srv.accounts.findByLogin("ayse_2");
    expect(login?.username).toBe("Ayse_2");
    expect(k.srv.accounts.findByLogin("ayse")).toBeNull();
  });
});

describe("canlı güncelleme", () => {
  useServer();

  it("odadaki oyuncunun adı herkese yayınlanır; ad bağlantıda da güncellenir", async () => {
    const a = loginCookie("Ayse");
    const guest = await Client.connect();
    const host = await Client.connect(a);
    host.send({ type: "createRoom", nickname: "Takma" });
    await until(() => host.updates.length > 0, "oda");
    // Hesaplı oyuncunun adı kullanıcı adıdır; istemcinin yolladığı ad yok sayılır.
    expect(host.room.players[0]?.nickname).toBe("Ayse");
    guest.send({ type: "joinRoom", code: host.session.roomCode, nickname: "Misafir" });
    await until(() => guest.updates.length > 0, "misafir girdi");

    expect((await rename(a, "Ayse_Yeni")).status).toBe(200);
    await until(() => guest.room.players.some((p) => p.nickname === "Ayse_Yeni"), "yeni ad misafire ulaştı");
    expect(host.room.players.map((p) => p.nickname).sort()).toEqual(["Ayse_Yeni", "Misafir"]);
    expect(guest.room.players.some((p) => p.nickname === "Ayse")).toBe(false);
  });

  it("odadaki misafir aynı adı almışsa hesaplı oyuncu numara alır, yineleme olmaz", async () => {
    const a = loginCookie("Ayse");
    const host = await Client.connect(a);
    host.send({ type: "createRoom", nickname: "x" });
    await until(() => host.updates.length > 0, "oda");
    const guest = await Client.connect();
    guest.send({ type: "joinRoom", code: host.session.roomCode, nickname: "Hedef" });
    await until(() => guest.updates.length > 0, "misafir girdi");
    expect((await rename(a, "hedef")).status).toBe(200);
    await until(() => host.room.players.some((p) => p.nickname === "hedef 2"), "numara");
    const names = host.room.players.map((p) => p.nickname.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("arkadaşlar ve bekleyen istek sahipleri listelerini yenilemesi için haber alır, liste yeni adı okur", async () => {
    const a = loginCookie("Ayse");
    const b = loginCookie("Berk");
    const c = loginCookie("Cem");
    const post = (cookie: string, action: string, username: string) =>
      fetch(`${base()}/api/friends/${action}`, {
        method: "POST",
        headers: { Cookie: cookie, Origin: base(), "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
    expect((await post(a, "request", "Berk")).status).toBe(200);
    expect((await post(b, "accept", "Ayse")).status).toBe(200);
    expect((await post(c, "request", "Ayse")).status).toBe(200);
    const berk = await Client.connect(b);
    const cem = await Client.connect(c);
    await sync();
    expect((await rename(a, "Ayse_Yeni")).status).toBe(200);
    await until(() => berk.of("friendsChanged").length > 0, "arkadaş haber aldı");
    await until(() => cem.of("friendsChanged").length > 0, "istek sahibi haber aldı");
    const res = await fetch(`${base()}/api/friends`, { headers: { Cookie: b } });
    const body = (await res.json()) as { friends: { username: string }[] };
    expect(body.friends.map((f) => f.username)).toEqual(["Ayse_Yeni"]);
  });

  it("davet yeni adla gider", async () => {
    const a = loginCookie("Ayse");
    const b = loginCookie("Berk");
    const post = (cookie: string, action: string, username: string) =>
      fetch(`${base()}/api/friends/${action}`, {
        method: "POST",
        headers: { Cookie: cookie, Origin: base(), "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
    await post(a, "request", "Berk");
    await post(b, "accept", "Ayse");
    const host = await Client.connect(a);
    const berk = await Client.connect(b);
    host.send({ type: "createRoom", nickname: "x" });
    await until(() => host.updates.length > 0, "oda");
    await rename(a, "Ayse_Yeni");
    await sync();
    host.send({ type: "inviteFriend", username: "Berk" });
    await until(() => berk.of("invite").length > 0, "davet");
    expect(berk.of("invite")[0]?.from).toBe("Ayse_Yeni");
  });
});

describe("odada takma ad", () => {
  useServer();

  it("hesaplı oyuncunun rename isteği account_name ile reddedilir, ad değişmez", async () => {
    const host = await Client.connect(loginCookie("Ayse"));
    host.send({ type: "createRoom", nickname: "x" });
    await until(() => host.updates.length > 0, "oda");
    host.send({ type: "rename", nickname: "Baska" });
    await until(() => host.lastError !== undefined, "hata");
    expect(host.lastError?.code).toBe("account_name");
    await sync();
    expect(host.room.players[0]?.nickname).toBe("Ayse");
  });

  it("misafir takma adını hâlâ değiştirebilir", async () => {
    const host = await Client.connect(loginCookie("Ayse"));
    host.send({ type: "createRoom", nickname: "x" });
    await until(() => host.updates.length > 0, "oda");
    const guest = await Client.connect();
    guest.send({ type: "joinRoom", code: host.session.roomCode, nickname: "Misafir" });
    await until(() => guest.updates.length > 0, "misafir girdi");
    guest.send({ type: "rename", nickname: "Yeni" });
    await until(() => host.room.players.some((p) => p.nickname === "Yeni"), "yeni ad");
    expect(guest.lastError).toBeUndefined();
  });

  it("katılan hesaplı oyuncu kullanıcı adıyla görünür, yolladığı takma ad yok sayılır", async () => {
    const host = await Client.connect(loginCookie("Ayse"));
    host.send({ type: "createRoom", nickname: "x" });
    await until(() => host.updates.length > 0, "oda");
    const acc = await Client.connect(loginCookie("Berk"));
    acc.send({ type: "joinRoom", code: host.session.roomCode, nickname: "Baska" });
    await until(() => acc.updates.length > 0, "katıldı");
    expect(acc.room.players.map((p) => p.nickname).sort()).toEqual(["Ayse", "Berk"]);
  });
});
