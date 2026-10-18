import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  RUS_RULETI_DECISION_MS,
  RUS_RULETI_MAX_RISK,
  RUS_RULETI_OPEN_MS,
  RUS_RULETI_RISK_STEP,
  RUS_RULETI_START_RISK,
  type RusRuletiAction,
  type RusRuletiPublicView,
  type RusRuletiResult,
  type RusRuletiShot,
  type RusRuletiView,
} from "./types.js";

export * from "./types.js";

export interface RusRuletiState {
  players: string[];
  startedAt: number;
  /**
   * GİZLİ: atış sonuçlarının tohumu. Her atışın zarı `shotRng(seed, atışNo)` ile atış anında çıkar;
   * böylece sonuç tick takvimine ve reddedilen eylemlere bağlı kalmaz (ortak `ctx.rng` akışı tüketilmez).
   */
  seed: number;
  alive: string[];
  eliminated: string[];
  holder: string;
  risk: number;
  shots: number;
  last: RusRuletiShot | null;
  openAt: number;
  deadline: number;
  over: boolean;
}

/** Atış `no` için rastgelelik: tohum + sıra numarasından türetilir. */
function shotRng(seed: number, no: number, salt = 0) {
  const rng = createRng((seed ^ Math.imul(no + 1, 0x9e3779b1) ^ salt) >>> 0);
  rng.next();
  return rng;
}

/** Oyun bitişi: son atıştan sonra sonuç animasyonu için açılış süresi kadar beklenir. */
const outroEnd = (state: RusRuletiState): number => (state.last?.at ?? state.startedAt) + RUS_RULETI_OPEN_MS;

/** Yarı eşiği: hayatta kalan sayısı başlangıcın yarısına veya altına düşünce biter. */
export function rusRuletiShouldEnd(startCount: number, aliveCount: number): boolean {
  return aliveCount * 2 <= startCount;
}

/**
 * Bir atış uygular (elle ya da süre dolunca). `at` atışın zamanı; sonraki karar penceresi buna göre kurulur.
 * Rastgelelik yalnız atış sırasından türer.
 */
function fire(state: RusRuletiState, target: string, auto: boolean, at: number): RusRuletiState {
  const rng = shotRng(state.seed, state.shots);
  const exploded = rng.int(100) < state.risk;
  const seq = state.shots + 1;
  const last: RusRuletiShot = {
    seq,
    shooter: state.holder,
    target,
    auto,
    exploded,
    risk: state.risk,
    at,
  };
  const openAt = at + RUS_RULETI_OPEN_MS;
  const deadline = openAt + RUS_RULETI_DECISION_MS;
  if (!exploded) {
    return {
      ...state,
      holder: target,
      risk: Math.min(RUS_RULETI_MAX_RISK, state.risk + RUS_RULETI_RISK_STEP),
      shots: seq,
      last,
      openAt,
      deadline,
    };
  }
  const alive = state.alive.filter((id) => id !== target);
  const eliminated = [...state.eliminated, target];
  const over = rusRuletiShouldEnd(state.players.length, alive.length);
  const holder = over ? state.holder : (alive[rng.int(alive.length)] ?? state.holder);
  return {
    ...state,
    alive,
    eliminated,
    holder,
    risk: RUS_RULETI_START_RISK,
    shots: seq,
    last,
    openAt,
    deadline,
    over,
  };
}

/**
 * Süresi dolan kararlar için sunucu atışı: sahip dışındaki rastgele bir hayatta oyuncu (yoksa sahibin kendisi).
 * Atış zamanı gerçek bitiş anıdır (tick geç kalsa da sonuç aynıdır). `connected`'a bakmaz.
 */
function catchUp(state: RusRuletiState, now: number): RusRuletiState {
  let s = state;
  while (!s.over && now >= s.deadline) {
    const others = s.alive.filter((id) => id !== s.holder);
    const pick = shotRng(s.seed, s.shots, 0x5bd1e995); // hedef seçimi atışın zarından ayrı bir akış kullanır
    const target = others.length > 0 ? (others[pick.int(others.length)] ?? s.holder) : s.holder;
    s = fire(s, target, true, s.deadline);
  }
  return s;
}

