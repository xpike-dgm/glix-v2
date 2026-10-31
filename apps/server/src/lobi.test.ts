import { allReady, LOBBY_EMOJIS } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { RESULTS_MS } from "./match.js";
import { Client, k, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

type Three = [Client, Client, Client];

describe("lobide takma ad değiştirme", () => {
  it("adı değiştirir ve herkese yayar", async () => {
    const [a, b] = (await setupRoom(["Ayşe", "Mehmet"])) as [Client, Client];
    b.send({ type: "rename", nickname: "  Memo  " });
    await until(() => a.room.players[1]?.nickname === "Memo");
    expect(b.room.players[1]?.nickname).toBe("Memo");
  });

  it("odada başkasının adı (büyük/küçük harf duyarsız) reddedilir", async () => {
    const [a, b] = (await setupRoom(["Ayşe", "Mehmet"])) as [Client, Client];
    k.clock.advance(2000);
    b.send({ type: "rename", nickname: "ayşe" });
    await until(() => b.of("error").length > 0);
    expect(b.lastError).toMatchObject({ code: "nickname_taken" });
    expect(a.room.players[1]?.nickname).toBe("Mehmet");
    // Kendi adının büyük/küçük harfini değiştirmek serbest.
    b.send({ type: "rename", nickname: "MEHMET" });
    await until(() => a.room.players[1]?.nickname === "MEHMET");
  });

  it("geçersiz ad protokolde düşer (invalid_message)", async () => {
    const [a] = (await setupRoom(["Ayşe", "Mehmet"])) as [Client, Client];
    a.send({ type: "rename", nickname: "🙂🙂" });
    await until(() => a.of("error").length > 0);
    expect(a.lastError?.code).toBe("invalid_message");
  });

  it("maç başlayınca reddedilir", async () => {
    const cs = (await setupRoom(["A", "B"])) as [Client, Client];
    await startPlaying(cs);
    k.clock.advance(2000);
    cs[1].send({ type: "rename", nickname: "Yeni" });
    await until(() => cs[1].of("error").length > 0);
    expect(cs[1].lastError?.code).toBe("wrong_phase");
  });

  it("art arda değiştirme hız sınırına takılır", async () => {
    const [, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    b.send({ type: "rename", nickname: "B1" });
    b.send({ type: "rename", nickname: "B2" });
    await until(() => b.of("error").length > 0);
    expect(b.lastError?.code).toBe("rate_limited");
    expect(b.room.players[1]?.nickname).toBe("B1");
  });
});

describe("lobi emoji tepkisi", () => {
  it("herkese (gönderen dahil) geçici olay olarak gider, oda durumunda saklanmaz", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    const revBefore = a.room.rev;
    b.send({ type: "react", emoji: "🔥" });
    await until(() => a.of("reaction").length > 0 && b.of("reaction").length > 0);
    const expected = { type: "reaction", playerId: b.session.playerId, emoji: "🔥" };
    expect(a.of("reaction")[0]).toEqual(expected);
    expect(b.of("reaction")[0]).toEqual(expected);
    await sync();
    expect(a.room.rev).toBe(revBefore);
    expect(JSON.stringify(a.room)).not.toContain("🔥");
  });

  it("izinli kümenin dışındaki emoji geçersiz mesajdır", async () => {
    const [a] = (await setupRoom(["A", "B"])) as [Client, Client];
    a.send({ type: "react", emoji: "💩" });
    await until(() => a.of("error").length > 0);
    expect(a.lastError?.code).toBe("invalid_message");
    expect(a.of("reaction")).toHaveLength(0);
  });

  it("izinli kümenin hepsi kabul edilir", async () => {
    const [a] = (await setupRoom(["A", "B"])) as [Client, Client];
    for (const emoji of LOBBY_EMOJIS) {
      a.send({ type: "react", emoji });
      await until(() => a.of("reaction").some((r) => r.emoji === emoji), emoji);
      k.clock.advance(800);
    }
    expect(a.of("error")).toHaveLength(0);
  });

  it("700 ms içindeki ikinci emoji sessizce atılır (hata yok)", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    k.clock.advance(1000);
    b.send({ type: "react", emoji: "😂" });
    await until(() => a.of("reaction").length === 1);
    k.clock.advance(300);
    b.send({ type: "react", emoji: "👏" });
    await sync();
    expect(a.of("reaction")).toHaveLength(1);
    expect(b.of("error")).toHaveLength(0);
    k.clock.advance(400);
    b.send({ type: "react", emoji: "👏" });
    await until(() => a.of("reaction").length === 2);
    expect(a.of("reaction")[1]?.emoji).toBe("👏");
  });

  it("hız sınırı oyuncu başınadır", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    k.clock.advance(1000);
    a.send({ type: "react", emoji: "👋" });
    b.send({ type: "react", emoji: "❤️" });
    await until(() => a.of("reaction").length === 2);
  });

  it("oyun sırasında (anlatım, geri sayım, oyun) sessizce atılır", async () => {
    const cs = (await setupRoom(["A", "B"])) as [Client, Client];
    const host = cs[0];
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    k.clock.advance(1000);
    cs[1].send({ type: "react", emoji: "🔥" });
    await sync();
    for (const c of cs) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    k.clock.advance(1000);
    cs[1].send({ type: "react", emoji: "🔥" });
    await sync();
    k.clock.advance(2000);
    await until(() => host.room.phase === "playing", "playing");
    k.clock.advance(1000);
    cs[1].send({ type: "react", emoji: "🔥" });
    await sync();
    expect(cs[0].of("reaction")).toHaveLength(0);
    expect(cs[1].of("reaction")).toHaveLength(0);
    expect(cs[1].of("error")).toHaveLength(0);
  });

  it("sonuç ekranında herkese gider, hız sınırı ve izinli küme aynı kalır", async () => {
    const cs = (await setupRoom(["A", "B"], ["butona-bas", "kor-bomba"])) as [Client, Client];
    await startPlaying(cs);
    k.clock.advance(48_000);
    await until(() => cs[0].room.phase === "results", "results");
    k.clock.advance(1000);
    cs[1].send({ type: "react", emoji: "😱" });
    await until(() => cs[0].of("reaction").length === 1 && cs[1].of("reaction").length === 1);
    expect(cs[0].of("reaction")[0]).toEqual({
      type: "reaction",
      playerId: cs[1].session.playerId,
      emoji: "😱",
    });
    k.clock.advance(300);
    cs[1].send({ type: "react", emoji: "👏" });
    await sync();
    expect(cs[0].of("reaction")).toHaveLength(1);
    cs[1].send({ type: "react", emoji: "💩" });
    await until(() => cs[1].of("error").length > 0);
    expect(cs[1].lastError?.code).toBe("invalid_message");
  });

  it("final ekranında herkese gider", async () => {
    const cs = (await setupRoom(["A", "B"], ["butona-bas"])) as [Client, Client];
    await startPlaying(cs);
    k.clock.advance(48_000);
    await until(() => cs[0].room.phase === "results", "results");
    k.clock.advance(RESULTS_MS + 1_000);
    await until(() => cs[0].room.phase === "final", "final");
    k.clock.advance(1000);
    cs[0].send({ type: "react", emoji: "🔥" });
    await until(() => cs[0].of("reaction").length === 1 && cs[1].of("reaction").length === 1);
  });
});

