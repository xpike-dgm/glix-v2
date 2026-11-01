/**
 * Canlı güncelleme (Server-Sent Events): `/api/olaylar`, yalnız sahip oturumuyla. Sunucudaki her durum değişikliği
 * (teslim, karar, geri alma, iş, kilit, istek kartı, kod isteği, aktarım, uyarı) bütün açık sekmelere ve cihazlara
 * kısa bir olay olarak gider; istemci ilgili verileri yeniden çeker. Olayda içerik ya da sır yoktur: yalnız tür,
 * alan ve sıra numarası.
 *
 * Caddy ardında: yanıt tamponlanmaz (`Cache-Control: no-cache`, `X-Accel-Buffering: no`), 25 sn'de bir yorum satırı
 * bağlantıyı canlı tutar. Oturum kapanınca ya da süresi dolunca akış kapanır.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { DenetimEylemi } from "./denetim.js";
import { ALAN_IDLERI } from "./ortak/alanlar.js";

export const CANLI_TUT_MS = 25_000;
/** Aynı anda en çok açık akış (sekme/cihaz). Dolunca en eskisi kapanır. */
export const EN_COK_AKIS = 32;

export type OlayTuru =
  | "teslim"
  | "karar"
  | "geri_al"
  | "is"
  | "kilit"
  | "istek_karti"
  | "kod_istegi"
  | "aktarim"
  | "paket"
  | "uyari"
  | "ayar";

export interface Olay {
  n: number;
  tur: OlayTuru;
  alan: string | null;
}

/** Denetim eylemi → olay türü. Giriş/çıkış ve kopyalama gibi veriyi değiştirmeyenler yayılmaz. */
export function eylemdenOlay(eylem: DenetimEylemi, ayrinti = ""): OlayTuru | null {
  switch (eylem) {
    case "teslim":
    case "elle_teslim":
      return "teslim";
    case "yorum":
      return "karar";
    case "onay":
    case "ret":
    case "duzeltme":
      return /geri alındı/.test(ayrinti) ? "geri_al" : "karar";
    case "is":
      return /kilidi/.test(ayrinti) ? "kilit" : "is";
    case "istek_karti":
      return "istek_karti";
    case "kod_istegi":
      return "kod_istegi";
    case "aktarim":
    case "aktarim_geri_al":
      return "aktarim";
    case "paket":
    case "paket_oyuna_eklendi":
      return "paket";
    case "talimat":
    case "ayar":
    case "anahtar_uretildi":
    case "anahtar_iptal":
    case "ssh_anahtari_eklendi":
    case "ssh_anahtari_kaldirildi":
      return "ayar";
    default:
      return null;
  }
}

interface Akis {
  res: ServerResponse;
  belirtec: string;
}

export class OlayYayini {
  private readonly akislar = new Set<Akis>();
  private sayac = 0;
  private zaman: NodeJS.Timeout | null = null;

  constructor(private readonly oturumGecerli: (belirtec: string) => boolean) {}

  get acikAkis(): number {
    return this.akislar.size;
  }

  /** Akışı açar; yanıt açık kalır. */
  abone(req: IncomingMessage, res: ServerResponse, belirtec: string): void {
    if (this.akislar.size >= EN_COK_AKIS) {
      const en = this.akislar.values().next().value;
      if (en) this.birak(en);
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    });
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    const a: Akis = { res, belirtec };
    this.akislar.add(a);
    // Kopan bağlantı en geç 5 sn sonra yeniden denensin; ilk satır hazır olduğunu bildirir.
    res.write(`retry: 5000\nevent: hazir\ndata: ${JSON.stringify({ n: this.sayac })}\n\n`);
    const kapan = (): void => {
      this.akislar.delete(a);
    };
    req.on("close", kapan);
    res.on("close", kapan);
    res.on("error", kapan);
    this.zamanlayici();
  }

  /** Olayı bütün açık akışlara yollar. */
  yay(tur: OlayTuru, alan: string | null = null): Olay {
    this.sayac += 1;
    const o: Olay = {
      n: this.sayac,
      tur,
      alan: alan && (ALAN_IDLERI as readonly string[]).includes(alan) ? alan : null,
    };
    const satir = `id: ${o.n}\nevent: degisti\ndata: ${JSON.stringify(o)}\n\n`;
    for (const a of this.akislar) {
      if (!this.oturumGecerli(a.belirtec)) this.birak(a);
      else a.res.write(satir);
    }
    return o;
  }

  /** Canlı tutma: yorum satırı; oturumu biten akış kapanır. */
  canliTut(): void {
    for (const a of this.akislar) {
      if (!this.oturumGecerli(a.belirtec)) this.birak(a);
      else a.res.write(": canli\n\n");
    }
    if (this.akislar.size === 0 && this.zaman) {
      clearInterval(this.zaman);
      this.zaman = null;
    }
  }

  kapat(): void {
    for (const a of this.akislar) this.birak(a);
    if (this.zaman) clearInterval(this.zaman);
    this.zaman = null;
  }

  private birak(a: Akis): void {
    this.akislar.delete(a);
    try {
      a.res.end();
    } catch {
      // zaten kapalı
    }
  }

  private zamanlayici(): void {
    if (this.zaman) return;
    this.zaman = setInterval(() => this.canliTut(), CANLI_TUT_MS);
    this.zaman.unref();
  }
}
