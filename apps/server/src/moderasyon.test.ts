/** U16 A4 moderasyon: "Bildir", inceleme kuyruğu, oda kapatma / oyuncu atma, yasaklı kelime listesi. */
import {
  type AdminBannedAccounts,
  type AdminBannedWords,
  type AdminReportDetail,
  type AdminReportPage,
  type AdminRoomPlayers,
  REPORT_RETENTION_MS,
  type ReportReason,
  SOZLUK_ENTRIES,
} from "@glix/engine";
import { describe, expect, it } from "vitest";
import { parseModeration, parseRoomCode } from "./admin.js";
import { ROOM_KICK_BLOCK_MS } from "./moderation.js";
import {
  type Client,
  create,
  join,
  k,
  loginCookie,
  setupRoom,
  sleep,
  startPlaying,
  sync,
  until,
  useServer,
  Client as WsClient,
} from "./testkit.js";
import { ADMIN, base, createAdminKit, MAIL } from "./yoneticiKit.js";

const kit = createAdminKit();
const { call, get, post, adminLogin } = kit;
const HOUR = 3600 * 1000;

const serverOpts = {
  adminAccountIds: ADMIN,
  mail: MAIL,
  mailFetch: kit.mailFetch,
  statsDb: ":memory:",
} as const;

/** Yönetici işlem hız sınırı (10 ani, 6 sn'de 1) testleri birbirine bulaştırmasın. */
function refill(): void {
  k.clock.advance(120_000);
}

const idOf = (c: Client): string => c.session.playerId;
const accountId = (name: string): number => k.srv.accounts.findByUsername(name)?.id ?? -1;

async function report(
  from: Client,
  target: Client | string,
  reason: ReportReason = "abuse",
  note?: string,
): Promise<"ack" | string> {
  const before = from.mark();
  from.send({
    type: "report",
    playerId: typeof target === "string" ? target : idOf(target),
    reason,
    ...(note === undefined ? {} : { note }),
  });
  await until(
    () => from.since(before).some((m) => m.type === "reportAck" || m.type === "error"),
    "bildirim yanıtı",
  );
  const m = from.since(before).find((x) => x.type === "reportAck" || x.type === "error");
  return m?.type === "error" ? m.code : "ack";
}

