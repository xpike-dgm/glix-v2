/**
 * Test ve Performans: test2'de bot koşuları ve bütün alanların oyun alanı odaları (Üretim Merkezi 2, aşama 3 ikinci
 * dilim; sözleşme `docs/uretim/SOZLESME.md` bölüm 14; UM-O4, UM-F1).
 *
 * - Koşuyu Test alanının yapay zekâsı (MCP `test_kosusu_baslat`, SSH `test-kosusu-baslat`), sahip (alan sayfası) ya da
 *   dönemli plan (her N saatte, sahip ayarlar) başlatır. Oyun sunucusu (test2) koşuyu yürütür; site durumu izler ve
 *   bitince sonucu rapor panosu biçiminde Test alanına **teslim** olarak yazar (bulgular kendiliğinden).
 * - Aynı anda tek koşu (site ve sunucu ikisi de denetler); iptal edilebilir; süre sınırı sunucudadır.
 * - Oyun alanı odaları: her alanın yapay zekâsı yalnız botlarla bir maç açar, durumunu ve olay kaydını okur, kapatır.
 *   Alan başına en çok `ALAN_ODA_SINIRI` açık oda; yapay zekâ yalnız kendi alanının açtığı odaları görür.
 */
import { GAMES } from "@glix/engine";
import { type Db, json } from "./db.js";
import { kosuOlcumuOku, kosuRaporu } from "./kosuRaporu.js";
import type { Merkez } from "./merkez.js";
import { IsHatasi } from "./merkez.js";
import { type AlanId, alanTanimi } from "./ortak/alanlar.js";
import { OyunHatasi, type OyunIstemcisi } from "./oyun.js";
import { teslimAyristir } from "./teslimGirdisi.js";

export const ALAN_ODA_SINIRI = 2;
/** Plan aralığı seçenekleri (saat). */
export const PLAN_ARALIKLARI = [6, 12, 24] as const;
/** Teslimin aracı: raporlar sayfasında "Bot koşusu" kartı. */
export const KOSU_ARACI = "Bot koşusu";

export type KosuDurumu = "suruyor" | "bitti" | "iptal" | "zaman_asimi" | "hata";

export interface KosuIstegi {
  oyunlar: string[];
  oyuncular: number[];
  mac: number;
  strateji: "oyna" | "rastgele";
  sureDk: number;
}

export interface KosuKaydi {
  id: number;
  oyunId: string;
  istek: KosuIstegi;
  baslatan: string;
  durum: KosuDurumu;
  baslama: number;
  bitis: number | null;
  ogeId: number | null;
  hata: string | null;
  /** Kısa özet: maç, biten, takılan, çöken. */
  ozet: { mac: number; biten: number; takilan: number; coken: number; sureMs: number | null } | null;
}

export interface KosuPlani {
  acik: boolean;
  aralikSaat: number;
  istek: KosuIstegi;
  son: number | null;
}

