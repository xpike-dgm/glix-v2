/**
 * Dosya güvenliği (UM-G5): yalnız izinli türler; tür uzantıdan değil içerikten anlaşılır; görseller yeniden kodlanır
 * (EXIF ve bütün yan bloklar atılır); SVG temizlenir; metinler geçerli UTF-8 olmalı; hiçbir dosya çalıştırılmaz.
 */

import { EN_UZUN_SES_SN, gorselAc, MedyaHatasi, sesAc } from "./medya.js";
import { DOSYA_TURLERI, type DosyaTuru } from "./ortak/alanlar.js";
import type { DosyaMeta } from "./ortak/tipler.js";
import { PngHatasi, pngYaz } from "./png.js";
import { SvgHatasi, svgTemizle } from "./svg.js";
import { WavHatasi } from "./wav.js";

export const BOYUT_SINIRI: Record<"gorsel" | "ses" | "metin", number> = {
  gorsel: 20 * 1024 * 1024,
  ses: 30 * 1024 * 1024,
  metin: 2 * 1024 * 1024,
};

export function sinif(tur: DosyaTuru): "gorsel" | "ses" | "metin" {
  if (tur === "png" || tur === "webp") return "gorsel";
  if (tur === "ogg" || tur === "wav") return "ses";
  return "metin";
}

export const MIME: Record<DosyaTuru, string> = {
  png: "image/png",
  webp: "image/webp",
  ogg: "audio/ogg",
  wav: "audio/wav",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};

export class DosyaHatasi extends Error {}

/** Dosya adı: yalnız taban ad; küçük harf, rakam, nokta, tire, alt çizgi; uzantı izinli türlerden biri. */
export function dosyaAdi(ham: unknown): { ad: string; uzanti: DosyaTuru } {
  if (typeof ham !== "string" || ham.length < 1 || ham.length > 120)
    throw new DosyaHatasi("Dosya adı geçersiz.");
  if (/[/\\\0]/.test(ham) || ham.includes("..") || ham.startsWith("."))
    throw new DosyaHatasi("Dosya adı geçersiz.");
  const ad = ham
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-");
  const m = /^([a-z0-9][a-z0-9._-]*)\.([a-z0-9]+)$/.exec(ad);
  const uz = m?.[2];
  if (!m || !uz || !(DOSYA_TURLERI as readonly string[]).includes(uz))
    throw new DosyaHatasi("Bu dosya türü kabul edilmiyor.");
  return { ad, uzanti: uz as DosyaTuru };
}

const metinMi = (b: Buffer): string | null => {
  if (b.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(b);
  } catch {
    return null;
  }
};

/** İçerikten tür. Uzantı ile çelişirse hata. */
export function gercekTur(veri: Buffer, uzanti: DosyaTuru): DosyaTuru {
  const bas = (n: number): string => veri.toString("latin1", 0, n);
  let tur: DosyaTuru | null = null;
  if (veri.length >= 8 && veri[0] === 0x89 && bas(4) === "\x89PNG") tur = "png";
  else if (bas(4) === "RIFF" && veri.toString("latin1", 8, 12) === "WEBP") tur = "webp";
  else if (bas(4) === "RIFF" && veri.toString("latin1", 8, 12) === "WAVE") tur = "wav";
  else if (bas(4) === "OggS") tur = "ogg";
  else {
    const s = metinMi(veri);
    if (s === null) throw new DosyaHatasi("Dosyanın içeriği tanınmadı.");
    const t = s.trimStart();
    if (uzanti === "svg") tur = /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(t) ? "svg" : null;
    else if (uzanti === "json") {
      try {
        JSON.parse(s);
        tur = "json";
      } catch {
        throw new DosyaHatasi("JSON dosyası okunamadı.");
      }
    } else if (uzanti === "md" || uzanti === "csv")
      tur = /^\s*<(svg|\?xml|html|script)/i.test(t) ? null : uzanti;
  }
  if (tur !== uzanti) throw new DosyaHatasi("Dosyanın içeriği uzantısıyla uyuşmuyor.");
  return tur;
}

