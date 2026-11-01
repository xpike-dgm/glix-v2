/**
 * Oyun alanı (test2) bot koşuları ve yalnız-bot odaları (Üretim Merkezi 2, aşama 3 ikinci dilim; sözleşme
 * `docs/uretim/SOZLESME.md` bölüm 14). Yalnız `GLIX_ORTAM=test2`'de kurulur ve yalnız `/api/uretim/*` uçlarından
 * (test2'nin kendi anahtarıyla) çalışır; canlıda ve test'te bu modül hiç çalışmaz.
 *
 * - **Yalnız-bot odası** (`room.botOdasi`): insan yoktur. Oda kurulur, botlar girer (ilki host), oyun elle seçilir ve
 *   maç sunucu tarafından başlatılır. Botlar insanla aynı yoldan (`handleMessage`) oynar; sunucu tek otorite kalır.
 *   Oda yönetici oda listesinde görünmez; kodla izleyici olarak girilebilir (sahip izleyebilir).
 * - **Koşu**: oyun × oyuncu sayısı × maç sayısı kadar tek oyunluk maç, sınırlı sayıda paralel odada. Ölçülenler: biten,
 *   takılan ve çöken maçlar, oyun hataları (`abortMatch`), sunucu tick p95 ve bellek (zaman serisi), bot eylemlerinin
 *   işlenme süresi ve reddedilme nedenleri, oyun başına ortalama süre, skor dağılımı.
 * - Sınırlar: aynı anda tek koşu; aynı anda en çok `ODA_SINIRI` yalnız-bot odası ve `BOT_SINIRI` bot (test2'nin 512 MB'ı
 *   içinde); koşu süre sınırı; iptal.
 */
import { randomBytes } from "node:crypto";
import { GAMES, MAX_PLAYERS } from "@glix/engine";
import { addBot, type BotOlcumu, type BotStrateji } from "./bots.js";
import type { Cancel } from "./clock.js";
import { log } from "./log.js";
import { beginMatch } from "./match.js";
import { createRoom, deleteRoom } from "./rooms.js";
import type { Room, Runtime } from "./runtime.js";

/** Aynı anda en çok yalnız-bot odası ve bot (koşu + oyun alanı odaları birlikte). */
export const ODA_SINIRI = 4;
export const BOT_SINIRI = 24;
/** Bir koşuda aynı anda en çok oda. */
export const KOSU_PARALEL = 2;
/** Koşu isteğinin sınırları. */
export const KOSU_EN_COK_OYUN = 12;
export const KOSU_EN_COK_MAC = 10;
export const KOSU_EN_COK_TOPLAM = 60;
export const KOSU_VARSAYILAN_DK = 30;
export const KOSU_EN_COK_DK = 120;
/** Tek maçın süre sınırı: aşılırsa maç "takıldı" sayılır ve oda kapanır. */
export const MAC_SINIRI_MS = 15 * 60_000;
/** Aynı aşamada bu kadar kalan maç "takıldı" sayılır (oyun içi uzun turlar bunun altında). */
export const ASAMA_SINIRI_MS = 8 * 60_000;
/** Gözlem aralığı ve ölçüm örneği aralığı. */
export const GOZLEM_MS = 1_000;
export const ORNEK_MS = 10_000;
/** Bitmiş oyun alanı odası bu süre sonra kendiliğinden kapanır. */
export const ODA_OMRU_MS = 15 * 60_000;
/** Bellekte tutulan son koşu sayısı (site kalıcı kaydı tutar). */
export const KOSU_GECMISI = 10;

export type MacDurumu = "bekliyor" | "oynaniyor" | "bitti" | "takildi" | "coktu" | "iptal";

export interface Olay {
  t: number;
  tur: "asama" | "oyun" | "hata" | "red" | "bilgi";
  metin: string;
}

export interface MacSonucu {
  oyun: string;
  oyuncu: number;
  durum: MacDurumu;
  sureMs: number | null;
  /** Son skorlar (büyükten küçüğe). */
  skorlar: number[];
  /** Takıldıysa hangi aşamada; çöktüyse hata. */
  takildigiAsama?: string;
  hata?: string;
  oda?: string;
}

