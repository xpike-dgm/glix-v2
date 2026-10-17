import { describe, expect, it } from "vitest";
import { parseClientMessage } from "./protocol.js";

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
    const many = Array.from({ length: 25 }, (_, i) => `g${i}`);
    for (const gameIds of [[], ["a", "a"], [1], [""], ["a".repeat(65)], many, "a", null]) {
      expect(parseClientMessage(j({ type: "setGames", gameIds }))).toBeNull();
    }
    expect(parseClientMessage(j({ type: "setGames", gameIds: many.slice(0, 24) }))).not.toBeNull();
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
});