const kayit = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Koşu isteğini doğrular (site tarafı; sunucu ayrıca denetler). */
export function kosuIstegiOku(v: unknown): KosuIstegi {
  if (!kayit(v)) throw new IsHatasi(400, "Koşu isteği { oyunlar, oyuncular, mac } olmalı.");
  const oyunlar = Array.isArray(v.oyunlar)
    ? [...new Set(v.oyunlar.filter((x): x is string => typeof x === "string" && x.length <= 60))]
    : [];
  if (!oyunlar.length || oyunlar.length > 12) throw new IsHatasi(400, "oyunlar: 1–12 oyun kimliği.");
  const bilinmeyen = oyunlar.filter((o) => !GAMES[o]);
  if (bilinmeyen.length) throw new IsHatasi(400, `Bilinmeyen oyun: ${bilinmeyen.join(", ")}.`);
  const ham = v.oyuncular === undefined ? [] : typeof v.oyuncular === "number" ? [v.oyuncular] : v.oyuncular;
  const oyuncular = Array.isArray(ham)
    ? [...new Set(ham.filter((x): x is number => typeof x === "number" && Number.isInteger(x)))]
    : [];
  if (oyuncular.length > 4 || oyuncular.some((n) => n < 2 || n > 8))
    throw new IsHatasi(400, "oyuncular: en çok 4 değer, 2–8 arası (ör. [3, 5, 8]).");
  const mac = v.mac === undefined ? 1 : v.mac;
  if (typeof mac !== "number" || !Number.isInteger(mac) || mac < 1 || mac > 10)
    throw new IsHatasi(400, "mac: 1–10 (oyun ve oyuncu sayısı başına).");
  const sureDk = v.sureDk === undefined ? 30 : v.sureDk;
  if (typeof sureDk !== "number" || !Number.isInteger(sureDk) || sureDk < 1 || sureDk > 120)
    throw new IsHatasi(400, "sureDk: 1–120.");
  if (v.strateji !== undefined && v.strateji !== "oyna" && v.strateji !== "rastgele")
    throw new IsHatasi(400, 'strateji: "oyna" (insan gibi) ya da "rastgele" (kural zorlayan).');
  const sayisi = oyunlar.length * Math.max(1, oyuncular.length) * mac;
  if (sayisi > 60) throw new IsHatasi(400, `Toplam maç en çok 60 (istenen ${sayisi}).`);
  return { oyunlar, oyuncular, mac, strateji: v.strateji === "rastgele" ? "rastgele" : "oyna", sureDk };
}

const oyunAdi = (id: string): string => GAMES[id]?.name ?? id;

export class Kosular {
  constructor(
    private readonly db: Db,
    private readonly test2: OyunIstemcisi,
    private readonly merkez: Merkez,
    private readonly now: () => number,
  ) {}

  get acik(): boolean {
    return this.test2.acik;
  }

  private kapaliysa(): void {
    if (!this.test2.acik) throw new IsHatasi(503, "Oyun alanı (test2) bağlantısı ayarlı değil.");
  }

  private sar<T>(p: Promise<T>): Promise<T> {
    return p.catch((err: unknown) => {
      throw new IsHatasi(502, err instanceof OyunHatasi ? err.message : "Oyun alanına ulaşılamadı.");
    });
  }

  private satir(r: Record<string, unknown>): KosuKaydi {
    const sonuc = kosuOlcumuOku(json<unknown>(r.sonuc as string | null, null));
    return {
      id: Number(r.id),
      oyunId: String(r.oyun_id),
      istek: json<KosuIstegi>(r.istek as string, {
        oyunlar: [],
        oyuncular: [],
        mac: 1,
        strateji: "oyna",
        sureDk: 30,
      }),
      baslatan: String(r.baslatan),
      durum: r.durum as KosuDurumu,
      baslama: Number(r.baslama),
      bitis: r.bitis === null ? null : Number(r.bitis),
      ogeId: r.oge_id === null ? null : Number(r.oge_id),
      hata: r.hata === null ? null : String(r.hata),
      ozet: sonuc
        ? {
            mac: sonuc.maclar.length,
            biten: sonuc.maclar.filter((m) => m.durum === "bitti").length,
            takilan: sonuc.maclar.filter((m) => m.durum === "takildi").length,
            coken: sonuc.maclar.filter((m) => m.durum === "coktu").length,
            sureMs: sonuc.bitis === null ? null : sonuc.bitis - sonuc.baslama,
          }
        : null,
    };
  }

  liste(sinir = 20): KosuKaydi[] {
    return (
      this.db.prepare("SELECT * FROM kosu ORDER BY id DESC LIMIT ?").all(sinir) as Record<string, unknown>[]
    ).map((r) => this.satir(r));
  }

