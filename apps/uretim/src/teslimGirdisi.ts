/**
 * Teslim paketi biçimi (docs/uretim/YAPAY-ZEKA-EKIBI.md bölüm 3) ve doğrulaması. MCP `teslim_et`/`on_kontrol`,
 * SSH komut aracı ve elle yükleme aynı biçimi kullanır. Ağdan gelen her alan burada denetlenir; bilinmeyen anahtar
 * reddedilir.
 */
import { kayit, metin, tamsayi } from "./http.js";
import type { AlanTanimi } from "./ortak/alanlar.js";
import { type FikirAlanlari, fikirAlanlari } from "./ortak/fikir.js";
import { URETIM_YONTEMLERI, type UretimYontemi } from "./ortak/gorselKurali.js";
import { raporDogrula, yapiliRaporMu } from "./ortak/rapor.js";
import { DESTEKLENEN_TURLER, type Degisiklik, TESLIM_TURLERI, type TeslimTuru } from "./ortak/tipler.js";

export const EN_COK_OGE = 50;
export const EN_COK_DOSYA_OGE = 40;
export const EN_COK_SATIR = 500;

export interface DosyaBaglantisi {
  dosyaId: string;
  hedefYol: string | null;
  rol: string | null;
}

export interface OgeGirdisi {
  ad: string;
  aciklama: string;
  gerekce: string;
  dosyalar: DosyaBaglantisi[];
  satirlar: unknown[];
  degisiklikler: Degisiklik[];
  kaldirilacaklar: string[];
  onizleme: { ekran: string; not: string } | null;
  oncekiOge: number | null;
  rapor: unknown;
  /** Fikir teslimi: nasıl görünecek, renk, hareket. */
  gorunus: string;
  /** Yapılandırılmış fikir (fikir panosu); eski düz metin fikirde null. */
  fikir: FikirAlanlari | null;
  /** Bu öğe hangi onaylı fikri uyguluyor ("Onaylananları uygula" işi). */
  fikirId: number | null;
}

export interface TeslimGirdisi {
  isId: number | null;
  tur: TeslimTuru;
  aciklama: string;
  ogeler: OgeGirdisi[];
  /** Yapay zekânın bildirdiği araç ve model (isteğe bağlı, sözleşme bölüm 8). */
  arac: string | null;
  model: string | null;
  /** Görseller nasıl üretildi (sözleşme bölüm 10): görsel alanlarında "kod" reddedilir, yoksa uyarı. */
  uretimYontemi: UretimYontemi | null;
}

export type Ayrisma<T> = { ok: true; deger: T } | { ok: false; hatalar: string[] };

const OGE_ANAHTARLARI = new Set([
  "ad",
  "aciklama",
  "gerekce",
  "dosyalar",
  "satirlar",
  "katalogSatirlari",
  "degisiklikler",
  "kaldirilacaklar",
  "onizleme",
  "oncekiOge",
  "rapor",
  "gorunus",
  "ozet",
  "kategori",
  "etki",
  "zahmet",
  "fikirId",
]);

export const ONIZLEME_EKRANLARI = [
  "magaza-kart",
  "avatar-lobi",
  "skor-seridi",
  "kursu",
  "zafer",
  "giris",
  "kart-arkasi",
  "koleksiyon",
  "ses-ani",
  "oyun-ani",
] as const;

/** Oyun deposundaki hedef yol: göreli, `..` yok, alanın izinli öneklerinden biriyle başlar. */
export function hedefYolUygun(yol: string, alan: AlanTanimi): boolean {
  if (yol.length > 200 || !/^[a-z0-9][a-z0-9._/-]*$/.test(yol)) return false;
  if (yol.includes("..") || yol.includes("//") || yol.endsWith("/")) return false;
  return alan.hedefOnekleri.some((o) => (o.endsWith("/") ? yol.startsWith(o) : yol === o));
}

