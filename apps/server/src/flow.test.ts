import { describe, expect, it } from "vitest";
import {
  Client,
  create,
  join,
  k,
  press,
  setupRoom,
  sleep,
  startPlaying,
  sync,
  until,
  useServer,
} from "./testkit.js";

useServer();

describe("oda kurma ve katılma", () => {
  it("oda kurar: oturum, host, avatar, katalog", async () => {
    const a = await create("Ayşe");
    const s = a.session;
    expect(s.roomCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    expect(s.token.length).toBeGreaterThanOrEqual(32);
    const room = a.room;
    expect(room).toMatchObject({ code: s.roomCode, hostId: s.playerId, selfId: s.playerId, phase: "lobby" });
    expect(room.players).toEqual([
      { id: s.playerId, nickname: "Ayşe", avatar: 0, connected: true, score: 0 },
    ]);
    expect(room.catalog.map((g) => g.id)).toContain("butona-bas");
    expect(room.gameIds).toContain("butona-bas");
    expect(room.match).toBeNull();
  });

  it("katılana düşük boş avatar verilir, herkes güncellemeyi alır", async () => {
    const [a, b] = await setupRoom(["Ayşe", "Mehmet"]);
    expect(b?.room.selfId).toBe(b?.session.playerId);
    expect(a?.room.players.map((p) => p.avatar)).toEqual([0, 1]);
    expect(a?.room.players).toHaveLength(2);
    expect(b?.room.hostId).toBe(a?.session.playerId);
  });

  it("aynı takma adı numaralandırır", async () => {
    const cs = await setupRoom(["Ali", "ali", "Ali", "  Ali  "]);
    expect(cs[0]?.room.players.map((p) => p.nickname)).toEqual(["Ali", "ali 2", "Ali 3", "Ali 4"]);
  });

  it("numaralı takma ad 16 karakteri aşmaz", async () => {
    const long = "a".repeat(16);
    const cs = await setupRoom([long, long]);
    const names = cs[0]?.room.players.map((p) => p.nickname) ?? [];
    expect(names[1]).toBe(`${"a".repeat(14)} 2`);
    expect(names[1]?.length).toBeLessThanOrEqual(16);
  });

  it("olmayan oda ve kod biçimi", async () => {
    const c = await Client.connect();
    c.send({ type: "joinRoom", code: "ZZZZZ", nickname: "x" });
    await until(() => c.of("error").length > 0);
    expect(c.lastError).toMatchObject({ code: "room_not_found", message: "Bu kodla bir oda bulunamadı." });
    c.send({ type: "joinRoom", code: "zz", nickname: "x" });
    await until(() => c.of("error").length > 1);
    expect(c.lastError?.code).toBe("invalid_message");
  });

  it("küçük harfli kod kabul edilir", async () => {
    const a = await create("A");
    const b = await join(a.session.roomCode.toLowerCase(), "B");
    expect(b.room.players).toHaveLength(2);
  });

  it("oda 8 kişide dolar", async () => {
    const cs = await setupRoom(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(cs[0]?.room.players.map((p) => p.avatar)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const late = await join(cs[0]?.session.roomCode ?? "", "9");
    expect(late.lastError?.code).toBe("room_full");
  });

  it("zaten odadayken tekrar kurma/katılma reddedilir", async () => {
    const a = await create("A");
    a.send({ type: "createRoom", nickname: "A" });
    await until(() => a.of("error").length > 0);
    expect(a.lastError?.code).toBe("already_in_room");
  });

  it("odada olmayan oyuncu oda komutu veremez", async () => {
    const c = await Client.connect();
    for (const type of ["startMatch", "ready", "leaveRoom", "returnToLobby"]) c.send({ type });
    await until(() => c.of("error").length >= 4);
    expect(c.of("error").every((e) => e.code === "not_in_room")).toBe(true);
  });

  it("/health oda ve oyuncu sayısını bildirir; boş oda 120 sn sonra silinir", async () => {
    const cs = await setupRoom(["A", "B"]);
    const health = async () => (await (await fetch(`http://127.0.0.1:${k.srv.port}/health`)).json()) as never;
    expect(await health()).toMatchObject({ rooms: 1, players: 2 });
    cs[0]?.send({ type: "leaveRoom" });
    cs[1]?.send({ type: "leaveRoom" });
    await sync();
    expect(await health()).toMatchObject({ rooms: 1, players: 0 });
    k.clock.advance(119_000);
    expect(await health()).toMatchObject({ rooms: 1 });
    k.clock.advance(2_000);
    expect(await health()).toMatchObject({ rooms: 0, players: 0 });
  });
});

describe("host, kick, ayrılma", () => {
  it("yalnız host kick eder; atılan left{kicked} alır ve odadan ayrılır", async () => {
    const [a, b, c] = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    b.send({ type: "kick", playerId: c.session.playerId });
    await until(() => b.of("error").length > 0);
    expect(b.lastError?.code).toBe("not_host");

    a.send({ type: "kick", playerId: c.session.playerId });
    await until(() => c.of("left").length > 0);
    expect(c.of("left")[0]).toEqual({ type: "left", reason: "kicked" });
    await until(() => a.room.players.length === 2);
    expect(c.ws.readyState).toBe(WebSocket.OPEN);
    c.send({ type: "ready" });
    await until(() => c.of("error").length > 0);
    expect(c.lastError?.code).toBe("not_in_room");
    // Atılanın belirteci artık geçersiz.
    const d = await Client.connect();
    d.send({ type: "resume", token: c.session.token });
    await until(() => d.of("error").length > 0);
    expect(d.lastError?.code).toBe("resume_failed");
  });

  it("kendini atamaz, olmayanı atamaz", async () => {
    const [a] = (await setupRoom(["A", "B"])) as [Client, Client];
    a.send({ type: "kick", playerId: a.session.playerId });
    a.send({ type: "kick", playerId: "yok" });
    await until(() => a.of("error").length >= 2);
    expect(a.of("error").map((e) => e.code)).toEqual(["not_in_room", "not_in_room"]);
  });

  it("host ayrılınca en eski bağlı oyuncu host olur", async () => {
    const [a, b, c] = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    a.send({ type: "leaveRoom" });
    await until(() => a.of("left").length > 0);
    await until(() => b.room.hostId === b.session.playerId);
    expect(c.room.hostId).toBe(b.session.playerId);
    expect(b.room.players.map((p) => p.nickname)).toEqual(["B", "C"]);
  });

  it("host kopunca 20 sn beklenir; dönerse host kalır", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    a.ws.terminate();
    await until(() => b.room.players[0]?.connected === false);
    k.clock.advance(19_000);
    await sync();
    expect(b.room.hostId).toBe(a.session.playerId);
    const a2 = await Client.connect();
    a2.send({ type: "resume", token: a.session.token });
    await until(() => a2.updates.length > 0);
    k.clock.advance(30_000);
    await sync();
    expect(a2.room.hostId).toBe(a.session.playerId);
    expect(b.room.hostId).toBe(a.session.playerId);
  });

  it("host 20 sn dönmezse en eski bağlı oyuncuya geçer; eski host geri almaz", async () => {
    const [a, b, c] = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    b.ws.terminate();
    await until(() => c.room.players.find((p) => p.nickname === "B")?.connected === false);
    a.ws.terminate();
    await until(() => c.room.players.find((p) => p.nickname === "A")?.connected === false);
    expect(c.room.hostId).toBe(a.session.playerId);
    k.clock.advance(20_000);
    await until(() => c.room.hostId === c.session.playerId);
    const a2 = await Client.connect();
    a2.send({ type: "resume", token: a.session.token });
    await until(() => a2.updates.length > 0);
    await sync();
    expect(a2.room.hostId).toBe(c.session.playerId);
    expect(a2.room.selfId).toBe(a.session.playerId);
  });

  it("host leaveRoom yapınca devir hemen olur ve bekleyen zamanlayıcı kalmaz", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    a.send({ type: "leaveRoom" });
    await until(() => b.room.hostId === b.session.playerId);
    expect(b.room.players).toHaveLength(1);
  });

  it("host olmayan setGames/startMatch yapamaz", async () => {
    const [, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    b.send({ type: "setGames", gameIds: ["butona-bas"] });
    b.send({ type: "startMatch" });
    await until(() => b.of("error").length >= 2);
    expect(b.of("error").map((e) => e.code)).toEqual(["not_host", "not_host"]);
  });

  it("setGames kayıt defterine karşı doğrulanır", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    a.send({ type: "setGames", gameIds: ["yok-oyun"] });
    await until(() => a.of("error").length > 0);
    expect(a.lastError?.code).toBe("invalid_games");
    a.send({ type: "setGames", gameIds: ["butona-bas"] });
    await until(() => b.room.gameIds.length === 1, "oyun seçimi");
    expect(b.room.gameIds).toEqual(["butona-bas"]);
  });
});

describe("yeniden bağlanma", () => {
  it("kopan oyuncu belirteçle döner, eski soket 4001 ile kapanır", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    const b2 = await Client.connect();
    b2.send({ type: "resume", token: b.session.token });
    await until(() => b2.of("session").length > 0);
    expect(b2.session).toMatchObject({ playerId: b.session.playerId, roomCode: b.session.roomCode });
    await until(() => b.closeCode !== null);
    expect(b.closeCode).toBe(4001);
    await until(() => b2.updates.length > 0);
    expect(b2.room.selfId).toBe(b.session.playerId);
    // Eski soketin kapanması oyuncuyu koparmış saymaz.
    await sync();
    expect(a.room.players.find((p) => p.id === b.session.playerId)?.connected).toBe(true);
  });

  it("bağlantı kopup 120 sn içinde dönen oyuncu yerine oturur", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    b.ws.terminate();
    await until(() => a.room.players[1]?.connected === false);
    k.clock.advance(119_000);
    const b2 = await Client.connect();
    b2.send({ type: "resume", token: b.session.token });
    await until(() => b2.updates.length > 0);
    await until(() => a.room.players[1]?.connected === true);
    // Zamanlayıcı iptal edildi: süre dolsa da çıkarılmaz.
    k.clock.advance(10_000);
    await sync();
    expect(a.room.players).toHaveLength(2);
  });

  it("120 sn dönmeyen oyuncu çıkarılır; belirteci geçersizleşir", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    b.ws.terminate();
    await until(() => a.room.players[1]?.connected === false);
    k.clock.advance(121_000);
    await until(() => a.room.players.length === 1);
    const b2 = await Client.connect();
    b2.send({ type: "resume", token: b.session.token });
    await until(() => b2.of("error").length > 0);
    expect(b2.lastError).toMatchObject({ code: "resume_failed" });
  });

  it("bilinmeyen belirteç resume_failed verir", async () => {
    const c = await Client.connect();
    c.send({ type: "resume", token: "yok" });
    await until(() => c.of("error").length > 0);
    expect(c.lastError?.code).toBe("resume_failed");
  });
});

