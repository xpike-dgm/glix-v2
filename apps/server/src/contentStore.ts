/**
 * İçerik havuzu deposu (U16 A4): yöneticinin yerleşik girdileri kapatması, yeni girdi eklemesi ve düzenlemesi.
 * Değişiklikler `content_overrides` tablosundadır. Etkin havuz bellekte kurulur; yeni maç başlarken `forGame` ile
 * `GameContext.content`'e verilir. Süren maçlar kurulumda çektiğini durumunda taşıdığı için etkilenmez.
 */
import { createHash } from "node:crypto";
import {
  type AdminPoolBulk,
  type AdminPoolEntry,
  type AdminPoolFilter,
  type AdminPoolLine,
  type AdminPoolPage,
  type AdminPoolSummary,
  type AnyPool,
  CONTENT_POOLS,
  type ContentSet,
  dedupeKey,
  GAMES,
  parseEntry,
  poolById,
} from "@glix/engine";
import type { AccountStore, ContentOverrideOp } from "./accountStore.js";
import { log } from "./log.js";
import type { BannedWords } from "./moderation.js";

/** Havuz başına en çok eklenen girdi. */
export const CONTENT_CUSTOM_MAX = 1000;
export const POOL_PAGE_SIZE = 25;
/** Toplu eklemede tek istekte en çok satır ve satır uzunluğu (karakter). */
export const BULK_MAX_LINES = 200;
export const BULK_MAX_LINE_LENGTH = 300;

export type PoolFail = {
  ok: false;
  code: "unknown_pool" | "not_found" | "invalid" | "exists" | "banned" | "full" | "unchanged" | "builtin";
  message: string;
};
export type PoolResult = { ok: true; id: string } | PoolFail;

export interface ContentStore {
  summaries(): AdminPoolSummary[];
  summary(poolId: string): AdminPoolSummary | null;
  page(poolId: string, q: string, filter: AdminPoolFilter, page: number): AdminPoolPage | null;
  toggle(poolId: string, key: string, disabled: boolean, now: number): PoolResult;
  add(poolId: string, fields: Record<string, string>, now: number): PoolResult;
  edit(poolId: string, key: string, fields: Record<string, string>, now: number): PoolResult;
  remove(poolId: string, key: string): PoolResult;
  /** Satırları doğrular (yazmaz); havuz yoksa null. */
  check(poolId: string, lines: readonly string[]): AdminPoolBulk | null;
  /** Geçerli satırları kaydeder. */
  bulk(poolId: string, lines: readonly string[], now: number): AdminPoolBulk | null;
  /** Yeni maç için etkin havuzlar (yalnız değiştirilmiş ve yeterli boyda olanlar); yoksa undefined. */
  forGame(gameId: string): ContentSet | undefined;
}

/** Testler ve içeriksiz kurulum: hiçbir havuz değişmez. */
export const noContent: ContentStore = {
  summaries: () => [],
  summary: () => null,
  page: () => null,
  toggle: () => ({ ok: false, code: "unknown_pool", message: "Havuz bulunamadı." }),
  add: () => ({ ok: false, code: "unknown_pool", message: "Havuz bulunamadı." }),
  edit: () => ({ ok: false, code: "unknown_pool", message: "Havuz bulunamadı." }),
  remove: () => ({ ok: false, code: "unknown_pool", message: "Havuz bulunamadı." }),
  check: () => null,
  bulk: () => null,
  forGame: () => undefined,
};

/** İşlem kaydı için girdi tanıtıcısı: metin yazılmaz, anahtarın kısa özeti yazılır. */
export const entryTag = (key: string): string => createHash("sha256").update(key).digest("hex").slice(0, 8);

const UNKNOWN: PoolFail = { ok: false, code: "unknown_pool", message: "Havuz bulunamadı." };

interface Custom {
  key: string;
  entry: unknown;
  fields: Record<string, string>;
  createdAt: number;
}

interface PoolState {
  /** Kapatılan yerleşik anahtarlar. */
  disabled: Set<string>;
  customs: Custom[];
  /** Bu havuz için herhangi bir kayıt var mı (kapatma ya da ekleme). */
  touched: boolean;
}

/** Satırı alan değerlerine böler: tek alanlıda satırın kendisi, çok alanlıda `;` ya da sekmeyle ayrılmış parçalar. */
export function splitLine(pool: AnyPool, line: string): Record<string, string> | null {
  const keys = pool.fields.map((f) => f.key);
  if (keys.length === 1) return { [keys[0] as string]: line };
  const out: Record<string, string> = {};
  let rest = line;
  for (let i = 0; i < keys.length - 1; i++) {
    const at = rest.search(/[;\t]/);
    if (at < 0) return null;
    out[keys[i] as string] = rest.slice(0, at);
    rest = rest.slice(at + 1);
  }
  out[keys[keys.length - 1] as string] = rest;
  return out;
}

