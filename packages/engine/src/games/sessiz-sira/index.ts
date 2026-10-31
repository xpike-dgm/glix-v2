import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { rankAwards } from "../scoring.js";
import {
  SESSIZ_CARDS,
  SESSIZ_END_GRACE_MS,
  SESSIZ_LAST_REVEAL_MS,
  SESSIZ_LIVES,
  SESSIZ_LOOK_MS,
  SESSIZ_MAX_CARD,
  SESSIZ_PLAY_MS,
  SESSIZ_REVEAL_MS,
  SESSIZ_ROUNDS,
  type SessizAction,
  type SessizMissed,
  type SessizPlay,
  type SessizPublicView,
  type SessizView,
} from "./types.js";

export * from "./types.js";

export interface SessizState {
  players: string[];
  startedAt: number;
  /** Tur başına dağıtılacak eller (kurulumda çekilir; gizli). */
  deals: Record<string, number[]>[];
  round: number;
  phase: "look" | "play" | "reveal";
  phaseStartedAt: number;
  phaseEndsAt: number;
  /** Bu turda elde kalan kartlar (küçükten büyüğe). */
  hands: Record<string, number[]>;
  plays: SessizPlay[];
  missed: SessizMissed[];
  lives: number;
  scores: Record<string, number>;
}

const revealMs = (round: number): number =>
  round === SESSIZ_ROUNDS - 1 ? SESSIZ_LAST_REVEAL_MS : SESSIZ_REVEAL_MS;
const isDead = (s: SessizState): boolean => s.lives <= 0;
const remaining = (s: SessizState): number => Object.values(s.hands).reduce((n, h) => n + h.length, 0);

/** Elde kalan her kartı açıp atar (süre dolması ya da canların bitmesi). */
function discardAll(s: SessizState): SessizState {
  const lost: SessizMissed[] = [];
  const hands: Record<string, number[]> = {};
  for (const id of s.players) {
    hands[id] = [];
    for (const card of s.hands[id] ?? []) lost.push({ playerId: id, card });
  }
  lost.sort((a, b) => a.card - b.card);
  return { ...s, hands, missed: [...s.missed, ...lost] };
}

/** Süresi dolan aşamaları sırayla ilerletir (tick takvimine bağlı değildir). */
function advance(state: SessizState, now: number): SessizState {
  let s = state;
  while (now >= s.phaseEndsAt) {
    if (s.phase === "look") {
      s = {
        ...s,
        phase: "play",
        phaseStartedAt: s.phaseEndsAt,
        phaseEndsAt: s.phaseEndsAt + (SESSIZ_PLAY_MS[s.round] ?? 20_000),
      };
    } else if (s.phase === "play") {
      // Süre doldu (ya da tur zaten kapanmak üzereydi): kalan kartlar açılır, can kaybedilir.
      const left = remaining(s);
      const closed = left > 0 ? { ...discardAll(s), lives: s.lives - 1 } : s;
      s = {
        ...closed,
        phase: "reveal",
        phaseStartedAt: s.phaseEndsAt,
        phaseEndsAt: s.phaseEndsAt + revealMs(s.round),
      };
    } else if (s.round < SESSIZ_ROUNDS - 1 && !isDead(s)) {
      const round = s.round + 1;
      s = {
        ...s,
        round,
        phase: "look",
        phaseStartedAt: s.phaseEndsAt,
        phaseEndsAt: s.phaseEndsAt + SESSIZ_LOOK_MS,
        hands: Object.fromEntries(s.players.map((id) => [id, [...(s.deals[round]?.[id] ?? [])]])),
        plays: [],
        missed: [],
      };
    } else break;
  }
  return s;
}

const isEnd = (s: SessizState): boolean =>
  s.phase === "reveal" && (s.round === SESSIZ_ROUNDS - 1 || isDead(s));

function awardsOf(s: SessizState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of s.players) out[id] = 0;
  // Takım battıysa kimse genel skor almaz.
  if (isDead(s)) return out;
  const awards = rankAwards(s.scores, { positiveOnly: true });
  for (const id of s.players) out[id] = awards[id] ?? 0;
  return out;
}

