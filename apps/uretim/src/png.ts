/**
 * Saf JS PNG okuma ve yazma (yalnız `node:zlib`). Gelen PNG'ler RGBA'ya açılır ve yeniden kodlanır: EXIF, metin ve
 * diğer bütün yan bloklar atılır (UM-G5). Taramalı (Adam7) PNG burada açılmaz; `medya.ts` ffmpeg ile açar.
 */
import { crc32, deflateSync, inflateSync } from "node:zlib";

export const PNG_IMZA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** En çok piksel (4096 × 4096): bellek sınırı. */
export const EN_COK_PIKSEL = 4096 * 4096;

export interface Rgba {
  w: number;
  h: number;
  /** w*h*4 bayt. */
  data: Uint8Array;
}

export interface PngBaslik {
  w: number;
  h: number;
  bitDerinligi: number;
  renkTuru: number;
  taramali: boolean;
  /** Renk türü ya da tRNS bloğu saydamlık taşıyor mu. */
  alfaVar: boolean;
}

export class PngHatasi extends Error {}

interface Blok {
  tur: string;
  veri: Buffer;
}

function bloklar(buf: Buffer): Blok[] {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_IMZA)) throw new PngHatasi("PNG imzası yok");
  const out: Blok[] = [];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    if (len > 0x7fffffff || i + 12 + len > buf.length) throw new PngHatasi("blok taşıyor");
    const tur = buf.toString("latin1", i + 4, i + 8);
    if (!/^[A-Za-z]{4}$/.test(tur)) throw new PngHatasi("blok adı geçersiz");
    const veri = buf.subarray(i + 8, i + 8 + len);
    const crc = buf.readUInt32BE(i + 8 + len);
    if (crc32(buf.subarray(i + 4, i + 8 + len)) !== crc) throw new PngHatasi("blok sağlama toplamı hatalı");
    out.push({ tur, veri });
    i += 12 + len;
    if (tur === "IEND") return out;
  }
  throw new PngHatasi("IEND yok");
}

const GECERLI_DERINLIK: Record<number, readonly number[]> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
};

