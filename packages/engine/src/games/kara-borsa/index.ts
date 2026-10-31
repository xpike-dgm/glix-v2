import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { hasExactKeys, isPlainObject } from "../drawing.js";
import { everyoneReady } from "../ready.js";
import { makeHints } from "./hints.js";
import {
  BORSA_BID_MS,
  BORSA_CURSED_CHANCE,
  BORSA_EARLY_MS,
  BORSA_REVEAL_MS,
  BORSA_ROUNDS,
  BORSA_START_COINS,
  type BorsaAction,
  type BorsaHintPair,
  type BorsaPhase,
  type BorsaPublicView,
  type BorsaRoundResult,
  type BorsaView,
  borsaCursedValue,
  borsaMaxValue,
  borsaProfit,
  borsaScale,
} from "./types.js";

export * from "./hints.js";
export * from "./types.js";

interface Bid {
  amount: number;
  /** Teklif sırası (eşitlikte küçük olan önce verdi). */
  seq: number;
}

export interface BorsaState {
  players: string[];
  startedAt: number;
  /** Önceden belirlenmiş gizli kutu değerleri (tur başına) ve oyuncu başına ipuçları. */
  values: number[];
  hints: Record<string, BorsaHintPair>[];
  /** Geçerli tur ve aşama; yalnız `advance` ilerletir. */
  round: number;
  stage: BorsaPhase;
  stageStartedAt: number;
  /** Teklif aşamasının bitişi (erken bitişte öne çekilir); açılış aşamasında açılışın bitişi. */
  stageEndsAt: number;
  bids: Record<string, Bid>;
  nextSeq: number;
  coins: Record<string, number>;
  boxes: Record<string, number>;
  history: BorsaRoundResult[];
}

/** Tur sonucu: en yüksek teklif (> 0) kutuyu alır; eşitlikte önce teklif veren. */
export function settleRound(
  players: readonly string[],
  bids: Record<string, Bid>,
  value: number,
): BorsaRoundResult {
  const out: Record<string, number> = {};
  let best: { id: string; bid: Bid } | null = null;
  for (const id of players) {
    const bid = bids[id];
    out[id] = bid?.amount ?? 0;
    if (!bid || bid.amount <= 0) continue;
    if (!best || bid.amount > best.bid.amount || (bid.amount === best.bid.amount && bid.seq < best.bid.seq))
      best = { id, bid };
  }
  return { value, winner: best?.id ?? null, price: best?.bid.amount ?? 0, bids: out };
}

/** Teklifini vermiş sayılanlar: verenler ve jetonu bitenler (yalnız 0 verebilir). */
const bidders = (s: BorsaState): string[] =>
  s.players.filter((id) => s.bids[id] !== undefined || (s.coins[id] ?? 0) <= 0);

function settle(s: BorsaState): BorsaState {
  const result = settleRound(s.players, s.bids, s.values[s.round] as number);
  const coins = { ...s.coins };
  const boxes = { ...s.boxes };
  if (result.winner !== null) {
    coins[result.winner] = (coins[result.winner] ?? 0) - result.price;
    boxes[result.winner] = (boxes[result.winner] ?? 0) + result.value;
  }
  return {
    ...s,
    coins,
    boxes,
    history: [...s.history, result],
    stage: "reveal",
    stageStartedAt: s.stageEndsAt,
    stageEndsAt: s.stageEndsAt + BORSA_REVEAL_MS,
  };
}

/** Zamanı gelen aşamaları ilerletir; değişiklik yoksa aynı nesneyi döner. */
function advance(state: BorsaState, now: number): BorsaState {
  let s = state;
  while (s.stage !== "done" && now >= s.stageEndsAt) {
    if (s.stage === "bid") {
      s = settle(s);
    } else if (s.round + 1 < BORSA_ROUNDS) {
      s = {
        ...s,
        round: s.round + 1,
        stage: "bid",
        stageStartedAt: s.stageEndsAt,
        stageEndsAt: s.stageEndsAt + BORSA_BID_MS,
        bids: {},
      };
    } else {
      s = { ...s, stage: "done" };
    }
  }
  return s;
}

/** Oyun içi puan: kâr = (kalan jeton + kutu değerleri) − 100 (KB-M1; eksi olabilir). */
export function borsaScores(s: BorsaState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of s.players) out[id] = borsaProfit(s.coins[id] ?? 0, s.boxes[id] ?? 0);
  return out;
}

/**
 * Genel skor (KB-M1): yalnız kârı 0'dan büyük olanlar ödül alır. En yüksek kâr +2 (eşitlerin hepsi), sonraki farklı
 * kâr +1 (eşitlerin hepsi), diğerleri 0. Kimse kâr etmediyse kimse ödül almaz; eksi ödül yoktur.
 */
export function borsaAwards(scores: Record<string, number>): Record<string, number> {
  const awards: Record<string, number> = {};
  const levels = [...new Set(Object.values(scores).filter((v) => v > 0))].sort((a, b) => b - a);
  for (const [id, v] of Object.entries(scores)) {
    awards[id] = v > 0 && v === levels[0] ? 2 : v > 0 && v === levels[1] ? 1 : 0;
  }
  return awards;
}

