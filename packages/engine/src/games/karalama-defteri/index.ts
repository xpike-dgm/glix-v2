import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import {
  addStroke,
  clearStrokes,
  type DrawLimits,
  EMPTY_DRAWING,
  hasExactKeys,
  isPlainObject,
  type PlayerDrawing,
  parseStrokeFields,
  undoStroke,
} from "../drawing.js";
import {
  KARALAMA_DRAW_MS,
  KARALAMA_LOCK_GRACE_MS,
  KARALAMA_MAX_DRAW_ACTIONS,
  KARALAMA_MAX_STROKES,
  KARALAMA_MAX_TOTAL_POINTS,
  KARALAMA_VOTE_MS,
  type KaralamaAction,
  type KaralamaPhase,
  type KaralamaPublicView,
  type KaralamaReveal,
  type KaralamaStroke,
  type KaralamaView,
} from "./types.js";
import { DRAWING_PAIRS, type DrawingPair } from "./words.js";

export * from "./types.js";

/** Kelime uzunluğu (kod noktası): sızıntı denetimi için gizli değer en az 3 karakter olmalıdır. */
const MIN_WORD_LENGTH = 3;

/**
 * Oynanabilir çiftler: iki kelime de en az 3 karakter ve biri ötekinin içinde geçmez
 * (aksi halde bir oyuncunun kelimesi ötekinin görünümünde "sızmış" sayılırdı ve ipucu olurdu).
 */
export const KARALAMA_PAIRS: readonly DrawingPair[] = DRAWING_PAIRS.filter((p) => {
  const main = p.main.toLocaleLowerCase("tr");
  const near = p.near.toLocaleLowerCase("tr");
  return (
    [...p.main].length >= MIN_WORD_LENGTH &&
    [...p.near].length >= MIN_WORD_LENGTH &&
    !main.includes(near) &&
    !near.includes(main)
  );
});

const LIMITS: DrawLimits = {
  maxStrokes: KARALAMA_MAX_STROKES,
  maxTotalPoints: KARALAMA_MAX_TOTAL_POINTS,
  maxActions: KARALAMA_MAX_DRAW_ACTIONS,
};

export interface KaralamaState {
  players: string[];
  startedAt: number;
  drawEndsAt: number;
  voteEndsAt: number;
  outsider: string;
  mainWord: string;
  nearWord: string;
  drawings: Record<string, PlayerDrawing>;
  /** Oy veren -> hedef (son oy geçerli). */
  votes: Record<string, string>;
  /** Çizimini "Bitti" ile kesinleştirenler. `drawEndsAt`/`voteEndsAt` erken bitişte reduce içinde öne çekilir. */
  drawDone: string[];
  /** Oyunu "Tamam" ile kesinleştirenler. */
  locked: string[];
  /**
   * Görünür aşama; yalnız `tick` ilerletir (böylece aşama geçişi yayına yansır). "done": kelimeler ve bilgisiz
   * oyuncu açıldı. Eylemlerin kabulü bundan değil doğrudan `ctx.now`'dan karar verir (tick takvimine bağlı değil).
   */
  stage: KaralamaPhase;
}

const MAX_ID_LENGTH = 64;

/** Oyuncu başına skor: bilgisiz oyuncu tek başına en çok oyu aldıysa diğer herkes +1, aksi halde bilgisiz +1. */
export function karalamaScores(
  players: readonly string[],
  outsider: string,
  votes: Record<string, string>,
): { scores: Record<string, number>; tally: Record<string, number>; caught: boolean } {
  const tally: Record<string, number> = {};
  for (const id of players) tally[id] = 0;
  for (const [voter, target] of Object.entries(votes)) {
    if (voter === target || !players.includes(voter) || !players.includes(target)) continue;
    tally[target] = (tally[target] ?? 0) + 1;
  }
  const outsiderVotes = tally[outsider] ?? 0;
  const caught =
    outsiderVotes > 0 && players.every((id) => id === outsider || (tally[id] ?? 0) < outsiderVotes);
  const scores: Record<string, number> = {};
  for (const id of players) scores[id] = caught ? (id === outsider ? 0 : 1) : id === outsider ? 1 : 0;
  return { scores, tally, caught };
}

