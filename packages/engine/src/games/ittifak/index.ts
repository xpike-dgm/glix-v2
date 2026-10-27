import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { derivedRng, drawSeed } from "../seeded.js";
import {
  ITTIFAK_DURATION_MS,
  ITTIFAK_LOCK_GRACE_MS,
  ITTIFAK_MAX_PROMISES,
  ITTIFAK_REVEAL_MS,
  ITTIFAK_TALK_MS,
  ITTIFAK_VOTE_MS,
  type IttifakAction,
  type IttifakPromise,
  type IttifakPhase,
  type IttifakPublicView,
  type IttifakReveal,
  type IttifakView,
} from "./types.js";

export * from "./types.js";

export interface IttifakState {
  players: string[];
  /** Rastgele doldurma için `ctx.rng`'den kurulumda alınan tohum (görünümlere girmez). */
  seed: number;
  startedAt: number;
  talkEndsAt: number;
  voteEndsAt: number;
  finishAt: number;
  /** Konuşmada "Oylamaya geçelim" diyenler. */
  skipped: string[];
  /** Herkes geçmek istediyse true: `talkEndsAt` öne çekilmiştir, yeni eylem kabul edilmez. */
  talkClosing: boolean;
  /** Oylamada "Tamam" diyenler (oyları kesinleşmiş). */
  locked: string[];
  /** Herkes kilitlediyse true: `voteEndsAt` öne çekilmiştir, yeni eylem kabul edilmez. */
  voteClosing: boolean;
  /** Oyuncu -> söz işaretleri (gizli; sonuç açılana kadar yalnız sahibinin görünümünde). */
  promises: Record<string, string[]>;
  /** Oyuncu -> son verilen oy (gizli; oylama bitene kadar yalnız sahibinin görünümünde). */
  votes: Record<string, string>;
  /** Oylama bitince tick/eylem tarafından bir kez kurulur: eksik oylar tamamlanmış hâli. */
  finalVotes: Record<string, string> | null;
  /** Yalnız sunucunun yayın tetiklemesi içindir: talk -> vote geçişini işaretler. */
  voting: boolean;
}

function voteOf(votes: Record<string, string>, id: string): string | null {
  return Object.hasOwn(votes, id) ? (votes[id] ?? null) : null;
}

/** Eksik oyları, kendisi dışındaki rastgele bir katılımcıyla tamamlar (tohumdan, belirli). */
export function ittifakFillVotes(
  players: readonly string[],
  seed: number,
  votes: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of players) {
    const v = voteOf(votes, id);
    if (v !== null && v !== id && players.includes(v)) {
      out[id] = v;
      continue;
    }
    const others = players.filter((p) => p !== id);
    const rng = derivedRng(seed, "vote", id);
    out[id] = others[rng.int(others.length)] as string;
  }
  return out;
}

const promisesOf = (promises: Record<string, string[]>, id: string): string[] =>
  Object.hasOwn(promises, id) ? (promises[id] ?? []) : [];

export function ittifakReveal(
  players: readonly string[],
  votes: Record<string, string>,
  promises: Record<string, string[]> = {},
): IttifakReveal {
  const scores: Record<string, number> = {};
  for (const id of players) scores[id] = 0;
  for (const id of players) {
    const to = voteOf(votes, id);
    if (to !== null && Object.hasOwn(scores, to)) scores[to] = (scores[to] ?? 0) + 1;
  }
  const kept: Record<string, IttifakPromise[]> = {};
  for (const from of players) {
    const list = promisesOf(promises, from);
    if (list.length > 0) kept[from] = list.map((to) => ({ to, kept: voteOf(votes, from) === to }));
  }
  return { votes: { ...votes }, scores, promises: kept };
}

/** Zamana göre ilerletir; saftır. Değişiklik yoksa aynı nesne döner. */
function advance(state: IttifakState, now: number): IttifakState {
  let s = state;
  if (!s.voting && now >= s.talkEndsAt) s = { ...s, voting: true };
  if (s.finalVotes === null && now >= s.voteEndsAt) {
    s = { ...s, voting: true, finalVotes: ittifakFillVotes(s.players, s.seed, s.votes) };
  }
  return s;
}

function phaseOf(state: IttifakState, now: number): IttifakPhase {
  if (now >= state.voteEndsAt) return "reveal";
  return now >= state.talkEndsAt ? "vote" : "talk";
}

