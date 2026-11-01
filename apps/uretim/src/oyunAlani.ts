/**
 * Oyun alanı (test2.glix) eşitlemesi (sözleşme `docs/uretim/SOZLESME.md` bölüm 13; plan Aşama 3 ilk dilim).
 *
 * - İçerik havuzu ve mağaza teslimleri ön kontrolden geçince (durum `bekliyor`) test2'ye kendiliğinden yüklenir:
 *   içerik satırları `POST /api/uretim/havuzlar/:id/ekle` (kapatma önerisi `kapat`), mağaza ürünleri
 *   `POST /api/uretim/magaza/taslak` ile. Sahip test2'de oynayıp bakar.
 * - Ret, arşiv (yeni sürüm geldi) ya da sahibin "test2'den geri al"ı: yüklenen geri alınır (`aktarim/:id/geri-al`,
 *   `DELETE magaza/taslak/:id`).
 * - Kabul edilen öğe kabul havuzunda kalır ve test2'de yüklü kalır; canlıya yalnız yönetici "ekle" ile (paket) ya
 *   da içerikte mevcut "Oyuna aktar" ile gider. Canlı bağlantısı (`URETIM_OYUN_URL`) bu modülde hiç kullanılmaz.
 * - test2 her gece sıfırlanır (UM-O2): sağlık yanıtındaki katman kimliği değişince bekleyen, düzeltmede ve kabulde
 *   olup ana koda girmemiş öğeler yeniden yüklenir ("taslaklar kaybolmaz").
 *
 * Bütün test2 işleri tek sırada yürür (aynı öğe için yarış yok); hata öğenin kaydına yazılır, sonraki eşitlemede
 * yeniden denenir.
 */
import { cosmeticAssetFiles, effectTextures, parseEffectRecipe, parseShopItem } from "@glix/engine";
import { type Db, json } from "./db.js";
import { DUSUK_ALFA } from "./kontrol/gorsel.js";
import { ffmpegVar, webpYaz } from "./medya.js";
import { type AlanId, alanTanimi, isAlanId } from "./ortak/alanlar.js";
import type { Durum } from "./ortak/durum.js";
import type { Test2Bilgisi, Test2Durum, Test2Durumu } from "./ortak/oyunAlani.js";
import type { OgeAyrinti, OgeDosyasi } from "./ortak/tipler.js";
import { OyunHatasi, type OyunIstemcisi } from "./oyun.js";
import { pngAc } from "./png.js";

/** Bu durumdaki öğe test2'de yüklü olmalı (sıfırlamadan sonra yeniden yüklenir). */
export const YUKLU_DURUMLAR: ReadonlySet<Durum> = new Set<Durum>([
  "bekliyor",
  "duzeltme_istendi",
  "onaylandi",
  "havuzda",
  "pakette",
]);
/** Bu duruma geçen öğe test2'den geri alınır. */
export const GERI_ALINAN_DURUMLAR: ReadonlySet<Durum> = new Set<Durum>(["reddedildi", "arsiv", "kaldi"]);
/** Bir eşitleme turunda en çok yüklenen öğe (oyunun dakikada 30 yazma sınırının altında). */
export const ESITLEME_TURU = 12;

const SHOP_ONEKI = "apps/client/public/assets/shop/";

type Tur = "havuz" | "magaza";

interface Aktarim {
  havuz: string;
  aktarimId: string;
}

interface Kayit {
  oge_id: number;
  tur: Tur;
  durum: Test2Durumu;
  katman: string | null;
  aktarimlar: string;
  taslaklar: string;
  ozet: string;
  hata: string | null;
  /** Sahip elle geri aldı: kendiliğinden yeniden yüklenmez (yalnız "yeniden yükle" ile). */
  elle: number;
  guncelleme: number;
}

/** Merkez'in test2'ye bağlandığı arayüz (Merkez bu modülü tanımaz; yalnız bunu çağırır). */
export interface OyunAlaniBagi {
  durumDegisti(ogeId: number, durum: Durum): void;
  bilgi(ogeId: number, alan: AlanId): Test2Bilgisi | null;
  durum(): Test2Durum;
}

