/**
 * Üretim Merkezi uçları (`/api/uretim/*`; sözleşme `docs/uretim/SOZLESME.md` bölüm 3). Site oyunun içerik
 * havuzlarını ve yasaklı kelime listesini okur, tek tıkla ekler/kapatır (UM-İ8), aktarımı geri alır, mağaza
 * istatistiğini (MG-7, anonim ve toplu) okur.
 *
 * Güvenlik:
 * - Yalnız `GLIX_URETIM_TOKEN` doluysa açılır; boşsa bütün uçlar 404 (uç yokmuş gibi).
 * - `Authorization: Bearer <token>`; karşılaştırma sabit sürede (iki tarafın SHA-256 özeti `timingSafeEqual`).
 * - Uçlar sunucunun kendi ağından çağrılır: Caddy bu yolu dışarıya 404 ile kapatır; ayrıca vekilden geçmiş istek
 *   (`X-Forwarded-For` başlığı taşıyan) de 404 alır.
 * - Bir istekte en çok 500 satır; dakikada en çok 30 yazma isteği.
 * - Silme yoktur: ekleme ve kapatma; geri alma o aktarımın eklediklerini kaldırır, kapattıklarını açar.
 * - Yazmalar `admin_audit`'e `uretim` işleyicisiyle (hesap kimliği 0) düşer.
 * - Hiçbir yanıtta hesap kimliği, takma ad ya da e-posta yoktur.
 * - Oyun alanında (`GLIX_ORTAM=test2`, `oyunAlani` verilince) ek olarak mağaza taslak katmanı uçları açılır
 *   (`GET|POST /api/uretim/magaza/taslak`, `DELETE /api/uretim/magaza/taslak/:id`) ve sağlık yanıtı katman kimliğini
 *   taşır. Canlıda ve test'te bu uçlar yoktur (404) ve sağlık yanıtı değişmez.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  CONTENT_POOLS,
  COSMETIC_ITEMS,
  cleanBannedWord,
  dailyDeals,
  MODERATION_BUILTIN_PATTERNS,
  poolById,
  splitEquipped,
} from "@glix/engine";
import type { AccountStore, UretimTransferKind, UretimTransferRow } from "./accountStore.js";
import type { Clock } from "./clock.js";
import type { ContentStore } from "./contentStore.js";
import { splitLine } from "./contentStore.js";
import { log } from "./log.js";
import type { BannedWords } from "./moderation.js";
import { type OyunAlaniKatmani, TASLAK_GOVDE_EN_COK } from "./oyunAlani.js";
import { TokenBucket } from "./ratelimit.js";
import { SECURITY_HEADERS } from "./static.js";

export const URETIM_PREFIX = "/api/uretim";
/** Bir istekte en çok satır/anahtar/kalıp. */
export const URETIM_MAX_ROWS = 500;
/** Dakikada en çok yazma isteği. */
export const URETIM_WRITES_PER_MINUTE = 30;
/** İstek gövdesinin en çok boyu (bayt). */
export const URETIM_MAX_BODY = 1024 * 1024;
/** Mağaza istatistiğinin dönemi. */
export const URETIM_STATS_DAYS = 30;
/** İşlem kaydında Üretim Merkezi'nin "hesap" kimliği (gerçek hesap değildir). */
export const URETIM_AUDIT_ACTOR = 0;

const DAY_MS = 24 * 3600 * 1000;
const ISTANBUL_OFFSET_MS = 3 * 3600 * 1000;

export interface UretimEnv {
  /** Boş/null ise uçlar kapalı. */
  token: string | null;
  accounts: AccountStore;
  content: ContentStore;
  banned: BannedWords;
  clock: Clock;
  revision: string;
  /** Oyun alanı (test2) taslak katmanı; yoksa taslak uçları 404. */
  oyunAlani?: OyunAlaniKatmani | null;
}

type Reply = { status: number; body: unknown };
const reply = (status: number, body: unknown): Reply => ({ status, body });
const fail = (status: number, code: string, message: string): Reply =>
  reply(status, { ok: false, code, message });
const NOT_FOUND = fail(404, "not_found", "Bulunamadı.");

function send(res: ServerResponse, r: Reply): void {
  res.writeHead(r.status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(r.body));
}

const digest = (s: string): Buffer => createHash("sha256").update(s, "utf8").digest();

/** `Authorization: Bearer <token>` sabit sürede karşılaştırılır (uzunluk farkı da sızmaz: özetler eşit boyda). */
export function tokenMatches(header: string | undefined, token: string): boolean {
  const m = /^Bearer ([\x21-\x7e]{1,512})$/.exec(header ?? "");
  const given = digest(m?.[1] ?? "");
  const ok = timingSafeEqual(given, digest(token));
  return ok && m !== null;
}