let seq = 20000;
async function act(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

// ---- Bildir -----------------------------------------------------------------------------------------------------

describe("Bildir: kabul, kayıt ve sınırlar", () => {
  useServer({ ...serverOpts });

  it("hesaplı ve misafir bildiren kaydedilir; ad bildirim anındaki addır; kimseye bildirim gitmez", async () => {
    const host = await create("Sahibi");
    const g1 = await join(host.session.roomCode, "Misafir1");
    const g2 = await join(host.session.roomCode, "Misafir2");

    expect(await report(g1, host, "abuse", "  kötü   söz\n yazdı ")).toBe("ack");
    expect(await report(host, g1, "name")).toBe("ack");

    const rows = k.srv.accounts.reportPage(null, null, 10);
    expect(rows).toHaveLength(2);
    const byHost = rows.find((r) => r.reporterAccountId === accountId("Sahibi"));
    const byGuest = rows.find((r) => r.reporterAccountId === null);
    expect(byGuest).toMatchObject({
      targetAccountId: accountId("Sahibi"),
      targetName: "Sahibi",
      targetPlayerId: idOf(host),
      roomCode: host.session.roomCode,
      reason: "abuse",
      note: "kötü söz yazdı",
      status: "new",
      adminNote: "",
      gameId: null,
      evidence: null,
      reviewedAt: null,
    });
    expect(byGuest?.createdAt).toBeGreaterThan(0);
    expect(byGuest?.createdAt).toBeLessThanOrEqual(k.clock.now());
    expect(byHost).toMatchObject({ targetAccountId: null, targetName: "Misafir1", reason: "name" });

    // Hedef ve üçüncü kişi hiçbir şey almaz (ne onay ne bildirim).
    await sync();
    const noise = (c: Client) => c.msgs.filter((m) => m.type === "reportAck" || m.type === "lobbyNotice");
    expect(noise(g2)).toHaveLength(0);
    expect(host.of("reportAck")).toHaveLength(1); // yalnız kendi bildirimi
    expect(g1.of("reportAck")).toHaveLength(1);
    // Hedef ad değiştirse de kayıttaki ad değişmez.
    g1.send({ type: "rename", nickname: "YeniAd" });
    await until(() => host.room.players.some((p) => p.nickname === "YeniAd"), "yeni ad");
    expect(k.srv.accounts.reportGet(byHost?.id ?? 0)?.targetName).toBe("Misafir1");
  });

  it("aynı (bildiren, hedef, oda) bir kez; kendini, olmayanı ve geçersizi reddeder", async () => {
    const host = await create("Sahibi");
    const g1 = await join(host.session.roomCode, "Misafir1");
    const g2 = await join(host.session.roomCode, "Misafir2");
    expect(await report(g1, host)).toBe("ack");
    expect(await report(g1, host, "cheat")).toBe("report_duplicate");
    expect(await report(g2, host)).toBe("ack"); // başka bildiren
    expect(await report(g1, g2)).toBe("ack"); // başka hedef
    expect(await report(host, g1)).toBe("ack"); // ters yön ayrı
    expect(k.srv.accounts.reportPage(null, null, 20)).toHaveLength(4);

    expect(await report(g1, g1)).toBe("not_in_room");
    expect(await report(g1, "ffffffffffff")).toBe("not_in_room");
    // Geçersiz sebep / uzun not ağ doğrulamasında düşer.
    for (const bad of [
      { type: "report", playerId: idOf(host), reason: "spam" },
      { type: "report", playerId: idOf(host), reason: "other", note: "a".repeat(201) },
      { type: "report", playerId: idOf(host), reason: "other", baska: 1 },
    ]) {
      const before = g2.mark();
      g2.send(bad);
      await until(() => g2.since(before).some((m) => m.type === "error"), "geçersiz");
      expect(g2.since(before).find((m) => m.type === "error")).toMatchObject({ code: "invalid_message" });
    }
    expect(k.srv.accounts.reportPage(null, null, 20)).toHaveLength(4);

    // Odasız bağlantı bildiremez; sahne (TV) yalnız izler.
    const lone = await WsClient.connect();
    lone.send({ type: "report", playerId: idOf(host), reason: "other" });
    await until(() => lone.of("error").length > 0, "odasız");
    expect(lone.lastError?.code).toBe("not_in_room");
    const tv = await WsClient.connect();
    tv.send({ type: "joinStage", code: host.session.roomCode });
    await until(() => tv.of("stage").length > 0, "sahne");
    tv.send({ type: "report", playerId: idOf(host), reason: "other" });
    await until(() => tv.of("error").length > 0, "sahne hata");
    expect(tv.lastError?.code).toBe("stage_readonly");
    expect(k.srv.accounts.reportPage(null, null, 20)).toHaveLength(4);
  });

  it("bildiren başına saatte 5: misafir (IP) ve hesaplı ayrı sayılır; saat dolunca açılır", async () => {
    const host = await create("Sahibi");
    const code = host.session.roomCode;
    const guests: Client[] = [];
    for (let i = 1; i <= 7; i++) guests.push(await join(code, `Misafir${i}`));
    const [g1, g2] = guests as [Client, Client];

    // Misafir g1 beş kişiyi bildirir (host + 4 misafir), altıncı sınırı aşar.
    const targets: Client[] = [host, ...guests.slice(2, 6)];
    for (const t of targets) expect(await report(g1, t)).toBe("ack");
    const sixth = guests[6] as Client;
    expect(await report(g1, sixth)).toBe("report_limit");
    expect(k.srv.accounts.reportPage(null, null, 50)).toHaveLength(5);
    // Sınırı aşan deneme çift bildirim kontrolünü doldurmaz: saat sonra yine yapılabilir.
    // Aynı IP'deki başka misafir de aynı IP kovasını paylaşır (misafirler IP ile sınırlanır).
    expect(await report(g2, sixth)).toBe("report_limit");
    // Hesaplı bildirenin kovası ayrıdır.
    for (const t of guests.slice(0, 5)) expect(await report(host, t)).toBe("ack");
    expect(await report(host, sixth)).toBe("report_limit");

    k.clock.advance(HOUR + 1_000);
    expect(await report(g1, sixth)).toBe("ack");
    expect(await report(host, sixth)).toBe("ack");
    // Çift bildirim saat geçse de sürer (24 saat).
    expect(await report(g1, host)).toBe("report_duplicate");
    k.clock.advance(25 * HOUR);
    expect(await report(g1, host)).toBe("ack");
  });
});

// ---- Kanıt ------------------------------------------------------------------------------------------------------

const stageOf = (c: Client): string =>
  ((c.room.match?.publicView ?? { stage: "" }) as { stage: string }).stage;

async function startMatch(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
}

/** Kendim'i sonuç aşamasına kadar oynatır; `beforeReveal` kelimeler gizliyken çalışır. */
async function playKendim(cs: Client[], words: string[], beforeReveal: () => Promise<void>): Promise<void> {
  const host = cs[0] as Client;
  await startMatch(cs);
  for (const [i, x] of cs.entries()) expect(await act(x, { kind: "write", text: words[i] })).toBe(true);
  for (const x of cs) expect(await act(x, { kind: "lock" })).toBe(true);
  k.clock.advance(1_100);
  await until(() => stageOf(host) === "match", "eşleştirme");
  await beforeReveal();
  for (const x of cs) expect(await act(x, { kind: "lock" })).toBe(true);
  k.clock.advance(1_100);
  await until(() => stageOf(host) === "reveal", "sonuç açıldı");
  k.clock.advance(9_000);
  await until(() => host.room.phase === "results", "sonuç");
}

const lastReport = () => {
  const row = k.srv.accounts.reportPage(null, null, 1)[0];
  if (!row) throw new Error("bildirim yok");
  return row;
};

describe("Bildir: kanıt yalnız herkese açık metindir", () => {
  useServer({ ...serverOpts });

  it("kendim: açılıştan önce kanıt yok; sonuçta yalnız hedefin kendi kelimesi; ad sebebinde kanıt yok", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"], ["kendim"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    const words = ["elma", "armut", "kiraz", "üzüm"];
    await playKendim(cs, words, async () => {
      // Kelimeler yazıldı ama henüz kimse açmadı (kartlar sahipsiz): kanıt eklenmez, kelime sızmaz.
      expect(await report(c, b, "abuse")).toBe("ack");
      expect(lastReport()).toMatchObject({ targetName: "B", gameId: "kendim", evidence: null });
      expect(JSON.stringify(lastReport())).not.toMatch(/ARMUT|ELMA|KİRAZ|ÜZÜM/);
    });

    expect(await report(a, b, "abuse")).toBe("ack");
    expect(lastReport()).toMatchObject({
      targetName: "B",
      gameId: "kendim",
      evidence: { gameId: "kendim", texts: ["ARMUT"] },
    });
    // Başkasının kelimesi hiçbir yerde yok.
    expect(JSON.stringify(lastReport())).not.toMatch(/ELMA|KİRAZ|ÜZÜM/);
    expect(await report(a, d, "other", "kötü")).toBe("ack");
    expect(lastReport().evidence).toEqual({ gameId: "kendim", texts: ["ÜZÜM"] });
    // Ad sorunu oyun metniyle ilgisizdir: kanıt eklenmez.
    expect(await report(a, c, "name")).toBe("ack");
    expect(lastReport()).toMatchObject({ reason: "name", evidence: null, gameId: "kendim" });
    // Hile de metin değildir.
    expect(await report(b, c, "cheat")).toBe("ack");
    expect(lastReport().evidence).toBeNull();
  });

  it("sözlük blöfü: yalnız açılan sahte tanımlar; gerçek tanım ve yazmayanın kaydı yok", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"], ["sozluk-blofu"]);
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    const pub = (x: Client) =>
      x.room.match?.publicView as {
        phase: string;
        word: string;
        cards: { id: string; text: string }[] | null;
        reveal: unknown;
      };
    const priv = (x: Client) => x.room.match?.view as { myBluff: string | null; myCard: string | null };
    await startMatch(cs);
    const entry = SOZLUK_ENTRIES.find((e) => e.word === pub(a).word);
    const definition = entry?.definition ?? "yok";

    expect(await act(a, { kind: "bluff", text: "Eski bir kayık türü" })).toBe(true);
    expect(await act(b, { kind: "bluff", text: "dağda yaşayan bir kuş" })).toBe(true);
    expect(await act(c, { kind: "bluff", text: "kumaştan dikilen şapka" })).toBe(true);
    // Yazma aşamasında sahte tanımlar hâlâ gizli: bildirim kanıt taşımaz.
    expect(await report(d, a, "abuse")).toBe("ack");
    expect(lastReport().evidence).toBeNull();

    k.clock.advance(50_000);
    await until(() => pub(a).phase === "pick", "seçme");
    const cards = pub(a).cards ?? [];
    for (const x of cs) {
      const target = cards.find((card) => card.id !== priv(x).myCard);
      expect(await act(x, { kind: "pick", card: target?.id })).toBe(true);
    }
    k.clock.advance(30_000);
    await until(() => pub(a).reveal !== null, "açıldı");
    k.clock.advance(12_000);
    await until(() => a.room.phase === "results", "sonuç");

    expect(await report(c, a, "abuse")).toBe("ack");
    expect(lastReport().evidence).toEqual({ gameId: "sozluk-blofu", texts: [priv(a).myBluff ?? "?"] });
    expect(priv(a).myBluff).toBe("eski bir kayık türü");
    expect(await report(d, b, "other")).toBe("ack");
    expect(lastReport().evidence).toEqual({ gameId: "sozluk-blofu", texts: ["dağda yaşayan bir kuş"] });
    // Hiç yazmayan oyuncuda kanıt olmaz; gerçek tanım hiçbir kanıta girmez.
    expect(await report(a, d, "abuse")).toBe("ack");
    expect(lastReport()).toMatchObject({ targetName: "D", gameId: "sozluk-blofu", evidence: null });
    for (const r of k.srv.accounts.reportPage(null, null, 20)) {
      expect(JSON.stringify(r.evidence)).not.toContain(definition);
    }
  });

  it("kanıtı tanımsız oyun (butona-bas): oyun kimliği yazılır, metin eklenmez", async () => {
    const cs = await setupRoom(["A", "B", "C"], ["butona-bas"]);
    const [a, b] = cs as [Client, Client, Client];
    await startPlaying(cs);
    expect(await report(b, a, "abuse")).toBe("ack");
    expect(lastReport()).toMatchObject({
      gameId: "butona-bas",
      evidence: null,
      roomCode: a.session.roomCode,
    });
  });
});

