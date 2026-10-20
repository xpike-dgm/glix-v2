import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import {
  SIZMA_CLUE_CAP_MS,
  SIZMA_LOCK_GRACE_MS,
  SIZMA_REVEAL_MS,
  SIZMA_VOTE_MS,
  type SizmaAction,
  type SizmaPhase,
  type SizmaPublicView,
  type SizmaReveal,
  type SizmaView,
} from "./types.js";
import { SIZMA_PAIRS } from "./words.js";

export * from "./types.js";

export interface SizmaState {
  players: string[];
  startedAt: number;
  /** Söyleme sırası (herkese açık). */
  order: string[];
  infiltrator: string;
  /** Büyük harf (tr-TR) kelimeler. */
  commonWord: string;
  infiltratorWord: string;
  clueEndsAt: number;
  voteEndsAt: number;
  finishAt: number;
  /** "Oylamaya geç" diyenler. */
  ready: string[];
  clueClosing: boolean;
  /** Oylamada "Tamam" diyenler. */
  locked: string[];
  voteClosing: boolean;
  /** Oyuncu -> son verilen oy (gizli; sonuç açılana kadar yalnız sahibinin görünümünde). */
  votes: Record<string, string>;
  /** Yalnız sunucunun yayın tetiklemesi içindir: tick aşama geçişlerinde durumu bir kez değiştirir. */
  stage: SizmaPhase;
}

function voteOf(votes: Record<string, string>, id: string): string | null {
  return Object.hasOwn(votes, id) ? (votes[id] ?? null) : null;
}

/** Oyların sonucu: sızma tek başına en çok oyu aldıysa yakalanır (eşitlik ve hiç oy yok: kurtulur). */
export function sizmaOutcome(
  players: readonly string[],
  infiltrator: string,
  votes: Record<string, string>,
): { tally: Record<string, number>; caught: boolean; scores: Record<string, number> } {
  const tally: Record<string, number> = {};
  for (const id of players) tally[id] = 0;
  for (const id of players) {
    const to = voteOf(votes, id);
    if (to !== null && Object.hasOwn(tally, to)) tally[to] = (tally[to] ?? 0) + 1;
  }
  const top = Math.max(0, ...Object.values(tally));
  const leaders = players.filter((id) => (tally[id] ?? 0) === top);
  const caught = top > 0 && leaders.length === 1 && leaders[0] === infiltrator;
  const scores: Record<string, number> = {};
  for (const id of players) scores[id] = caught ? (id === infiltrator ? 0 : 1) : id === infiltrator ? 2 : 0;
  return { tally, caught, scores };
}

function stageAt(state: SizmaState, now: number): SizmaPhase {
  if (now >= state.voteEndsAt) return "reveal";
  return now >= state.clueEndsAt ? "vote" : "clue";
}

function upper(word: string): string {
  return word.toLocaleUpperCase("tr-TR");
}

