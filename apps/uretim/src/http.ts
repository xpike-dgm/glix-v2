/** HTTP yardımcıları: yanıt, gövde okuma (boyut sınırlı), çerez, kaynak (CSRF) denetimi. */
import type { IncomingMessage, ServerResponse } from "node:http";

export const GUVENLIK_BASLIKLARI: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/** Sayfa CSP'si: yalnız önizleme kaynağı iframe olarak gömülebilir; site kendisi hiçbir yere gömülemez. */
export function sayfaCsp(onizlemeUrl: string): string {
  let kaynak = "";
  try {
    kaynak = new URL(onizlemeUrl).origin;
  } catch {
    kaynak = "";
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    `frame-src ${kaynak || "'none'"}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join("; ");
}

export function gonder(
  res: ServerResponse,
  durum: number,
  govde: unknown,
  ek: Record<string, string | string[]> = {},
): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(durum, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...GUVENLIK_BASLIKLARI,
    ...ek,
  });
  res.end(JSON.stringify(govde));
}

export function hata(res: ServerResponse, durum: number, kod: string, mesaj: string): void {
  gonder(res, durum, { ok: false, kod, mesaj });
}

export class GovdeHatasi extends Error {
  constructor(
    readonly durum: number,
    mesaj: string,
  ) {
    super(mesaj);
  }
}

/** Gövdeyi en çok `sinir` bayt okur; aşarsa 413. */
export function govdeOku(req: IncomingMessage, sinir: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bildirilen = Number(req.headers["content-length"] ?? "0");
    if (Number.isFinite(bildirilen) && bildirilen > sinir) {
      reject(new GovdeHatasi(413, "İstek çok büyük."));
      req.resume();
      return;
    }
    const parcalar: Buffer[] = [];
    let boy = 0;
    let bitti = false;
    req.on("data", (d: Buffer) => {
      if (bitti) return;
      boy += d.length;
      if (boy > sinir) {
        bitti = true;
        reject(new GovdeHatasi(413, "İstek çok büyük."));
        req.resume();
        return;
      }
      parcalar.push(d);
    });
    req.on("end", () => {
      if (!bitti) resolve(Buffer.concat(parcalar));
    });
    req.on("error", () => {
      if (!bitti) reject(new GovdeHatasi(400, "İstek okunamadı."));
    });
  });
}

export async function jsonOku(req: IncomingMessage, sinir: number): Promise<unknown> {
  const tur = String(req.headers["content-type"] ?? "");
  if (!tur.toLowerCase().startsWith("application/json")) throw new GovdeHatasi(415, "JSON bekleniyor.");
  const b = await govdeOku(req, sinir);
  try {
    return JSON.parse(b.toString("utf8")) as unknown;
  } catch {
    throw new GovdeHatasi(400, "JSON okunamadı.");
  }
}

export function cerezOku(baslik: string | undefined, ad: string): string | null {
  if (!baslik) return null;
  for (const parca of baslik.split(";")) {
    const i = parca.indexOf("=");
    if (i < 0 || parca.slice(0, i).trim() !== ad) continue;
    const v = parca.slice(i + 1).trim();
    return /^[A-Za-z0-9_-]{43}$/.test(v) ? v : null;
  }
  return null;
}

/**
 * Çerezli yazma isteklerinde CSRF koruması: `Origin` sitenin kendi kökeni olmalı ve istek özel başlığı
 * (`X-Uretim: 1`) taşımalı (basit form gönderimi bu başlığı ekleyemez). Çerez ayrıca SameSite=Strict.
 */
export function kaynakUygun(req: IncomingMessage, publicUrl: string): boolean {
  if (req.headers["x-uretim"] !== "1") return false;
  const origin = req.headers.origin;
  if (!origin) return false;
  let beklenen: string;
  try {
    beklenen = new URL(publicUrl).origin;
  } catch {
    return false;
  }
  if (origin === beklenen) return true;
  // Yerel geliştirme: aynı makinedeki Vite sunucusu.
  const host = req.headers.host;
  try {
    const o = new URL(origin);
    return (
      (o.hostname === "localhost" || o.hostname === "127.0.0.1") && host !== undefined && o.host === host
    );
  } catch {
    return false;
  }
}

export function guvenliIstek(req: IncomingMessage, trustProxy: boolean): boolean {
  if ((req.socket as { encrypted?: boolean }).encrypted) return true;
  if (!trustProxy) return false;
  const p = req.headers["x-forwarded-proto"];
  return (Array.isArray(p) ? p.join(",") : (p ?? "")).split(",").at(-1)?.trim() === "https";
}

/** İstemci IP'si (Caddy arkasında X-Forwarded-For'un son girdisi). */
export function istemciIp(req: IncomingMessage, trustProxy: boolean): string {
  const ham = req.socket.remoteAddress ?? "";
  if (!trustProxy) return ham;
  const x = req.headers["x-forwarded-for"];
  const son = (Array.isArray(x) ? x.join(",") : (x ?? "")).split(",").at(-1)?.trim();
  return son || ham;
}

// ---- Doğrulama yardımcıları --------------------------------------------------------------------------------

export const kayit = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Kısa metin: kırpılır, görünmez denetim karakterleri reddedilir. */
export function metin(v: unknown, enAz: number, enCok: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r\n/g, "\n").trim();
  if (/(?![\n\t])\p{Cc}/u.test(t)) return null;
  const n = [...t].length;
  return n >= enAz && n <= enCok ? t : null;
}

export function tamsayi(v: unknown, enAz: number, enCok: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= enAz && v <= enCok ? v : null;
}

export const tarih = (v: unknown): string | null =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;

export function idParam(v: string | null | undefined): number | null {
  if (!v || !/^\d{1,12}$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}