function readBody(req: IncomingMessage, max = URETIM_MAX_BODY): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = (v: unknown): void => {
      if (done) return;
      done = true;
      resolve(v);
    };
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > max) {
        finish(undefined);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        finish(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      } catch {
        finish(undefined);
      }
    });
    req.on("error", () => finish(undefined));
  });
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const newTransferId = (now: number): string => {
  const d = new Date(now + ISTANBUL_OFFSET_MS).toISOString();
  return `${d.slice(0, 10).replaceAll("-", "")}-${randomBytes(6).toString("hex")}`;
};

/** Gövdedeki listeyi alır: dizi olmalı, 1..500 öğe. */
function listOf(data: unknown, key: string): unknown[] | Reply {
  if (!isRec(data) || !Array.isArray(data[key]))
    return fail(400, "invalid_input", `Gövde { ${key}: [...] } olmalı.`);
  const list = data[key];
  if (list.length === 0) return fail(400, "invalid_input", `${key} boş.`);
  if (list.length > URETIM_MAX_ROWS)
    return fail(413, "too_many_rows", `Bir istekte en çok ${URETIM_MAX_ROWS} satır.`);
  return list;
}

export function createUretimApi(env: UretimEnv): (req: IncomingMessage, res: ServerResponse) => void {
  const token = env.token?.trim() || null;
  const writes = new TokenBucket(env.clock, URETIM_WRITES_PER_MINUTE, URETIM_WRITES_PER_MINUTE / 60);
  const reads = new TokenBucket(env.clock, 120, 2);

  const audit = (action: string, detail: string): void => {
    try {
      env.accounts.adminAudit(URETIM_AUDIT_ACTOR, action, detail.slice(0, 300), env.clock.now(), null);
    } catch (err) {
      log.error("accounts_error", { op: "uretim_audit", error: String(err) });
    }
  };

  const record = (kind: UretimTransferKind, poolId: string | null, keys: string[]): string => {
    const now = env.clock.now();
    const id = newTransferId(now);
    env.accounts.uretimTransferInsert({ id, at: now, kind, poolId, keys, undoneAt: null });
    return id;
  };

  function pools(): Reply {
    const havuzlar = CONTENT_POOLS.map((p) => ({
      id: p.id,
      gameId: p.gameId,
      label: p.label,
      fields: p.fields.map((f) => ({ key: f.key, label: f.label, hint: f.hint, min: f.min, max: f.max })),
      kayitlar: (env.content.entries(p.id) ?? []).map((e) => ({
        anahtar: e.key,
        alanlar: e.fields,
        kaynak: e.source === "builtin" ? "yerlesik" : "panel",
        acik: !e.disabled,
      })),
    }));
    return reply(200, { havuzlar });
  }

  function poolAdd(poolId: string, data: unknown): Reply {
    const pool = poolById(poolId);
    if (!pool) return fail(404, "unknown_pool", "Havuz bulunamadı.");
    const list = listOf(data, "satirlar");
    if (!Array.isArray(list)) return list;
    const rows: Record<string, string>[] = [];
    const atlanan: { satir: number; neden: string }[] = [];
    const index: number[] = [];
    list.forEach((raw, i) => {
      let values: Record<string, string> | null = null;
      if (typeof raw === "string") values = raw.length > 2000 ? null : splitLine(pool, raw);
      else if (isRec(raw) && Object.values(raw).every((v) => typeof v === "string"))
        values = raw as Record<string, string>;
      if (values === null) {
        atlanan.push({ satir: i + 1, neden: `Alanlar: ${pool.fields.map((f) => f.key).join(", ")}.` });
        return;
      }
      index.push(i);
      rows.push(values);
    });
    const out = env.content.addRows(pool.id, rows, env.clock.now());
    if (!out) return fail(404, "unknown_pool", "Havuz bulunamadı.");
    for (const s of out.skipped) atlanan.push({ satir: (index[s.index] ?? 0) + 1, neden: s.reason });
    atlanan.sort((a, b) => a.satir - b.satir);
    const aktarimId = record("havuz-ekle", pool.id, out.added);
    audit("uretim_havuz_ekle", `${pool.id}:${out.added.length} aktarim=${aktarimId}`);
    return reply(200, { aktarimId, eklenen: out.added.length, atlanan });
  }

  function poolClose(poolId: string, data: unknown): Reply {
    const pool = poolById(poolId);
    if (!pool) return fail(404, "unknown_pool", "Havuz bulunamadı.");
    const list = listOf(data, "anahtarlar");
    if (!Array.isArray(list)) return list;
    const keys = list.filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= 600);
    const closed = env.content.disableKeys(pool.id, keys, env.clock.now()) ?? [];
    const aktarimId = record("havuz-kapat", pool.id, closed);
    audit("uretim_havuz_kapat", `${pool.id}:${closed.length} aktarim=${aktarimId}`);
    return reply(200, { aktarimId, kapatilan: closed.length });
  }

  function undo(id: string): Reply {
    if (!/^\d{8}-[0-9a-f]{12}$/.test(id)) return fail(404, "unknown_transfer", "Aktarım bulunamadı.");
    const t: UretimTransferRow | null = env.accounts.uretimTransferGet(id);
    if (!t) return fail(404, "unknown_transfer", "Aktarım bulunamadı.");
    if (t.undoneAt !== null) return fail(409, "already_undone", "Bu aktarım zaten geri alındı.");
    const now = env.clock.now();
    let ok = true;
    if (t.kind === "moderasyon-ekle") for (const w of t.keys) env.banned.remove(w);
    else if (t.poolId !== null)
      ok = env.content.revertTransfer(
        t.poolId,
        t.kind === "havuz-ekle" ? t.keys : [],
        t.kind === "havuz-kapat" ? t.keys : [],
        now,
      );
    if (!ok) return fail(500, "server_error", "Geri alınamadı, biraz sonra tekrar dene.");
    env.accounts.uretimTransferMarkUndone(t.id, now);
    audit("uretim_geri_al", `${t.kind}:${t.keys.length} aktarim=${t.id}`);
    return reply(200, { ok: true });
  }

  function moderation(): Reply {
    const kaliplar = [
      ...MODERATION_BUILTIN_PATTERNS.map((p) => ({ kalip: p.kalip, tur: p.tur, kaynak: "yerlesik" })),
      ...env.banned.list().map((w) => ({ kalip: w.word, tur: "kelime", kaynak: "panel" })),
    ];
    return reply(200, { kaliplar });
  }

  function moderationAdd(data: unknown): Reply {
    const list = listOf(data, "kaliplar");
    if (!Array.isArray(list)) return list;
    const added: string[] = [];
    const atlanan: { satir: number; neden: string }[] = [];
    const now = env.clock.now();
    list.forEach((raw, i) => {
      const word = typeof raw === "string" ? raw : isRec(raw) ? raw.kalip : undefined;
      const clean = cleanBannedWord(word);
      if (!clean) {
        atlanan.push({ satir: i + 1, neden: "Geçersiz kalıp (1-40 karakter, en az 2 harf)." });
        return;
      }
      const r = env.banned.add(clean.word, now);
      if (r === "ok") added.push(clean.word);
      else
        atlanan.push({
          satir: i + 1,
          neden: r === "exists" ? "Listede zaten var." : r === "full" ? "Liste dolu." : "Geçersiz kalıp.",
        });
    });
    const aktarimId = record("moderasyon-ekle", null, added);
    audit("uretim_moderasyon_ekle", `${added.length} aktarim=${aktarimId}`);
    return reply(200, { aktarimId, eklenen: added.length, atlanan });
  }

  function shopStats(): Reply {
    const now = env.clock.now();
    const raw = env.accounts.shopStats(now - URETIM_STATS_DAYS * DAY_MS);
    const sales = new Map<string, { satis: number; firsatSatis: number }>();
    const dealsOfDay = new Map<number, Map<string, number>>();
    for (const p of raw.purchases) {
      let deals = dealsOfDay.get(p.day);
      if (!deals) {
        // Günün ortası (İstanbul): o günün fırsatları.
        deals = new Map(
          dailyDeals(p.day * DAY_MS - ISTANBUL_OFFSET_MS + DAY_MS / 2).map((d) => [d.itemId, d.price]),
        );
        dealsOfDay.set(p.day, deals);
      }
      const s = sales.get(p.itemId) ?? { satis: 0, firsatSatis: 0 };
      s.satis += p.n;
      if (deals.get(p.itemId) === p.pricePaid) s.firsatSatis += p.n;
      sales.set(p.itemId, s);
    }
    const worn = new Map<string, number>();
    for (const e of raw.equipped) {
      const id = splitEquipped(e.value)?.id;
      if (id) worn.set(id, (worn.get(id) ?? 0) + e.n);
    }
    const urunler = COSMETIC_ITEMS.map((i) => ({
      id: i.id,
      satis: sales.get(i.id)?.satis ?? 0,
      kusanan: worn.get(i.id) ?? 0,
      firsatSatis: sales.get(i.id)?.firsatSatis ?? 0,
    }));
    return reply(200, { donem: `${URETIM_STATS_DAYS}g`, urunler });
  }

  const katman = env.oyunAlani ?? null;

  function taslaklar(k: OyunAlaniKatmani): Reply {
    return reply(200, {
      katman: k.kimlik,
      urunler: k
        .liste()
        .map((t) => ({ id: t.urun.id, urun: t.satir, dosyalar: Object.keys(t.dosyalar), zaman: t.zaman })),
    });
  }

  function taslakEkle(k: OyunAlaniKatmani, data: unknown): Reply {
    const r = k.ekle(data, env.clock.now());
    if (!r.ok) return reply(r.status, { ok: false, code: r.code, message: r.message, errors: r.errors });
    audit("uretim_taslak_ekle", `magaza:${r.id}`);
    return reply(200, { ok: true, id: r.id, katman: k.kimlik, degisti: r.degisti });
  }

  function taslakSil(k: OyunAlaniKatmani, id: string): Reply {
    const silindi = k.sil(id);
    if (silindi) audit("uretim_taslak_sil", `magaza:${id}`);
    return reply(200, { ok: true, silindi, katman: k.kimlik });
  }

  async function resolve(req: IncomingMessage): Promise<Reply> {
    if (!token) return NOT_FOUND;
    // Vekilden (Caddy) geçen istek dışarıdandır: uç yokmuş gibi.
    if (req.headers["x-forwarded-for"] !== undefined) return NOT_FOUND;
    if (!tokenMatches(req.headers.authorization, token))
      return fail(401, "unauthorized", "Anahtar geçersiz.");
    const path = ((req.url ?? "").split("?")[0] ?? "").slice(URETIM_PREFIX.length);
    const method = req.method ?? "GET";
    const parts = path.split("/").filter((p) => p.length > 0);
    const isWrite = method === "POST" || method === "DELETE";
    // DELETE yalnız oyun alanının taslak ucunda vardır; başka yerde uç yokmuş gibi (canlıda davranış aynı: 404).
    if (method === "DELETE" && !katman) return NOT_FOUND;
    if (method !== "GET" && method !== "POST" && method !== "DELETE")
      return fail(405, "method_not_allowed", "Bu istek desteklenmiyor.");
    if (!(isWrite ? writes : reads).take()) return fail(429, "rate_limited", "Çok hızlı; biraz bekle.");

    const [a, b, c] = parts;
    const taslakYolu = katman !== null && a === "magaza" && b === "taslak";
    if (method === "DELETE") {
      if (!taslakYolu || parts.length !== 3 || !katman) return NOT_FOUND;
      let id = "";
      try {
        id = decodeURIComponent(c ?? "");
      } catch {
        return NOT_FOUND;
      }
      return taslakSil(katman, id);
    }
    if (!isWrite) {
      if (taslakYolu && parts.length === 2 && katman) return taslaklar(katman);
      if (parts.length === 1 && a === "havuzlar") return pools();
      if (parts.length === 1 && a === "moderasyon") return moderation();
      if (parts.length === 2 && a === "magaza" && b === "istatistik") return shopStats();
      if (parts.length === 1 && a === "saglik")
        return reply(
          200,
          katman
            ? {
                ok: true,
                revision: env.revision,
                ortam: "test2",
                katman: katman.kimlik,
                taslak: katman.liste().length,
              }
            : { ok: true, revision: env.revision },
        );
      return NOT_FOUND;
    }
    if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json"))
      return fail(415, "invalid_input", "Gövde JSON olmalı.");
    // Havuz kimliği eğik çizgi taşır (`oyun/havuz`): ister kodlanmış (%2F) ister düz yazılsın.
    const last = parts.at(-1);
    const poolPath = a === "havuzlar" && (last === "ekle" || last === "kapat") ? parts.slice(1, -1) : null;
    if (taslakYolu && parts.length === 2 && katman) {
      const data = await readBody(req, TASLAK_GOVDE_EN_COK);
      if (data === undefined) return fail(400, "invalid_input", "Gövde okunamadı (JSON, en çok 18 MB).");
      return taslakEkle(katman, data);
    }
    const known =
      (poolPath !== null && poolPath.length >= 1 && poolPath.length <= 2) ||
      (parts.length === 3 && a === "aktarim" && c === "geri-al") ||
      (parts.length === 2 && a === "moderasyon" && b === "ekle");
    if (!known) return NOT_FOUND;
    const data = await readBody(req);
    if (data === undefined) return fail(400, "invalid_input", "Gövde okunamadı (JSON, en çok 1 MB).");
    let id = "";
    try {
      id = (poolPath ?? [b ?? ""]).map((x) => decodeURIComponent(x)).join("/");
    } catch {
      return NOT_FOUND;
    }
    if (poolPath !== null) return last === "ekle" ? poolAdd(id, data) : poolClose(id, data);
    if (a === "aktarim") return undo(id);
    return moderationAdd(data);
  }

  return (req, res) => {
    resolve(req)
      .then((r) => send(res, r))
      .catch((err: unknown) => {
        log.error("uretim_failed", { error: String(err) });
        if (!res.headersSent) send(res, fail(500, "server_error", "Bir sorun oluştu."));
        else res.end();
      });
  };
}
