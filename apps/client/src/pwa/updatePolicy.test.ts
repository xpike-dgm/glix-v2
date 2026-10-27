import { PROTOCOL_VERSION } from "@glix/engine";
import { describe, expect, it } from "vitest";
import type { ScreenId } from "../screens/route.js";
import {
  CHECK_MIN_GAP_MS,
  CLIENT_PROTOCOL_VERSION,
  decideUpdate,
  isProtocolMismatch,
  isSafeScreen,
  shouldCheckNow,
} from "./updatePolicy.js";

const ALL: ScreenId[] = [
  "home",
  "join",
  "login",
  "register",
  "aydinlatma",
  "notfound",
  "lobby",
  "briefing",
  "countdown",
  "playing",
  "results",
  "final",
];
const SAFE: ScreenId[] = ["home", "notfound", "lobby", "final"];
const UNSAFE = ALL.filter((s) => !SAFE.includes(s));
const P = CLIENT_PROTOCOL_VERSION;

describe("decideUpdate", () => {
  it("bekleyen sürüm ve uyumsuzluk yoksa hiçbir ekranda bir şey yapmaz", () => {
    for (const screen of ALL) {
      expect(decideUpdate({ waiting: false, screen, serverProtocol: P })).toBe("none");
      expect(decideUpdate({ waiting: false, screen, serverProtocol: null })).toBe("none");
    }
  });
  it("güvenli ekranlarda bekleyen sürümü sormadan uygular", () => {
    for (const screen of SAFE)
      expect(decideUpdate({ waiting: true, screen, serverProtocol: P })).toBe("apply-now-silently");
  });
  it("sunucu henüz bilinmiyorsa da güvenli anda uygular", () => {
    expect(decideUpdate({ waiting: true, screen: "home", serverProtocol: null })).toBe("apply-now-silently");
  });
  it("anlatım, geri sayım, oyun, sonuç ve katıl yazımında asla uygulamaz, bekler", () => {
    expect(UNSAFE).toEqual(expect.arrayContaining(["briefing", "countdown", "playing", "results"]));
    for (const screen of UNSAFE)
      expect(decideUpdate({ waiting: true, screen, serverProtocol: P })).toBe("wait-for-safe-moment");
  });
  it("oyundan finale geçince bekleyen sürüm uygulanır", () => {
    expect(decideUpdate({ waiting: true, screen: "playing", serverProtocol: P })).toBe(
      "wait-for-safe-moment",
    );
    expect(decideUpdate({ waiting: true, screen: "final", serverProtocol: P })).toBe("apply-now-silently");
  });
  it("protokol uyuşmazsa her ekranda engeller (bekleyen sürüm olsun olmasın)", () => {
    for (const screen of ALL)
      for (const waiting of [true, false])
        expect(decideUpdate({ waiting, screen, serverProtocol: P + 1 })).toBe("block-required");
  });
  it("istemci sunucudan yeniyse de (geri alma) engeller", () => {
    expect(decideUpdate({ waiting: false, screen: "home", serverProtocol: P - 1 })).toBe("block-required");
  });
  it("açık clientProtocol verilince onu kullanır", () => {
    expect(decideUpdate({ waiting: false, screen: "home", serverProtocol: 3, clientProtocol: 3 })).toBe(
      "none",
    );
    expect(decideUpdate({ waiting: false, screen: "home", serverProtocol: 3, clientProtocol: 2 })).toBe(
      "block-required",
    );
  });
});

describe("isProtocolMismatch / isSafeScreen", () => {
  it("bilinmeyen sunucu uyumsuz sayılmaz", () => {
    expect(isProtocolMismatch(null, 2)).toBe(false);
    expect(isProtocolMismatch(2, 2)).toBe(false);
    expect(isProtocolMismatch(3, 2)).toBe(true);
  });
  it("güvenli ekran kümesi", () => {
    for (const s of SAFE) expect(isSafeScreen(s)).toBe(true);
    for (const s of UNSAFE) expect(isSafeScreen(s)).toBe(false);
  });
});

describe("shouldCheckNow", () => {
  it("ilk denetim her zaman yapılır", () => {
    expect(shouldCheckNow(1000, null)).toBe(true);
  });
  it("5 dakikadan önce yapılmaz, sonra yapılır", () => {
    expect(shouldCheckNow(CHECK_MIN_GAP_MS - 1, 0)).toBe(false);
    expect(shouldCheckNow(CHECK_MIN_GAP_MS, 0)).toBe(true);
  });
  it("zorla denetim aralığı yok sayar", () => {
    expect(shouldCheckNow(10, 5, true)).toBe(true);
  });
});

describe("sürüm artırma korkuluğu", () => {
  it("istemcinin beklediği protokol, motor sabitiyle aynıdır", () => {
    expect(CLIENT_PROTOCOL_VERSION).toBe(PROTOCOL_VERSION);
  });
  it("protokol sürümü pozitif tam sayıdır", () => {
    expect(Number.isInteger(PROTOCOL_VERSION) && PROTOCOL_VERSION >= 1).toBe(true);
  });
});
