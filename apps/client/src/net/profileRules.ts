import { type BadgeInfo, parseBadges } from "./badgeRules.js";

/** Profil ekranının verisi ve saf yardımcıları (sunucu yanıtı doğrulanır; ağdan gelen hiçbir şeye güvenilmez). */

export interface ProfileGame {
  gameId: string;
  name: string;
  plays: number;
  wins: number;
  bestMini: number;
}

export interface ProfileRecentMatch {
  endedAt: number;
  players: number;
  place: number;
  score: number;
}

export interface ProfileInfo {
  username: string;
  createdAt: number;
  totals: { matches: number; wins: number; winRate: number; games: number; gameWins: number };
  favoriteGame: { id: string; name: string; plays: number } | null;
  perGame: ProfileGame[];
  recent: ProfileRecentMatch[];
  coPlayers: { username: string; matches: number }[];
  /** Rozetler (kendi profilinde hepsi, arkadaşınkinde yalnız kazanılanlar). Eski sunucuda boş. */
  badges: BadgeInfo[];
}

/** Sunucu sınırlarının üstünde yanıt gelirse (bozuk/kötü niyetli) listeler kırpılır. */
const MAX_GAMES = 100;
const MAX_RECENT = 10;
const MAX_CO = 5;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function count(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

function whole(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}

function text(v: unknown, max: number): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : null;
}

function parseGame(v: unknown): ProfileGame | null {
  if (!isRecord(v)) return null;
  const gameId = text(v.gameId, 64);
  const name = text(v.name, 64);
  const plays = count(v.plays);
  const wins = count(v.wins);
  const bestMini = whole(v.bestMini);
  if (gameId === null || name === null || plays === null || wins === null || bestMini === null) return null;
  return { gameId, name, plays, wins, bestMini };
}

function parseRecent(v: unknown): ProfileRecentMatch | null {
  if (!isRecord(v)) return null;
  const endedAt = count(v.endedAt);
  const players = count(v.players);
  const place = count(v.place);
  const score = whole(v.score);
  if (endedAt === null || players === null || place === null || place < 1 || score === null) return null;
  return { endedAt, players, place, score };
}

/** `GET /api/profile` yanıtını doğrular; geçersizse null. */
export function parseProfile(data: unknown): ProfileInfo | null {
  if (!isRecord(data) || data.ok !== true || !isRecord(data.totals)) return null;
  const username = text(data.username, 20);
  const createdAt = count(data.createdAt);
  const t = data.totals;
  const matches = count(t.matches);
  const wins = count(t.wins);
  const games = count(t.games);
  const gameWins = count(t.gameWins);
  const winRate = typeof t.winRate === "number" && t.winRate >= 0 && t.winRate <= 1 ? t.winRate : null;
  if (
    username === null ||
    createdAt === null ||
    matches === null ||
    wins === null ||
    games === null ||
    gameWins === null ||
    winRate === null
  )
    return null;
  let favoriteGame: ProfileInfo["favoriteGame"] = null;
  if (isRecord(data.favoriteGame)) {
    const id = text(data.favoriteGame.id, 64);
    const name = text(data.favoriteGame.name, 64);
    const plays = count(data.favoriteGame.plays);
    if (id !== null && name !== null && plays !== null) favoriteGame = { id, name, plays };
  }
  const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
  const perGame = list(data.perGame, MAX_GAMES)
    .map(parseGame)
    .filter((g): g is ProfileGame => g !== null);
  const recent = list(data.recent, MAX_RECENT)
    .map(parseRecent)
    .filter((r): r is ProfileRecentMatch => r !== null);
  const coPlayers = list(data.coPlayers, MAX_CO).flatMap((c) => {
    if (!isRecord(c)) return [];
    const name = text(c.username, 20);
    const n = count(c.matches);
    return name !== null && n !== null ? [{ username: name, matches: n }] : [];
  });
  return {
    username,
    createdAt,
    totals: { matches, wins, winRate, games, gameWins },
    favoriteGame,
    perGame,
    recent,
    coPlayers,
    badges: parseBadges(data.badges),
  };
}

/** Henüz hiç maç ya da oyun yok. */
export function isEmptyProfile(p: ProfileInfo): boolean {
  return p.totals.matches === 0 && p.totals.games === 0;
}

/** Galibiyet oranı yüzde olarak (tam sayı metni): 0.667 -> "67". */
export function percentText(rate: number): string {
  return String(Math.round(rate * 100));
}

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

const SHORT_MONTHS = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
] as const;

/** "Ekim 2026" (yerel saat). */
export function memberSince(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()] ?? ""} ${d.getFullYear()}`;
}

const DAY_MS = 24 * 3600 * 1000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Maç zamanı: "Bugün", "Dün", "3 gün önce", daha eskiyse "12 Eki". */
export function whenText(endedAt: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(endedAt)) / DAY_MS);
  if (days <= 0) return "Bugün";
  if (days === 1) return "Dün";
  if (days < 7) return `${days} gün önce`;
  const d = new Date(endedAt);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()] ?? ""}`;
}

/** Maç satırı özeti: "5 oyuncu · 12 puan". */
export function matchLine(m: ProfileRecentMatch): string {
  return `${m.players} oyuncu · ${m.score < 0 ? `−${Math.abs(m.score)}` : m.score} puan`;
}
