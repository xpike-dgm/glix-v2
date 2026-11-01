import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  SON_KISI_CLOSE_BONUS,
  SON_KISI_CLOSE_MS,
  SON_KISI_GAP_MS,
  SON_KISI_LAST_POINTS,
  SON_KISI_LOCK_GRACE_MS,
  SON_KISI_MAX_MS,
  SON_KISI_MIN_MS,
  SON_KISI_REVEAL_MS,
  SON_KISI_ROUNDS,
  SON_KISI_SECOND_POINTS,
  type SonKisiAction,
  type SonKisiEscape,
  type SonKisiPhase,
  type SonKisiPublicView,
  type SonKisiRoundResult,
  type SonKisiStanding,
  type SonKisiTension,
  type SonKisiView,
} from "./types.js";

export * from "./types.js";

/** Bir turun durumu. Bütün zamanlar sunucu saatidir (mutlak ms). */
export interface SonKisiRoundState {
  /** Turun başlangıcı. */
  startAt: number;
  /** GİZLİ: özgün alarm anı. Hiçbir görünüme mutlak olarak girmez; tur kapanınca turun başından ms olarak açılır. */
  alarmAt: number;
  /** Turun kapanışı: alarm ya da herkes kaçtıysa son kaçış + 1 sn (hangisi önceyse). */
  endsAt: number;
  /** GİZLİ: gerilim düzeylerinin başladığı anlar (artan). Hiçbir görünüme girmez. */
  thresholds: number[];
  /** Bu turdaki ilk geçerli kaçışlar (sunucu zaman damgası), kaçış sırasıyla. */
  escapes: { id: string; at: number }[];
}

export interface SonKisiState {
  players: string[];
  startedAt: number;
  /** Üç turun takvimi; bir tur erken kapanınca sonraki turlar öne kayar. */
  rounds: SonKisiRoundState[];
  /** Son açılışın bitişi (oyunun bitişi). */
  revealEndsAt: number;
  /**
   * Evre/gerilim sayacı: yalnız "durum değişti" sinyalidir (sunucu yalnız durum değişince yayın yapar); görünümler
   * `ctx.now`'dan türetilir, sonuca etkisi yoktur.
   */
  stage: number;
}

/** Gerilim düzeyi: geçilen gizli eşik sayısı (0–3). */
export function sonKisiTension(thresholds: readonly number[], now: number): SonKisiTension {
  let level = 0;
  for (const t of thresholds) if (now >= t) level++;
  return Math.min(3, level) as SonKisiTension;
}

/**
 * Alarma göre rastgele, gizli eşikler (mutlak ms): düzey 1 alarmdan 5–8 sn, düzey 2 2,5–4,5 sn, düzey 3 0,8–2,2 sn önce.
 * Turun başından en az 1 sn sonra ve artan sırada; böylece eşik zamanı alarmın deterministik bir işlevi olmaz.
 */
function makeThresholds(startAt: number, alarmAt: number, rng: GameContext["rng"]): number[] {
  const pick = (lo: number, hi: number) => lo + rng.int(hi - lo + 1);
  const floor = startAt + 1_000;
  const t1 = Math.max(floor, alarmAt - pick(5_000, 8_000));
  const t2 = Math.max(t1, floor, alarmAt - pick(2_500, 4_500));
  const t3 = Math.max(t2, floor, alarmAt - pick(800, 2_200));
  return [t1, t2, t3];
}

/**
 * SK-M1 + SK-M4 tur puanı: en son kaçan(lar) 2, sondan ikinci (bir sonraki farklı zaman; yalnız 3+ oyuncuda) 1,
 * alarmdan önceki son 1 sn içinde (uç dahil, özgün alarma göre) kaçan herkes +1 ek; diğer kaçanlar ve yakalananlar 0.
 * Eksi yok; kimse kaçmazsa kimse puan almaz. Eşit zaman damgası aynı derece.
 */
