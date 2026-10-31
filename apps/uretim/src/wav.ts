/** Saf JS WAV (RIFF) okuyucu: başlık ve PCM örnekleri. ffmpeg yokken de ses kontrollerinin çoğu çalışsın diye. */

export interface WavBaslik {
  kanal: number;
  ornekleme: number;
  bit: number;
  bicim: "pcm" | "float";
  /** Veri bloğunun başı ve uzunluğu. */
  veriBasi: number;
  veriBoyu: number;
  sure: number;
}

export class WavHatasi extends Error {}

export function wavBaslik(buf: Buffer): WavBaslik {
  if (buf.length < 44 || buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WAVE")
    throw new WavHatasi("WAV imzası yok");
  let i = 12;
  let fmt: { kanal: number; ornekleme: number; bit: number; bicim: number } | null = null;
  while (i + 8 <= buf.length) {
    const ad = buf.toString("latin1", i, i + 4);
    const boy = buf.readUInt32LE(i + 4);
    const bas = i + 8;
    if (ad === "fmt ") {
      if (boy < 16 || bas + 16 > buf.length) throw new WavHatasi("biçim bloğu kısa");
      let bicim = buf.readUInt16LE(bas);
      // WAVE_FORMAT_EXTENSIBLE: alt biçim GUID'in ilk iki baytı.
      if (bicim === 0xfffe && boy >= 40 && bas + 26 <= buf.length) bicim = buf.readUInt16LE(bas + 24);
      fmt = {
        bicim,
        kanal: buf.readUInt16LE(bas + 2),
        ornekleme: buf.readUInt32LE(bas + 4),
        bit: buf.readUInt16LE(bas + 14),
      };
    } else if (ad === "data") {
      if (!fmt) throw new WavHatasi("biçim bloğu yok");
      const veriBoyu = Math.min(boy, buf.length - bas);
      const { kanal, ornekleme, bit } = fmt;
      if (kanal < 1 || kanal > 8 || ornekleme < 8000 || ornekleme > 192_000) throw new WavHatasi("biçim değerleri geçersiz");
      const bicim = fmt.bicim === 3 ? "float" : fmt.bicim === 1 ? "pcm" : null;
      if (!bicim || (bicim === "pcm" && ![8, 16, 24, 32].includes(bit)) || (bicim === "float" && bit !== 32))
        throw new WavHatasi("desteklenmeyen WAV biçimi");
      const kare = (bit / 8) * kanal;
      return { kanal, ornekleme, bit, bicim, veriBasi: bas, veriBoyu, sure: Math.floor(veriBoyu / kare) / ornekleme };
    }
    i = bas + boy + (boy & 1);
  }
  throw new WavHatasi("veri bloğu yok");
}

/** Kanalları ortalayarak tek kanal -1..1 örnekler. */
export function wavMono(buf: Buffer, b: WavBaslik = wavBaslik(buf)): Float32Array {
  const bayt = b.bit / 8;
  const kare = bayt * b.kanal;
  const n = Math.floor(b.veriBoyu / kare);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let t = 0;
    for (let k = 0; k < b.kanal; k++) {
      const o = b.veriBasi + i * kare + k * bayt;
      let v: number;
      if (b.bicim === "float") v = buf.readFloatLE(o);
      else if (b.bit === 8) v = ((buf[o] ?? 128) - 128) / 128;
      else if (b.bit === 16) v = buf.readInt16LE(o) / 32768;
      else if (b.bit === 24) v = buf.readIntLE(o, 3) / 8388608;
      else v = buf.readInt32LE(o) / 2147483648;
      t += v;
    }
    out[i] = t / b.kanal;
  }
  return out;
}

/** Test ve örnek üretimi için 16 bit PCM WAV yazar. */
export function wavYaz(ornekler: Float32Array, ornekleme: number, kanal = 1): Buffer {
  const veri = Buffer.alloc(ornekler.length * 2);
  for (let i = 0; i < ornekler.length; i++) {
    const v = Math.max(-1, Math.min(1, ornekler[i] ?? 0));
    veri.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "latin1");
  h.writeUInt32LE(36 + veri.length, 4);
  h.write("WAVE", 8, "latin1");
  h.write("fmt ", 12, "latin1");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(kanal, 22);
  h.writeUInt32LE(ornekleme, 24);
  h.writeUInt32LE(ornekleme * 2 * kanal, 28);
  h.writeUInt16LE(2 * kanal, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36, "latin1");
  h.writeUInt32LE(veri.length, 40);
  return Buffer.concat([h, veri]);
}