export function pngBaslik(buf: Buffer): PngBaslik {
  const bs = bloklar(buf);
  const ihdr = bs[0];
  if (!ihdr || ihdr.tur !== "IHDR" || ihdr.veri.length !== 13) throw new PngHatasi("IHDR yok");
  const w = ihdr.veri.readUInt32BE(0);
  const h = ihdr.veri.readUInt32BE(4);
  const bitDerinligi = ihdr.veri[8] ?? 0;
  const renkTuru = ihdr.veri[9] ?? 0;
  const taramali = ihdr.veri[12] === 1;
  if (w < 1 || h < 1) throw new PngHatasi("boyut sıfır");
  if (!GECERLI_DERINLIK[renkTuru]?.includes(bitDerinligi)) throw new PngHatasi("renk biçimi geçersiz");
  const trns = bs.some((b) => b.tur === "tRNS");
  return { w, h, bitDerinligi, renkTuru, taramali, alfaVar: renkTuru === 4 || renkTuru === 6 || trns };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Taramasız PNG'yi RGBA'ya açar. */
export function pngAc(buf: Buffer): Rgba {
  const bs = bloklar(buf);
  const b = pngBaslik(buf);
  if (b.taramali) throw new PngHatasi("taramalı PNG");
  if (b.w * b.h > EN_COK_PIKSEL) throw new PngHatasi("görsel çok büyük");
  const kanal = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[b.renkTuru] ?? 1;
  const bpp = Math.max(1, (kanal * b.bitDerinligi) >> 3);
  const satirBayt = Math.ceil((b.w * kanal * b.bitDerinligi) / 8);
  const idat = Buffer.concat(bs.filter((x) => x.tur === "IDAT").map((x) => x.veri));
  const beklenen = (satirBayt + 1) * b.h;
  let ham: Buffer;
  try {
    ham = inflateSync(idat, { maxOutputLength: beklenen + 1024 });
  } catch {
    throw new PngHatasi("görsel verisi açılamadı");
  }
  if (ham.length < beklenen) throw new PngHatasi("görsel verisi eksik");
  const plte = bs.find((x) => x.tur === "PLTE")?.veri;
  const trns = bs.find((x) => x.tur === "tRNS")?.veri;
  if (b.renkTuru === 3 && !plte) throw new PngHatasi("palet yok");

  const out = new Uint8Array(b.w * b.h * 4);
  let onceki = new Uint8Array(satirBayt);
  let satir = new Uint8Array(satirBayt);
  const maks = (1 << b.bitDerinligi) - 1;
  for (let y = 0; y < b.h; y++) {
    const off = y * (satirBayt + 1);
    const filtre = ham[off] ?? 0;
    for (let x = 0; x < satirBayt; x++) {
      const r = ham[off + 1 + x] ?? 0;
      const a = x >= bpp ? (satir[x - bpp] ?? 0) : 0;
      const u = onceki[x] ?? 0;
      const c = x >= bpp ? (onceki[x - bpp] ?? 0) : 0;
      let v: number;
      switch (filtre) {
        case 0:
          v = r;
          break;
        case 1:
          v = r + a;
          break;
        case 2:
          v = r + u;
          break;
        case 3:
          v = r + ((a + u) >> 1);
          break;
        case 4:
          v = r + paeth(a, u, c);
          break;
        default:
          throw new PngHatasi("satır süzgeci geçersiz");
      }
      satir[x] = v & 0xff;
    }
    for (let x = 0; x < b.w; x++) {
      const o = (y * b.w + x) * 4;
      const ornek = (k: number): number => {
        // k. kanal değeri 0..255.
        if (b.bitDerinligi === 8) return satir[x * kanal + k] ?? 0;
        if (b.bitDerinligi === 16) return satir[(x * kanal + k) * 2] ?? 0;
        const bit = (x * kanal + k) * b.bitDerinligi;
        const byte = satir[bit >> 3] ?? 0;
        const val = (byte >> (8 - b.bitDerinligi - (bit & 7))) & maks;
        return b.renkTuru === 3 ? val : Math.round((val * 255) / maks);
      };
      switch (b.renkTuru) {
        case 0: {
          const g = ornek(0);
          out[o] = g;
          out[o + 1] = g;
          out[o + 2] = g;
          // Gri tRNS yalnız 8 bitte uygulanır (diğer derinliklerde nadir; opak sayılır).
          out[o + 3] = trns && trns.length >= 2 && b.bitDerinligi === 8 && (trns.readUInt16BE(0) & 0xff) === g ? 0 : 255;
          break;
        }
        case 2:
          out[o] = ornek(0);
          out[o + 1] = ornek(1);
          out[o + 2] = ornek(2);
          out[o + 3] = 255;
          break;
        case 3: {
          const i = ornek(0);
          out[o] = plte?.[i * 3] ?? 0;
          out[o + 1] = plte?.[i * 3 + 1] ?? 0;
          out[o + 2] = plte?.[i * 3 + 2] ?? 0;
          out[o + 3] = trns?.[i] ?? 255;
          break;
        }
        case 4: {
          const g = ornek(0);
          out[o] = g;
          out[o + 1] = g;
          out[o + 2] = g;
          out[o + 3] = ornek(1);
          break;
        }
        default:
          out[o] = ornek(0);
          out[o + 1] = ornek(1);
          out[o + 2] = ornek(2);
          out[o + 3] = ornek(3);
      }
    }
    const t = onceki;
    onceki = satir;
    satir = t;
  }
  return { w: b.w, h: b.h, data: out };
}

function blok(tur: string, veri: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(veri.length);
  const tv = Buffer.concat([Buffer.from(tur, "latin1"), veri]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tv));
  return Buffer.concat([len, tv, crc]);
}

/** RGBA'yı yan bloksuz, 8 bit RGBA PNG olarak yazar. */
export function pngYaz(img: Rgba): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const satir = img.w * 4;
  const ham = Buffer.alloc((satir + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    // Süzgeç 1 (Sub): saydam alanlarda iyi sıkışır.
    const off = y * (satir + 1);
    ham[off] = 1;
    for (let x = 0; x < satir; x++) {
      const v = img.data[y * satir + x] ?? 0;
      const sol = x >= 4 ? (img.data[y * satir + x - 4] ?? 0) : 0;
      ham[off + 1 + x] = (v - sol) & 0xff;
    }
  }
  return Buffer.concat([PNG_IMZA, blok("IHDR", ihdr), blok("IDAT", deflateSync(ham, { level: 6 })), blok("IEND", Buffer.alloc(0))]);
}
