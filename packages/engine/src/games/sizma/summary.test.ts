import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeSizma } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("sizma tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeSizma(result, players, {"reveal": {"infiltrator": "c", "caught": true}});
    expect(line).toBe("Mert sızmaydı ve yakalandı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeSizma(result, players, {"reveal": {"infiltrator": "c", "caught": false}});
    expect(line).toBe("Mert sızmaydı, kimse anlamadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeSizma(result, players, {"reveal": null})).toBeNull();
  });
});
