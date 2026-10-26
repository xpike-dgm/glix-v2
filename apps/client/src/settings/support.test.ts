import { describe, expect, it } from "vitest";
import { formatMegabytes, hasAudioSession, hasVibrate } from "./support.js";

describe("cihaz yeteneği", () => {
  it("titreşim yalnız işlev varsa", () => {
    expect(hasVibrate({ vibrate: () => true })).toBe(true);
    expect(hasVibrate({} as Navigator)).toBe(false);
    expect(hasVibrate(undefined)).toBe(false);
  });
  it("sessiz mod anahtarı yalnız audioSession varsa", () => {
    expect(hasAudioSession({ audioSession: { type: "auto" } })).toBe(true);
    expect(hasAudioSession({})).toBe(false);
  });
});

describe("formatMegabytes", () => {
  it("yaklaşık MB yazar", () => {
    expect(formatMegabytes(18.4 * 1024 * 1024)).toBe("≈ 18 MB");
    expect(formatMegabytes(200 * 1024)).toBe("< 1 MB");
    expect(formatMegabytes(Number.NaN)).toBe("< 1 MB");
  });
});
