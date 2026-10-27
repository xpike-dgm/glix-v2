import type { ContentPool } from "../content.js";
import { CAGRISIM_POOL } from "./cagrisim-agi/pool.js";
import { KARALAMA_POOL } from "./karalama-defteri/pool.js";
import { LAF_POOL_LIST } from "./laf-sokma/pool.js";
import { SIZMA_POOL } from "./sizma/pool.js";
import { SOZLUK_POOL } from "./sozluk-blofu/pool.js";

// biome-ignore lint/suspicious/noExplicitAny: kayıt defteri farklı girdi tiplerindeki havuzları birlikte tutar.
export type AnyPool = ContentPool<any>;

/** Yöneticinin düzenleyebildiği tüm içerik havuzları (panel sırası). */
export const CONTENT_POOLS: readonly AnyPool[] = [
  SOZLUK_POOL,
  CAGRISIM_POOL,
  SIZMA_POOL,
  KARALAMA_POOL,
  ...LAF_POOL_LIST,
];

export function poolById(id: string): AnyPool | null {
  return CONTENT_POOLS.find((p) => p.id === id) ?? null;
}