describe("lobide hazırım", () => {
  it("host olmayan oyuncu hazır işareti koyar ve kaldırır", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    expect(a.room.lobbyReady).toEqual([]);
    b.send({ type: "setReady", ready: true });
    await until(() => a.room.lobbyReady.length === 1);
    expect(a.room.lobbyReady).toEqual([b.session.playerId]);
    expect(b.room.lobbyReady).toEqual([b.session.playerId]);
    b.send({ type: "setReady", ready: false });
    await until(() => a.room.lobbyReady.length === 0);
  });

  it("host hazır işareti taşımaz", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    a.send({ type: "setReady", ready: true });
    await sync();
    expect(a.room.lobbyReady).toEqual([]);
    expect(a.of("error")).toHaveLength(0);
    expect(b.room.lobbyReady).toEqual([]);
  });

  it("hazır olmak başlamak için şart değil", async () => {
    const [a] = (await setupRoom(["A", "B"])) as [Client, Client];
    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing");
  });

  it("herkes hazırsa allReady doğru hesaplanır (bağlı, host olmayan oyuncular)", async () => {
    const [a, b, c] = (await setupRoom(["A", "B", "C"])) as Three;
    expect(allReady(a.room)).toBe(false);
    b.send({ type: "setReady", ready: true });
    await until(() => a.room.lobbyReady.length === 1);
    expect(allReady(a.room)).toBe(false);
    c.send({ type: "setReady", ready: true });
    await until(() => a.room.lobbyReady.length === 2);
    expect(allReady(a.room)).toBe(true);
    // Bağlantısı kopan hazır olmayan sayılmaz; kopan hazır oyuncu da işaretten düşer.
    c.ws.terminate();
    await until(() => a.room.players[2]?.connected === false);
    expect(a.room.lobbyReady).toEqual([b.session.playerId]);
    expect(allReady(a.room)).toBe(true);
  });

  it("maç başlayınca ve lobiye dönünce sıfırlanır", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    b.send({ type: "setReady", ready: true });
    await until(() => a.room.lobbyReady.length === 1);
    await startPlaying([a, b]);
    expect(a.room.lobbyReady).toEqual([]);
    // Bayrak maç boyunca açık kalmamalı: oyun bitip lobiye dönünce yine boş.
    k.clock.advance(48_000);
    await until(() => a.room.phase === "results");
    k.clock.advance(RESULTS_MS + 1_000);
    await until(() => a.room.phase === "final");
    a.send({ type: "returnToLobby" });
    await until(() => a.room.phase === "lobby");
    expect(a.room.lobbyReady).toEqual([]);
    expect(b.room.lobbyReady).toEqual([]);
  });

  it("lobi dışında reddedilir", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    await startPlaying([a, b]);
    b.send({ type: "setReady", ready: true });
    await until(() => b.of("error").length > 0);
    expect(b.lastError?.code).toBe("wrong_phase");
  });

  it("host olunca hazır işareti düşer", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    b.send({ type: "setReady", ready: true });
    await until(() => a.room.lobbyReady.length === 1);
    a.send({ type: "transferHost", playerId: b.session.playerId });
    await until(() => b.room.hostId === b.session.playerId);
    expect(b.room.lobbyReady).toEqual([]);
  });
});

