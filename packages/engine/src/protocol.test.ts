import { describe, expect, it } from "vitest";
import { allReady, LOBBY_EMOJIS, MAX_FEEDBACK_TEXT, PERF_LIMITS, parseClientMessage } from "./protocol.js";

describe("parseClientMessage", () => {
  it("hello kabul eder", () => {
    expect(parseClientMessage('{"type":"hello","clientVersion":"0.0.1"}')).toEqual({
      type: "hello",
      clientVersion: "0.0.1",
    });
  });
  it("ping kabul eder", () => {
    expect(parseClientMessage('{"type":"ping","t":12.5}')).toEqual({ type: "ping", t: 12.5 });
  });
  it("bozuk JSON, dizi ve ilkel değerleri reddeder", () => {
    for (const raw of ["", "{", "[]", "null", "5", '"x"']) expect(parseClientMessage(raw)).toBeNull();
  });
  it("bilinmeyen tür ve fazladan alanı reddeder", () => {
    expect(parseClientMessage('{"type":"nope"}')).toBeNull();
    expect(parseClientMessage('{"type":"ping","t":1,"x":1}')).toBeNull();
    expect(parseClientMessage('{"type":"hello","clientVersion":"1","x":1}')).toBeNull();
  });
  it("yanlış alan tiplerini reddeder", () => {
    expect(parseClientMessage('{"type":"ping","t":"1"}')).toBeNull();
    expect(parseClientMessage('{"type":"ping"}')).toBeNull();
    expect(parseClientMessage('{"type":"hello","clientVersion":""}')).toBeNull();
    expect(parseClientMessage('{"type":"hello","clientVersion":5}')).toBeNull();
  });
  it("4096 karakterden uzun mesajı reddeder", () => {
    const long = JSON.stringify({ type: "hello", clientVersion: "a".repeat(5000) });
    expect(parseClientMessage(long)).toBeNull();
  });
});

const j = (o: unknown): string => JSON.stringify(o);

