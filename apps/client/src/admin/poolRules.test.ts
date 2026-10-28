import type { AdminPoolField, AdminPoolSummary } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  BULK_MAX_LINES,
  badgesOf,
  bulkHint,
  emptyValues,
  entryText,
  fieldProblem,
  minText,
  pageCount,
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
