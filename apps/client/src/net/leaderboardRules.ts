/** Arkadaş sıralaması: sunucu yanıtının doğrulanması ve saf yardımcılar. */

export const PERIODS = ["week", "all"] as const;
export type Period = (typeof PERIODS)[number];
export const METRICS = ["wins", "score", "matches"] as const;
export type Metric = (typeof METRICS)[number];

export const PERIOD_LABEL: Record<Period, string> = { week: "Bu hafta", all: "Tüm zamanlar" };
export const METRIC_LABEL: Record<Metric, string> = { wins: "Galibiyet", score: "Puan", matches: "Maç" };

export interface LeaderRow {
  username: string;
  value: number;
  rank: number;
  you: boolean;
}

export interface GameLeader {
  gameId: string;
  name: string;
  leader: { username: string; wins: number };
  you: { wins: number };
}

/** Sunucu en çok 201 satır yollar (sen + 200 arkadaş); fazlası bozuk yanıttır. */
const MAX_ROWS = 250;
const MAX_GAMES = 100;
const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : null);

function parseRow(v: unknown): LeaderRow | null {
  if (!isRecord(v)) return null;
  const value = int(v.value);
  const rank = int(v.rank);
  if (typeof v.username !== "string" || !USERNAME.test(v.username)) return null;
  if (value === null || rank === null || rank < 1 || typeof v.you !== "boolean") return null;
  return { username: v.username, value, rank, you: v.you };
}

/** `GET /api/leaderboard` yanıtı; geçersizse null. Bozuk satırlar atılır. */
export function parseLeaderboard(data: unknown): LeaderRow[] | null {
  if (!isRecord(data) || data.ok !== true || !Array.isArray(data.rows)) return null;
  return data.rows
    .slice(0, MAX_ROWS)
    .map(parseRow)
    .filter((r): r is LeaderRow => r !== null);
}

function parseGame(v: unknown): GameLeader | null {
  if (!isRecord(v) || !isRecord(v.leader) || !isRecord(v.you)) return null;
  const leaderWins = int(v.leader.wins);
  const youWins = int(v.you.wins);
  if (typeof v.gameId !== "string" || v.gameId.length === 0 || v.gameId.length > 64) return null;
  if (typeof v.name !== "string" || v.name.length === 0 || v.name.length > 64) return null;
  if (typeof v.leader.username !== "string" || !USERNAME.test(v.leader.username)) return null;
  if (leaderWins === null || leaderWins < 0 || youWins === null || youWins < 0) return null;
  return {
    gameId: v.gameId,
    name: v.name,
    leader: { username: v.leader.username, wins: leaderWins },
    you: { wins: youWins },
  };
}

/** `GET /api/leaderboard/games` yanıtı; geçersizse null. */
export function parseGameLeaders(data: unknown): GameLeader[] | null {
  if (!isRecord(data) || data.ok !== true || !Array.isArray(data.games)) return null;
  return data.games
    .slice(0, MAX_GAMES)
    .map(parseGame)
    .filter((g): g is GameLeader => g !== null);
}

/** Sıralamada yalnız sen varsın (arkadaşın yok): boş durum gösterilir. */
export function isAlone(rows: readonly LeaderRow[]): boolean {
  return rows.length <= 1;
}

/** Hiç kimsenin değeri yok (dönemde maç oynanmamış). */
export function allZero(rows: readonly LeaderRow[]): boolean {
  return rows.every((r) => r.value === 0);
}

/** Değer metni; negatif puan gerçek eksi işaretiyle. */
export function valueText(metric: Metric, value: number): string {
  void metric;
  return value < 0 ? `−${Math.abs(value)}` : String(value);
}

/** Satırın ekran okuyucu metni: "1. sıra, ali_1, 5 galibiyet". */
export function rowLabel(metric: Metric, r: LeaderRow): string {
  const unit = metric === "wins" ? "galibiyet" : metric === "score" ? "puan" : "maç";
  return `${r.rank}. sıra, ${r.you ? `${r.username} (sen)` : r.username}, ${valueText(metric, r.value)} ${unit}`;
}

/** Birincilik tacı yalnız gerçekten bir şey kazanılmışsa (0'larda taç yok). */
export function showsCrown(r: LeaderRow): boolean {
  return r.rank === 1 && r.value > 0;
}
