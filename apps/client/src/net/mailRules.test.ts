import { describe, expect, it } from "vitest";
import { parseMailReturn, VERIFIED_TEXT } from "./mailRules.js";

const TOKEN = "B".repeat(43);

describe("parseMailReturn", () => {
  it("doğrulama sonucu", () => {
    expect(parseMailReturn("#eposta=dogrulandi")).toEqual({
      kind: "dogrulama",
      ok: true,
      text: VERIFIED_TEXT,
    });
    expect(parseMailReturn("#eposta=gecersiz")).toMatchObject({ kind: "dogrulama", ok: false });
    expect(parseMailReturn("#eposta=garip")).toMatchObject({ kind: "dogrulama", ok: false });
  });

  it("şifre sıfırlama belirteci", () => {
    expect(parseMailReturn(`#sifre-sifirla=${TOKEN}`)).toEqual({ kind: "sifirla", token: TOKEN });
  });

  it("bozuk belirteç ve ilgisiz parça null", () => {
    expect(parseMailReturn("#sifre-sifirla=kisa")).toBeNull();
    expect(parseMailReturn(`#sifre-sifirla=${TOKEN}x`)).toBeNull();
    expect(parseMailReturn("")).toBeNull();
    expect(parseMailReturn("#google-hata=iptal")).toBeNull();
  });

  it("metinlerde teknik kelime yok", () => {
    const t = parseMailReturn("#eposta=gecersiz");
    expect(t && "text" in t ? t.text : "").not.toMatch(/token|server|debug|protocol|http/i);
  });
});