// ---- Yönetici: kuyruk ------------------------------------------------------------------------------------------

const GETS = [
  "reports",
  "reports/detail?id=1",
  "rooms/players?code=ABCDE",
  "banned-words",
  "banned-words/accounts",
];
const POSTS: [string, unknown][] = [
  ["reports/status", { id: 1, status: "reviewed", note: "" }],
  ["rooms/close", { code: "ABCDE" }],
  ["rooms/kick", { code: "ABCDE", playerId: "0123456789ab" }],
  ["banned-words/add", { word: "deneme" }],
  ["banned-words/remove", { word: "deneme" }],
];
const MODERATION_AUDIT = /^(report_status|room_close|room_kick|room_view|banned_word_)/;

describe("A4 uçları: erişim denetimi", () => {
  useServer({ ...serverOpts });

  it("oturum yoksa 401; yönetici olmayan 404; yönetici çerezi yoksa 403", async () => {
    const sess = loginCookie("yonetici_1");
    const other = loginCookie("oyuncu_2");
    for (const p of GETS) {
      expect((await get(p, null)).status, p).toBe(401);
      expect((await get(p, other)).status, p).toBe(404);
      const r = await get(p, sess);
      expect(r.status, p).toBe(403);
      expect(r.body.code).toBe("otp_required");
    }
    for (const [p, body] of POSTS) {
      expect((await post(p, null, body)).status, p).toBe(401);
      expect((await post(p, other, body)).status, p).toBe(404);
      expect((await post(p, sess, body)).status, p).toBe(403);
    }
    expect(k.srv.accounts.adminAuditTail(50).some((r) => MODERATION_AUDIT.test(r.action))).toBe(false);
  });

  it("POST'larda Origin zorunlu; yöntem uyuşmazlığı 405; yönetici çerezi başka oturumda geçersiz", async () => {
    const cookie = await adminLogin();
    for (const [p, body] of POSTS) {
      expect((await call("POST", p, cookie, { body, origin: null })).status, p).toBe(403);
      expect((await call("POST", p, cookie, { body, origin: "https://evil.example" })).status, p).toBe(403);
      expect((await get(p, cookie)).status, p).toBe(405);
    }
    for (const p of GETS) expect((await post(p.split("?")[0] ?? p, cookie, {})).status, p).toBe(405);
    const stolen = `${loginCookie("oyuncu_2")}; ${cookie.split("; ")[1]}`;
    for (const p of GETS) expect((await get(p, stolen)).status, p).toBe(404);
    expect(k.srv.accounts.adminAuditTail(50).some((r) => MODERATION_AUDIT.test(r.action))).toBe(false);
  });

  it("değiştiren işlemler yönetici başına hız sınırına bağlıdır", async () => {
    const cookie = await adminLogin();
    let limited = 0;
    for (let i = 0; i < 14; i++) {
      const r = await post("banned-words/remove", cookie, { word: "yok" });
      if (r.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });

  it("gövde doğrulaması", () => {
    expect(parseRoomCode("abcde")).toBe("ABCDE");
    for (const bad of ["abcd", "abcdef", "ab-de", 5, null]) expect(parseRoomCode(bad)).toBeNull();
    expect(parseModeration("reports/status", { id: 3, status: "rejected", note: " yok " })).toEqual({
      op: "reports/status",
      id: 3,
      status: "rejected",
      note: "yok",
    });
    for (const bad of [
      null,
      [],
      {},
      { id: 0, status: "reviewed", note: "" },
      { id: 1, status: "bilinmeyen", note: "" },
      { id: 1, status: "reviewed" },
      { id: 1, status: "reviewed", note: "x".repeat(301) },
      { id: 1, status: "reviewed", note: "a\u0000b" },
      { id: 1, status: "reviewed", note: "", ekstra: 1 },
    ])
      expect(parseModeration("reports/status", bad), JSON.stringify(bad)).toBeNull();
    expect(parseModeration("rooms/kick", { code: "ABCDE", playerId: "0123456789ab" })).not.toBeNull();
    for (const bad of [{ code: "ABCDE", playerId: "x" }, { code: "ABCDE" }, { playerId: "0123456789ab" }])
      expect(parseModeration("rooms/kick", bad)).toBeNull();
    expect(parseModeration("banned-words/add", { word: 5 })).toBeNull();
    expect(parseModeration("rooms/close", { code: "ABCDE", x: 1 })).toBeNull();
  });
});

describe("A4: bildirim kuyruğu ve durum değişikliği", () => {
  useServer({ ...serverOpts });

  it("liste, durum süzgeci, ayrıntı (kanıt dahil), durum değişikliği ve işlem kaydı", async () => {
    const cookie = await adminLogin(); // hesap 1 = yönetici
    const cs = await setupRoom(["A", "B", "C", "D"], ["kendim"]);
    const [a, b, c] = cs as [Client, Client, Client, Client];
    await playKendim(cs, ["elma", "armut", "kiraz", "üzüm"], async () => undefined);
    expect(await report(a, b, "abuse", "uygunsuz")).toBe("ack"); // hesaplı hedef değil: B misafir
    expect(await report(b, a, "name")).toBe("ack"); // hesaplı hedef (A)
    expect(await report(c, b, "cheat")).toBe("ack");

    const list = await get<AdminReportPage>("reports", cookie);
    expect(list.status).toBe(200);
    expect(list.body.reports.map((r) => r.targetName)).toEqual(["B", "A", "B"]); // yeniden eskiye
    expect(list.body.counts).toEqual({ new: 3, reviewed: 0, actioned: 0, rejected: 0 });
    expect(list.body.nextBefore).toBeNull();
    const first = list.body.reports[2];
    expect(first).toMatchObject({
      reason: "abuse",
      roomCode: a.session.roomCode,
      gameId: "kendim",
      status: "new",
    });
    // Listede not ve kanıt yok (yalnız ayrıntıda).
    expect(JSON.stringify(list.body)).not.toContain("uygunsuz");
    expect(JSON.stringify(list.body)).not.toContain("ARMUT");

    // Sayfalama ve geçersiz sorgu.
    const page = await get<AdminReportPage>("reports?limit=2", cookie);
    expect(page.body.reports).toHaveLength(2);
    expect(page.body.nextBefore).toBe(page.body.reports[1]?.id);
    const next = await get<AdminReportPage>(`reports?limit=2&before=${page.body.nextBefore}`, cookie);
    expect(next.body.reports).toHaveLength(1);
    for (const q of ["status=olmayan", "before=abc", "limit=0", "limit=x"])
      expect((await get(`reports?${q}`, cookie)).status, q).toBe(400);

    const id = first?.id ?? 0;
    const detail = await get<AdminReportDetail>(`reports/detail?id=${id}`, cookie);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      id,
      note: "uygunsuz",
      reporterAccountId: accountId("A"),
      targetAccountId: null,
      evidence: { gameId: "kendim", texts: ["ARMUT"] },
      targetPlayerId: idOf(b),
      inRoom: true,
      targetProtected: false,
      adminNote: "",
      reviewedAt: null,
    });
    expect((await get("reports/detail?id=9999", cookie)).status).toBe(404);
    expect((await get("reports/detail?id=abc", cookie)).status).toBe(400);

    // Durum değişikliği: not saklanır, işlem kaydı yalnız "kimlik:durum" taşır (not yok).
    k.clock.advance(5_000);
    const set = await post("reports/status", cookie, { id, status: "reviewed", note: "Gözden geçirdim" });
    expect(set.status).toBe(200);
    const after = await get<AdminReportDetail>(`reports/detail?id=${id}`, cookie);
    expect(after.body).toMatchObject({
      status: "reviewed",
      adminNote: "Gözden geçirdim",
      reviewedAt: k.clock.now(),
    });
    const reviewed = await get<AdminReportPage>("reports?status=reviewed", cookie);
    expect(reviewed.body.reports.map((r) => r.id)).toEqual([id]);
    expect(reviewed.body.counts).toEqual({ new: 2, reviewed: 1, actioned: 0, rejected: 0 });
    expect((await get<AdminReportPage>("reports?status=new", cookie)).body.reports).toHaveLength(2);

    expect((await post("reports/status", cookie, { id, status: "actioned", note: "" })).status).toBe(200);
    expect((await post("reports/status", cookie, { id, status: "rejected", note: "" })).status).toBe(200);
    expect((await post("reports/status", cookie, { id: 9999, status: "reviewed", note: "" })).status).toBe(
      404,
    );
    expect((await post("reports/status", cookie, { id, status: "ne", note: "" })).status).toBe(400);
    const log = k.srv.accounts.adminAuditTail(20).filter((r) => r.action === "report_status");
    expect(log.map((r) => r.detail).reverse()).toEqual([
      `${id}:reviewed`,
      `${id}:actioned`,
      `${id}:rejected`,
    ]);
    expect(JSON.stringify(log)).not.toContain("Gözden");
    // Hesaplı hedefin kimliği işlem kaydında hedef olarak durur.
    const targetsAccount = list.body.reports[1]?.id ?? 0;
    await post("reports/status", cookie, { id: targetsAccount, status: "reviewed", note: "" });
    expect(k.srv.accounts.adminAuditTail(1)[0]?.targetId).toBe(accountId("A"));

    // Hedef odadan çıkınca "odada" bilgisi düşer.
    b.send({ type: "leaveRoom" });
    await until(() => b.of("left").length > 0, "ayrıldı");
    expect((await get<AdminReportDetail>(`reports/detail?id=${id}`, cookie)).body.inRoom).toBe(false);
  });

  it("bildirimler 180 gün sonra silinir; hesap silinince hesap bağı kopar, ad kalır", async () => {
    const host = await create("Sahibi");
    const g = await join(host.session.roomCode, "Misafir");
    expect(await report(g, host)).toBe("ack");
    const rowId = lastReport().id;
    const store = k.srv.accounts;
    const old = store.reportInsert({
      reporterAccountId: null,
      targetAccountId: null,
      targetName: "Eski",
      targetPlayerId: "0123456789ab",
      roomCode: "ZZZZZ",
      gameId: null,
      reason: "other",
      note: "",
      evidence: null,
      createdAt: k.clock.now() - REPORT_RETENTION_MS - 1_000,
    });
    const edge = store.reportInsert({
      reporterAccountId: null,
      targetAccountId: null,
      targetName: "Sınırda",
      targetPlayerId: "0123456789ab",
      roomCode: "ZZZZZ",
      gameId: null,
      reason: "other",
      note: "",
      evidence: null,
      createdAt: k.clock.now() - REPORT_RETENTION_MS + 60_000,
    });
    store.purge(k.clock.now());
    expect(store.reportGet(old)).toBeNull();
    expect(store.reportGet(edge)).not.toBeNull();
    expect(store.reportGet(rowId)).not.toBeNull();

    expect(store.deleteAccount(accountId("Sahibi"))).toBe(true);
    expect(store.reportGet(rowId)).toMatchObject({ targetAccountId: null, targetName: "Sahibi" });
    // Bildiren hesap silinince de bağ kopar.
    const host2 = await WsClient.connect(loginCookie("Ikinci"));
    host2.send({ type: "joinRoom", code: host.session.roomCode, nickname: "Ikinci" });
    await until(() => host2.updates.length > 0, "ikinci girdi");
    expect(await report(host2, g)).toBe("ack");
    const mine = lastReport().id;
    expect(store.reportGet(mine)?.reporterAccountId).toBe(accountId("Ikinci"));
    store.deleteAccount(accountId("Ikinci"));
    expect(store.reportGet(mine)?.reporterAccountId).toBeNull();
  });
});

