import { APP_VERSION } from "@glix/engine";

/** Bir sayfa yüklemesinde en çok bu kadar bildirim gider. */
export const MAX_REPORTS = 5;
const STACK_MAX = 2048;
const MESSAGE_MAX = 500;
const UA_MAX = 200;
const ENDPOINT = "/api/client-error";

export interface ErrorReport {
  message: string;
  stack: string;
  url: string;
  version: string;
  ua: string;
}

/** Hata nesnesinden bildirim gövdesi üretir (yol dışında adres, sorgu ya da kimlik içermez). */
export function buildReport(reason: unknown, path: string, ua: string): ErrorReport {
  const err = reason instanceof Error ? reason : null;
  const raw = err ? err.message : typeof reason === "string" ? reason : "Bilinmeyen hata";
  return {
    message: (raw || "Bilinmeyen hata").slice(0, MESSAGE_MAX),
    stack: (err?.stack ?? "").slice(0, STACK_MAX),
    url: path.split(/[?#]/)[0] ?? "/",
    version: APP_VERSION,
    ua: ua.slice(0, UA_MAX),
  };
}

let installed = false;

/** window 'error' ve 'unhandledrejection' dinleyicilerini kurar. Geliştirme önizlemesinde (mock) hiçbir şey yapmaz. */
export function installErrorReporting(): void {
  if (installed || typeof window === "undefined") return;
  if (import.meta.env.DEV) return;
  installed = true;
  const seen = new Set<string>();
  let sent = 0;
  const report = (reason: unknown): void => {
    if (sent >= MAX_REPORTS) return;
    const body = buildReport(reason, window.location.pathname, navigator.userAgent);
    const key = `${body.message}\n${body.stack.split("\n")[1] ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent += 1;
    try {
      void fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {
        // bildirim gitmediyse yapacak bir şey yok
      });
    } catch {
      // fetch yok ya da engelli
    }
  };
  window.addEventListener("error", (ev) => report(ev.error ?? ev.message));
  window.addEventListener("unhandledrejection", (ev) => report(ev.reason));
}