describe("ev sahipliğini devretme ve atma", () => {
  it("host devreder; taç hedefe geçer, eski host oyuncu olur", async () => {
    const [a, b, c] = (await setupRoom(["A", "B", "C"])) as Three;
    a.send({ type: "transferHost", playerId: c.session.playerId });
    await until(() => b.room.hostId === c.session.playerId);
    expect(a.room.hostId).toBe(c.session.playerId);
    // Eski host artık host işlemi yapamaz, yenisi yapar.
    a.send({ type: "setRandom", count: 3 });
    await until(() => a.of("error").length > 0);
    expect(a.lastError?.code).toBe("not_host");
    c.send({ type: "setRandom", count: 3 });
    await until(() => a.room.selection.mode === "random" && a.room.selection.count === 3);
  });

  it("host olmayan devredemez; kendine, olmayana ya da kopuk oyuncuya devredilmez", async () => {
    const [a, b, c] = (await setupRoom(["A", "B", "C"])) as Three;
    b.send({ type: "transferHost", playerId: c.session.playerId });
    await until(() => b.of("error").length > 0);
    expect(b.lastError?.code).toBe("not_host");
    a.send({ type: "transferHost", playerId: a.session.playerId });
    a.send({ type: "transferHost", playerId: "yok" });
    await until(() => a.of("error").length >= 2);
    expect(a.of("error").map((e) => e.code)).toEqual(["not_in_room", "not_in_room"]);
    c.ws.terminate();
    await until(() => a.room.players[2]?.connected === false);
    a.send({ type: "transferHost", playerId: c.session.playerId });
    await until(() => a.of("error").length >= 3);
    expect(a.room.hostId).toBe(a.session.playerId);
  });

  it("maç sırasında devredilemez ve atılamaz", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    await startPlaying([a, b]);
    a.send({ type: "transferHost", playerId: b.session.playerId });
    a.send({ type: "kick", playerId: b.session.playerId });
    await until(() => a.of("error").length >= 2);
    expect(a.of("error").map((e) => e.code)).toEqual(["wrong_phase", "wrong_phase"]);
    expect(a.room.hostId).toBe(a.session.playerId);
    expect(a.room.players).toHaveLength(2);
  });

  it("atılan oyuncunun belirteci odaya geri döndürmez, ama kodla yeniden katılabilir", async () => {
    const [a, , c] = (await setupRoom(["A", "B", "C"])) as Three;
    const token = c.session.token;
    a.send({ type: "kick", playerId: c.session.playerId });
    await until(() => c.of("left").length > 0);
    expect(c.of("left")[0]).toEqual({ type: "left", reason: "kicked" });
    const d = await Client.connect();
    d.send({ type: "resume", token });
    await until(() => d.of("error").length > 0);
    expect(d.lastError?.code).toBe("resume_failed");
    // Karar: kodla yeniden katılma engellenmez (kimliksiz oyunda kalıcı yasak yapılamaz).
    c.send({ type: "joinRoom", code: a.session.roomCode, nickname: "C" });
    await until(() => c.of("session").length === 2);
    expect(c.room.players).toHaveLength(3);
  });
});
