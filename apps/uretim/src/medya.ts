/**
 * Görsel ve ses işleme: `ffmpeg`/`ffprobe` komut satırı aracı (npm bağımlılığı yok). Komut kabuksuz çalışır,
 * argümanlar dizi olarak verilir; giriş dosyası her zaman sitenin geçici klasöründeki kendi dosyasıdır. ffmpeg yoksa
 * bu işlemler "atlandı" sayılır ve saf JS ile yapılabilenler (PNG, WAV) yine yapılır.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PngHatasi, pngAc, pngBaslik, type Rgba } from "./png.js";
import { wavBaslik, wavMono } from "./wav.js";

const ZAMAN_ASIMI_MS = 120_000;
const EN_COK_CIKTI = 512 * 1024 * 1024;

export interface KomutSonucu {
  kod: number | null;
  cikti: Buffer;
  hata: string;
}

export function calistir(komut: string, args: readonly string[], girdi?: Buffer): Promise<KomutSonucu> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(komut, args, { stdio: ["pipe", "pipe", "pipe"], shell: false });
    } catch {
      resolve({ kod: null, cikti: Buffer.alloc(0), hata: "başlatılamadı" });
      return;
    }
    const parcalar: Buffer[] = [];
    let boy = 0;
    let hata = "";
    const zaman = setTimeout(() => child.kill("SIGKILL"), ZAMAN_ASIMI_MS);
    child.stdout?.on("data", (d: Buffer) => {
      boy += d.length;
      if (boy > EN_COK_CIKTI) child.kill("SIGKILL");
      else parcalar.push(d);
    });
    child.stderr?.on("data", (d: Buffer) => {
      if (hata.length < 200_000) hata += d.toString("utf8");
    });
    child.on("error", () => undefined);
    child.on("close", (kod) => {
      clearTimeout(zaman);
      resolve({ kod, cikti: Buffer.concat(parcalar), hata });
    });
    child.stdin?.on("error", () => undefined);
    if (girdi) child.stdin?.end(girdi);
    else child.stdin?.end();
  });
}

let ffmpegDurumu: Promise<boolean> | null = null;

/** ffmpeg ve ffprobe kurulu mu (bir kez sorulur). `URETIM_FFMPEG=0` ile kapatılabilir (testler). */
export function ffmpegVar(): Promise<boolean> {
  if (process.env.URETIM_FFMPEG === "0") return Promise.resolve(false);
  ffmpegDurumu ??= Promise.all([calistir("ffmpeg", ["-version"]), calistir("ffprobe", ["-version"])]).then(
    ([a, b]) => a.kod === 0 && b.kod === 0,
  );
  return ffmpegDurumu;
}

async function geciciDosya<T>(veri: Buffer, uzanti: string, fn: (yol: string, klasor: string) => Promise<T>): Promise<T> {
  const klasor = await mkdtemp(join(tmpdir(), "uretim-"));
  const yol = join(klasor, `girdi.${uzanti}`);
  try {
    await writeFile(yol, veri);
    return await fn(yol, klasor);
  } finally {
    await rm(klasor, { recursive: true, force: true });
  }
}

interface ProbeAkis {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  channels?: number;
  sample_rate?: string;
  duration?: string;
}

async function probe(yol: string): Promise<{ akislar: ProbeAkis[]; sure: number | null } | null> {
  const r = await calistir("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", yol]);
  if (r.kod !== 0) return null;
  try {
    const j = JSON.parse(r.cikti.toString("utf8")) as { streams?: ProbeAkis[]; format?: { duration?: string } };
    const sure = Number(j.format?.duration);
    return { akislar: Array.isArray(j.streams) ? j.streams : [], sure: Number.isFinite(sure) ? sure : null };
  } catch {
    return null;
  }
}

export class MedyaHatasi extends Error {}

