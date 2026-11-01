/**
 * Üretim Merkezi iş akışı (UM-İ1…İ10): yükleme, teslim, ön kontrol, karar, işler, talimatlar, istek kartları,
 * kod istekleri, onaylananlar havuzu, tek tık aktarım, sürüm ve arşiv. MCP, SSH komut aracı ve sahip arayüzü
 * yalnız bu sınıfı çağırır; alan yetkisi her çağrıda burada denetlenir.
 */

import { randomBytes } from "node:crypto";
import type { Anahtarlar } from "./anahtar.js";
import { type Db, islem, json } from "./db.js";
import type { Denetim } from "./denetim.js";
import type { Depo } from "./depo.js";
import { DosyaHatasi, dosyaIsle } from "./dosya.js";
import type { Katalog } from "./katalog.js";
import type { KontrolDosyasi } from "./kontrol/baglam.js";
import { satir } from "./kontrol/baglam.js";
import { onKontrol } from "./kontrol/index.js";
import type { Kosular } from "./kosu.js";
import { sesSuresiSiniri } from "./medya.js";
import { ALAN_IDLERI, type AlanId, alanTanimi, isAlanId, talimatTaslagi } from "./ortak/alanlar.js";
import {
  type Durum,
  gecisOlur,
  type HazirNotKodu,
  hazirNotMetni,
  TALIMAT_ONERI_ESIGI,
} from "./ortak/durum.js";
import type { FikirAlanlari, UygulanacakFikir } from "./ortak/fikir.js";
import { gorselAlaniMi, gorselKuraliBolumu } from "./ortak/gorselKurali.js";
import {
  aslaOtomatik,
  DENETIM_ARALIGI,
  EN_COK_VARYANT,
  GUVEN_ORAN,
  GUVEN_PENCERE,
  VARSAYILAN_SINIR,
} from "./ortak/guven.js";
import { OYUN_ALANI_ARAC_SATIRI, OYUN_ALANI_SATIRI, oyunAlaniAlaniMi } from "./ortak/oyunAlani.js";
import { FIKIR_RAPOR_BOLUMU, PAKET_SATIRI, PAKET_SINIRLARI, TEST_SINIRI } from "./ortak/paketBicimi.js";
import { yapiliRaporMu } from "./ortak/rapor.js";
import type {
  AktarimKaydi,
  AlanKarti,
  AlanSayfasi,
  Degisiklik,
  Gorunum,
  IsKaydi,
  IstekKarti,
  KodIstegi,
  Koken,
  KontrolRaporu,
  Kucuk,
  NotKaydi,
  OgeAyrinti,
  OgeDosyasi,
  OgeOzeti,
  Pano,
  TeslimTuru,
  Uyari,
  ZevkOrnegi,
} from "./ortak/tipler.js";
import { OyunHatasi, type OyunIstemcisi, SATIR_SINIRI } from "./oyun.js";
import type { OyunAlaniBagi } from "./oyunAlani.js";
import { type OgeGirdisi, ogeAnahtari, type TeslimGirdisi } from "./teslimGirdisi.js";

const GUN = 24 * 3600 * 1000;
export const GERI_AL_MS = 10_000;
/** İş kilidi bu kadar hareketsizlikte açılır (sözleşme bölüm 8). */
export const KILIT_SURESI_MS = 2 * 3600 * 1000;

export class IsHatasi extends Error {
  constructor(
    readonly durum: number,
    mesaj: string,
  ) {
    super(mesaj);
  }
}

export interface Olaylar {
  /** Kırmızı uyarı (bildirim). */
  kirmizi(metin: string): void;
  /** Sıradan bilgi bildirimi (iş açıldı, iş bekliyor). */
  bilgi?(metin: string, url: string): void;
  /** Denetim kaydına düşmeyen durum değişiklikleri (iş başladı, kilit alındı): canlı güncelleme. */
  degisti?(tur: "is" | "kilit", alan: string): void;
}

interface OgeSatiri {
  gorunus: string;
  fikir: string | null;
  fikir_id: number | null;
  talimat_surum: number | null;
  onaylayan: string | null;
  otomatik: number;
  denetim: number;
  varyant_is: number | null;
  id: number;
  teslim_id: number;
  alan: string;
  is_id: number | null;
  tur: string;
  ad: string;
  anahtar: string;
  aciklama: string;
  gerekce: string;
  durum: string;
  gorunum: string;
  surum: number;
  onceki_id: number | null;
  kaynak: string;
  dosyalar: string;
  satirlar: string;
  degisiklikler: string;
  kaldirilacaklar: string;
  onizleme: string | null;
  rapor: string | null;
  kontrol: string;
  sonuc: string;
  onayli_satirlar: string | null;
  paket_id: number | null;
  olusturma: number;
  karar: number | null;
  guncelleme: number;
}

function ozetle(r: OgeSatiri): OgeOzeti {
  return {
    id: r.id,
    teslimId: r.teslim_id,
    alan: r.alan as AlanId,
    isId: r.is_id,
    tur: r.tur as TeslimTuru,
    ad: r.ad,
    aciklama: r.aciklama,
    gerekce: r.gerekce,
    durum: r.durum as Durum,
    gorunum: r.gorunum as Gorunum,
    surum: r.surum,
    oncekiId: r.onceki_id,
    kaynak: r.kaynak === "elle" ? "elle" : "mcp",
    sonuc: r.sonuc === "kaldi" ? "kaldi" : r.sonuc === "uyari" ? "uyari" : "gecti",
    olusturma: r.olusturma,
    karar: r.karar,
    otomatik: r.otomatik === 1,
    denetim: r.denetim === 1,
    varyantIs: r.varyant_is,
    fikirId: r.fikir_id ?? null,
    fikir: json<FikirAlanlari | null>(r.fikir ?? null, null),
  };
}

/** Öğenin inceleme görünümü (UM-U3). */
export function gorunumBul(
  alan: AlanId,
  tur: TeslimTuru,
  oge: OgeGirdisi,
  dosyalar: readonly { tur: string; hedefYol: string | null; ad: string }[],
): Gorunum {
  if (tur === "fikir") return "fikir";
  if (tur === "rapor" || oge.rapor !== null) return "rapor";
  if (dosyalar.some((d) => d.hedefYol?.startsWith("docs/wiki/"))) return "wiki";
  if (dosyalar.some((d) => d.tur === "ogg" || d.tur === "wav")) return alan === "muzik" ? "muzik" : "ses";
  const gorseller = dosyalar.filter((d) => d.tur === "png");
  if (gorseller.length > 1 && gorseller.some((d) => /-(\d+)\.(png|webp)$/.test(d.hedefYol ?? d.ad)))
    return "animasyon";
  if (alan === "rozet" || alan === "kartlar" || alan === "ikon" || dosyalar.some((d) => d.tur === "svg"))
    return "kart";
  if (gorseller.length) return "gorsel";
  if (oge.satirlar.length) return "liste";
  return "metin";
}

/** CSV (RFC 4180, ilk satır başlık) → nesne listesi. */
export function csvOku(metin: string): Record<string, string>[] {
  const satirlar: string[][] = [];
  let alan = "";
  let satir: string[] = [];
  let tirnak = false;
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];
    if (tirnak) {
      if (c === '"' && metin[i + 1] === '"') {
        alan += '"';
        i++;
      } else if (c === '"') tirnak = false;
      else alan += c;
    } else if (c === '"') tirnak = true;
    else if (c === "," || c === ";") {
      satir.push(alan);
      alan = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && metin[i + 1] === "\n") i++;
      satir.push(alan);
      alan = "";
      if (satir.some((x) => x !== "")) satirlar.push(satir);
      satir = [];
    } else alan += c;
  }
  satir.push(alan);
  if (satir.some((x) => x !== "")) satirlar.push(satir);
  const [baslik, ...govde] = satirlar;
  if (!baslik) return [];
  return govde
    .slice(0, SATIR_SINIRI + 1)
    .map((r) => Object.fromEntries(baslik.map((b, i) => [b.trim(), (r[i] ?? "").trim()])));
}

/** CSV satırı → havuz ya da kalıp satırı (havuz sütunu varsa havuz, kalip sütunu varsa moderasyon). */
function csvSatiri(r: Record<string, string>): unknown {
  if (r.kalip !== undefined) return { kalip: r.kalip, tur: r.tur, ...(r.risk ? { risk: r.risk } : {}) };
  const { havuz, zorluk, tema, ...alanlar } = r;
  return { havuz, alanlar, ...(zorluk ? { zorluk } : {}), ...(tema ? { tema } : {}) };
}

export interface TeslimSonucu {
  teslimId: number | null;
  ogeler: {
    ad: string;
    ogeId: number | null;
    durum: Durum | null;
    sonuc: KontrolRaporu["sonuc"];
    satirlar: KontrolRaporu["satirlar"];
  }[];
}

interface SonKarar {
  zaman: number;
  eski: Durum;
  notId: number | null;
}

export class Merkez {
  private readonly sonKararlar = new Map<number, SonKarar>();
  /**
   * Oyun alanı (test2) bağı (`oyunAlani.ts`; sözleşme bölüm 13): öğe durumu değişince haber verilir, öğe ve pano
   * test2 durumunu taşır. Bağlı değilse (test2 ayarlı değil) hiçbir şey olmaz.
   */
  oyunAlani: OyunAlaniBagi | null = null;
  /** test2 bot koşuları ve oyun alanı odaları (`kosu.ts`; sözleşme bölüm 14); sunucu kurulurken bağlanır. */
  kosular: Kosular | null = null;

  constructor(
    readonly db: Db,
    readonly depo: Depo,
    readonly denetim: Denetim,
    readonly katalog: Katalog,
    readonly oyun: OyunIstemcisi,
    readonly anahtarlar: Anahtarlar,
    private readonly olaylar: Olaylar = { kirmizi: () => undefined },
  ) {}

  // ---- Yükleme ------------------------------------------------------------------------------------------

  async yukle(
    alan: AlanId,
    anahtarId: number | null,
    adHam: unknown,
    veri: Buffer,
    now: number,
  ): Promise<{ dosyaId: string; ad: string; tur: string; boyut: number; ozet: string; notlar: string[] }> {
    const t = alanTanimi(alan);
    let d: Awaited<ReturnType<typeof dosyaIsle>>;
    try {
      d = await dosyaIsle(veri, adHam, sesSuresiSiniri(alan));
    } catch (err) {
      throw new IsHatasi(400, err instanceof DosyaHatasi ? err.message : "Dosya işlenemedi.");
    }
    if (!t.dosyaTurleri.includes(d.tur) && !(d.tur === "png" && t.dosyaTurleri.includes("webp")))
      throw new IsHatasi(400, `Bu alan ${d.tur.toUpperCase()} dosyası kabul etmiyor.`);
    const ozet = await this.depo.koy(d.veri, d.tur, d.meta, now);
    const dosyaId = randomBytes(18).toString("base64url");
    this.db
      .prepare("INSERT INTO yukleme (id, alan, anahtar_id, ozet, ad, olusturma) VALUES (?, ?, ?, ?, ?, ?)")
      .run(dosyaId, alan, anahtarId, ozet, d.ad, now);
    return { dosyaId, ad: d.ad, tur: d.tur, boyut: d.veri.length, ozet, notlar: d.notlar };
  }

  // ---- Teslim -------------------------------------------------------------------------------------------

  private yuklemeBul(alan: AlanId, dosyaId: string): { ozet: string; ad: string } | null {
    return (
      (this.db.prepare("SELECT ozet, ad FROM yukleme WHERE id = ? AND alan = ?").get(dosyaId, alan) as
        | { ozet: string; ad: string }
        | undefined) ?? null
    );
  }

  private alandakiAdlar(alan: AlanId): Set<string> {
    const r = this.db
      .prepare(
        "SELECT anahtar FROM oge WHERE alan = ? AND durum IN ('bekliyor','onaylandi','havuzda','pakette','oyuna_eklendi','canlida','duzeltme_istendi')",
      )
      .all(alan) as { anahtar: string }[];
    return new Set(r.map((x) => x.anahtar));
  }

  private dahaOnceGeldi(alan: AlanId, ozet: string): boolean {
    const r = this.db
      .prepare("SELECT 1 FROM oge WHERE alan = ? AND dosyalar LIKE ? LIMIT 1")
      .get(alan, `%"ozet":"${ozet}"%`);
    return r !== undefined;
  }