export interface EylemOlcumu {
  n: number;
  /** ms */
  p50: number;
  p95: number;
  max: number;
  red: Record<string, number>;
}

export type KosuDurumu = "suruyor" | "bitti" | "iptal" | "zaman_asimi";

export interface KosuIstegi {
  oyunlar: string[];
  oyuncular: number[];
  mac: number;
  strateji: BotStrateji;
  sureDk: number;
}

export interface KosuSonucu {
  id: string;
  istek: KosuIstegi;
  durum: KosuDurumu;
  baslama: number;
  bitis: number | null;
  maclar: MacSonucu[];
  /** Zaman serisi örnekleri (koşu başından ms). */
  ornekler: { t: number; tickP95: number; bellekMb: number; oda: number }[];
  eylemler: Record<string, EylemOlcumu>;
  oyunHatalari: { oyun: string; fn: string; mesaj: string }[];
  /** İstekten atlanan birleşimler (ör. oyuncu sayısı oyuna uymuyor). */
  atlananlar: string[];
  tickP95Son: number;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Yalnız-bot odası: kurulum, gözlem ve kapanış. */
export class BotOdasi {
  readonly kod: string;
  durum: MacDurumu = "bekliyor";
  readonly olaylar: Olay[] = [];
  baslama: number;
  bitis: number | null = null;
  skorlar: number[] = [];
  hata: string | null = null;
  takildigiAsama: string | null = null;
  private sonAsama = "";
  private sonOyun = -1;
  private asamaZamani: number;
  private gozlem: Cancel | null = null;
  private redSayisi = 0;

  constructor(
    private readonly rt: Runtime,
    readonly room: Room,
    readonly oyun: string,
    readonly botSayisi: number,
    private readonly bitince: (o: BotOdasi) => void,
  ) {
    this.kod = room.code;
    this.baslama = rt.clock.now();
    this.asamaZamani = this.baslama;
  }

  private olay(tur: Olay["tur"], metin: string): void {
    this.olaylar.push({ t: this.rt.clock.now(), tur, metin: metin.slice(0, 300) });
    if (this.olaylar.length > 300) this.olaylar.splice(0, this.olaylar.length - 300);
  }

  /** Bot eyleminin yanıtı: reddedilen eylemler olay kaydına (ilk birkaçı) düşer. */
  eylem(e: BotOlcumu): void {
    if (e.ack && !e.ack.ok) {
      this.redSayisi += 1;
      if (this.redSayisi <= 5) this.olay("red", `Bot eylemi reddedildi: ${e.ack.reason ?? "bilinmiyor"}`);
    }
  }

  oyunCoktu(fn: string, mesaj: string): void {
    this.hata = `${fn}: ${mesaj}`.slice(0, 300);
    this.olay("hata", `Oyun hata verdi (${fn}): ${mesaj}`);
  }

  /** Maçı başlatır ve gözlemi kurar. */
  baslat(): void {
    this.room.selection = { mode: "manual" };
    this.room.gameIds = [this.oyun];
    beginMatch(this.rt, this.room);
    this.rt.broadcaster.markDirty(this.room);
    this.durum = "oynaniyor";
    this.baslama = this.rt.clock.now();
    this.asamaZamani = this.baslama;
    this.olay("bilgi", `Maç başladı: ${this.oyun}, ${this.botSayisi} bot`);
    this.planla();
  }

  private planla(): void {
    this.gozlem = this.rt.clock.setTimeout(() => {
      this.gozlem = null;
      try {
        this.gozle();
      } catch (err) {
        log.error("bot_odasi_gozlem", { roomCode: this.kod, error: String(err) });
      }
      if (this.durum === "oynaniyor") this.planla();
    }, GOZLEM_MS);
  }