describe("hız sınırı ve geçersiz mesaj", () => {
  it("ani yük 30 mesajı aşınca rate_limited döner", async () => {
    const c = await Client.connect();
    for (let i = 0; i < 40; i++) c.send({ type: "ping", t: i });
    await until(() => c.of("pong").length + c.of("error").length >= 40);
    expect(c.of("pong")).toHaveLength(30);
    expect(c.of("error").every((e) => e.code === "rate_limited")).toBe(true);
  });

  it("zamanla belirteç yenilenir", async () => {
    const c = await Client.connect();
    for (let i = 0; i < 30; i++) c.send({ type: "ping", t: i });
    await until(() => c.of("pong").length >= 30);
    k.clock.advance(1000);
    for (let i = 0; i < 20; i++) c.send({ type: "ping", t: i });
    await until(() => c.of("pong").length >= 50);
    expect(c.of("error")).toHaveLength(0);
  });

  it("5 geçersiz mesajdan sonra bağlantı kapanır", async () => {
    const c = await Client.connect();
    for (let i = 0; i < 5; i++) c.send("saçma");
    await until(() => c.closeCode !== null);
    expect(c.of("error")).toHaveLength(5);
    expect(c.closeCode).toBe(1008);
  });

  it("hello welcome döner", async () => {
    const c = await Client.connect();
    c.send({ type: "hello", clientVersion: "x" });
    await until(() => c.of("welcome").length > 0);
    expect(c.of("welcome")[0]).toMatchObject({ protocolVersion: 2 });
  });
});

