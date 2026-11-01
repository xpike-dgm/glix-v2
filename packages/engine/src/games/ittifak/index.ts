import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { derivedRng, drawSeed } from "../seeded.js";
import {
  ITTIFAK_BAND_MS,
  ITTIFAK_LOCK_GRACE_MS,
  ITTIFAK_VOTE_MS,
  type IttifakAction,
  type IttifakLabel,
  type IttifakPhase,
  type IttifakPromise,
  type IttifakPublicView,
  type IttifakReveal,
  type IttifakView,
  ittifakMaxPromises,
  ittifakRevealMs,
  ittifakTalkMs,
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
  /** Oyuncu -> son verilen oy (gizli; oylama bitene kadar yalnız sahibinin görünümünde). Kopan oyuncuya da verilebilir. */
  votes: Record<string, string>;
  /** Oylama bitince tick/eylem tarafından bir kez kurulur: eksik oylar tamamlanmış hâli. */
  finalVotes: Record<string, string> | null;
  /** Yalnız sunucunun yayın tetiklemesi içindir: talk -> vote geçişini işaretler. */
  voting: boolean;
}

function voteOf(votes: Record<string, string>, id: string): string | null {
  return Object.hasOwn(votes, id) ? (votes[id] ?? null) : null;
}

const validVote = (players: readonly string[], votes: Record<string, string>, id: string): boolean => {
  const v = voteOf(votes, id);
  return v !== null && v !== id && players.includes(v);
};

/** Oy vermediği için oyu zarla atanacak (ya da atanmış) oyuncular, katılım sırasıyla (IT-M3). */
export function ittifakRandomVoters(players: readonly string[], votes: Record<string, string>): string[] {
  return players.filter((id) => !validVote(players, votes, id));
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
    if (v !== null && validVote(players, votes, id)) {
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

/**
 * Genel skora giden ödül (IT-M1): en çok oy alan(lar) +2, sonraki farklı oy sayısı +1, diğerleri 0. Herkesin oyu
 * eşitse herkes +1. 0 oy alan hiçbir zaman ödül almaz.
 */
export function ittifakAwards(scores: Record<string, number>): Record<string, number> {
  const awards: Record<string, number> = {};
  const entries = Object.entries(scores);
  for (const [id] of entries) awards[id] = 0;
  const positive = entries.filter(([, n]) => n > 0);
  if (positive.length === 0) return awards;
  const top = Math.max(...positive.map(([, n]) => n));
  if (entries.every(([, n]) => n === top)) {
    for (const [id] of entries) awards[id] = 1;
    return awards;
  }
  const below = positive.filter(([, n]) => n < top).map(([, n]) => n);
  const next = below.length > 0 ? Math.max(...below) : null;
  for (const [id, n] of positive) {
    if (n === top) awards[id] = 2;
    else if (n === next) awards[id] = 1;
  }
  return awards;
}

/** Karşılıklı oy veren ikililer (IT-U6 "İTTİFAK"); zarla atanan oy ittifak sayılmaz. Katılım sırasıyla. */
export function ittifakAlliances(
  players: readonly string[],
  votes: Record<string, string>,
  random: readonly string[] = [],
): [string, string][] {
  const out: [string, string][] = [];
  for (const [i, a] of players.entries()) {
    const b = voteOf(votes, a);
    if (b === null || random.includes(a) || random.includes(b)) continue;
    if (players.indexOf(b) > i && voteOf(votes, b) === a) out.push([a, b]);
  }
  return out;
}

/** Söz verenin sonuç etiketi (IT-U6); söz vermediyse null. */
export function ittifakLabel(
  promises: readonly IttifakPromise[] | undefined,
  random: boolean,
): IttifakLabel | null {
  if (!promises || promises.length === 0) return null;
  const kept = promises.filter((p) => p.kept).length;
  if (kept === promises.length) return "eri";
  if (kept > 0) return "cifte";
  return random ? "zar" : "hain";
}

/**
 * Sonuç: oylar, alınan oy, ödül, zarla atananlar ve sözler. `random` verilmezse (yalnız doldurulmuş oylar elde
 * olduğunda) boş sayılır.
 */
export function ittifakReveal(
  players: readonly string[],
  votes: Record<string, string>,
  promises: Record<string, string[]> = {},
  random: readonly string[] = [],
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
  return {
    votes: { ...votes },
    scores,
    awards: ittifakAwards(scores),
    random: players.filter((id) => random.includes(id)),
    promises: kept,
  };
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
    goal: "En çok oyu topla: birinci +2, ikinci +1!",
    steps: [
      "Süre boyunca oy iste, vaatte bulun; istersen gizlice söz işareti koy",
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
    const talkEndsAt = ctx.now + ittifakTalkMs(players.length);
    const voteEndsAt = talkEndsAt + ITTIFAK_BAND_MS + ITTIFAK_VOTE_MS;
    return {
      players: [...players],
      seed: drawSeed(ctx.rng),
      startedAt: ctx.now,
      talkEndsAt,
      voteEndsAt,
      finishAt: voteEndsAt + ittifakRevealMs(players.length),
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
        return {
          ...state,
          promises: { ...state.promises, [playerId]: mine.filter((id) => id !== action.target) },
        };
      }
      if (mine.length >= ittifakMaxPromises(state.players.length)) return { rejected: "too_many_promises" };
      return { ...state, promises: { ...state.promises, [playerId]: [...mine, action.target] } };
    }
    if (action.kind === "skip") {
      if (ctx.now >= state.talkEndsAt) return { rejected: "not_talking" };
      if (state.talkClosing) return { rejected: "closed" };
      if (state.skipped.includes(playerId)) return state;
      const skipped = [...state.skipped, playerId];
      const active = state.players.filter((id) => ctx.connected.includes(id));
      if (active.length === 0 || !active.every((id) => skipped.includes(id))) return { ...state, skipped };
      // Konuşma kısalır; geçiş bandı ve oylama süresi aynı kalır.
      const talkEndsAt = Math.min(state.talkEndsAt, ctx.now + ITTIFAK_LOCK_GRACE_MS);
      const voteEndsAt = talkEndsAt + ITTIFAK_BAND_MS + ITTIFAK_VOTE_MS;
      return {
        ...state,
        skipped,
        talkClosing: true,
        talkEndsAt,
        voteEndsAt,
        finishAt: voteEndsAt + ittifakRevealMs(state.players.length),
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
        finishAt: voteEndsAt + ittifakRevealMs(state.players.length),
      };
    }
    if (action.target === playerId) return { rejected: "self_target" };
    if (!state.players.includes(action.target)) return { rejected: "unknown_target" };
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
        phase === "reveal" && s.finalVotes !== null
          ? ittifakReveal(s.players, s.finalVotes, s.promises, ittifakRandomVoters(s.players, s.votes))
          : null,
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
    return {
      myVote: voteOf(final ?? s.votes, playerId),
      myPromises: [...promisesOf(s.promises, playerId)],
      locked,
    };
  },

  /** Sonuç açılışı oylama süresinin bittiği an başlar. */
  revealAt(state): number | null {
    return state.voteEndsAt;
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
    const { scores, awards } = ittifakReveal(state.players, final, state.promises);
    return { miniScores: { ...scores }, awards };
  },
};