export function createContentStore(accounts: AccountStore, banned: BannedWords): ContentStore {
  const states = new Map<string, PoolState>();
  const builtinKeys = new Map<string, Map<string, unknown>>();
  for (const p of CONTENT_POOLS) {
    const m = new Map<string, unknown>();
    for (const e of p.builtin) m.set(p.key(e), e);
    builtinKeys.set(p.id, m);
  }
  let cache = new Map<string, ContentSet | undefined>();

  function load(): void {
    states.clear();
    cache = new Map();
    for (const p of CONTENT_POOLS) states.set(p.id, { disabled: new Set(), customs: [], touched: false });
    let rows: ReturnType<AccountStore["contentOverrides"]> = [];
    try {
      rows = accounts.contentOverrides();
    } catch (err) {
      log.error("accounts_error", { op: "content_overrides", error: String(err) });
    }
    for (const r of rows) {
      const pool = poolById(r.poolId);
      const st = states.get(r.poolId);
      if (!pool || !st) continue;
      st.touched = true;
      if (r.action === "disable") {
        st.disabled.add(r.key);
        continue;
      }
      let raw: unknown;
      try {
        raw = r.value === null ? null : JSON.parse(r.value);
      } catch {
        continue;
      }
      const entry = parseEntry(pool, raw);
      if (entry === null) continue;
      st.customs.push({ key: pool.key(entry), entry, fields: pool.toFields(entry), createdAt: r.createdAt });
    }
  }
  load();

  /** Yerleşik açık + eklenen girdiler (aynı anahtar tekrar etmez). */
  function effective(pool: AnyPool): unknown[] {
    const st = states.get(pool.id) as PoolState;
    const out: unknown[] = [];
    const seen = new Set<string>();
    for (const e of pool.builtin) {
      const k = pool.key(e);
      if (st.disabled.has(k)) continue;
      out.push(e);
      seen.add(k);
    }
    for (const c of st.customs) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      out.push(c.entry);
    }
    return out;
  }

  /** Etkin anahtarlar; `except` verilen anahtar sayılmaz (düzenlenen girdi kendisiyle çakışmasın). */
  function activeKeys(pool: AnyPool, except?: string): Set<string> {
    const st = states.get(pool.id) as PoolState;
    const keys = new Set<string>();
    for (const e of pool.builtin) {
      const k = pool.key(e);
      if (!st.disabled.has(k)) keys.add(k);
    }
    for (const c of st.customs) keys.add(c.key);
    if (except !== undefined) keys.delete(except);
    return keys;
  }

  function summarize(pool: AnyPool): AdminPoolSummary {
    const st = states.get(pool.id) as PoolState;
    const active = effective(pool).length;
    const builtinDisabled = pool.builtin.filter((e) => st.disabled.has(pool.key(e))).length;
    return {
      id: pool.id,
      gameId: pool.gameId,
      gameName: GAMES[pool.gameId]?.name ?? pool.gameId,
      label: pool.label,
      hint: pool.hint,
      fields: pool.fields.map((f) => ({
        key: f.key,
        label: f.label,
        hint: f.hint,
        min: f.min,
        max: f.max,
        long: f.long === true,
      })),
      min: pool.min,
      needed: pool.needed,
      builtin: pool.builtin.length,
      custom: st.customs.length,
      disabled: builtinDisabled,
      active,
      applied: st.touched && active >= pool.min,
      belowMin: st.touched && active < pool.min,
    };
  }

  function persist(ops: ContentOverrideOp[], now: number): boolean {
    try {
      accounts.contentOverrideBatch(ops, now);
    } catch (err) {
      log.error("accounts_error", { op: "content_write", error: String(err) });
      return false;
    }
    load();
    return true;
  }

  const writeFailed: PoolFail = {
    ok: false,
    code: "invalid",
    message: "Kaydedilemedi. Biraz sonra tekrar dene.",
  };

  /** Alan değerlerini doğrular, yasaklı kelime ve tekrar denetimini yapar. */
  function vet(
    pool: AnyPool,
    values: Record<string, string>,
    taken: ReadonlySet<string>,
  ): { ok: true; entry: unknown; key: string } | PoolFail {
    const parsed = pool.fromFields(values);
    if (!parsed.ok) return { ok: false, code: "invalid", message: parsed.error };
    const fields = pool.toFields(parsed.entry);
    for (const text of Object.values(fields)) {
      if (banned.matches(text))
        return { ok: false, code: "banned", message: "Yasaklı kelime listesine takılıyor." };
    }
    const key = pool.key(parsed.entry);
    if (taken.has(key)) return { ok: false, code: "exists", message: "Bu girdi havuzda zaten var." };
    return { ok: true, entry: parsed.entry, key };
  }

  const putAdd = (pool: AnyPool, key: string, entry: unknown): ContentOverrideOp => ({
    op: "put",
    poolId: pool.id,
    key,
    action: "add",
    value: JSON.stringify(entry),
  });

  function evaluate(
    pool: AnyPool,
    lines: readonly string[],
  ): { lines: AdminPoolLine[]; adds: { key: string; entry: unknown }[] } {
    const st = states.get(pool.id) as PoolState;
    const taken = activeKeys(pool);
    const out: AdminPoolLine[] = [];
    const adds: { key: string; entry: unknown }[] = [];
    let room = CONTENT_CUSTOM_MAX - st.customs.length;
    lines.forEach((raw, i) => {
      if (raw.trim() === "") return;
      const line = i + 1;
      const values = raw.length > BULK_MAX_LINE_LENGTH ? null : splitLine(pool, raw);
      if (values === null) {
        const message =
          raw.length > BULK_MAX_LINE_LENGTH
            ? "Satır çok uzun."
            : `Alanlar ";" ile ayrılmalı: ${pool.fields.map((f) => f.label).join("; ")}.`;
        out.push({ line, status: "invalid", message, fields: {} });
        return;
      }
      const v = vet(pool, values, taken);
      if (!v.ok) {
        const status = v.code === "exists" ? "duplicate" : v.code === "banned" ? "banned" : "invalid";
        out.push({ line, status, message: v.message, fields: values });
        return;
      }
      if (room <= 0) {
        out.push({
          line,
          status: "full",
          message: `Havuz dolu (en çok ${CONTENT_CUSTOM_MAX} eklenen girdi).`,
          fields: values,
        });
        return;
      }
      room -= 1;
      taken.add(v.key);
      adds.push({ key: v.key, entry: v.entry });
      out.push({ line, status: "ok", message: "", fields: pool.toFields(v.entry) });
    });
    return { lines: out, adds };
  }

  return {
    summaries: () => CONTENT_POOLS.map(summarize),
    summary: (id) => {
      const p = poolById(id);
      return p ? summarize(p) : null;
    },
    page(poolId, q, filter, page) {
      const pool = poolById(poolId);
      if (!pool) return null;
      const st = states.get(pool.id) as PoolState;
      const all: AdminPoolEntry[] = [];
      const seen = new Set<string>();
      for (const e of pool.builtin) {
        const key = pool.key(e);
        seen.add(key);
        all.push({ key, source: "builtin", disabled: st.disabled.has(key), fields: pool.toFields(e) });
      }
      for (const c of st.customs)
        all.push({ key: c.key, source: "custom", disabled: false, fields: c.fields });
      const needle = dedupeKey(q);
      const rows = all.filter((e) => {
        if (filter === "builtin" && e.source !== "builtin") return false;
        if (filter === "custom" && e.source !== "custom") return false;
        if (filter === "disabled" && !e.disabled) return false;
        if (needle === "") return true;
        return Object.values(e.fields).some((t) => dedupeKey(t).includes(needle));
      });
      const pages = Math.max(1, Math.ceil(rows.length / POOL_PAGE_SIZE));
      const at = Math.min(Math.max(1, page), pages);
      return {
        pool: summarize(pool),
        entries: rows.slice((at - 1) * POOL_PAGE_SIZE, at * POOL_PAGE_SIZE),
        total: rows.length,
        page: at,
        pageSize: POOL_PAGE_SIZE,
      };
    },
    toggle(poolId, key, disabled, now) {
      const pool = poolById(poolId);
      if (!pool) return UNKNOWN;
      const st = states.get(pool.id) as PoolState;
      if (!builtinKeys.get(pool.id)?.has(key))
        return { ok: false, code: "builtin", message: "Yalnız hazır girdiler kapatılıp açılabilir." };
      if (disabled === st.disabled.has(key))
        return {
          ok: false,
          code: "unchanged",
          message: disabled ? "Girdi zaten kapalı." : "Girdi zaten açık.",
        };
      if (!disabled && st.customs.some((c) => c.key === key))
        return { ok: false, code: "exists", message: "Aynı girdi eklenenler arasında var; önce onu sil." };
      const op: ContentOverrideOp = disabled
        ? { op: "put", poolId: pool.id, key, action: "disable", value: null }
        : { op: "delete", poolId: pool.id, key, action: "disable" };
      return persist([op], now) ? { ok: true, id: entryTag(key) } : writeFailed;
    },
    add(poolId, fields, now) {
      const pool = poolById(poolId);
      if (!pool) return UNKNOWN;
      const st = states.get(pool.id) as PoolState;
      if (st.customs.length >= CONTENT_CUSTOM_MAX)
        return {
          ok: false,
          code: "full",
          message: `Havuz dolu (en çok ${CONTENT_CUSTOM_MAX} eklenen girdi).`,
        };
      const v = vet(pool, fields, activeKeys(pool));
      if (!v.ok) return v;
      return persist([putAdd(pool, v.key, v.entry)], now) ? { ok: true, id: entryTag(v.key) } : writeFailed;
    },
    edit(poolId, key, fields, now) {
      const pool = poolById(poolId);
      if (!pool) return UNKNOWN;
      const st = states.get(pool.id) as PoolState;
      const custom = st.customs.find((c) => c.key === key);
      const isBuiltin = builtinKeys.get(pool.id)?.has(key) === true;
      if (!custom && !isBuiltin) return { ok: false, code: "not_found", message: "Girdi bulunamadı." };
      const v = vet(pool, fields, activeKeys(pool, key));
      if (!v.ok) return v;
      const ops: ContentOverrideOp[] = [];
      if (custom) {
        const same = JSON.stringify(pool.toFields(v.entry)) === JSON.stringify(custom.fields);
        if (same) return { ok: false, code: "unchanged", message: "Değişiklik yok." };
        ops.push({ op: "delete", poolId: pool.id, key, action: "add" });
      } else {
        const original = builtinKeys.get(pool.id)?.get(key);
        if (JSON.stringify(pool.toFields(v.entry)) === JSON.stringify(pool.toFields(original)))
          return { ok: false, code: "unchanged", message: "Değişiklik yok." };
        ops.push({ op: "put", poolId: pool.id, key, action: "disable", value: null });
      }
      ops.push(putAdd(pool, v.key, v.entry));
      return persist(ops, now) ? { ok: true, id: entryTag(v.key) } : writeFailed;
    },
    remove(poolId, key) {
      const pool = poolById(poolId);
      if (!pool) return UNKNOWN;
      const st = states.get(pool.id) as PoolState;
      if (!st.customs.some((c) => c.key === key)) {
        const builtin = builtinKeys.get(pool.id)?.has(key) === true;
        return builtin
          ? { ok: false, code: "builtin", message: "Hazır girdi silinmez; kapatabilirsin." }
          : { ok: false, code: "not_found", message: "Girdi bulunamadı." };
      }
      return persist([{ op: "delete", poolId: pool.id, key, action: "add" }], 0)
        ? { ok: true, id: entryTag(key) }
        : writeFailed;
    },
    check(poolId, lines) {
      const pool = poolById(poolId);
      if (!pool) return null;
      const ev = evaluate(pool, lines);
      return { lines: ev.lines, ok: ev.adds.length, added: 0, pool: summarize(pool) };
    },
    bulk(poolId, lines, now) {
      const pool = poolById(poolId);
      if (!pool) return null;
      const ev = evaluate(pool, lines);
      let added = 0;
      if (
        ev.adds.length > 0 &&
        persist(
          ev.adds.map((a) => putAdd(pool, a.key, a.entry)),
          now,
        )
      )
        added = ev.adds.length;
      return { lines: ev.lines, ok: ev.adds.length, added, pool: summarize(pool) };
    },
    forGame(gameId) {
      if (cache.has(gameId)) return cache.get(gameId);
      const set: Record<string, readonly unknown[]> = {};
      for (const pool of CONTENT_POOLS) {
        if (pool.gameId !== gameId) continue;
        const st = states.get(pool.id) as PoolState;
        if (!st.touched) continue;
        const list = effective(pool);
        // Yetersiz havuz uygulanmaz: oyun yerleşik havuzla devam eder (panel uyarır).
        if (list.length >= pool.min) set[pool.id] = list;
      }
      const result = Object.keys(set).length > 0 ? set : undefined;
      cache.set(gameId, result);
      return result;
    },
  };
}