describe("maç akışı", () => {
  it("yeterli oyuncu yoksa başlamaz", async () => {
    const a = await create("A");
    a.send({ type: "startMatch" });
    await until(() => a.of("error").length > 0);
    expect(a.lastError).toMatchObject({ code: "not_enough_players" });
    expect(a.room.phase).toBe("lobby");
  });

  it("bağlantısı kopuk oyuncular sayılmaz", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    b.ws.terminate();
    await until(() => a.room.players[1]?.connected === false);
    a.send({ type: "startMatch" });
    await until(() => a.of("error").length > 0);
    expect(a.lastError?.code).toBe("not_enough_players");
  });

  it("lobide ready/action reddedilir", async () => {
    const [a] = (await setupRoom(["A", "B"])) as [Client, Client];
    a.send({ type: "ready" });
    await until(() => a.of("error").length > 0);
    expect(a.lastError?.code).toBe("wrong_phase");
    a.send({ type: "action", seq: 7, payload: { kind: "press" } });
    await until(() => a.of("actionAck").length > 0);
    expect(a.of("actionAck")[0]).toEqual({ type: "actionAck", seq: 7, ok: false, reason: "wrong_phase" });
  });

  it("briefing: herkes hazır olunca 3 sn geri sayım, sonra oyun", async () => {
    const cs = (await setupRoom(["A", "B"], ["butona-bas"])) as [Client, Client];
    const [a, b] = cs;
    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing");
    const m = a.room.match;
    expect(m).toMatchObject({
      round: 0,
      total: 1,
      gameId: "butona-bas",
      gameName: "Butona Bas",
      orientation: "portrait",
      readyIds: [],
      publicView: null,
      view: null,
      result: null,
    });
    expect(m?.participants).toHaveLength(2);
    expect(m?.briefing.steps.length).toBeLessThanOrEqual(3);
    expect((m?.phaseEndsAt ?? 0) - (m?.phaseStartedAt ?? 0)).toBe(40_000);
    // Briefing'de eylem ve katılım engellenir.
    a.send({ type: "action", seq: 1, payload: { kind: "press" } });
    const late = await join(a.session.roomCode, "Geç");
    expect(late.lastError?.code).toBe("match_in_progress");
    a.send({ type: "ready" });
    await until(() => a.room.match?.readyIds.length === 1);
    expect(a.room.phase).toBe("briefing");
    b.send({ type: "ready" });
    await until(() => a.room.phase === "countdown");
    expect((a.room.match?.phaseEndsAt ?? 0) - (a.room.match?.phaseStartedAt ?? 0)).toBe(3_000);
    expect(a.of("actionAck").find((x) => x.seq === 1)).toMatchObject({ ok: false, reason: "wrong_phase" });
    k.clock.advance(2_700);
    await sync();
    expect(a.room.phase).toBe("countdown");
    k.clock.advance(300);
    await until(() => a.room.phase === "playing");
  });

  it("briefing 40 sn sonra hazır olmayanı beklemeden geçer", async () => {
    const [a] = (await setupRoom(["A", "B"])) as [Client, Client];
    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing");
    k.clock.advance(39_800);
    await sync();
    expect(a.room.phase).toBe("briefing");
    k.clock.advance(500);
    await until(() => a.room.phase === "countdown");
  });

  it("briefing bağlantısı kopan oyuncuyu beklemez", async () => {
    const [a, b, c] = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing");
    c.ws.terminate();
    await until(() => a.room.players[2]?.connected === false);
    a.send({ type: "ready" });
    b.send({ type: "ready" });
    await until(() => a.room.phase === "countdown");
  });

  it("maç başında kopuk olan katılımcı değildir; dönünce izleyicidir", async () => {
    const [a, b, c] = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    c.ws.terminate();
    await until(() => a.room.players[2]?.connected === false);
    const { startedAt } = await startPlaying([a, b]);
    expect(startedAt).toBeGreaterThan(0);
    expect(a.room.match?.participants).toEqual([a.session.playerId, b.session.playerId]);
    const c2 = await Client.connect();
    c2.send({ type: "resume", token: c.session.token });
    await until(() => c2.updates.length > 0);
    const view = c2.room.match?.view as { myScore: number | null };
    expect(view.myScore).toBeNull();
    c2.send({ type: "action", seq: 1, payload: { kind: "press" } });
    await until(() => c2.of("actionAck").length > 0);
    expect(c2.of("actionAck")[0]).toMatchObject({ ok: false, reason: "not_participant" });
  });

  it("tam maç: eşleşme, tek basış, ödüller, final, lobiye dönüş", async () => {
    const [a, b] = (await setupRoom(["A", "B"], ["butona-bas"])) as [Client, Client];
    const { startedAt } = await startPlaying([a, b]);
    const at = (offset: number) => k.clock.advance(startedAt + offset - k.clock.now());

    // Geçersiz eylemler
    a.send({ type: "action", seq: 900, payload: { kind: "bilinmeyen" } });
    await until(() => a.of("actionAck").some((x) => x.seq === 900));
    expect(a.of("actionAck").find((x) => x.seq === 900)).toMatchObject({
      ok: false,
      reason: "invalid_action",
    });

    // Pencere 0: ikisi de bas -> +1 +1
    at(20);
    await press(a);
    at(250);
    await press(b);
    // Aynı pencerede tekrar basış sayılmaz
    at(280);
    await press(a);
    // Pencere 1 (300-599): yalnız A -> -1
    at(310);
    await press(a);
    // Pencere 2 (600-899): sınırın iki yanı: A 899, B 900 -> ayrı pencereler, ikisi de tek: -1, -1
    at(899);
    await press(a);
    at(900);
    await press(b);
    at(1500);
    await sync();
    let v = a.room.match?.publicView as { scores: Record<string, number>; recent: unknown[] };
    const aView = a.room.match?.view as { myScore: number };
    expect(v.scores).toEqual({ [a.session.playerId]: -1, [b.session.playerId]: 0 });
    expect(aView.myScore).toBe(-1);
    expect(v.recent).toHaveLength(4);
    const bView = b.room.match?.view as { myScore: number };
    expect(bView.myScore).toBe(0);

    // Bitişte basış reddedilir.
    at(44_900);
    await sync();
    expect(a.room.phase).toBe("playing");
    at(45_000);
    b.send({ type: "action", seq: 901, payload: { kind: "press" } });
    await until(() => b.of("actionAck").some((x) => x.seq === 901));
    expect(b.of("actionAck").find((x) => x.seq === 901)?.ok).toBe(false);

    await until(() => a.room.phase === "results");
    const result = a.room.match?.result;
    expect(result?.miniScores).toEqual({ [a.session.playerId]: -1, [b.session.playerId]: 0 });
    // B tek lider +2, A ikinci +1
    expect(result?.awards).toEqual({ [b.session.playerId]: 2, [a.session.playerId]: 1 });
    expect(a.room.players.map((p) => p.score)).toEqual([1, 2]);
    expect(b.room.match?.phaseEndsAt).toBe((b.room.match?.phaseStartedAt ?? 0) + 7_000);
    v = a.room.match?.publicView as typeof v;
    expect(v.scores[b.session.playerId]).toBe(0);

    // Sonuç ekranı 7 sn sürer, sonra final.
    k.clock.advance(6_800);
    await sync();
    expect(a.room.phase).toBe("results");
    k.clock.advance(400);
    await until(() => a.room.phase === "final");
    expect(a.room.match?.result).not.toBeNull();
    expect(a.room.players.map((p) => p.score)).toEqual([1, 2]);

    // Final'de oyun eylemi reddedilir; yalnız host lobiye döndürür.
    b.send({ type: "returnToLobby" });
    await until(() => b.of("error").length > 0);
    expect(b.lastError?.code).toBe("not_host");
    a.send({ type: "returnToLobby" });
    await until(() => a.room.phase === "lobby");
    expect(a.room.players.map((p) => p.score)).toEqual([0, 0]);
    expect(a.room.match).toBeNull();
    expect(b.room.phase).toBe("lobby");
  });

  it("yeni oyuncu lobiye dönünce katılabilir; çıkarılmış oyuncu geri gelmez", async () => {
    const [a, b, c] = (await setupRoom(["A", "B", "C"], ["butona-bas"])) as [Client, Client, Client];
    await startPlaying([a, b, c]);
    c.ws.terminate();
    await until(() => a.room.players[2]?.connected === false);
    k.clock.advance(121_000);
    await until(() => a.room.players.length === 2);
    // 121 sn içinde oyun (45 sn) ve sonuç ekranı (7 sn) de tamamlanmış olur.
    await until(() => a.room.phase === "final");
    expect(a.room.players.map((p) => p.score)).toEqual([1, 1]);
    a.send({ type: "returnToLobby" });
    await until(() => a.room.phase === "lobby");
    expect(a.room.players.map((p) => p.nickname)).toEqual(["A", "B"]);
    const d = await join(a.session.roomCode, "D");
    expect(d.room.players.map((p) => p.nickname)).toEqual(["A", "B", "D"]);
  });

  it("host maç sırasında kick yapamaz", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    await startPlaying([a, b]);
    a.send({ type: "kick", playerId: b.session.playerId });
    a.send({ type: "setGames", gameIds: ["butona-bas"] });
    a.send({ type: "startMatch" });
    await until(() => a.of("error").length >= 3);
    expect(a.of("error").map((e) => e.code)).toEqual(["wrong_phase", "wrong_phase", "wrong_phase"]);
  });

  it("yayınlar birleştirilir: 50 ms içindeki değişimler tek anlık görüntü olur", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    await startPlaying([a, b]);
    await sync();
    const mark = b.mark();
    for (let i = 0; i < 5; i++) {
      a.send({ type: "action", seq: 1000 + i, payload: { kind: "press" } });
    }
    await sleep(40);
    k.clock.advance(60);
    await sleep(40);
    const snaps = b.since(mark).filter((m) => m.type === "room" || m.type === "patch");
    expect(snaps.length).toBeLessThanOrEqual(1);
    // rev yalnız artar
    const revs = b.updates.map((m) => m.snapshot.rev);
    expect([...revs].sort((x, y) => x - y)).toEqual(revs);
  });

  it("oyuncuya özel alanlar yalnız kendi görünümünde", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    await startPlaying([a, b]);
    await press(a);
    await sync();
    const va = a.room.match?.view as { pressedThisWindow: boolean };
    const vb = b.room.match?.view as { pressedThisWindow: boolean };
    expect(va.pressedThisWindow).toBe(true);
    expect(vb.pressedThisWindow).toBe(false);
    expect(a.room.selfId).not.toBe(b.room.selfId);
  });
});

