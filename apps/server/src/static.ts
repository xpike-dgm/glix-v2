import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

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
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

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

function cacheControl(urlPath: string): string {
  if (urlPath.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  return "no-cache";
}

/** İstemci dosyalarını sunar. İstek işlendiyse true döner. */
export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  clientDir: string,
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
  const isShell = servedPath.endsWith(".html") || servedPath === "/sw.js";
  const headers: Record<string, string | number> = {
    "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": info.size,
    "Cache-Control": isShell ? "no-cache" : cacheControl(servedPath),
    ...SECURITY_HEADERS,
  };
  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = createReadStream(file);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}
