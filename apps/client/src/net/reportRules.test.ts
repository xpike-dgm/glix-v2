import type { PlayerInfo } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  canSendReport,
  clipNote,
  isReportError,
  noteLeft,
  REPORT_CHIPS,
  REPORT_FAILED,
  reportErrorText,
  reportTargets,
} from "./reportRules.js";

const player = (id: string, spectator = false): PlayerInfo => ({
  id,
  nickname: id,
  avatar: 0,
  connected: true,
  score: 0,
  spectator,
});

describe("bildir kuralları", () => {
  it("sebep düğmeleri sırayla ve Türkçe", () => {
    expect(REPORT_CHIPS.map((c) => c.label)).toEqual(["Uygunsuz ad", "Hakaret-küfür", "Hile", "Diğer"]);
    expect(REPORT_CHIPS.map((c) => c.id)).toEqual(["name", "abuse", "cheat", "other"]);
  });

  it("hedefler: kendin hariç herkes, izleyiciler dahil", () => {
    const list = [player("a"), player("b"), player("c", true)];
    expect(reportTargets(list, "a").map((p) => p.id)).toEqual(["b", "c"]);
    expect(reportTargets([player("a")], "a")).toEqual([]);
  });

  it("not 200 karakterde kesilir ve kalan sayılır (kod noktası)", () => {
    expect(clipNote("kısa")).toBe("kısa");
    expect(Array.from(clipNote("ç".repeat(250)))).toHaveLength(200);
    expect(Array.from(clipNote("😀".repeat(250)))).toHaveLength(200);
    expect(noteLeft("")).toBe(200);
    expect(noteLeft("abc")).toBe(197);
    expect(noteLeft("x".repeat(300))).toBe(0);
  });

  it("gönder düğmesi: sebep seçili ve istek sürmüyor", () => {
    expect(canSendReport(null, false)).toBe(false);
    expect(canSendReport("abuse", true)).toBe(false);
    expect(canSendReport("abuse", false)).toBe(true);
  });

  it("hata iletisi: sunucunun Türkçe iletisi, yoksa genel", () => {
    expect(isReportError("report_limit")).toBe(true);
    expect(isReportError("room_full")).toBe(false);
    expect(reportErrorText("report_duplicate", "Bu oyuncuyu zaten bildirdin.")).toBe(
      "Bu oyuncuyu zaten bildirdin.",
    );
    expect(reportErrorText("invalid_message", "Geçersiz mesaj.")).toBe(REPORT_FAILED);
    expect(reportErrorText("server_busy", "  ")).toBe(REPORT_FAILED);
  });
});