export function rusRuletiResult(state: RusRuletiState): RusRuletiResult {
  return { survivors: [...state.alive], eliminated: [...state.eliminated] };
}

export const rusRuleti: GameDefinition<RusRuletiState, RusRuletiAction, RusRuletiView, RusRuletiPublicView> =
  {
    id: "rus-ruleti",
    name: "Rus Ruleti",
    minPlayers: 2,
    maxPlayers: 8,
    orientation: "portrait",
    briefing: {
      goal: "Silah patlamadan hayatta kal!",
      steps: [
        "Silah sende mi? Kendini ya da birini seç",
        "Her güvenli atışta patlama riski yükselir",
        "Patlayan elenir; sonda hayatta kalanlar +1 alır",
      ],
    },

    parseAction(raw: unknown): RusRuletiAction | null {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
      const rec = raw as Record<string, unknown>;
      if (Object.keys(rec).length !== 2 || rec.kind !== "shoot") return null;
      const target = rec.target;
      if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
      return { kind: "shoot", target };
    },

    setup(players: readonly string[], ctx: GameContext): RusRuletiState {
      const pool = ctx.connected.filter((id) => players.includes(id));
      const candidates = pool.length > 0 ? pool : players;
      const holder = candidates[ctx.rng.int(candidates.length)] ?? players[0] ?? "";
      const seed = ctx.rng.int(2 ** 30);
      return {
        players: [...players],
        startedAt: ctx.now,
        seed,
        alive: [...players],
        eliminated: [],
        holder,
        risk: RUS_RULETI_START_RISK,
        shots: 0,
        last: null,
        openAt: ctx.now,
        deadline: ctx.now + RUS_RULETI_DECISION_MS,
        over: false,
      };
    },

    reduce(state, playerId, action, ctx): RusRuletiState | Rejected {
      if (!state.players.includes(playerId)) return { rejected: "not_participant" };
      // Süresi dolmuş kararlar önce işlenir; bu hâlâ saf ve rastgele akışı tüketmez.
      const s = catchUp(state, ctx.now);
      if (s.over) return { rejected: "ended" };
      if (ctx.now < s.startedAt) return { rejected: "not_started" };
      if (!s.alive.includes(playerId)) return { rejected: "eliminated" };
      if (ctx.now < s.openAt) return { rejected: "not_open" };
      if (playerId !== s.holder) return { rejected: "not_holder" };
      if (!s.alive.includes(action.target)) return { rejected: "bad_target" };
      if (action.target !== playerId && !ctx.connected.includes(action.target)) {
        return { rejected: "target_offline" };
      }
      return fire(s, action.target, false, ctx.now);
    },

    tick(state, ctx): RusRuletiState {
      return catchUp(state, ctx.now);
    },

    publicView(state): RusRuletiPublicView {
      return {
        startedAt: state.startedAt,
        players: [...state.players],
        alive: [...state.alive],
        eliminated: [...state.eliminated],
        holder: state.holder,
        risk: state.risk,
        shots: state.shots,
        last: state.last ? { ...state.last } : null,
        openAt: state.openAt,
        deadline: state.over ? null : state.deadline,
        over: state.over,
        result: state.over ? rusRuletiResult(state) : null,
      };
    },

    view(state, playerId): RusRuletiView {
      if (playerId === null || !state.players.includes(playerId)) return { role: "spectator" };
      return { role: state.alive.includes(playerId) ? "alive" : "out" };
    },

    isFinished(state, ctx): boolean {
      return state.over && ctx.now >= outroEnd(state);
    },

    /** Atış tohumu: kimsenin görünümünde olamaz (sonuçlar atış anında bu tohumdan çıkar). */
    secrets(state) {
      return [{ ownerIds: [], value: `rr-tohum-${state.seed}`, label: "atış tohumu" }];
    },

    result(state) {
      const scores: Record<string, number> = {};
      for (const id of state.players) scores[id] = state.alive.includes(id) ? 1 : 0;
      return { miniScores: { ...scores }, awards: { ...scores } };
    },
  };