const json = (v: unknown): number => {
  try {
    return JSON.stringify(v)?.length ?? 0;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

function ogeAyristir(
  v: unknown,
  sira: number,
  alan: AlanTanimi,
  hatalar: string[],
  tur: string,
): OgeGirdisi | null {
  const yer = `${sira + 1}. öğe`;
  if (!kayit(v)) {
    hatalar.push(`${yer}: nesne olmalı.`);
    return null;
  }
  for (const k of Object.keys(v))
    if (!OGE_ANAHTARLARI.has(k)) hatalar.push(`${yer}: bilinmeyen alan "${k.slice(0, 30)}".`);
  const ad = metin(v.ad, 1, 60);
  if (!ad) hatalar.push(`${yer}: "ad" 1–60 karakter olmalı.`);
  const aciklama = v.aciklama === undefined ? "" : metin(v.aciklama, 0, 500);
  if (aciklama === null) hatalar.push(`${yer}: "aciklama" en çok 500 karakter.`);
  const gerekce = v.gerekce === undefined ? "" : metin(v.gerekce, 0, 1000);
  if (gerekce === null) hatalar.push(`${yer}: "gerekce" en çok 1000 karakter.`);

  const dosyalar: DosyaBaglantisi[] = [];
  if (v.dosyalar !== undefined) {
    if (!Array.isArray(v.dosyalar) || v.dosyalar.length > EN_COK_DOSYA_OGE)
      hatalar.push(`${yer}: "dosyalar" en çok ${EN_COK_DOSYA_OGE} öğelik liste olmalı.`);
    else
      for (const d of v.dosyalar) {
        if (!kayit(d) || typeof d.dosyaId !== "string" || !/^[A-Za-z0-9_-]{16,40}$/.test(d.dosyaId)) {
          hatalar.push(`${yer}: dosya kimliği geçersiz.`);
          continue;
        }
        let hedefYol: string | null = null;
        if (d.hedefYol !== undefined) {
          if (typeof d.hedefYol !== "string" || !hedefYolUygun(d.hedefYol, alan)) {
            hatalar.push(`${yer}: hedef yol bu alana ait değil ya da geçersiz.`);
            continue;
          }
          hedefYol = d.hedefYol;
        }
        const rol = d.rol === undefined ? null : metin(d.rol, 1, 30);
        if (d.rol !== undefined && rol === null) hatalar.push(`${yer}: "rol" 1–30 karakter.`);
        dosyalar.push({ dosyaId: d.dosyaId, hedefYol, rol });
      }
  }

  const satirHam = v.satirlar ?? v.katalogSatirlari;
  let satirlar: unknown[] = [];
  if (satirHam !== undefined) {
    if (!Array.isArray(satirHam) || satirHam.length > EN_COK_SATIR)
      hatalar.push(`${yer}: satırlar en çok ${EN_COK_SATIR} olabilir.`);
    else if (json(satirHam) > 1_000_000) hatalar.push(`${yer}: satırlar çok büyük.`);
    else satirlar = satirHam;
  }

  const degisiklikler: Degisiklik[] = [];
  if (v.degisiklikler !== undefined) {
    if (!Array.isArray(v.degisiklikler) || v.degisiklikler.length > EN_COK_SATIR)
      hatalar.push(`${yer}: "degisiklikler" listesi geçersiz.`);
    else
      for (const d of v.degisiklikler) {
        if (!kayit(d) || !kayit(d.eski) || !kayit(d.yeni) || json(d) > 20_000) {
          hatalar.push(`${yer}: her değişiklik { eski, yeni } nesnesi olmalı.`);
          continue;
        }
        const id = d.id === undefined ? null : metin(d.id, 1, 80);
        degisiklikler.push({ id, eski: d.eski, yeni: d.yeni });
      }
  }

  const kaldirilacaklar: string[] = [];
  if (v.kaldirilacaklar !== undefined) {
    if (!Array.isArray(v.kaldirilacaklar) || v.kaldirilacaklar.length > EN_COK_SATIR)
      hatalar.push(`${yer}: "kaldirilacaklar" listesi geçersiz.`);
    else
      for (const k of v.kaldirilacaklar) {
        const t = metin(k, 1, 200);
        if (t) kaldirilacaklar.push(t);
        else hatalar.push(`${yer}: kaldırılacak kimlik geçersiz.`);
      }
  }

  let onizleme: OgeGirdisi["onizleme"] = null;
  if (v.onizleme !== undefined) {
    const o = v.onizleme;
    if (
      !kayit(o) ||
      typeof o.ekran !== "string" ||
      !(ONIZLEME_EKRANLARI as readonly string[]).includes(o.ekran)
    )
      hatalar.push(`${yer}: önizleme ekranı geçersiz.`);
    else onizleme = { ekran: o.ekran, not: metin(o.not ?? "", 0, 300) ?? "" };
  }
  const oncekiOge = v.oncekiOge === undefined ? null : tamsayi(v.oncekiOge, 1, 1e12);
  if (v.oncekiOge !== undefined && oncekiOge === null) hatalar.push(`${yer}: "oncekiOge" geçersiz.`);
  let rapor: unknown = v.rapor === undefined ? null : v.rapor;
  if (json(rapor) > 1_000_000) hatalar.push(`${yer}: rapor çok büyük.`);
  // Yapılandırılmış rapor (ozet/seriler/tablolar/bulgular) sıkı doğrulanır; eski biçim olduğu gibi kalır.
  else if (yapiliRaporMu(rapor)) rapor = raporDogrula(rapor, yer, hatalar);
  // Fikir alanları yalnız fikir teslimlerinde; biri varsa hepsi zorunlu.
  let fikir: FikirAlanlari | null = null;
  if (["ozet", "kategori", "etki", "zahmet"].some((k) => v[k] !== undefined)) {
    if (tur !== "fikir")
      hatalar.push(
        `${yer}: ozet, kategori, etki ve zahmet yalnız fikir teslimlerinde (tur: "fikir") yazılır.`,
      );
    else fikir = fikirAlanlari(v, yer, hatalar);
  }
  const fikirId = v.fikirId === undefined || v.fikirId === null ? null : tamsayi(v.fikirId, 1, 1e12);
  if (v.fikirId !== undefined && v.fikirId !== null && fikirId === null)
    hatalar.push(`${yer}: "fikirId" geçersiz.`);

  const gorunus = v.gorunus === undefined ? "" : metin(v.gorunus, 0, 600);
  if (gorunus === null) hatalar.push(`${yer}: "gorunus" en çok 600 karakter.`);
  if (!ad || aciklama === null || gerekce === null || gorunus === null) return null;
  return {
    ad,
    aciklama,
    gerekce,
    dosyalar,
    satirlar,
    degisiklikler,
    kaldirilacaklar,
    onizleme,
    oncekiOge,
    rapor,
    gorunus,
    fikir,
    fikirId,
  };
}

export function teslimAyristir(v: unknown, alan: AlanTanimi): Ayrisma<TeslimGirdisi> {
  const hatalar: string[] = [];
  if (!kayit(v)) return { ok: false, hatalar: ["Teslim bir nesne olmalı."] };
  for (const k of Object.keys(v))
    if (!["isId", "tur", "aciklama", "ogeler", "arac", "model", "uretimYontemi"].includes(k))
      hatalar.push(`Bilinmeyen alan "${k.slice(0, 30)}".`);
  const tur = v.tur;
  if (typeof tur !== "string" || !(TESLIM_TURLERI as readonly string[]).includes(tur))
    return {
      ok: false,
      hatalar: ['"tur" şunlardan biri olmalı: yeni, duzenleme, kaldirma-onerisi, rapor, fikir.'],
    };
  if (!(DESTEKLENEN_TURLER as readonly string[]).includes(tur))
    return {
      ok: false,
      hatalar: ["Bu teslim türü henüz desteklenmiyor. Şimdilik öneri belgesi olarak teslim edebilirsin."],
    };
  const isId = v.isId === undefined || v.isId === null ? null : tamsayi(v.isId, 1, 1e12);
  if (v.isId !== undefined && v.isId !== null && isId === null) hatalar.push('"isId" geçersiz.');
  const aciklama = v.aciklama === undefined ? "" : metin(v.aciklama, 0, 1000);
  if (aciklama === null) hatalar.push('"aciklama" en çok 1000 karakter.');
  if (!Array.isArray(v.ogeler) || v.ogeler.length < 1 || v.ogeler.length > EN_COK_OGE)
    return { ok: false, hatalar: [...hatalar, `"ogeler" 1–${EN_COK_OGE} öğelik liste olmalı.`] };
  const ogeler: OgeGirdisi[] = [];
  v.ogeler.forEach((o, i) => {
    const x = ogeAyristir(o, i, alan, hatalar, tur);
    if (x) ogeler.push(x);
  });
  const arac = v.arac === undefined ? null : metin(v.arac, 1, 60);
  const model = v.model === undefined ? null : metin(v.model, 1, 80);
  if (v.arac !== undefined && arac === null) hatalar.push('"arac" 1–60 karakter.');
  if (v.model !== undefined && model === null) hatalar.push('"model" 1–80 karakter.');
  const uretimYontemi =
    v.uretimYontemi === undefined || v.uretimYontemi === null
      ? null
      : (URETIM_YONTEMLERI as readonly unknown[]).includes(v.uretimYontemi)
        ? (v.uretimYontemi as UretimYontemi)
        : undefined;
  if (uretimYontemi === undefined) hatalar.push('"uretimYontemi" "gorsel-model" ya da "kod" olmalı.');
  if (hatalar.length || uretimYontemi === undefined) return { ok: false, hatalar: hatalar.slice(0, 30) };
  return {
    ok: true,
    deger: { isId, tur: tur as TeslimTuru, aciklama: aciklama ?? "", ogeler, arac, model, uretimYontemi },
  };
}

/** Sürüm gruplaması için öğe anahtarı: ad (küçük harf, boşluksuz). */
export const ogeAnahtari = (ad: string): string =>
  ad.normalize("NFC").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
