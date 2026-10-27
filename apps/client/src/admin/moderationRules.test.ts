import {
  BANNED_WORDS_MAX as ENGINE_MAX,
  REPORT_ADMIN_NOTE_MAX as ENGINE_NOTE,
  REPORT_REASONS as ENGINE_REASON_IDS,
  REPORT_REASON_LABELS as ENGINE_REASONS,
  REPORT_STATUSES as ENGINE_STATUS_IDS,
  REPORT_STATUS_LABELS as ENGINE_STATUSES,
  BANNED_WORD_LENGTH_MAX as ENGINE_WORD,
} from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  adminNoteProblem,
  BANNED_WORD_LENGTH_MAX,
  BANNED_WORDS_MAX,
  bannedWordProblem,
  isReportReason,
  isReportStatus,
  QUEUE_FILTERS,
  REPORT_ADMIN_NOTE_MAX,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  REPORT_STATUS_LABELS,
  REPORT_STATUSES,
  targetKind,
} from "./moderationRules.js";

describe("moderasyon kuralları motorla aynıdır", () => {
  it("sabitler ve etiketler", () => {
    expect(BANNED_WORDS_MAX).toBe(ENGINE_MAX);
    expect(BANNED_WORD_LENGTH_MAX).toBe(ENGINE_WORD);
    expect(REPORT_ADMIN_NOTE_MAX).toBe(ENGINE_NOTE);
    expect([...REPORT_STATUSES]).toEqual([...ENGINE_STATUS_IDS]);
    expect([...REPORT_REASONS]).toEqual([...ENGINE_REASON_IDS]);
    expect(REPORT_STATUS_LABELS).toEqual(ENGINE_STATUSES);
    expect(REPORT_REASON_LABELS).toEqual(ENGINE_REASONS);
  });
});

describe("moderasyon form denetimleri", () => {
  it("durum ve sebep tanıma", () => {
    expect(isReportStatus("actioned")).toBe(true);
    expect(isReportStatus("yeni")).toBe(false);
    expect(isReportReason("abuse")).toBe(true);
    expect(isReportReason(5)).toBe(false);
  });

  it("yasaklı kelime ön denetimi", () => {
    expect(bannedWordProblem("  ", 0)).toMatch(/boş/);
    expect(bannedWordProblem("x".repeat(41), 0)).toMatch(/en çok 40/);
    expect(bannedWordProblem("x".repeat(40), 0)).toBeNull();
    expect(bannedWordProblem("kelime", 500)).toMatch(/Liste dolu/);
    expect(bannedWordProblem("kelime", 499)).toBeNull();
  });

  it("yönetici notu sınırı", () => {
    expect(adminNoteProblem("")).toBeNull();
    expect(adminNoteProblem("a".repeat(300))).toBeNull();
    expect(adminNoteProblem("a".repeat(301))).toMatch(/en çok 300/);
  });

  it("kuyruk süzgeçleri ve hedef türü", () => {
    expect(QUEUE_FILTERS.map((f) => f.label)).toEqual([
      "Yeni",
      "İncelendi",
      "İşlem yapıldı",
      "Reddedildi",
      "Tümü",
    ]);
    expect(targetKind({ targetAccountId: 4, inRoom: false })).toBe("account");
    expect(targetKind({ targetAccountId: null, inRoom: true })).toBe("guest-in-room");
    expect(targetKind({ targetAccountId: null, inRoom: false })).toBe("guest-gone");
  });
});