export const sizma: GameDefinition<SizmaState, SizmaAction, SizmaView, SizmaPublicView> = {
  id: "sizma",
  name: "Sızma",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Farklı kelimeyi gören sızmayı ipuçlarından yakala!",
    steps: [
      "Çoğunluk aynı kelimeyi görür, biri farklısını",
      "İki turda sırayla yüksek sesle ipucu ver",
      "Oylamaya geç, sızmayı bul",
    ],
  },

  parseAction(raw: unknown): SizmaAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (r.kind === "skip" || r.kind === "lock") {
      return Object.keys(r).length === 1 ? { kind: r.kind } : null;
    }
    if (Object.keys(r).length !== 2 || r.kind !== "vote") return null;
    const target = r.target;
    if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
    return { kind: "vote", target };
  },

  setup(players: readonly string[], ctx: GameContext): SizmaState {
    const pair = SIZMA_PAIRS[ctx.rng.int(SIZMA_PAIRS.length)] as readonly [string, string];
    const flip = ctx.rng.int(2) === 1;
    const [common, other] = flip ? [pair[1], pair[0]] : [pair[0], pair[1]];
    const infiltrator = players[ctx.rng.int(players.length)] as string;
    const clueEndsAt = ctx.now + SIZMA_CLUE_CAP_MS;
    const voteEndsAt = clueEndsAt + SIZMA_VOTE_MS;
    return {
      players: [...players],
      startedAt: ctx.now,
      order: ctx.rng.shuffle(players),
      infiltrator,
      commonWord: upper(common),
      infiltratorWord: upper(other),
      clueEndsAt,
      voteEndsAt,
      finishAt: voteEndsAt + SIZMA_REVEAL_MS,
      ready: [],
      clueClosing: false,
      locked: [],
      voteClosing: false,
      votes: {},
      stage: "clue",
    };
  },

  reduce(state, playerId, action, ctx): SizmaState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (ctx.now >= state.voteEndsAt) return { rejected: "ended" };
    const everyoneIn = (done: readonly string[]): boolean => {
      const active = state.players.filter((id) => ctx.connected.includes(id));
      return active.length > 0 && active.every((id) => done.includes(id));
    };

    if (action.kind === "skip") {
      if (ctx.now >= state.clueEndsAt) return { rejected: "not_clue" };
      if (state.clueClosing) return { rejected: "closed" };
      // Yeniden basmak yeniden kontrol eder (arada bağlantısı kopanlar beklenmesin).
      const ready = state.ready.includes(playerId) ? state.ready : [...state.ready, playerId];
      if (!everyoneIn(ready)) return ready === state.ready ? state : { ...state, ready };
      // Oylama 1 sn sonra başlar; oylama süresi aynı kalır.
      const clueEndsAt = Math.min(state.clueEndsAt, ctx.now + SIZMA_LOCK_GRACE_MS);
      const voteEndsAt = clueEndsAt + SIZMA_VOTE_MS;
      return {
        ...state,
        ready,
        clueClosing: true,
        clueEndsAt,
        voteEndsAt,
        finishAt: voteEndsAt + SIZMA_REVEAL_MS,
      };
    }

    if (ctx.now < state.clueEndsAt) return { rejected: "not_voting_yet" };
    if (state.locked.includes(playerId)) return { rejected: "locked" };
    if (state.voteClosing) return { rejected: "closed" };

    if (action.kind === "lock") {
      if (voteOf(state.votes, playerId) === null) return { rejected: "nothing_to_lock" };
      const locked = [...state.locked, playerId];
      if (!everyoneIn(locked)) return { ...state, locked };
      const voteEndsAt = Math.min(state.voteEndsAt, ctx.now + SIZMA_LOCK_GRACE_MS);
      return { ...state, locked, voteClosing: true, voteEndsAt, finishAt: voteEndsAt + SIZMA_REVEAL_MS };
    }

    if (!state.players.includes(action.target)) return { rejected: "unknown_target" };
    // Kendine oy serbest; başkasına oy yalnız bağlı bir katılımcıya.
    if (action.target !== playerId && !ctx.connected.includes(action.target)) {
      return { rejected: "target_offline" };
    }
    if (voteOf(state.votes, playerId) === action.target) return state;
    return { ...state, votes: { ...state.votes, [playerId]: action.target } };
  },

  // Aşama geçişleri durumu bir kez değiştirir: sunucu değişiklikte yayın yapar, geçişler tam zamanında görünür.
  tick(state, ctx): SizmaState {
    const stage = stageAt(state, ctx.now);
    return stage === state.stage ? state : { ...state, stage };
  },

  publicView(state): SizmaPublicView {
    const phase = state.stage;
    let reveal: SizmaReveal | null = null;
    if (phase === "reveal") {
      const { tally, caught, scores } = sizmaOutcome(state.players, state.infiltrator, state.votes);
      reveal = {
        infiltrator: state.infiltrator,
        commonWord: state.commonWord,
        infiltratorWord: state.infiltratorWord,
        votes: { ...state.votes },
        tally,
        caught,
        scores,
      };
    }
    return {
      players: [...state.players],
      phase,
      order: [...state.order],
      startedAt: state.startedAt,
      clueEndsAt: state.clueEndsAt,
      voteEndsAt: state.voteEndsAt,
      finishAt: state.finishAt,
      ready: phase === "clue" ? [...state.ready] : phase === "vote" ? [...state.locked] : [],
      reveal,
    };
  },

  view(state, playerId): SizmaView {
    if (playerId === null || !state.players.includes(playerId)) {
      return { word: null, myVote: null, locked: false };
    }
    const phase = state.stage;
    return {
      word: playerId === state.infiltrator ? state.infiltratorWord : state.commonWord,
      myVote: voteOf(state.votes, playerId),
      locked:
        phase === "clue"
          ? state.ready.includes(playerId)
          : phase === "vote" && state.locked.includes(playerId),
    };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.finishAt;
  },

  // Kelimeler yalnız sahiplerinin görünümünde olur; kimin sızma olduğu hiçbir görünümde yoktur (oyuncu kimliği
  // kısa, metin aramasıyla denetlenemez: bkz. sizma.test.ts "gizlilik"). Çok kısa kelimeler (ör. "at") alt dizgi
  // denetimine uygun değildir; onlar da aynı yapısal testlerle korunur.
  secrets(state): readonly SecretEntry[] {
    if (state.stage === "reveal") return [];
    const entries: SecretEntry[] = [];
    if (state.commonWord.length >= 3) {
      entries.push({
        ownerIds: state.players.filter((id) => id !== state.infiltrator),
        value: state.commonWord,
        label: "ortak kelime",
      });
    }
    if (state.infiltratorWord.length >= 3) {
      entries.push({ ownerIds: [state.infiltrator], value: state.infiltratorWord, label: "sızma kelimesi" });
    }
    return entries;
  },

  result(state) {
    const { scores } = sizmaOutcome(state.players, state.infiltrator, state.votes);
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
