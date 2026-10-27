import { describe, expect, it } from "vitest";
import {
  canDeleteAccount,
  deleteBody,
  deleteFormError,
  exportDoneText,
  exportFileName,
  fileNameFromDisposition,
  isIosDevice,
  saveMethod,
  usernameMatches,
} from "./kvkkRules.js";

const base = { typed: "", username: "Cihad_01", hasPassword: true, password: "" };
const IPHONE = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", platform: "iPhone" };
const MAC = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel" };

describe("silme formu", () => {
  it("kullanıcı adı büyük/küçük harf ve boşluk duyarsız eşleşir", () => {
    expect(usernameMatches("  cihad_01 ", "Cihad_01")).toBe(true);
    expect(usernameMatches("cihad_02", "Cihad_01")).toBe(false);
    expect(usernameMatches("", "Cihad_01")).toBe(false);
  });

  it("şifreli hesap: ad ve şifre birlikte şart", () => {
    expect(canDeleteAccount({ ...base, typed: "Cihad_01" })).toBe(false);
    expect(canDeleteAccount({ ...base, typed: "yanlis", password: "x" })).toBe(false);
    expect(canDeleteAccount({ ...base, typed: "Cihad_01", password: "x" })).toBe(true);
  });

  it("yalnız Google hesabı: şifre istenmez", () => {
    expect(canDeleteAccount({ ...base, hasPassword: false, typed: "cihad_01" })).toBe(true);
    expect(canDeleteAccount({ ...base, hasPassword: false, typed: "" })).toBe(false);
  });

  it("hata metinleri Türkçe ve sırayla: önce ad, sonra şifre", () => {
    expect(deleteFormError({ ...base, typed: "x" })).toBe("Kullanıcı adını doğru yaz.");
    expect(deleteFormError({ ...base, typed: "Cihad_01" })).toBe("Şifreni yaz.");
    expect(deleteFormError({ ...base, typed: "Cihad_01", password: "x" })).toBeNull();
    expect(deleteFormError({ ...base, hasPassword: false, typed: "Cihad_01" })).toBeNull();
  });

  it("gövdede şifre yalnız şifreli hesapta; yazılan ad kırpılır", () => {
    expect(deleteBody({ ...base, typed: " Cihad_01 ", password: "gizli" })).toEqual({
      confirm: "Cihad_01",
      password: "gizli",
    });
    expect(deleteBody({ ...base, hasPassword: false, typed: "Cihad_01", password: "kalinti" })).toEqual({
      confirm: "Cihad_01",
    });
  });
});

describe("dosya kaydetme", () => {
  it("iOS cihazları tanır (iPadOS Macintosh diye tanıtır; dokunmatik olması ayırır)", () => {
    expect(isIosDevice({ ...IPHONE, maxTouchPoints: 5 })).toBe(true);
    expect(isIosDevice({ ...MAC, maxTouchPoints: 5 })).toBe(true);
    expect(isIosDevice({ ...MAC, maxTouchPoints: 0 })).toBe(false);
  });

  it("yalnız iOS ana ekran uygulamasında yeni sekme; diğerlerinde indirme bağlantısı", () => {
    expect(saveMethod({ ...IPHONE, maxTouchPoints: 5, standalone: true })).toBe("tab");
    expect(saveMethod({ ...IPHONE, maxTouchPoints: 5, standalone: false })).toBe("anchor");
    expect(saveMethod({ ...MAC, maxTouchPoints: 0, standalone: true })).toBe("anchor");
  });

  it("dosya adı Türkiye saatiyle", () => {
    expect(exportFileName(Date.UTC(2026, 9, 27, 21, 30))).toBe("glix-verilerim-2026-10-28.json");
  });

  it("başlıktaki ad beklenen biçimdeyse kullanılır, değilse varsayılan", () => {
    const fb = "glix-verilerim-2026-10-27.json";
    expect(fileNameFromDisposition('attachment; filename="glix-verilerim-2026-11-02.json"', fb)).toBe(
      "glix-verilerim-2026-11-02.json",
    );
    expect(fileNameFromDisposition('attachment; filename="../../etc/passwd"', fb)).toBe(fb);
    expect(fileNameFromDisposition(null, fb)).toBe(fb);
    expect(fileNameFromDisposition("attachment", fb)).toBe(fb);
  });

  it("bitiş metni yönteme göre", () => {
    expect(exportDoneText("anchor")).toBe("Verilerin indirildi.");
    expect(exportDoneText("tab")).toMatch(/yeni sekmede/);
  });
});
