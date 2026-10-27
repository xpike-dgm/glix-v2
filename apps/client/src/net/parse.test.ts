import { describe, expect, it } from "vitest";
import { snapshot } from "./fixtures.js";
import { parseServerMessage } from "./parse.js";

const wire = (v: unknown): string => JSON.stringify(v);

describe("sunucu mesajı doğrulama", () => {
  it("geçerli room mesajını kabul eder", () => {
    const m = parseServerMessage(wire({ type: "room", snapshot: snapshot("briefing") }));
    expect(m?.type).toBe("room");
    if (m?.type === "room") expect(m.snapshot.match?.gameId).toBe("butona-bas");
  });
  it("sahne onayını ve stageCount alanını doğrular", () => {
    expect(parseServerMessage(wire({ type: "stage", roomCode: "KX7QP" }))).toEqual({
      type: "stage",
      roomCode: "KX7QP",
    });
    expect(parseServerMessage(wire({ type: "stage" }))).toBeNull();
    expect(parseServerMessage(wire({ type: "stage", roomCode: 5 }))).toBeNull();
    const parse = (stageCount: unknown) =>
      parseServerMessage(wire({ type: "room", snapshot: { ...snapshot(), stageCount } }));
    const two = parse(2);
    if (two?.type === "room") expect(two.snapshot.stageCount).toBe(2);
    else throw new Error("room kabul edilmedi");
    for (const bad of [undefined, "2", -3, null]) {
      const m = parse(bad);
      if (m?.type === "room") expect(m.snapshot.stageCount).toBe(0);
    }
  });
  it("oyun seçim modunu doğrular", () => {
    const parse = (selection: unknown) =>
      parseServerMessage(wire({ type: "room", snapshot: { ...snapshot(), selection } }));
    expect(parse({ mode: "manual" })?.type).toBe("room");
    const random = parse({ mode: "random", count: 5 });
    if (random?.type === "room") expect(random.snapshot.selection).toEqual({ mode: "random", count: 5 });
    else throw new Error("rastgele mod kabul edilmedi");
    for (const bad of [undefined, null, "random", {}, { mode: "x" }, { mode: "random" }]) {
      expect(parse(bad)).toBeNull();
    }
    for (const count of [0, 1.5, "5", 65, null]) expect(parse({ mode: "random", count })).toBeNull();
  });
  it("bozuk snapshot'ı reddeder", () => {
    expect(parseServerMessage(wire({ type: "room", snapshot: { ...snapshot(), phase: "x" } }))).toBeNull();
    expect(
      parseServerMessage(wire({ type: "room", snapshot: { ...snapshot(), players: [{ id: 1 }] } })),
    ).toBeNull();
    expect(parseServerMessage(wire({ type: "room", snapshot: null }))).toBeNull();
  });
  it("diğer mesaj türlerini doğrular", () => {
    expect(parseServerMessage(wire({ type: "pong", t: 1, serverTime: 2 }))).toEqual({
      type: "pong",
      t: 1,
      serverTime: 2,
    });
    expect(parseServerMessage(wire({ type: "pong", t: "1", serverTime: 2 }))).toBeNull();
    expect(parseServerMessage(wire({ type: "left", reason: "kicked" }))).toEqual({
      type: "left",
      reason: "kicked",
    });
    expect(parseServerMessage(wire({ type: "left", reason: "nope" }))).toBeNull();
    expect(parseServerMessage(wire({ type: "error", code: "resume_failed", message: "x" }))?.type).toBe(
      "error",
    );
    expect(parseServerMessage(wire({ type: "error", code: "bilinmeyen", message: "x" }))).toBeNull();
    expect(parseServerMessage(wire({ type: "actionAck", seq: 3, ok: false, reason: "r" }))).toEqual({
      type: "actionAck",
      seq: 3,
      ok: false,
      reason: "r",
    });
  });
  it("patch mesajını doğrular", () => {
    expect(parseServerMessage(wire({ type: "patch", baseRev: 1, rev: 2, patch: { a: 1 } }))).toEqual({
      type: "patch",
      baseRev: 1,
      rev: 2,
      patch: { a: 1 },
    });
    expect(parseServerMessage(wire({ type: "patch", baseRev: "1", rev: 2, patch: {} }))).toBeNull();
    expect(parseServerMessage(wire({ type: "patch", baseRev: 1, rev: 2, patch: [] }))).toBeNull();
    expect(parseServerMessage(wire({ type: "patch", baseRev: 1, rev: 2 }))).toBeNull();
  });
  it("JSON olmayan ya da bilinmeyen türü reddeder", () => {
    expect(parseServerMessage("{")).toBeNull();
    expect(parseServerMessage("[]")).toBeNull();
    expect(parseServerMessage(wire({ type: "yok" }))).toBeNull();
  });
  it("reaction mesajını yalnız izinli emojiyle kabul eder", () => {
    expect(parseServerMessage(wire({ type: "reaction", playerId: "p1", emoji: "🔥" }))).toEqual({
      type: "reaction",
      playerId: "p1",
      emoji: "🔥",
    });
    expect(parseServerMessage(wire({ type: "reaction", playerId: "p1", emoji: "💩" }))).toBeNull();
    expect(parseServerMessage(wire({ type: "reaction", emoji: "🔥" }))).toBeNull();
    expect(parseServerMessage(wire({ type: "reaction", playerId: 3, emoji: "🔥" }))).toBeNull();
  });
  it("snapshot'ta lobbyReady dizi olmalı", () => {
    const parse = (lobbyReady: unknown) =>
      parseServerMessage(wire({ type: "room", snapshot: { ...snapshot(), lobbyReady } }));
    const ok = parse(["a"]);
    if (ok?.type === "room") expect(ok.snapshot.lobbyReady).toEqual(["a"]);
    else throw new Error("kabul edilmedi");
    for (const bad of [undefined, null, "a", [1], {}]) expect(parse(bad)).toBeNull();
  });
  it("nickname_taken hata kodunu tanır", () => {
    expect(parseServerMessage(wire({ type: "error", code: "nickname_taken", message: "x" }))?.type).toBe(
      "error",
    );
  });
});
