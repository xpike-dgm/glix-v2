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
/** Çıktı sınırı verilmeyen komutlar için (git, sürüm sorguları): küçük tutulur. */
const VARSAYILAN_CIKTI = 16 * 1024 * 1024;
/** Çözülmüş ses örnekleme hızı (tek kanal, 32 bit kayan nokta). */
const COZME_ORNEKLEME = 48_000;
/** Hiçbir alanda bundan uzun ses kabul edilmez (müzik 120 sn + pay). */
export const EN_UZUN_SES_SN = 125;
const EN_COK_KANAL = 8;
const EN_COK_ORNEKLEME = 192_000;

/** Alanın kabul ettiği en uzun ses (pay dahil): müzik 120 + 5 sn, diğerleri (efekt ≤ 2 sn) 3 sn. */
export function sesSuresiSiniri(alan: string): number {
  return alan === "muzik" ? EN_UZUN_SES_SN : 3;
}

export interface KomutSonucu {
  kod: number | null;
  cikti: Buffer;
  hata: string;
}

/**
 * Medya işleri (ffmpeg/ffprobe) aynı anda yalnız bir tane çalışır: büyük bir dosya ile aynı anda gelen başka işler
 * belleği katlamasın. Diğer komutlar (git) kuyruğa girmez.
 */
let medyaKuyrugu: Promise<unknown> = Promise.resolve();
const MEDYA_KOMUTLARI = new Set(["ffmpeg", "ffprobe"]);

export function calistir(
  komut: string,
  args: readonly string[],
  girdi?: Buffer,
  enCokCikti = VARSAYILAN_CIKTI,
): Promise<KomutSonucu> {
  if (!MEDYA_KOMUTLARI.has(komut)) return calistirHemen(komut, args, girdi, enCokCikti);
  const is = medyaKuyrugu.then(() => calistirHemen(komut, args, girdi, enCokCikti));
  medyaKuyrugu = is.catch(() => undefined);
  return is;
}

/** Şu an çalışan ya da sırada bekleyen medya işi var mı (testler için). */
export function medyaKuyruguBos(): Promise<unknown> {
  return medyaKuyrugu;
}

