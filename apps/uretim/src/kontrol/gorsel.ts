/**
 * Görsel kontrolleri (UM-K2): oran (±%2), en küçük boyut, gerçek şeffaflık, düşük alfa kalıntısı, boş/tek renk,
 * 48 px siluet okunurluğu, sprite ızgarası. Analiz saf JS'tir (RGBA üzerinde); kaynak PNG depoda zaten yeniden
 * kodlanmış hâldedir.
 */
import { gorselAlaniMi } from "../ortak/gorselKurali.js";
import { pngAc, type Rgba } from "../png.js";
import { type KontrolBaglami, type KontrolDosyasi, type Satir, satir } from "./baglam.js";

/** Düşük alfa eşiği (sözleşme bölüm 5: pakette alfa < 24 olan pikseller 0 yapılır). */
export const DUSUK_ALFA = 24;
export const ORAN_TOLERANSI = 0.02;

export interface GorselProfili {
  desen: RegExp;
  ad: string;
  /** Genişlik / yükseklik. */
  oran?: number;
  enKucuk?: { w: number; h: number };
  enBuyuk?: { w: number; h: number };
  seffaf?: boolean;
  siluet?: number;
  /** Yatay şerit: kare yüksekliği = görsel yüksekliği, kare sayısı = w/h. */
  serit?: boolean;
}

