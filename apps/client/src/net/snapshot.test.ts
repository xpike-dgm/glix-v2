import { describe, expect, it } from "vitest";
import { snapshot } from "./fixtures.js";
import { shouldAccept } from "./snapshot.js";

describe("snapshot sıralaması", () => {
  it("ilk snapshot kabul edilir", () => {
    expect(shouldAccept(null, snapshot())).toBe(true);
  });
  it("daha yeni rev kabul, eski ve aynı rev yok sayılır", () => {
    const cur = snapshot("lobby", { rev: 5 });
    expect(shouldAccept(cur, snapshot("lobby", { rev: 6 }))).toBe(true);
    expect(shouldAccept(cur, snapshot("lobby", { rev: 5 }))).toBe(false);
    expect(shouldAccept(cur, snapshot("lobby", { rev: 4 }))).toBe(false);
  });
  it("başka odaya geçilince rev düşük olsa da kabul edilir", () => {
    const cur = snapshot("lobby", { rev: 50 });
    expect(shouldAccept(cur, snapshot("lobby", { rev: 1, code: "ZZZZZ" }))).toBe(true);
  });
});
