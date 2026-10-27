import { createSignal } from "solid-js";
import {
  type GameLeader,
  type LeaderRow,
  type Metric,
  type Period,
  parseGameLeaders,
  parseLeaderboard,
} from "./leaderboardRules.js";

export type LeaderboardLoad = "idle" | "loading" | "ready" | "error";

const [period, setPeriod] = createSignal<Period>("week");
const [metric, setMetric] = createSignal<Metric>("wins");
const [rows, setRows] = createSignal<readonly LeaderRow[]>([]);
const [games, setGames] = createSignal<readonly GameLeader[]>([]);
const [load, setLoad] = createSignal<LeaderboardLoad>("idle");
/** Sıralamaya hangi ekrandan gelindi (geri düğmesi oraya döner). */
const [leaderboardFrom, setLeaderboardFrom] = createSignal<"friends" | "profile">("friends");

export {
  games as leaderGames,
  leaderboardFrom,
  load as leaderboardLoad,
  metric,
  period,
  rows as leaderRows,
  setLeaderboardFrom,
};

/** Yalnız geliştirme önizlemesi: veri sabitlenir, ağdan okuma yapılmaz. */
let frozen = false;
export function freezeLeaderboard(
  data: { rows: readonly LeaderRow[]; games: readonly GameLeader[]; load?: LeaderboardLoad },
  next?: { period?: Period; metric?: Metric },
): void {
  frozen = true;
  setRows(data.rows);
  setGames(data.games);
  setLoad(data.load ?? "ready");
  if (next?.period) setPeriod(next.period);
  if (next?.metric) setMetric(next.metric);
}

/** Aynı anda tek okuma; eski bir yanıt yenisinin üstüne yazmaz. */
let seq = 0;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Seçili dönem ve ölçü için sıralamayı ve oyun liderlerini okur. */
export async function loadLeaderboard(): Promise<void> {
  if (frozen) return;
  const mine = ++seq;
  const p = period();
  const m = metric();
  if (rows().length === 0) setLoad("loading");
  try {
    const [r, g] = await Promise.all([
      getJson(`/api/leaderboard?period=${p}&metric=${m}`),
      getJson(`/api/leaderboard/games?period=${p}`),
    ]);
    if (mine !== seq) return;
    const parsedRows = parseLeaderboard(r);
    if (!parsedRows) {
      setLoad("error");
      return;
    }
    setRows(parsedRows);
    setGames(parseGameLeaders(g) ?? []);
    setLoad("ready");
  } catch {
    if (mine === seq) setLoad("error");
  }
}

export function choosePeriod(next: Period): void {
  if (next === period()) return;
  setPeriod(next);
  void loadLeaderboard();
}

export function chooseMetric(next: Metric): void {
  if (next === metric()) return;
  setMetric(next);
  void loadLeaderboard();
}

/** Çıkışta ve ekrandan ayrılırken eldeki veri bırakılır (başka hesaba sızmasın). */
export function resetLeaderboard(): void {
  seq += 1;
  frozen = false;
  setRows([]);
  setGames([]);
  setLoad("idle");
}