export const ittifak: GameDefinition<IttifakState, IttifakAction, IttifakView, IttifakPublicView> = {
  id: "ittifak",
  name: "İttifak",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Arkadaşlarından oy topla, her oy bir puan!",
    steps: [
      "60 saniye oy iste, vaatte bulun; istersen gizlice söz işareti koy",
      "Tek gizli oyun var, kendine veremezsin",
      "Kim sözünü tuttu? Sonuç ekranında gör",
    ],
  },

  parseAction(raw: unknown): IttifakAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (r.kind === "skip" || r.kind === "lock") {
      return Object.keys(r).length === 1 ? { kind: r.kind } : null;
    }
    if (r.kind === "promise") {
      if (Object.keys(r).length !== 3 || typeof r.on !== "boolean") return null;
      const target = r.target;
      if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
      return { kind: "promise", target, on: r.on };
    }
    if (Object.keys(r).length !== 2 || r.kind !== "vote") return null;
    const target = r.target;
    if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
    return { kind: "vote", target };
  },

  setup(players: readonly string[], ctx: GameContext): IttifakState {
    return {
      players: [...players],
      seed: drawSeed(ctx.rng),
      startedAt: ctx.now,
      talkEndsAt: ctx.now + ITTIFAK_TALK_MS,
      voteEndsAt: ctx.now + ITTIFAK_TALK_MS + ITTIFAK_VOTE_MS,
      finishAt: ctx.now + ITTIFAK_DURATION_MS,
      skipped: [],
      promises: {},
      talkClosing: false,
      locked: [],
      voteClosing: false,
      votes: {},
      finalVotes: null,
      voting: false,
    };
  },

  reduce(state, playerId, action, ctx): IttifakState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (ctx.now >= state.voteEndsAt) return { rejected: "ended" };
    if (action.kind === "promise") {
      if (ctx.now >= state.talkEndsAt) return { rejected: "not_talking" };
      if (state.talkClosing) return { rejected: "closed" };
      if (action.target === playerId) return { rejected: "self_target" };
      if (!state.players.includes(action.target)) return { rejected: "unknown_target" };
      const mine = promisesOf(state.promises, playerId);
      const has = mine.includes(action.target);
      if (action.on === has) return state;
      if (!action.on) {
        return { ...state, promises: { ...state.promises, [playerId]: mine.filter((id) => id !== action.target) } };
      }
      if (mine.length >= ITTIFAK_MAX_PROMISES) return { rejected: "too_many_promises" };
      return { ...state, promises: { ...state.promises, [playerId]: [...mine, action.target] } };
    }
    if (action.kind === "skip") {
      if (ctx.now >= state.talkEndsAt) return { rejected: "not_talking" };
      if (state.talkClosing) return { rejected: "closed" };
      if (state.skipped.includes(playerId)) return state;
      const skipped = [...state.skipped, playerId];
      const active = state.players.filter((id) => ctx.connected.includes(id));
      if (active.length === 0 || !active.every((id) => skipped.includes(id))) return { ...state, skipped };
      // Konuşma kısalır; oylama süresi aynı kalır.
      const talkEndsAt = Math.min(state.talkEndsAt, ctx.now + ITTIFAK_LOCK_GRACE_MS);
      const voteEndsAt = talkEndsAt + ITTIFAK_VOTE_MS;
      return {
        ...state,
        skipped,
        talkClosing: true,
        talkEndsAt,
        voteEndsAt,
        finishAt: voteEndsAt + ITTIFAK_REVEAL_MS,
      };
    }
    if (ctx.now < state.talkEndsAt) return { rejected: "not_voting_yet" };
    if (state.locked.includes(playerId)) return { rejected: "locked" };
    if (state.voteClosing) return { rejected: "closed" };
    if (action.kind === "lock") {
      const s = advance(state, ctx.now);
      if (voteOf(s.votes, playerId) === null) return { rejected: "nothing_to_lock" };
      const locked = [...s.locked, playerId];
      const active = s.players.filter((id) => ctx.connected.includes(id));
      if (active.length === 0 || !active.every((id) => locked.includes(id))) return { ...s, locked };
      const voteEndsAt = Math.min(s.voteEndsAt, ctx.now + ITTIFAK_LOCK_GRACE_MS);
      return {
        ...s,
        locked,
        voteClosing: true,
        voteEndsAt,
        finishAt: voteEndsAt + ITTIFAK_REVEAL_MS,
      };
    }
    if (action.target === playerId) return { rejected: "self_target" };
    if (!state.players.includes(action.target)) return { rejected: "unknown_target" };
    if (!ctx.connected.includes(action.target)) return { rejected: "target_offline" };
    const s = advance(state, ctx.now);
    if (voteOf(s.votes, playerId) === action.target) return s;
    return { ...s, votes: { ...s.votes, [playerId]: action.target } };
  },

  // Aşama değişimleri durumu bir kez değiştirir: sunucu değişiklikte yayın yapar, böylece geçişler tam zamanında görünür.
  tick(state, ctx): IttifakState {
    return advance(state, ctx.now);
  },

  publicView(state, ctx): IttifakPublicView {
    const phase = phaseOf(state, ctx.now);
    const s = advance(state, ctx.now);
    return {
      players: [...state.players],
      phase,
      startedAt: state.startedAt,
      talkEndsAt: state.talkEndsAt,
      voteEndsAt: state.voteEndsAt,
      finishAt: state.finishAt,
      ready: phase === "talk" ? [...state.skipped] : phase === "vote" ? [...state.locked] : [],
      reveal:
        phase === "reveal" && s.finalVotes !== null ? ittifakReveal(s.players, s.finalVotes, s.promises) : null,
    };
  },

  view(state, playerId, ctx): IttifakView {
    if (playerId === null || !state.players.includes(playerId)) {
      return { myVote: null, myPromises: [], locked: false };
    }
    const s = advance(state, ctx.now);
    const final = s.finalVotes;
    const phase = phaseOf(state, ctx.now);
    const locked =
      phase === "talk"
        ? s.skipped.includes(playerId)
        : phase === "vote"
          ? s.locked.includes(playerId)
          : false;
    return { myVote: voteOf(final ?? s.votes, playerId), myPromises: [...promisesOf(s.promises, playerId)], locked };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.finishAt;
  },

  // Oylar oyuncu kimlikleridir (kısa, ayırt edici değil): metin araması koruyamaz. Gizlilik yapısaldır
  // (publicView oylama bitene kadar oy/sayı içermez, view yalnız kendi oyunu verir); bkz. ittifak.test.ts "gizlilik".
  secrets() {
    return [];
  },

  result(state) {
    const final = state.finalVotes ?? ittifakFillVotes(state.players, state.seed, state.votes);
    const { scores } = ittifakReveal(state.players, final, state.promises);
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
