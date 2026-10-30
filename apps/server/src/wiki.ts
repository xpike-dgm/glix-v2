/**
 * Oyun ansiklopedisi (wiki) uçları, `/api/admin/wiki/...`: içerik (oyun dosyaları ve ekran görüntüleri) ve yöneticinin
 * bıraktığı notlar. Erişim denetimi yönetici uçlarıyla aynıdır (admin.ts buraya yalnız doğrulanmış yöneticiyi yollar).
 * İçerik `WIKI_DIR` klasöründedir: `sira.json` (oyun sırası), `oyunlar/<id>.json`, `ekran/<ad>.webp`.
 */
import { readdir, readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import {
  isWikiFeedbackSection,
  isWikiFeedbackStatus,
  WIKI_FEEDBACK_TEXT_MAX,
  WIKI_IMAGE_MAX_BYTES,
  WIKI_IMAGE_TYPES,
  type WikiBox,
  type WikiImageType,
} from "@glix/engine";
import { send } from "./auth.js";
import type { WikiFeedbackInput, WikiStore } from "./wikiStore.js";

export const WIKI_GET_ROUTES = ["wiki/data", "wiki/image", "wiki/feedback", "wiki/feedback/image"] as const;
export const WIKI_POST_ROUTES = [
  "wiki/feedback/add",
  "wiki/feedback/status",
  "wiki/feedback/delete",
] as const;
export type WikiRoute = (typeof WIKI_GET_ROUTES)[number] | (typeof WIKI_POST_ROUTES)[number];

/** Görselli not gövdesi (base64 dahil) en çok bu kadar bayt. */
const MAX_ADD_BODY = Math.ceil((WIKI_IMAGE_MAX_BYTES * 4) / 3) + 8192;
const MAX_SMALL_BODY = 256;
const NAME = /^[a-z0-9][a-z0-9-]{0,99}$/;

export interface WikiEnv {
  /** İçerik klasörü; yoksa uçlar 404 verir. */
  dir: string | null;
  store: WikiStore;
  now: number;
  /** Yönetici başına yazma hız sınırı. */
  allowWrite: () => boolean;
}

function fail(res: ServerResponse, status: number, code: string, message: string): void {
  send(res, status, { ok: false, code, message });
}

function readBody(req: IncomingMessage, max: number): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = (value: unknown): void => {
      if (done) return;
      done = true;
      resolve(value);
    };
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > max) {
        finish(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", () => finish(null));
    req.on("end", () => {
      try {
        finish(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        finish(null);
      }
    });
  });
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Not metni: denetim karakteri yok (satır sonu serbest), kırpılmış, 1..üst sınır karakter. */
export function cleanWikiText(v: unknown): string | null {
  if (typeof v !== "string" || v.length > WIKI_FEEDBACK_TEXT_MAX * 4) return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: denetim karakterleri bilerek reddedilir
  if (/[\u0000-\u0009\u000b-\u001f\u007f‪-‮⁦-⁩]/u.test(v.replace(/\r\n/g, "\n"))) return null;
  const clean = v
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const n = Array.from(clean).length;
  return n >= 1 && n <= WIKI_FEEDBACK_TEXT_MAX ? clean : null;
}

const unit = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

export function parseBox(v: unknown): WikiBox | null {
  if (!isRecord(v)) return null;
  const { x, y, w, h } = v;
  if (!unit(x) || !unit(y) || !unit(w) || !unit(h)) return null;
  if (w <= 0 || h <= 0 || x + w > 1.0001 || y + h > 1.0001) return null;
  const r = (n: number) => Math.round(n * 10000) / 10000;
  return { x: r(x), y: r(y), w: r(w), h: r(h) };
}

/** Görselin ilk baytları bildirilen türle uyuşmalı. */
export function imageMatches(type: WikiImageType, b: Uint8Array): boolean {
  const at = (i: number, ...bytes: number[]) => bytes.every((x, k) => b[i + k] === x);
  if (type === "image/png") return at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (type === "image/jpeg") return at(0, 0xff, 0xd8, 0xff);
  return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50);
}

async function gameIds(dir: string): Promise<string[]> {
  const raw: unknown = JSON.parse(await readFile(join(dir, "sira.json"), "utf8"));
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && NAME.test(x)) : [];
}

async function screenNames(dir: string): Promise<string[]> {
  try {
    return (await readdir(join(dir, "ekran")))
      .filter((f) => f.endsWith(".webp"))
      .map((f) => f.slice(0, -5))
      .filter((n) => NAME.test(n))
      .sort();
  } catch {
    return [];
  }
}

