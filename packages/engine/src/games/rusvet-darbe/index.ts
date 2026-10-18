import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { derivedRng, drawSeed } from "../seeded.js";
import {
  type Allocation,
  type DuelHand,
  RUSVET_GIVE_MS,
  RUSVET_MAX_HANDS,
  RUSVET_MAX_PER_PLAYER,
  RUSVET_REVEAL_MS,
  RUSVET_SIGN_MS,
  RUSVET_SIGN_REVEAL_MS,
  RUSVET_VOTE_MS,
  type RusvetAction,
  type RusvetPhase,
  type RusvetPublicView,
  type RusvetReveal,
  type RusvetView,
  SIGNS,
  type Sign,
} from "./types.js";

export * from "./types.js";

type Stage = "vote" | "duel" | "give" | "reveal";

export interface RusvetState {
  players: string[];
  /** Rastgele doldurma için `ctx.rng`'den kurulumda alınan tohum (görünümlere girmez). */
  seed: number;
  startedAt: number;
  voteEndsAt: number;
  stage: Stage;
  /** Oyuncu -> son verilen başkanlık oyu (gizli). */
  votes: Record<string, string>;
  /** Seçim bitince kurulur: eksik oylar tamamlanmış hâli. */
  finalVotes: Record<string, string> | null;
  /** Seçimde alınan oy sayıları (seçim bitince). */
  counts: Record<string, number> | null;
  /** Dağıtılacak jeton sayısı (başkanın aldığı oy). */
  budget: number;
  president: string | null;
  /** Düello: başlamış el sayısı, adaylar, elin başlangıcı, işaretler ve işaretlerin kapandığı. */
  hand: number;
  candidates: string[];
  handStartedAt: number;
  signs: Record<string, Sign>;
  handClosed: boolean;
  hands: DuelHand[];
  /** Dağıtım: başlangıç, bitiş ve başkanın son dağıtımı (gizli; başkandan başkasına açılmaz). */
  giveStartedAt: number;
  giveEndsAt: number;
  tokens: Record<string, number>;
  /** Dağıtım bitince kurulur: kalan jetonlar rastgele tamamlanmış hâli. */
  finalTokens: Record<string, number> | null;
  finishAt: number | null;
}

const own = <T>(rec: Record<string, T>, id: string): T | undefined =>
  Object.hasOwn(rec, id) ? rec[id] : undefined;

/** Eksik oyları, kendisi dışındaki rastgele bir katılımcıyla tamamlar (tohumdan, belirli). */
export function rusvetFillVotes(
  players: readonly string[],
  seed: number,
  votes: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of players) {
    const v = own(votes, id);
    if (v !== undefined && v !== id && players.includes(v)) {
      out[id] = v;
      continue;
    }
    const others = players.filter((p) => p !== id);
    out[id] = others[derivedRng(seed, "vote", id).int(others.length)] as string;
  }
  return out;
}

export function rusvetCounts(
  players: readonly string[],
  votes: Record<string, string>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of players) counts[id] = 0;
  for (const id of players) {
    const to = own(votes, id);
    if (to !== undefined && Object.hasOwn(counts, to)) counts[to] = (counts[to] ?? 0) + 1;
  }
  return counts;
}

/** `a` işareti `b` işaretini yener mi: taş makası, makas kâğıdı, kâğıt taşı. */
export function signBeats(a: Sign, b: Sign): boolean {
  return (a === "tas" && b === "makas") || (a === "makas" && b === "kagit") || (a === "kagit" && b === "tas");
}

function fillSigns(seed: number, hand: number, candidates: readonly string[], signs: Record<string, Sign>) {
  const out: Record<string, Sign> = {};
  for (const id of candidates) {
    const given = own(signs, id);
    out[id] = given ?? (SIGNS[derivedRng(seed, "sign", hand, id).int(SIGNS.length)] as Sign);
  }
  return out;
}

/**
 * Bir elin sonucu. Tam iki farklı işaret varsa kazanan işareti verenler devam eder; tek ya da üç işaret varsa
 * sonuç yok sayılır ve el tekrarlanır (adayların hepsi devam eder).
 */
