import { poolEntries } from "../../content.js";
import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import { SIZMA_POOL } from "./pool.js";
import {
  SIZMA_CLUE_CAP_MS,
  SIZMA_LOCK_GRACE_MS,
  SIZMA_NOTICE_MS,
  SIZMA_NOTICE_POINTS,
  SIZMA_REVEAL_MS,
  SIZMA_VOTE_MS,
  type SizmaAction,
  type SizmaPhase,
  type SizmaPublicView,
  type SizmaReveal,
  type SizmaView,
} from "./types.js";

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
  /** "Sızma sen miydin?" aşamasının bitişi; herkes cevaplayınca reduce'ta öne çekilir. */
  noticeEndsAt: number;
  finishAt: number;
  /** "Sızma sen miydin?" cevapları (gizli; yalnız sızmanınki sonuçta açılır). */
  notices: Record<string, boolean>;
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
  selfNoticed = false,
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
  // Kendini fark eden sızma ek puan alır (yakalansa da kurtulsa da).
  if (selfNoticed) scores[infiltrator] = (scores[infiltrator] ?? 0) + SIZMA_NOTICE_POINTS;
  return { tally, caught, scores };
}

/** Oylama bitişinden sonraki zamanlar (fark ettin mi? aşaması ve sonuç). */
function timesAfterVote(voteEndsAt: number): { voteEndsAt: number; noticeEndsAt: number; finishAt: number } {
  const noticeEndsAt = voteEndsAt + SIZMA_NOTICE_MS;
  return { voteEndsAt, noticeEndsAt, finishAt: noticeEndsAt + SIZMA_REVEAL_MS };
}

const noticedOf = (s: SizmaState): boolean => s.notices[s.infiltrator] === true;

function stageAt(state: SizmaState, now: number): SizmaPhase {
  if (now >= state.noticeEndsAt) return "reveal";
  if (now >= state.voteEndsAt) return "notice";
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
      "Oylamaya geç, sızmayı bul; sonda “Sızma sen miydin?” sorusunu yanıtla",
    ],
  },

  parseAction(raw: unknown): SizmaAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (r.kind === "skip" || r.kind === "lock") {
      return Object.keys(r).length === 1 ? { kind: r.kind } : null;
    }
    if (r.kind === "notice") {
      return Object.keys(r).length === 2 && typeof r.yes === "boolean"
        ? { kind: "notice", yes: r.yes }
        : null;
    }
    if (Object.keys(r).length !== 2 || r.kind !== "vote") return null;
    const target = r.target;
    if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
    return { kind: "vote", target };
  },

  setup(players: readonly string[], ctx: GameContext): SizmaState {
    const pairs = poolEntries(SIZMA_POOL, ctx.content);
    const pair = pairs[ctx.rng.int(pairs.length)] as readonly [string, string];
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
      ...timesAfterVote(voteEndsAt),
      notices: {},
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
    if (ctx.now >= state.noticeEndsAt) return { rejected: "ended" };
    const everyoneIn = (done: readonly string[]): boolean => {
      const active = state.players.filter((id) => ctx.connected.includes(id));
      return active.length > 0 && active.every((id) => done.includes(id));
    };

    if (action.kind === "notice") {
      if (ctx.now < state.voteEndsAt) return { rejected: "not_notice_yet" };
      // Cevap tek seferliktir.
      if (Object.hasOwn(state.notices, playerId)) return { rejected: "locked" };
      const notices = { ...state.notices, [playerId]: action.yes };
      if (!everyoneIn(Object.keys(notices))) return { ...state, notices };
      // Herkes cevapladı: aşama 1 sn sonra biter, sonuç süresi buna göre kayar.
      const noticeEndsAt = Math.min(state.noticeEndsAt, ctx.now + SIZMA_LOCK_GRACE_MS);
      return { ...state, notices, noticeEndsAt, finishAt: noticeEndsAt + SIZMA_REVEAL_MS };
    }
    if (ctx.now >= state.voteEndsAt) return { rejected: "ended" };

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
        ...timesAfterVote(voteEndsAt),
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
      return { ...state, locked, voteClosing: true, ...timesAfterVote(voteEndsAt) };
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
      const { tally, caught, scores } = sizmaOutcome(
        state.players,
        state.infiltrator,
        state.votes,
        noticedOf(state),
      );
      reveal = {
        infiltrator: state.infiltrator,
        commonWord: state.commonWord,
        infiltratorWord: state.infiltratorWord,
        votes: { ...state.votes },
        tally,
        caught,
        selfNoticed: noticedOf(state),
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
      noticeEndsAt: state.noticeEndsAt,
      finishAt: state.finishAt,
      ready:
        phase === "clue"
          ? [...state.ready]
          : phase === "vote"
            ? [...state.locked]
            : phase === "notice"
              ? Object.keys(state.notices)
              : [],
      reveal,
    };
  },

  view(state, playerId): SizmaView {
    if (playerId === null || !state.players.includes(playerId)) {
      return { word: null, myVote: null, myNotice: null, locked: false };
    }
    const phase = state.stage;
    return {
      word: playerId === state.infiltrator ? state.infiltratorWord : state.commonWord,
      myVote: voteOf(state.votes, playerId),
      myNotice: Object.hasOwn(state.notices, playerId) ? (state.notices[playerId] ?? null) : null,
      locked:
        phase === "clue"
          ? state.ready.includes(playerId)
          : phase === "vote"
            ? state.locked.includes(playerId)
            : phase === "notice" && Object.hasOwn(state.notices, playerId),
    };
  },

  /** Sonuç açılışı "fark ettin mi?" aşamasının bittiği an başlar. */
  revealAt(state): number | null {
    return state.noticeEndsAt;
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
    const { scores } = sizmaOutcome(state.players, state.infiltrator, state.votes, noticedOf(state));
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
