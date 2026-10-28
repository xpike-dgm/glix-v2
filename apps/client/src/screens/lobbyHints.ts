import {
  type CardSettings,
  DEFAULT_CARD_SETTINGS,
  enabledCards,
  type GameInfo,
  type JoinPolicy,
  type RoomSnapshot,
} from "@glix/engine";

/**
 * Başlamak için gereken en az oyuncu sayısı, gerçek oyun listesinden hesaplanır.
 * Rastgele modda en küçük alt sınırlı oyun yeter; el ile modda seçilenlerin en büyük alt sınırı gerekir.
 */
export function minPlayersNeeded(
  catalog: readonly GameInfo[],
  mode: "random" | "manual",
  selected: readonly GameInfo[],
): number {
  const pool = mode === "random" || selected.length === 0 ? catalog.filter(inRandomPool) : selected;
  if (pool.length === 0) return 1;
  const mins = pool.map((g) => g.minPlayers);
  return mode === "random" || selected.length === 0 ? Math.min(...mins) : Math.max(...mins);
}

/** Oyun rastgele seçime girer mi (`randomPool: false` olanlar yalnız elle seçilir). */
export const inRandomPool = (g: GameInfo): boolean => g.randomPool !== false;

/** "Bir arkadaş daha" / "N arkadaş daha gelince başlayabilirsin". */
export function friendsHint(missing: number): string {
  return missing <= 1
    ? "Bir arkadaş daha gelince başlayabilirsin"
    : `${missing} arkadaş daha gelince başlayabilirsin`;
}

/** "1/8 oyuncu · en az 2 gerekli". */
export function playerCounter(count: number, max: number, min: number): string {
  return `${count}/${max} oyuncu · en az ${min} gerekli`;
}

/** Oyun kartındaki alt yazı: yeterli kişi yoksa "en az N kişi", varsa oyuncu aralığı. */
export function gameTag(game: GameInfo, connected: number): string {
  return game.minPlayers > connected
    ? `en az ${game.minPlayers} kişi`
    : `${game.minPlayers}–${game.maxPlayers} oyuncu`;
}

/** Şu an yeterli oyuncu yok mu (kart soluk görünür ama seçilebilir). */
export function isGameDim(game: GameInfo, connected: number): boolean {
  return game.minPlayers > connected;
}

/** Koltuk ızgarasının sütun sayısı (CSS `.seats` ile aynı). */
export const SEAT_COLUMNS = 4;

/**
 * Boş koltuk dairelerinin sayısı: satır tamamlanır (en çok bir satır); satır doluysa bir satır boş daire gelir.
 * Kalanı "+N yer daha" yazısıdır. Böylece ızgara hep dengeli kalır.
 */
export function emptySeats(players: number, max: number): { shown: number; more: number } {
  const empty = Math.max(0, max - players);
  const rest = players % SEAT_COLUMNS;
  const shown = Math.min(empty, rest === 0 ? SEAT_COLUMNS : SEAT_COLUMNS - rest);
  return { shown, more: empty - shown };
}

/** Lobi ayarlarının tek satırlık özeti: "5 rastgele oyun · Kartlar açık · Geç gelen izler". */
export function settingsLine(opts: {
  mode: "random" | "manual";
  randomCount: number;
  selectedCount: number;
  cardsOn: boolean;
  joinPolicy: JoinPolicy;
}): string {
  const games =
    opts.mode === "random" ? `${opts.randomCount} rastgele oyun` : `${opts.selectedCount} oyun seçili`;
  const cards = opts.cardsOn ? "Kartlar açık" : "Kartlar kapalı";
  const join = opts.joinPolicy === "izleyici" ? "Geç gelen izler" : "Geç gelen giremez";
  return `${games} · ${cards} · ${join}`;
}

/** Rastgele seçime girebilen oyun sayısı (elle seçilebilen ama havuz dışı oyunlar sayılmaz). */
export const poolSizeOf = (catalog: readonly GameInfo[]): number => catalog.filter(inRandomPool).length;

/** Rastgele modda gösterilen oyun sayısı (havuzdan büyük olamaz); elle modda 0. */
export function randomCountOf(selection: RoomSnapshot["selection"], pool: number): number {
  return selection.mode === "random" ? Math.min(selection.count, pool) : 0;
}

/** Maçta kart aşaması gelecek mi (ana anahtar açık ve en az bir kart etkin). */
export function cardsActive(settings: CardSettings | undefined): boolean {
  const s = settings ?? DEFAULT_CARD_SETTINGS;
  return s.enabled && enabledCards(s).length > 0;
}
