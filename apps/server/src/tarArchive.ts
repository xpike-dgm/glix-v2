/**
 * Elle yazılmış en basit tar (ustar) arşivi: yedek indirmesi için. Bağımlılık yok; yalnız düz dosyalar, ASCII adlar.
 * Biçim: her dosya için 512 baytlık başlık + içerik (512'ye tamamlanır); sonda iki boş blok.
 */
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

const BLOCK = 512;

export interface TarEntry {
  /** Arşivdeki ad: en çok 100 karakter, yalnız ASCII, "/" ve ".." yok. */
  name: string;
  /** Diskteki dosya yolu. */
  path: string;
  /** Dosya boyutu (bayt); akış sırasında değişmemelidir (geçici kopyalar sabittir). */
  size: number;
  /** Değiştirilme anı (saniye cinsinden Unix zamanı). */
  mtimeSec: number;
}

const padBlock = (n: number): number => (BLOCK - (n % BLOCK)) % BLOCK;

/** Arşivin toplam bayt boyutu (Content-Length için). */
export function tarSize(entries: readonly TarEntry[]): number {
  let total = 0;
  for (const e of entries) total += BLOCK + e.size + padBlock(e.size);
  return total + 2 * BLOCK;
}

function octal(value: number, width: number): string {
  return `${value.toString(8).padStart(width - 1, "0")}\0`;
}

/** Tek dosyanın ustar başlığı. */
export function tarHeader(entry: TarEntry): Buffer {
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(entry.name) || entry.name.includes(".."))
    throw new Error("tar: geçersiz dosya adı");
  const h = Buffer.alloc(BLOCK);
  h.write(entry.name, 0, "ascii");
  h.write(octal(0o600, 8), 100, "ascii");
  h.write(octal(0, 8), 108, "ascii");
  h.write(octal(0, 8), 116, "ascii");
  h.write(octal(entry.size, 12), 124, "ascii");
  h.write(octal(entry.mtimeSec, 12), 136, "ascii");
  h.write("        ", 148, "ascii"); // sağlama toplamı hesaplanırken boşluk sayılır
  h.write("0", 156, "ascii"); // düz dosya
  h.write("ustar\0", 257, "ascii");
  h.write("00", 263, "ascii");
  let sum = 0;
  for (const b of h) sum += b;
  h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");
  return h;
}

/** Arşivi parça parça üretir; dosyalar diskten akıtılır (bellekte tutulmaz). */
export function tarStream(entries: readonly TarEntry[]): Readable {
  async function* parts(): AsyncGenerator<Buffer> {
    for (const e of entries) {
      yield tarHeader(e);
      let sent = 0;
      for await (const chunk of createReadStream(e.path)) {
        const buf = chunk as Buffer;
        sent += buf.length;
        yield buf;
      }
      if (sent !== e.size) throw new Error("tar: dosya boyutu değişti");
      const pad = padBlock(e.size);
      if (pad > 0) yield Buffer.alloc(pad);
    }
    yield Buffer.alloc(2 * BLOCK);
  }
  return Readable.from(parts(), { objectMode: false });
}
