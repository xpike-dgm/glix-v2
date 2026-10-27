import { describe, expect, it } from "vitest";
import {
  auditDetail,
  auditLabel,
  confirmMatches,
  failRatio,
  fmtAgo,
  fmtDuration,
  fmtNum,
  fmtPct,
  fmtRate,
  fmtUntil,
  level,
  methodsLabel,
  phaseLabel,
  shortDay,
  USERNAME_OK,
} from "./format.js";

describe("yönetici biçimleyicileri", () => {
  it("süre", () => {
    expect(fmtDuration(7)).toBe("7 sn");
    expect(fmtDuration(125)).toBe("2 dk 5 sn");
    expect(fmtDuration(3900)).toBe("1 sa 5 dk");
    expect(fmtDuration(2 * 86400 + 3 * 3600)).toBe("2 g 3 sa");
    expect(fmtDuration(-5)).toBe("0 sn");
  });
  it("veri hızı", () => {
    expect(fmtRate(812)).toBe("812 B/sn");
    expect(fmtRate(12.5 * 1024)).toBe("12,5 KB/sn");
    expect(fmtRate(1.5 * 1048576)).toBe("1,5 MB/sn");
  });
  it("yüzde, ondalık, gün", () => {
    expect(fmtPct(0.126)).toBe("%13");
    expect(fmtNum(1.25, 2)).toBe("1,25");
    expect(shortDay("2026-10-27")).toBe("27 Eki");
    expect(shortDay("2026-01-05")).toBe("5 Oca");
    expect(shortDay("bozuk")).toBe("bozuk");
  });
  it("ne kadar önce", () => {
    const now = 1_000_000_000;
    expect(fmtAgo(now - 5_000, now)).toBe("az önce");
    expect(fmtAgo(now - 5 * 60_000, now)).toBe("5 dk önce");
    expect(fmtAgo(now - 3 * 3600_000, now)).toBe("3 sa önce");
    expect(fmtAgo(now - 2 * 86400_000, now)).toBe("2 g önce");
  });
  it("eşik düzeyi ve aşama adı", () => {
    expect(level(10, 50, 100)).toBe("ok");
    expect(level(50, 50, 100)).toBe("warn");
    expect(level(100, 50, 100)).toBe("bad");
    expect(phaseLabel("playing")).toBe("Oyunda");
    expect(phaseLabel("yeni")).toBe("yeni");
  });
});

describe("hesap ve işlem kaydı biçimleyicileri", () => {
  it("auditLabel: bilinen kodlar Türkçe, bilinmeyen olduğu gibi", () => {
    expect(auditLabel("account_suspend")).toBe("Hesap askıya alındı");
    expect(auditLabel("account_view")).toBe("Hesap ayrıntısı görüntülendi");
    expect(auditLabel("otp_ok")).toBe("Panele giriş yapıldı");
    expect(auditLabel("yeni_bir_sey")).toBe("yeni_bir_sey");
  });

  it("auditDetail: süre, oturum sayısı, e-posta durumu okunur; boş kalır", () => {
    expect(auditDetail("account_suspend", "7d")).toBe("Süre: 7 gün");
    expect(auditDetail("account_suspend", "forever")).toBe("Süre: süresiz");
    expect(auditDetail("account_logout_all", "3")).toBe("3 oturum");
    expect(auditDetail("otp_request", "mail_failed")).toBe("e-posta gitmedi");
    expect(auditDetail("account_view", "")).toBe("");
  });

  it("methodsLabel ve fmtUntil", () => {
    expect(methodsLabel({ password: true, google: false })).toBe("Şifre");
    expect(methodsLabel({ password: false, google: true })).toBe("Google");
    expect(methodsLabel({ password: true, google: true })).toBe("Şifre + Google");
    expect(fmtUntil(null)).toBe("süresiz");
    expect(fmtUntil(0)).toContain("tarihine kadar");
  });

  it("confirmMatches: büyük/küçük harf ve boşluk önemsiz, boş eşleşmez", () => {
    expect(confirmMatches("  ALi_1 ", "ali_1")).toBe(true);
    expect(confirmMatches("ali", "ali_1")).toBe(false);
    expect(confirmMatches("", "")).toBe(false);
  });

  it("USERNAME_OK ve failRatio", () => {
    expect(USERNAME_OK.test("Ali_01")).toBe(true);
    expect(USERNAME_OK.test("a")).toBe(false);
    expect(USERNAME_OK.test("bosluk var")).toBe(false);
    expect(failRatio({ ok: 0, failed: 0 })).toBeNull();
    expect(failRatio({ ok: 3, failed: 1 })).toBe(0.25);
  });
});