const kayit = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export class OyunAlani implements OyunAlaniBagi {
  private sira: Promise<void> = Promise.resolve();

  constructor(
    private readonly db: Db,
    private readonly test2: OyunIstemcisi,
    /** Öğeyi okur (Merkez.oge). */
    private readonly ogeOku: (id: number) => OgeAyrinti | null,
    private readonly publicUrl: string,
    private readonly now: () => number,
  ) {}

  get acik(): boolean {
    return this.test2.acik;
  }

  /** test2'ye gidecek öğe mi, hangi yolla. */
  turu(o: { alan: AlanId; tur: string; dosyalar: unknown[]; satirlar: unknown[] }): Tur | null {
    if (o.tur === "fikir" || o.tur === "rapor") return null;
    if (o.alan === "icerik" && alanTanimi(o.alan).tekTik && o.satirlar.length > 0 && o.dosyalar.length === 0)
      return "havuz";
    if (
      o.alan === "magaza" &&
      o.tur === "yeni" &&
      o.satirlar.some((s) => kayit(s) && typeof s.id === "string")
    )
      return "magaza";
    return null;
  }

  baglanti(alan: AlanId): string {
    return alan === "magaza" ? `${this.publicUrl}/?ekran=magaza` : `${this.publicUrl}/`;
  }

  private kayitOku(ogeId: number): Kayit | null {
    return (
      (this.db.prepare("SELECT * FROM oyun_alani WHERE oge_id = ?").get(ogeId) as unknown as
        | Kayit
        | undefined) ?? null
    );
  }

  private kayitYaz(k: Omit<Kayit, "guncelleme" | "elle"> & { elle?: number }): void {
    this.db
      .prepare(
        `INSERT INTO oyun_alani (oge_id, tur, durum, katman, aktarimlar, taslaklar, ozet, hata, elle, guncelleme)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(oge_id) DO UPDATE SET tur = excluded.tur, durum = excluded.durum, katman = excluded.katman,
           aktarimlar = excluded.aktarimlar, taslaklar = excluded.taslaklar, ozet = excluded.ozet,
           hata = excluded.hata, elle = excluded.elle, guncelleme = excluded.guncelleme`,
      )
      .run(
        k.oge_id,
        k.tur,
        k.durum,
        k.katman,
        k.aktarimlar,
        k.taslaklar,
        k.ozet,
        k.hata,
        k.elle ?? 0,
        this.now(),
      );
    this.degisti(k.tur === "magaza" ? "magaza" : "icerik");
  }

  /** Bir öğenin test2 kaydı değişti (canlı güncelleme; sunucu kurulurken bağlanır). */
  degisti: (alan: AlanId) => void = () => undefined;

  private ayar(anahtar: string): string | null {
    return (
      (
        this.db.prepare("SELECT deger FROM ayar WHERE anahtar = ?").get(anahtar) as
          | { deger: string }
          | undefined
      )?.deger ?? null
    );
  }

  private ayarYaz(anahtar: string, deger: string): void {
    this.db
      .prepare(
        "INSERT INTO ayar (anahtar, deger) VALUES (?, ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger",
      )
      .run(anahtar, deger);
  }

  /** İşi sıraya koyar; hata sırayı bozmaz. */
  private sirala(f: () => Promise<void>): Promise<void> {
    const p = this.sira.then(f).catch((err: unknown) => {
      console.error(JSON.stringify({ seviye: "hata", olay: "oyun_alani", hata: String(err).slice(0, 300) }));
    });
    this.sira = p;
    return p;
  }

  /** Sıradaki bütün işler bitene dek bekler (testler ve kapanış). */
  bosalt(): Promise<void> {
    return this.sira;
  }

  // ---- Merkez'den gelen olaylar --------------------------------------------------------------------------

  durumDegisti(ogeId: number, durum: Durum): void {
    if (!this.acik) return;
    if (YUKLU_DURUMLAR.has(durum)) void this.sirala(() => this.yukleGerekirse(ogeId));
    else if (GERI_ALINAN_DURUMLAR.has(durum)) void this.sirala(() => this.geriAlIc(ogeId, false));
  }

  /** Sahibin "test2'den geri al"ı (öğenin durumu değişmez; yeniden yükle ile geri gelir). */
  geriAl(ogeId: number): Promise<void> {
    return this.sirala(() => this.geriAlIc(ogeId, true));
  }

  /** Sahibin "test2'ye yeniden yükle"si. */
  yenidenYukle(ogeId: number): Promise<void> {
    return this.sirala(() => this.yukleIc(ogeId));
  }

  // ---- Durum ---------------------------------------------------------------------------------------------

  bilgi(ogeId: number, alan: AlanId): Test2Bilgisi | null {
    const k = this.kayitOku(ogeId);
    if (!k) {
      if (!this.acik || (alan !== "icerik" && alan !== "magaza")) return null;
      // Ham satırdan (Merkez.oge'yi çağırmadan: o da bu işlevi çağırır).
      const r = this.db.prepare("SELECT tur, durum, dosyalar, satirlar FROM oge WHERE id = ?").get(ogeId) as
        | { tur: string; durum: Durum; dosyalar: string; satirlar: string }
        | undefined;
      if (
        !r ||
        !YUKLU_DURUMLAR.has(r.durum) ||
        !this.turu({
          alan,
          tur: r.tur,
          dosyalar: json<unknown[]>(r.dosyalar, []),
          satirlar: json<unknown[]>(r.satirlar, []),
        })
      )
        return null;
      return { durum: "bekliyor", ozet: "", hata: null, zaman: null, baglanti: this.baglanti(alan) };
    }
    const guncel = this.ayar("oyunAlani.katman");
    // Kayıt eski katmandaysa (test2 sıfırlandı, yeniden yükleme bekliyor) yüklü sayılmaz.
    const durum: Test2Durumu =
      k.durum === "yuklu" && guncel !== null && k.katman !== guncel ? "bekliyor" : k.durum;
    return { durum, ozet: k.ozet, hata: k.hata, zaman: k.guncelleme, baglanti: this.baglanti(alan) };
  }

  durum(): Test2Durum {
    const sayi = (d: string): number =>
      Number(
        (this.db.prepare("SELECT COUNT(*) AS n FROM oyun_alani WHERE durum = ?").get(d) as { n: number }).n,
      );
    const son = json<{
      calisiyor?: boolean;
      revision?: string | null;
      taslak?: number;
      zaman?: number;
      sorun?: string | null;
    }>(this.ayar("oyunAlani.son"), {});
    const sifirlama = Number(this.ayar("oyunAlani.sonSifirlama"));
    return {
      ayarli: this.acik,
      calisiyor: this.acik && son.calisiyor === true,
      revision: typeof son.revision === "string" ? son.revision : null,
      katman: this.ayar("oyunAlani.katman"),
      sonDenetim: typeof son.zaman === "number" ? son.zaman : null,
      sonSifirlama: Number.isFinite(sifirlama) && sifirlama > 0 ? sifirlama : null,
      taslak: typeof son.taslak === "number" ? son.taslak : 0,
      yuklu: sayi("yuklu"),
      hata: sayi("hata"),
      baglanti: `${this.publicUrl}/`,
      sorun: typeof son.sorun === "string" ? son.sorun : null,
    };
  }

  // ---- Eşitleme ------------------------------------------------------------------------------------------

  /**
   * Sağlığı ve katman kimliğini denetler; kimlik değiştiyse (gece sıfırlaması) son sıfırlamayı yazar. Sonra yüklü
   * olması gerekip yüklü olmayan (hiç yüklenmemiş, hata almış ya da eski katmanda kalmış) öğeleri yükler.
   */
  esitle(): Promise<void> {
    return this.sirala(async () => {
      if (!this.acik) return;
      const katman = await this.katmaniDenetle();
      if (katman === null) return;
      const adaylar = (
        this.db
          .prepare(
            `SELECT o.id, o.alan, o.tur, o.dosyalar, o.satirlar, a.durum AS t2, a.katman AS t2k, a.elle AS elle FROM oge o
             LEFT JOIN oyun_alani a ON a.oge_id = o.id
             WHERE o.alan IN ('icerik','magaza') AND o.durum IN ('bekliyor','duzeltme_istendi','onaylandi','havuzda','pakette')
             ORDER BY o.id`,
          )
          .all() as {
          id: number;
          alan: string;
          tur: string;
          dosyalar: string;
          satirlar: string;
          t2: string | null;
          t2k: string | null;
          elle: number | null;
        }[]
      ).filter(
        (r) =>
          isAlanId(r.alan) &&
          this.turu({
            alan: r.alan,
            tur: r.tur,
            dosyalar: json<unknown[]>(r.dosyalar, []),
            satirlar: json<unknown[]>(r.satirlar, []),
          }) !== null &&
          // Sahip elle geri aldıysa kendiliğinden yeniden yüklenmez.
          r.elle !== 1 &&
          (r.t2 === null || r.t2 === "hata" || r.t2k !== katman),
      );
      for (const r of adaylar.slice(0, ESITLEME_TURU)) await this.yukleIc(r.id, katman);
    });
  }

  /** Katman kimliği; ulaşılamazsa null (durum kaydına yazılır). */
  private async katmaniDenetle(): Promise<string | null> {
    const zaman = this.now();
    try {
      const s = await this.test2.saglik();
      if (!s.katman)
        throw new OyunHatasi("Oyun alanı taslak katmanını bildirmiyor (GLIX_ORTAM=test2 değil mi?).");
      const onceki = this.ayar("oyunAlani.katman");
      if (onceki !== s.katman) {
        if (onceki !== null) this.ayarYaz("oyunAlani.sonSifirlama", String(zaman));
        this.ayarYaz("oyunAlani.katman", s.katman);
      }
      this.ayarYaz(
        "oyunAlani.son",
        JSON.stringify({ calisiyor: s.ok, revision: s.revision, taslak: s.taslak, zaman, sorun: null }),
      );
      return s.katman;
    } catch (err) {
      const sorun = err instanceof OyunHatasi ? err.message : "Oyun alanına ulaşılamadı.";
      const son = json<Record<string, unknown>>(this.ayar("oyunAlani.son"), {});
      this.ayarYaz("oyunAlani.son", JSON.stringify({ ...son, calisiyor: false, zaman, sorun }));
      return null;
    }
  }

  private async yukleGerekirse(ogeId: number): Promise<void> {
    const k = this.kayitOku(ogeId);
    const guncel = this.ayar("oyunAlani.katman");
    if (k && (k.elle === 1 || (k.durum === "yuklu" && k.katman === guncel))) return;
    await this.yukleIc(ogeId);
  }

  private async yukleIc(ogeId: number, bilinenKatman?: string): Promise<void> {
    const o = this.ogeOku(ogeId);
    if (!o) return;
    const tur = this.turu(o);
    if (!tur || !YUKLU_DURUMLAR.has(o.durum)) return;
    const katman = bilinenKatman ?? (await this.katmaniDenetle());
    if (katman === null) {
      this.kayitYaz({
        oge_id: ogeId,
        tur,
        durum: "hata",
        katman: null,
        aktarimlar: "[]",
        taslaklar: "[]",
        ozet: "",
        hata: "Oyun alanına ulaşılamadı; sonraki eşitlemede yeniden denenecek.",
      });
      return;
    }
    // Aynı katmanda önceki yükleme varsa önce geri alınır (yeniden yüklemede satırlar çiftlenmesin).
    const onceki = this.kayitOku(ogeId);
    if (onceki?.durum === "yuklu" && onceki.katman === katman) await this.uzaktanGeriAl(onceki);
    try {
      if (tur === "havuz") {
        const aktarimlar = await this.havuzYukle(o);
        const eklenen = aktarimlar.reduce((t, a) => t + a.n, 0);
        this.kayitYaz({
          oge_id: ogeId,
          tur,
          durum: "yuklu",
          katman,
          aktarimlar: JSON.stringify(aktarimlar.map((a) => ({ havuz: a.havuz, aktarimId: a.aktarimId }))),
          taslaklar: "[]",
          ozet:
            o.tur === "kaldirma-onerisi"
              ? `${eklenen} kayıt test2'de kapatıldı`
              : `${eklenen} satır test2'ye yüklendi${aktarimlar.some((a) => a.atlanan) ? `, ${aktarimlar.reduce((t, a) => t + a.atlanan, 0)} atlandı` : ""}`,
          hata: null,
        });
      } else {
        const idler = await this.magazaYukle(o);
        this.kayitYaz({
          oge_id: ogeId,
          tur,
          durum: "yuklu",
          katman,
          aktarimlar: "[]",
          taslaklar: JSON.stringify(idler),
          ozet: `${idler.length} ürün test2 mağazasında (TASLAK)`,
          hata: null,
        });
      }
    } catch (err) {
      this.kayitYaz({
        oge_id: ogeId,
        tur,
        durum: "hata",
        katman,
        aktarimlar: "[]",
        taslaklar: "[]",
        ozet: "",
        hata: (err instanceof OyunHatasi ? err.message : "Oyun alanına yüklenemedi.").slice(0, 600),
      });
    }
  }

  private async havuzYukle(
    o: OgeAyrinti,
  ): Promise<{ havuz: string; aktarimId: string; n: number; atlanan: number }[]> {
    const gruplar = new Map<string, unknown[]>();
    for (const s of o.satirlar) {
      const h = kayit(s) && typeof s.havuz === "string" ? s.havuz : "";
      if (h) gruplar.set(h, [...(gruplar.get(h) ?? []), s]);
    }
    const out: { havuz: string; aktarimId: string; n: number; atlanan: number }[] = [];
    for (const [havuz, satirlar] of gruplar) {
      if (o.tur === "kaldirma-onerisi") {
        const r = await this.test2.havuzKapat(
          havuz,
          satirlar.map((s) => String((s as { anahtar?: unknown }).anahtar ?? "")),
        );
        out.push({ havuz, aktarimId: r.aktarimId, n: r.kapatilan, atlanan: 0 });
      } else {
        const r = await this.test2.havuzEkle(
          havuz,
          satirlar.flatMap((s) => {
            const a = (s as { alanlar?: unknown }).alanlar;
            return kayit(a) && Object.values(a).every((v) => typeof v === "string")
              ? [a as Record<string, string>]
              : [];
          }),
        );
        out.push({ havuz, aktarimId: r.aktarimId, n: r.eklenen, atlanan: r.atlanan.length });
      }
    }
    return out;
  }

  private async magazaYukle(o: OgeAyrinti): Promise<string[]> {
    const idler: string[] = [];
    const donustur = await ffmpegVar();
    for (const satir of o.satirlar) {
      if (!kayit(satir)) continue;
      const urun = parseShopItem(satir);
      if (!urun) throw new OyunHatasi(`Ürün satırı geçersiz (${String(satir.id ?? "")}).`);
      const gereken = new Set(cosmeticAssetFiles(urun));
      if (urun.efekt) {
        const e = parseEffectRecipe(urun.efekt, urun.type);
        if (e) for (const d of effectTextures(e)) gereken.add(d);
      }
      const dosyalar: { yol: string; veri: string }[] = [];
      for (const d of o.dosyalar) {
        const yol = d.hedefYol?.startsWith(SHOP_ONEKI) ? d.hedefYol.slice(SHOP_ONEKI.length) : null;
        if (!yol || !gereken.has(yol)) continue;
        dosyalar.push({ yol, veri: (await this.gorselVerisi(d, donustur)).toString("base64") });
      }
      const r = await this.test2.magazaTaslakYukle(satir, dosyalar);
      idler.push(r.id);
    }
    return idler;
  }

  /** Görsel test2'ye paketteki gibi WebP olarak gider (kalite 82, düşük alfa 0); dönüştürücü yoksa PNG olarak. */
  private async gorselVerisi(d: OgeDosyasi, donustur: boolean): Promise<Buffer> {
    const veri = await this.depoOku(d.ozet);
    if (d.tur !== "png" || !donustur) return veri;
    try {
      const img = pngAc(veri);
      for (let i = 3; i < img.data.length; i += 4) if ((img.data[i] ?? 0) < DUSUK_ALFA) img.data[i] = 0;
      return await webpYaz(img, 82);
    } catch {
      return veri;
    }
  }

  /** Depodan dosya okuyucu (sunucu kurulurken bağlanır). */
  depoOku: (ozet: string) => Promise<Buffer> = () => Promise.reject(new Error("depo bağlı değil"));

  private async geriAlIc(ogeId: number, elle: boolean): Promise<void> {
    const k = this.kayitOku(ogeId);
    if (!k) return;
    if (k.durum !== "yuklu") {
      // Yüklenememiş öğe: elle geri almada yalnız kendiliğinden yeniden denemeyi durdurur.
      if (elle)
        this.kayitYaz({ ...k, durum: "geri_alindi", hata: null, ozet: "test2'den geri alındı", elle: 1 });
      return;
    }
    const guncel = this.ayar("oyunAlani.katman");
    try {
      // Kayıt eski katmandaysa test2 zaten sıfırlandı: uzakta silinecek bir şey yok.
      if (k.katman === guncel) await this.uzaktanGeriAl(k);
      this.kayitYaz({
        ...k,
        durum: "geri_alindi",
        hata: null,
        ozet: "test2'den geri alındı",
        elle: elle ? 1 : 0,
      });
    } catch (err) {
      this.kayitYaz({
        ...k,
        hata: (err instanceof OyunHatasi ? err.message : "test2'den geri alınamadı.").slice(0, 600),
      });
    }
  }

  private async uzaktanGeriAl(k: Kayit): Promise<void> {
    for (const a of json<Aktarim[]>(k.aktarimlar, []))
      try {
        await this.test2.geriAl(a.aktarimId);
      } catch (err) {
        // Zaten geri alınmış ya da bulunamayan aktarım: amaç gerçekleşmiş.
        if (!(err instanceof OyunHatasi && /zaten geri|bulunamadı/.test(err.message))) throw err;
      }
    for (const id of json<string[]>(k.taslaklar, [])) await this.test2.magazaTaslakSil(id);
  }
}
