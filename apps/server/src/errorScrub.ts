/**
 * İstemci hatasını kalıcı kayda çevirmeden önce temizler: adres sorgusu/parçası, e-posta, IP ve uzun belirteç benzeri
 * diziler atılır; metinler kısaltılır. Amaç: kayıtta kişiyi ya da oturumu işaret eden hiçbir şey kalmaması.
 */
import type { ClientErrorRecord } from "./statsStore.js";

export const MAX_STORED_MESSAGE = 200;
export const MAX_STORED_FRAME = 120;

/**
 * E-posta: `@`'tan sonra yalnız alan adı (harf/rakam/tire etiketleri, noktayla ayrılmış, harfli bir uzantıyla biten)
 * gelir. Safari/Firefox yığın karesi `işlev@https://alan/dosya.js:1:2` biçimindedir: `@`'tan sonra `https:` gelir,
 * alan adı kuralına uymaz ve maskelenmez (yığın okunur kalır).
 */
const EMAIL = /[^\s@"'<>()/:]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![A-Za-z0-9-]*:\/\/)/g;

/** Metindeki adreslerin sorgu (`?...`) ve parça (`#...`) kısmı atılır; e-posta, IPv4 ve uzun belirteçler maskelenir. */
export function scrubText(text: string, max = MAX_STORED_MESSAGE): string {
  return text
    .replace(/https?:\/\/[^\s"'<>)]+/gi, (url) => url.split(/[?#]/)[0] ?? "")
    .replace(EMAIL, "[e-posta]")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "[ip]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[belirteç]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** `ad:satır:sütun` biçiminde sonu olan konum; dosya adı yalnız taban ad (yol ve sorgu atılır). */
const LOCATION = /([^\s()@/\\]+):(\d+):(\d+)\)?\s*$/;

/**
 * Yığının tepe karesi. Chrome (`at işlev (adres:satır:sütun)`) ve Firefox/Safari (`işlev@adres:satır:sütun`)
 * biçimleri tanınır; bulunamazsa "-". Sonuç: `işlev dosya:satır:sütun`.
 */
export function topFrame(stack: string | null): string {
  if (!stack) return "-";
  for (const raw of stack.split("\n")) {
    const line = raw.trim();
    const loc = LOCATION.exec(line);
    if (!loc) continue;
    const chrome = /^at\s+(?:(.*?)\s+\()?/.exec(line);
    let fn = "";
    if (chrome) fn = chrome[1] ?? "";
    else if (line.includes("@")) fn = line.slice(0, line.indexOf("@"));
    else continue;
    const file = (loc[1] ?? "").split(/[?#]/)[0] ?? "";
    const frame = `${scrubText(fn, 40)} ${file}:${loc[2]}:${loc[3]}`.trim();
    return frame.slice(0, MAX_STORED_FRAME);
  }
  return "-";
}

/** Platform ve tarayıcı ailesi; ham kullanıcı aracısı saklanmaz. */
export function uaFamily(ua: string | null): Pick<ClientErrorRecord, "platform" | "browser"> {
  const u = ua ?? "";
  const platform = /iPhone|iPad|iPod/i.test(u) ? "ios" : /Android/i.test(u) ? "android" : "diger";
  let browser = "diger";
  if (/Edg(?:e|A|iOS)?\//.test(u)) browser = "edge";
  else if (/OPR\/|Opera/.test(u)) browser = "opera";
  else if (/SamsungBrowser/.test(u)) browser = "samsung";
  else if (/Firefox\/|FxiOS\//.test(u)) browser = "firefox";
  else if (/Chrome\/|CriOS\//.test(u)) browser = "chrome";
  else if (/Safari\//.test(u)) browser = "safari";
  return { platform, browser };
}

export function cleanVersion(version: string): string {
  return /^[\w.+-]{1,32}$/.test(version) ? version : "bilinmiyor";
}

export function toStoredError(report: {
  message: string;
  stack: string | null;
  version: string;
  ua: string | null;
}): ClientErrorRecord {
  return {
    message: scrubText(report.message) || "-",
    frame: topFrame(report.stack),
    ...uaFamily(report.ua),
    version: cleanVersion(report.version),
  };
}
