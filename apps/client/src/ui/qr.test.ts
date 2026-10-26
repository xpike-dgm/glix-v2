import { describe, expect, it } from "vitest";
import { encodeQr, formatBits, QR_QUIET, qrPath, reedSolomon, versionFor } from "./qr.js";

describe("qr", () => {
  it("Reed-Solomon: bilinen 1-M örneği (HELLO WORLD)", () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(reedSolomon(data, 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  it("biçim bilgisi: düzey M için bilinen tablo değerleri", () => {
    expect(formatBits(0).toString(2).padStart(15, "0")).toBe("101010000010010");
    expect(formatBits(1).toString(2).padStart(15, "0")).toBe("101000100100101");
    expect(formatBits(5).toString(2).padStart(15, "0")).toBe("100000011001110");
  });

  it("sürüm seçimi bayt kapasitesine göre", () => {
    expect(versionFor(14)).toBe(1);
    expect(versionFor(15)).toBe(2);
    expect(versionFor(106)).toBe(6);
    expect(versionFor(107)).toBe(0);
  });

  it("boyut ve sabit desenler", () => {
    const m = encodeQr("https://glix.app/?oda=KX7QP");
    expect(m).not.toBeNull();
    if (!m) return;
    expect(m.length).toBe(29);
    // sol üst bulucu: köşe koyu, iç halka açık, çekirdek koyu
    expect(m[0]?.[0]).toBe(true);
    expect(m[1]?.[1]).toBe(false);
    expect(m[3]?.[3]).toBe(true);
    // zamanlama deseni ve sabit karanlık modül
    expect(m[6]?.[8]).toBe(true);
    expect(m[6]?.[9]).toBe(false);
    expect(m[m.length - 8]?.[8]).toBe(true);
  });

  it("çok uzun metin null döner", () => {
    expect(encodeQr("x".repeat(107))).toBeNull();
  });

  it("aynı girdi aynı matrisi üretir", () => {
    expect(encodeQr("abc")).toEqual(encodeQr("abc"));
  });

  it("SVG yolu sessiz bölge boyutunu içerir", () => {
    const m = encodeQr("abc");
    if (!m) throw new Error("matris yok");
    expect(qrPath(m).size).toBe(m.length + QR_QUIET * 2);
    expect(qrPath(m).d.startsWith("M")).toBe(true);
  });
});