export function resolveHand(candidates: readonly string[], signs: Record<string, Sign>): DuelHand {
  const used = [...new Set(candidates.map((id) => signs[id] as Sign))];
  const x = used[0];
  const y = used[1];
  let advance = [...candidates];
  let replay = true;
  if (used.length === 2 && x !== undefined && y !== undefined) {
    const winner = signBeats(x, y) ? x : y;
    advance = candidates.filter((id) => signs[id] === winner);
    replay = false;
  }
  return { candidates: [...candidates], signs: { ...signs }, advance, replay };
}

/** Kalan jetonları, kişi başı sınıra uyarak rastgele dağıtır (tohumdan, belirli). Başkan kendine veremez. */
export function rusvetFillTokens(
  players: readonly string[],
  seed: number,
  president: string,
  budget: number,
  tokens: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  let given = 0;
  for (const id of players) {
    const n = id === president ? 0 : Math.min(RUSVET_MAX_PER_PLAYER, Math.max(0, own(tokens, id) ?? 0));
    out[id] = n;
    given += n;
  }
  let k = 0;
  while (given < budget) {
    const open = players.filter((id) => id !== president && (out[id] ?? 0) < RUSVET_MAX_PER_PLAYER);
    if (open.length === 0) break;
    const pick = open[derivedRng(seed, "token", k++).int(open.length)] as string;
    out[pick] = (out[pick] ?? 0) + 1;
    given++;
  }
  return out;
}

function toGive(s: RusvetState, at: number, president: string): RusvetState {
  return {
    ...s,
    stage: "give",
    president,
    giveStartedAt: at,
    giveEndsAt: at + RUSVET_GIVE_MS,
  };
}

/** Zamana göre ilerletir; saftır ve mantıksal zamanla çalışır (tick sıklığından bağımsız). */
function advance(state: RusvetState, now: number): RusvetState {
  let s = state;
  for (;;) {
    if (s.stage === "vote") {
      if (now < s.voteEndsAt) return s;
      const finalVotes = rusvetFillVotes(s.players, s.seed, s.votes);
      const counts = rusvetCounts(s.players, finalVotes);
      const top = Math.max(...s.players.map((id) => counts[id] ?? 0));
      const leaders = s.players.filter((id) => counts[id] === top);
      s = { ...s, finalVotes, counts, budget: top };
      const only = leaders[0];
      if (leaders.length === 1 && only !== undefined) {
        s = toGive(s, s.voteEndsAt, only);
      } else {
        s = {
          ...s,
          stage: "duel",
          hand: 1,
          candidates: leaders,
          handStartedAt: s.voteEndsAt,
          signs: {},
          handClosed: false,
        };
      }
    } else if (s.stage === "duel") {
      const signEnd = s.handStartedAt + RUSVET_SIGN_MS;
      const revealEnd = signEnd + RUSVET_SIGN_REVEAL_MS;
      if (!s.handClosed) {
        if (now < signEnd) return s;
        s = { ...s, handClosed: true, signs: fillSigns(s.seed, s.hand, s.candidates, s.signs) };
      } else {
        if (now < revealEnd) return s;
        const done = resolveHand(s.candidates, s.signs);
        const hands = [...s.hands, done];
        const next = done.advance;
        const last = next[0];
        if (next.length === 1 && last !== undefined) {
          s = toGive({ ...s, hands }, revealEnd, last);
        } else if (s.hand >= RUSVET_MAX_HANDS) {
          const pick = next[derivedRng(s.seed, "president").int(next.length)] as string;
          s = toGive({ ...s, hands }, revealEnd, pick);
        } else {
          s = {
            ...s,
            hands,
            hand: s.hand + 1,
            candidates: next,
            handStartedAt: revealEnd,
            signs: {},
            handClosed: false,
          };
        }
      }
    } else if (s.stage === "give") {
      if (now < s.giveEndsAt) return s;
      const president = s.president as string;
      s = {
        ...s,
        stage: "reveal",
        finalTokens: rusvetFillTokens(s.players, s.seed, president, s.budget, s.tokens),
        finishAt: s.giveEndsAt + RUSVET_REVEAL_MS,
      };
    } else {
      return s;
    }
  }
}

