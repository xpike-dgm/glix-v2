/** Yönetici paneli A3: oyun anahtarları, duyuru ve bakım kipi (uç erişimi, canlı etki, kalıcılık). */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AdminContent,
  type AdminMaintenance,
  ANNOUNCEMENT_MAX,
  GAMES,
  type GameInfo,
} from "@glix/engine";
import { afterAll, describe, expect, it } from "vitest";
import { parseAnnouncementInput, parseGameSwitch } from "./admin.js";
import { createManualClock } from "./clock.js";
import { effectiveCatalog, pruneClosedGames } from "./gameSwitches.js";
import { clearMatch } from "./match.js";
import { addPlayer, createRoom, createRuntime } from "./rooms.js";
import { startServer } from "./server.js";
import { Client, join as joinRoom, k, loginCookie, startPlaying, sync, until, useServer } from "./testkit.js";
import { ADMIN, base, createAdminKit, MAIL } from "./yoneticiKit.js";

const kit = createAdminKit();
const { call, get, post, adminLogin } = kit;
const KULE = "kule-ustasi";
const KULE_NAME = GAMES[KULE]?.name ?? "";
const dir = mkdtempSync(join(tmpdir(), "glix-icerik-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const serverOpts = {
  adminAccountIds: ADMIN,
  mail: MAIL,
  mailFetch: kit.mailFetch,
  statsDb: ":memory:",
} as const;

/** Girişli host, manuel seçimle oda kurar. */
async function hostWith(gameIds: string[]): Promise<Client> {
  const c = await Client.connect(loginCookie());
  c.send({ type: "createRoom", nickname: "Host" });
  await until(() => c.updates.length > 0, "oda kuruldu");
  c.send({ type: "setGames", gameIds });
  await until(() => c.room.gameIds.length === gameIds.length, "seçim");
  return c;
}

async function guest(): Promise<Client> {
  const c = await Client.connect();
  c.send({ type: "hello", clientVersion: "0.1.0" });
  await until(() => c.of("welcome").length > 0, "welcome");
  return c;
}

const POSTS: [string, unknown][] = [
  ["content/game", { id: "butona-bas", open: false }],
  ["announcement/set", { text: "Merhaba", kind: "bilgi", endsAt: null }],
  ["announcement/clear", {}],
  ["push/broadcast", { title: "Başlık", body: "Metin", url: null }],
  ["maintenance/set", { on: true }],
  ["backup", { ack: true }],
];
const GETS = ["content", "maintenance", "push/status"];

describe("A3 uçları: erişim denetimi", () => {
  useServer({ ...serverOpts });

  it("oturum yoksa 401; yönetici olmayan 404; yönetici çerezi yoksa 403", async () => {
    const sess = loginCookie("yonetici_1");
    const other = loginCookie("oyuncu_2");
    for (const p of GETS) {
      expect((await get(p, null)).status).toBe(401);
      expect((await get(p, other)).status).toBe(404);
      const r = await get(p, sess);
      expect(r.status).toBe(403);
      expect(r.body.code).toBe("otp_required");
    }
    for (const [p, body] of POSTS) {
      expect((await post(p, null, body)).status).toBe(401);
      expect((await post(p, other, body)).status).toBe(404);
      expect((await post(p, sess, body)).status).toBe(403);
    }
    // Hiçbir şey değişmedi.
    const audit = k.srv.accounts.adminAuditTail(50).map((r) => r.action);
    expect(audit.some((a) => /^(game_switch|announcement_|maintenance_|push_|db_backup)/.test(a))).toBe(
      false,
    );
  });

  it("POST'larda Origin zorunlu; yöntem uyuşmazlığı 405", async () => {
    const cookie = await adminLogin();
    for (const [p, body] of POSTS) {
      expect((await call("POST", p, cookie, { body, origin: null })).status).toBe(403);
      expect((await call("POST", p, cookie, { body, origin: "https://evil.example" })).status).toBe(403);
      expect((await get(p, cookie)).status).toBe(405);
    }
    for (const p of GETS) expect((await post(p, cookie, {})).status).toBe(405);
    expect(k.srv.accounts.adminAuditTail(50).some((r) => r.action === "game_switch")).toBe(false);
  });

  it("yönetici çerezi başka hesap oturumunda geçersiz", async () => {
    const cookie = await adminLogin();
    const stolen = `${loginCookie("oyuncu_2")}; ${cookie.split("; ")[1]}`;
    for (const p of GETS) expect((await get(p, stolen)).status).toBe(404);
  });

  it("işlemler yönetici başına hız sınırına bağlıdır", async () => {
    const cookie = await adminLogin();
    let limited = 0;
    for (let i = 0; i < 14; i++) {
      const r = await post("announcement/clear", cookie, {});
      if (r.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});

describe("oyun anahtarı girdileri ve katalog süzgeci", () => {
  it("içerik/oyun gövdesi doğrulaması", () => {
    expect(parseGameSwitch({ id: "a", open: false })).toEqual({ id: "a", open: false });
    expect(parseGameSwitch({ id: "a", random: true, open: true })).toEqual({
      id: "a",
      open: true,
      random: true,
    });
    for (const bad of [
      null,
      [],
      {},
      { id: "a" },
      { id: "", open: true },
      { id: "a", open: "evet" },
      { id: "a", random: 1 },
      { id: "a", open: true, extra: 1 },
      { id: 5, open: true },
    ])
      expect(parseGameSwitch(bad)).toBeNull();
  });

  const base2: GameInfo[] = [
    { id: "a", name: "A", minPlayers: 2, maxPlayers: 8, orientation: "portrait", randomPool: false },
    { id: "b", name: "B", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
    { id: "c", name: "C", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  ];

  it("kapalı oyun çıkar; rastgele havuz ayarı motor varsayılanını iki yönde de ezer", () => {
    const out = effectiveCatalog({ a: { random: true }, b: { random: false }, c: { open: false } }, base2);
    expect(out.map((g) => g.id)).toEqual(["a", "b"]);
    expect(out.find((g) => g.id === "a")).not.toHaveProperty("randomPool"); // motor "dışında" dedi, yönetici "içinde"
    expect(out.find((g) => g.id === "b")?.randomPool).toBe(false); // motor "içinde" dedi, yönetici "dışında"
    // Ayar yoksa motorun varsayılanı geçerlidir.
    const plain = effectiveCatalog({}, base2);
    expect(plain.find((g) => g.id === "a")?.randomPool).toBe(false);
    expect(plain.find((g) => g.id === "b")).not.toHaveProperty("randomPool");
  });

  it("lobiye dönen odada kapalı oyun seçimden çıkar (süren maç bitince)", () => {
    const rt = createRuntime(createManualClock());
    const room = createRoom(rt);
    addPlayer(rt, room, "Ayşe", {
      send: () => undefined,
      sendRaw: () => undefined,
      lastSent: null,
      sentVer: -1,
      close: () => undefined,
      player: null,
      stage: null,
      ip: "1.1.1.1",
      failedJoins: 0,
      account: null,
    });
    rt.catalog = effectiveCatalog({ [KULE]: { open: false } });
    room.selection = { mode: "manual" };
    room.gameIds = [KULE, "butona-bas"];
    room.phase = "playing"; // süren maç: dokunulmaz
    expect(pruneClosedGames(rt, room)).toEqual([]);
    expect(room.gameIds).toEqual([KULE, "butona-bas"]);
    clearMatch(rt, room);
    expect(room.phase).toBe("lobby");
    expect(room.gameIds).toEqual(["butona-bas"]);
  });
});

describe("oyun anahtarları: sunucu etkisi", () => {
  useServer({ ...serverOpts });

  it("kapalı oyun kataloğdan ve lobi seçiminden düşer; açık lobilere canlı gider; yeniden açılınca döner", async () => {
    const cookie = await adminLogin();
    const host = await hostWith(["butona-bas", KULE]);
    const friend = await joinRoom(host.session.roomCode, "Mehmet");
    expect(host.room.catalog.some((g) => g.id === KULE)).toBe(true);

    const r = await post("content/game", cookie, { id: KULE, open: false });
    expect(r.status).toBe(200);
    await until(() => !host.room.catalog.some((g) => g.id === KULE), "katalogdan düştü");
    expect(host.room.gameIds).toEqual(["butona-bas"]);
    expect(friend.room.gameIds).toEqual(["butona-bas"]);
    // Odadakilere Türkçe lobi bildirimi gider.
    await until(() => host.of("lobbyNotice").length > 0 && friend.of("lobbyNotice").length > 0, "bildirim");
    expect(host.of("lobbyNotice")[0]?.text).toBe(`${KULE_NAME} şu an kapalı, seçimden çıkarıldı.`);

    // Kapalı oyun yeniden seçilemez.
    host.send({ type: "setGames", gameIds: [KULE] });
    await until(() => host.lastError?.code === "invalid_games", "reddedildi");
    expect(host.lastError?.message).toBe("Seçtiğin oyunlardan biri şu an kapalı.");
    expect(host.room.gameIds).toEqual(["butona-bas"]);

    // Panel listesi: kapalı görünür.
    const content = (await get<AdminContent>("content", cookie)).body;
    expect(content.games.find((g) => g.id === KULE)).toMatchObject({ open: false, overridden: true });
    expect(content.games.length).toBe(Object.keys(GAMES).length);

    // Yeniden açılınca katalog döner; seçim kendiliğinden geri gelmez.
    await post("content/game", cookie, { id: KULE, open: true });
    await until(() => host.room.catalog.some((g) => g.id === KULE), "geri geldi");
    expect(host.room.gameIds).toEqual(["butona-bas"]);
    expect(
      (await get<AdminContent>("content", cookie)).body.games.find((g) => g.id === KULE)?.overridden,
    ).toBe(false);
    const rows = k.srv.accounts.adminAuditTail(10).filter((a) => a.action === "game_switch");
    expect(rows.map((a) => a.detail)).toEqual([`${KULE}:open`, `${KULE}:closed`]);
  });

  it("kapalı ve havuz dışı oyunlar rastgele seçilmez; havuz dışı elle seçilebilir", async () => {
    const cookie = await adminLogin();
    const host = await Client.connect(loginCookie());
    host.send({ type: "createRoom", nickname: "Host" });
    await until(() => host.updates.length > 0, "oda");
    await joinRoom(host.session.roomCode, "Mehmet");
    expect((await post("content/game", cookie, { id: KULE, open: false })).status).toBe(200);
    expect((await post("content/game", cookie, { id: "butona-bas", random: false })).status).toBe(200);
    await until(
      () => host.room.catalog.find((g) => g.id === "butona-bas")?.randomPool === false,
      "havuz dışı yayınlandı",
    );
    host.send({ type: "setRandom", count: 64 });
    await until(() => host.room.selection.mode === "random", "rastgele mod");
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "başladı");
    const picked = host.room.gameIds;
    expect(picked.length).toBeGreaterThan(3);
    expect(picked).not.toContain(KULE);
    expect(picked).not.toContain("butona-bas");
    const eligible = Object.values(GAMES).filter(
      (g) =>
        g.randomPool !== false &&
        g.minPlayers <= 2 &&
        g.maxPlayers >= 2 &&
        g.id !== KULE &&
        g.id !== "butona-bas",
    );
    expect([...picked].sort()).toEqual(eligible.map((g) => g.id).sort());
  });

  it("havuzda hiç oyun kalmazsa maç başlamaz", async () => {
    const cookie = await adminLogin();
    const host = await Client.connect(loginCookie());
    host.send({ type: "createRoom", nickname: "Host" });
    await until(() => host.updates.length > 0, "oda");
    await joinRoom(host.session.roomCode, "Mehmet");
    // Hız sınırını aşmamak için sahte saat ilerletilir.
    for (const g of Object.keys(GAMES)) {
      const r = await post("content/game", cookie, { id: g, open: false });
      if (r.status === 429) {
        k.clock.advance(60_000);
        expect((await post("content/game", cookie, { id: g, open: false })).status).toBe(200);
      }
    }
    await until(() => host.room.catalog.length === 0, "katalog boş");
    host.send({ type: "setRandom", count: 5 });
    await until(() => host.room.selection.mode === "random", "rastgele mod");
    host.send({ type: "startMatch" });
    await until(() => host.lastError?.code === "not_enough_players", "oyun yok");
    expect(host.room.phase).toBe("lobby");
  });

  it("süren maç kapatılan oyunla normal sürer", async () => {
    const cookie = await adminLogin();
    const host = await hostWith(["butona-bas"]);
    const friend = await joinRoom(host.session.roomCode, "Mehmet");
    await startPlaying([host, friend]);
    expect((await post("content/game", cookie, { id: "butona-bas", open: false })).status).toBe(200);
    await sync();
    // Maç sürer, oda bu oyunun adını katalogda görmeye devam eder.
    expect(host.room.phase).toBe("playing");
    expect(host.room.match?.gameId).toBe("butona-bas");
    expect(host.room.catalog.some((g) => g.id === "butona-bas")).toBe(true);
    expect(host.room.gameIds).toEqual(["butona-bas"]);
    k.clock.advance(1000);
    await sync();
    expect(host.room.phase).toBe("playing");
    expect(host.of("lobbyNotice")).toEqual([]);
    // Başka bir lobi artık göremez.
    const other = await hostWith([KULE]);
    expect(other.room.catalog.some((g) => g.id === "butona-bas")).toBe(false);
  });

  it("geçersiz gövde 400, bilinmeyen oyun 404", async () => {
    const cookie = await adminLogin();
    expect((await post("content/game", cookie, { id: KULE })).status).toBe(400);
    expect((await post("content/game", cookie, { id: KULE, open: "hayır" })).status).toBe(400);
    expect((await post("content/game", cookie, { id: "yok-oyun", open: false })).status).toBe(404);
    expect(k.srv.accounts.adminAuditTail(10).some((a) => a.action === "game_switch")).toBe(false);
  });
});

describe("duyuru", () => {
  const NOW = 1_000_000;
  it("metin 1-140 karakter düz metin; bitiş zamanı ileride ve en çok 30 gün", () => {
    const ok = parseAnnouncementInput({ text: "  Bu   akşam bakım var  ", kind: "uyari", endsAt: null }, NOW);
    expect(ok).toEqual({ text: "Bu akşam bakım var", kind: "uyari", endsAt: null });
    expect(
      parseAnnouncementInput({ text: "x".repeat(ANNOUNCEMENT_MAX), kind: "bilgi", endsAt: NOW + 1 }, NOW),
    ).not.toBeNull();
    for (const bad of [
      { text: "", kind: "bilgi", endsAt: null },
      { text: "   ", kind: "bilgi", endsAt: null },
      { text: "x".repeat(ANNOUNCEMENT_MAX + 1), kind: "bilgi", endsAt: null },
      { text: "<b>kalın</b>", kind: "bilgi", endsAt: null },
      { text: "satır\nsonu", kind: "bilgi", endsAt: null },
      { text: "gizli‮metin", kind: "bilgi", endsAt: null },
      { text: "merhaba", kind: "hata", endsAt: null },
      { text: "merhaba", kind: "bilgi", endsAt: NOW },
      { text: "merhaba", kind: "bilgi", endsAt: NOW + 31 * 24 * 3600 * 1000 },
      { text: "merhaba", kind: "bilgi", endsAt: 1.5 },
      { text: "merhaba", kind: "bilgi" },
      { text: "merhaba", kind: "bilgi", endsAt: null, ekstra: 1 },
      { text: 5, kind: "bilgi", endsAt: null },
    ])
      expect(parseAnnouncementInput(bad, NOW)).toBeNull();
  });

  describe("sunucuda", () => {
    useServer({ ...serverOpts });

    it("bağlanana welcome ile gelir, canlı güncellenir, kaldırılınca düşer; kimlik artar", async () => {
      const cookie = await adminLogin();
      const before = await guest();
      expect(before.of("welcome")[0]?.site).toEqual({ announcement: null, maintenance: false });

      const r = await post("announcement/set", cookie, {
        text: "Yarın bakım var",
        kind: "uyari",
        endsAt: null,
      });
      expect(r.status).toBe(200);
      await until(() => before.of("siteNotice").length === 1, "canlı duyuru");
      const live = before.of("siteNotice")[0]?.site?.announcement;
      expect(live).toMatchObject({ text: "Yarın bakım var", kind: "uyari", endsAt: null });

      const late = await guest();
      expect(late.of("welcome")[0]?.site?.announcement).toEqual(live);

      await post("announcement/set", cookie, { text: "Yeni metin", kind: "bilgi", endsAt: null });
      await until(() => before.of("siteNotice").length === 2, "ikinci duyuru");
      const second = before.of("siteNotice")[1]?.site.announcement;
      expect((second?.id ?? 0) > (live?.id ?? 0)).toBe(true);

      await post("announcement/clear", cookie, {});
      await until(() => before.of("siteNotice").length === 3, "kaldırıldı");
      expect(before.of("siteNotice")[2]?.site.announcement).toBeNull();
      const afterClear = await guest();
      expect(afterClear.of("welcome")[0]?.site?.announcement).toBeNull();
      await post("announcement/set", cookie, { text: "Üçüncü", kind: "bilgi", endsAt: null });
      await until(() => before.of("siteNotice").length === 4, "üçüncü");
      // Kaldırılıp yeniden yayınlansa da kimlik tekrar etmez (kapatılan duyuru geri gelmesin).
      expect((before.of("siteNotice")[3]?.site.announcement?.id ?? 0) > (second?.id ?? 0)).toBe(true);
    });

    it("süresi dolunca herkesten kalkar; yeni bağlananlar görmez", async () => {
      const cookie = await adminLogin();
      const c = await guest();
      const endsAt = k.clock.now() + 20_000;
      expect(
        (await post("announcement/set", cookie, { text: "Kısa duyuru", kind: "bilgi", endsAt })).status,
      ).toBe(200);
      await until(() => c.of("siteNotice").length === 1, "duyuru");
      k.clock.advance(21_000);
      await until(() => c.of("siteNotice").length === 2, "süre doldu");
      expect(c.of("siteNotice")[1]?.site.announcement).toBeNull();
      const late = await guest();
      expect(late.of("welcome")[0]?.site?.announcement).toBeNull();
      expect((await get<AdminContent>("content", cookie)).body.announcement).toBeNull();
    });

    it("geçersiz duyuru 400 ve yayınlanmaz; işlem kaydına yalnız tür yazılır", async () => {
      const cookie = await adminLogin();
      const c = await guest();
      for (const body of [
        { text: "<script>", kind: "bilgi", endsAt: null },
        { text: "a", kind: "bilgi", endsAt: 5 },
        { text: "x".repeat(141), kind: "bilgi", endsAt: null },
      ])
        expect((await post("announcement/set", cookie, body)).status).toBe(400);
      expect(c.of("siteNotice")).toEqual([]);
      await post("announcement/set", cookie, { text: "Gizli kalmayan metin", kind: "uyari", endsAt: null });
      const row = k.srv.accounts.adminAuditTail(5).find((a) => a.action === "announcement_set");
      expect(row?.detail).toBe("uyari");
      expect(JSON.stringify(k.srv.accounts.adminAuditTail(20))).not.toContain("Gizli kalmayan");
    });
  });
});

describe("bakım kipi", () => {
  useServer({ ...serverOpts });

  it("açıkken oda kurulamaz ve maç başlamaz; süren maç biter; katılım sürer; banner bayrağı gider", async () => {
    const cookie = await adminLogin();
    const host = await hostWith(["butona-bas"]);
    const friend = await joinRoom(host.session.roomCode, "Mehmet");
    const idle = await hostWith(["butona-bas"]);
    const idleFriend = await joinRoom(idle.session.roomCode, "Zeynep");
    const watcher = await guest();
    await startPlaying([host, friend]);

    expect((await post("maintenance/set", cookie, { on: true })).status).toBe(200);
    await until(() => watcher.of("siteNotice").length === 1, "bakım bildirimi");
    expect(watcher.of("siteNotice")[0]?.site?.maintenance).toBe(true);
    expect((await guest()).of("welcome")[0]?.site?.maintenance).toBe(true);

    // Yeni oda yok.
    const creator = await Client.connect(loginCookie());
    creator.send({ type: "createRoom", nickname: "Yeni" });
    await until(() => creator.lastError?.code === "maintenance", "oda reddedildi");
    expect(creator.lastError?.message).toBe("Kısa bir bakım yapıyoruz, birazdan tekrar dene.");
    expect(creator.updates.length).toBe(0);
    // Lobideki oda yeni maç başlatamaz.
    idle.send({ type: "startMatch" });
    await until(() => idle.lastError?.code === "maintenance", "maç reddedildi");
    expect(idle.room.phase).toBe("lobby");
    // Odaya katılım sürer.
    const joiner = await joinRoom(idle.session.roomCode, "Katılan");
    expect(joiner.updates.length).toBeGreaterThan(0);
    expect(idleFriend.room.players.length).toBe(3);

    // Süren maç normal ilerler; admin canlı sayacı görür.
    const m = (await get<AdminMaintenance>("maintenance", cookie)).body;
    expect(m).toMatchObject({ on: true, activeMatches: 1, draining: false });
    expect(host.room.phase).toBe("playing");
    k.clock.advance(1000);
    await sync();
    expect(host.room.phase).toBe("playing");

    // Kapanınca her şey normale döner.
    expect((await post("maintenance/set", cookie, { on: false })).status).toBe(200);
    await until(() => watcher.of("siteNotice").length === 2, "bakım bitti");
    expect(watcher.of("siteNotice")[1]?.site.maintenance).toBe(false);
    idle.send({ type: "startMatch" });
    await until(() => idle.room.phase === "briefing", "maç başladı");
    const rows = k.srv.accounts.adminAuditTail(10).map((a) => a.action);
    expect(rows).toContain("maintenance_on");
    expect(rows).toContain("maintenance_off");
  });

  it("geçersiz gövde 400", async () => {
    const cookie = await adminLogin();
    for (const body of [{}, { on: "evet" }, { on: true, x: 1 }, null])
      expect((await post("maintenance/set", cookie, body)).status).toBe(400);
  });
});

describe("kalıcılık: yeniden başlatma", () => {
  it("oyun anahtarları, duyuru ve bakım kipi yeniden başlatmada korunur", async () => {
    const db = join(dir, "kalici.db");
    const open = async () => {
      k.clock = createManualClock();
      k.srv = await startServer({
        host: "127.0.0.1",
        port: 0,
        clientDir: dir,
        allowedOrigins: null,
        revision: "r1",
        clock: k.clock,
        heartbeatMs: 1_000_000_000,
        accountsDb: db,
        statsDb: null,
        adminAccountIds: ADMIN,
        mail: MAIL,
        mailFetch: kit.mailFetch,
      });
    };
    await open();
    const cookie = await adminLogin();
    await post("content/game", cookie, { id: KULE, open: false });
    await post("content/game", cookie, { id: "butona-bas", random: false });
    await post("announcement/set", cookie, { text: "Kalıcı duyuru", kind: "bilgi", endsAt: null });
    await post("maintenance/set", cookie, { on: true });
    await k.srv.close();

    await open();
    try {
      const c = await Client.connect();
      c.send({ type: "hello", clientVersion: "0.1.0" });
      await until(() => c.of("welcome").length > 0, "welcome");
      const site = c.of("welcome")[0]?.site;
      expect(site?.maintenance).toBe(true);
      expect(site?.announcement?.text).toBe("Kalıcı duyuru");
      const games = k.srv.accounts.settingGet("games");
      expect(JSON.parse(games ?? "{}")).toEqual({ [KULE]: { open: false }, "butona-bas": { random: false } });
      c.ws.terminate();
    } finally {
      await k.srv.close();
    }
  });
});

void base;