  private gozle(): void {
    const now = this.rt.clock.now();
    const room = this.room;
    if (!this.rt.rooms.has(room.code)) {
      this.bitir("takildi", "oda kapandı");
      return;
    }
    const match = room.match;
    if (room.phase !== this.sonAsama) {
      this.sonAsama = room.phase;
      this.asamaZamani = now;
      this.olay("asama", `Aşama: ${room.phase}`);
    }
    if (match && match.index !== this.sonOyun) {
      this.sonOyun = match.index;
      this.olay("oyun", `Oyun ${match.index + 1}: ${match.games[match.index]?.id ?? "?"}`);
    }
    if (room.phase === "final") {
      this.skorlar = [...room.players.values()].map((p) => p.score).sort((a, b) => b - a);
      this.bitir("bitti");
      return;
    }
    // Oyun çöktü: abortMatch maçı temizler, oda lobiye döner.
    if (!match && room.phase === "lobby") {
      this.bitir("coktu", this.hata ?? "maç yarıda kaldı");
      return;
    }
    if (now - this.baslama > MAC_SINIRI_MS) {
      this.bitir("takildi", `maç ${MAC_SINIRI_MS / 60_000} dk'yı aştı`);
      return;
    }
    if (now - this.asamaZamani > ASAMA_SINIRI_MS) {
      this.bitir("takildi", `"${room.phase}" aşamasında ${ASAMA_SINIRI_MS / 60_000} dk ilerleme yok`);
      return;
    }
  }

  private bitir(durum: MacDurumu, neden?: string): void {
    if (this.durum !== "oynaniyor" && this.durum !== "bekliyor") return;
    this.durum = durum;
    this.bitis = this.rt.clock.now();
    if (durum === "takildi") this.takildigiAsama = this.room.phase;
    if (neden && durum !== "bitti") {
      if (!this.hata) this.hata = neden;
      this.olay(durum === "coktu" ? "hata" : "bilgi", neden);
    }
    this.olay(
      "bilgi",
      `Maç ${durum === "bitti" ? "bitti" : durum === "iptal" ? "iptal edildi" : durum === "coktu" ? "çöktü" : "takıldı"}`,
    );
    if (this.gozlem) this.gozlem();
    this.gozlem = null;
    this.bitince(this);
  }

  /** İptal (koşu iptali ya da oda kapatma). */
  iptal(): void {
    this.bitir("iptal", "iptal edildi");
  }

  /** Odayı kapatır (botlar durur, gözlem biter). */
  kapat(): void {
    if (this.gozlem) this.gozlem();
    this.gozlem = null;
    this.rt.botOdalari?.delete(this.kod);
    if (this.rt.rooms.get(this.kod) === this.room) deleteRoom(this.rt, this.room);
  }

  sonuc(): MacSonucu {
    return {
      oyun: this.oyun,
      oyuncu: this.botSayisi,
      durum: this.durum,
      sureMs: this.bitis === null ? null : this.bitis - this.baslama,
      skorlar: this.skorlar,
      ...(this.takildigiAsama ? { takildigiAsama: this.takildigiAsama } : {}),
      ...(this.hata && this.durum !== "bitti" ? { hata: this.hata } : {}),
      oda: this.kod,
    };
  }

  /** Oyun alanı aracı için durum: aşama, oyuncular, skorlar, son olaylar. */
  ozet(olaySayisi = 30): Record<string, unknown> {
    const room = this.room;
    return {
      kod: this.kod,
      oyun: this.oyun,
      durum: this.durum,
      asama: this.rt.rooms.has(this.kod) ? room.phase : "kapandi",
      oyuncular: [...room.players.values()].map((p) => ({ ad: p.nickname, skor: p.score })),
      baslama: this.baslama,
      sureMs: (this.bitis ?? this.rt.clock.now()) - this.baslama,
      hata: this.hata,
      olaylar: this.olaylar.slice(-olaySayisi),
    };
  }
}

function yuzdelik(sirali: number[], p: number): number {
  if (!sirali.length) return 0;
  const i = Math.min(sirali.length - 1, Math.max(0, Math.ceil((p / 100) * sirali.length) - 1));
  return Math.round((sirali[i] ?? 0) * 100) / 100;
}

export type IstekSonucu<T> =
  | { ok: true; deger: T }
  | { ok: false; status: number; code: string; message: string };

const hatali = <T>(status: number, code: string, message: string): IstekSonucu<T> => ({
  ok: false,
  status,
  code,
  message,
});

/** Koşu ve oyun alanı odalarını yönetir (yalnız test2). */
export class BotKosucusu {
  private suren: Kosu | null = null;
  private readonly gecmis: KosuSonucu[] = [];
  /** Oyun alanı araçlarının açtığı odalar (koşu odaları değil). */
  private readonly odalar = new Map<string, BotOdasi>();