export function sonKisiRoundPoints(
  players: readonly string[],
  escapes: readonly { id: string; at: number }[],
  alarmAt: number,
): Record<string, number> {
  const times = [...new Set(escapes.map((e) => e.at))].sort((a, b) => b - a);
  const latest = times[0];
  const second = players.length >= 3 ? times[1] : undefined;
  const points: Record<string, number> = {};
  for (const id of players) {
    const mine = escapes.find((e) => e.id === id);
    if (!mine) {
      points[id] = 0;
      continue;
    }
    const rank = mine.at === latest ? SON_KISI_LAST_POINTS : mine.at === second ? SON_KISI_SECOND_POINTS : 0;
    points[id] = rank + (alarmAt - mine.at <= SON_KISI_CLOSE_MS ? SON_KISI_CLOSE_BONUS : 0);
  }
  return points;
}

/** Bir turun açılışı (yalnız tur kapanınca görünüme girer). */
export function sonKisiRoundResult(
  players: readonly string[],
  round: SonKisiRoundState,
  index: number,
): SonKisiRoundResult {
  const points = sonKisiRoundPoints(players, round.escapes, round.alarmAt);
  const order = (id: string) => players.indexOf(id);
  const sorted = [...round.escapes].sort((a, b) => a.at - b.at || order(a.id) - order(b.id));
  const times = [...new Set(sorted.map((e) => e.at))].sort((a, b) => b - a);
  const latest = times[0];
  const second = players.length >= 3 ? times[1] : undefined;
  const escapes: SonKisiEscape[] = sorted.map((e) => ({
    id: e.id,
    ms: e.at - round.startAt,
    points: points[e.id] ?? 0,
    close: round.alarmAt - e.at <= SON_KISI_CLOSE_MS,
  }));
  return {
    index,
    alarmMs: round.alarmAt - round.startAt,
    rang: round.endsAt >= round.alarmAt,
    escapes,
    caught: players.filter((id) => !round.escapes.some((e) => e.id === id)),
    last: sorted.filter((e) => e.at === latest).map((e) => e.id),
    second: second === undefined ? [] : sorted.filter((e) => e.at === second).map((e) => e.id),
    points,
  };
}

/**
 * SK-M2 oyun sonu sıralaması ve genel skor: toplam tur puanına göre birinci grup +2 (eşitlikte hepsi +2), sonraki
 * farklı toplam +1; bütün katılımcıların toplamı eşit ve > 0 ise herkes +1; toplamı 0 olan ödül almaz.
 */
export function sonKisiStandings(
  players: readonly string[],
  results: readonly SonKisiRoundResult[],
): SonKisiStanding[] {
  const rows = players.map((playerId, order) => {
    const roundPoints = results.map((r) => r.points[playerId] ?? 0);
    return { playerId, order, roundPoints, total: roundPoints.reduce((a, b) => a + b, 0) };
  });
  const distinct = [...new Set(rows.map((r) => r.total))].sort((a, b) => b - a);
  const allEqual = distinct.length === 1;
  return [...rows]
    .sort((a, b) => b.total - a.total || a.order - b.order)
    .map((r): SonKisiStanding => {
      const group = distinct.indexOf(r.total);
      const award = r.total <= 0 ? 0 : allEqual ? 1 : group === 0 ? 2 : group === 1 ? 1 : 0;
      return {
        playerId: r.playerId,
        total: r.total,
        roundPoints: r.roundPoints,
        rank: rows.filter((x) => x.total > r.total).length + 1,
        award,
      };
    });
}

const lastRound = (state: SonKisiState): SonKisiRoundState =>
  state.rounds[state.rounds.length - 1] as SonKisiRoundState;

/** `now` anındaki tur ve evre. */
export function sonKisiPhaseAt(
  state: Pick<SonKisiState, "rounds">,
  now: number,
): { round: number; phase: SonKisiPhase } {
  for (let i = 0; i < state.rounds.length; i++) {
    const r = state.rounds[i] as SonKisiRoundState;
    if (now < r.startAt) return { round: Math.max(0, i - 1), phase: i === 0 ? "play" : "gap" };
    if (now < r.endsAt) return { round: i, phase: "play" };
  }
  return { round: state.rounds.length - 1, phase: "over" };
}

