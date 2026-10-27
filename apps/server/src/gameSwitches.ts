/**
 * Oyun anahtarları (U16 A3): yöneticinin "Açık/Kapalı" ve "Rastgele seçimde/Dışında" ayarlarının katalog ve odalara
 * etkisi. Motor değişmez; etkin katalog sunucuda bu ayarlarla süzülür (`Runtime.catalog`).
 */
import { GAMES, type GameInfo, getCatalog } from "@glix/engine";
import type { Room, Runtime } from "./runtime.js";

/** Bir oyunun yönetici ayarı. Yalnız varsayılandan farklı olanlar saklanır. */
export interface GameOverride {
  /** `false`: oyun kapalı. Yoksa açık. */
  open?: false;
  /** Rastgele havuz üyeliği; motorun `randomPool` varsayılanını iki yönde de ezer. Yoksa motor varsayılanı. */
  random?: boolean;
}

export type GameOverrides = Readonly<Record<string, GameOverride>>;

/** Motorun tanımladığı tüm oyunlar (kapalı olanlar dahil); ad aramaları için. */
export const ENGINE_CATALOG: readonly GameInfo[] = getCatalog();

/** Oyunun motor varsayılanı rastgele havuzda mı. */
export const engineInPool = (g: GameInfo): boolean => g.randomPool !== false;

/** Oyunun adı (kapalı olsa da); bilinmiyorsa null. */
export const gameNameOf = (id: string): string | null => GAMES[id]?.name ?? null;

/**
 * Etkin katalog: kapalı oyunlar çıkar; `randomPool` yönetici ayarına göre yazılır (havuzdaysa alan hiç olmaz,
 * dışındaysa `false`).
 */
export function effectiveCatalog(
  overrides: GameOverrides,
  base: readonly GameInfo[] = ENGINE_CATALOG,
): GameInfo[] {
  const out: GameInfo[] = [];
  for (const g of base) {
    const o = overrides[g.id];
    if (o?.open === false) continue;
    const inPool = o?.random ?? engineInPool(g);
    const { randomPool: _engine, ...rest } = g;
    out.push(inPool ? rest : { ...rest, randomPool: false });
  }
  return out;
}

/** Bu odanın görmesi gereken katalog: süren maçtaki kapalı oyunlar da (sonuç ekranları adı bulabilsin) eklenir. */
export function catalogFor(rt: Runtime, room: Room): GameInfo[] {
  const match = room.match;
  if (!match) return rt.catalog;
  const extra = ENGINE_CATALOG.filter(
    (g) => match.games.some((m) => m.id === g.id) && !rt.catalog.some((c) => c.id === g.id),
  );
  return extra.length === 0 ? rt.catalog : [...rt.catalog, ...extra];
}

/** Kataloğu açık oyunların kimlikleri olarak verir. */
export const openIds = (rt: Runtime): Set<string> => new Set(rt.catalog.map((g) => g.id));

/**
 * Lobideki odanın seçiminden kapalı oyunları çıkarır; çıkarılan varsa odadakilere kısa bir bilgi gider.
 * Lobi dışındaki odaya dokunmaz (süren maç normal biter; lobiye dönünce `clearMatch` yeniden çağırır).
 */
export function pruneClosedGames(rt: Runtime, room: Room): string[] {
  if (room.phase !== "lobby" || room.gameIds.length === 0) return [];
  const open = openIds(rt);
  const removed = room.gameIds.filter((id) => !open.has(id));
  if (removed.length === 0) return [];
  room.gameIds = room.gameIds.filter((id) => open.has(id));
  const names = removed.map((id) => gameNameOf(id) ?? id);
  const text =
    names.length === 1
      ? `${names[0]} şu an kapalı, seçimden çıkarıldı.`
      : `${names.join(", ")} şu an kapalı, seçimden çıkarıldı.`;
  for (const p of room.players.values()) p.conn?.send({ type: "lobbyNotice", text });
  rt.broadcaster.markDirty(room);
  return removed;
}