  constructor(private readonly rt: Runtime) {
    rt.botOdalari ??= new Map();
  }

  /** Şu an açık yalnız-bot odası ve bot sayısı (koşu + araç odaları). */
  private yuk(): { oda: number; bot: number } {
    let oda = 0;
    let bot = 0;
    for (const room of this.rt.rooms.values())
      if (room.botOdasi) {
        oda += 1;
        bot += room.players.size;
      }
    return { oda, bot };
  }

  private oyunAcik(id: string): boolean {
    return GAMES[id] !== undefined && this.rt.catalog.some((g) => g.id === id);
  }

  /** Yalnız-bot odası kurar, botları ekler ve maçı başlatır; sınır aşılırsa null. */
  odaKur(
    oyun: string,
    botSayisi: number,
    strateji: BotStrateji,
    etiket: string,
    bitince: (o: BotOdasi) => void,
    olcum?: (e: BotOlcumu) => void,
  ): BotOdasi | null {
    const y = this.yuk();
    if (y.oda >= ODA_SINIRI || y.bot + botSayisi > BOT_SINIRI) return null;
    const room = createRoom(this.rt);
    room.botOdasi = etiket;
    room.cardSettings = { ...room.cardSettings, enabled: false };
    const o = new BotOdasi(this.rt, room, oyun, botSayisi, bitince);
    for (let i = 0; i < botSayisi; i++)
      addBot(this.rt, room, {
        strateji,
        olcum: (e) => {
          o.eylem(e);
          olcum?.(e);
        },
      });
    this.rt.botOdalari?.set(room.code, o);
    o.baslat();
    return o;
  }

  // ---- Oyun alanı araçları (UM-O4) -----------------------------------------------------------------------

  odaAc(govde: unknown): IstekSonucu<Record<string, unknown>> {
    if (!isRec(govde)) return hatali(400, "invalid_input", "Gövde { oyun, bot } olmalı.");
    const oyun = typeof govde.oyun === "string" ? govde.oyun : "";
    if (!this.oyunAcik(oyun)) return hatali(400, "unknown_game", "Oyun bulunamadı ya da kapalı.");
    const g = GAMES[oyun];
    const bot =
      typeof govde.bot === "number" && Number.isInteger(govde.bot) ? govde.bot : (g?.minPlayers ?? 3);
    if (!g || bot < g.minPlayers || bot > Math.min(g.maxPlayers, MAX_PLAYERS))
      return hatali(
        400,
        "invalid_input",
        `Bot sayısı ${g?.minPlayers ?? 1}–${Math.min(g?.maxPlayers ?? 8, MAX_PLAYERS)} olmalı.`,
      );
    const strateji: BotStrateji = govde.strateji === "rastgele" ? "rastgele" : "oyna";
    const o = this.odaKur(oyun, bot, strateji, "oda", (x) => {
      // Biten oda bir süre açık kalır (durum ve kayıt okunabilsin), sonra kendiliğinden kapanır.
      this.rt.clock.setTimeout(() => this.odaKapat(x.kod), ODA_OMRU_MS);
    });
    if (!o) return hatali(429, "limit", "Oyun alanında aynı anda açık oda ya da bot sınırı dolu.");
    this.odalar.set(o.kod, o);
    log.info("oyun_alani_oda", { roomCode: o.kod, oyun, bot });
    return { ok: true, deger: o.ozet() };
  }

  oda(kod: string, olaySayisi = 30): Record<string, unknown> | null {
    return this.odalar.get(kod)?.ozet(olaySayisi) ?? null;
  }

