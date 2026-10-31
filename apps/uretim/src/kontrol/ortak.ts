/** Ortak kontroller (UM-K1): paket biçimi, dosya türü ve boyutu, alan yetkisi, ad tekrarı, aynı dosyanın tekrarı. */
import { sinif } from "../dosya.js";
import { ogeAnahtari } from "../teslimGirdisi.js";
import { type KontrolBaglami, type Satir, satir } from "./baglam.js";

/** Pakette dönüştürülmüş dosyanın uzantısı (görsel → webp, ses → ogg). */
export function paketUzantisi(tur: string): string {
  if (tur === "png" || tur === "webp") return ".webp";
  if (tur === "wav" || tur === "ogg") return ".ogg";
  return `.${tur}`;
}

export function ortakKontroller(b: KontrolBaglami, varOlanYollar: ReadonlySet<string>): Satir[] {
  const s: Satir[] = [];
  const { alan, oge, tur } = b;
  const icerikYok =
    !oge.dosyalar.length &&
    !oge.satirlar.length &&
    oge.rapor === null &&
    !oge.degisiklikler.length &&
    !oge.kaldirilacaklar.length;
  if (tur === "fikir") {
    if ([...oge.aciklama].length < 10)
      s.push(
        satir(
          "ortak",
          "fikir",
          "kaldi",
          "Fikirde ne olacağını anlatan bir açıklama yaz (en az 10 karakter).",
        ),
      );
    if (oge.dosyalar.length || oge.satirlar.length)
      s.push(satir("ortak", "fikir", "kaldi", "Fikir teslimi yalnız metindir; dosya ve satır eklenmez."));
  } else if (icerikYok)
    s.push(satir("ortak", "bicim", "kaldi", "Öğede dosya, satır, değişiklik ya da rapor yok."));
  if (
    tur === "duzenleme" &&
    !oge.degisiklikler.length &&
    oge.oncekiOge === null &&
    !oge.dosyalar.length &&
    !oge.satirlar.length
  )
    s.push(
      satir(
        "ortak",
        "bicim",
        "kaldi",
        "Düzenleme teslimi eski → yeni değişiklikleri ya da önceki öğeyi göstermeli.",
      ),
    );
  if (tur === "kaldirma-onerisi" && !oge.kaldirilacaklar.length && !oge.satirlar.length)
    s.push(satir("ortak", "bicim", "kaldi", "Kaldırma önerisinde kaldırılacakların listesi olmalı."));
  if (tur === "duzenleme" || tur === "kaldirma-onerisi") {
    if (oge.gerekce.length < 3)
      s.push(satir("ortak", "gerekce", "kaldi", "Düzenleme ve kaldırma önerilerinde gerekçe yazılmalı."));
  }
  const hedefler = new Map<string, string>();
  for (const d of b.dosyalar) {
    const e = { dosya: d.ad };
    if (!alan.dosyaTurleri.includes(d.tur))
      s.push(satir("ortak", "tur", "kaldi", `Bu alan ${d.tur.toUpperCase()} dosyası teslim edemez.`, e));
    if (d.dahaOnce)
      s.push(satir("ortak", "ayni-dosya", "uyari", "Bu dosyanın aynısı bu alanda daha önce de gelmişti.", e));
    const cls = sinif(d.tur);
    const gerekli = alan.hedefOnekleri.length > 0 && (cls === "gorsel" || cls === "ses") && tur !== "rapor";
    if (d.hedefYol === null) {
      if (gerekli)
        s.push(
          satir("ortak", "hedef-yol", "kaldi", "Görsel ve seslerin oyundaki yolu (hedefYol) yazılmalı.", e),
        );
      continue;
    }
    const uz = paketUzantisi(d.tur);
    if (!d.hedefYol.endsWith(uz))
      s.push(
        satir(
          "ortak",
          "hedef-yol",
          "kaldi",
          `Hedef yol "${uz}" ile bitmeli (pakette bu biçime çevrilir).`,
          e,
        ),
      );
    const once = hedefler.get(d.hedefYol);
    if (once)
      s.push(satir("ortak", "hedef-yol", "kaldi", `Aynı hedef yol iki dosyada: ${once} ve ${d.ad}.`, e));
    hedefler.set(d.hedefYol, d.ad);
    if (tur === "yeni" && varOlanYollar.has(d.hedefYol))
      s.push(
        satir(
          "ortak",
          "hedef-yol",
          "uyari",
          "Bu yol oyunda zaten var; değiştiriyorsan düzenleme olarak teslim et.",
          e,
        ),
      );
  }
  const ad = ogeAnahtari(oge.ad);
  if (b.ayniTeslimAdlari.includes(ad))
    s.push(satir("ortak", "ad-tekrari", "kaldi", "Aynı teslimde bu adla başka öğe var."));
  else if (b.alandakiAdlar.has(ad) && oge.oncekiOge === null && tur === "yeni")
    s.push(
      satir("ortak", "ad-tekrari", "uyari", "Bu alanda aynı adla bekleyen ya da onaylanmış bir öğe var."),
    );
  if (!s.some((x) => x.sonuc === "kaldi"))
    s.push(satir("ortak", "bicim", "gecti", "Paket biçimi ve alan yetkisi uygun."));
  return s;
}
