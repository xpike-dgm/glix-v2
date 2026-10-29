import { describe, expect, it } from "vitest";
import {
  errorTextForCode,
  GENERIC_ERROR,
  KNOWN_ERROR_CODES,
  looksTechnical,
  NETWORK_ERROR,
  playerErrorText,
} from "./errorText.js";
import { shopErrorText } from "./shopRules.js";

const SERVER_CODES = [
  "unknown_item",
  "already_owned",
  "insufficient_glix",
  "not_owned",
  "unknown_colour",
  "invalid_input",
  "forbidden",
  "not_found",
  "method_not_allowed",
  "server_error",
  "rate_limited",
  "login_required",
];

describe("hata metinleri", () => {
  it("mağaza ve genel sunucu kodlarının hepsinin Türkçe karşılığı var", () => {
    for (const c of SERVER_CODES) {
      expect(KNOWN_ERROR_CODES).toContain(c);
      const text = shopErrorText(c);
      expect(text, c).not.toBe("");
      expect(text, c).not.toMatch(/_|undefined|null/);
    }
    expect(shopErrorText("unknown_colour")).toBe("Bu renk seçilemez.");
  });

  it("bilinmeyen kod ve boş değer genel mesaja düşer", () => {
    expect(errorTextForCode("yeni_kod")).toBe(GENERIC_ERROR);
    expect(errorTextForCode(null)).toBe(GENERIC_ERROR);
    expect(shopErrorText(null)).toBe(GENERIC_ERROR);
    expect(shopErrorText("network")).toBe(NETWORK_ERROR);
  });

  it("teknik görünen sunucu mesajı gösterilmez", () => {
    for (const m of [
      "unknown_item",
      "500",
      "null",
      "undefined",
      "Internal Server Error",
      "",
      "TypeError: x is undefined",
    ])
      expect(looksTechnical(m), m).toBe(true);
    expect(playerErrorText("insufficient_glix", "insufficient_glix")).toBe("Yeterli Glix yok.");
    expect(playerErrorText("server_error", undefined)).toBe(GENERIC_ERROR);
    expect(playerErrorText("zzz", 500)).toBe(GENERIC_ERROR);
  });

  it("Türkçe sunucu mesajı olduğu gibi gösterilir", () => {
    expect(looksTechnical("Kod hatalı.")).toBe(false);
    expect(playerErrorText("invalid_input", "Kod hatalı.")).toBe("Kod hatalı.");
  });
});