  odaListesi(): Record<string, unknown>[] {
    return [...this.odalar.values()].map((o) => o.ozet(0));
  }

  odaKapat(kod: string): boolean {
    const o = this.odalar.get(kod);
    if (!o) return false;
    o.iptal();
    o.kapat();
    this.odalar.delete(kod);
    return true;
  }

  // ---- Koşu ------------------------------------------------------------------------------------------------

  /** İsteği doğrular ve maç listesini çıkarır. */
  istekCoz(
    govde: unknown,
  ): IstekSonucu<{ istek: KosuIstegi; plan: { oyun: string; oyuncu: number }[]; atlanan: string[] }> {
    if (!isRec(govde)) return hatali(400, "invalid_input", "Gövde { oyunlar, oyuncular, mac } olmalı.");
    const oyunlar = Array.isArray(govde.oyunlar)
      ? [...new Set(govde.oyunlar.filter((x): x is string => typeof x === "string"))]
      : [];
    if (oyunlar.length < 1 || oyunlar.length > KOSU_EN_COK_OYUN)
      return hatali(400, "invalid_input", `oyunlar: 1–${KOSU_EN_COK_OYUN} oyun.`);
    const bilinmeyen = oyunlar.filter((o) => !this.oyunAcik(o));
    if (bilinmeyen.length)
      return hatali(400, "unknown_game", `Bulunamayan ya da kapalı oyun: ${bilinmeyen.join(", ")}.`);
    const hamOyuncu = govde.oyuncular === undefined ? [] : govde.oyuncular;
    const oyuncular = Array.isArray(hamOyuncu)
      ? [...new Set(hamOyuncu.filter((x): x is number => typeof x === "number" && Number.isInteger(x)))]
      : typeof hamOyuncu === "number"
        ? [hamOyuncu]
        : [];
    if (oyuncular.some((n) => n < 2 || n > MAX_PLAYERS) || oyuncular.length > 4)
      return hatali(400, "invalid_input", `oyuncular: en çok 4 değer, 2–${MAX_PLAYERS} arası.`);
    const mac = govde.mac === undefined ? 1 : govde.mac;
    if (typeof mac !== "number" || !Number.isInteger(mac) || mac < 1 || mac > KOSU_EN_COK_MAC)
      return hatali(400, "invalid_input", `mac: 1–${KOSU_EN_COK_MAC}.`);
    const sure = govde.sureDk === undefined ? KOSU_VARSAYILAN_DK : govde.sureDk;
    if (typeof sure !== "number" || !Number.isInteger(sure) || sure < 1 || sure > KOSU_EN_COK_DK)
      return hatali(400, "invalid_input", `sureDk: 1–${KOSU_EN_COK_DK}.`);
    const strateji: BotStrateji = govde.strateji === "rastgele" ? "rastgele" : "oyna";
    const plan: { oyun: string; oyuncu: number }[] = [];
    const atlanan: string[] = [];
    for (const oyun of oyunlar) {
      const g = GAMES[oyun];
      if (!g) continue;
      const enCok = Math.min(g.maxPlayers, MAX_PLAYERS);
      const sayilar = oyuncular.length ? oyuncular : [Math.max(g.minPlayers, Math.min(4, enCok))];
      for (const n of sayilar) {
        if (n < g.minPlayers || n > enCok) {
          atlanan.push(`${oyun}: ${n} oyuncu uymuyor (${g.minPlayers}–${enCok})`);
          continue;
        }
        for (let i = 0; i < mac; i++) plan.push({ oyun, oyuncu: n });
      }
    }
    if (!plan.length) return hatali(400, "invalid_input", "Oyuncu sayıları seçilen oyunlara uymuyor.");
    if (plan.length > KOSU_EN_COK_TOPLAM)
      return hatali(
        400,
        "invalid_input",
        `Toplam maç en çok ${KOSU_EN_COK_TOPLAM} (istenen ${plan.length}).`,
      );
    return { ok: true, deger: { istek: { oyunlar, oyuncular, mac, strateji, sureDk: sure }, plan, atlanan } };
  }

