import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  KOR_BOMBA_BET_CUTOFF_MS,
  KOR_BOMBA_FUSE_CAP_MS,
  KOR_BOMBA_LOCK_MS,
  KOR_BOMBA_MAX_FUSE_MS,
  KOR_BOMBA_MIN_FUSE_MS,
  KOR_BOMBA_OUTRO_MS,
  KOR_BOMBA_PREDICT_BONUS,
  type KorBombaAction,
  type KorBombaJourney,
  type KorBombaPass,
  type KorBombaPredictionResult,
  type KorBombaPublicView,
  type KorBombaView,
  korBombaBonusRange,
} from "./types.js";

export * from "./types.js";

/** Bir pasın kaydı (gizli: an ve eklenen süre yalnız patlamadan sonra `journey` olarak açılır). */
export interface KorBombaPassLog {
  at: number;
  from: string;
  to: string;
  bonusMs: number;
}

export interface KorBombaState {
  players: string[];
  startedAt: number;
  holder: string;
  /** Gizli: yalnız taşıyıcı dışındaki katılımcılar bilir (patlayana kadar). */
  explodeAt: number;
  /** Oyun başındaki fitil (ms; gizli, patlamadan sonra açılır). */
  fuseMs: number;
  passes: number;
  lastPass: KorBombaPass | null;
  /** Son pasın eklediği süre (gizli; taşıyıcı dışındakilere). */
  lastBonusMs: number | null;
  /** BM-M1: şu anki taşıyıcının bombayı aldığı an. */
  heldSince: number;
  /** Bütün paslar (sırasıyla). */
  log: KorBombaPassLog[];
  /** `tick` patlamayı fark edince true. */
  exploded: boolean;
  /** GİZLİ (BM-M3): duran bahisler (oyuncu → bağlandığı el). Yalnız sahibinin `view`ına girer; pasla yanar. */
  bets: Record<string, number>;
  /** GİZLİ (BM-M3): tek hakkını kullananlar. */
  betUsed: string[];
  /** GİZLİ: her oyuncunun bahis sonucu; yalnız sahibine gider. */
  results: Record<string, KorBombaPredictionResult>;
  /** BM-M3: patlamada bahsi tutup +1 alanlar (oyun başına en çok bir kez). Patlamadan önce boş. */
  correctPredictors: string[];
}

/**
 * Patlamada bahsi tutanlar (her biri +1): bahis yalnız bağlandığı elde patlarsa tutar ve oyun başına tek haktır,
 * bu yüzden oyuncu başına üst sınır doğal olarak +1'dir. Taşıyıcı bahis yapamaz.
 * `exploded` bayrağına bakmaz; `result` tick gecikse bile aynı sonucu bulur.
 */
export function korBombaCorrectPredictors(state: KorBombaState): string[] {
  return state.players.filter((id) => id !== state.holder && state.bets[id] === state.passes);
}

/** BM-U6: bombanın yolculuğu (patlamadan sonra herkese açılır). */
export function korBombaJourney(state: KorBombaState): KorBombaJourney {
  const hands: KorBombaJourney["hands"] = [];
  let holder = state.log[0]?.from ?? state.holder;
  let since = state.startedAt;
  for (const p of state.log) {
    hands.push({ holder, heldMs: p.at - since });
    holder = p.to;
    since = p.at;
  }
  hands.push({ holder: state.holder, heldMs: Math.max(0, state.explodeAt - since) });
  return {
    fuseMs: state.fuseMs,
    bonusesMs: state.log.map((p) => p.bonusMs),
    totalMs: state.explodeAt - state.startedAt,
    hands,
  };
}

/** Patlama anının bahis çözümü (saf): tutanlar ve sahiplerin sonucu. */
function explode(state: KorBombaState): KorBombaState {
  const correctPredictors = korBombaCorrectPredictors(state);
  const results = { ...state.results };
  for (const id of correctPredictors) results[id] = { turn: state.passes, correct: true };
  return { ...state, exploded: true, correctPredictors, results, bets: {} };
}

