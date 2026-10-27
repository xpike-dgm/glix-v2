import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  KOR_BOMBA_MAX_BONUS_MS,
  KOR_BOMBA_PREDICT_BONUS,
  KOR_BOMBA_MAX_FUSE_MS,
  KOR_BOMBA_MIN_BONUS_MS,
  KOR_BOMBA_MIN_FUSE_MS,
  KOR_BOMBA_OUTRO_MS,
  type KorBombaAction,
  type KorBombaPass,
  type KorBombaPredictionResult,
  type KorBombaPublicView,
  type KorBombaView,
} from "./types.js";

export * from "./types.js";

export interface KorBombaState {
  players: string[];
  startedAt: number;
  holder: string;
  /** Gizli: yalnız taşıyıcı dışındaki katılımcılar bilir (patlayana kadar). */
  explodeAt: number;
  passes: number;
  lastPass: KorBombaPass | null;
  /** Son pasın eklediği süre (gizli; taşıyıcı dışındakilere). */
  lastBonusMs: number | null;
  /** `tick` patlamayı fark edince true. */
  exploded: boolean;
  /** GİZLİ (O9): bu eldeki tahminler (oyuncu → patlar mı). Yalnız sahibinin `view`ına girer; pasla temizlenir. */
  predictions: Record<string, boolean>;
  /** GİZLİ (O9): her oyuncunun son çözülen tahmini; yalnız sahibine gider. */
  results: Record<string, KorBombaPredictionResult>;
  /** O9: patlamada doğru bilip +1 alanlar (oyun başına en çok bir kez). Patlamadan önce boş. */
  correctPredictors: string[];
}

/**
 * Patlamada doğru "patlar" diyenler (her biri +1): bomba tek kez patladığı ve tahmin yalnız son ele sayıldığı için
 * oyuncu başına üst sınır doğal olarak +1'dir (`KOR_BOMBA_PREDICT_BONUS`); eski ellerin tahminleri pasla silinir.
 * Yalnız son eldeki "patlar" tahminleri sayılır; taşıyıcı sayılmaz. `exploded` bayrağına bakmaz; `result` tick gecikse bile aynı sonucu bulur.
 */
export function korBombaCorrectPredictors(state: KorBombaState): string[] {
  return state.players.filter((id) => id !== state.holder && state.predictions[id] === true);
}

/** Patlama anının tahmin çözümü (saf): doğru bilenler ve herkesin sonucu. */
function explode(state: KorBombaState): KorBombaState {
  const correctPredictors = korBombaCorrectPredictors(state);
  const results = { ...state.results };
  for (const [id, explodes] of Object.entries(state.predictions)) {
    results[id] = { turn: state.passes, correct: explodes };
  }
  return { ...state, exploded: true, correctPredictors, results, predictions: {} };
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
      "Pas ver, süreyi uzat; patlayan −1 alır",
    ],
  },

  parseAction(raw: unknown): KorBombaAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (rec.kind === "predict") {
      const { turn, explodes } = rec;
      if (Object.keys(rec).length !== 3 || typeof explodes !== "boolean") return null;
      if (typeof turn !== "number" || !Number.isInteger(turn) || turn < 0 || turn > 100_000) return null;
      return { kind: "predict", turn, explodes };
    }
    if (Object.keys(rec).length !== 2 || rec.kind !== "pass") return null;
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
      passes: 0,
      lastPass: null,
      lastBonusMs: null,
      exploded: false,
      predictions: {},
      results: {},
      correctPredictors: [],
    };
  },

  reduce(state, playerId, action, ctx): KorBombaState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    // Patlamayla aynı ya da sonraki ms'deki pas geçersizdir (patlama önce işlenir).
    if (ended(state, ctx.now)) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (action.kind === "predict") {
      // O9: süreden bağımsız; yalnız el eşleşmesi, taşıyıcı olmama ve tek tahmin kuralı.
      if (playerId === state.holder) return { rejected: "holder_cannot_predict" };
      if (action.turn !== state.passes) return { rejected: "stale_turn" };
      if (playerId in state.predictions) return { rejected: "already_predicted" };
      return { ...state, predictions: { ...state.predictions, [playerId]: action.explodes } };
    }
    if (playerId !== state.holder) return { rejected: "not_holder" };
    if (action.to === playerId) return { rejected: "self_target" };
    if (!state.players.includes(action.to)) return { rejected: "bad_target" };
    if (!ctx.connected.includes(action.to)) return { rejected: "target_offline" };
    const bonus = KOR_BOMBA_MIN_BONUS_MS + ctx.rng.int(KOR_BOMBA_MAX_BONUS_MS - KOR_BOMBA_MIN_BONUS_MS + 1);
    const passes = state.passes + 1;
    // O9: el bitti, tahminler çözülür (pas = patlamadı); yeni el temiz başlar.
    const results = { ...state.results };
    for (const [id, explodes] of Object.entries(state.predictions)) {
      results[id] = { turn: state.passes, correct: !explodes };
    }
    return {
      ...state,
      predictions: {},
      results,
      holder: action.to,
      explodeAt: state.explodeAt + bonus,
      passes,
      lastPass: { seq: passes, from: playerId, to: action.to },
      lastBonusMs: bonus,
    };
  },

  tick(state, ctx): KorBombaState {
    if (state.exploded || ctx.now < state.explodeAt) return state;
    return explode(state);
  },

  publicView(state): KorBombaPublicView {
    return {
      startedAt: state.startedAt,
      holder: state.holder,
      passes: state.passes,
      lastPass: state.lastPass ? { ...state.lastPass } : null,
      exploded: state.exploded,
      explodedAt: state.exploded ? state.explodeAt : null,
      correctPredictors: state.exploded ? [...state.correctPredictors] : [],
    };
  },

  view(state, playerId): KorBombaView {
    if (playerId === null || !state.players.includes(playerId)) return { role: "spectator" };
    const lastResult = state.results[playerId] ?? null;
    if (playerId === state.holder && !state.exploded) return { role: "holder", lastResult };
    const explodes = state.predictions[playerId];
    return {
      role: "watcher",
      explodeAt: state.explodeAt,
      lastBonusMs: state.lastBonusMs,
      prediction: explodes === undefined ? null : { turn: state.passes, explodes },
      lastResult,
    };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.explodeAt + KOR_BOMBA_OUTRO_MS;
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