function drawingOf(state: KaralamaState, playerId: string): PlayerDrawing {
  return state.drawings[playerId] ?? EMPTY_DRAWING;
}

function withDrawing(state: KaralamaState, playerId: string, drawing: PlayerDrawing): KaralamaState {
  return { ...state, drawings: { ...state.drawings, [playerId]: drawing } };
}

export const karalamaDefteri: GameDefinition<
  KaralamaState,
  KaralamaAction,
  KaralamaView,
  KaralamaPublicView
> = {
  id: "karalama-defteri",
  name: "Karalama Defteri",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Çizimlere bakıp kelimeyi bilmeyeni bul!",
    steps: [
      "Çoğunluk aynı kelimeyi görür, biri yakın kelimeyi",
      "Kelimeni çiz, süre bitene kadar düzenle",
      "Çizimler açılınca kelimeyi bilmeyene oy ver",
    ],
  },

  parseAction(raw: unknown): KaralamaAction | null {
    if (!isPlainObject(raw)) return null;
    switch (raw.kind) {
      case "lock":
        return hasExactKeys(raw, ["kind"]) ? { kind: "lock" } : null;
      case "undo":
        return hasExactKeys(raw, ["kind"]) ? { kind: "undo" } : null;
      case "clear":
        return hasExactKeys(raw, ["kind"]) ? { kind: "clear" } : null;
      case "vote": {
        if (!hasExactKeys(raw, ["kind", "target"])) return null;
        const target = raw.target;
        if (typeof target !== "string" || target.length === 0 || target.length > MAX_ID_LENGTH) return null;
        return { kind: "vote", target };
      }
      case "stroke": {
        const fields = parseStrokeFields(raw);
        return fields === null ? null : { kind: "stroke", ...fields };
      }
      default:
        return null;
    }
  },

  setup(players: readonly string[], ctx: GameContext): KaralamaState {
    const pool = KARALAMA_PAIRS;
    const pair = pool[ctx.rng.int(pool.length)] as DrawingPair;
    const outsider = players[ctx.rng.int(players.length)] as string;
    return {
      players: [...players],
      startedAt: ctx.now,
      drawEndsAt: ctx.now + KARALAMA_DRAW_MS,
      voteEndsAt: ctx.now + KARALAMA_DRAW_MS + KARALAMA_VOTE_MS,
      outsider,
      mainWord: pair.main,
      nearWord: pair.near,
      drawings: {},
      votes: {},
      drawDone: [],
      locked: [],
      stage: "draw",
    };
  },

  reduce(state, playerId, action, ctx): KaralamaState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (ctx.now >= state.voteEndsAt || state.stage === "done") return { rejected: "ended" };
    const drawing = ctx.now < state.drawEndsAt;
    const everyoneIn = (done: readonly string[]): boolean =>
      !state.players.some((id) => ctx.connected.includes(id) && !done.includes(id));

    if (action.kind === "lock") {
      if (drawing) {
        if (state.drawDone.includes(playerId)) return { rejected: "locked" };
        if (Object.keys(drawingOf(state, playerId).strokes).length === 0)
          return { rejected: "nothing_to_lock" };
        const drawDone = [...state.drawDone, playerId];
        if (!everyoneIn(drawDone)) return { ...state, drawDone };
        // Bağlı herkes çizimini bitirdi: oylama 1 sn sonra başlar (oylama süresi değişmez).
        const drawEndsAt = Math.min(state.drawEndsAt, ctx.now + KARALAMA_LOCK_GRACE_MS);
        return { ...state, drawDone, drawEndsAt, voteEndsAt: drawEndsAt + KARALAMA_VOTE_MS };
      }
      if (state.locked.includes(playerId)) return { rejected: "locked" };
      if (state.votes[playerId] === undefined) return { rejected: "nothing_to_lock" };
      const locked = [...state.locked, playerId];
      if (!everyoneIn(locked)) return { ...state, locked };
      // Bağlı herkes oyunu kesinleştirdi: oylama 1 sn sonra biter.
      return { ...state, locked, voteEndsAt: Math.min(state.voteEndsAt, ctx.now + KARALAMA_LOCK_GRACE_MS) };
    }

    if (action.kind === "vote") {
      if (drawing) return { rejected: "wrong_phase" };
      if (state.locked.includes(playerId)) return { rejected: "locked" };
      if (action.target === playerId) return { rejected: "self_vote" };
      if (!state.players.includes(action.target)) return { rejected: "bad_target" };
      if (!ctx.connected.includes(action.target)) return { rejected: "not_connected" };
      if (state.votes[playerId] === action.target) return state;
      return { ...state, votes: { ...state.votes, [playerId]: action.target } };
    }

    if (!drawing) return { rejected: "wrong_phase" };
    if (state.drawDone.includes(playerId)) return { rejected: "locked" };
    const mine = drawingOf(state, playerId);
    const out =
      action.kind === "stroke"
        ? addStroke(mine, action, LIMITS)
        : action.kind === "undo"
          ? undoStroke(mine, LIMITS)
          : clearStrokes(mine, LIMITS);
    return "rejected" in out ? { rejected: out.rejected } : withDrawing(state, playerId, out.drawing);
  },

  tick(state, ctx): KaralamaState {
    if (state.stage === "done") return state;
    if (ctx.now >= state.voteEndsAt) return { ...state, stage: "done" };
    if (state.stage === "draw" && ctx.now >= state.drawEndsAt) return { ...state, stage: "vote" };
    return state;
  },

  publicView(state): KaralamaPublicView {
    const phase = state.stage;
    let drawings: Record<string, KaralamaStroke[]> | null = null;
    if (phase !== "draw") {
      drawings = {};
      for (const id of state.players) drawings[id] = Object.values(drawingOf(state, id).strokes);
    }
    let reveal: KaralamaReveal | null = null;
    if (phase === "done") {
      const { tally, caught } = karalamaScores(state.players, state.outsider, state.votes);
      reveal = {
        outsider: state.outsider,
        mainWord: state.mainWord,
        nearWord: state.nearWord,
        votes: { ...state.votes },
        tally,
        caught,
      };
    }
    return {
      phase,
      drawEndsAt: state.drawEndsAt,
      voteEndsAt: state.voteEndsAt,
      players: [...state.players],
      drawings,
      voted: state.players.filter((id) => state.votes[id] !== undefined),
      drawDoneIds: [...state.drawDone],
      lockedIds: [...state.locked],
      reveal,
    };
  },

  view(state, playerId): KaralamaView {
    if (playerId === null || !state.players.includes(playerId)) {
      return {
        word: null,
        near: false,
        strokes: {},
        pointsLeft: 0,
        myVote: null,
        drawDone: false,
        locked: false,
      };
    }
    const mine = drawingOf(state, playerId);
    const drawing = state.stage === "draw";
    const isOutsider = playerId === state.outsider;
    return {
      word: isOutsider ? state.nearWord : state.mainWord,
      near: isOutsider,
      strokes: drawing ? { ...mine.strokes } : {},
      pointsLeft: drawing ? KARALAMA_MAX_TOTAL_POINTS - mine.points : 0,
      myVote: state.votes[playerId] ?? null,
      drawDone: state.drawDone.includes(playerId),
      locked: state.locked.includes(playerId),
    };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.voteEndsAt;
  },

  secrets(state): readonly SecretEntry[] {
    if (state.stage === "done") return [];
    return [
      {
        ownerIds: state.players.filter((id) => id !== state.outsider),
        value: state.mainWord,
        label: "ana kelime",
      },
      { ownerIds: [state.outsider], value: state.nearWord, label: "yakın kelime" },
    ];
  },

  result(state) {
    const { scores } = karalamaScores(state.players, state.outsider, state.votes);
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