function stageAt(state: SonKisiState, now: number): number {
  const { round, phase } = sonKisiPhaseAt(state, now);
  const r = state.rounds[round] as SonKisiRoundState;
  if (phase !== "play") return 10 * round + (phase === "gap" ? 5 : 6);
  return 10 * round + sonKisiTension(r.thresholds, now);
}

/** Tur `from`dan sonraki turları, önceki turun kapanışına göre öne kaydırır (alarm ve eşikler birlikte kayar). */
function reflow(rounds: readonly SonKisiRoundState[], from: number): SonKisiRoundState[] {
  const out = rounds.map((r) => ({ ...r }));
  for (let i = from + 1; i < out.length; i++) {
    const prev = out[i - 1] as SonKisiRoundState;
    const r = out[i] as SonKisiRoundState;
    const delta = prev.endsAt + SON_KISI_GAP_MS - r.startAt;
    if (delta === 0) continue;
    out[i] = {
      ...r,
      startAt: r.startAt + delta,
      alarmAt: r.alarmAt + delta,
      endsAt: r.endsAt + delta,
      thresholds: r.thresholds.map((t) => t + delta),
    };
  }
  return out;
}

export const sonKisi: GameDefinition<SonKisiState, SonKisiAction, SonKisiView, SonKisiPublicView> = {
  id: "son-kisi",
  name: "Son Kişi",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Alarm çalmadan kaç, ama herkesten geç!",
    steps: [
      "Üç alarm; her biri gizli bir anda çalar",
      "Her alarmda KAÇ'a bir kez bas",
      "Son kaçan +2, sondan ikinci +1; eksi yok",
    ],
  },

  parseAction(raw: unknown): SonKisiAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const keys = Object.keys(raw);
    if (keys.length !== 1 || (raw as Record<string, unknown>).kind !== "escape") return null;
    return { kind: "escape" };
  },

  setup(players: readonly string[], ctx: GameContext): SonKisiState {
    const span = SON_KISI_MAX_MS - SON_KISI_MIN_MS + 1;
    const rounds: SonKisiRoundState[] = [];
    let startAt = ctx.now;
    for (let i = 0; i < SON_KISI_ROUNDS; i++) {
      const alarmAt = startAt + SON_KISI_MIN_MS + ctx.rng.int(span);
      rounds.push({
        startAt,
        alarmAt,
        endsAt: alarmAt,
        thresholds: makeThresholds(startAt, alarmAt, ctx.rng),
        escapes: [],
      });
      startAt = alarmAt + SON_KISI_GAP_MS;
    }
    return {
      players: [...players],
      startedAt: ctx.now,
      rounds,
      revealEndsAt: (rounds[rounds.length - 1] as SonKisiRoundState).endsAt + SON_KISI_REVEAL_MS,
      stage: 0,
    };
  },

  reduce(state, playerId, _action, ctx): SonKisiState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    // Son turun kapanışı ve sonrası: basış kabul edilmez.
    if (ctx.now >= lastRound(state).endsAt) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    const { round: i, phase } = sonKisiPhaseAt(state, ctx.now);
    // Turun kapanışı (alarm) ve tur arası: basış sayılmaz.
    if (phase !== "play") return { rejected: "between_rounds" };
    const round = state.rounds[i] as SonKisiRoundState;
    if (round.escapes.some((e) => e.id === playerId)) return state;
    const escapes = [...round.escapes, { id: playerId, at: ctx.now }];
    let rounds = state.rounds.map((r, k) => (k === i ? { ...r, escapes } : r));
    // Herkes (bağlantıdan bağımsız) kaçtıysa turun sonucu kesindir: 1 sn sonra kapanır, sonraki turlar öne kayar.
    if (state.players.every((id) => escapes.some((e) => e.id === id))) {
      const endsAt = Math.min(round.endsAt, ctx.now + SON_KISI_LOCK_GRACE_MS);
      rounds = reflow(
        rounds.map((r, k) => (k === i ? { ...r, endsAt } : r)),
        i,
      );
    }
    const last = rounds[rounds.length - 1] as SonKisiRoundState;
    return { ...state, rounds, revealEndsAt: last.endsAt + SON_KISI_REVEAL_MS };
  },

  tick(state, ctx): SonKisiState {
    const stage = stageAt(state, ctx.now);
    return stage === state.stage ? state : { ...state, stage };
  },

  nextWake(state, ctx): number | null {
    let best: number | null = null;
    const consider = (at: number) => {
      if (at > ctx.now && (best === null || at < best)) best = at;
    };
    for (const r of state.rounds) {
      consider(r.startAt);
      consider(r.endsAt);
      for (const t of r.thresholds) if (t < r.endsAt) consider(t);
    }
    consider(state.revealEndsAt);
    return best;
  },

  publicView(state, ctx): SonKisiPublicView {
    const { round, phase } = sonKisiPhaseAt(state, ctx.now);
    const current = state.rounds[round] as SonKisiRoundState;
    // Yalnız kapanmış turların sonucu açılır; oynanan turun alarmı, eşikleri ve kimin kaçtığı yoktur.
    const results: SonKisiRoundResult[] = [];
    state.rounds.forEach((r, index) => {
      if (ctx.now >= r.endsAt) results.push(sonKisiRoundResult(state.players, r, index));
    });
    const totals: Record<string, number> = {};
    for (const id of state.players) totals[id] = results.reduce((a, r) => a + (r.points[id] ?? 0), 0);
    return {
      startedAt: state.startedAt,
      rounds: state.rounds.length,
      round,
      phase,
      tension: phase === "play" ? sonKisiTension(current.thresholds, ctx.now) : 3,
      escapedCount: current.escapes.length,
      results,
      totals,
      final: phase === "over" ? sonKisiStandings(state.players, results) : null,
      finished: phase === "over",
    };
  },

  view(state, playerId, ctx): SonKisiView {
    if (playerId === null) return { escaped: false, myMs: null };
    const { round } = sonKisiPhaseAt(state, ctx.now);
    const r = state.rounds[round] as SonKisiRoundState;
    const mine = r.escapes.find((e) => e.id === playerId);
    return { escaped: mine !== undefined, myMs: mine ? mine.at - r.startAt : null };
  },

  /** Son açılış son turun kapandığı an başlar. */
  revealAt(state): number | null {
    return lastRound(state).endsAt;
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.revealEndsAt;
  },

  /**
   * Turların mutlak alarm anları ve gerilim eşikleri; sahibi yoktur. Görünümlerde mutlak zaman olarak yalnız
   * `startedAt` bulunduğundan bu değerler hiçbir görünümde geçmemelidir (tur kapanınca bile, yalnız turun başından ms
   * olarak açılır). Göreli süreler (kısa sayılar) yapısal olarak korunur: bkz. son-kisi.test.ts "gizlilik".
   */
  secrets(state) {
    return state.rounds.flatMap((r, i) => [
      { ownerIds: [] as string[], value: String(r.alarmAt), label: `${i + 1}. alarm anı` },
      ...r.thresholds.map((t, k) => ({
        ownerIds: [] as string[],
        value: String(t),
        label: `${i + 1}. tur gerilim eşiği ${k + 1}`,
      })),
    ]);
  },

  result(state) {
    const results = state.rounds.map((r, i) => sonKisiRoundResult(state.players, r, i));
    const standings = sonKisiStandings(state.players, results);
    const miniScores: Record<string, number> = {};
    const awards: Record<string, number> = {};
    for (const id of state.players) {
      const s = standings.find((x) => x.playerId === id);
      miniScores[id] = s?.total ?? 0;
      awards[id] = s?.award ?? 0;
    }
    return { miniScores, awards };
  },
};
