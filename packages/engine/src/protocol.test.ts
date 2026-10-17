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
