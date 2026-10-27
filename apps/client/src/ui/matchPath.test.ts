import { describe, expect, it } from "vitest";
import { matchPath, roundLabel } from "./matchPath.js";

describe("matchPath", () => {
  it("geçilen done, şimdiki current, gelecek next", () => {
    expect(matchPath(2, 5)).toEqual(["done", "done", "current", "next", "next"]);
  });
  it("ilk ve son oyun", () => {
    expect(matchPath(0, 3)).toEqual(["current", "next", "next"]);
    expect(matchPath(4, 5)).toEqual(["done", "done", "done", "done", "current"]);
  });
  it("etiket 1 tabanlı", () => {
    expect(roundLabel(1, 5)).toBe("2/5");
    expect(roundLabel(9, 5)).toBe("5/5");
  });
});