  kayit(id: number): KosuKaydi | null {
    const r = this.db.prepare("SELECT * FROM kosu WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return r ? this.satir(r) : null;
  }

  /** Teslimi bir bot koşusundan mı (raporlar sayfası kartı için). */
  ogeninKosusu(ogeId: number): KosuKaydi | null {
    const r = this.db.prepare("SELECT * FROM kosu WHERE oge_id = ?").get(ogeId) as
      | Record<string, unknown>
      | undefined;
    return r ? this.satir(r) : null;
  }

  private surenler(): KosuKaydi[] {
    return (
      this.db.prepare("SELECT * FROM kosu WHERE durum = 'suruyor' ORDER BY id").all() as Record<
        string,
        unknown
      >[]
    ).map((r) => this.satir(r));
  }

  /** Koşu başlatır (aynı anda tek koşu). `baslatan`: "sahip:<e-posta>", "yz:test:<anahtar>", "plan". */
  async baslat(ham: unknown, baslatan: string): Promise<KosuKaydi> {
    this.kapaliysa();
    const istek = kosuIstegiOku(ham);
    // Önce süreni güncelle (sunucu tarafında bitmiş olabilir).
    await this.esitle();
    if (this.surenler().length)
      throw new IsHatasi(409, "Bir koşu zaten sürüyor; bitmesini bekle ya da iptal et.");
    const k = await this.sar(this.test2.kosuBaslat({ ...istek }));
    const now = this.now();
    const id = Number(
      this.db
        .prepare("INSERT INTO kosu (oyun_id, istek, baslatan, durum, baslama) VALUES (?, ?, ?, 'suruyor', ?)")
        .run(String(k.id), JSON.stringify(istek), baslatan.slice(0, 120), now).lastInsertRowid,
    );
    this.merkez.denetim.yaz(
      now,
      baslatan,
      "test2",
      "test",
      `koşu ${id} başladı: ${istek.oyunlar.join(", ")}`,
    );
    return this.kayit(id) as KosuKaydi;
  }

  async iptal(id: number, kim: string): Promise<KosuKaydi> {
    this.kapaliysa();
    const k = this.kayit(id);
    if (!k) throw new IsHatasi(404, "Koşu bulunamadı.");
    if (k.durum !== "suruyor") throw new IsHatasi(409, "Koşu zaten bitmiş.");
    try {
      await this.test2.kosuIptal(k.oyunId);
    } catch (err) {
      // Sunucu koşuyu tanımıyorsa (test2 yeniden başladı) yine de kapatılır.
      if (!(err instanceof OyunHatasi)) throw err;
    }
    this.merkez.denetim.yaz(this.now(), kim, "test2", "test", `koşu ${id} iptal`);
    await this.esitle();
    const son = this.kayit(id) as KosuKaydi;
    if (son.durum === "suruyor") {
      this.db.prepare("UPDATE kosu SET durum = 'iptal', bitis = ? WHERE id = ?").run(this.now(), id);
      return this.kayit(id) as KosuKaydi;
    }
    return son;
  }

  /**
   * Süren koşuları izler; biteni rapora çevirip Test alanına teslim eder. Zamanlayıcı (dakikada bir) ve araçlar
   * çağırır. Sunucu koşuyu tanımıyorsa (test2 sıfırlandı/yeniden başladı) koşu "hata" olur.
   */
  async esitle(): Promise<void> {
    if (!this.test2.acik) return;
    for (const k of this.surenler()) {
      let ham: Record<string, unknown>;
      try {
        ham = await this.test2.kosu(k.oyunId);
      } catch (err) {
        if (err instanceof OyunHatasi && /bulunamadı/i.test(err.message)) {
          this.db
            .prepare("UPDATE kosu SET durum = 'hata', bitis = ?, hata = ? WHERE id = ?")
            .run(this.now(), "Oyun alanı koşuyu artık tanımıyor (test2 yeniden başlamış olabilir).", k.id);
        }
        continue;
      }
      const olcum = kosuOlcumuOku(ham);
      if (!olcum || olcum.durum === "suruyor") continue;
      const durum: KosuDurumu =
        olcum.durum === "iptal" || olcum.durum === "zaman_asimi" ? olcum.durum : "bitti";
      let ogeId: number | null = null;
      let hata: string | null = null;
      try {
        ogeId = await this.raporuTeslimEt(k, olcum);
      } catch (err) {
        hata = (err instanceof IsHatasi ? err.message : "Rapor teslim edilemedi.").slice(0, 300);
      }
      this.db
        .prepare("UPDATE kosu SET durum = ?, bitis = ?, sonuc = ?, oge_id = ?, hata = ? WHERE id = ?")
        .run(durum, olcum.bitis ?? this.now(), JSON.stringify(olcum), ogeId, hata, k.id);
    }
  }

  private async raporuTeslimEt(
    k: KosuKaydi,
    olcum: NonNullable<ReturnType<typeof kosuOlcumuOku>>,
  ): Promise<number | null> {
    const rapor = kosuRaporu(olcum, oyunAdi);
    const oyunlar = olcum.istek.oyunlar.map(oyunAdi);
    const ad = `Bot koşusu #${k.id}: ${oyunlar.slice(0, 3).join(", ")}${oyunlar.length > 3 ? ` +${oyunlar.length - 3}` : ""}`;
    const ayr = teslimAyristir(
      {
        tur: "rapor",
        arac: KOSU_ARACI,
        aciklama: `test2 bot koşusu (${k.baslatan}): ${olcum.maclar.length} maç, strateji ${olcum.istek.strateji}.`,
        ogeler: [
          {
            ad: ad.slice(0, 60),
            aciklama:
              `Oyunlar: ${oyunlar.join(", ")}. Oyuncu: ${olcum.istek.oyuncular.join("/") || "oyuna göre"}. Maç: ${olcum.istek.mac}.`.slice(
                0,
                500,
              ),
            gerekce: "Test alanının bot koşusu; sonuç kendiliğinden yazıldı.",
            rapor,
          },
        ],
      },
      alanTanimi("test"),
    );
    if (!ayr.ok) throw new IsHatasi(500, `Rapor biçimi geçersiz: ${ayr.hatalar.slice(0, 3).join(" ")}`);
    const s = await this.merkez.teslimEt("test", "mcp", null, ayr.deger, false, this.now(), "test2:kosu", {
      kanal: "mcp",
      ad: KOSU_ARACI,
    });
    return s.ogeler[0]?.ogeId ?? null;
  }

  // ---- Dönemli plan --------------------------------------------------------------------------------------

  plan(): KosuPlani {
    const p = json<Partial<KosuPlani>>(this.merkez.ayar("kosuPlani"), {});
    return {
      acik: p.acik === true,
      aralikSaat: PLAN_ARALIKLARI.find((x) => x === p.aralikSaat) ?? 12,
      istek: p.istek ?? { oyunlar: [], oyuncular: [], mac: 1, strateji: "oyna", sureDk: 30 },
      son: typeof p.son === "number" ? p.son : null,
    };
  }

  planYaz(ham: unknown, kim: string): KosuPlani {
    if (!kayit(ham)) throw new IsHatasi(400, "Plan { acik, aralikSaat, istek } olmalı.");
    const acik = ham.acik === true;
    const aralik = PLAN_ARALIKLARI.find((x) => x === ham.aralikSaat);
    if (!aralik) throw new IsHatasi(400, `Aralık ${PLAN_ARALIKLARI.join(", ")} saatten biri olmalı.`);
    const istek = acik || ham.istek !== undefined ? kosuIstegiOku(ham.istek) : this.plan().istek;
    const p: KosuPlani = { acik, aralikSaat: aralik, istek, son: this.plan().son };
    this.merkez.ayarYaz("kosuPlani", JSON.stringify(p));
    this.merkez.denetim.yaz(
      this.now(),
      kim,
      "ayar",
      "test",
      `koşu planı ${acik ? `her ${aralik} saatte` : "kapalı"}`,
    );
    return p;
  }

  /** Zamanlayıcı: plan açıksa ve aralık dolduysa (ve süren koşu yoksa) koşuyu başlatır. Başladıysa kaydı döner. */
  async planDenetle(): Promise<KosuKaydi | null> {
    const p = this.plan();
    if (!p.acik || !this.test2.acik) return null;
    const now = this.now();
    if (p.son !== null && now - p.son < p.aralikSaat * 3600_000) return null;
    if (this.surenler().length) return null;
    // Deneme zamanı önce yazılır: test2'ye ulaşılamazsa her dakika yeniden denenmez.
    this.merkez.ayarYaz("kosuPlani", JSON.stringify({ ...p, son: now }));
    try {
      return await this.baslat(p.istek, "plan");
    } catch (err) {
      console.error(
        JSON.stringify({
          seviye: "uyari",
          olay: "kosu_plani",
          hata: err instanceof Error ? err.message : "",
        }),
      );
      return null;
    }
  }

  // ---- Oyun alanı odaları (bütün alanlar) ------------------------------------------------------------------

  private alanOdalari(alan: AlanId): string[] {
    return (
      this.db
        .prepare("SELECT kod FROM oyun_alani_oda WHERE alan = ? AND kapandi IS NULL ORDER BY olusturma")
        .all(alan) as { kod: string }[]
    ).map((r) => r.kod);
  }

  private sahibi(alan: AlanId, kod: unknown): string {
    if (typeof kod !== "string" || !/^[A-Za-z0-9]{3,12}$/.test(kod))
      throw new IsHatasi(400, "kod: oda kodu.");
    const r = this.db.prepare("SELECT alan FROM oyun_alani_oda WHERE kod = ?").get(kod) as
      | { alan: string }
      | undefined;
    if (!r || r.alan !== alan) throw new IsHatasi(404, "Bu oda senin alanının açtığı bir oda değil.");
    return kod;
  }

  async odaAc(alan: AlanId, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.kapaliysa();
    const oyun = typeof args.oyun === "string" ? args.oyun : "";
    if (!GAMES[oyun]) throw new IsHatasi(400, "oyun: oyun kimliği (ör. butona-bas).");
    // Kapanmış odaları ayıkla (sunucu 15 dk sonra kendisi kapatır).
    for (const kod of this.alanOdalari(alan))
      try {
        const d = await this.test2.oda(kod);
        if (d.asama === "kapandi") this.odaKapandi(kod);
      } catch {
        this.odaKapandi(kod);
      }
    if (this.alanOdalari(alan).length >= ALAN_ODA_SINIRI)
      throw new IsHatasi(
        429,
        `Alan başına en çok ${ALAN_ODA_SINIRI} açık oda; önce birini kapat (oyun_alani_kapat).`,
      );
    const bot = args.bot === undefined ? undefined : Number(args.bot);
    const o = await this.sar(
      this.test2.odaAc({
        oyun,
        ...(bot !== undefined ? { bot } : {}),
        ...(args.strateji === "rastgele" ? { strateji: "rastgele" } : {}),
      }),
    );
    this.db
      .prepare(
        "INSERT OR REPLACE INTO oyun_alani_oda (kod, alan, oyun, olusturma, kapandi) VALUES (?, ?, ?, ?, NULL)",
      )
      .run(String(o.kod), alan, oyun, this.now());
    return o;
  }

  async odaDurum(
    alan: AlanId,
    args: Record<string, unknown>,
    olaySayisi: number,
  ): Promise<Record<string, unknown>> {
    this.kapaliysa();
    const kod = this.sahibi(alan, args.kod);
    const o = await this.sar(this.test2.oda(kod));
    const olaylar = Array.isArray(o.olaylar) ? o.olaylar.slice(-olaySayisi) : [];
    return { ...o, olaylar };
  }

  async odaKapat(alan: AlanId, args: Record<string, unknown>): Promise<{ ok: true }> {
    this.kapaliysa();
    const kod = this.sahibi(alan, args.kod);
    try {
      await this.test2.odaKapat(kod);
    } catch (err) {
      if (!(err instanceof OyunHatasi)) throw err;
    }
    this.odaKapandi(kod);
    return { ok: true };
  }

  private odaKapandi(kod: string): void {
    this.db.prepare("UPDATE oyun_alani_oda SET kapandi = ? WHERE kod = ?").run(this.now(), kod);
  }
}