describe("parseClientMessage: oda mesajları", () => {
  it("createRoom takma adı kırpar ve iç boşlukları tekleştirir", () => {
    expect(parseClientMessage(j({ type: "createRoom", nickname: "  Ali   Veli " }))).toEqual({
      type: "createRoom",
      nickname: "Ali Veli",
    });
  });
  it("takma ad sınırlarını uygular", () => {
    const bad = ["", "   ", "a".repeat(17), "a\u0000b", "a\tb\u0007", 5, null];
    for (const nickname of bad) expect(parseClientMessage(j({ type: "createRoom", nickname }))).toBeNull();
    expect(parseClientMessage(j({ type: "createRoom", nickname: "a".repeat(16) }))).not.toBeNull();
    expect(parseClientMessage(j({ type: "createRoom", nickname: "ğüşiöç" }))).not.toBeNull();
    expect(parseClientMessage(j({ type: "createRoom" }))).toBeNull();
    expect(parseClientMessage(j({ type: "createRoom", nickname: "a", x: 1 }))).toBeNull();
  });
  it("joinRoom kodu büyük harfe çevirir", () => {
    expect(parseClientMessage(j({ type: "joinRoom", code: "ab2c9", nickname: "Ay" }))).toEqual({
      type: "joinRoom",
      code: "AB2C9",
      nickname: "Ay",
    });
  });
  it("joinRoom hatalı kodu ve eksik alanı reddeder", () => {
    for (const code of ["ABCD", "ABCDEF", "AB-CD", "AB CD", "", 12345, null]) {
      expect(parseClientMessage(j({ type: "joinRoom", code, nickname: "Ay" }))).toBeNull();
    }
    expect(parseClientMessage(j({ type: "joinRoom", code: "ABCDE" }))).toBeNull();
    expect(parseClientMessage(j({ type: "joinRoom", nickname: "Ay" }))).toBeNull();
  });
  it("chooseAvatar aralığı ve biçimi doğrular", () => {
    expect(parseClientMessage(j({ type: "chooseAvatar", avatar: 3 }))).toEqual({
      type: "chooseAvatar",
      avatar: 3,
    });
    for (const avatar of [-1, 8, 1.5, "2", null, Number.NaN, 1e9]) {
      expect(parseClientMessage(j({ type: "chooseAvatar", avatar }))).toBeNull();
    }
    expect(parseClientMessage(j({ type: "chooseAvatar" }))).toBeNull();
    expect(parseClientMessage(j({ type: "chooseAvatar", avatar: 1, x: 1 }))).toBeNull();
  });
  it("odaya girişte isteğe bağlı avatar ipucu doğrulanır", () => {
    expect(parseClientMessage(j({ type: "createRoom", nickname: "Ay", avatar: 5 }))).toEqual({
      type: "createRoom",
      nickname: "Ay",
      avatar: 5,
    });
    expect(parseClientMessage(j({ type: "joinRoom", code: "ABCDE", nickname: "Ay", avatar: 0 }))).toEqual({
      type: "joinRoom",
      code: "ABCDE",
      nickname: "Ay",
      avatar: 0,
    });
    expect(parseClientMessage(j({ type: "joinRoom", code: "ABCDE", nickname: "Ay", avatar: 8 }))).toBeNull();
    expect(parseClientMessage(j({ type: "createRoom", nickname: "Ay", avatar: "1" }))).toBeNull();
  });
  it("resume token biçimini doğrular", () => {
    expect(parseClientMessage(j({ type: "resume", token: "aB3_-x" }))).toEqual({
      type: "resume",
      token: "aB3_-x",
    });
    for (const token of ["", "a".repeat(129), "a b", "a/b", "a=b", 5]) {
      expect(parseClientMessage(j({ type: "resume", token }))).toBeNull();
    }
    expect(parseClientMessage(j({ type: "resume", token: "a".repeat(128) }))).not.toBeNull();
  });
  it("kick playerId doğrular", () => {
    expect(parseClientMessage(j({ type: "kick", playerId: "p1" }))).toEqual({ type: "kick", playerId: "p1" });
    for (const playerId of ["", "a".repeat(65), 1, null]) {
      expect(parseClientMessage(j({ type: "kick", playerId }))).toBeNull();
    }
    expect(parseClientMessage(j({ type: "kick" }))).toBeNull();
  });
  it("setGames dizi kurallarını uygular", () => {
    expect(parseClientMessage(j({ type: "setGames", gameIds: ["a", "b"] }))).toEqual({
      type: "setGames",
      gameIds: ["a", "b"],
    });
    const many = Array.from({ length: 65 }, (_, i) => `g${i}`);
    for (const gameIds of [[], ["a", "a"], [1], [""], ["a".repeat(65)], many, "a", null]) {
      expect(parseClientMessage(j({ type: "setGames", gameIds }))).toBeNull();
    }
    // Katalog 24'ü aştı (27 oyun): tüm uygun oyunlar tek mesajda seçilebilmeli.
    expect(parseClientMessage(j({ type: "setGames", gameIds: many.slice(0, 27) }))).not.toBeNull();
    expect(parseClientMessage(j({ type: "setGames", gameIds: many.slice(0, 64) }))).not.toBeNull();
  });
  it("setTone yalnız aile/arkadas/ofis kabul eder, tam anahtar kümesiyle", () => {
    for (const tone of ["aile", "arkadas", "ofis"]) {
      expect(parseClientMessage(j({ type: "setTone", tone }))).toEqual({ type: "setTone", tone });
    }
    for (const tone of ["Aile", "kaba", "", null, 1, undefined, ["ofis"], "__proto__"]) {
      expect(parseClientMessage(j({ type: "setTone", tone }))).toBeNull();
    }
    expect(parseClientMessage(j({ type: "setTone" }))).toBeNull();
    expect(parseClientMessage(j({ type: "setTone", tone: "ofis", extra: 1 }))).toBeNull();
  });
  it("setRandom count 1..64 güvenli tamsayı ister", () => {
    expect(parseClientMessage(j({ type: "setRandom", count: 5 }))).toEqual({ type: "setRandom", count: 5 });
    expect(parseClientMessage(j({ type: "setRandom", count: 1 }))).not.toBeNull();
    expect(parseClientMessage(j({ type: "setRandom", count: 64 }))).not.toBeNull();
    for (const count of [0, -1, 65, 1.5, "5", null, Number.NaN, 2 ** 53, undefined]) {
      expect(parseClientMessage(j({ type: "setRandom", count }))).toBeNull();
    }
    expect(parseClientMessage(j({ type: "setRandom", count: 3, extra: 1 }))).toBeNull();
    expect(parseClientMessage(j({ type: "setRandom" }))).toBeNull();
  });
  it("feedback puan ve metni doğrular", () => {
    expect(parseClientMessage(j({ type: "feedback", rating: 5 }))).toEqual({ type: "feedback", rating: 5 });
    expect(parseClientMessage(j({ type: "feedback", rating: 3, text: "  güzel\u0000 oyun\n " }))).toEqual({
      type: "feedback",
      rating: 3,
      text: "güzel oyun",
    });
    expect(parseClientMessage(j({ type: "feedback", rating: 1, text: "   " }))).toEqual({
      type: "feedback",
      rating: 1,
    });
    expect(
      parseClientMessage(j({ type: "feedback", rating: 2, text: "a".repeat(MAX_FEEDBACK_TEXT) })),
    ).not.toBeNull();
    expect(
      parseClientMessage(j({ type: "feedback", rating: 2, text: "a".repeat(MAX_FEEDBACK_TEXT + 1) })),
    ).toBeNull();
    for (const rating of [0, 6, 2.5, "3", null, undefined, Number.NaN]) {
      expect(parseClientMessage(j({ type: "feedback", rating }))).toBeNull();
    }
    expect(parseClientMessage(j({ type: "feedback", rating: 3, text: 5 }))).toBeNull();
    expect(parseClientMessage(j({ type: "feedback", rating: 3, extra: 1 }))).toBeNull();
    expect(parseClientMessage(j({ type: "feedback" }))).toBeNull();
  });
  it("argümansız mesajlar yalnız type ile kabul edilir", () => {
    for (const type of ["leaveRoom", "startMatch", "ready", "returnToLobby", "resync"]) {
      expect(parseClientMessage(j({ type }))).toEqual({ type });
      expect(parseClientMessage(j({ type, extra: 1 }))).toBeNull();
    }
  });
  it("action seq ve payload doğrular", () => {
    expect(parseClientMessage(j({ type: "action", seq: 0, payload: { kind: "press" } }))).toEqual({
      type: "action",
      seq: 0,
      payload: { kind: "press" },
    });
    expect(parseClientMessage(j({ type: "action", seq: 3, payload: null }))).toEqual({
      type: "action",
      seq: 3,
      payload: null,
    });
    for (const seq of [-1, 1.5, "1", null, 2 ** 53]) {
      expect(parseClientMessage(j({ type: "action", seq, payload: 1 }))).toBeNull();
    }
    expect(parseClientMessage(j({ type: "action", seq: 1 }))).toBeNull();
    expect(parseClientMessage(j({ type: "action", payload: 1 }))).toBeNull();
    expect(parseClientMessage(j({ type: "action", seq: 1, payload: 1, x: 1 }))).toBeNull();
  });

  it("takma ad: görünmez/yön karakterleri, birleştirici yığını ve harfsiz adlar reddedilir", () => {
    const nick = (nickname: string) => parseClientMessage(j({ type: "createRoom", nickname }));
    for (const bad of [
      "Ali\u202Eevil", // RLO
      "A\u200Bli", // sıfır genişlik
      "A\u200Dli", // ZWJ
      "\u2028Ali", // satır ayırıcı
      "Ali\u2029",
      "A\uE000li", // özel kullanım
      "A\uD800li", // yetim vekil
      "\u{1F600}", // yalnız emoji
      "\u{1F600}\u{1F389}",
      "---",
      "   ",
      "a\u0301\u0302\u0303", // 3 ardışık işaret
    ])
      expect(nick(bad), JSON.stringify(bad)).toBeNull();
    for (const ok of ["Ali", "ŞİŞE", "ığdır", "Çağrı 7", "42", "Ali \u{1F600}", "a\u0301\u0302", "i\u0307"])
      expect(nick(ok), JSON.stringify(ok)).not.toBeNull();
  });

  describe("perf", () => {
    const ok = {
      type: "perf",
      gameId: "butona-bas",
      rttMs: 40,
      ackP50: 45,
      ackP95: 120,
      ackN: 80,
      slowTaps: 2,
      tapP95: 90,
      longTasks: 1,
      longTaskMs: 70,
    };
    it("geçerli özeti kabul eder", () => {
      expect(parseClientMessage(j(ok))).toEqual(ok);
    });
    it("üst sınırdaki değerleri kabul, bir fazlasını reddeder", () => {
      for (const [key, max] of Object.entries(PERF_LIMITS)) {
        expect(parseClientMessage(j({ ...ok, [key]: max }))).not.toBeNull();
        expect(parseClientMessage(j({ ...ok, [key]: max + 1 }))).toBeNull();
      }
    });
    it("negatif, kesirli, metin ve sonsuz değerleri reddeder", () => {
      for (const bad of [-1, 1.5, "5", null, Number.NaN, true]) {
        expect(parseClientMessage(j({ ...ok, ackP95: bad }))).toBeNull();
      }
    });
    it("eksik ve fazla alanı reddeder", () => {
      const { rttMs: _drop, ...missing } = ok;
      expect(parseClientMessage(j(missing))).toBeNull();
      expect(parseClientMessage(j({ ...ok, playerId: "x" }))).toBeNull();
    });
    it("gameId 1..64 karakter olmalı", () => {
      expect(parseClientMessage(j({ ...ok, gameId: "" }))).toBeNull();
      expect(parseClientMessage(j({ ...ok, gameId: "a".repeat(65) }))).toBeNull();
      expect(parseClientMessage(j({ ...ok, gameId: "a".repeat(64) }))).not.toBeNull();
      expect(parseClientMessage(j({ ...ok, gameId: 5 }))).toBeNull();
    });
  });
});

