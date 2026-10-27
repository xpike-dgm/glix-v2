import {
  ANNOUNCEMENT_MAX_AHEAD_MS as ENGINE_AHEAD,
  ANNOUNCEMENT_MAX as ENGINE_ANN,
  BROADCAST_BODY_MAX as ENGINE_BODY,
  BROADCAST_TITLE_MAX as ENGINE_TITLE,
} from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_MAX,
  ANNOUNCEMENT_MAX_AHEAD_MS,
  BROADCAST_BODY_MAX,
  BROADCAST_TITLE_MAX,
  backupQuotaText,
  charCount,
  endsAtFromInput,
  fmtRemaining,
  inputFromEndsAt,
  maintenanceOnWarning,
  poolNote,
  sitePathProblem,
  textProblem,
} from "./contentRules.js";

describe("içerik kuralları sunucuyla aynı sınırları taşır", () => {
  it("sabitler motorla eşleşir", () => {
    expect(ANNOUNCEMENT_MAX).toBe(ENGINE_ANN);
    expect(BROADCAST_TITLE_MAX).toBe(ENGINE_TITLE);
    expect(BROADCAST_BODY_MAX).toBe(ENGINE_BODY);
    expect(ANNOUNCEMENT_MAX_AHEAD_MS).toBe(ENGINE_AHEAD);
  });
});

describe("metin denetimi", () => {
  it("karakter sayısı kırpılmış ve kod noktasıyla sayılır", () => {
    expect(charCount("  a   b  ")).toBe(3);
    expect(charCount("😀😀")).toBe(2);
    expect(charCount("")).toBe(0);
  });

  it("boş, uzun, HTML ve denetim karakteri sorun sayılır", () => {
    expect(textProblem("Merhaba", 140, "Metin")).toBeNull();
    expect(textProblem("   ", 140, "Metin")).toBe("Metin boş olamaz.");
    expect(textProblem("x".repeat(141), 140, "Metin")).toBe("Metin en çok 140 karakter olabilir (141).");
    expect(textProblem("<b>x</b>", 140, "Metin")).toContain("içeremez");
    expect(textProblem("a\nb", 140, "Metin")).toContain("satır sonu");
    expect(textProblem("a‮b", 140, "Başlık")).toContain("görünmez");
    expect(textProblem("x".repeat(40), 40, "Başlık")).toBeNull();
  });
});

describe("bağlantı yolu", () => {
  it("boş ya da site içi yol", () => {
    for (const ok of ["", "/", "/?oda=ABCDE", "/profil"]) expect(sitePathProblem(ok)).toBeNull();
    for (const bad of ["profil", "//kotu.example", "https://kotu.example", "/a b", `/${"x".repeat(100)}`])
      expect(sitePathProblem(bad)).not.toBeNull();
  });
});

describe("duyuru bitiş zamanı", () => {
  const now = new Date(2026, 9, 27, 12, 0).getTime();
  it("boşsa süresiz", () => {
    expect(endsAtFromInput("", now)).toEqual({ ok: true, endsAt: null });
  });
  it("yerel saatten anı hesaplar ve geri çevirir", () => {
    const r = endsAtFromInput("2026-10-28T21:30", now);
    expect(r).toEqual({ ok: true, endsAt: new Date(2026, 9, 28, 21, 30).getTime() });
    if (r.ok && r.endsAt !== null) expect(inputFromEndsAt(r.endsAt)).toBe("2026-10-28T21:30");
  });
  it("geçmiş, 30 günden uzak ve bozuk değerler reddedilir", () => {
    for (const bad of [
      "2026-10-27T11:59",
      "2026-10-27T12:00",
      "2026-12-30T10:00",
      "yarin",
      "2026-02-31T10:00",
    ])
      expect(endsAtFromInput(bad, now).ok).toBe(false);
  });
});

describe("gösterim metinleri", () => {
  it("kalan süre", () => {
    expect(fmtRemaining(1000)).toBe("1 dk");
    expect(fmtRemaining(59 * 60_000)).toBe("59 dk");
    expect(fmtRemaining(125 * 60_000)).toBe("2 sa 5 dk");
    expect(fmtRemaining(28 * 3600_000)).toBe("1 g 4 sa");
  });

  it("rastgele havuz notu varsayılandan farkı söyler", () => {
    expect(poolNote({ randomPool: true, engineRandomPool: true })).toBe("varsayılan: havuzda");
    expect(poolNote({ randomPool: false, engineRandomPool: false })).toBe("varsayılan: dışında");
    expect(poolNote({ randomPool: false, engineRandomPool: true })).toContain("çıkarıldı");
    expect(poolNote({ randomPool: true, engineRandomPool: false })).toContain("eklendi");
  });

  it("yedek hakkı", () => {
    expect(backupQuotaText({ usedToday: 1, limit: 3, nextAt: null }, 0)).toBe(
      "Son 24 saatte 1/3 yedek alındı.",
    );
    expect(backupQuotaText({ usedToday: 3, limit: 3, nextAt: 90 * 60_000 }, 0)).toContain("1 sa 30 dk sonra");
  });

  it("bakım uyarısı süren maç sayısını söyler", () => {
    expect(maintenanceOnWarning(0)).toContain("süren maç yok");
    expect(maintenanceOnWarning(3)).toContain("3 maç sürüyor");
  });
});