describe("karakter seçimi", () => {
  it("lobide boş karakteri alır, herkes görür", async () => {
    const [a, b] = await setupRoom(["Ayşe", "Mehmet"]);
    b?.send({ type: "chooseAvatar", avatar: 5 });
    await until(() => a?.room.players[1]?.avatar === 5, "avatar");
    expect(b?.room.players[1]?.avatar).toBe(5);
    // boşalan karakter başkasına verilebilir
    a?.send({ type: "chooseAvatar", avatar: 1 });
    await until(() => b?.room.players[0]?.avatar === 1, "avatar 2");
  });

  it("dolu karakter reddedilir: ilk gelen alır, diğerine kibar uyarı", async () => {
    const [a, b] = await setupRoom(["Ayşe", "Mehmet"]);
    b?.send({ type: "chooseAvatar", avatar: 0 });
    await until(() => (b?.of("error").length ?? 0) > 0, "hata");
    expect(b?.lastError).toMatchObject({ code: "avatar_taken", message: "Bu karakteri Ayşe aldı." });
    expect(a?.room.players.map((p) => p.avatar)).toEqual([0, 1]);
  });

  it("aynı anda aynı karakteri isteyen ikisinden yalnız biri alır", async () => {
    const [, b, c] = await setupRoom(["A", "B", "C"]);
    b?.send({ type: "chooseAvatar", avatar: 6 });
    c?.send({ type: "chooseAvatar", avatar: 6 });
    await until(() => (b?.of("error").length ?? 0) + (c?.of("error").length ?? 0) > 0, "çatışma");
    const owners = b?.room.players.filter((p) => p.avatar === 6) ?? [];
    expect(owners).toHaveLength(1);
  });

  it("aralık dışı değer geçersiz mesajdır", async () => {
    const [a] = await setupRoom(["A"]);
    a?.send({ type: "chooseAvatar", avatar: 8 });
    await until(() => (a?.of("error").length ?? 0) > 0, "hata");
    expect(a?.lastError?.code).toBe("invalid_message");
  });

  it("maç başlayınca kilitlenir", async () => {
    const cs = await setupRoom(["A", "B"]);
    await startPlaying(cs);
    cs[1]?.send({ type: "chooseAvatar", avatar: 7 });
    await until(() => (cs[1]?.of("error").length ?? 0) > 0, "hata");
    expect(cs[1]?.lastError?.code).toBe("wrong_phase");
    expect(cs[0]?.room.players[1]?.avatar).toBe(1);
  });

  it("odada değilken reddedilir", async () => {
    const c = await Client.connect();
    c.send({ type: "chooseAvatar", avatar: 2 });
    await until(() => c.of("error").length > 0, "hata");
    expect(c.lastError?.code).toBe("not_in_room");
  });

  it("giriş ipucu boşsa verilir, doluysa otomatik atanır", async () => {
    const host = await create("A");
    const free = await Client.connect();
    free.send({ type: "joinRoom", code: host.session.roomCode, nickname: "B", avatar: 4 });
    await until(() => free.updates.length > 0, "katılım");
    expect(free.room.players[1]?.avatar).toBe(4);
    const taken = await Client.connect();
    taken.send({ type: "joinRoom", code: host.session.roomCode, nickname: "C", avatar: 4 });
    await until(() => taken.updates.length > 0, "katılım 2");
    expect(taken.room.players[2]?.avatar).toBe(1);
  });
});
