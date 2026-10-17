import { describe, expect, it } from "vitest";
import { buildReport } from "./errors.js";

describe("buildReport", () => {
  it("yığını 2 KB'a, iletiyi 500 karaktere, ua'yı 200'e kırpar; adresten yalnız yol kalır", () => {
    const err = new Error("m".repeat(900));
    err.stack = "s".repeat(5000);
    const r = buildReport(err, "/oda/ABCDE?token=x#y", "u".repeat(400));
    expect(r.message).toHaveLength(500);
    expect(r.stack).toHaveLength(2048);
    expect(r.ua).toHaveLength(200);
    expect(r.url).toBe("/oda/ABCDE");
  });
  it("Error olmayan nedenler de bildirilir", () => {
    expect(buildReport("düz metin", "/", "ua").message).toBe("düz metin");
    expect(buildReport({ a: 1 }, "/", "ua").message).toBe("Bilinmeyen hata");
  });
});
