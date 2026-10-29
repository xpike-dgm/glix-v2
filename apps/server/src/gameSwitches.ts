/**
 * Oyun anahtarları (U16 A3): yöneticinin "Açık/Kapalı" ve "Rastgele seçimde/Dışında" ayarlarının katalog ve odalara
 * etkisi. Motor değişmez; etkin katalog sunucuda bu ayarlarla süzülür (`Runtime.catalog`).
 */
import { GAMES, type GameInfo, getCatalog, isTaslakOyun } from "@glix/engine";
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
// Değiştirilebilir dizi: yalnız `taslak.ts` (açık geliştirme yolu) taslak oyunları ekler.
export const ENGINE_CATALOG: GameInfo[] = getCatalog();

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
    // Taslak oyun hiçbir ayarla rastgele havuza giremez (yönetici "Rastgele seçimde" dese bile).
    const inPool = isTaslakOyun(g.id) ? false : (o?.random ?? engineInPool(g));
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

/**
 * Açık oyunların kimlikleri: kayıtlı her oyun, yönetici kapatmadıysa açıktır. Kapalı = motor kataloğunda olup etkin
 * katalogdan düşmüş oyun. (Katalog açılışta hesaplanır; sonradan kaydedilen oyunlar — ör. testlerin sahte oyunları —
 * kapalı sayılmaz.)
 */
export function openIds(rt: Runtime): Set<string> {
  const listed = new Set(rt.catalog.map((g) => g.id));
  const closed = new Set(ENGINE_CATALOG.filter((g) => !listed.has(g.id)).map((g) => g.id));
  return new Set(Object.keys(GAMES).filter((id) => !closed.has(id)));
}

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
