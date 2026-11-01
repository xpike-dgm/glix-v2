import type { AdminPoolField, AdminPoolSummary } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  BULK_MAX_LINES,
  badgesOf,
  bulkHint,
  emptyValues,
  entryText,
  fieldProblem,
  knownCell,
  minText,
  pageCount,
  playCell,
  poolStatus,
  splitPaste,
  valuesProblem,
} from "./poolRules.js";

const word: AdminPoolField = { key: "text", label: "Kelime", hint: "", min: 2, max: 16, long: false };
const def: AdminPoolField = { key: "definition", label: "Tanım", hint: "", min: 6, max: 100, long: true };
const summary = (o: Partial<AdminPoolSummary>): AdminPoolSummary => ({
  id: "x/y",
  gameId: "x",
  gameName: "X",
  label: "L",
  hint: "",
  fields: [word],
  min: 10,
  needed: 1,
  builtin: 50,
  custom: 0,
  disabled: 0,
  active: 50,
  applied: false,
  belowMin: false,
  ...o,
});

describe("alan ön denetimi", () => {
  it("boş, kısa, uzun, HTML", () => {
    expect(fieldProblem(word, "  ")).toBe("Kelime boş olamaz.");
    expect(fieldProblem(word, "a")).toBe("Kelime en az 2 karakter olmalı.");
    expect(fieldProblem(word, "a".repeat(17))).toBe("Kelime en çok 16 karakter olabilir (17).");
    expect(fieldProblem(word, "<b>")).toContain("içeremez");
    expect(fieldProblem(word, " deniz ")).toBeNull();
  });
  it("ilk sorunu verir; boş değerler alan sırasıyla", () => {
    expect(valuesProblem([word, def], { text: "kalem", definition: "kısa" })).toBe(
      "Tanım en az 6 karakter olmalı.",
    );
    expect(valuesProblem([word, def], { text: "kalem", definition: "yeterince uzun" })).toBeNull();
    expect(emptyValues([word, def])).toEqual({ text: "", definition: "" });
  });
});

describe("toplu yapıştırma", () => {
  it("satırlara böler, sondaki boşları atar, ortadaki boş satırı korur", () => {
    expect(splitPaste("a\r\n\nb\n\n")).toEqual({ lines: ["a", "", "b"], cut: false });
    expect(splitPaste("")).toEqual({ lines: [], cut: false });
  });
  it(`en çok ${BULK_MAX_LINES} satır alır`, () => {
    const text = Array.from({ length: BULK_MAX_LINES + 5 }, (_, i) => `k${i}`).join("\n");
    const r = splitPaste(text);
    expect(r.lines).toHaveLength(BULK_MAX_LINES);
    expect(r.cut).toBe(true);
  });
  it("yönerge alan sayısına göre", () => {
    expect(bulkHint([word])).toBe("Her satıra bir kelime yaz.");
    expect(bulkHint([word, def])).toContain("noktalı virgül");
  });
});

describe("rozetler ve durum", () => {
  it("Hazır / Eklenen / Kapalı", () => {
    expect(badgesOf({ source: "builtin", disabled: false }).map((b) => b.label)).toEqual(["Hazır"]);
    expect(badgesOf({ source: "builtin", disabled: true }).map((b) => b.label)).toEqual(["Hazır", "Kapalı"]);
    expect(badgesOf({ source: "custom", disabled: false }).map((b) => b.label)).toEqual(["Eklenen"]);
  });
  it("asgarinin altı uyarır, uygulanan bilgi verir, değişiklik yoksa sessiz", () => {
    expect(poolStatus(summary({}))).toBeNull();
    expect(poolStatus(summary({ applied: true }))?.level).toBe("ok");
    const bad = poolStatus(summary({ belowMin: true, active: 3 }));
    expect(bad?.level).toBe("bad");
    expect(bad?.text).toContain("(3)");
    expect(bad?.text).toContain("(10)");
    expect(minText(summary({ active: 7 }))).toBe("Etkin 7 · en az 10 gerekli");
  });
  it("sayfa sayısı ve girdi metni", () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
    expect(entryText({ text: "kalem", definition: "yazı aracı" }, [word, def])).toBe("kalem · yazı aracı");
  });
});