export const sessizSira: GameDefinition<SessizState, SessizAction, SessizView, SessizPublicView> = {
  id: "sessiz-sira",
  name: "Sessiz Sıra",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  // TASLAK: sahip kuralları onaylayana dek rastgele havuza girmez (ve oyun zaten yalnız taslak yolundan açılır).
  randomPool: false,
  briefing: {
    goal: "Konuşmadan, kartlar küçükten büyüğe sırayla oynansın! 3 can paylaşıyorsunuz.",
    steps: [
      "Gizli kartın var; konuşmadan, sırası gelince OYNA'ya bas (her seferinde en küçük kartın oynanır)",
      "Daha küçük bir kart hâlâ birinin elindeyse hata: o kartlar açılır, takım 1 can kaybeder",
      "Doğru hamle +1, hatalı hamle −1; takım ayakta kalırsa en yüksek +2, ikinci +1",
    ],
  },

  parseAction(raw: unknown): SessizAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    return rec.kind === "play" && Object.keys(rec).length === 1 ? { kind: "play" } : null;
  },

  setup(players: readonly string[], ctx: GameContext): SessizState {
    const deals: Record<string, number[]>[] = [];
    for (let r = 0; r < SESSIZ_ROUNDS; r++) {
      const per = SESSIZ_CARDS[r] ?? 1;
      const deck = ctx.rng.shuffle(Array.from({ length: SESSIZ_MAX_CARD }, (_, i) => i + 1));
      const hands: Record<string, number[]> = {};
      players.forEach((id, i) => {
        hands[id] = deck.slice(i * per, (i + 1) * per).sort((a, b) => a - b);
      });
      deals.push(hands);
    }
    const scores: Record<string, number> = {};
    for (const id of players) scores[id] = 0;
    return {
      players: [...players],
      startedAt: ctx.now,
      deals,
      round: 0,
      phase: "look",
      phaseStartedAt: ctx.now,
      phaseEndsAt: ctx.now + SESSIZ_LOOK_MS,
      hands: Object.fromEntries(players.map((id) => [id, [...(deals[0]?.[id] ?? [])]])),
      plays: [],
      missed: [],
      lives: SESSIZ_LIVES,
      scores,
    };
  },

  reduce(state, playerId, _action, ctx): SessizState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    const s = advance(state, ctx.now);
    if (s.phase !== "play") return { rejected: "not_playing" };
    const hand = s.hands[playerId] ?? [];
    const card = hand[0];
    if (card === undefined) return { rejected: "no_cards" };
    // Başka birinin elinde daha küçük kart var mı?
    const lower: SessizMissed[] = [];
    for (const id of s.players) {
      if (id === playerId) continue;
      for (const c of s.hands[id] ?? []) if (c < card) lower.push({ playerId: id, card: c });
    }
    lower.sort((a, b) => a.card - b.card);
    const ok = lower.length === 0;
    const hands: Record<string, number[]> = {};
    for (const id of s.players) {
      if (id === playerId) hands[id] = hand.slice(1);
      else hands[id] = (s.hands[id] ?? []).filter((c) => c > card);
    }
    let next: SessizState = {
      ...s,
      hands,
      plays: [...s.plays, { playerId, card, ok }],
      missed: [...s.missed, ...lower],
      scores: { ...s.scores, [playerId]: (s.scores[playerId] ?? 0) + (ok ? 1 : -1) },
      lives: ok ? s.lives : s.lives - 1,
    };
    // Canlar bitince elde kalanlar da açılır.
    if (isDead(next)) next = discardAll(next);
    if (remaining(next) === 0) {
      next = { ...next, phaseEndsAt: Math.min(next.phaseEndsAt, ctx.now + SESSIZ_END_GRACE_MS) };
    }
    return next;
  },

  tick(state, ctx): SessizState {
    return advance(state, ctx.now);
  },

  publicView(state, ctx): SessizPublicView {
    const s = advance(state, ctx.now);
    const counts: Record<string, number> = {};
    for (const id of s.players) counts[id] = s.hands[id]?.length ?? 0;
    return {
      startedAt: s.startedAt,
      round: s.round + 1,
      rounds: SESSIZ_ROUNDS,
      phase: s.phase,
      phaseStartedAt: s.phaseStartedAt,
      phaseEndsAt: s.phaseEndsAt,
      lives: Math.max(0, s.lives),
      maxLives: SESSIZ_LIVES,
      counts,
      plays: s.plays,
      missed: s.missed,
      totals: { ...s.scores },
      dead: isDead(s) && s.phase === "reveal",
      final: isEnd(s) ? awardsOf(s) : null,
    };
  },

  view(state, playerId, ctx): SessizView {
    const s = advance(state, ctx.now);
    return { hand: playerId === null ? [] : [...(s.hands[playerId] ?? [])] };
  },

  /** Sonuç açılışı son açılışla (son tur ya da takım battığında) başlar. */
  revealAt(state, ctx): number | null {
    const s = advance(state, ctx.now);
    return isEnd(s) ? s.phaseStartedAt : null;
  },

  isFinished(state, ctx): boolean {
    const s = advance(state, ctx.now);
    return isEnd(s) && ctx.now >= s.phaseEndsAt;
  },

  /**
   * Kartlar 1–99 arası kısa sayılardır; alt dizgi sızıntı denetimi onları koruyamaz. Gizlilik yapısal sağlanır ve
   * test edilir (sessiz-sira.test.ts, "gizlilik"): ortak görünümde yalnız kart sayıları ve oynanmış/açılmış kartlar var.
   */
  secrets() {
    return [];
  },

  result(state) {
    // Durum ilerletilmemişse (oyun bitmeden sonuç) elde kalan kartlar puan getirmez; yalnız oynananlar sayılır.
    return { miniScores: { ...state.scores }, awards: awardsOf(state) };
  },
};
