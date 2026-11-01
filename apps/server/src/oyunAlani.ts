/**
 * Oyun alanı (test2) taslak katmanı (UM-O2, UM-O3 ilk dilim; sözleşme `docs/uretim/SOZLESME.md` bölüm 13). Yalnız
 * `GLIX_ORTAM=test2`'de kurulur; canlıda ve test'te bu modül hiç çalışmaz, uçları yoktur (404).
 *
 * - Üretim Merkezi mağaza teslimlerini `POST /api/uretim/magaza/taslak` ile yükler: ürün satırı + görseller (base64).
 *   Satır oyunun doğrulayıcılarıyla (`validateShopItem`, efekt tarifi) denetlenir; katalogdaki ve diğer taslaklardaki
 *   kimlik/ad tekrarı, katalogdaki görsel adı (`asset`) çakışması, eksik/fazla dosya ve bozuk görsel reddedilir.
 * - Taslaklar motorun önizleme katmanına (`setPreviewItems`) konur: sunucu satın almayı ve kuşanmayı bu katmanla
 *   doğrular, istemci `GET /api/oyun-alani/magaza` ile aynı katmanı kurar ve mağazada "TASLAK" etiketiyle gösterir.
 * - Görseller veri klasöründe içerik özetiyle (`<dir>/dosya/<sha256>.<webp|png>`) durur ve
 *   `GET /api/oyun-alani/dosya/<ad>` ile servis edilir.
 * - Katmanın kimliği (`<dir>/kimlik`) gece sıfırlamasıyla (`ortamYenile --sifirla` klasörü siler) değişir; Üretim
 *   Merkezi `GET /api/uretim/saglik` yanıtındaki `katman` alanından sıfırlandığını anlar ve taslakları yeniden yükler.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import {
  COSMETIC_ITEMS,
  type CosmeticItem,
  cosmeticAssetFiles,
  DRAFT_SHOP_TYPES,
  effectTextures,
  parseEffectRecipe,
  parseShopItem,
  setPreviewItems,
  validateShopItem,
} from "@glix/engine";
import { log } from "./log.js";
import { SECURITY_HEADERS } from "./static.js";

/** İstemcinin taslak katmanını okuduğu genel uçlar (yalnız test2). */
export const OYUN_ALANI_PREFIX = "/api/oyun-alani";
/** En çok taslak ürün. */
export const TASLAK_EN_COK = 100;
/** Tek görselin ve bir ürünün bütün görsellerinin en çok boyu (bayt). */
export const TASLAK_DOSYA_EN_COK = 4 * 1024 * 1024;
export const TASLAK_TOPLAM_EN_COK = 12 * 1024 * 1024;
/** Taslak yükleme isteğinin gövde sınırı (base64 payıyla). */
export const TASLAK_GOVDE_EN_COK = 18 * 1024 * 1024;

/** Taslak katmanının klasörü: hesap veritabanının yanında `oyun-alani/` (gece sıfırlaması bu klasörü siler). */
export const oyunAlaniKlasoru = (dbPath: string): string => join(dirname(dbPath), "oyun-alani");

/** Dosya yolu `/assets/shop/` altında göreli: `<klasör>/<ad>.webp`. */
const YOL = /^[a-z0-9-]+\/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$/;
const DOSYA_ADI = /^([0-9a-f]{64})\.(webp|png)$/;

export interface TaslakKaydi {
  urun: CosmeticItem;
  /** Ham satır (yeniden doğrulama ve Üretim Merkezi'ne geri okuma için). */
  satir: Record<string, unknown>;
  /** `/assets/shop/` altındaki yol -> veri klasöründeki dosya adı (`<sha256>.<webp|png>`). */
  dosyalar: Record<string, string>;
  zaman: number;
}

export type TaslakSonucu =
  | { ok: true; id: string; degisti: boolean }
  | { ok: false; status: number; code: string; message: string; errors: string[] };

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Bayt dizisi WebP ya da PNG mi (imza denetimi; uzantıya güvenilmez). */
export function gorselTuru(b: Buffer): "webp" | "png" | null {
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP")
    return "webp";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "png";
  return null;
}