// ---- Yönetici: oda işlemleri -------------------------------------------------------------------------------------

describe("A4: odayı kapatma ve oyuncu atma", () => {
  useServer({ ...serverOpts });

  it("odayı kapat: herkese ve TV'ye 'adminClosed'; süren maç hesap istatistiği yazmadan biter", async () => {
    const cookie = await adminLogin();
    const cs = await setupRoom(["Sahibi", "Ali", "Veli"], ["butona-bas"]);
    const [host] = cs as [Client, Client, Client];
    const code = host.session.roomCode;
    const tv = await WsClient.connect();
    tv.send({ type: "joinStage", code });
    await until(() => tv.of("stage").length > 0, "sahne");
    await startPlaying(cs);
    const stats = k.srv.accounts.adminAccountDetail(accountId("Sahibi"), k.clock.now());
    expect(stats?.matches).toBe(0);

    const other = await create("BaskaOda");
    expect((await post("rooms/close", cookie, { code: "ZZZZZ" })).status).toBe(404);
    expect((await post("rooms/close", cookie, { code: "abc" })).status).toBe(400);
    const closed = await post("rooms/close", cookie, { code });
    expect(closed.status).toBe(200);
    await until(() => [...cs, tv].every((c) => c.of("left").length > 0), "hepsine bildirildi");
    for (const c of [...cs, tv]) expect(c.of("left").map((m) => m.reason)).toEqual(["adminClosed"]);
    // Oda yok; yeni katılım "bulunamadı"; başka oda etkilenmedi.
    const late = await join(code, "Gec");
    expect(late.of("error").at(-1)?.code).toBe("room_not_found");
    expect(other.of("left")).toHaveLength(0);
    expect(other.room.code).not.toBe(code);
    const live = await get<{ rooms: number; activeMatches: number }>("live", cookie);
    expect(live.body.rooms).toBe(1);
    expect(live.body.activeMatches).toBe(0);
    // Hesap istatistiği yazılmadı.
    await sync();
    expect(k.srv.accounts.adminAccountDetail(accountId("Sahibi"), k.clock.now())?.matches).toBe(0);
    expect(k.srv.accounts.adminAccountDetail(accountId("Sahibi"), k.clock.now())?.games).toBe(0);
    const audit = k.srv.accounts.adminAuditTail(5).find((r) => r.action === "room_close");
    expect(audit?.detail).toBe(code);
    expect(audit?.accountId).toBe(1);
    // Onay metni için Türkçe ileti istemci tarafında; sunucu yalnız sebebi yollar.
    expect(host.of("error").filter((e) => e.code === "game_failed")).toHaveLength(0);
  });

  it("oyuncu listesi yalnız tek odada ve 'room_view' kaydıyla; canlı tabloda ad yok", async () => {
    const cookie = await adminLogin();
    const host = await create("Sahibi");
    const g = await join(host.session.roomCode, "Misafir");
    const code = host.session.roomCode;

    const live = await get("live", cookie);
    expect(JSON.stringify(live.body)).not.toMatch(/Sahibi|Misafir/);

    expect((await get("rooms/players?code=abc", cookie)).status).toBe(400);
    expect((await get("rooms/players?code=ZZZZZ", cookie)).status).toBe(404);
    expect(k.srv.accounts.adminAuditTail(5).some((r) => r.action === "room_view")).toBe(false);

    const r = await get<AdminRoomPlayers>(`rooms/players?code=${code}`, cookie);
    expect(r.status).toBe(200);
    expect(r.body.code).toBe(code);
    expect(r.body.phase).toBe("lobby");
    expect(r.body.players.map((p) => p.nickname)).toEqual(["Sahibi", "Misafir"]);
    expect(r.body.players.map((p) => p.host)).toEqual([true, false]);
    expect(r.body.players.map((p) => p.account)).toEqual([true, false]);
    expect(r.body.players[1]?.id).toBe(idOf(g));
    expect(k.srv.accounts.adminAuditTail(5).filter((x) => x.action === "room_view")).toHaveLength(1);
    // Yanıtta hesap kimliği ya da IP yok.
    expect(JSON.stringify(r.body)).not.toMatch(/accountId|127\.0\.0\.1/);
  });

  it("oyuncuyu at: 'removed', 10 dakika aynı odaya giremez (hesaplı), başka oda ve başka hesap serbest", async () => {
    const cookie = await adminLogin();
    const host = await create("Sahibi");
    const code = host.session.roomCode;
    const victimCookie = loginCookie("Kurban");
    const victim = await WsClient.connect(victimCookie);
    victim.send({ type: "joinRoom", code, nickname: "Kurban" });
    await until(() => victim.updates.length > 0, "katıldı");
    const bystander = await join(code, "Seyirci");

    expect((await post("rooms/kick", cookie, { code, playerId: "ffffffffffff" })).status).toBe(404);
    expect((await post("rooms/kick", cookie, { code: "ZZZZZ", playerId: idOf(victim) })).status).toBe(404);
    expect((await post("rooms/kick", cookie, { code, playerId: "x" })).status).toBe(400);

    const done = await post("rooms/kick", cookie, { code, playerId: idOf(victim) });
    expect(done.status).toBe(200);
    await until(() => victim.of("left").length > 0, "atıldı");
    expect(victim.of("left").map((m) => m.reason)).toEqual(["removed"]);
    await until(() => !host.room.players.some((p) => p.nickname === "Kurban"), "listeden düştü");
    expect(bystander.of("left")).toHaveLength(0);
    expect(k.srv.accounts.adminAuditTail(5).find((r) => r.action === "room_kick")?.detail).toBe(code);

    // Aynı hesap (başka bağlantıdan da) 10 dakika giremez.
    const retry = await WsClient.connect(victimCookie);
    retry.send({ type: "joinRoom", code, nickname: "Kurban" });
    await until(() => retry.of("error").length > 0, "engel");
    expect(retry.lastError).toMatchObject({
      code: "room_blocked",
      message: "Odadan çıkarıldın, bu odaya şimdilik giremezsin.",
    });
    expect(retry.updates).toHaveLength(0);
    // Atılan, belirteciyle de dönemez.
    const resumed = await WsClient.connect(victimCookie);
    resumed.send({ type: "resume", token: victim.session.token });
    await until(() => resumed.of("error").length > 0, "devam");
    expect(resumed.lastError?.code).toBe("resume_failed");

    // Başka hesap aynı odaya girebilir; atılan başka bir odaya girebilir.
    const friend = await WsClient.connect(loginCookie("Dost"));
    friend.send({ type: "joinRoom", code, nickname: "Dost" });
    await until(() => friend.updates.length > 0, "dost girdi");
    const otherRoom = await create("BaskaOda");
    const elsewhere = await WsClient.connect(victimCookie);
    elsewhere.send({ type: "joinRoom", code: otherRoom.session.roomCode, nickname: "Kurban" });
    await until(() => elsewhere.updates.length > 0, "başka oda");

    // 10 dakika sonra aynı odaya girebilir.
    elsewhere.send({ type: "leaveRoom" });
    await until(() => elsewhere.of("left").length > 0, "çıktı");
    k.clock.advance(ROOM_KICK_BLOCK_MS - 60_000);
    const early = await WsClient.connect(victimCookie);
    early.send({ type: "joinRoom", code, nickname: "Kurban" });
    await until(() => early.of("error").length > 0, "hâlâ engelli");
    expect(early.lastError?.code).toBe("room_blocked");
    k.clock.advance(61_000);
    const again = await WsClient.connect(victimCookie);
    again.send({ type: "joinRoom", code, nickname: "Kurban" });
    await until(() => again.updates.length > 0, "engel kalktı");
    expect(again.room.players.some((p) => p.nickname === "Kurban")).toBe(true);
  });

  it("misafir atılırsa aynı bağlantı adresinden 10 dakika giremez", async () => {
    const cookie = await adminLogin();
    const host = await create("Sahibi");
    const code = host.session.roomCode;
    const guest = await join(code, "Misafir");
    const done = await post("rooms/kick", cookie, { code, playerId: idOf(guest) });
    expect(done.status).toBe(200);
    await until(() => guest.of("left").length > 0, "atıldı");
    const retry = await join(code, "Misafir");
    expect(retry.of("error").at(-1)?.code).toBe("room_blocked");
    // Hesaplı oyuncu aynı adresten girebilir (engel misafir içindir).
    const account = await WsClient.connect(loginCookie("Hesapli"));
    account.send({ type: "joinRoom", code, nickname: "Hesapli" });
    await until(() => account.updates.length > 0, "hesaplı girdi");
    k.clock.advance(ROOM_KICK_BLOCK_MS + 1_000);
    const later = await join(code, "Misafir");
    expect(later.updates.length).toBeGreaterThan(0);
  });
});