/** Gövdeyi ayrıştırır; geçersizse null. Oyun ve ekran adları içerik klasöründe olmalı. */
export async function parseAdd(data: unknown, dir: string): Promise<WikiFeedbackInput | null> {
  if (!isRecord(data)) return null;
  const allowed = new Set(["gameId", "section", "text", "screen", "box", "image"]);
  if (Object.keys(data).some((k) => !allowed.has(k))) return null;
  const { gameId, section, text, screen, box, image } = data;
  if (typeof gameId !== "string" || !NAME.test(gameId) || !(await gameIds(dir)).includes(gameId)) return null;
  if (!isWikiFeedbackSection(section)) return null;
  const clean = cleanWikiText(text);
  if (clean === null) return null;
  let screenName: string | null = null;
  let parsedBox: WikiBox | null = null;
  if (screen !== undefined && screen !== null) {
    if (typeof screen !== "string" || !NAME.test(screen) || !(await screenNames(dir)).includes(screen))
      return null;
    screenName = screen;
  }
  if (box !== undefined && box !== null) {
    parsedBox = parseBox(box);
    if (!parsedBox || !screenName) return null;
  }
  let img: WikiFeedbackInput["image"] = null;
  if (image !== undefined && image !== null) {
    if (!isRecord(image) || typeof image.data !== "string") return null;
    const type = image.type;
    if (!(WIKI_IMAGE_TYPES as readonly unknown[]).includes(type)) return null;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)) return null;
    const bytes = new Uint8Array(Buffer.from(image.data, "base64"));
    if (bytes.length < 16 || bytes.length > WIKI_IMAGE_MAX_BYTES) return null;
    if (!imageMatches(type as WikiImageType, bytes)) return null;
    img = { type: type as WikiImageType, data: bytes };
  }
  return { gameId, section, text: clean, screen: screenName, box: parsedBox, image: img };
}

const parseId = (v: unknown): number | null =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : null;

function sendBytes(res: ServerResponse, type: string, data: Uint8Array): void {
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": data.byteLength,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
  res.end(data);
}

export async function handleWiki(
  req: IncomingMessage,
  res: ServerResponse,
  env: WikiEnv,
  name: WikiRoute,
  query: URLSearchParams,
): Promise<void> {
  const dir = env.dir;
  if (!dir) return fail(res, 404, "not_found", "Bulunamadı");
  switch (name) {
    case "wiki/data": {
      const ids = await gameIds(dir);
      const games: unknown[] = [];
      for (const id of ids) {
        try {
          const g: unknown = JSON.parse(await readFile(join(dir, "oyunlar", `${id}.json`), "utf8"));
          if (isRecord(g) && g.id === id) games.push(g);
        } catch {
          // Eksik ya da bozuk oyun dosyası atlanır; diğerleri gösterilir.
        }
      }
      return send(res, 200, { games, screens: await screenNames(dir) });
    }
    case "wiki/image": {
      const f = query.get("f");
      if (!f || !NAME.test(f)) return fail(res, 404, "not_found", "Bulunamadı");
      let data: Buffer;
      try {
        data = await readFile(join(dir, "ekran", `${f}.webp`));
      } catch {
        return fail(res, 404, "not_found", "Bulunamadı");
      }
      return sendBytes(res, "image/webp", data);
    }
    case "wiki/feedback":
      return send(res, 200, { items: env.store.wikiFeedbackList() });
    case "wiki/feedback/image": {
      const id = Number(query.get("id"));
      const img = Number.isSafeInteger(id) && id > 0 ? env.store.wikiFeedbackImage(id) : null;
      if (!img) return fail(res, 404, "not_found", "Bulunamadı");
      return sendBytes(res, img.type, img.data);
    }
    default:
      break;
  }
  if (!env.allowWrite()) return fail(res, 429, "rate_limited", "Çok hızlı. Biraz bekle.");
  if (name === "wiki/feedback/add") {
    const input = await parseAdd(await readBody(req, MAX_ADD_BODY), dir);
    if (!input) return fail(res, 400, "bad_request", "Not kaydedilemedi: bilgiler eksik ya da hatalı.");
    const id = env.store.wikiFeedbackAdd(input, env.now);
    if (id === null) return fail(res, 409, "full", "Not kutusu dolu. Eski notları sil.");
    return send(res, 200, { ok: true, id });
  }
  const body = await readBody(req, MAX_SMALL_BODY);
  if (!isRecord(body)) return fail(res, 400, "bad_request", "Geçersiz istek.");
  const id = parseId(body.id);
  if (id === null) return fail(res, 400, "bad_request", "Geçersiz istek.");
  if (name === "wiki/feedback/status") {
    if (!isWikiFeedbackStatus(body.status) || Object.keys(body).length !== 2)
      return fail(res, 400, "bad_request", "Geçersiz istek.");
    if (!env.store.wikiFeedbackStatus(id, body.status, env.now))
      return fail(res, 404, "not_found", "Not bulunamadı.");
    return send(res, 200, { ok: true });
  }
  if (Object.keys(body).length !== 1) return fail(res, 400, "bad_request", "Geçersiz istek.");
  if (!env.store.wikiFeedbackDelete(id)) return fail(res, 404, "not_found", "Not bulunamadı.");
  return send(res, 200, { ok: true });
}