/** `apps/client/public/assets/shop/x/y.webp`, `/assets/shop/x/y.webp` ya da `x/y.webp` -> `x/y.webp`; geçersizse null. */
export function taslakYolu(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 160) return null;
  let p = raw.trim();
  for (const onek of [
    "apps/client/public/assets/shop/",
    "public/assets/shop/",
    "/assets/shop/",
    "assets/shop/",
  ])
    if (p.startsWith(onek)) {
      p = p.slice(onek.length);
      break;
    }
  return YOL.test(p) && !p.includes("..") ? p : null;
}

/** Ürünün görünmesi için gereken bütün görseller (`/assets/shop/` altında): ürün dosyaları + efekt dokuları. */
export function gerekenDosyalar(it: CosmeticItem): string[] {
  const out = new Set(cosmeticAssetFiles(it));
  if (it.efekt) {
    const e = parseEffectRecipe(it.efekt, it.type);
    if (e) for (const d of effectTextures(e)) out.add(d);
  }
  return [...out];
}

export class OyunAlaniKatmani {
  private readonly taslaklar = new Map<string, TaslakKaydi>();
  private readonly bellek = new Map<string, Buffer>();
  readonly kimlik: string;

  /**
   * @param dir Veri klasörü (`<veri>/oyun-alani`); null ise yalnız bellekte (testler).
   * @param shopDir Oyunun yerleşik mağaza görselleri (`<istemci>/assets/shop`): taslağın kullandığı ama göndermediği
   *   dosya burada varsa geçerlidir (ör. var olan bir doku).
   */
  constructor(
    private readonly dir: string | null,
    private readonly shopDir: string | null,
  ) {
    if (dir) {
      mkdirSync(join(dir, "dosya"), { recursive: true });
      const k = join(dir, "kimlik");
      let kimlik = "";
      try {
        kimlik = readFileSync(k, "utf8").trim();
      } catch {
        kimlik = "";
      }
      if (!/^[0-9a-f]{16,64}$/.test(kimlik)) {
        kimlik = randomBytes(12).toString("hex");
        writeFileSync(k, `${kimlik}\n`);
      }
      this.kimlik = kimlik;
      this.yukle();
    } else this.kimlik = randomBytes(12).toString("hex");
    this.uygula();
  }