// ---- Yasaklı kelimeler ------------------------------------------------------------------------------------------

async function auth(
  path: string,
  body: unknown,
  cookie?: string,
): Promise<{ status: number; body: { message?: string; field?: string; code?: string }; cookie: string }> {
  const res = await fetch(`${base()}/api/auth/${path}`, {
    method: "POST",
    headers: { Origin: base(), "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    body: (await res.json()) as { message?: string; field?: string; code?: string },
    cookie: (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "",
  };
}

describe("A4: yasaklı kelime listesi", () => {
  useServer({ ...serverOpts });

  it("ekle / sil / sınırlar; başlangıçta boş; işlem kaydı", async () => {
    const cookie = await adminLogin();
    const empty = await get<AdminBannedWords>("banned-words", cookie);
    expect(empty.body).toMatchObject({ words: [], max: 500 });

    const added = await post("banned-words/add", cookie, { word: "  Siktir " });
    expect(added.status).toBe(200);
    const list = await get<AdminBannedWords>("banned-words", cookie);
    expect(list.body.words.map((w) => w.word)).toEqual(["Siktir"]);
    // Aynı kelimenin normalleşmiş hâli zaten var.
    const dup = await post("banned-words/add", cookie, { word: "s1kt1r" });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe("exists");
    for (const bad of ["", "a", "x".repeat(41), "---", "a\u0000bc", 5])
      expect((await post("banned-words/add", cookie, { word: bad })).status, String(bad)).toBe(400);

    const removed = await post("banned-words/remove", cookie, { word: "SIKTIR" }); // yazım biçimi önemsiz
    expect(removed.status).toBe(200);
    expect((await get<AdminBannedWords>("banned-words", cookie)).body.words).toEqual([]);
    expect((await post("banned-words/remove", cookie, { word: "siktir" })).status).toBe(404);
    const log = k.srv.accounts.adminAuditTail(10).filter((r) => r.action.startsWith("banned_word_"));
    expect(log.map((r) => r.action).reverse()).toEqual(["banned_word_add", "banned_word_remove"]);
    // Liste yeniden başlatmada da kalır (veritabanında).
    expect(k.srv.accounts.bannedWordsList()).toHaveLength(0);
  });

  it("en çok 500 kelime", async () => {
    const cookie = await adminLogin();
    for (let i = 0; i < 500; i++) {
      const word = `kelime${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + (Math.floor(i / 26) % 26))}${String.fromCharCode(97 + Math.floor(i / 676))}x`;
      expect(k.srv.bannedWords.add(word, k.clock.now()), word).toBe("ok");
    }
    const full = await post("banned-words/add", cookie, { word: "bir fazla" });
    expect(full.status).toBe(409);
    expect(full.body.code).toBe("full");
    expect(k.srv.bannedWords.list()).toHaveLength(500);
    // Dolu listede var olan kelime "dolu" değil "zaten var" der.
    expect((await post("banned-words/add", cookie, { word: "kelimeaaax" })).body.code).toBe("exists");
    // Silince yer açılır.
    expect((await post("banned-words/remove", cookie, { word: "kelimeaaax" })).status).toBe(200);
    expect((await post("banned-words/add", cookie, { word: "bir fazla" })).status).toBe(200);
  });

  it("kayıt, kullanıcı adı değiştirme ve misafir takma adı engellenir; yönetici adı değiştirmesi muaf", async () => {
    const cookie = await adminLogin();
    for (const w of ["orospu", "amk"])
      expect((await post("banned-words/add", cookie, { word: w })).status).toBe(200);
    refill();

    // Kayıt.
    const reg = (username: string) =>
      auth("register", { username, email: `${username.toLowerCase()}@test.local`, password: "sifre12345" });
    for (const bad of ["Orospu_1", "0r0spu", "ali_AMK", "o_r_o_s_p_u"]) {
      const r = await reg(bad);
      expect(r.status, bad).toBe(400);
      expect(r.body).toMatchObject({ message: "Bu ad kullanılamaz.", field: "username" });
    }
    expect(k.srv.accounts.findByUsername("Orospu_1")).toBeNull();
    const ok = await reg("Ahmet_1");
    expect(ok.status).toBe(200);
    expect((await reg("Kamkum")).status).toBe(200); // "amk" başka sözcüğün içinde

    // Kullanıcı adı değiştirme.
    const rename = (name: string) => auth("username", { username: name }, ok.cookie);
    const bad = await rename("0r0spu99");
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ message: "Bu ad kullanılamaz.", field: "username" });
    expect((await rename("Temiz_ad")).status).toBe(200);
    expect(k.srv.accounts.findByUsername("Temiz_ad")).not.toBeNull();

    // Misafir takma adı: katılma ve yeniden adlandırma.
    const host = await create("Sahibi");
    const code = host.session.roomCode;
    const g = await WsClient.connect();
    g.send({ type: "joinRoom", code, nickname: "0r0spu" });
    await until(() => g.of("error").length > 0, "ad reddi");
    expect(g.lastError).toMatchObject({ code: "nickname_invalid", message: "Bu ad kullanılamaz." });
    expect(g.updates).toHaveLength(0);
    g.send({ type: "joinRoom", code, nickname: "a . m . k" });
    await until(() => g.of("error").length > 1, "ad reddi 2");
    g.send({ type: "joinRoom", code, nickname: "Temiz" });
    await until(() => g.updates.length > 0, "temiz ad girdi");
    g.send({ type: "rename", nickname: "Ali amk" });
    await until(() => g.of("error").length > 2, "yeniden ad reddi");
    expect(g.lastError).toMatchObject({ code: "nickname_invalid", message: "Bu ad kullanılamaz." });
    expect(host.room.players.map((p) => p.nickname)).toEqual(["Sahibi", "Temiz"]);
    g.send({ type: "rename", nickname: "Yeni Ad" });
    await until(() => host.room.players.some((p) => p.nickname === "Yeni Ad"), "yeni ad");

    // Yönetici adı değiştirme muaftır; mevcut adlar kendiliğinden değişmez, yardımcı sorgu bulur.
    const target = k.srv.accounts.findByUsername("Kamkum");
    expect(target).not.toBeNull();
    const forced = await post("accounts/rename", cookie, { id: target?.id, username: "Orospu_77" });
    expect(forced.status).toBe(200);
    expect(k.srv.accounts.findByUsername("Orospu_77")).not.toBeNull();
    const helper = await get<AdminBannedAccounts>("banned-words/accounts", cookie);
    expect(helper.status).toBe(200);
    expect(helper.body.accounts.map((a) => a.username)).toEqual(["Orospu_77"]);
    expect(helper.body.truncated).toBe(false);
    // Listeden çıkarılınca yardımcı boşalır; hiçbir ad değişmedi.
    await post("banned-words/remove", cookie, { word: "orospu" });
    expect((await get<AdminBannedAccounts>("banned-words/accounts", cookie)).body.accounts).toEqual([]);
    expect(k.srv.accounts.findByUsername("Orospu_77")).not.toBeNull();
  });

  it("oyun metni engellenmez ve maskelenmez (yalnız adlar denetlenir)", async () => {
    const cookie = await adminLogin();
    expect((await post("banned-words/add", cookie, { word: "armut" })).status).toBe(200);
    const cs = await setupRoom(["A", "B", "C", "D"], ["kendim"]);
    await startMatch(cs);
    expect(await act(cs[1] as Client, { kind: "write", text: "armut" })).toBe(true);
    await sync();
    expect((cs[1] as Client).room.match?.view).toMatchObject({ myText: "ARMUT" });
  });
});