function scoresOf(s: RusvetState): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of s.players) scores[id] = (s.finalTokens ? own(s.finalTokens, id) : 0) ?? 0;
  if (s.president !== null) scores[s.president] = (scores[s.president] ?? 0) + 1;
  return scores;
}

function phaseOf(s: RusvetState): RusvetPhase {
  return s.stage;
}

function span(s: RusvetState): [number, number] {
  switch (s.stage) {
    case "vote":
      return [s.startedAt, s.voteEndsAt];
    case "duel": {
      const signEnd = s.handStartedAt + RUSVET_SIGN_MS;
      return s.handClosed ? [signEnd, signEnd + RUSVET_SIGN_REVEAL_MS] : [s.handStartedAt, signEnd];
    }
    case "give":
      return [s.giveStartedAt, s.giveEndsAt];
    default:
      return [s.giveEndsAt, s.finishAt ?? s.giveEndsAt];
  }
}

function allocationList(tokens: Record<string, number>, players: readonly string[]): Allocation[] {
  return players.flatMap((to) => {
    const n = own(tokens, to) ?? 0;
    return n > 0 ? [{ to, n }] : [];
  });
}

export const rusvetDarbe: GameDefinition<RusvetState, RusvetAction, RusvetView, RusvetPublicView> = {
  id: "rusvet-darbe",
  name: "Rüşvet ve Darbe",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Başkan ol, jetonları dağıt!",
    steps: [
      "Gizli oyunu ver, başkanlığı almaya çalış",
      "Başkan, aldığı oy kadar jetonu başkalarına dağıtır",
      "Başkan +1, jetonlar sahiplerine puan olur",
    ],
  },

  parseAction(raw: unknown): RusvetAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    const keys = Object.keys(r);
    if (r.kind === "vote") {
      if (keys.length !== 2) return null;
      const target = r.target;
      if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
      return { kind: "vote", target };
    }
    if (r.kind === "sign") {
      if (keys.length !== 2) return null;
      const sign = SIGNS.find((x) => x === r.sign);
      return sign === undefined ? null : { kind: "sign", sign };
    }
    if (r.kind === "give") {
      if (keys.length !== 2 || !Array.isArray(r.tokens) || r.tokens.length > 8) return null;
      const seen = new Set<string>();
      const tokens: Allocation[] = [];
      for (const item of r.tokens as unknown[]) {
        if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
        const a = item as Record<string, unknown>;
        if (Object.keys(a).length !== 2) return null;
        const { to, n } = a;
        if (typeof to !== "string" || to.length === 0 || to.length > 64 || seen.has(to)) return null;
        if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > RUSVET_MAX_PER_PLAYER) return null;
        seen.add(to);
        tokens.push({ to, n });
      }
      return { kind: "give", tokens };
    }
    return null;
  },

  setup(players: readonly string[], ctx: GameContext): RusvetState {
    return {
      players: [...players],
      seed: drawSeed(ctx.rng),
      startedAt: ctx.now,
      voteEndsAt: ctx.now + RUSVET_VOTE_MS,
      stage: "vote",
      votes: {},
      finalVotes: null,
      counts: null,
      budget: 0,
      president: null,
      hand: 0,
      candidates: [],
      handStartedAt: 0,
      signs: {},
      handClosed: false,
      hands: [],
      giveStartedAt: 0,
      giveEndsAt: 0,
      tokens: {},
      finalTokens: null,
      finishAt: null,
    };
  },

  reduce(state, playerId, action, ctx): RusvetState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    const s = advance(state, ctx.now);
    if (s.stage === "reveal") return { rejected: "ended" };

    if (action.kind === "vote") {
      if (s.stage !== "vote") return { rejected: "wrong_phase" };
      if (action.target === playerId) return { rejected: "self_target" };
      if (!s.players.includes(action.target)) return { rejected: "unknown_target" };
      if (!ctx.connected.includes(action.target)) return { rejected: "target_offline" };
      if (own(s.votes, playerId) === action.target) return s;
      return { ...s, votes: { ...s.votes, [playerId]: action.target } };
    }

    if (action.kind === "sign") {
      if (s.stage !== "duel" || s.handClosed) return { rejected: "wrong_phase" };
      if (!s.candidates.includes(playerId)) return { rejected: "not_candidate" };
      if (own(s.signs, playerId) === action.sign) return s;
      return { ...s, signs: { ...s.signs, [playerId]: action.sign } };
    }

    if (s.stage !== "give") return { rejected: "wrong_phase" };
    if (s.president !== playerId) return { rejected: "not_president" };
    let total = 0;
    const next: Record<string, number> = {};
    for (const { to, n } of action.tokens) {
      if (to === playerId) return { rejected: "self_target" };
      if (!s.players.includes(to)) return { rejected: "unknown_target" };
      if (n > (own(s.tokens, to) ?? 0) && !ctx.connected.includes(to)) return { rejected: "target_offline" };
      total += n;
      next[to] = n;
    }
    if (total > s.budget) return { rejected: "over_budget" };
    return { ...s, tokens: next };
  },

  // Aşama değişimleri durumu değiştirir: sunucu değişiklikte yayın yapar, böylece geçişler tam zamanında görünür.
  tick(state, ctx): RusvetState {
    return advance(state, ctx.now);
  },

  publicView(state, ctx): RusvetPublicView {
    const s = advance(state, ctx.now);
    const [from, to] = span(s);
    const elected = s.stage === "give" || s.stage === "reveal";
    let reveal: RusvetReveal | null = null;
    if (s.stage === "reveal" && s.finalVotes && s.counts && s.finalTokens) {
      reveal = {
        votes: { ...s.finalVotes },
        counts: { ...s.counts },
        tokens: { ...s.finalTokens },
        scores: scoresOf(s),
        duelHands: s.hands,
      };
    }
    return {
      players: [...s.players],
      phase: phaseOf(s),
      startedAt: s.startedAt,
      phaseStartedAt: from,
      phaseEndsAt: to,
      president: elected ? s.president : null,
      budget: elected ? s.budget : null,
      duel:
        s.stage === "duel"
          ? {
              hand: s.hand,
              candidates: [...s.candidates],
              signStartedAt: s.handStartedAt,
              signEndsAt: s.handStartedAt + RUSVET_SIGN_MS,
              revealEndsAt: s.handStartedAt + RUSVET_SIGN_MS + RUSVET_SIGN_REVEAL_MS,
              signs: s.handClosed ? { ...s.signs } : null,
              history: s.hands,
            }
          : null,
      reveal,
    };
  },

  view(state, playerId, ctx): RusvetView {
    const empty: RusvetView = { myVote: null, mySign: null, myTokens: null };
    if (playerId === null || !state.players.includes(playerId)) return empty;
    const s = advance(state, ctx.now);
    return {
      myVote: own(s.finalVotes ?? s.votes, playerId) ?? null,
      mySign: s.stage === "duel" && s.candidates.includes(playerId) ? (own(s.signs, playerId) ?? null) : null,
      myTokens:
        s.president === playerId && (s.stage === "give" || s.stage === "reveal")
          ? allocationList(s.finalTokens ?? s.tokens, s.players)
          : null,
    };
  },

  isFinished(state, ctx): boolean {
    const s = advance(state, ctx.now);
    return s.finishAt !== null && ctx.now >= s.finishAt;
  },

  // Oylar, işaretler ve dağıtım kısa kimlik/sözcüklerdir: metin araması koruyamaz. Gizlilik yapısaldır;
  // bkz. rusvet-darbe.test.ts "gizlilik".
  secrets() {
    return [];
  },

  result(state) {
    const scores = scoresOf(advance(state, Number.POSITIVE_INFINITY));
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