  /** Kayıtlı taslakları okur; artık geçmeyen (ör. ana koda girmiş: kimlik katalogda) taslak atlanır. */
  private yukle(): void {
    if (!this.dir) return;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(this.dir, "katman.json"), "utf8")) as unknown;
    } catch {
      return;
    }
    if (!isRec(raw) || !Array.isArray(raw.taslaklar)) return;
    for (const t of raw.taslaklar.slice(0, TASLAK_EN_COK)) {
      if (!isRec(t) || !isRec(t.satir) || !isRec(t.dosyalar)) continue;
      const dosyalar: Record<string, string> = {};
      for (const [yol, ad] of Object.entries(t.dosyalar))
        if (taslakYolu(yol) === yol && typeof ad === "string" && DOSYA_ADI.test(ad)) dosyalar[yol] = ad;
      const urun = parseShopItem(t.satir);
      if (!urun || this.hatalar(t.satir, urun, Object.keys(dosyalar)).length > 0) {
        log.warn("oyun_alani_taslak_atlandi", { id: typeof t.satir.id === "string" ? t.satir.id : "" });
        continue;
      }
      this.taslaklar.set(urun.id, {
        urun,
        satir: t.satir,
        dosyalar,
        zaman: typeof t.zaman === "number" ? t.zaman : 0,
      });
    }
  }

  private kaydet(): void {
    if (!this.dir) return;
    const p = join(this.dir, "katman.json");
    const gecici = `${p}.gecici`;
    writeFileSync(
      gecici,
      JSON.stringify({
        surum: 1,
        taslaklar: [...this.taslaklar.values()].map((t) => ({
          satir: t.satir,
          dosyalar: t.dosyalar,
          zaman: t.zaman,
        })),
      }),
    );
    renameSync(gecici, p);
  }

  private uygula(): void {
    setPreviewItems(this.taslaklar.size > 0 ? [...this.taslaklar.values()].map((t) => t.urun) : null);
  }

  /** Satırın katalog ve diğer taslaklarla çakışmaları + katmana özgü kurallar. */
  private hatalar(satir: Record<string, unknown>, urun: CosmeticItem | null, yollar: string[]): string[] {
    const errors: string[] = [];
    const id = typeof satir.id === "string" ? satir.id : "";
    const digerleri = [...this.taslaklar.values()].filter((t) => t.urun.id !== id).map((t) => t.satir);
    for (const e of validateShopItem(satir, [...COSMETIC_ITEMS, ...digerleri]).errors) errors.push(e);
    if (!urun) return errors.length ? errors : ["ürün satırı geçersiz"];
    if (!DRAFT_SHOP_TYPES.includes(urun.type))
      errors.push(
        `type: ${urun.type} oyun alanına taslak olarak yüklenemez (karakter varlığı gerekir); izinli: ${DRAFT_SHOP_TYPES.join(", ")}`,
      );
    if (urun.asset !== undefined) {
      const ayni = (i: CosmeticItem): boolean =>
        i.type === urun.type && i.asset === urun.asset && i.id !== urun.id;
      if (COSMETIC_ITEMS.some(ayni) || [...this.taslaklar.values()].some((t) => ayni(t.urun)))
        errors.push(`asset: "${urun.asset}" bu türde zaten kullanılıyor (görseller birbirini ezer)`);
    }
    const gereken = gerekenDosyalar(urun);
    for (const y of yollar)
      if (!gereken.includes(y)) errors.push(`dosya: ${y} bu ürünün kullandığı bir görsel değil`);
    for (const g of gereken)
      if (!yollar.includes(g) && !(this.shopDir && existsSync(join(this.shopDir, g))))
        errors.push(`dosya: ${g} eksik`);
    return errors;
  }

  /** Taslak ekler ya da aynı kimlikli taslağı değiştirir. */
  ekle(govde: unknown, now: number): TaslakSonucu {
    const bozuk = (message: string, errors: string[] = []): TaslakSonucu => ({
      ok: false,
      status: 400,
      code: "invalid_item",
      message,
      errors,
    });
    if (!isRec(govde) || !isRec(govde.urun)) return bozuk("Gövde { urun, dosyalar } olmalı.");
    const satir = govde.urun;
    const hamDosyalar = govde.dosyalar ?? [];
    if (!Array.isArray(hamDosyalar) || hamDosyalar.length > 12)
      return bozuk("dosyalar: en çok 12 öğelik liste olmalı.");
    const gelen = new Map<string, { veri: Buffer; tur: "webp" | "png" }>();
    let toplam = 0;
    for (const [i, d] of hamDosyalar.entries()) {
      const yol = isRec(d) ? taslakYolu(d.yol) : null;
      if (!isRec(d) || !yol) return bozuk(`dosyalar[${i}]: yol "<klasör>/<ad>.webp" biçiminde olmalı.`);
      if (gelen.has(yol)) return bozuk(`dosyalar[${i}]: ${yol} iki kez gönderildi.`);
      if (typeof d.veri !== "string" || d.veri.length > Math.ceil((TASLAK_DOSYA_EN_COK * 4) / 3) + 8)
        return bozuk(`dosyalar[${i}]: veri base64 olmalı (en çok 4 MB).`);
      const veri = Buffer.from(d.veri, "base64");
      const tur = gorselTuru(veri);
      if (!tur || veri.length > TASLAK_DOSYA_EN_COK)
        return bozuk(`dosyalar[${i}]: WebP ya da PNG görsel olmalı.`);
      toplam += veri.length;
      gelen.set(yol, { veri, tur });
    }
    if (toplam > TASLAK_TOPLAM_EN_COK) return bozuk("Bir üründe görseller toplam en çok 12 MB olabilir.");
    const urun = parseShopItem(satir);
    const errors = this.hatalar(satir, urun, [...gelen.keys()]);
    if (!urun || errors.length > 0) return bozuk("Ürün oyunun kurallarına uymuyor.", errors);
    const onceki = this.taslaklar.get(urun.id);
    if (!onceki && this.taslaklar.size >= TASLAK_EN_COK)
      return { ok: false, status: 409, code: "layer_full", message: "Taslak katmanı dolu.", errors: [] };
    const dosyalar: Record<string, string> = {};
    for (const [yol, d] of gelen) {
      const ad = `${createHash("sha256").update(d.veri).digest("hex")}.${d.tur}`;
      if (this.dir) {
        const p = join(this.dir, "dosya", ad);
        if (!existsSync(p)) {
          writeFileSync(`${p}.gecici`, d.veri);
          renameSync(`${p}.gecici`, p);
        }
      } else this.bellek.set(ad, d.veri);
      dosyalar[yol] = ad;
    }
    const degisti =
      JSON.stringify(onceki?.satir) !== JSON.stringify(satir) ||
      JSON.stringify(onceki?.dosyalar) !== JSON.stringify(dosyalar);
    this.taslaklar.set(urun.id, { urun, satir, dosyalar, zaman: now });
    this.kaydet();
    this.uygula();
    return { ok: true, id: urun.id, degisti };
  }

  /** Taslağı kaldırır (görsel dosyaları gece sıfırlamasında silinir). Kaldırıldıysa true. */
  sil(id: string): boolean {
    if (!this.taslaklar.delete(id)) return false;
    this.kaydet();
    this.uygula();
    return true;
  }

  /** Sunucu kapanırken motorun önizleme katmanını boşaltır. */
  kapat(): void {
    setPreviewItems(null);
  }

  liste(): TaslakKaydi[] {
    return [...this.taslaklar.values()];
  }

  has(id: string): boolean {
    return this.taslaklar.has(id);
  }

  /** İstemcinin katmanı: ürün satırları ve oyundaki yol -> taslak görsel adresi. */
  istemciKatmani(): { urunler: Record<string, unknown>[]; dosyalar: Record<string, string> } {
    const dosyalar: Record<string, string> = {};
    for (const t of this.taslaklar.values())
      for (const [yol, ad] of Object.entries(t.dosyalar))
        dosyalar[`/assets/shop/${yol}`] = `${OYUN_ALANI_PREFIX}/dosya/${ad}`;
    return { urunler: [...this.taslaklar.values()].map((t) => t.satir), dosyalar };
  }

  /** Görsel dosyası (ad `<sha256>.<webp|png>`); yoksa null. Yalnız katmanda kullanılan dosyalar verilir. */
  dosya(ad: string): { veri: Buffer; tur: string } | null {
    const m = DOSYA_ADI.exec(ad);
    if (!m) return null;
    const kullaniliyor = [...this.taslaklar.values()].some((t) => Object.values(t.dosyalar).includes(ad));
    if (!kullaniliyor) return null;
    let veri: Buffer | undefined = this.bellek.get(ad);
    if (!veri && this.dir) {
      try {
        veri = readFileSync(join(this.dir, "dosya", ad));
      } catch {
        veri = undefined;
      }
    }
    return veri ? { veri, tur: m[2] === "png" ? "image/png" : "image/webp" } : null;
  }

  /** Genel uçlar: `GET /api/oyun-alani/magaza`, `GET /api/oyun-alani/dosya/<ad>`. */
  handle(req: IncomingMessage, res: ServerResponse): void {
    const path = (req.url ?? "").split("?")[0] ?? "";
    const yok = (): void => {
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
      res.end(JSON.stringify({ ok: false, code: "not_found", message: "Bulunamadı." }));
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      yok();
      return;
    }
    if (path === `${OYUN_ALANI_PREFIX}/magaza`) {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...SECURITY_HEADERS,
      });
      res.end(req.method === "HEAD" ? undefined : JSON.stringify({ ok: true, ...this.istemciKatmani() }));
      return;
    }
    const m = /^\/api\/oyun-alani\/dosya\/([^/]+)$/.exec(path);
    const d = m?.[1] ? this.dosya(m[1]) : null;
    if (!d) {
      yok();
      return;
    }
    res.writeHead(200, {
      "Content-Type": d.tur,
      "Content-Length": String(d.veri.length),
      // İçerik özetiyle adlandırılmış: değişmez.
      "Cache-Control": "public, max-age=31536000, immutable",
      ...SECURITY_HEADERS,
    });
    res.end(req.method === "HEAD" ? undefined : d.veri);
  }
}