  baslat(govde: unknown): IstekSonucu<KosuSonucu> {
    if (this.suren)
      return hatali(409, "run_active", "Bir koşu zaten sürüyor; bitmesini bekle ya da iptal et.");
    const c = this.istekCoz(govde);
    if (!c.ok) return c;
    const kosu = new Kosu(this, this.rt, c.deger.istek, c.deger.plan, c.deger.atlanan, (s) => {
      this.suren = null;
      this.gecmis.push(s);
      if (this.gecmis.length > KOSU_GECMISI) this.gecmis.splice(0, this.gecmis.length - KOSU_GECMISI);
      log.info("bot_kosusu_bitti", { id: s.id, durum: s.durum, mac: s.maclar.length });
    });
    this.suren = kosu;
    kosu.baslat();
    log.info("bot_kosusu", { id: kosu.id, mac: c.deger.plan.length });
    return { ok: true, deger: kosu.sonuc() };
  }

  kosu(id: string): KosuSonucu | null {
    if (this.suren?.id === id) return this.suren.sonuc();
    return this.gecmis.find((k) => k.id === id) ?? null;
  }

  kosular(): { suren: KosuSonucu | null; son: KosuSonucu[] } {
    return { suren: this.suren?.sonuc() ?? null, son: [...this.gecmis].reverse() };
  }

  iptal(id: string): boolean {
    if (this.suren?.id !== id) return false;
    this.suren.durdur("iptal");
    return true;
  }

  /** Sunucu kapanırken: süren koşu iptal, odalar kapanır. */
  kapat(): void {
    this.suren?.durdur("iptal");
    for (const kod of [...this.odalar.keys()]) this.odaKapat(kod);
  }
}

class Kosu {
  readonly id: string;
  private readonly baslama: number;
  private bitis: number | null = null;
  private durum: KosuDurumu = "suruyor";
  private sira = 0;
  private readonly sonuclar: (MacSonucu | null)[];
  private readonly acik = new Map<number, BotOdasi>();
  private readonly ornekler: KosuSonucu["ornekler"] = [];
  private readonly eylemler = new Map<string, { ms: number[]; red: Record<string, number> }>();
  private readonly oyunHatalari: KosuSonucu["oyunHatalari"] = [];
  private ornekZamani: Cancel | null = null;
  private sureZamani: Cancel | null = null;
  private bekleme: Cancel | null = null;

  constructor(
    private readonly kosucu: BotKosucusu,
    private readonly rt: Runtime,
    private readonly istek: KosuIstegi,
    private readonly plan: { oyun: string; oyuncu: number }[],
    private readonly atlanan: string[],
    private readonly bitince: (s: KosuSonucu) => void,
  ) {
    const d = new Date(rt.clock.now()).toISOString().slice(0, 10).replaceAll("-", "");
    this.id = `k${d}-${randomBytes(4).toString("hex")}`;
    this.baslama = rt.clock.now();
    this.sonuclar = plan.map(() => null);
  }

  baslat(): void {
    this.sureZamani = this.rt.clock.setTimeout(() => this.durdur("zaman_asimi"), this.istek.sureDk * 60_000);
    this.orneklemeyiKur();
    this.ilerle();
  }

  private orneklemeyiKur(): void {
    const al = (): void => {
      let oda = 0;
      for (const r of this.rt.rooms.values()) if (r.botOdasi) oda += 1;
      this.ornekler.push({
        t: this.rt.clock.now() - this.baslama,
        tickP95: Math.round(this.rt.metrics.tickMsP95() * 100) / 100,
        bellekMb: Math.round(process.memoryUsage().rss / 1048576),
        oda,
      });
      // Uzun koşuda en çok 200 örnek: eskileri seyreltilir.
      if (this.ornekler.length > 200) {
        const kalan = this.ornekler.filter((_, i) => i % 2 === 0);
        this.ornekler.splice(0, this.ornekler.length, ...kalan);
      }
    };
    al();
    const dongu = (): void => {
      this.ornekZamani = this.rt.clock.setTimeout(() => {
        al();
        if (this.durum === "suruyor") dongu();
      }, ORNEK_MS);
    };
    dongu();
  }

