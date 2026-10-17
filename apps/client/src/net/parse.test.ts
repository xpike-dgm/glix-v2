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
  it("JSON olmayan ya da bilinmeyen türü reddeder", () => {
    expect(parseServerMessage("{")).toBeNull();
    expect(parseServerMessage("[]")).toBeNull();
    expect(parseServerMessage(wire({ type: "yok" }))).toBeNull();
  });
});
