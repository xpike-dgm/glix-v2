import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { seritEkle } from "./ortam.js";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

/** Tüm statik yanıtlara eklenen güvenlik başlıkları (CSP: yalnız aynı kaynak; Pixi/Vite satır içi betik gerektirmez). */
export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/** Önizleme sayfasını (UM-U4) gömebilen kaynak: canlıda yalnız Üretim Merkezi. */
export const PROD_PREVIEW_ANCESTOR = "https://uretim.dgmcraft.online";
/** Geliştirmede yerel kaynaklar da gömebilir. */
export const DEV_PREVIEW_ANCESTORS: readonly string[] = ["http://localhost:*", "http://127.0.0.1:*"];
export const PREVIEW_PAGE = "/onizleme.html";

/**
 * Önizleme sayfasının başlıkları: yalnız izinli kaynak gömebilir (`frame-ancestors`; `X-Frame-Options` verilmez,
 * yoksa her gömmeyi engellerdi). Taslak dosyalar `data:`/`blob:` adresiyle gelir: görsel, ses ve dans JSON'u için
 * bu iki şemaya izin verilir. Sayfa önbelleğe alınmaz ve arama motorlarına kapalıdır.
 */
export function previewHeaders(ancestors: readonly string[]): Record<string, string> {
  const { "X-Frame-Options": _xfo, ...rest } = SECURITY_HEADERS;
  return {
    ...rest,
    "Content-Security-Policy": `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self'; connect-src 'self' data: blob:; worker-src 'self' blob:; frame-ancestors ${ancestors.length > 0 ? ancestors.join(" ") : "'none'"}; base-uri 'none'; form-action 'none'`,
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
  };
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
  res.end("Bulunamadı");
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Aynı adla yenilenebilen görsel klasörleri (istemcideki `glix-art` deseniyle aynı). */
const ART_DIR = /^\/assets\/(?:worlds|cards|briefing|props|avatars|mascot|badges|fx|brand|shop|karakter)\//;

/**
 * Derleme çıktısı adında özet taşıdığı için değişmezdir. Görseller aynı adla yenilenebilir: tarayıcı
 * önbelleği kısa tutulur; kalıcı saklama servis çalışanının (`glix-art`) ve içerik havuzunun işidir.
 */
export function cacheControl(urlPath: string): string {
  if (ART_DIR.test(urlPath)) return "public, max-age=300";
  if (urlPath.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  return "no-cache";
}

export interface StaticOptions {
  /** Yönetici paneli açık mı (`GLIX_ADMIN_ACCOUNT_IDS` dolu). Kapalıyken `/admin`, `/wiki` ve sayfaları 404 verir. */
  adminEnabled?: boolean;
  /** `onizleme.html`'i gömebilen kaynaklar; verilmezse yalnız Üretim Merkezi. */
  previewAncestors?: readonly string[];
  /** Test ortamlarında ana sayfaya (`index.html`) eklenen ortam şeridi HTML'i; canlıda verilmez. */
  serit?: string;
}

/** `/admin` (ve sonundaki eğik çizgi) yönetici sayfasıdır; geri kalan `/admin/...` yolları yoktur. */
const ADMIN_PAGE = /^\/admin\/?$/;
/** `/wiki`: yöneticinin oyun ansiklopedisi (içeriği yönetici uçlarından gelir; sayfanın kendisi boş kabuktur). */
const WIKI_PAGE = /^\/wiki\/?$/;

/** İstemci dosyalarını sunar. İstek işlendiyse true döner. */
export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  clientDir: string,
  options: StaticOptions = {},
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD", ...SECURITY_HEADERS });
    res.end();
    return;
  }
  const root = resolve(clientDir);
  let urlPath: string;
  try {
    urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  } catch {
    notFound(res);
    return;
  }
  if (urlPath.includes("\0")) {
    notFound(res);
    return;
  }

  const adminPage = ADMIN_PAGE.test(urlPath) || urlPath === "/admin.html";
  if ((adminPage || urlPath.startsWith("/admin/")) && !options.adminEnabled) {
    notFound(res);
    return;
  }
  if (urlPath.startsWith("/admin/") && !adminPage) {
    notFound(res);
    return;
  }
  const wikiPage = WIKI_PAGE.test(urlPath) || urlPath === "/wiki.html";
  if ((wikiPage || urlPath.startsWith("/wiki/")) && !options.adminEnabled) {
    notFound(res);
    return;
  }
  if (urlPath.startsWith("/wiki/") && !wikiPage) {
    notFound(res);
    return;
  }
  if (ADMIN_PAGE.test(urlPath)) urlPath = "/admin.html";
  if (WIKI_PAGE.test(urlPath)) urlPath = "/wiki.html";

  let file = resolve(join(root, normalize(urlPath)));
  if (file !== root && !file.startsWith(root + sep)) {
    notFound(res);
    return;
  }

  let servedPath = urlPath;
  if (urlPath.endsWith("/")) file = join(file, "index.html");
  if (!(await isFile(file))) {
    // Uzantısız yollar SPA geri dönüşü alır.
    if (extname(urlPath) === "" || urlPath.endsWith("/")) {
      file = join(root, "index.html");
      servedPath = "/index.html";
      if (!(await isFile(file))) {
        notFound(res);
        return;
      }
    } else {
      notFound(res);
      return;
    }
  }

  const info = await stat(file);
  // Kabuk dosyaları ve varlık bildirimi her seferinde doğrulanır (bildirim yeni sürümü fark etmenin tek yolu).
  const isShell =
    servedPath.endsWith(".html") || servedPath === "/sw.js" || servedPath === "/asset-manifest.json";
  const headers: Record<string, string | number> = {
    "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": info.size,
    "Cache-Control": isShell ? "no-cache" : cacheControl(servedPath),
    ...SECURITY_HEADERS,
    // Yönetici sayfası arama motorlarına açık değildir.
    ...(servedPath === "/admin.html" || servedPath === "/wiki.html" ? { "X-Robots-Tag": "noindex" } : {}),
  };
  if (servedPath === PREVIEW_PAGE) {
    delete headers["X-Frame-Options"];
    Object.assign(headers, previewHeaders(options.previewAncestors ?? [PROD_PREVIEW_ANCESTOR]));
  }
  if (options.serit && file === join(root, "index.html")) {
    const body = Buffer.from(seritEkle(await readFile(file, "utf8"), options.serit), "utf8");
    headers["Content-Length"] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }
  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = createReadStream(file);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}
