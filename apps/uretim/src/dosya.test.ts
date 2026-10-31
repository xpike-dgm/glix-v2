import { crc32, deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { DosyaHatasi, dosyaAdi, dosyaIsle, gercekTur } from "./dosya.js";
import { PNG_IMZA, pngAc, pngBaslik, pngYaz } from "./png.js";
import { SvgHatasi, svgTemizle } from "./svg.js";
import { gorsel } from "./test/ortam.js";
import { wavBaslik, wavMono, wavYaz } from "./wav.js";

function blok(tur: string, veri: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(veri.length);
  const tv = Buffer.concat([Buffer.from(tur, "latin1"), veri]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc32(tv));
  return Buffer.concat([len, tv, c]);
}

describe("PNG", () => {
  it("yazar ve aynen geri açar", () => {
    const png = gorsel(20, 10);
    const img = pngAc(png);
    expect(img.w).toBe(20);
    expect(img.h).toBe(10);
    expect(pngAc(pngYaz(img)).data).toEqual(img.data);
  });

  it("paletli PNG'yi tRNS ile açar", () => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(2, 0);
    ihdr.writeUInt32BE(1, 4);
    ihdr[8] = 8;
    ihdr[9] = 3;
    const png = Buffer.concat([
      PNG_IMZA,
      blok("IHDR", ihdr),
      blok("PLTE", Buffer.from([255, 0, 0, 0, 255, 0])),
      blok("tRNS", Buffer.from([0, 255])),
      blok("IDAT", deflateSync(Buffer.from([0, 0, 1]))),
      blok("IEND", Buffer.alloc(0)),
    ]);
    const img = pngAc(png);
    expect([...img.data]).toEqual([255, 0, 0, 0, 0, 255, 0, 255]);
  });

  it("EXIF ve metin blokları yeniden kodlamada atılır", async () => {
    const temiz = gorsel(8, 8);
    const iend = temiz.length - 12;
    const kirli = Buffer.concat([
      temiz.subarray(0, iend),
      blok("eXIf", Buffer.from("GPS:41.0,29.0")),
      blok("tEXt", Buffer.from("Yazar\0gizli")),
      temiz.subarray(iend),
    ]);
    const d = await dosyaIsle(kirli, "x.png");
    expect(d.veri.includes(Buffer.from("GPS"))).toBe(false);
    expect(d.veri.includes(Buffer.from("gizli"))).toBe(false);
    expect(d.meta).toMatchObject({ tur: "gorsel", w: 8, h: 8, alfa: true });
  });

  it("bozuk sağlama toplamını reddeder", () => {
    const png = Buffer.from(gorsel(4, 4));
    png[20] = (png[20] ?? 0) ^ 0xff;
    expect(() => pngBaslik(png)).toThrow();
  });
});

describe("dosya türü ve ad güvenliği", () => {
  it("yol enjeksiyonu ve izinsiz uzantılar reddedilir", () => {
    for (const ad of [
      "../x.png",
      "a/b.png",
      "..\\x.png",
      ".gizli.png",
      "x.exe",
      "x.html",
      "x.js",
      "x",
      "x.png\0.txt",
    ])
      expect(() => dosyaAdi(ad), ad).toThrow(DosyaHatasi);
    expect(dosyaAdi("Neon Çerçeve.PNG")).toEqual({ ad: "neon-cerceve.png", uzanti: "png" });
  });

  it("içerik uzantıyla uyuşmalı", () => {
    const png = gorsel(4, 4);
    expect(() => gercekTur(png, "wav")).toThrow(/uyuşmuyor/);
    expect(() => gercekTur(Buffer.from("<html><script>alert(1)</script>"), "md")).toThrow();
    expect(() => gercekTur(Buffer.from("<svg onload=x>"), "json")).toThrow();
    expect(() => gercekTur(Buffer.from([0xff, 0xfe, 0x00, 0x41]), "csv")).toThrow();
    expect(gercekTur(Buffer.from('{"a":1}'), "json")).toBe("json");
  });

  it("boyut sınırı aşılınca reddedilir", async () => {
    await expect(dosyaIsle(Buffer.alloc(2 * 1024 * 1024 + 1, 0x41), "x.md")).rejects.toThrow(/boyut/);
  });

  it("aşırı iç içe JSON reddedilir", async () => {
    await expect(dosyaIsle(Buffer.from(`${"[".repeat(40)}${"]".repeat(40)}`), "x.json")).rejects.toThrow(
      /iç içe/,
    );
  });
});

describe("SVG temizleme", () => {
  it("betik, olay, dış bağlantı ve stil atılır", () => {
    const r = svgTemizle(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="alert(1)"><script>alert(2)</script><style>@import url(http://x)</style><a href="https://kotu.example"><path d="M0 0" fill="url(https://x/y)"/></a><use href="#ic"/><foreignObject><div>x</div></foreignObject><path id="ic" d="M1 1" fill="currentColor"/></svg>`,
    );
    expect(r.temiz).not.toMatch(/script|onload|@import|https:|foreignObject|<a/i);
    expect(r.temiz).toContain('href="#ic"');
    expect(r.viewBox).toEqual([0, 0, 24, 24]);
  });

  it("javascript: değeri ve DOCTYPE reddedilir", () => {
    expect(svgTemizle(`<svg><use href="javascript:alert(1)"/></svg>`).temiz).not.toContain("javascript");
    expect(() =>
      svgTemizle(`<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>`),
    ).toThrow(SvgHatasi);
  });
});

describe("WAV", () => {
  it("yazar ve okur", () => {
    const s = new Float32Array(4800).map((_, i) => Math.sin(i / 10) * 0.5);
    const w = wavYaz(s, 48000);
    const b = wavBaslik(w);
    expect(b).toMatchObject({ kanal: 1, ornekleme: 48000, bit: 16 });
    expect(b.sure).toBeCloseTo(0.1, 3);
    expect(wavMono(w)[10]).toBeCloseTo(Math.sin(1) * 0.5, 3);
  });
});