describe("lobi mesajları (rename, react, setReady, transferHost)", () => {
  const parse = (v: unknown) => parseClientMessage(JSON.stringify(v));

  it("rename: takma adı temizler ve geçersizini reddeder", () => {
    expect(parse({ type: "rename", nickname: "  Ali  Veli " })).toEqual({
      type: "rename",
      nickname: "Ali Veli",
    });
    for (const nickname of ["", "   ", "🙂", "a".repeat(17), 5, null, "a‮b"])
      expect(parse({ type: "rename", nickname })).toBeNull();
    expect(parse({ type: "rename" })).toBeNull();
    expect(parse({ type: "rename", nickname: "Ali", extra: 1 })).toBeNull();
  });

  it("react: yalnız sabit emoji kümesi", () => {
    for (const emoji of LOBBY_EMOJIS)
      expect(parse({ type: "react", emoji })).toEqual({ type: "react", emoji });
    for (const emoji of ["💩", "", "🔥🔥", "fire", 1, null, "❤"])
      expect(parse({ type: "react", emoji })).toBeNull();
    expect(parse({ type: "react" })).toBeNull();
    expect(parse({ type: "react", emoji: "🔥", x: 1 })).toBeNull();
  });

  it("setReady: yalnız boolean", () => {
    expect(parse({ type: "setReady", ready: true })).toEqual({ type: "setReady", ready: true });
    expect(parse({ type: "setReady", ready: false })).toEqual({ type: "setReady", ready: false });
    for (const ready of [1, "true", null, undefined]) expect(parse({ type: "setReady", ready })).toBeNull();
    expect(parse({ type: "setReady" })).toBeNull();
  });

  it("transferHost: playerId zorunlu, 1-64 karakter", () => {
    expect(parse({ type: "transferHost", playerId: "abc" })).toEqual({
      type: "transferHost",
      playerId: "abc",
    });
    for (const playerId of ["", "x".repeat(65), 1, null])
      expect(parse({ type: "transferHost", playerId })).toBeNull();
    expect(parse({ type: "transferHost" })).toBeNull();
    expect(parse({ type: "transferHost", playerId: "a", extra: 1 })).toBeNull();
  });

  it("allReady: bağlı ve host olmayan herkes hazır olmalı, en az bir kişi", () => {
    const p = (id: string, connected = true, spectator = false) => ({
      id,
      nickname: id,
      avatar: 0,
      connected,
      score: 0,
      spectator,
    });
    const base = { hostId: "h", players: [p("h"), p("a"), p("b")], lobbyReady: [] as string[] };
    expect(allReady(base)).toBe(false);
    expect(allReady({ ...base, lobbyReady: ["a"] })).toBe(false);
    expect(allReady({ ...base, lobbyReady: ["a", "b"] })).toBe(true);
    expect(allReady({ ...base, players: [p("h"), p("a"), p("b", false)], lobbyReady: ["a"] })).toBe(true);
    expect(allReady({ ...base, players: [p("h")] })).toBe(false);
    expect(allReady({ ...base, players: [p("h"), p("a", false)] })).toBe(false);
  });

  it("allReady: izleyici hazır beklemesini engellemez", () => {
    const p = (id: string, spectator = false) => ({
      id,
      nickname: id,
      avatar: 0,
      connected: true,
      score: 0,
      spectator,
    });
    const snap = { hostId: "h", players: [p("h"), p("a"), p("w", true)], lobbyReady: ["a"] };
    expect(allReady(snap)).toBe(true);
  });

  it("setJoinPolicy: yalnız izleyici / kapali kabul edilir", () => {
    expect(parse({ type: "setJoinPolicy", policy: "izleyici" })).toEqual({
      type: "setJoinPolicy",
      policy: "izleyici",
    });
    expect(parse({ type: "setJoinPolicy", policy: "kapali" })).toEqual({
      type: "setJoinPolicy",
      policy: "kapali",
    });
    for (const policy of ["", "Kapalı", "open", 1, null, undefined, ["izleyici"]])
      expect(parse({ type: "setJoinPolicy", policy })).toBeNull();
    expect(parse({ type: "setJoinPolicy" })).toBeNull();
    expect(parse({ type: "setJoinPolicy", policy: "kapali", extra: 1 })).toBeNull();
  });
});