describe("bilinirlik (SB-M7)", () => {
  it("az veride yalnız oran; %40 üstü ağırlık yarıda, %60 üstü kapatma önerisi", () => {
    expect(knownCell(undefined).text).toBe("henüz oynanmadı");
    expect(knownCell({ shown: 4, knew: 4 })).toEqual({ text: "%100 · 4 oyun", badge: null });
    expect(knownCell({ shown: 10, knew: 4 }).badge).toBeNull();
    expect(knownCell({ shown: 10, knew: 5 }).badge?.label).toBe("Ağırlık yarıda");
    expect(knownCell({ shown: 10, knew: 7 }).badge?.label).toBe("Kapatma önerisi");
    expect(
      badgesOf({ source: "builtin", disabled: false, known: { shown: 20, knew: 15 } }, true),
    ).toHaveLength(2);
    expect(badgesOf({ source: "builtin", disabled: false, known: { shown: 20, knew: 15 } })).toHaveLength(1);
  });
  it("seçim alanı yalnız seçeneklerden birini kabul eder", () => {
    const type: AdminPoolField = {
      ...word,
      key: "type",
      label: "Tür",
      min: 4,
      max: 5,
      options: ["isim", "sıfat"],
    };
    expect(fieldProblem(type, "")).toBe("Tür seçilmeli.");
    expect(fieldProblem(type, "edat")).toMatch(/şunlardan biri/);
    expect(fieldProblem(type, "isim")).toBeNull();
  });
});

describe("kelime karnesi (CG-M6)", () => {
  it("az veride yalnız sayılar; 8 oyundan sonra kolay / zor / kapatma önerisi", () => {
    expect(playCell(undefined).text).toBe("henüz oynanmadı");
    expect(playCell({ games: 3, top: 0.9, single: 0.1 })).toEqual({
      text: "3 oyun · ağ %90 · tek %10",
      badge: null,
    });
    expect(playCell({ games: 8, top: 0.85, single: 0.1 }).badge?.label).toBe("Kolay önerisi");
    expect(playCell({ games: 8, top: 0.25, single: 0.7 }).badge?.label).toBe("Zor önerisi");
    expect(playCell({ games: 8, top: 0, single: 1 }).badge?.label).toBe("Kapatma önerisi");
    expect(playCell({ games: 8, top: 0.5, single: 0.3 }).badge).toBeNull();
    expect(
      badgesOf({ source: "builtin", disabled: false, play: { games: 9, top: 0, single: 1 } }, false, true),
    ).toHaveLength(2);
  });
  it("isteğe bağlı seçim alanı boş bırakılabilir", () => {
    const level: AdminPoolField = {
      ...word,
      key: "level",
      label: "Zorluk",
      min: 0,
      max: 5,
      options: ["kolay", "orta", "zor"],
    };
    expect(fieldProblem(level, "")).toBeNull();
    expect(fieldProblem(level, "çok")).toMatch(/şunlardan biri/);
    expect(fieldProblem(level, "zor")).toBeNull();
  });
});

describe("çift karnesi (KD-M8)", () => {
  it("yakalanma ve tahmin oranı; 8 oyundan sonra uzak / çok yakın önerisi", () => {
    expect(playCell({ games: 4, top: 0.75, single: 0.25 }, "cift")).toEqual({
      text: "4 oyun · yakalanma %75 · tahmin %25",
      badge: null,
    });
    expect(playCell({ games: 8, top: 0.9, single: 0 }, "cift").badge?.label).toBe("Uzak önerisi");
    expect(playCell({ games: 8, top: 0.1, single: 0 }, "cift").badge?.label).toBe("Çok yakın önerisi");
    expect(playCell({ games: 8, top: 0.5, single: 0 }, "cift").badge).toBeNull();
    expect(
      badgesOf(
        { source: "builtin", disabled: false, play: { games: 9, top: 1, single: 0 } },
        false,
        true,
        "cift",
      ).map((b) => b.label),
    ).toEqual(["Hazır", "Uzak önerisi"]);
  });
});