/** JSON derinlik sınırı (aşırı iç içe yapı). */
function derinlik(v: unknown, d = 0): number {
  if (d > 64) return d;
  if (Array.isArray(v)) return Math.max(d, ...v.map((x) => derinlik(x, d + 1)));
  if (v && typeof v === "object") return Math.max(d, ...Object.values(v).map((x) => derinlik(x, d + 1)));
  return d;
}

const DALGA_PARCA = 160;

export function dalga(mono: Float32Array): number[] {
  const out: number[] = [];
  const adim = Math.max(1, Math.floor(mono.length / DALGA_PARCA));
  for (let i = 0; i < DALGA_PARCA && i * adim < mono.length; i++) {
    let t = 0;
    for (let j = i * adim; j < Math.min(mono.length, (i + 1) * adim); j++)
      t = Math.max(t, Math.abs(mono[j] ?? 0));
    out.push(Math.round(t * 1000) / 1000);
  }
  return out;
}

export interface IslenmisDosya {
  tur: DosyaTuru;
  veri: Buffer;
  meta: DosyaMeta | null;
  /** Kullanıcıya gösterilecek notlar (ör. "SVG'den betik atıldı"). */
  notlar: string[];
}

/**
 * Gelen dosyayı doğrular ve güvenli biçime getirir. Görseller RGBA'dan yeniden PNG yazılır (WebP de PNG olur).
 * Saklanan bayt, sonradan bütün kontrollerin ve paketin kaynağıdır.
 */
export async function dosyaIsle(
  veri: Buffer,
  adHam: unknown,
  enCokSesSuresi = EN_UZUN_SES_SN,
): Promise<IslenmisDosya & { ad: string }> {
  const { ad, uzanti } = dosyaAdi(adHam);
  if (veri.length === 0) throw new DosyaHatasi("Dosya boş.");
  if (veri.length > BOYUT_SINIRI[sinif(uzanti)]) throw new DosyaHatasi("Dosya boyutu sınırı aşıyor.");
  const tur = gercekTur(veri, uzanti);
  try {
    if (tur === "png" || tur === "webp") {
      const img = await gorselAc(veri, tur);
      const png = pngYaz(img);
      let alfa = false;
      for (let i = 3; i < img.data.length; i += 4)
        if ((img.data[i] ?? 255) < 255) {
          alfa = true;
          break;
        }
      return {
        ad: tur === "webp" ? ad.replace(/\.webp$/, ".png") : ad,
        tur: "png",
        veri: png,
        meta: { tur: "gorsel", w: img.w, h: img.h, alfa },
        notlar: tur === "webp" ? ["WebP görsel yeniden kodlandı (PNG)."] : [],
      };
    }
    if (tur === "wav" || tur === "ogg") {
      const s = await sesAc(veri, tur, enCokSesSuresi);
      return {
        ad,
        tur,
        veri,
        meta: {
          tur: "ses",
          sure: Math.round(s.sure * 1000) / 1000,
          kanal: s.kanal,
          ornekleme: s.ornekleme,
          dalga: dalga(s.mono),
        },
        notlar: [],
      };
    }
    const metin = metinMi(veri) ?? "";
    if (tur === "svg") {
      const s = svgTemizle(metin);
      return {
        ad,
        tur,
        veri: Buffer.from(s.temiz, "utf8"),
        meta: { tur: "metin", satir: 1 },
        notlar: s.atilanlar.length ? [`SVG'den atılanlar: ${s.atilanlar.slice(0, 8).join(", ")}`] : [],
      };
    }
    if (tur === "json") {
      const j: unknown = JSON.parse(metin);
      if (derinlik(j) > 32) throw new DosyaHatasi("JSON çok iç içe.");
    }
    return { ad, tur, veri, meta: { tur: "metin", satir: metin.split("\n").length }, notlar: [] };
  } catch (err) {
    if (err instanceof DosyaHatasi) throw err;
    if (err instanceof PngHatasi || err instanceof WavHatasi)
      throw new DosyaHatasi(`Dosya bozuk: ${err.message}.`);
    if (err instanceof SvgHatasi || err instanceof MedyaHatasi) throw new DosyaHatasi(err.message);
    throw new DosyaHatasi("Dosya işlenemedi.");
  }
}