  /** Boş yer oldukça sıradaki maçları açar; hepsi bittiyse koşuyu bitirir. */
  private ilerle(): void {
    if (this.durum !== "suruyor") return;
    while (this.acik.size < KOSU_PARALEL && this.sira < this.plan.length) {
      const i = this.sira;
      const p = this.plan[i];
      if (!p) break;
      const o = this.kosucu.odaKur(
        p.oyun,
        p.oyuncu,
        this.istek.strateji,
        this.id,
        (x) => this.macBitti(i, x),
        (e) => this.olc(e),
      );
      if (!o) {
        // Araç odaları yeri doldurmuş: biraz sonra yeniden dene.
        if (!this.bekleme && this.acik.size === 0)
          this.bekleme = this.rt.clock.setTimeout(() => {
            this.bekleme = null;
            this.ilerle();
          }, 5_000);
        return;
      }
      this.sira += 1;
      this.acik.set(i, o);
    }
    if (this.acik.size === 0 && this.sira >= this.plan.length) this.bitir("bitti");
  }

  private olc(e: BotOlcumu): void {
    let x = this.eylemler.get(e.gameId);
    if (!x) {
      x = { ms: [], red: {} };
      this.eylemler.set(e.gameId, x);
    }
    if (x.ms.length < 20_000) x.ms.push(e.ms);
    if (e.ack && !e.ack.ok) {
      const r = e.ack.reason || "bilinmiyor";
      x.red[r] = (x.red[r] ?? 0) + 1;
    }
  }

  private macBitti(i: number, o: BotOdasi): void {
    this.sonuclar[i] = o.sonuc();
    if (o.durum === "coktu" && o.hata) {
      const [fn, ...m] = o.hata.split(": ");
      this.oyunHatalari.push({ oyun: o.oyun, fn: fn ?? "", mesaj: m.join(": ") || o.hata });
    }
    this.acik.delete(i);
    // Oda gözlem çağrısının içinden kapatılmaz: bir sonraki saat adımında.
    this.rt.clock.setTimeout(() => {
      o.kapat();
      this.ilerle();
    }, 0);
  }

  durdur(durum: "iptal" | "zaman_asimi"): void {
    if (this.durum !== "suruyor") return;
    for (const [i, o] of [...this.acik]) {
      o.iptal();
      this.sonuclar[i] = o.sonuc();
      o.kapat();
    }
    this.acik.clear();
    this.bitir(durum);
  }

  private bitir(durum: KosuDurumu): void {
    if (this.durum !== "suruyor") return;
    this.durum = durum;
    this.bitis = this.rt.clock.now();
    for (const c of [this.ornekZamani, this.sureZamani, this.bekleme]) c?.();
    this.ornekZamani = null;
    this.sureZamani = null;
    this.bekleme = null;
    this.bitince(this.sonuc());
  }

  sonuc(): KosuSonucu {
    const eylemler: Record<string, EylemOlcumu> = {};
    for (const [oyun, x] of this.eylemler) {
      const s = [...x.ms].sort((a, b) => a - b);
      eylemler[oyun] = {
        n: x.ms.length,
        p50: yuzdelik(s, 50),
        p95: yuzdelik(s, 95),
        max: Math.round((s.at(-1) ?? 0) * 100) / 100,
        red: { ...x.red },
      };
    }
    return {
      id: this.id,
      istek: this.istek,
      durum: this.durum,
      baslama: this.baslama,
      bitis: this.bitis,
      maclar: this.plan.map(
        (p, i) =>
          this.sonuclar[i] ??
          this.acik.get(i)?.sonuc() ?? {
            oyun: p.oyun,
            oyuncu: p.oyuncu,
            durum: this.durum === "suruyor" ? "bekliyor" : "iptal",
            sureMs: null,
            skorlar: [],
          },
      ),
      ornekler: [...this.ornekler],
      eylemler,
      oyunHatalari: [...this.oyunHatalari],
      atlananlar: [...this.atlanan],
      tickP95Son: Math.round(this.rt.metrics.tickMsP95() * 100) / 100,
    };
  }
}
