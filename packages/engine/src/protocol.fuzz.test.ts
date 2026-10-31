import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_LENGTH, parseClientMessage } from "./protocol.js";

const polluted = (): string[] => {
  const keys = Object.keys(Object.prototype);
  const extra = ["polluted", "kind", "type", "isAdmin"].filter((k) => k in ({} as object));
  return [...keys, ...extra];
};

function checkParse(raw: string): void {
  const parsed = parseClientMessage(raw);
  if (parsed !== null) {
    // Geçerli çıktı yeniden serileştirilip doğrulanınca aynı değere gelmeli.
    expect(parseClientMessage(JSON.stringify(parsed))).toEqual(parsed);
  }
  expect(polluted()).toEqual([]);
}

const keyArb = fc.constantFrom(
  "__proto__",
  "constructor",
  "prototype",
  "type",
  "token",
  "code",
  "nickname",
  "t",
  "gameIds",
  "polluted",
);
const jsonArb = fc.jsonValue({ maxDepth: 6 });
const hostileObject = fc.dictionary(keyArb, jsonArb, { maxKeys: 8 });

describe("parseClientMessage fuzz", () => {
  it("rastgele metin", () => {
    fc.assert(fc.property(fc.string({ unit: "binary", maxLength: 600 }), checkParse), { numRuns: 400 });
    fc.assert(fc.property(fc.string({ unit: "grapheme", maxLength: 300 }), checkParse), { numRuns: 200 });
  }, 30_000);

  it("rastgele JSON", () => {
    fc.assert(
      fc.property(jsonArb, (v) => checkParse(JSON.stringify(v))),
      { numRuns: 400 },
    );
  });

  it("type alanı geçerli, geri kalanı düşman nesneler", () => {
    const types = [
      "hello",
      "ping",
      "createRoom",
      "joinRoom",
      "joinStage",
      "chooseAvatar",
      "resume",
      "kick",
      "setGames",
      "startMatch",
      "ready",
      "gameAction",
      "leaveRoom",
      "returnToLobby",
      "continue",
      "revealContinue",
      "inspire",
      "action",
      "feedback",
    ];
    fc.assert(
      fc.property(fc.constantFrom(...types), hostileObject, (type, rest) => {
        checkParse(JSON.stringify({ ...rest, type }));
        checkParse(JSON.stringify({ type, ...rest }));
      }),
      { numRuns: 500 },
    );
  });

  it("__proto__ / constructor anahtarları ham metinde", () => {
    for (const raw of [
      '{"__proto__":{"polluted":true},"type":"ping","t":1}',
      '{"type":"ping","t":1,"__proto__":{"polluted":true}}',
      '{"type":"hello","clientVersion":"1","constructor":{"prototype":{"polluted":true}}}',
      '{"type":"setGames","gameIds":["__proto__","constructor"]}',
      '{"type":"action","action":{"__proto__":{"polluted":true}}}',
      '{"__proto__":null}',
      '[{"__proto__":{"polluted":1}}]',
    ]) {
      checkParse(raw);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("devasa ve çok derin girdi fırlatmaz", () => {
    checkParse("x".repeat(MAX_MESSAGE_LENGTH + 1));
    checkParse(`{"type":"ping","t":${"9".repeat(100_000)}}`);
    checkParse("[".repeat(200_000));
    checkParse(`${'{"a":'.repeat(3000)}1${"}".repeat(3000)}`);
    checkParse(`{"type":"kick","playerId":"${"ü".repeat(MAX_MESSAGE_LENGTH)}"}`);
    checkParse("\u0000\ud800{\udc00");
  });

  it("string olmayan girdi fırlatmaz", () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        expect(parseClientMessage(v as string)).toBeNull();
      }),
      { numRuns: 200 },
    );
  });
});
