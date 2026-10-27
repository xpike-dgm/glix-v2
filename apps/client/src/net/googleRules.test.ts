import { describe, expect, it } from "vitest";
import { googleErrorText, parseGoogleReturn } from "./googleRules.js";

const TOKEN = "A".repeat(43);

describe("parseGoogleReturn", () => {
  it("hata kodunu Türkçe metne çevirir; bilinmeyen kod genel metin alır", () => {
    expect(parseGoogleReturn("#google-hata=iptal")).toEqual({
      kind: "hata",
      text: "Google ile giriş iptal edildi.",
    });
    expect(parseGoogleReturn("#google-hata=garip")).toEqual({
      kind: "hata",
      text: googleErrorText("dogrulanamadi"),
    });
  });

  it("yeni kullanıcı: belirteç ve öneri", () => {
    expect(parseGoogleReturn(`#google-yeni=${TOKEN}&u=ali_01`)).toEqual({
      kind: "yeni",
      token: TOKEN,
      suggestion: "ali_01",
    });
  });

  it("bozuk belirteç ve geçersiz öneri elenir", () => {
    expect(parseGoogleReturn("#google-yeni=kisa&u=ali")).toBeNull();
    expect(parseGoogleReturn(`#google-yeni=${TOKEN}&u=<b>x`)).toEqual({
      kind: "yeni",
      token: TOKEN,
      suggestion: "",
    });
  });

  it("ilgisiz adres parçası null", () => {
    expect(parseGoogleReturn("")).toBeNull();
    expect(parseGoogleReturn("#baska=1")).toBeNull();
  });

  it("her hata metni Türkçe ve teknik kelime içermez", () => {
    for (const code of [
      "kapali",
      "cok_deneme",
      "gecersiz",
      "iptal",
      "dogrulanamadi",
      "eposta_dogrulanmamis",
      "eposta_kayitli",
      "baska_hesap",
      "zaten_bagli",
    ])
      expect(googleErrorText(code)).not.toMatch(/token|oauth|server|debug|protocol|stage|http/i);
  });
});