const ended = (state: KorBombaState, now: number): boolean => state.exploded || now >= state.explodeAt;

export function korBombaScores(state: KorBombaState): Record<string, number> {
  const scores: Record<string, number> = {};
  const winners = state.exploded ? state.correctPredictors : korBombaCorrectPredictors(state);
  for (const id of state.players) {
    if (id === state.holder) scores[id] = -1;
    else scores[id] = winners.includes(id) ? KOR_BOMBA_PREDICT_BONUS : 0;
  }
  return scores;
}

/** BM-M1: taşıyıcı `to`ya geri pas veremez mi? (az önce atan, ve ondan başka bağlı hedef varsa) */
function returnBlocked(state: KorBombaState, to: string, connected: readonly string[]): boolean {
  const from = state.lastPass?.from;
  if (from === undefined || to !== from) return false;
  return connected.some((id) => id !== state.holder && id !== from && state.players.includes(id));
}

export const korBomba: GameDefinition<KorBombaState, KorBombaAction, KorBombaView, KorBombaPublicView> = {
  id: "kor-bomba",
  name: "Kör Bomba",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "landscape",
  briefing: {
    goal: "Bomba sende patlamasın!",
    steps: [
      "Bomba rastgele birinde başlar",
      "Taşıyan süreyi görmez; kandır ya da ikna et",
      "Pas ver, süreyi uzat; patlayan −1. Bir kez 'PATLAR!' de: o elde patlarsa +1",
    ],
  },

  parseAction(raw: unknown): KorBombaAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (Object.keys(rec).length !== 2) return null;
    if (rec.kind === "bet") {
      const turn = rec.turn;
      if (typeof turn !== "number" || !Number.isInteger(turn) || turn < 0 || turn > 100_000) return null;
      return { kind: "bet", turn };
    }
    if (rec.kind !== "pass") return null;
    const to = rec.to;
    if (typeof to !== "string" || to.length === 0 || to.length > 64) return null;
    return { kind: "pass", to };
  },

  setup(players: readonly string[], ctx: GameContext): KorBombaState {
    const pool = ctx.connected.filter((id) => players.includes(id));
    const candidates = pool.length > 0 ? pool : players;
    const holder = candidates[ctx.rng.int(candidates.length)] ?? players[0] ?? "";
    const fuse = KOR_BOMBA_MIN_FUSE_MS + ctx.rng.int(KOR_BOMBA_MAX_FUSE_MS - KOR_BOMBA_MIN_FUSE_MS + 1);
    return {
      players: [...players],
      startedAt: ctx.now,
      holder,
      explodeAt: ctx.now + fuse,
      fuseMs: fuse,
      passes: 0,
      lastPass: null,
      lastBonusMs: null,
      heldSince: ctx.now,
      log: [],
      exploded: false,
      bets: {},
      betUsed: [],
      results: {},
      correctPredictors: [],
    };
  },

  reduce(state, playerId, action, ctx): KorBombaState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    // Patlamayla aynı ya da sonraki ms'deki eylem geçersizdir (patlama önce işlenir).
    if (ended(state, ctx.now)) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (action.kind === "bet") {
      // BM-M3: tek hak; taşıyıcı bahis yapamaz; bahis o elin taşıyıcısına bağlanır.
      if (playerId === state.holder) return { rejected: "holder_cannot_bet" };
      if (state.betUsed.includes(playerId)) return { rejected: "already_bet" };
      if (action.turn !== state.passes) return { rejected: "stale_turn" };
      // Son 3 sn: kabul edilmez, hak yanmaz (yalnız zaten süreyi gören bahisçi bunu öğrenir).
      if (state.explodeAt - ctx.now < KOR_BOMBA_BET_CUTOFF_MS) return { rejected: "too_late" };
      return {
        ...state,
        bets: { ...state.bets, [playerId]: state.passes },
        betUsed: [...state.betUsed, playerId],
      };
    }
    if (playerId !== state.holder) return { rejected: "not_holder" };
    if (action.to === playerId) return { rejected: "self_target" };
    if (!state.players.includes(action.to)) return { rejected: "bad_target" };
    if (!ctx.connected.includes(action.to)) return { rejected: "target_offline" };
    // BM-M1: fitil tutuşuyor — eli aldıktan 1,5 sn geçmeden pas yok.
    if (ctx.now < state.heldSince + KOR_BOMBA_LOCK_MS) return { rejected: "locked" };
    if (returnBlocked(state, action.to, ctx.connected)) return { rejected: "no_return" };
    const passes = state.passes + 1;
    // BM-M2: azalan ek süre ve kesin tavan.
    const range = korBombaBonusRange(passes);
    const drawn = range ? range.min + ctx.rng.int(range.max - range.min + 1) : 0;
    const cap = state.startedAt + KOR_BOMBA_FUSE_CAP_MS;
    const bonus = Math.max(0, Math.min(drawn, cap - state.explodeAt));
    // BM-M3: el bitti, bu ele bağlı bahisler yanar (sahibi yalnız kendi sonucunu görür).
    const results = { ...state.results };
    const bets: Record<string, number> = {};
    for (const [id, turn] of Object.entries(state.bets)) {
      if (turn === state.passes) results[id] = { turn, correct: false };
      else bets[id] = turn;
    }
    return {
      ...state,
      bets,
      results,
      holder: action.to,
      explodeAt: state.explodeAt + bonus,
      passes,
      lastPass: { seq: passes, from: playerId, to: action.to },
      lastBonusMs: bonus,
      heldSince: ctx.now,
      log: [...state.log, { at: ctx.now, from: playerId, to: action.to, bonusMs: bonus }],
    };
  },

  tick(state, ctx): KorBombaState {
    if (state.exploded || ctx.now < state.explodeAt) return state;
    return explode(state);
  },

  /** BM-U5: patlama 100 ms'lik adımı beklemeden fitilin bittiği anda işlenir ve yayınlanır. */
  nextWake(state, ctx): number | null {
    if (!state.exploded && ctx.now < state.explodeAt) return state.explodeAt;
    const end = state.explodeAt + KOR_BOMBA_OUTRO_MS;
    return ctx.now < end ? end : null;
  },

  publicView(state): KorBombaPublicView {
    const first = state.log[0]?.from ?? state.holder;
    return {
      startedAt: state.startedAt,
      holder: state.holder,
      passes: state.passes,
      lastPass: state.lastPass ? { ...state.lastPass } : null,
      trail: [first, ...state.log.map((p) => p.to)],
      lockedUntil: state.heldSince + KOR_BOMBA_LOCK_MS,
      exploded: state.exploded,
      explodedAt: state.exploded ? state.explodeAt : null,
      correctPredictors: state.exploded ? [...state.correctPredictors] : [],
      journey: state.exploded ? korBombaJourney(state) : null,
    };
  },

  view(state, playerId): KorBombaView {
    if (playerId === null || !state.players.includes(playerId)) return { role: "spectator" };
    const lastResult = state.results[playerId] ?? null;
    const betUsed = state.betUsed.includes(playerId);
    if (playerId === state.holder && !state.exploded) return { role: "holder", betUsed, lastResult };
    // Duran bahis her zaman şu anki ele bağlıdır (pasla yanar).
    const turn = state.bets[playerId];
    return {
      role: "watcher",
      explodeAt: state.explodeAt,
      lastBonusMs: state.lastBonusMs,
      bet: turn === undefined ? null : { turn, holder: state.holder },
      betUsed,
      lastResult,
    };
  },

  /** Sonuç açılışı patlama anında başlar (patlamadan önce sunucu bu anı yayınlamaz). */
  revealAt(state): number | null {
    return state.explodeAt;
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.explodeAt + KOR_BOMBA_OUTRO_MS;
  },

  notify(state) {
    return state.exploded ? [] : [state.holder];
  },

  secrets(state) {
    if (state.exploded) return [];
    return [
      {
        ownerIds: state.players.filter((id) => id !== state.holder),
        value: String(state.explodeAt),
        label: "patlama zamanı",
      },
    ];
  },

  result(state) {
    const scores = korBombaScores(state);
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