function calistirHemen(
  komut: string,
  args: readonly string[],
  girdi: Buffer | undefined,
  enCokCikti: number,
): Promise<KomutSonucu> {
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
    let asildi = false;
    const zaman = setTimeout(() => child.kill("SIGKILL"), ZAMAN_ASIMI_MS);
    child.stdout?.on("data", (d: Buffer) => {
      boy += d.length;
      if (boy > enCokCikti) {
        if (!asildi) child.kill("SIGKILL");
        asildi = true;
        parcalar.length = 0;
      } else parcalar.push(d);
    });
    child.stderr?.on("data", (d: Buffer) => {
      if (hata.length < 200_000) hata += d.toString("utf8");
    });
    child.on("error", () => undefined);
    child.on("close", (kod) => {
      clearTimeout(zaman);
      // Sınır aşıldıysa çıktı yarım: başarısız sayılır.
      resolve(
        asildi
          ? { kod: null, cikti: Buffer.alloc(0), hata: "çıktı sınırı aşıldı" }
          : { kod, cikti: Buffer.concat(parcalar, boy), hata },
      );
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

async function geciciDosya<T>(
  veri: Buffer,
  uzanti: string,
  fn: (yol: string, klasor: string) => Promise<T>,
): Promise<T> {
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
  const r = await calistir(
    "ffprobe",
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", yol],
    undefined,
    1024 * 1024,
  );
  if (r.kod !== 0) return null;
  try {
    const j = JSON.parse(r.cikti.toString("utf8")) as {
      streams?: ProbeAkis[];
      format?: { duration?: string };
    };
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
    const r = await calistir(
      "ffmpeg",
      ["-v", "error", "-i", yol, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"],
      undefined,
      w * h * 4,
    );
    if (r.kod !== 0 || r.cikti.length !== w * h * 4) throw new MedyaHatasi("Görsel açılamadı.");
    return { w, h, data: new Uint8Array(r.cikti.buffer, r.cikti.byteOffset, r.cikti.byteLength) };
  });
}

/** RGBA → WebP (kalite 0..100). Saydamlık korunur. */
export async function webpYaz(img: Rgba, kalite = 82): Promise<Buffer> {
  if (!(await ffmpegVar())) throw new MedyaHatasi("Dönüştürme aracı yok.");
  const r = await calistir(
    "ffmpeg",
    [
      "-v",
      "error",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${img.w}x${img.h}`,
      "-i",
      "pipe:0",
      "-frames:v",
      "1",
      "-c:v",
      "libwebp",
      "-quality",
      String(kalite),
      "-lossless",
      "0",
      "-pix_fmt",
      "yuva420p",
      "-map_metadata",
      "-1",
      "-f",
      "webp",
      "pipe:1",
    ],
    Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength),
    // WebP çıktısı ham pikselden büyük olamaz.
    img.w * img.h * 4 + 1024 * 1024,
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

/**
 * Sesin süre, kanal ve örnekleme bilgisini ffprobe ile okur; sınırı aşanı ffmpeg'i çalıştırmadan reddeder. ffprobe'un
 * süresine güvenilmez: çözme de `-t` ile kesilir ve çıktı süre × örnekleme × 4 bayt (+ pay) ile sınırlanır.
 */
async function sesOnBilgi(
  yol: string,
  enCokSure: number,
): Promise<{ sure: number; kanal: number; ornekleme: number }> {
  const p = await probe(yol);
  const a = p?.akislar.find((s) => s.codec_type === "audio");
  if (!p || !a) throw new MedyaHatasi("Ses akışı yok.");
  const sure = Math.max(p.sure ?? 0, Number(a.duration) || 0);
  const kanal = a.channels ?? 0;
  const ornekleme = Number(a.sample_rate);
  if (!(sure > 0)) throw new MedyaHatasi("Ses süresi okunamadı.");
  if (sure > enCokSure) throw new MedyaHatasi(`Ses çok uzun: en çok ${enCokSure} sn olabilir.`);
  if (kanal < 1 || kanal > EN_COK_KANAL) throw new MedyaHatasi("Ses kanal sayısı desteklenmiyor.");
  if (!Number.isFinite(ornekleme) || ornekleme < 1 || ornekleme > EN_COK_ORNEKLEME)
    throw new MedyaHatasi("Ses örnekleme hızı desteklenmiyor.");
  return { sure, kanal, ornekleme };
}

/** WAV saf JS; OGG ffmpeg ile açılır. `enCokSure` (sn) aşan ses reddedilir. */
export async function sesAc(
  veri: Buffer,
  tur: "wav" | "ogg",
  enCokSure = EN_UZUN_SES_SN,
): Promise<SesBilgisi> {
  if (tur === "wav") {
    const b = wavBaslik(veri);
    if (b.sure > enCokSure) throw new MedyaHatasi(`Ses çok uzun: en çok ${enCokSure} sn olabilir.`);
    return {
      sure: b.sure,
      kanal: b.kanal,
      ornekleme: b.ornekleme,
      mono: wavMono(veri, b),
      monoOrnekleme: b.ornekleme,
    };
  }
  if (!(await ffmpegVar())) throw new MedyaHatasi("Bu ses biçimi şu an açılamıyor.");
  return geciciDosya(veri, tur, async (yol) => {
    const on = await sesOnBilgi(yol, enCokSure);
    const sinir = Math.ceil(enCokSure * COZME_ORNEKLEME) * 4 + 64 * 1024;
    const r = await calistir(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        yol,
        "-t",
        String(enCokSure),
        "-ac",
        "1",
        "-ar",
        String(COZME_ORNEKLEME),
        "-f",
        "f32le",
        "pipe:1",
      ],
      undefined,
      sinir,
    );
    if (r.kod !== 0) throw new MedyaHatasi("Ses açılamadı.");
    const n = Math.floor(r.cikti.length / 4);
    // Hizalıysa kopyasız görünüm; değilse tek kopya.
    const mono =
      r.cikti.byteOffset % 4 === 0
        ? new Float32Array(r.cikti.buffer, r.cikti.byteOffset, n)
        : new Float32Array(r.cikti.buffer.slice(r.cikti.byteOffset, r.cikti.byteOffset + n * 4));
    return {
      sure: Math.min(on.sure, enCokSure),
      kanal: on.kanal,
      ornekleme: on.ornekleme,
      mono,
      monoOrnekleme: COZME_ORNEKLEME,
    };
  });
}

/** Bütünleşik algılanan yükseklik (LUFS), ffmpeg `ebur128`. Araç yoksa null. */
export async function lufsOlc(
  veri: Buffer,
  tur: "wav" | "ogg",
  enCokSure = EN_UZUN_SES_SN,
): Promise<number | null> {
  if (!(await ffmpegVar())) return null;
  return geciciDosya(veri, tur, async (yol) => {
    await sesOnBilgi(yol, enCokSure);
    const r = await calistir("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-i",
      yol,
      "-t",
      String(enCokSure),
      "-af",
      "ebur128=framelog=quiet",
      "-f",
      "null",
      "-",
    ]);
    if (r.kod !== 0) return null;
    const ozet = r.hata.slice(r.hata.lastIndexOf("Summary:"));
    const m = /I:\s+(-?[\d.]+|-inf)\s+LUFS/.exec(ozet);
    if (!m?.[1] || m[1] === "-inf") return null;
    const v = Number(m[1]);
    return Number.isFinite(v) ? v : null;
  });
}

/** OGG Opus, tek kanal, hedef LUFS'a normalize (UM-İ7). */
export async function opusYaz(
  veri: Buffer,
  tur: "wav" | "ogg",
  hedefLufs: number,
  enCokSure = EN_UZUN_SES_SN,
): Promise<Buffer> {
  if (!(await ffmpegVar())) throw new MedyaHatasi("Dönüştürme aracı yok.");
  return geciciDosya(veri, tur, async (yol, klasor) => {
    const cikis = join(klasor, "cikis.ogg");
    await sesOnBilgi(yol, enCokSure);
    const r = await calistir("ffmpeg", [
      "-v",
      "error",
      "-i",
      yol,
      "-t",
      String(enCokSure),
      "-ac",
      "1",
      "-af",
      `loudnorm=I=${hedefLufs}:TP=-1.5:LRA=11`,
      "-ar",
      "48000",
      "-c:a",
      "libopus",
      "-b:a",
      "96k",
      "-map_metadata",
      "-1",
      "-f",
      "ogg",
      cikis,
    ]);
    if (r.kod !== 0) throw new MedyaHatasi("Ses dönüştürülemedi.");
    return readFile(cikis);
  });
}

export { PngHatasi };