export const karaBorsa: GameDefinition<BorsaState, BorsaAction, BorsaView, BorsaPublicView> = {
  id: "kara-borsa",
  name: "Kara Borsa",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Gizemli kutuları ucuza kap, en çok kârı sen et!",
    steps: [
      "Her tur bir kutu gelir: 0–60 değerinde ya da lanetli (−20). Değerini yalnız sana özel ipucu anlatır. Son kutu iki kat!",
      "Gizli bir teklif ver: en yükseği kutuyu alır ve teklifini öder",
      "Kutunun değeri ödediğinden fazlaysa kâr edersin; en çok kâr eden kazanır",
    ],
  },

  parseAction(raw: unknown): BorsaAction | null {
    if (!isPlainObject(raw) || raw.kind !== "bid" || !hasExactKeys(raw, ["kind", "amount"])) return null;
    const amount = raw.amount;
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0 || amount > 1_000_000)
      return null;
    return { kind: "bid", amount };
  },

  setup(players: readonly string[], ctx: GameContext): BorsaState {
    const values: number[] = [];
    const hints: Record<string, BorsaHintPair>[] = [];
    for (let r = 0; r < BORSA_ROUNDS; r++) {
      // Son tur Büyük Kutu (KB-M2): 0..120 ya da lanetli −40; ipucu eşikleri de iki kat.
      const value =
        ctx.rng.next() < BORSA_CURSED_CHANCE ? borsaCursedValue(r) : ctx.rng.int(borsaMaxValue(r) + 1);
      values.push(value);
      hints.push(makeHints(value, players, ctx.rng, borsaScale(r)));
    }
    const coins: Record<string, number> = {};
    const boxes: Record<string, number> = {};
    for (const id of players) {
      coins[id] = BORSA_START_COINS;
      boxes[id] = 0;
    }
    return {
      players: [...players],
      startedAt: ctx.now,
      values,
      hints,
      round: 0,
      stage: "bid",
      stageStartedAt: ctx.now,
      stageEndsAt: ctx.now + BORSA_BID_MS,
      bids: {},
      nextSeq: 0,
      coins,
      boxes,
      history: [],
    };
  },

  reduce(raw, playerId, action, ctx): BorsaState | Rejected {
    if (!raw.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < raw.startedAt) return { rejected: "not_started" };
    const s = advance(raw, ctx.now);
    if (s.stage === "done") return { rejected: "ended" };
    if (s.stage !== "bid") return { rejected: "wrong_phase" };
    if (s.bids[playerId] !== undefined) return { rejected: "already_bid" };
    if (action.amount > (s.coins[playerId] ?? 0)) return { rejected: "insufficient" };
    const bids = { ...s.bids, [playerId]: { amount: action.amount, seq: s.nextSeq } };
    const next = { ...s, bids, nextSeq: s.nextSeq + 1 };
    // Bağlı herkes (jetonu bitenler dahil) teklifini verdiyse tur 1 sn sonra biter; kopuk oyuncu beklenmez.
    const given = new Set(bidders(next));
    if (everyoneReady(next.players, ctx.connected, (id) => given.has(id))) {
      return { ...next, stageEndsAt: Math.min(next.stageEndsAt, ctx.now + BORSA_EARLY_MS) };
    }
    return next;
  },

  tick(state, ctx): BorsaState {
    return advance(state, ctx.now);
  },

  publicView(s): BorsaPublicView {
    const reveal = s.stage === "reveal" || s.stage === "done" ? (s.history[s.round] ?? null) : null;
    return {
      phase: s.stage,
      round: s.round,
      rounds: BORSA_ROUNDS,
      startedAt: s.startedAt,
      stageStartedAt: s.stageStartedAt,
      stageEndsAt: s.stageEndsAt,
      players: [...s.players],
      coins: { ...s.coins },
      boxes: { ...s.boxes },
      bidIds: s.stage === "bid" ? bidders(s) : [],
      history: s.history.map((h) => ({ ...h, bids: { ...h.bids } })),
      reveal: reveal ? { ...reveal, bids: { ...reveal.bids } } : null,
    };
  },

  view(s, playerId): BorsaView {
    if (playerId === null || !s.players.includes(playerId) || s.stage === "done") {
      return { hint: null, myBid: null };
    }
    const pair = s.hints[s.round]?.[playerId];
    return {
      hint: pair ? { main: { ...pair.main }, extra: { ...pair.extra } } : null,
      myBid: s.bids[playerId]?.amount ?? null,
    };
  },

  /** Sonuç açılışı son turun açılışıyla başlar. */
  revealAt(s, ctx): number | null {
    const a = advance(s, ctx.now);
    return a.round === BORSA_ROUNDS - 1 && a.stage !== "bid" ? a.stageStartedAt : null;
  },

  isFinished(s, ctx): boolean {
    return advance(s, ctx.now).stage === "done";
  },

  /**
   * Gizli değerler (kutu değeri, ipucu, teklifler) kısa sayılardır; alt dizgi denetimiyle izlenemez. Gizlilik
   * yapısaldır ve ayrıca test edilir (kara-borsa.test.ts, "gizlilik").
   */
  secrets() {
    return [];
  },

  result(raw) {
    let s = raw;
    // Hesap tick zamanlamasından bağımsız: kalan turlar teklifsiz kapanır.
    while (s.stage !== "done") s = advance(s, Number.POSITIVE_INFINITY);
    const scores = borsaScores(s);
    return { miniScores: scores, awards: borsaAwards(scores) };
  },
};
