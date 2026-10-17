import { describe, expect, it } from "vitest";
import { isIosSafari, pickInstallHint } from "./installHint.js";

const base = { standalone: false, dismissed: false, canPrompt: false, iosSafari: false };

describe("pickInstallHint", () => {
  it("hiçbir imkan yoksa ipucu yok", () => {
    expect(pickInstallHint(base)).toBeNull();
  });
  it("Chromium istemi varsa 'prompt'", () => {
    expect(pickInstallHint({ ...base, canPrompt: true })).toBe("prompt");
  });
  it("iOS Safari'de yönerge", () => {
    expect(pickInstallHint({ ...base, iosSafari: true })).toBe("ios");
  });
  it("kurulu (standalone) ya da kapatılmışsa asla göstermez", () => {
    expect(pickInstallHint({ ...base, canPrompt: true, standalone: true })).toBeNull();
    expect(pickInstallHint({ ...base, iosSafari: true, standalone: true })).toBeNull();
    expect(pickInstallHint({ ...base, canPrompt: true, dismissed: true })).toBeNull();
    expect(pickInstallHint({ ...base, iosSafari: true, dismissed: true })).toBeNull();
  });
});

describe("isIosSafari", () => {
  const safari =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
  it("iPhone Safari", () => {
    expect(isIosSafari({ userAgent: safari, platform: "iPhone", maxTouchPoints: 5 })).toBe(true);
  });
  it("iPadOS Safari (Macintosh görünümlü)", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15";
    expect(isIosSafari({ userAgent: ua, platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
    expect(isIosSafari({ userAgent: ua, platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
  });
  it("iOS üzerindeki Chrome/Firefox sayılmaz", () => {
    const chrome = safari.replace("Version/17.4", "CriOS/123.0").replace(/ Safari\/604.1/, " Safari/604.1");
    expect(isIosSafari({ userAgent: chrome, platform: "iPhone", maxTouchPoints: 5 })).toBe(false);
  });
  it("Android Chrome sayılmaz", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36";
    expect(isIosSafari({ userAgent: ua, platform: "Linux armv8l", maxTouchPoints: 5 })).toBe(false);
  });
});
