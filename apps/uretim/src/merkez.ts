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
import { ALAN_IDLERI, type AlanId, alanTanimi, isAlanId, talimatTaslagi } from "./ortak/alanlar.js";
import {
  type Durum,
  gecisOlur,
  type HazirNotKodu,
  hazirNotMetni,
  TALIMAT_ONERI_ESIGI,
} from "./ortak/durum.js";
import type {
  AktarimKaydi,
  AlanKarti,
  AlanSayfasi,
  Degisiklik,
  Gorunum,
  IsKaydi,
  IstekKarti,
  KodIstegi,
  KontrolRaporu,
  NotKaydi,
  OgeAyrinti,
  OgeDosyasi,
  OgeOzeti,
  Pano,
  TeslimTuru,
  Uyari,
} from "./ortak/tipler.js";
import { OyunHatasi, type OyunIstemcisi, SATIR_SINIRI } from "./oyun.js";
import { type OgeGirdisi, ogeAnahtari, type TeslimGirdisi } from "./teslimGirdisi.js";

const GUN = 24 * 3600 * 1000;
export const GERI_AL_MS = 10_000;

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
}

interface OgeSatiri {
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
  };
}

/** Öğenin inceleme görünümü (UM-U3). */
export function gorunumBul(
  alan: AlanId,
  tur: TeslimTuru,
  oge: OgeGirdisi,
  dosyalar: readonly { tur: string; hedefYol: string | null; ad: string }[],
): Gorunum {
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
      d = await dosyaIsle(veri, adHam);
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
  ): Promise<TeslimSonucu> {
    if (g.isId !== null) {
      const is = this.db.prepare("SELECT alan, durum FROM isler WHERE id = ?").get(g.isId) as
        | { alan: string; durum: string }
        | undefined;
      if (!is || is.alan !== alan) throw new IsHatasi(404, "Bu iş bulunamadı.");
      if (is.durum !== "acik") throw new IsHatasi(409, "Bu iş açık değil.");
    }
    const t = alanTanimi(alan);
    const alandaki = this.alandakiAdlar(alan);
    const sonuclar: { girdi: OgeGirdisi; dosyalar: OgeDosyasi[]; rapor: KontrolRaporu }[] = [];
    const adlar = g.ogeler.map((o) => ogeAnahtari(o.ad));
    for (const [i, o] of g.ogeler.entries()) {
      const ek: KontrolRaporu["satirlar"] = [];
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

    const out = islem(this.db, () => {
      const teslimId = Number(
        this.db
          .prepare(
            "INSERT INTO teslim (alan, is_id, tur, kaynak, anahtar_id, aciklama, olusturma) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(alan, g.isId, g.tur, kaynak, anahtarId, g.aciklama, now).lastInsertRowid,
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
             dosyalar, satirlar, degisiklikler, kaldirilacaklar, onizleme, rapor, kontrol, sonuc, olusturma, guncelleme)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          if (is?.istek_id)
            this.db.prepare("UPDATE istek_karti SET sonuc_oge = ? WHERE id = ?").run(ogeId, is.istek_id);
        }
        ogeler.push({ ad: s.girdi.ad, ogeId, durum: son, sonuc: s.rapor.sonuc, satirlar: s.rapor.satirlar });
      }
      return { teslimId, ogeler };
    });
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
      onizleme: json<OgeAyrinti["onizleme"]>(r.onizleme, null),
      rapor: json<unknown>(r.rapor, null),
      kontrol: json<KontrolRaporu>(r.kontrol, { sonuc: "gecti", satirlar: [] }),
      onayliSatirlar: json<number[] | null>(r.onayli_satirlar, null),
      notlar,
      surumler,
    };
  }

  /** Öğenin bir dosyası (sahip arayüzü önizlemesi için). */
  ogeDosyasi(ogeId: number, ozet: string): OgeDosyasi | null {
    const r = this.ogeSatiri(ogeId);
    return r ? (json<OgeDosyasi[]>(r.dosyalar, []).find((d) => d.ozet === ozet) ?? null) : null;
  }

  bekleyenler(alan: AlanId | null, kalanlarDahil = false): OgeOzeti[] {
    const durumlar = kalanlarDahil ? "('bekliyor','kaldi')" : "('bekliyor')";
    const r = (alan
      ? this.db
          .prepare(`SELECT * FROM oge WHERE alan = ? AND durum IN ${durumlar} ORDER BY olusturma, id`)
          .all(alan)
      : this.db
          .prepare(`SELECT * FROM oge WHERE durum IN ${durumlar} ORDER BY olusturma, id`)
          .all()) as unknown as OgeSatiri[];
    return r.map(ozetle);
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
    ).map(ozetle);
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
      if (karar === "onay") {
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
        if (metin) notId = this.notEkle(alan, id, "yorum", null, metin, now);
        // Bağlı istek kartı tamamlanır.
        this.db
          .prepare("UPDATE istek_karti SET durum = 'tamam' WHERE sonuc_oge = ? AND durum = 'onaylandi'")
          .run(id);
      } else {
        this.durumYaz(id, karar === "ret" ? "reddedildi" : "duzeltme_istendi", now, { karar: now });
        notId = this.notEkle(alan, id, karar === "ret" ? "ret" : "duzeltme", not.hazir, metin, now);
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
    if (!["havuzda", "reddedildi", "duzeltme_istendi"].includes(r.durum))
      throw new IsHatasi(409, "Bu karar artık geri alınamaz.");
    islem(this.db, () => {
      this.db
        .prepare(
          "UPDATE oge SET durum = ?, karar = NULL, onayli_satirlar = NULL, guncelleme = ? WHERE id = ?",
        )
        .run(k.eski, now, id);
      if (k.notId !== null) this.db.prepare("DELETE FROM notlar WHERE id = ?").run(k.notId);
    });
    this.sonKararlar.delete(id);
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
    };
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
  ): IsKaydi {
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
          "INSERT INTO isler (alan, baslik, aciklama, adet, son_tarih, ornek, kaynak, durum, sira, olusturma, istek_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(alan, v.baslik, v.aciklama, v.adet, v.sonTarih, v.ornek, kaynak, durum, sira, now, istekId)
        .lastInsertRowid,
    );
    this.denetim.yaz(now, kim, "is", alan, `iş ${id} açıldı`);
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

  pano(now: number, kota: { kullanilan: number; sinir: number }): Pano {
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
      havuz: { toplam: tekTik.length, tekTik: tt, paketlenecek: tekTik.length - tt },
      geriDonen24s: this.geriDonenSay(now - GUN),
      kota,
    };
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
      anahtarlar: this.anahtarlar.liste(alan).map(({ kanal: _k, ...r }) => r),
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
    };
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