  async teslimEt(
    alan: AlanId,
    kaynak: "mcp" | "elle",
    anahtarId: number | null,
    g: TeslimGirdisi,
    kuru: boolean,
    now: number,
    kim: string,
    oturum: { kanal: "mcp" | "ssh"; ad: string } | null = null,
  ): Promise<TeslimSonucu> {
    if (g.isId !== null) {
      const is = this.db.prepare("SELECT alan, durum FROM isler WHERE id = ?").get(g.isId) as
        | { alan: string; durum: string }
        | undefined;
      if (!is || is.alan !== alan) throw new IsHatasi(404, "Bu iş bulunamadı.");
      if (!kuru) this.isKurali(g);
      if (is.durum !== "acik") throw new IsHatasi(409, "Bu iş açık değil.");
    }
    const t = alanTanimi(alan);
    const alandaki = this.alandakiAdlar(alan);
    const sonuclar: { girdi: OgeGirdisi; dosyalar: OgeDosyasi[]; rapor: KontrolRaporu }[] = [];
    const adlar = g.ogeler.map((o) => ogeAnahtari(o.ad));
    for (const [i, o] of g.ogeler.entries()) {
      const ek: KontrolRaporu["satirlar"] = [];
      if (g.isId !== null && anahtarId !== null) {
        const kl = this.kilit(g.isId, now);
        if (kl && kl.anahtarId !== anahtarId)
          ek.push(
            satir(
              "ortak",
              "kilit",
              "uyari",
              `Bu iş başka bir oturumun üzerinde (${kl.ad}); teslim yine de kabul edildi.`,
            ),
          );
      }
      const kd: KontrolDosyasi[] = [];
      const od: OgeDosyasi[] = [];
      let satirlar = o.satirlar;
      for (const b of o.dosyalar) {
        const y = this.yuklemeBul(alan, b.dosyaId);
        const bilgi = y ? this.depo.bilgi(y.ozet) : null;
        if (!y || !bilgi) {
          ek.push(satir("ortak", "dosya", "kaldi", "Dosya bulunamadı (önce bu alanın anahtarıyla yükle)."));
          continue;
        }
        let veri: Buffer;
        try {
          veri = await this.depo.oku(y.ozet);
        } catch {
          ek.push(satir("ortak", "dosya", "kaldi", "Dosya depoda yok; yeniden yükle.", { dosya: y.ad }));
          continue;
        }
        if (bilgi.tur === "csv" && (b.rol === "satirlar" || !b.hedefYol)) {
          const csv = csvOku(veri.toString("utf8"));
          if (csv.length > SATIR_SINIRI)
            ek.push(satir("ortak", "satir", "kaldi", `En çok ${SATIR_SINIRI} satır.`, { dosya: y.ad }));
          satirlar = [...satirlar, ...csv.slice(0, SATIR_SINIRI).map(csvSatiri)];
        }
        kd.push({
          dosyaId: b.dosyaId,
          ad: y.ad,
          tur: bilgi.tur,
          veri,
          ozet: y.ozet,
          meta: bilgi.meta,
          hedefYol: b.hedefYol,
          rol: b.rol,
          dahaOnce: this.dahaOnceGeldi(alan, y.ozet),
        });
        od.push({
          dosyaId: b.dosyaId,
          ozet: y.ozet,
          ad: y.ad,
          tur: bilgi.tur,
          boyut: bilgi.boyut,
          hedefYol: b.hedefYol,
          rol: b.rol,
          meta: bilgi.meta,
        });
      }
      // Görsel kuralı (sözleşme bölüm 10): yapay zekâ teslimindeki görsellerin üretim yöntemi.
      if (kaynak !== "elle" && gorselAlaniMi(alan) && kd.some((d) => d.tur === "png" || d.tur === "svg")) {
        if (g.uretimYontemi === "kod")
          ek.push(
            satir(
              "ortak",
              "uretim-yontemi",
              "kaldi",
              "Bu alanda görseller görsel üretim becerisi ya da aracıyla üretilmeli; kodla (Python/PIL, SVG, canvas) çizilmiş görsel kabul edilmez. Görsel üretemiyorsan yalnız metin önerisi gönder.",
            ),
          );
        else if (g.uretimYontemi === null)
          ek.push(
            satir(
              "ortak",
              "uretim-yontemi",
              "uyari",
              'Teslim görsellerin nasıl üretildiğini bildirmiyor ("uretimYontemi": "gorsel-model" bekleniyor).',
            ),
          );
        else
          ek.push(
            satir(
              "ortak",
              "uretim-yontemi",
              "gecti",
              "Görseller görsel üretim modeliyle üretildi (bildirim).",
            ),
          );
      }
      // "Onaylananları uygula": öğenin uyguladığı fikir bu alanda onaylı bir fikir olmalı.
      if (o.fikirId !== null) {
        const f = this.db.prepare("SELECT alan, tur, durum FROM oge WHERE id = ?").get(o.fikirId) as
          | { alan: string; tur: string; durum: string }
          | undefined;
        if (!f || f.alan !== alan || f.tur !== "fikir")
          ek.push(satir("ortak", "fikir", "kaldi", `Fikir #${o.fikirId} bu alanda bulunamadı.`));
        else if (["bekliyor", "reddedildi", "arsiv", "kaldi", "duzeltme_istendi"].includes(f.durum))
          ek.push(
            satir(
              "ortak",
              "fikir",
              "kaldi",
              `Fikir #${o.fikirId} onaylanmamış; yalnız onaylı fikir uygulanır.`,
            ),
          );
        else if (
          g.isId !== null &&
          !this.db.prepare("SELECT 1 FROM is_fikir WHERE is_id = ? AND fikir_id = ?").get(g.isId, o.fikirId)
        )
          ek.push(
            satir("ortak", "fikir", "uyari", `Fikir #${o.fikirId} bu işin uygulanacak fikirlerinden değil.`),
          );
        else ek.push(satir("ortak", "fikir", "gecti", `Fikir #${o.fikirId} uygulanıyor.`));
      } else if (g.tur !== "fikir" && g.tur !== "rapor" && g.isId !== null && this.isFikirleri(g.isId).length)
        ek.push(
          satir(
            "ortak",
            "fikir",
            "uyari",
            "Bu iş onaylanan fikirleri uyguluyor; her öğede hangi fikri uyguladığını fikirId ile yaz.",
          ),
        );
      if (g.tur === "fikir" && !o.fikir)
        ek.push(
          satir(
            "ortak",
            "fikir-bicimi",
            "uyari",
            "Fikir düz metin: ozet, kategori, etki ve zahmet yazılırsa fikir panosunda süzülüp sıralanabilir.",
          ),
        );
      if (g.tur === "rapor" && o.rapor !== null && !yapiliRaporMu(o.rapor))
        ek.push(
          satir(
            "ortak",
            "rapor-bicimi",
            "uyari",
            "Rapor eski biçimde: ozet, seriler, tablolar ve bulgular yazılırsa grafikli panoda görünür.",
          ),
        );
      if (satirlar.length > SATIR_SINIRI) {
        ek.push(satir("ortak", "satir", "kaldi", `Bir öğede en çok ${SATIR_SINIRI} satır olabilir.`));
        satirlar = satirlar.slice(0, SATIR_SINIRI);
      }
      if (o.oncekiOge !== null) {
        const p = this.db.prepare("SELECT alan FROM oge WHERE id = ?").get(o.oncekiOge) as
          | { alan: string }
          | undefined;
        if (!p || p.alan !== alan)
          ek.push(satir("ortak", "onceki", "kaldi", "Önceki öğe bu alanda bulunamadı."));
      }
      const girdi = { ...o, satirlar };
      const rapor = await onKontrol(
        {
          alan: t,
          tur: g.tur,
          oge: girdi,
          dosyalar: kd,
          ayniTeslimAdlari: adlar.filter((_, j) => j !== i),
          alandakiAdlar: alandaki,
          katalog: this.katalog,
          now,
        },
        ek,
      );
      sonuclar.push({ girdi, dosyalar: od, rapor });
    }
    if (kuru)
      return {
        teslimId: null,
        ogeler: sonuclar.map((s) => ({
          ad: s.girdi.ad,
          ogeId: null,
          durum: null,
          sonuc: s.rapor.sonuc,
          satirlar: s.rapor.satirlar,
        })),
      };

    if (kaynak === "mcp")
      this.selDenetle(alan, sonuclar.filter((s) => s.rapor.sonuc !== "kaldi").length, now);
    const isVaryant =
      g.isId !== null && g.tur !== "fikir"
        ? ((
            this.db.prepare("SELECT varyant FROM isler WHERE id = ?").get(g.isId) as
              | { varyant: number | null }
              | undefined
          )?.varyant ?? null)
        : null;
    const talimatSurum = this.talimat(alan, now).surum;
    const out = islem(this.db, () => {
      const teslimId = Number(
        this.db
          .prepare(
            "INSERT INTO teslim (alan, is_id, tur, kaynak, anahtar_id, aciklama, olusturma, kanal, anahtar_ad, arac, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            alan,
            g.isId,
            g.tur,
            kaynak,
            anahtarId,
            g.aciklama,
            now,
            oturum?.kanal ?? "elle",
            oturum?.ad ?? "",
            g.arac,
            g.model,
          ).lastInsertRowid,
      );
      const ogeler: TeslimSonucu["ogeler"] = [];
      for (const s of sonuclar) {
        const anahtar = ogeAnahtari(s.girdi.ad);
        const onceki = (
          s.girdi.oncekiOge !== null
            ? this.db
                .prepare("SELECT id, surum, durum, anahtar FROM oge WHERE id = ? AND alan = ?")
                .get(s.girdi.oncekiOge, alan)
            : this.db
                .prepare(
                  "SELECT id, surum, durum, anahtar FROM oge WHERE alan = ? AND anahtar = ? ORDER BY surum DESC LIMIT 1",
                )
                .get(alan, anahtar)
        ) as { id: number; surum: number; durum: Durum; anahtar: string } | undefined;
        // Durum yolu: gelen → on_kontrolde → bekliyor | kaldi.
        const son: Durum = s.rapor.sonuc === "kaldi" ? "kaldi" : "bekliyor";
        if (!gecisOlur("gelen", "on_kontrolde") || !gecisOlur("on_kontrolde", son))
          throw new Error("durum makinesi");
        const r = this.db
          .prepare(
            `INSERT INTO oge (teslim_id, alan, is_id, tur, ad, anahtar, aciklama, gerekce, durum, gorunum, surum, onceki_id, kaynak,
             dosyalar, satirlar, degisiklikler, kaldirilacaklar, onizleme, rapor, kontrol, sonuc, olusturma, guncelleme,
             talimat_surum, varyant_is, gorunus, fikir, fikir_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            teslimId,
            alan,
            g.isId,
            g.tur,
            s.girdi.ad,
            onceki?.anahtar ?? anahtar,
            s.girdi.aciklama,
            s.girdi.gerekce,
            son,
            gorunumBul(alan, g.tur, s.girdi, s.dosyalar),
            (onceki?.surum ?? 0) + 1,
            onceki?.id ?? null,
            kaynak,
            JSON.stringify(s.dosyalar),
            JSON.stringify(s.girdi.satirlar),
            JSON.stringify(s.girdi.degisiklikler),
            JSON.stringify(s.girdi.kaldirilacaklar),
            s.girdi.onizleme ? JSON.stringify(s.girdi.onizleme) : null,
            s.girdi.rapor === null ? null : JSON.stringify(s.girdi.rapor),
            JSON.stringify(s.rapor),
            s.rapor.sonuc,
            now,
            now,
            talimatSurum,
            isVaryant && isVaryant > 1 ? g.isId : null,
            s.girdi.gorunus,
            s.girdi.fikir ? JSON.stringify(s.girdi.fikir) : null,
            s.girdi.fikirId,
          );
        const ogeId = Number(r.lastInsertRowid);
        if (son === "kaldi") {
          const nedenler = s.rapor.satirlar
            .filter((x) => x.sonuc === "kaldi")
            .map(
              (x) =>
                `- ${x.mesaj}${x.dosya ? ` (${x.dosya})` : ""}${x.satir !== undefined ? ` (satır ${x.satir + 1})` : ""}`,
            );
          this.notEkle(
            alan,
            ogeId,
            "otomatik",
            null,
            `Ön kontrolden geçmedi:\n${nedenler.slice(0, 30).join("\n")}`,
            now,
          );
        } else if (onceki && (onceki.durum === "bekliyor" || onceki.durum === "duzeltme_istendi"))
          this.durumYaz(onceki.id, "arsiv", now);
        if (g.isId !== null && son !== "kaldi") {
          const is = this.db.prepare("SELECT istek_id FROM isler WHERE id = ?").get(g.isId) as
            | { istek_id: number | null }
            | undefined;
          this.db
            .prepare("UPDATE isler SET teslim_edildi = COALESCE(teslim_edildi, ?) WHERE id = ?")
            .run(now, g.isId);
          if (is?.istek_id)
            this.db.prepare("UPDATE istek_karti SET sonuc_oge = ? WHERE id = ?").run(ogeId, is.istek_id);
        }
        const otomatik =
          son === "bekliyor" &&
          !(isVaryant && isVaryant > 1) &&
          g.tur !== "fikir" &&
          s.rapor.sonuc === "gecti" &&
          this.otomatikOnayla(ogeId, alan, g.tur, now);
        ogeler.push({
          ad: s.girdi.ad,
          ogeId,
          durum: otomatik ? "havuzda" : son,
          sonuc: s.rapor.sonuc,
          satirlar: s.rapor.satirlar,
        });
      }
      return { teslimId, ogeler };
    });
    // Ön kontrolden geçen içerik ve mağaza öğeleri test2'ye kendiliğinden yüklenir (işlem bittikten sonra).
    for (const o of out.ogeler)
      if (o.ogeId !== null && o.durum !== null) this.oyunAlani?.durumDegisti(o.ogeId, o.durum);
    this.denetim.yaz(
      now,
      kim,
      kaynak === "elle" ? "elle_teslim" : "teslim",
      alan,
      `teslim ${out.teslimId}: ${out.ogeler.length} öğe`,
    );
    const geriDonen = this.geriDonenSay(now - 3600_000, alan);
    if (out.ogeler.some((o) => o.durum === "kaldi") && geriDonen >= 10)
      this.olaylar.kirmizi(
        `${alanTanimi(alan).ad}: son bir saatte ${geriDonen} teslim kendiliğinden geri döndü.`,
      );
    return out;
  }

  private geriDonenSay(sonra: number, alan?: AlanId): number {
    const r = (
      alan
        ? this.db
            .prepare("SELECT COUNT(*) AS n FROM oge WHERE durum = 'kaldi' AND olusturma > ? AND alan = ?")
            .get(sonra, alan)
        : this.db.prepare("SELECT COUNT(*) AS n FROM oge WHERE durum = 'kaldi' AND olusturma > ?").get(sonra)
    ) as { n: number };
    return Number(r.n);
  }

  private durumYaz(
    id: number,
    durum: Durum,
    now: number,
    ek: { karar?: number; paket?: number | null } = {},
  ): void {
    const sets = ["durum = ?", "guncelleme = ?"];
    const vals: (string | number | null)[] = [durum, now];
    if (ek.karar !== undefined) {
      sets.push("karar = ?");
      vals.push(ek.karar);
    }
    if (ek.paket !== undefined) {
      sets.push("paket_id = ?");
      vals.push(ek.paket);
    }
    this.db.prepare(`UPDATE oge SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
    this.oyunAlani?.durumDegisti(id, durum);
  }

  /** Sahibin öğeye notu ("şöyle olsun"): yapay zekânın geri bildirimine ve fikrin uygulama işine düşer. */
  yorumEkle(id: number, metin: string, kim: string, now: number): void {
    const r = this.ogeSatiri(id);
    if (!r) throw new IsHatasi(404, "Teslim bulunamadı.");
    this.notEkle(r.alan as AlanId, id, "yorum", null, metin, now);
    this.denetim.yaz(now, kim, "yorum", r.alan, `öğe ${id}`);
  }

  private notEkle(
    alan: AlanId,
    ogeId: number | null,
    tur: NotKaydi["tur"],
    hazir: HazirNotKodu | null,
    metin: string,
    now: number,
  ): number {
    return Number(
      this.db
        .prepare("INSERT INTO notlar (alan, oge_id, tur, hazir, metin, olusturma) VALUES (?, ?, ?, ?, ?, ?)")
        .run(alan, ogeId, tur, hazir, metin, now).lastInsertRowid,
    );
  }

  // ---- Okuma --------------------------------------------------------------------------------------------

  private ogeSatiri(id: number): OgeSatiri | null {
    return (
      (this.db.prepare("SELECT * FROM oge WHERE id = ?").get(id) as unknown as OgeSatiri | undefined) ?? null
    );
  }

  oge(id: number, alan?: AlanId): OgeAyrinti | null {
    const r = this.ogeSatiri(id);
    if (!r || (alan && r.alan !== alan)) return null;
    const notlar = (
      this.db
        .prepare("SELECT id, oge_id, tur, hazir, metin, olusturma FROM notlar WHERE oge_id = ? ORDER BY id")
        .all(id) as {
        id: number;
        oge_id: number | null;
        tur: NotKaydi["tur"];
        hazir: HazirNotKodu | null;
        metin: string;
        olusturma: number;
      }[]
    ).map((n) => ({
      id: n.id,
      ogeId: n.oge_id,
      tur: n.tur,
      hazir: n.hazir,
      metin: n.metin,
      olusturma: n.olusturma,
    }));
    const surumler = this.db
      .prepare(
        "SELECT id, surum, durum, olusturma FROM oge WHERE alan = ? AND anahtar = ? ORDER BY surum DESC",
      )
      .all(r.alan, r.anahtar) as { id: number; surum: number; durum: Durum; olusturma: number }[];
    return {
      ...ozetle(r),
      dosyalar: json<OgeDosyasi[]>(r.dosyalar, []),
      satirlar: json<unknown[]>(r.satirlar, []),
      degisiklikler: json<Degisiklik[]>(r.degisiklikler, []),
      kaldirilacaklar: json<string[]>(r.kaldirilacaklar, []),
      gorunus: r.gorunus,
      onizleme: json<OgeAyrinti["onizleme"]>(r.onizleme, null),
      rapor: json<unknown>(r.rapor, null),
      kontrol: json<KontrolRaporu>(r.kontrol, { sonuc: "gecti", satirlar: [] }),
      onayliSatirlar: json<number[] | null>(r.onayli_satirlar, null),
      notlar,
      surumler,
      koken: this.koken(r),
      test2: this.oyunAlani?.bilgi(r.id, r.alan as AlanId) ?? null,
    };
  }

  /** Öğe özetine test2 durumunu ekler (bağ yoksa olduğu gibi). */
  private test2li(o: OgeOzeti): OgeOzeti {
    const t = this.oyunAlani?.bilgi(o.id, o.alan) ?? null;
    return t ? { ...o, test2: t } : o;
  }

  private koken(r: OgeSatiri): Koken {
    const p = r.paket_id
      ? (this.db.prepare("SELECT id, klasor, revizyon FROM paket WHERE id = ?").get(r.paket_id) as
          | { id: number; klasor: string; revizyon: string | null }
          | undefined)
      : undefined;
    return {
      alan: r.alan as AlanId,
      talimatSurum: r.talimat_surum,
      teslimId: r.teslim_id,
      isId: r.is_id,
      varyantIs: r.varyant_is,
      kaynak: r.kaynak === "elle" ? "elle" : "mcp",
      onaylayan: r.onaylayan,
      otomatik: r.otomatik === 1,
      karar: r.karar,
      paket: p ?? null,
    };
  }

  /** Öğenin bir dosyası (sahip arayüzü önizlemesi için). */
  ogeDosyasi(ogeId: number, ozet: string): OgeDosyasi | null {
    const r = this.ogeSatiri(ogeId);
    return r ? (json<OgeDosyasi[]>(r.dosyalar, []).find((d) => d.ozet === ozet) ?? null) : null;
  }

  bekleyenler(alan: AlanId | null, kalanlarDahil = false): OgeOzeti[] {
    const durumlar = kalanlarDahil ? "('bekliyor','kaldi')" : "('bekliyor')";
    const denetim = " OR denetim = 1";
    const r = (alan
      ? this.db
          .prepare(
            `SELECT * FROM oge WHERE alan = ? AND (durum IN ${durumlar}${denetim}) ORDER BY olusturma, id`,
          )
          .all(alan)
      : this.db
          .prepare(`SELECT * FROM oge WHERE (durum IN ${durumlar}${denetim}) ORDER BY olusturma, id`)
          .all()) as unknown as OgeSatiri[];
    return r.map((x) => this.test2li(ozetle(x)));
  }

  arsiv(q: {
    alan?: AlanId | null;
    ad?: string | null;
    durum?: Durum | null;
    tarihten?: number | null;
    tarihe?: number | null;
    sayfa?: number;
  }): { ogeler: OgeOzeti[]; toplam: number } {
    const kosul: string[] = [];
    const deger: (string | number)[] = [];
    if (q.alan) {
      kosul.push("alan = ?");
      deger.push(q.alan);
    }
    if (q.ad) {
      kosul.push("(anahtar LIKE ? ESCAPE '\\' OR ad LIKE ? ESCAPE '\\')");
      const k = `%${ogeAnahtari(q.ad).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      deger.push(k, `%${q.ad.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    }
    if (q.durum) {
      kosul.push("durum = ?");
      deger.push(q.durum);
    }
    if (q.tarihten) {
      kosul.push("olusturma >= ?");
      deger.push(q.tarihten);
    }
    if (q.tarihe) {
      kosul.push("olusturma <= ?");
      deger.push(q.tarihe);
    }
    const where = kosul.length ? `WHERE ${kosul.join(" AND ")}` : "";
    const sayfa = Math.max(0, q.sayfa ?? 0);
    const toplam = Number(
      (this.db.prepare(`SELECT COUNT(*) AS n FROM oge ${where}`).get(...deger) as { n: number }).n,
    );
    const ogeler = (
      this.db
        .prepare(`SELECT * FROM oge ${where} ORDER BY id DESC LIMIT 50 OFFSET ?`)
        .all(...deger, sayfa * 50) as unknown as OgeSatiri[]
    ).map((x) => this.test2li(ozetle(x)));
    return { ogeler, toplam };
  }

  // ---- Karar --------------------------------------------------------------------------------------------

  karar(
    id: number,
    karar: "onay" | "ret" | "duzeltme",
    not: { hazir: HazirNotKodu | null; metin: string; satirlar: number[] | null },
    kim: string,
    now: number,
  ): OgeOzeti {
    const r = this.ogeSatiri(id);
    if (!r) throw new IsHatasi(404, "Teslim bulunamadı.");
    const eski = r.durum as Durum;
    if (eski !== "bekliyor") throw new IsHatasi(409, "Bu teslim için karar zaten verilmiş.");
    const alan = r.alan as AlanId;
    if (karar !== "onay" && !not.hazir && not.metin.trim().length < 2)
      throw new IsHatasi(400, "Ret ve düzeltme için bir not seç ya da yaz.");
    const metin = [not.hazir ? hazirNotMetni(not.hazir) : "", not.metin.trim()].filter(Boolean).join(" — ");
    let notId: number | null = null;
    islem(this.db, () => {
      if (karar === "onay" && r.tur === "fikir") {
        this.durumYaz(id, "onaylandi", now, { karar: now });
        this.db.prepare("UPDATE oge SET onaylayan = ? WHERE id = ?").run(kim, id);
        this.zevkEkle(alan, id, r.ad, "onay", metin, now);
        // Seçim yalnız "fikir turu" işinde (2–3 fikirden biri); fikir panosu işlerinde her fikir ayrı onaylanır.
        if (r.is_id !== null)
          this.db
            .prepare(
              "UPDATE isler SET secilen_fikir = ?, secim_notu = ? WHERE id = ? AND secilen_fikir IS NULL AND fikir_turu = 1",
            )
            .run(id, not.metin, r.is_id);
      } else if (karar === "onay") {
        const satirSayisi = json<unknown[]>(r.satirlar, []).length;
        const secili = not.satirlar
          ? [...new Set(not.satirlar)]
              .filter((i) => Number.isInteger(i) && i >= 0 && i < satirSayisi)
              .sort((a, b) => a - b)
          : null;
        if (not.satirlar && secili?.length === 0) throw new IsHatasi(400, "Onaylanacak satır seçilmedi.");
        this.db
          .prepare("UPDATE oge SET onayli_satirlar = ? WHERE id = ?")
          .run(secili && secili.length < satirSayisi ? JSON.stringify(secili) : null, id);
        this.durumYaz(id, "onaylandi", now, { karar: now });
        this.durumYaz(id, "havuzda", now);
        this.db.prepare("UPDATE oge SET onaylayan = ? WHERE id = ?").run(kim, id);
        this.zevkEkle(alan, id, r.ad, "onay", metin, now);
        if (metin) notId = this.notEkle(alan, id, "yorum", null, metin, now);
        // Bağlı istek kartı tamamlanır.
        this.db
          .prepare("UPDATE istek_karti SET durum = 'tamam' WHERE sonuc_oge = ? AND durum = 'onaylandi'")
          .run(id);
      } else {
        this.durumYaz(id, karar === "ret" ? "reddedildi" : "duzeltme_istendi", now, { karar: now });
        notId = this.notEkle(alan, id, karar === "ret" ? "ret" : "duzeltme", not.hazir, metin, now);
        if (karar === "ret") this.zevkEkle(alan, id, r.ad, "ret", metin, now);
      }
    });
    this.sonKararlar.set(id, { zaman: now, eski, notId });
    this.denetim.yaz(
      now,
      kim,
      karar === "onay" ? "onay" : karar === "ret" ? "ret" : "duzeltme",
      alan,
      `öğe ${id}${not.hazir ? ` (${not.hazir})` : ""}`,
    );
    if (not.hazir) this.talimatOnerisiDenetle(alan, not.hazir, now);
    const son = this.ogeSatiri(id);
    if (!son) throw new IsHatasi(500, "Teslim okunamadı.");
    return ozetle(son);
  }

  /** Son kararı 10 sn içinde geri alır (arayüzdeki "geri al"). */
  kararGeriAl(id: number, kim: string, now: number): OgeOzeti {
    const k = this.sonKararlar.get(id);
    const r = this.ogeSatiri(id);
    if (!k || !r || now - k.zaman > GERI_AL_MS + 5_000) throw new IsHatasi(409, "Geri alma süresi geçti.");
    if (!["havuzda", "reddedildi", "duzeltme_istendi", "onaylandi"].includes(r.durum))
      throw new IsHatasi(409, "Bu karar artık geri alınamaz.");
    islem(this.db, () => {
      this.db
        .prepare(
          "UPDATE oge SET durum = ?, karar = NULL, onayli_satirlar = NULL, guncelleme = ? WHERE id = ?",
        )
        .run(k.eski, now, id);
      if (k.notId !== null) this.db.prepare("DELETE FROM notlar WHERE id = ?").run(k.notId);
      this.db.prepare("DELETE FROM zevk WHERE oge_id = ?").run(id);
      this.db.prepare("UPDATE oge SET onaylayan = NULL WHERE id = ?").run(id);
      this.db
        .prepare("UPDATE isler SET secilen_fikir = NULL, secim_notu = NULL WHERE secilen_fikir = ?")
        .run(id);
    });
    this.sonKararlar.delete(id);
    // Ret geri alındıysa öğe yeniden bekliyor: test2'ye yeniden yüklenir.
    this.oyunAlani?.durumDegisti(id, k.eski);
    this.denetim.yaz(now, kim, "onay", r.alan, `öğe ${id} kararı geri alındı`);
    const son = this.ogeSatiri(id);
    if (!son) throw new IsHatasi(500, "Teslim okunamadı.");
    return ozetle(son);
  }

  // ---- Talimatlar (UM-İ3, İ4) ----------------------------------------------------------------------------

  talimat(alan: AlanId, now: number): { surum: number; metin: string; olusturma: number } {
    const r = this.db
      .prepare("SELECT surum, metin, olusturma FROM talimat WHERE alan = ? ORDER BY surum DESC LIMIT 1")
      .get(alan) as { surum: number; metin: string; olusturma: number } | undefined;
    if (r) return r;
    this.db
      .prepare("INSERT INTO talimat (alan, surum, metin, olusturma, yazan) VALUES (?, 1, ?, ?, 'taslak')")
      .run(alan, talimatTaslagi(alan), now);
    return { surum: 1, metin: talimatTaslagi(alan), olusturma: now };
  }

  talimatSurumu(alan: AlanId, surum: number): { surum: number; metin: string; olusturma: number } | null {
    return (
      (this.db
        .prepare("SELECT surum, metin, olusturma FROM talimat WHERE alan = ? AND surum = ?")
        .get(alan, surum) as { surum: number; metin: string; olusturma: number } | undefined) ?? null
    );
  }

  talimatKaydet(alan: AlanId, metin: string, kim: string, now: number): number {
    const son = this.talimat(alan, now);
    if (son.metin === metin) return son.surum;
    const surum = son.surum + 1;
    this.db
      .prepare("INSERT INTO talimat (alan, surum, metin, olusturma, yazan) VALUES (?, ?, ?, ?, ?)")
      .run(alan, surum, metin, now, kim);
    this.denetim.yaz(now, kim, "talimat", alan, `sürüm ${surum}`);
    return surum;
  }

  private talimatOnerisiDenetle(alan: AlanId, hazir: HazirNotKodu, now: number): void {
    const n = Number(
      (
        this.db
          .prepare(
            "SELECT COUNT(*) AS n FROM notlar WHERE alan = ? AND hazir = ? AND tur IN ('ret','duzeltme')",
          )
          .get(alan, hazir) as { n: number }
      ).n,
    );
    if (n < TALIMAT_ONERI_ESIGI) return;
    this.db
      .prepare(
        "INSERT INTO talimat_oneri (alan, hazir, durum, guncelleme) VALUES (?, ?, 'bekliyor', ?) ON CONFLICT DO NOTHING",
      )
      .run(alan, hazir, now);
  }

  talimatOnerisiKarar(alan: AlanId, hazir: HazirNotKodu, ekle: boolean, kim: string, now: number): void {
    const r = this.db
      .prepare("SELECT durum FROM talimat_oneri WHERE alan = ? AND hazir = ?")
      .get(alan, hazir) as { durum: string } | undefined;
    if (r?.durum !== "bekliyor") throw new IsHatasi(404, "Öneri bulunamadı.");
    if (ekle) {
      const t = this.talimat(alan, now);
      this.talimatKaydet(
        alan,
        `${t.metin.trimEnd()}\n\n## Sık verilen not\n- "${hazirNotMetni(hazir)}" notu bu alanda sık verildi: teslim etmeden önce buna özellikle dikkat et.\n`,
        kim,
        now,
      );
    }
    this.db
      .prepare("UPDATE talimat_oneri SET durum = ?, guncelleme = ? WHERE alan = ? AND hazir = ?")
      .run(ekle ? "eklendi" : "yok", now, alan, hazir);
  }

  // ---- Geri bildirim ------------------------------------------------------------------------------------

  geriBildirim(alan: AlanId, sinir = 50): (NotKaydi & { ogeAd: string | null })[] {
    return (
      this.db
        .prepare(
          "SELECT n.id, n.oge_id, n.tur, n.hazir, n.metin, n.olusturma, o.ad AS oge_ad FROM notlar n LEFT JOIN oge o ON o.id = n.oge_id WHERE n.alan = ? ORDER BY n.id DESC LIMIT ?",
        )
        .all(alan, sinir) as {
        id: number;
        oge_id: number | null;
        tur: NotKaydi["tur"];
        hazir: HazirNotKodu | null;
        metin: string;
        olusturma: number;
        oge_ad: string | null;
      }[]
    ).map((n) => ({
      id: n.id,
      ogeId: n.oge_id,
      tur: n.tur,
      hazir: n.hazir,
      metin: n.metin,
      olusturma: n.olusturma,
      ogeAd: n.oge_ad,
    }));
  }

  // ---- İşler (UM-İ2, İ10) -------------------------------------------------------------------------------

  private isSatiri(r: Record<string, unknown>): IsKaydi {
    return {
      id: Number(r.id),
      alan: r.alan as AlanId,
      baslik: String(r.baslik),
      aciklama: String(r.aciklama),
      adet: r.adet === null ? null : Number(r.adet),
      sonTarih: r.son_tarih === null ? null : String(r.son_tarih),
      ornek: String(r.ornek ?? ""),
      kaynak: r.kaynak as IsKaydi["kaynak"],
      durum: r.durum as IsKaydi["durum"],
      sira: Number(r.sira),
      olusturma: Number(r.olusturma),
      varyant: r.varyant === null || r.varyant === undefined ? null : Number(r.varyant),
      fikirTuru: Number(r.fikir_turu) === 1,
      secilenFikir: this.secilenFikir(r),
      fikirler: this.isFikirleri(Number(r.id)),
      kisitlar: json<string[]>(typeof r.kisitlar === "string" ? r.kisitlar : null, []),
      kabul: json<string[]>(typeof r.kabul === "string" ? r.kabul : null, []),
      ozet: typeof r.ozet === "string" ? r.ozet : "",
      basladi: r.basladi === null || r.basladi === undefined ? null : Number(r.basladi),
      teslimEdildi:
        r.teslim_edildi === null || r.teslim_edildi === undefined ? null : Number(r.teslim_edildi),
      kilit:
        r.kilit_anahtar === null ||
        r.kilit_anahtar === undefined ||
        r.kilit_zaman === null ||
        r.kilit_zaman === undefined
          ? null
          : { ad: String(r.kilit_ad ?? ""), zaman: Number(r.kilit_zaman) },
    };
  }

  /** İşin uygulayacağı fikirler (is_oku ve istem bunları gösterir). */
  isFikirleri(isId: number): UygulanacakFikir[] {
    const r = this.db
      .prepare(
        "SELECT o.id, o.ad, o.aciklama, o.fikir FROM is_fikir f JOIN oge o ON o.id = f.fikir_id WHERE f.is_id = ? ORDER BY o.id",
      )
      .all(isId) as { id: number; ad: string; aciklama: string; fikir: string | null }[];
    return r.map((x) => {
      const f = json<FikirAlanlari | null>(x.fikir, null);
      const notlar = this.db
        .prepare("SELECT metin FROM notlar WHERE oge_id = ? AND tur = 'yorum' ORDER BY id")
        .all(x.id) as { metin: string }[];
      return {
        fikirId: x.id,
        baslik: x.ad,
        ozet: f?.ozet ?? x.aciklama.slice(0, 300),
        kategori: f?.kategori ?? "",
        etki: f?.etki ?? "",
        zahmet: f?.zahmet ?? "",
        not: notlar
          .map((n) => n.metin)
          .join(" · ")
          .slice(0, 600),
      };
    });
  }

  isler(alan: AlanId, durumlar: IsKaydi["durum"][] = ["oneri", "acik"]): IsKaydi[] {
    const yer = durumlar.map(() => "?").join(",");
    return (
      this.db
        .prepare(`SELECT * FROM isler WHERE alan = ? AND durum IN (${yer}) ORDER BY sira, id`)
        .all(alan, ...durumlar) as Record<string, unknown>[]
    ).map((r) => this.isSatiri(r));
  }

  is(id: number, alan?: AlanId): IsKaydi | null {
    const r = this.db.prepare("SELECT * FROM isler WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!r || (alan && r.alan !== alan)) return null;
    return this.isSatiri(r);
  }

  isEkle(
    alan: AlanId,
    v: { baslik: string; aciklama: string; adet: number | null; sonTarih: string | null; ornek: string },
    kaynak: IsKaydi["kaynak"],
    durum: IsKaydi["durum"],
    kim: string,
    now: number,
    istekId: number | null = null,
    secenek: {
      varyant?: number | null;
      fikirTuru?: boolean;
      kisitlar?: string[];
      kabul?: string[];
      ozet?: string;
      /** "Onaylananları uygula": bu işin uygulayacağı onaylı fikirler. */
      fikirler?: number[];
    } = {},
  ): IsKaydi {
    const fikirler = [...new Set(secenek.fikirler ?? [])];
    for (const f of fikirler) {
      const r = this.db.prepare("SELECT alan, tur, durum FROM oge WHERE id = ?").get(f) as
        | { alan: string; tur: string; durum: string }
        | undefined;
      if (!r || r.alan !== alan || r.tur !== "fikir" || r.durum !== "onaylandi")
        throw new IsHatasi(400, `Fikir #${f} bu alanda onaylı bir fikir değil.`);
    }
    const sira = Number(
      (
        this.db.prepare("SELECT COALESCE(MAX(sira), 0) + 1 AS s FROM isler WHERE alan = ?").get(alan) as {
          s: number;
        }
      ).s,
    );
    const id = Number(
      this.db
        .prepare(
          "INSERT INTO isler (alan, baslik, aciklama, adet, son_tarih, ornek, kaynak, durum, sira, olusturma, istek_id, varyant, fikir_turu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          alan,
          v.baslik,
          v.aciklama,
          v.adet,
          v.sonTarih,
          v.ornek,
          kaynak,
          durum,
          sira,
          now,
          istekId,
          secenek.varyant && secenek.varyant > 1 ? Math.min(secenek.varyant, EN_COK_VARYANT) : null,
          secenek.fikirTuru ? 1 : 0,
        ).lastInsertRowid,
    );
    this.db
      .prepare("UPDATE isler SET kisitlar = ?, kabul = ?, ozet = ? WHERE id = ?")
      .run(
        JSON.stringify(secenek.kisitlar ?? []),
        JSON.stringify(secenek.kabul ?? []),
        secenek.ozet ?? "",
        id,
      );
    for (const f of fikirler)
      this.db.prepare("INSERT OR IGNORE INTO is_fikir (is_id, fikir_id) VALUES (?, ?)").run(id, f);
    this.denetim.yaz(
      now,
      kim,
      "is",
      alan,
      `iş ${id} açıldı${fikirler.length ? ` (${fikirler.length} fikir)` : ""}`,
    );
    if (durum === "acik")
      this.olaylar.bilgi?.(
        `${alanTanimi(alan).ad}: yeni iş açıldı — istemi kopyala`,
        `/alan/${alan}?sekme=isler`,
      );
    const is = this.is(id);
    if (!is) throw new IsHatasi(500, "İş okunamadı.");
    return is;
  }

  isDurum(id: number, durum: IsKaydi["durum"], kim: string, now: number): void {
    const is = this.is(id);
    if (!is) throw new IsHatasi(404, "İş bulunamadı.");
    const izin: Record<IsKaydi["durum"], IsKaydi["durum"][]> = {
      oneri: ["acik", "iptal"],
      acik: ["tamam", "iptal"],
      tamam: ["acik"],
      iptal: [],
    };
    if (!izin[is.durum].includes(durum)) throw new IsHatasi(409, "İş bu duruma geçemez.");
    this.db.prepare("UPDATE isler SET durum = ? WHERE id = ?").run(durum, id);
    this.denetim.yaz(now, kim, "is", is.alan, `iş ${id}: ${durum}`);
  }

  /** İşleri verilen sırayla dizer (yapay zekâ en üsttekinden başlar). */
  isSirala(alan: AlanId, idler: number[], kim: string, now: number): void {
    const mevcut = new Set(this.isler(alan).map((i) => i.id));
    if (idler.some((id) => !mevcut.has(id)))
      throw new IsHatasi(400, "Sıra listesi bu alanın işleriyle uyuşmuyor.");
    islem(this.db, () =>
      idler.forEach((id, i) => {
        this.db.prepare("UPDATE isler SET sira = ? WHERE id = ?").run(i + 1, id);
      }),
    );
    this.denetim.yaz(now, kim, "is", alan, "sıra değişti");
  }

  benzeriniUret(ogeId: number, adet: number, fark: string, kim: string, now: number): IsKaydi {
    const o = this.ogeSatiri(ogeId);
    if (!o) throw new IsHatasi(404, "Teslim bulunamadı.");
    return this.isEkle(
      o.alan as AlanId,
      {
        baslik: `"${o.ad}" gibi ${adet} tane daha`,
        aciklama: fark ? `Bunun gibi ${adet} tane daha; şu farkla: ${fark}` : `Bunun gibi ${adet} tane daha.`,
        adet,
        sonTarih: null,
        ornek: `oge:${ogeId}`,
      },
      "benzer",
      "acik",
      kim,
      now,
    );
  }

  // ---- İstek kartları ve kod istekleri (UM-İ5, İ6) --------------------------------------------------------

  private kartSatiri(r: Record<string, unknown>): IstekKarti {
    return {
      id: Number(r.id),
      acanAlan: r.acan_alan as AlanId,
      istenenAlan: r.istenen_alan as AlanId,
      ne: String(r.ne),
      neden: String(r.neden),
      sonTarih: r.son_tarih === null ? null : String(r.son_tarih),
      durum: r.durum as IstekKarti["durum"],
      isId: r.is_id === null ? null : Number(r.is_id),
      sonucOgeId: r.sonuc_oge === null ? null : Number(r.sonuc_oge),
      olusturma: Number(r.olusturma),
    };
  }

  istekKartiAc(
    acan: AlanId,
    v: { istenenAlan: AlanId; ne: string; neden: string; sonTarih: string | null },
    kim: string,
    now: number,
  ): IstekKarti {
    const bekleyen = Number(
      (
        this.db
          .prepare("SELECT COUNT(*) AS n FROM istek_karti WHERE acan_alan = ? AND durum = 'bekliyor'")
          .get(acan) as { n: number }
      ).n,
    );
    if (bekleyen >= 20)
      throw new IsHatasi(429, "Onay bekleyen çok fazla istek kartın var; önce sahibin bakmasını bekle.");
    const id = Number(
      this.db
        .prepare(
          "INSERT INTO istek_karti (acan_alan, istenen_alan, ne, neden, son_tarih, durum, olusturma) VALUES (?, ?, ?, ?, ?, 'bekliyor', ?)",
        )
        .run(acan, v.istenenAlan, v.ne, v.neden, v.sonTarih, now).lastInsertRowid,
    );
    this.denetim.yaz(now, kim, "istek_karti", acan, `kart ${id} → ${v.istenenAlan}`);
    return this.kartSatiri(
      this.db.prepare("SELECT * FROM istek_karti WHERE id = ?").get(id) as Record<string, unknown>,
    );
  }

  istekKartlari(durum: IstekKarti["durum"] | null = "bekliyor"): IstekKarti[] {
    const r = (
      durum
        ? this.db.prepare("SELECT * FROM istek_karti WHERE durum = ? ORDER BY id").all(durum)
        : this.db.prepare("SELECT * FROM istek_karti ORDER BY id DESC LIMIT 100").all()
    ) as Record<string, unknown>[];
    return r.map((x) => this.kartSatiri(x));
  }

  /** Sahip onaylarsa istenen alana iş düşer (kendi alanına açılan kart = önerilen iş). */
  istekKartiKarar(id: number, onay: boolean, kim: string, now: number): IstekKarti {
    const r = this.db.prepare("SELECT * FROM istek_karti WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!r) throw new IsHatasi(404, "İstek kartı bulunamadı.");
    const k = this.kartSatiri(r);
    if (k.durum !== "bekliyor") throw new IsHatasi(409, "Bu kart için karar verilmiş.");
    islem(this.db, () => {
      if (onay) {
        const kendi = k.acanAlan === k.istenenAlan;
        const is = this.isEkle(
          k.istenenAlan,
          {
            baslik: k.ne.slice(0, 120),
            aciklama: kendi ? k.neden : `${alanTanimi(k.acanAlan).ad} alanının isteği: ${k.neden}`,
            adet: null,
            sonTarih: k.sonTarih,
            ornek: "",
          },
          kendi ? "yz" : "istek",
          "acik",
          kim,
          now,
          id,
        );
        this.db.prepare("UPDATE istek_karti SET durum = 'onaylandi', is_id = ? WHERE id = ?").run(is.id, id);
      } else this.db.prepare("UPDATE istek_karti SET durum = 'reddedildi' WHERE id = ?").run(id);
    });
    this.denetim.yaz(
      now,
      kim,
      "istek_karti",
      k.istenenAlan,
      `kart ${id} ${onay ? "onaylandı" : "reddedildi"}`,
    );
    return this.kartSatiri(
      this.db.prepare("SELECT * FROM istek_karti WHERE id = ?").get(id) as Record<string, unknown>,
    );
  }

  kodIstegiAc(
    alan: AlanId,
    v: { baslik: string; gerekce: string; ornek: string; etki: string },
    kim: string,
    now: number,
  ): KodIstegi {
    const id = Number(
      this.db
        .prepare(
          "INSERT INTO kod_istegi (alan, baslik, gerekce, ornek, etki, durum, olusturma) VALUES (?, ?, ?, ?, ?, 'bekliyor', ?)",
        )
        .run(alan, v.baslik, v.gerekce, v.ornek, v.etki, now).lastInsertRowid,
    );
    this.denetim.yaz(now, kim, "kod_istegi", alan, `istek ${id}`);
    return this.kodIstekleri(null).find((x) => x.id === id) as KodIstegi;
  }

  kodIstekleri(durum: KodIstegi["durum"] | null = "bekliyor"): KodIstegi[] {
    const r = (
      durum
        ? this.db.prepare("SELECT * FROM kod_istegi WHERE durum = ? ORDER BY id").all(durum)
        : this.db.prepare("SELECT * FROM kod_istegi ORDER BY id DESC LIMIT 200").all()
    ) as Record<string, unknown>[];
    return r.map((x) => ({
      id: Number(x.id),
      alan: x.alan as AlanId,
      baslik: String(x.baslik),
      gerekce: String(x.gerekce),
      ornek: String(x.ornek),
      etki: String(x.etki),
      durum: x.durum as KodIstegi["durum"],
      olusturma: Number(x.olusturma),
    }));
  }

  kodIstegiDurum(id: number, durum: KodIstegi["durum"], kim: string, now: number): void {
    const r = this.db.prepare("SELECT alan, durum FROM kod_istegi WHERE id = ?").get(id) as
      | { alan: string; durum: string }
      | undefined;
    if (!r) throw new IsHatasi(404, "Kod isteği bulunamadı.");
    const izin: Record<string, string[]> = {
      bekliyor: ["onaylandi", "reddedildi"],
      onaylandi: ["yapildi"],
      reddedildi: [],
      yapildi: [],
    };
    if (!izin[r.durum]?.includes(durum)) throw new IsHatasi(409, "Kod isteği bu duruma geçemez.");
    this.db.prepare("UPDATE kod_istegi SET durum = ? WHERE id = ?").run(durum, id);
    this.denetim.yaz(now, kim, "kod_istegi", r.alan, `istek ${id}: ${durum}`);
  }

  // ---- Tek tık aktarım (UM-İ8) ---------------------------------------------------------------------------

  /** Öğe tek tıkla oyuna gidebilir mi: içerik/moderasyon alanında, dosyasız satır teslimi. */
  tekTikMi(o: { alan: AlanId; dosyalar: unknown[]; satirlar: unknown[] }): boolean {
    return alanTanimi(o.alan).tekTik && o.satirlar.length > 0 && o.dosyalar.length === 0;
  }

  /**
   * Öğe "Yöneticiye gönder" paketine girer mi (UM-İ7): tek tık olmayan her şey ve içerik havuzu satırları (varsayılan
   * yol test2 → kabul → yönetici "ekle"; içerikte "Oyuna aktar" da kabul havuzunda durdukça açık kalır).
   */
  paketeGirer(o: { alan: AlanId; dosyalar: unknown[]; satirlar: unknown[] }): boolean {
    return !this.tekTikMi(o) || o.alan === "icerik";
  }

  async aktar(ogeId: number, kim: string, now: number): Promise<AktarimKaydi[]> {
    const o = this.oge(ogeId);
    if (!o) throw new IsHatasi(404, "Teslim bulunamadı.");
    if (o.durum !== "havuzda")
      throw new IsHatasi(409, "Yalnız onaylanmış ve aktarılmamış satırlar aktarılır.");
    if (!this.tekTikMi(o))
      throw new IsHatasi(400, "Bu teslim tek tıkla aktarılamaz; yöneticiye paketle gönderilir.");
    if (!this.oyun.acik) throw new IsHatasi(503, "Oyun bağlantısı ayarlı değil.");
    const secili = o.onayliSatirlar ? o.satirlar.filter((_, i) => o.onayliSatirlar?.includes(i)) : o.satirlar;
    const kayitlar: AktarimKaydi[] = [];
    const yaz = (tur: AktarimKaydi["tur"], hedef: string, oyunId: string, ozet: string): void => {
      const id = Number(
        this.db
          .prepare(
            "INSERT INTO aktarim (oge_id, tur, hedef, oyun_aktarim, ozet, olusturma) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(ogeId, tur, hedef, oyunId, ozet, now).lastInsertRowid,
      );
      kayitlar.push({
        id,
        ogeId,
        tur,
        hedef,
        oyunAktarimId: oyunId,
        ozet,
        olusturma: now,
        geriAlindi: false,
      });
    };
    try {
      if (o.alan === "moderasyon") {
        const k = secili.flatMap((s) =>
          s && typeof s === "object" && "kalip" in s && "tur" in s
            ? [{ kalip: String((s as { kalip: unknown }).kalip), tur: String((s as { tur: unknown }).tur) }]
            : [],
        );
        const r = await this.oyun.moderasyonEkle(k);
        yaz(
          "moderasyon-ekle",
          "moderasyon",
          r.aktarimId,
          `${r.eklenen} kalıp eklendi, ${r.atlanan.length} atlandı`,
        );
      } else {
        const gruplar = new Map<string, unknown[]>();
        for (const s of secili) {
          const h =
            s && typeof s === "object" && typeof (s as { havuz?: unknown }).havuz === "string"
              ? (s as { havuz: string }).havuz
              : "";
          if (!h) continue;
          gruplar.set(h, [...(gruplar.get(h) ?? []), s]);
        }
        for (const [havuz, satirlar] of gruplar) {
          if (o.tur === "kaldirma-onerisi") {
            const r = await this.oyun.havuzKapat(
              havuz,
              satirlar.map((s) => String((s as { anahtar?: unknown }).anahtar ?? "")),
            );
            yaz("havuz-kapat", havuz, r.aktarimId, `${r.kapatilan} kayıt kapatıldı`);
          } else {
            const r = await this.oyun.havuzEkle(
              havuz,
              satirlar.map((s) => (s as { alanlar: Record<string, string> }).alanlar),
            );
            yaz("havuz-ekle", havuz, r.aktarimId, `${r.eklenen} satır eklendi, ${r.atlanan.length} atlandı`);
          }
        }
      }
    } catch (err) {
      if (kayitlar.length) this.durumYaz(ogeId, "canlida", now);
      throw new IsHatasi(502, err instanceof OyunHatasi ? err.message : "Aktarım yapılamadı.");
    }
    this.katalog.havuzOnbellekSil();
    this.durumYaz(ogeId, "canlida", now);
    this.denetim.yaz(now, kim, "aktarim", o.alan, `öğe ${ogeId}: ${kayitlar.map((k) => k.ozet).join("; ")}`);
    return kayitlar;
  }

  aktarimlar(sinir = 50): AktarimKaydi[] {
    return (
      this.db.prepare("SELECT * FROM aktarim ORDER BY id DESC LIMIT ?").all(sinir) as Record<
        string,
        unknown
      >[]
    ).map((r) => ({
      id: Number(r.id),
      ogeId: Number(r.oge_id),
      tur: r.tur as AktarimKaydi["tur"],
      hedef: String(r.hedef),
      oyunAktarimId: String(r.oyun_aktarim),
      ozet: String(r.ozet),
      olusturma: Number(r.olusturma),
      geriAlindi: Number(r.geri_alindi) === 1,
    }));
  }

  async aktarimGeriAl(id: number, kim: string, now: number): Promise<void> {
    const a = this.aktarimlar(10_000).find((x) => x.id === id);
    if (!a) throw new IsHatasi(404, "Aktarım bulunamadı.");
    if (a.geriAlindi) throw new IsHatasi(409, "Bu aktarım zaten geri alındı.");
    try {
      await this.oyun.geriAl(a.oyunAktarimId);
    } catch (err) {
      throw new IsHatasi(502, err instanceof OyunHatasi ? err.message : "Geri alınamadı.");
    }
    this.db.prepare("UPDATE aktarim SET geri_alindi = 1 WHERE id = ?").run(id);
    const kalan = Number(
      (
        this.db
          .prepare("SELECT COUNT(*) AS n FROM aktarim WHERE oge_id = ? AND geri_alindi = 0")
          .get(a.ogeId) as { n: number }
      ).n,
    );
    if (kalan === 0) this.durumYaz(a.ogeId, "havuzda", now);
    this.katalog.havuzOnbellekSil();
    this.denetim.yaz(now, kim, "aktarim_geri_al", a.hedef, `aktarım ${id}`);
  }

  // ---- Pano ve alan sayfası (UM-U1, U2) -------------------------------------------------------------------

  pano(
    now: number,
    kota: { kullanilan: number; sinir: number },
    ai: Pano["ai"] = { acik: false, bugun: 0, sinir: 0 },
  ): Pano {
    const alanlar: AlanKarti[] = ALAN_IDLERI.map((alan) => {
      const sayi = (sql: string, ...p: (string | number)[]): number =>
        Number((this.db.prepare(sql).get(alan, ...p) as { n: number | null }).n ?? 0);
      const karar7 = sayi(
        "SELECT COUNT(*) AS n FROM oge WHERE alan = ? AND karar > ? AND durum NOT IN ('bekliyor')",
        now - 7 * GUN,
      );
      const onay7 = sayi(
        "SELECT COUNT(*) AS n FROM oge WHERE alan = ? AND karar > ? AND durum IN ('havuzda','pakette','oyuna_eklendi','canlida','onaylandi')",
        now - 7 * GUN,
      );
      const son = this.db.prepare("SELECT MAX(olusturma) AS n FROM oge WHERE alan = ?").get(alan) as {
        n: number | null;
      };
      return {
        alan,
        bekleyen: sayi("SELECT COUNT(*) AS n FROM oge WHERE alan = ? AND durum = 'bekliyor'"),
        sonTeslim: son.n,
        onayOrani7g: karar7 ? onay7 / karar7 : null,
        geriDonen24s: sayi(
          "SELECT COUNT(*) AS n FROM oge WHERE alan = ? AND durum = 'kaldi' AND olusturma > ?",
          now - GUN,
        ),
        havuzda: sayi("SELECT COUNT(*) AS n FROM oge WHERE alan = ? AND durum = 'havuzda'"),
        son: this.sonOnizleme(alan),
      };
    });
    const uyarilar: Uyari[] = [];
    if (kota.kullanilan > kota.sinir * 0.95)
      uyarilar.push({
        seviye: "kirmizi",
        metin: "Dosya deposu dolmak üzere (%95). Eski arşivi temizle ya da kotayı artır.",
      });
    else if (kota.kullanilan > kota.sinir * 0.8)
      uyarilar.push({ seviye: "sari", metin: "Dosya deposunun %80'i doldu." });
    for (const a of alanlar)
      if (a.geriDonen24s >= 10)
        uyarilar.push({
          seviye: "kirmizi",
          metin: `${alanTanimi(a.alan).ad}: son 24 saatte ${a.geriDonen24s} teslim geri döndü.`,
          alan: a.alan,
        });
    for (const r of this.raporUyarilari()) uyarilar.push(r);
    if (!this.oyun.acik)
      uyarilar.push({
        seviye: "sari",
        metin: "Oyun bağlantısı ayarlı değil: tek tık aktarım ve canlı havuz denetimi kapalı.",
      });
    const tekTik = this.db
      .prepare("SELECT alan, dosyalar, satirlar FROM oge WHERE durum = 'havuzda'")
      .all() as { alan: string; dosyalar: string; satirlar: string }[];
    const tt = tekTik.filter(
      (o) =>
        isAlanId(o.alan) &&
        this.tekTikMi({
          alan: o.alan,
          dosyalar: json<unknown[]>(o.dosyalar, []),
          satirlar: json<unknown[]>(o.satirlar, []),
        }),
    ).length;
    const oneriler = (
      this.db.prepare("SELECT alan, hazir FROM talimat_oneri WHERE durum = 'bekliyor'").all() as {
        alan: AlanId;
        hazir: HazirNotKodu;
      }[]
    ).map((o) => ({
      ...o,
      sayi: Number(
        (
          this.db
            .prepare("SELECT COUNT(*) AS n FROM notlar WHERE alan = ? AND hazir = ?")
            .get(o.alan, o.hazir) as { n: number }
        ).n,
      ),
    }));
    return {
      alanlar,
      uyarilar,
      istekKartlari: this.istekKartlari("bekliyor"),
      kodIstekleri: this.kodIstekleri("bekliyor"),
      talimatOnerileri: oneriler,
      havuz: {
        toplam: tekTik.length,
        tekTik: tt,
        paketlenecek: tekTik.filter(
          (o) =>
            isAlanId(o.alan) &&
            this.paketeGirer({
              alan: o.alan,
              dosyalar: json<unknown[]>(o.dosyalar, []),
              satirlar: json<unknown[]>(o.satirlar, []),
            }),
        ).length,
      },
      geriDonen24s: this.geriDonenSay(now - GUN),
      kota,
      bugun: this.bugun(now),
      ai,
      denetimBekleyen: Number(
        (this.db.prepare("SELECT COUNT(*) AS n FROM oge WHERE denetim = 1").get() as { n: number }).n,
      ),
      ...(this.oyunAlani ? { test2: this.oyunAlani.durum() } : {}),
    };
  }

  private bugun(now: number): Pano["bugun"] {
    const bas = now - GUN;
    const n = (sql: string): number => Number((this.db.prepare(sql).get(bas) as { n: number }).n);
    return {
      gelen: n("SELECT COUNT(*) AS n FROM oge WHERE olusturma > ? AND durum != 'kaldi'"),
      onaylanan: n(
        "SELECT COUNT(*) AS n FROM oge WHERE karar > ? AND durum IN ('havuzda','pakette','oyuna_eklendi','canlida')",
      ),
      reddedilen: n(
        "SELECT COUNT(*) AS n FROM oge WHERE karar > ? AND durum IN ('reddedildi','duzeltme_istendi')",
      ),
      geriDonen: n("SELECT COUNT(*) AS n FROM oge WHERE olusturma > ? AND durum = 'kaldi'"),
    };
  }

  /** Alanın son teslimi (geri dönenler hariç) ve küçük önizlemesi. */
  private sonOnizleme(alan: AlanId): AlanKarti["son"] {
    const r = this.db
      .prepare("SELECT * FROM oge WHERE alan = ? AND durum != 'kaldi' ORDER BY id DESC LIMIT 1")
      .get(alan) as unknown as OgeSatiri | undefined;
    if (!r) return null;
    const dosyalar = json<OgeDosyasi[]>(r.dosyalar, []);
    const satirlar = json<unknown[]>(r.satirlar, []);
    let kucuk: Kucuk | null = null;
    const g = dosyalar.find((d) => d.tur === "png");
    const s = dosyalar.find((d) => d.meta?.tur === "ses");
    if (g) kucuk = { tur: "gorsel", ogeId: r.id, ozet: g.ozet };
    else if (s && s.meta?.tur === "ses")
      kucuk = { tur: "dalga", dalga: s.meta.dalga.filter((_, i) => i % 4 === 0) };
    else if (satirlar.length)
      kucuk = {
        tur: "satirlar",
        satirlar: satirlar.slice(0, 3).map((x) => {
          if (x && typeof x === "object") {
            const o = x as Record<string, unknown>;
            const alanlar =
              o.alanlar && typeof o.alanlar === "object"
                ? Object.values(o.alanlar as Record<string, unknown>)
                : null;
            if (alanlar) return alanlar.map(String).join(" · ").slice(0, 60);
            return String(o.name ?? o.kalip ?? o.ad ?? Object.values(o)[0] ?? "").slice(0, 60);
          }
          return String(x).slice(0, 60);
        }),
      };
    else if (json<Degisiklik[]>(r.degisiklikler, []).length) {
      const d = json<Degisiklik[]>(r.degisiklikler, []);
      kucuk = {
        tur: "satirlar",
        satirlar: d.slice(0, 3).flatMap((x) =>
          Object.keys(x.yeni)
            .filter((k) => JSON.stringify(x.eski[k]) !== JSON.stringify(x.yeni[k]))
            .slice(0, 2)
            .map(
              (k) =>
                `${k}: ${String(x.eski[k] ?? "—").slice(0, 20)} → ${String(x.yeni[k] ?? "—").slice(0, 20)}`,
            ),
        ),
      };
    } else if (r.aciklama) kucuk = { tur: "metin", metin: r.aciklama.slice(0, 120) };
    return { id: r.id, ad: r.ad, durum: r.durum as Durum, olusturma: r.olusturma, kucuk };
  }

  /** Test alanının en son raporundaki kırmızı/sarı işaretler (UM-U1, U9). */
  raporUyarilari(): Uyari[] {
    const r = this.db
      .prepare(
        "SELECT rapor FROM oge WHERE alan = 'test' AND rapor IS NOT NULL AND durum != 'kaldi' ORDER BY id DESC LIMIT 1",
      )
      .get() as { rapor: string } | undefined;
    const j = json<unknown>(r?.rapor, null);
    if (!j || typeof j !== "object") return [];
    const out: Uyari[] = [];
    const rj = j as { geceTest?: unknown; hatalar?: unknown };
    if (Array.isArray(rj.geceTest)) {
      const kalan = rj.geceTest.filter(
        (x) => x && typeof x === "object" && Number((x as { kaldi?: unknown }).kaldi) > 0,
      ).length;
      if (kalan)
        out.push({
          seviye: "kirmizi",
          metin: `Gece testinde ${kalan} oyunda kalan senaryo var.`,
          alan: "test",
        });
    }
    if (Array.isArray(rj.hatalar)) {
      const kritik = rj.hatalar.filter(
        (x) => x && typeof x === "object" && (x as { onem?: unknown }).onem === "kritik",
      ).length;
      if (kritik) out.push({ seviye: "kirmizi", metin: `${kritik} kritik hata kartı açık.`, alan: "test" });
    }
    return out;
  }

  alanSayfasi(alan: AlanId, now: number): AlanSayfasi {
    const t = this.talimat(alan, now);
    const kalanlariGoster = this.ayar(`kalanlar:${alan}`) === "1";
    const sayi = (sql: string): number =>
      Number((this.db.prepare(sql).get(alan) as { n: number | null }).n ?? 0);
    const ort = this.db
      .prepare("SELECT AVG(karar - olusturma) AS n FROM oge WHERE alan = ? AND karar IS NOT NULL")
      .get(alan) as { n: number | null };
    return {
      alan,
      bekleyenler: this.bekleyenler(alan, kalanlariGoster),
      isler: this.isler(alan, ["oneri", "acik"]),
      talimat: t,
      talimatSurumleri: this.db
        .prepare("SELECT surum, olusturma FROM talimat WHERE alan = ? ORDER BY surum DESC")
        .all(alan) as { surum: number; olusturma: number }[],
      anahtarlar: this.anahtarlar.liste(alan),
      araclar: this.aracIstatistigi(alan),
      istatistik: {
        teslim: sayi("SELECT COUNT(*) AS n FROM oge WHERE alan = ?"),
        onay: sayi(
          "SELECT COUNT(*) AS n FROM oge WHERE alan = ? AND durum IN ('havuzda','pakette','oyuna_eklendi','canlida')",
        ),
        ret: sayi("SELECT COUNT(*) AS n FROM oge WHERE alan = ? AND durum = 'reddedildi'"),
        ortalamaInceleme: ort.n,
        geriDonen: sayi("SELECT COUNT(*) AS n FROM oge WHERE alan = ? AND durum = 'kaldi'"),
      },
      kalanlariGoster,
      uygulama: {
        not: this.ayar(`uygulama:${alan}`) ?? "",
        baglanti: this.ayar(`baglanti:${alan}`) === "ssh" ? "ssh" : "mcp",
      },
      sinir: {
        ...this.sinir(alan),
        bugun: this.bugunTeslim(alan, now),
        hafta: this.bugunTeslim(alan, now, 7),
      },
      guven: (["yeni", "duzenleme", "kaldirma-onerisi", "rapor"] as const).map((tur) => {
        const st = this.guvenIstatistigi(alan);
        const engel = aslaOtomatik(alan, tur)?.neden ?? null;
        return {
          tur,
          acik: this.guvenAcik(alan, tur),
          engel,
          oran: st.oran,
          karar: st.karar,
          uygun: !engel && st.uygun,
        };
      }),
      ...(this.oyunAlani && oyunAlaniAlaniMi(alan) ? { test2: this.oyunAlani.durum() } : {}),
    };
  }

  /** Yapay zekâ işi ilk kez okudu (UM-R2 "başladı"). */
  isBasladi(id: number, now: number): void {
    const r = this.db.prepare("UPDATE isler SET basladi = ? WHERE id = ? AND basladi IS NULL").run(now, id);
    if (r.changes > 0) {
      const is = this.is(id);
      if (is) this.olaylar.degisti?.("is", is.alan);
    }
  }

  // ---- İş kilidi (sözleşme bölüm 8) ----------------------------------------------------------------------

  /** Kilit sahibi; 2 saat hareketsizlikte kilit yok sayılır. */
  kilit(id: number, now: number): { anahtarId: number; ad: string; zaman: number } | null {
    const r = this.db
      .prepare("SELECT kilit_anahtar, kilit_ad, kilit_zaman FROM isler WHERE id = ?")
      .get(id) as
      | { kilit_anahtar: number | null; kilit_ad: string | null; kilit_zaman: number | null }
      | undefined;
    if (!r || r.kilit_anahtar === null || r.kilit_zaman === null || now - r.kilit_zaman > KILIT_SURESI_MS)
      return null;
    return { anahtarId: r.kilit_anahtar, ad: r.kilit_ad ?? "", zaman: r.kilit_zaman };
  }

  /** `is_oku`: kilit boşsa (ya da zaten bu anahtarındaysa) alır; başkasındaysa false. */
  isKilitle(id: number, anahtarId: number, ad: string, now: number): boolean {
    const k = this.kilit(id, now);
    if (k && k.anahtarId !== anahtarId) return false;
    this.db
      .prepare("UPDATE isler SET kilit_anahtar = ?, kilit_ad = ?, kilit_zaman = ? WHERE id = ?")
      .run(anahtarId, ad, now, id);
    if (!k) {
      const is = this.is(id);
      if (is) this.olaylar.degisti?.("kilit", is.alan);
    }
    return true;
  }

  /** Anahtarın her isteği tuttuğu kilitleri tazeler (hareketsizlik sayacı). */
  kilitTazele(anahtarId: number, now: number): void {
    this.db
      .prepare(
        "UPDATE isler SET kilit_zaman = ? WHERE kilit_anahtar = ? AND durum = 'acik' AND kilit_zaman > ?",
      )
      .run(now, anahtarId, now - KILIT_SURESI_MS);
  }

  kilitAc(id: number, kim: string, now: number): void {
    const is = this.is(id);
    if (!is) throw new IsHatasi(404, "İş bulunamadı.");
    this.db
      .prepare("UPDATE isler SET kilit_anahtar = NULL, kilit_ad = NULL, kilit_zaman = NULL WHERE id = ?")
      .run(id);
    this.denetim.yaz(now, kim, "is", is.alan, `iş ${id} kilidi açıldı`);
  }

  /** Yapay zekânın göreceği iş listesi: kilitliler işaretli, sıradaki boş iş önerilir. */
  yzIsListesi(
    alan: AlanId,
    anahtarId: number,
    now: number,
  ): { isler: (Omit<IsKaydi, "alan" | "kilit"> & { kilit: string | null })[]; siradaki: number | null } {
    const l = this.isler(alan, ["acik"]).map(({ alan: _a, kilit: _k, ...i }) => {
      const k = this.kilit(i.id, now);
      return {
        ...i,
        kilit: k ? (k.anahtarId === anahtarId ? "sende" : `üzerinde çalışılıyor (${k.ad})`) : null,
      };
    });
    return { isler: l, siradaki: l.find((i) => i.kilit === null || i.kilit === "sende")?.id ?? null };
  }

  /** Araç başına onay oranı (anahtar adı ya da bildirilen araç). */
  aracIstatistigi(
    alan: AlanId,
  ): { arac: string; kanal: string; teslim: number; onay: number; oran: number | null }[] {
    const r = this.db
      .prepare(
        `SELECT COALESCE(t.arac, NULLIF(t.anahtar_ad, ''), 'Elle') AS arac, t.kanal AS kanal, COUNT(o.id) AS teslim,
          SUM(CASE WHEN o.durum IN ('havuzda','pakette','oyuna_eklendi','canlida','onaylandi') THEN 1 ELSE 0 END) AS onay,
          SUM(CASE WHEN o.karar IS NOT NULL THEN 1 ELSE 0 END) AS karar
         FROM oge o JOIN teslim t ON t.id = o.teslim_id WHERE o.alan = ? AND o.durum != 'kaldi' GROUP BY 1, 2 ORDER BY 3 DESC`,
      )
      .all(alan) as { arac: string; kanal: string; teslim: number; onay: number; karar: number }[];
    return r.map((x) => ({
      arac: x.arac,
      kanal: x.kanal,
      teslim: Number(x.teslim),
      onay: Number(x.onay),
      oran: Number(x.karar) ? Number(x.onay) / Number(x.karar) : null,
    }));
  }

  /** Açılalı 6 saati geçmiş, hiç başlamamış işleri olan alanlar (günde bir hatırlatma). */
  baslamayanlar(now: number): { alan: AlanId; sayi: number }[] {
    const r = this.db
      .prepare(
        "SELECT alan, COUNT(*) AS n FROM isler WHERE durum = 'acik' AND basladi IS NULL AND olusturma < ? GROUP BY alan",
      )
      .all(now - 6 * 3600_000) as { alan: AlanId; n: number }[];
    const out: { alan: AlanId; sayi: number }[] = [];
    for (const x of r) {
      const son = Number(this.ayar(`hatirlatma:${x.alan}`) ?? 0);
      if (now - son < GUN) continue;
      this.ayarYaz(`hatirlatma:${x.alan}`, String(now));
      out.push({ alan: x.alan, sayi: Number(x.n) });
    }
    return out;
  }

  // ---- Sel önleme (UM-F5) ---------------------------------------------------------------------------------

  sinir(alan: AlanId): { bekleyenTavan: number; gunlukKota: number; haftalikUst: number | null } {
    const j = json<{ bekleyenTavan?: unknown; gunlukKota?: unknown; haftalikUst?: unknown }>(
      this.ayar(`sinir:${alan}`),
      {},
    );
    const t = typeof j.bekleyenTavan === "number" ? j.bekleyenTavan : VARSAYILAN_SINIR.bekleyenTavan;
    const k = typeof j.gunlukKota === "number" ? j.gunlukKota : VARSAYILAN_SINIR.gunlukKota;
    const h = typeof j.haftalikUst === "number" ? j.haftalikUst : null;
    return { bekleyenTavan: t, gunlukKota: k, haftalikUst: h };
  }

  sinirYaz(
    alan: AlanId,
    bekleyenTavan: number,
    gunlukKota: number,
    haftalikUst: number | null,
    kim: string,
    now: number,
  ): void {
    this.ayarYaz(`sinir:${alan}`, JSON.stringify({ bekleyenTavan, gunlukKota, haftalikUst }));
    this.denetim.yaz(now, kim, "ayar", alan, `sınır ${bekleyenTavan}/${gunlukKota}/${haftalikUst ?? "-"}`);
  }

  /** Son `gun` günde yapay zekânın ürettiği (geri dönenler dahil) öğe sayısı: kullanım sayacı. */
  private bugunTeslim(alan: AlanId, now: number, gun = 1): number {
    return Number(
      (
        this.db
          .prepare("SELECT COUNT(*) AS n FROM oge WHERE alan = ? AND olusturma > ? AND kaynak = 'mcp'")
          .get(alan, now - gun * GUN) as { n: number }
      ).n,
    );
  }

  /**
   * İş kuralları (UM-F2): fikir turu açık işte önce 2–3 metin fikri; seçimden sonra tek üretim. Varsayılan her iş tek
   * teslim; sahip görsel varyant istediyse en çok o kadar. Düzeltmeler (her öğesi `oncekiOge` taşıyan teslim) serbesttir.
   */
  private isKurali(g: TeslimGirdisi): void {
    if (g.isId === null) return;
    const is = this.db
      .prepare("SELECT fikir_turu, secilen_fikir, varyant FROM isler WHERE id = ?")
      .get(g.isId) as { fikir_turu: number; secilen_fikir: number | null; varyant: number | null };
    if (g.tur === "fikir") {
      // Fikir turu (2–3 fikirden biri seçilir) kuralları; fikir panosu işlerinde ("30 fikir ver") sınır yok.
      if (is.fikir_turu !== 1) return;
      if (g.ogeler.length > 3) throw new IsHatasi(400, "Fikir turunda en çok 3 kısa fikir teslim edilir.");
      if (is.secilen_fikir !== null)
        throw new IsHatasi(409, "Bu işin fikri seçildi; artık yalnız seçilen fikri üret.");
      return;
    }
    if (g.tur === "rapor") return;
    if (is.fikir_turu === 1 && is.secilen_fikir === null)
      throw new IsHatasi(
        409,
        "Bu iş fikir turuyla açıldı: önce 2–3 fikri yalnız metin olarak teslim et (tur: fikir). Sahip birini seçince üret.",
      );
    if (g.ogeler.every((o) => o.oncekiOge !== null)) return;
    const yapilan = Number(
      (
        this.db
          .prepare(
            "SELECT COUNT(DISTINCT teslim_id) AS n FROM oge WHERE is_id = ? AND tur NOT IN ('fikir','rapor') AND durum != 'kaldi'",
          )
          .get(g.isId) as { n: number }
      ).n,
    );
    // "Onaylananları uygula" işinde her fikir ayrı teslim edilebilir.
    if (yapilan >= Math.max(is.varyant ?? 1, this.isFikirleri(g.isId).length))
      throw new IsHatasi(
        409,
        "Bu iş için teslim zaten yapıldı. Düzeltme gönderiyorsan her öğede oncekiOge yaz; yeni bir şey üretmek için iş önerisi aç.",
      );
  }

  private secilenFikir(r: Record<string, unknown>): IsKaydi["secilenFikir"] {
    if (r.secilen_fikir === null || r.secilen_fikir === undefined) return null;
    const o = this.db
      .prepare("SELECT id, ad, aciklama, gorunus FROM oge WHERE id = ?")
      .get(Number(r.secilen_fikir)) as
      | { id: number; ad: string; aciklama: string; gorunus: string }
      | undefined;
    return o
      ? { ogeId: o.id, ad: o.ad, aciklama: o.aciklama, gorunus: o.gorunus, not: String(r.secim_notu ?? "") }
      : null;
  }

  /** Fikir seçimi: seçilen işe bağlanır (isteğe bağlı "şunu değiştir" notuyla), diğer fikirler gerekçesiz arşive. */
  fikirSec(ogeId: number, not: string, kim: string, now: number): void {
    const r = this.ogeSatiri(ogeId);
    if (r?.tur !== "fikir" || r.durum !== "bekliyor") throw new IsHatasi(404, "Seçilecek fikir bulunamadı.");
    const alan = r.alan as AlanId;
    islem(this.db, () => {
      this.db
        .prepare("UPDATE oge SET durum = 'onaylandi', karar = ?, onaylayan = ?, guncelleme = ? WHERE id = ?")
        .run(now, kim, now, ogeId);
      this.zevkEkle(alan, ogeId, r.ad, "onay", not, now);
      this.notEkle(
        alan,
        ogeId,
        "yorum",
        null,
        `Seçilen fikir: ${r.ad}.${not ? ` Değiştir: ${not}` : ""} Yalnız bunu bir kez üret.`,
        now,
      );
      // Yalnız "fikir turu" işinde (2–3 fikirden biri): seçim işe bağlanır, diğerleri arşive. Fikir panosu
      // işlerinde ("30 fikir ver") her fikir ayrı karar alır; kardeşlerine dokunulmaz.
      const fikirTuru =
        r.is_id !== null &&
        Number(
          (
            this.db.prepare("SELECT fikir_turu FROM isler WHERE id = ?").get(r.is_id) as
              | { fikir_turu: number }
              | undefined
          )?.fikir_turu,
        ) === 1;
      if (r.is_id !== null && fikirTuru) {
        this.db
          .prepare("UPDATE isler SET secilen_fikir = ?, secim_notu = ? WHERE id = ?")
          .run(ogeId, not, r.is_id);
        this.db
          .prepare(
            "UPDATE oge SET durum = 'arsiv', guncelleme = ? WHERE is_id = ? AND tur = 'fikir' AND durum = 'bekliyor' AND id != ?",
          )
          .run(now, r.is_id, ogeId);
      }
    });
    this.denetim.yaz(now, kim, "onay", alan, `fikir ${ogeId} seçildi`);
  }

  /** Bir işin bekleyen fikirleri (yan yana karşılaştırma için). */
  fikirler(isId: number): OgeOzeti[] {
    return (
      this.db
        .prepare("SELECT * FROM oge WHERE is_id = ? AND tur = 'fikir' AND durum NOT IN ('kaldi') ORDER BY id")
        .all(isId) as unknown as OgeSatiri[]
    ).map(ozetle);
  }

  /** Kuyruk doluysa ya da günlük kota aşılacaksa teslim reddedilir. */
  private selDenetle(alan: AlanId, yeni: number, now: number): void {
    const s = this.sinir(alan);
    const bekleyen = Number(
      (
        this.db.prepare("SELECT COUNT(*) AS n FROM oge WHERE alan = ? AND durum = 'bekliyor'").get(alan) as {
          n: number;
        }
      ).n,
    );
    if (bekleyen + yeni > s.bekleyenTavan && yeni > 0)
      throw new IsHatasi(
        429,
        `Kuyruk dolu (${bekleyen}/${s.bekleyenTavan}). Sahip incelemeyi bitirene kadar yeni teslim alınmıyor; bu sırada iş önerisi açabilir ya da alanını inceleyebilirsin.`,
      );
    if (this.bugunTeslim(alan, now) + yeni > s.gunlukKota)
      throw new IsHatasi(429, `Günlük teslim kotası (${s.gunlukKota} öğe) doldu. Yarın yeniden dene.`);
    if (s.haftalikUst !== null && this.bugunTeslim(alan, now, 7) + yeni > s.haftalikUst)
      throw new IsHatasi(429, `Bu alanın haftalık üretim sınırı (${s.haftalikUst} öğe) doldu.`);
  }

  // ---- Kademeli güven (UM-F4) -----------------------------------------------------------------------------

  guvenAcik(alan: AlanId, tur: TeslimTuru): boolean {
    return this.ayar(`guven:${alan}:${tur}`) === "1" && !aslaOtomatik(alan, tur);
  }

  guvenIstatistigi(alan: AlanId): { oran: number | null; karar: number; uygun: boolean } {
    const r = this.db
      .prepare(
        "SELECT durum FROM oge WHERE alan = ? AND karar IS NOT NULL AND otomatik = 0 ORDER BY karar DESC LIMIT ?",
      )
      .all(alan, GUVEN_PENCERE) as { durum: string }[];
    const onay = r.filter((x) => ["havuzda", "pakette", "oyuna_eklendi", "canlida"].includes(x.durum)).length;
    const oran = r.length ? onay / r.length : null;
    return { oran, karar: r.length, uygun: r.length >= GUVEN_PENCERE && (oran ?? 0) >= GUVEN_ORAN };
  }

  guvenYaz(alan: AlanId, tur: TeslimTuru, acik: boolean, kim: string, now: number): void {
    if (acik) {
      const engel = aslaOtomatik(alan, tur);
      if (engel) throw new IsHatasi(400, engel.neden);
      if (!this.guvenIstatistigi(alan).uygun)
        throw new IsHatasi(409, "Otomatik onay için son 50 kararda en az %90 onay gerekir.");
    }
    this.ayarYaz(`guven:${alan}:${tur}`, acik ? "1" : "0");
    this.denetim.yaz(now, kim, "ayar", alan, `otomatik onay ${tur}: ${acik ? "açık" : "kapalı"}`);
  }

  /** Koşullar tutarsa öğeyi otomatik onaylar; her 10'uncuyu denetime işaretler. */
  private otomatikOnayla(id: number, alan: AlanId, tur: TeslimTuru, now: number): boolean {
    if (!this.guvenAcik(alan, tur) || !this.guvenIstatistigi(alan).uygun) return false;
    const sayi =
      Number(
        (
          this.db.prepare("SELECT COUNT(*) AS n FROM oge WHERE alan = ? AND otomatik = 1").get(alan) as {
            n: number;
          }
        ).n,
      ) + 1;
    this.db
      .prepare(
        "UPDATE oge SET durum = 'havuzda', karar = ?, otomatik = 1, onaylayan = 'otomatik', denetim = ?, guncelleme = ? WHERE id = ?",
      )
      .run(now, sayi % DENETIM_ARALIGI === 0 ? 1 : 0, now, id);
    return true;
  }

  /** Denetim kararı: uygunsa kapanır; değilse öğe reddedilir ve alanın otomatik onayı kapanır. */
  denetimKarar(id: number, uygun: boolean, not: string, kim: string, now: number): void {
    const r = this.ogeSatiri(id);
    if (r?.denetim !== 1) throw new IsHatasi(404, "Denetim bulunamadı.");
    const alan = r.alan as AlanId;
    islem(this.db, () => {
      if (uygun) this.db.prepare("UPDATE oge SET denetim = 2 WHERE id = ?").run(id);
      else {
        if (r.durum !== "havuzda") throw new IsHatasi(409, "Öğe artık havuzda değil; elle geri çekilmeli.");
        this.db
          .prepare("UPDATE oge SET denetim = 2, durum = 'reddedildi', guncelleme = ? WHERE id = ?")
          .run(now, id);
        this.notEkle(alan, id, "ret", null, not || "Denetimde uygun bulunmadı.", now);
        this.zevkEkle(alan, id, r.ad, "ret", not, now);
        this.db.prepare("UPDATE ayar SET deger = '0' WHERE anahtar LIKE ?").run(`guven:${alan}:%`);
      }
    });
    this.denetim.yaz(
      now,
      kim,
      uygun ? "onay" : "ret",
      alan,
      `denetim öğe ${id}${uygun ? "" : " — otomatik onay kapandı"}`,
    );
  }

  // ---- Seçenek turu (UM-F2) -------------------------------------------------------------------------------

  varyantlar(isId: number): OgeOzeti[] {
    return (
      this.db
        .prepare("SELECT * FROM oge WHERE varyant_is = ? AND durum != 'kaldi' ORDER BY id")
        .all(isId) as unknown as OgeSatiri[]
    ).map(ozetle);
  }

  /** Sahip bir varyantı seçer; karışım isterse seçilen düzeltmeye döner. Seçilmeyenler gerekçesiz arşive. */
  varyantSec(isId: number, ogeId: number, karisim: string, kim: string, now: number): void {
    const v = this.varyantlar(isId);
    const secilen = v.find((x) => x.id === ogeId);
    if (secilen?.durum !== "bekliyor") throw new IsHatasi(404, "Seçilecek varyant bulunamadı.");
    if (karisim.trim())
      this.karar(
        ogeId,
        "duzeltme",
        { hazir: null, metin: `Bu varyantı al; ${karisim.trim()}`, satirlar: null },
        kim,
        now,
      );
    else this.karar(ogeId, "onay", { hazir: null, metin: "", satirlar: null }, kim, now);
    islem(this.db, () => {
      for (const x of v) if (x.id !== ogeId && x.durum === "bekliyor") this.durumYaz(x.id, "arsiv", now);
      if (!karisim.trim())
        this.db.prepare("UPDATE isler SET durum = 'tamam' WHERE id = ? AND durum = 'acik'").run(isId);
    });
  }

  // ---- Zevk profili (UM-F3) -------------------------------------------------------------------------------

  private zevkEkle(
    alan: AlanId,
    ogeId: number,
    ad: string,
    tur: "onay" | "ret",
    not: string,
    now: number,
  ): void {
    this.db
      .prepare(
        "INSERT INTO zevk (alan, oge_id, tur, ad, not_metni, olusturma) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(oge_id) DO UPDATE SET tur = excluded.tur, not_metni = excluded.not_metni",
      )
      .run(alan, ogeId, tur, ad, not, now);
  }

  zevkGalerisi(alan: AlanId): ZevkOrnegi[] {
    const r = this.db
      .prepare("SELECT * FROM zevk WHERE alan = ? AND cikarildi = 0 ORDER BY onemli DESC, id DESC LIMIT 200")
      .all(alan) as {
      id: number;
      oge_id: number;
      tur: "onay" | "ret";
      ad: string;
      not_metni: string;
      onemli: number;
      olusturma: number;
    }[];
    return r.map((z) => {
      const o = this.ogeSatiri(z.oge_id);
      const g = o ? json<OgeDosyasi[]>(o.dosyalar, []).find((d) => d.tur === "png") : undefined;
      return {
        id: z.id,
        ogeId: z.oge_id,
        tur: z.tur,
        ad: z.ad,
        not: z.not_metni,
        onemli: z.onemli === 1,
        olusturma: z.olusturma,
        kucuk: g ? { tur: "gorsel", ogeId: z.oge_id, ozet: g.ozet } : null,
      };
    });
  }

  zevkDuzenle(id: number, v: { onemli?: boolean; cikar?: boolean }, kim: string, now: number): void {
    const r = this.db.prepare("SELECT alan FROM zevk WHERE id = ?").get(id) as { alan: string } | undefined;
    if (!r) throw new IsHatasi(404, "Örnek bulunamadı.");
    if (v.onemli !== undefined)
      this.db.prepare("UPDATE zevk SET onemli = ? WHERE id = ?").run(v.onemli ? 1 : 0, id);
    if (v.cikar) this.db.prepare("UPDATE zevk SET cikarildi = 1 WHERE id = ?").run(id);
    this.denetim.yaz(now, kim, "talimat", r.alan, `zevk örneği ${id}`);
  }

  /** Talimata kendiliğinden eklenen zevk bölümü: özet + en çok 20 temsilî örnek (önemliler önce, onay/ret dengeli). */
  zevkBolumu(alan: AlanId): string {
    const g = this.zevkGalerisi(alan);
    if (!g.length) return "";
    const onay = g.filter((x) => x.tur === "onay");
    const ret = g.filter((x) => x.tur === "ret");
    const sec = (l: ZevkOrnegi[], n: number): ZevkOrnegi[] =>
      [...l.filter((x) => x.onemli), ...l.filter((x) => !x.onemli)].slice(0, n);
    const yarim = Math.min(10, Math.max(20 - Math.min(10, ret.length), 0));
    const ornekler = [...sec(onay, yarim), ...sec(ret, 20 - Math.min(yarim, onay.length))].slice(0, 20);
    const notlar = new Map<string, number>();
    for (const r of ret) if (r.not) notlar.set(r.not, (notlar.get(r.not) ?? 0) + 1);
    const sik = [...notlar.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return [
      "",
      "## Zevk profili (kendiliğinden güncellenir)",
      `Sahip bu alanda ${onay.length} öğeyi onayladı, ${ret.length} öğeyi reddetti.${sik.length ? ` En sık ret nedenleri: ${sik.map(([n, s]) => `“${n}” (${s})`).join(", ")}.` : ""}`,
      "Temsilî örnekler (★ = sahip önemli işaretledi):",
      ...ornekler.map(
        (x) =>
          `- ${x.tur === "onay" ? "Onaylandı" : "Reddedildi"}${x.onemli ? " ★" : ""}: ${x.ad}${x.not ? ` — ${x.not}` : ""}`,
      ),
      "",
    ].join("\n");
  }

  /** Yapay zekânın okuduğu talimat: kayıtlı sürüm + zevk profili. */
  yzTalimati(alan: AlanId, now: number): { surum: number; metin: string } {
    const t = this.talimat(alan, now);
    let metin = t.metin.trimEnd();
    // Görsel kuralı sahibin talimat metninden bağımsız, her zaman başlığın hemen altında.
    if (gorselAlaniMi(alan)) {
      const i = metin.indexOf("\n");
      const bolum = gorselKuraliBolumu(alan);
      metin = i < 0 ? `${metin}\n\n${bolum}` : `${metin.slice(0, i)}\n\n${bolum}${metin.slice(i)}`;
    }
    // Teslim paketi (SSH) ve alanın şimdilik yapamadıkları: sahibin talimat metninden bağımsız, her zaman sonda.
    metin += `\n\n## Teslim paketi\n- ${PAKET_SATIRI}\n- ${PAKET_SINIRLARI}\n- MCP'de aynı biçim: \`paket_bicimi\` aracı; dosyalar önce \`dosya_yukle\` ile, sonra \`dosyaId\`.\n`;
    if (alan === "test") metin += `- **${TEST_SINIRI}**\n`;
    if (oyunAlaniAlaniMi(alan)) metin += `- **${OYUN_ALANI_SATIRI}**\n`;
    metin += `- ${OYUN_ALANI_ARAC_SATIRI}\n`;
    metin += `\n${FIKIR_RAPOR_BOLUMU}`;
    return { surum: t.surum, metin: `${metin}\n${this.zevkBolumu(alan)}` };
  }

  // ---- Köken (UM-F7) --------------------------------------------------------------------------------------

  canlidakiler(alan: AlanId | null): (OgeOzeti & { koken: Koken })[] {
    const r = (alan
      ? this.db
          .prepare(
            "SELECT * FROM oge WHERE durum = 'canlida' AND alan = ? ORDER BY guncelleme DESC LIMIT 200",
          )
          .all(alan)
      : this.db
          .prepare("SELECT * FROM oge WHERE durum = 'canlida' ORDER BY guncelleme DESC LIMIT 200")
          .all()) as unknown as OgeSatiri[];
    return r.map((x) => ({ ...ozetle(x), koken: this.koken(x) }));
  }

  ayar(anahtar: string): string | null {
    return (
      (
        this.db.prepare("SELECT deger FROM ayar WHERE anahtar = ?").get(anahtar) as
          | { deger: string }
          | undefined
      )?.deger ?? null
    );
  }

  ayarYaz(anahtar: string, deger: string): void {
    this.db
      .prepare(
        "INSERT INTO ayar (anahtar, deger) VALUES (?, ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger",
      )
      .run(anahtar, deger);
  }
}