/** PNG ya da WebP'yi RGBA'ya açar. PNG taramasızsa saf JS; değilse ffmpeg. */
export async function gorselAc(veri: Buffer, tur: "png" | "webp"): Promise<Rgba> {
  if (tur === "png") {
    const b = pngBaslik(veri);
    if (!b.taramali) return pngAc(veri);
  }
  if (!(await ffmpegVar())) throw new MedyaHatasi("Bu görsel biçimi şu an açılamıyor.");
  return geciciDosya(veri, tur, async (yol) => {
    const p = await probe(yol);
    const v = p?.akislar.find((s) => s.codec_type === "video");
    const w = v?.width ?? 0;
    const h = v?.height ?? 0;
    if (w < 1 || h < 1 || w * h > 4096 * 4096) throw new MedyaHatasi("Görsel açılamadı.");
    const r = await calistir("ffmpeg", ["-v", "error", "-i", yol, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"]);
    if (r.kod !== 0 || r.cikti.length !== w * h * 4) throw new MedyaHatasi("Görsel açılamadı.");
    return { w, h, data: new Uint8Array(r.cikti) };
  });
}

/** RGBA → WebP (kalite 0..100). Saydamlık korunur. */
export async function webpYaz(img: Rgba, kalite = 82): Promise<Buffer> {
  if (!(await ffmpegVar())) throw new MedyaHatasi("Dönüştürme aracı yok.");
  const r = await calistir(
    "ffmpeg",
    [
      "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${img.w}x${img.h}`, "-i", "pipe:0",
      "-frames:v", "1", "-c:v", "libwebp", "-quality", String(kalite), "-lossless", "0", "-pix_fmt", "yuva420p",
      "-map_metadata", "-1", "-f", "webp", "pipe:1",
    ],
    Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength),
  );
  if (r.kod !== 0 || r.cikti.length < 12) throw new MedyaHatasi("WebP yazılamadı.");
  return r.cikti;
}

export interface SesBilgisi {
  sure: number;
  kanal: number;
  ornekleme: number;
  /** Tek kanala indirilmiş örnekler (analiz için). */
  mono: Float32Array;
  monoOrnekleme: number;
}

/** WAV saf JS; OGG ffmpeg ile açılır. */
export async function sesAc(veri: Buffer, tur: "wav" | "ogg"): Promise<SesBilgisi> {
  if (tur === "wav") {
    const b = wavBaslik(veri);
    return { sure: b.sure, kanal: b.kanal, ornekleme: b.ornekleme, mono: wavMono(veri, b), monoOrnekleme: b.ornekleme };
  }
  if (!(await ffmpegVar())) throw new MedyaHatasi("Bu ses biçimi şu an açılamıyor.");
  return geciciDosya(veri, tur, async (yol) => {
    const p = await probe(yol);
    const a = p?.akislar.find((s) => s.codec_type === "audio");
    if (!a) throw new MedyaHatasi("Ses akışı yok.");
    const r = await calistir("ffmpeg", ["-v", "error", "-i", yol, "-ac", "1", "-ar", "48000", "-f", "f32le", "pipe:1"]);
    if (r.kod !== 0) throw new MedyaHatasi("Ses açılamadı.");
    const mono = new Float32Array(r.cikti.buffer, r.cikti.byteOffset, Math.floor(r.cikti.length / 4)).slice();
    const ornekleme = Number(a.sample_rate);
    return {
      sure: p?.sure ?? mono.length / 48000,
      kanal: a.channels ?? 1,
      ornekleme: Number.isFinite(ornekleme) ? ornekleme : 48000,
      mono,
      monoOrnekleme: 48000,
    };
  });
}

/** Bütünleşik algılanan yükseklik (LUFS), ffmpeg `ebur128`. Araç yoksa null. */
export async function lufsOlc(veri: Buffer, tur: "wav" | "ogg"): Promise<number | null> {
  if (!(await ffmpegVar())) return null;
  return geciciDosya(veri, tur, async (yol) => {
    const r = await calistir("ffmpeg", ["-hide_banner", "-nostats", "-i", yol, "-af", "ebur128=framelog=quiet", "-f", "null", "-"]);
    if (r.kod !== 0) return null;
    const ozet = r.hata.slice(r.hata.lastIndexOf("Summary:"));
    const m = /I:\s+(-?[\d.]+|-inf)\s+LUFS/.exec(ozet);
    if (!m?.[1] || m[1] === "-inf") return null;
    const v = Number(m[1]);
    return Number.isFinite(v) ? v : null;
  });
}

/** OGG Opus, tek kanal, hedef LUFS'a normalize (UM-İ7). */
export async function opusYaz(veri: Buffer, tur: "wav" | "ogg", hedefLufs: number): Promise<Buffer> {
  if (!(await ffmpegVar())) throw new MedyaHatasi("Dönüştürme aracı yok.");
  return geciciDosya(veri, tur, async (yol, klasor) => {
    const cikis = join(klasor, "cikis.ogg");
    const r = await calistir("ffmpeg", [
      "-v", "error", "-i", yol, "-ac", "1", "-af", `loudnorm=I=${hedefLufs}:TP=-1.5:LRA=11`, "-ar", "48000",
      "-c:a", "libopus", "-b:a", "96k", "-map_metadata", "-1", "-f", "ogg", cikis,
    ]);
    if (r.kod !== 0) throw new MedyaHatasi("Ses dönüştürülemedi.");
    return readFile(cikis);
  });
}

export { PngHatasi };