export const GORSEL_PROFILLERI: readonly GorselProfili[] = [
  {
    desen: /assets\/shop\/cerceve\//,
    ad: "çerçeve",
    oran: 1,
    enKucuk: { w: 256, h: 256 },
    seffaf: true,
    siluet: 48,
  },
  {
    desen: /assets\/shop\/tepki\//,
    ad: "tepki çıkartması",
    oran: 1,
    enKucuk: { w: 128, h: 128 },
    seffaf: true,
    siluet: 48,
  },
  { desen: /assets\/shop\/zafer\//, ad: "zafer karesi", oran: 1, enKucuk: { w: 96, h: 96 }, seffaf: true },
  { desen: /assets\/shop\/giris\//, ad: "giriş efekti", oran: 1, enKucuk: { w: 128, h: 128 } },
  { desen: /assets\/shop\/kart-arkasi\//, ad: "kart arkası", oran: 2 / 3, enKucuk: { w: 320, h: 480 } },
  { desen: /assets\/shop\/unvan\//, ad: "lakap levhası", oran: 4, enKucuk: { w: 256, h: 64 }, seffaf: true },
  { desen: /assets\/shop\/kutu\//, ad: "kutu", oran: 4 / 5, enKucuk: { w: 240, h: 300 }, seffaf: true },
  {
    desen: /assets\/shop\/jeton\//,
    ad: "jeton",
    oran: 1,
    enKucuk: { w: 128, h: 128 },
    seffaf: true,
    siluet: 48,
  },
  { desen: /assets\/badges\//, ad: "rozet", oran: 1, enKucuk: { w: 128, h: 128 }, seffaf: true, siluet: 48 },
  { desen: /assets\/cards\//, ad: "kart yüzü", oran: 16 / 9, enKucuk: { w: 640, h: 360 } },
  { desen: /assets\/fx\//, ad: "efekt dokusu", enBuyuk: { w: 4096, h: 256 }, seffaf: true, serit: true },
  { desen: /assets\/(ikon|sus)\//, ad: "ikon", oran: 1, enKucuk: { w: 48, h: 48 }, seffaf: true, siluet: 24 },
];

export const profilBul = (yol: string | null): GorselProfili | null =>
  yol ? (GORSEL_PROFILLERI.find((p) => p.desen.test(yol)) ?? null) : null;

export interface AlfaAnalizi {
  gorunur: number;
  toplam: number;
  dusukAlfa: number;
  kenarToplam: number;
  kenarOpak: number;
  kenarDusuk: number;
  tekRenk: boolean;
  /** Görünür piksellerin ortalama parlaklığı (0..1). */
  parlaklik: number;
}

export function alfaAnalizi(img: Rgba): AlfaAnalizi {
  const { w, h, data } = img;
  let gorunur = 0;
  let dusukAlfa = 0;
  let kenarToplam = 0;
  let kenarOpak = 0;
  let kenarDusuk = 0;
  let rMin = 255;
  let rMax = 0;
  let gMin = 255;
  let gMax = 0;
  let bMin = 255;
  let bMax = 0;
  let parlak = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const a = data[o + 3] ?? 0;
      const kenar = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (kenar) {
        kenarToplam += 1;
        if (a >= DUSUK_ALFA) kenarOpak += 1;
        else if (a > 0) kenarDusuk += 1;
      }
      if (a > 0 && a < DUSUK_ALFA) dusukAlfa += 1;
      if (a >= DUSUK_ALFA) {
        gorunur += 1;
        const r = data[o] ?? 0;
        const g = data[o + 1] ?? 0;
        const b = data[o + 2] ?? 0;
        rMin = Math.min(rMin, r);
        rMax = Math.max(rMax, r);
        gMin = Math.min(gMin, g);
        gMax = Math.max(gMax, g);
        bMin = Math.min(bMin, b);
        bMax = Math.max(bMax, b);
        parlak += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      }
    }
  const tekRenk = gorunur > 0 && rMax - rMin <= 6 && gMax - gMin <= 6 && bMax - bMin <= 6;
  return {
    gorunur,
    toplam: w * h,
    dusukAlfa,
    kenarToplam,
    kenarOpak,
    kenarDusuk,
    tekRenk,
    parlaklik: gorunur ? parlak / gorunur : 0,
  };
}

/** Alfa maskesini en uzun kenarı `boy` olacak şekilde kutu süzgeciyle küçültür; doluluk oranı ve kopuk parçalar. */
export function siluet(img: Rgba, boy: number): { doluluk: number; kenarKarsitligi: number } {
  const olcek = Math.max(img.w, img.h) / boy;
  const w = Math.max(1, Math.round(img.w / olcek));
  const h = Math.max(1, Math.round(img.h / olcek));
  const maske = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * olcek);
      const y0 = Math.floor(y * olcek);
      const x1 = Math.min(img.w, Math.max(x0 + 1, Math.floor((x + 1) * olcek)));
      const y1 = Math.min(img.h, Math.max(y0 + 1, Math.floor((y + 1) * olcek)));
      let t = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          t += img.data[(yy * img.w + xx) * 4 + 3] ?? 0;
          n += 1;
        }
      maske[y * w + x] = n ? t / n / 255 : 0;
    }
  let dolu = 0;
  let net = 0;
  for (const v of maske) {
    if (v > 0.5) dolu += 1;
    // Kenar karşıtlığı: değerlerin ne kadarı kesin (0'a ya da 1'e yakın); bulanık siluet düşük çıkar.
    if (v < 0.15 || v > 0.85) net += 1;
  }
  return { doluluk: dolu / maske.length, kenarKarsitligi: net / maske.length };
}

function oranUygun(w: number, h: number, oran: number): boolean {
  return Math.abs(w / h - oran) / oran <= ORAN_TOLERANSI;
}

const oranMetni = (o: number): string => {
  for (const [a, b] of [
    [1, 1],
    [2, 3],
    [4, 1],
    [4, 5],
    [16, 9],
  ] as const)
    if (Math.abs(a / b - o) < 1e-6) return `${a}:${b}`;
  return o.toFixed(2);
};

export function gorselKontrol(img: Rgba, profil: GorselProfili | null, dosya: string): Satir[] {
  const s: Satir[] = [];
  const e = { dosya };
  const a = alfaAnalizi(img);
  if (a.gorunur === 0) {
    s.push(satir("gorsel", "bos", "kaldi", "Görsel tamamen boş (hiç görünür piksel yok).", e));
    return s;
  }
  if (a.tekRenk && a.gorunur === a.toplam)
    s.push(satir("gorsel", "tek-renk", "kaldi", "Görsel tek renkli düz bir alan; içerik yok.", e));
  else if (a.tekRenk && profil?.ad !== "ikon")
    s.push(
      satir("gorsel", "tek-renk", "uyari", "Görsel tek renkten oluşuyor; düz bir şekil gibi duruyor.", e),
    );
  if (profil?.oran !== undefined) {
    if (profil.serit) {
      // şerit profillerinde oran yok
    } else if (!oranUygun(img.w, img.h, profil.oran))
      s.push(
        satir(
          "gorsel",
          "oran",
          "kaldi",
          `${profil.ad} için oran ${oranMetni(profil.oran)} olmalı (gelen ${img.w}×${img.h}).`,
          e,
        ),
      );
    else s.push(satir("gorsel", "oran", "gecti", `Oran uygun (${img.w}×${img.h}).`, e));
  }
  if (profil?.enKucuk && (img.w < profil.enKucuk.w || img.h < profil.enKucuk.h))
    s.push(
      satir(
        "gorsel",
        "boyut",
        "kaldi",
        `${profil.ad} en az ${profil.enKucuk.w}×${profil.enKucuk.h} olmalı.`,
        e,
      ),
    );
  if (profil?.enBuyuk && (img.w > profil.enBuyuk.w || img.h > profil.enBuyuk.h))
    s.push(
      satir(
        "gorsel",
        "boyut",
        "kaldi",
        `${profil.ad} en çok ${profil.enBuyuk.w}×${profil.enBuyuk.h} olabilir.`,
        e,
      ),
    );
  if (profil?.seffaf) {
    if (a.gorunur === a.toplam)
      s.push(satir("gorsel", "seffaflik", "kaldi", "Şeffaf olması gereken görselde hiç şeffaf alan yok.", e));
    else if (a.kenarOpak > 0)
      s.push(
        satir(
          "gorsel",
          "seffaflik",
          "kaldi",
          `Kenarlarda ${a.kenarOpak} görünür piksel var; kenarlar tamamen şeffaf olmalı.`,
          e,
        ),
      );
    else s.push(satir("gorsel", "seffaflik", "gecti", "Kenarlar şeffaf.", e));
  }
  const kalinti = a.dusukAlfa + a.kenarDusuk;
  if (kalinti > a.toplam * 0.001)
    s.push(
      satir(
        "gorsel",
        "dusuk-alfa",
        "uyari",
        `Düşük alfa kalıntısı: ${a.dusukAlfa} piksel. Pakette temizlenecek (alfa < ${DUSUK_ALFA} → 0).`,
        e,
      ),
    );
  if (profil?.siluet) {
    const sl = siluet(img, profil.siluet);
    if (sl.doluluk < 0.06)
      s.push(
        satir(
          "gorsel",
          "siluet",
          "uyari",
          `${profil.siluet} px'te çok küçük ya da ince kalıyor; okunması zor.`,
          e,
        ),
      );
    else if (profil.seffaf && sl.doluluk > 0.97)
      s.push(
        satir("gorsel", "siluet", "uyari", `${profil.siluet} px'te siluet ayırt edilmiyor (kare blok).`, e),
      );
    else if (sl.kenarKarsitligi < 0.55)
      s.push(satir("gorsel", "siluet", "uyari", `${profil.siluet} px'te siluet bulanık.`, e));
    else s.push(satir("gorsel", "siluet", "gecti", `${profil.siluet} px'te siluet okunur.`, e));
    if (a.parlaklik < 0.08)
      s.push(satir("gorsel", "karsitlik", "uyari", "Koyu zeminde kaybolabilir (çok karanlık).", e));
  }
  if (profil?.serit) {
    const kare = img.h;
    if (kare > 256)
      s.push(satir("gorsel", "doku", "kaldi", "Efekt dokusunun kare boyu en çok 256 px olabilir.", e));
    if (img.w % kare !== 0)
      s.push(
        satir(
          "gorsel",
          "izgara",
          "kaldi",
          `Şerit genişliği (${img.w}) kare boyunun (${kare}) katı olmalı.`,
          e,
        ),
      );
    else {
      const n = img.w / kare;
      const bos: number[] = [];
      for (let k = 0; k < n; k++) {
        let gor = false;
        for (let y = 0; y < img.h && !gor; y++)
          for (let x = k * kare; x < (k + 1) * kare; x++)
            if ((img.data[(y * img.w + x) * 4 + 3] ?? 0) >= DUSUK_ALFA) {
              gor = true;
              break;
            }
        if (!gor) bos.push(k + 1);
      }
      s.push(
        bos.length
          ? satir("gorsel", "izgara", "kaldi", `Şeritte boş kare var: ${bos.join(", ")}.`, e)
          : satir("gorsel", "izgara", "gecti", `Şerit ${n} kare, hepsi dolu.`, e),
      );
    }
  }
  return s;
}

/** Kod çizimi belirtisinin uygulandığı en az görünür piksel (küçük görselden sonuç çıkmaz). */
export const KOD_CIZIMI_EN_AZ_PIKSEL = 4096;

/**
 * "Kodla çizilmiş olabilir" belirtisi (yalnız uyarı, sözleşme bölüm 10). Görsel üretim modelinin çıktısında
 * binlerce farklı renk ve gürültü olur; Python/PIL, SVG ya da canvas ile çizilmiş düz şekillerde renk sayısı çok azdır
 * ve PNG neredeyse hiç yer tutmaz. Ölçüler: görünür piksellerdeki farklı RGBA sayısı ve (sitenin yeniden kodladığı)
 * PNG'nin görünür piksel başına bayt sayısı. Eşikler oyundaki 500+ gerçek görselde denendi (en düşük: 159 renk,
 * piksel başına 0,44 bayt); kodla çizilmiş örnek çerçevelerde 18–185 renk, ~0,09 bayt.
 */
export function kodCizimiBelirtisi(
  img: Rgba,
  pngBayt: number,
): { renk: number; baytPiksel: number; supheli: boolean } | null {
  const renkler = new Set<number>();
  let gorunur = 0;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] ?? 0;
    if (a === 0) continue;
    gorunur += 1;
    if (renkler.size <= 4096)
      renkler.add((((d[i] ?? 0) << 24) | ((d[i + 1] ?? 0) << 16) | ((d[i + 2] ?? 0) << 8) | a) >>> 0);
  }
  if (gorunur < KOD_CIZIMI_EN_AZ_PIKSEL) return null;
  const renk = renkler.size;
  const baytPiksel = pngBayt / gorunur;
  return { renk, baytPiksel, supheli: renk < 64 || baytPiksel < 0.25 || (renk < 1000 && baytPiksel < 0.5) };
}

export function gorselKontrolleri(b: KontrolBaglami): Satir[] {
  const out: Satir[] = [];
  for (const d of b.dosyalar) {
    if (d.tur !== "png") continue;
    const img = acik(d);
    out.push(...gorselKontrol(img, profilBul(d.hedefYol), d.ad));
    if (!gorselAlaniMi(b.alan.id)) continue;
    const k = kodCizimiBelirtisi(img, d.veri.length);
    if (k?.supheli)
      out.push(
        satir(
          "gorsel",
          "kod-cizimi",
          "uyari",
          `Kodla çizilmiş olabilir: çok az renk (${k.renk}${k.renk > 4096 ? "+" : ""}) ve çok küçük dosya (piksel başına ${k.baytPiksel.toFixed(2)} bayt). Oyundaki görseller görsel üretim modeliyle üretildi; düz, simetrik çokgenler tarza uymaz.`,
          { dosya: d.ad },
        ),
      );
  }
  return out;
}

const onbellek = new WeakMap<Buffer, Rgba>();
/** Depodaki (yeniden kodlanmış) PNG'yi açar; aynı kontrol turunda bir kez. */
export function acik(d: KontrolDosyasi): Rgba {
  let r = onbellek.get(d.veri);
  if (!r) {
    r = pngAc(d.veri);
    onbellek.set(d.veri, r);
  }
  return r;
}
