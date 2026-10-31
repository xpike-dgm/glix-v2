import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  KULE_AT_MAX_AGE_MS,
  KULE_INTRO_MS,
  KULE_PAUSE_MISS_MS,
  KULE_PAUSE_OK_MS,
  KULE_SPEED_START,
  KULE_START_WIDTH,
  KULE_TOTAL_MS,
  KULE_TRACK,
  KULE_TURN_MS,
  type KuleAction,
  type KuleBlock,
  type KuleLast,
  type KulePublicView,
  type KuleView,
  kuleBlockLeft,
  kuleCut,
  kuleNextSpeed,
} from "./types.js";

export * from "./types.js";

export interface KuleState {
  /** Sabit çevrim sırası (setup'ta bir kez karıştırılır). */
  order: string[];
  /** Çıkanlar, çıkış sırasıyla. */
  eliminated: string[];
  perfects: Record<string, number>;
  /** Kule, alttan üste (ilk eleman taban). */
  tower: KuleBlock[];
  /** Hız çarpanı (binde); kule sıfırlanınca başa döner. */
  speed: number;
  floors: number;
  turnIndex: number;
  turn: number;
  /** Bloğun hareketinin başladığı an (gelecekte olabilir: hazırlık/ara). */
  turnStart: number;
  /** Oyunun bitmesi için gereken çıkış sayısı: ⌈başlangıç / 2⌉. */
  need: number;
  startedAt: number;
  timeUp: boolean;
  finished: boolean;
  endedAt: number | null;
  last: KuleLast | null;
}

const BASE: KuleBlock = {
  left: (KULE_TRACK - KULE_START_WIDTH) / 2,
  width: KULE_START_WIDTH,
  perfect: false,
};
const freshTower = (): KuleBlock[] => [{ ...BASE }];

const deadlineOf = (s: KuleState): number => s.turnStart + KULE_TURN_MS;
const endsAtOf = (s: KuleState): number => s.startedAt + KULE_TOTAL_MS;
const topOf = (s: KuleState): KuleBlock => s.tower[s.tower.length - 1] ?? BASE;

function nextActiveIndex(order: readonly string[], eliminated: readonly string[], from: number): number {
  for (let step = 1; step <= order.length; step++) {
    const i = (from + step) % order.length;
    if (!eliminated.includes(order[i] as string)) return i;
  }
  return from;
}

/**
 * Puanlar (kural 9): çıkanlar −1, kalanlar +1; en çok kusursuz yapan (en az 1) hepsi ek +1.
 * Oyun sürerken de aynı formül "şu an bitse" puanını verir.
 */
function scoresOf(s: KuleState): Record<string, number> {
  const best = Math.max(0, ...s.order.map((id) => s.perfects[id] ?? 0));
  const scores: Record<string, number> = {};
  for (const id of s.order) {
    let v = s.eliminated.includes(id) ? -1 : 1;
    if (best >= 1 && (s.perfects[id] ?? 0) === best) v += 1;
    scores[id] = v;
  }
  return scores;
}

/** Aktif oyuncu `at` anında bloğu bırakır; kesme/ıska uygulanır, sıra ilerler (ya da oyun biter). */
function drop(s: KuleState, at: number, auto: boolean): KuleState {
  const player = s.order[s.turnIndex] as string;
  const top = topOf(s);
  const left = kuleBlockLeft(s.turnStart, s.speed, top.width, at);
  const cut = kuleCut(top, left, top.width);
  const base: Pick<KuleLast, "turn" | "player" | "at" | "auto" | "dropLeft" | "dropWidth"> = {
    turn: s.turn,
    player,
    at,
    auto,
    dropLeft: left,
    dropWidth: top.width,
  };
  if (cut.kind === "miss" || cut.block === null) {
    const eliminated = [...s.eliminated, player];
    const last: KuleLast = {
      ...base,
      kind: "miss",
      cutLeft: cut.cutLeft,
      cutWidth: cut.cutWidth,
      fallen: s.tower.map((b) => ({ ...b })),
    };
    const reset: KuleState = {
      ...s,
      eliminated,
      tower: freshTower(),
      speed: KULE_SPEED_START,
      floors: 0,
      last,
    };
    if (eliminated.length >= s.need) return { ...reset, finished: true, endedAt: at };
    return {
      ...reset,
      turnIndex: nextActiveIndex(s.order, eliminated, s.turnIndex),
      turn: s.turn + 1,
      turnStart: at + KULE_PAUSE_MISS_MS,
    };
  }
  const perfect = cut.kind === "perfect";
  const perfects = perfect ? { ...s.perfects, [player]: (s.perfects[player] ?? 0) + 1 } : s.perfects;
  return {
    ...s,
    perfects,
    tower: [...s.tower, cut.block],
    speed: kuleNextSpeed(s.speed),
    floors: s.floors + 1,
    turnIndex: nextActiveIndex(s.order, s.eliminated, s.turnIndex),
    turn: s.turn + 1,
    turnStart: at + KULE_PAUSE_OK_MS,
    last: { ...base, kind: cut.kind, cutLeft: cut.cutLeft, cutWidth: cut.cutWidth },
  };
}

/**
 * `now`'a kadar süresi dolmuş sıraları kronolojik işler. Okuma yolları, reduce ve tick hep bunu kullanır;
 * sonuç yalnız mutlak zamanlara bağlıdır, tick takvimine değil. Değişim yoksa aynı nesne döner.
 */
function advance(s: KuleState, now: number): KuleState {
  let cur = s;
  while (!cur.finished) {
    const due = deadlineOf(cur);
    const limit = endsAtOf(cur);
    // Toplam süre önce dolarsa (ya da aynı anda) sırası gelmiş oyuncunun bırakışı cezasız iptal edilir.
    if (limit <= due) {
      if (now < limit) break;
      return { ...cur, finished: true, timeUp: true, endedAt: limit };
    }
    if (now < due) break;
    cur = drop(cur, due, true);
  }
  return cur;
}

/** Kural 4: istemcinin bildirdiği an `[turnStart, now]` içinde ve 400 ms'den eski değilse geçerlidir; yoksa `now`. */
export function kuleDropTime(at: number, turnStart: number, now: number): number {
  return at >= turnStart && at <= now && now - at <= KULE_AT_MAX_AGE_MS ? at : now;
}

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const kuleUstasi: GameDefinition<KuleState, KuleAction, KuleView, KulePublicView> = {
  id: "kule-ustasi",
  name: "Kule Ustası",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Bloğu kulenin tam üstüne bırak, kuleyi düşürme!",
    steps: [
      "Blok kulenin üstünde kayar; sıran gelince dokunup bırak",
      "Taşan kısım kesilir, kule daralır; tam oturtursan Kusursuz!",
      "Iskalayan kuleyi yıkar ve çıkar; kalanlar puan alır",
    ],
  },

  parseAction(raw: unknown): KuleAction | null {
    if (!isRec(raw)) return null;
    const keys = Object.keys(raw);
    if (keys.length !== 2 || !keys.includes("kind") || !keys.includes("at")) return null;
    if (raw.kind !== "drop") return null;
    const at = raw.at;
    if (typeof at !== "number" || !Number.isFinite(at) || Math.abs(at) > 1e15) return null;
    return { kind: "drop", at: Math.floor(at) };
  },

  setup(players: readonly string[], ctx: GameContext): KuleState {
    const order = ctx.rng.shuffle(players);
    const perfects: Record<string, number> = {};
    for (const id of players) perfects[id] = 0;
    return {
      order,
      eliminated: [],
      perfects,
      tower: freshTower(),
      speed: KULE_SPEED_START,
      floors: 0,
      turnIndex: 0,
      turn: 1,
      turnStart: ctx.now + KULE_INTRO_MS,
      need: Math.ceil(players.length / 2),
      startedAt: ctx.now,
      timeUp: false,
      finished: false,
      endedAt: null,
      last: null,
    };
  },

  reduce(state, playerId, action, ctx): KuleState | Rejected {
    const s = advance(state, ctx.now);
    if (s.finished) return { rejected: "ended" };
    if (!s.order.includes(playerId)) return { rejected: "not_participant" };
    if (s.eliminated.includes(playerId)) return { rejected: "eliminated" };
    if (s.order[s.turnIndex] !== playerId) return { rejected: "not_your_turn" };
    if (ctx.now < s.turnStart) return { rejected: "not_started" };
    return drop(s, kuleDropTime(action.at, s.turnStart, ctx.now), false);
  },

  tick(state, ctx): KuleState {
    return advance(state, ctx.now);
  },

  publicView(state, ctx): KulePublicView {
    const s = advance(state, ctx.now);
    return {
      order: [...s.order],
      eliminated: [...s.eliminated],
      scores: scoresOf(s),
      perfects: { ...s.perfects },
      active: s.finished ? null : (s.order[s.turnIndex] ?? null),
      turn: s.turn,
      turnStart: s.turnStart,
      deadline: deadlineOf(s),
      speed: s.speed,
      blockWidth: topOf(s).width,
      tower: s.tower.map((b) => ({ ...b })),
      floors: s.floors,
      need: s.need,
      startedAt: s.startedAt,
      endsAt: endsAtOf(s),
      timeUp: s.timeUp,
      last: s.last
        ? { ...s.last, ...(s.last.fallen ? { fallen: s.last.fallen.map((b) => ({ ...b })) } : {}) }
        : null,
    };
  },

  view(state, playerId, ctx): KuleView {
    const s = advance(state, ctx.now);
    if (playerId === null || !s.order.includes(playerId)) {
      return { isOut: false, myTurn: false, turnsAway: null };
    }
    const out = s.eliminated.includes(playerId);
    if (out || s.finished) return { isOut: out, myTurn: false, turnsAway: null };
    let away = 0;
    let i = s.turnIndex;
    while (s.order[i] !== playerId) {
      i = nextActiveIndex(s.order, s.eliminated, i);
      away++;
    }
    return { isOut: false, myTurn: away === 0, turnsAway: away };
  },

  /** Sonuç ekranı oyunun bittiği an (yeterli çıkış ya da süre sonu) başlar. */
  revealAt(state, ctx): number | null {
    return advance(state, ctx.now).endedAt;
  },

  isFinished(state, ctx): boolean {
    return advance(state, ctx.now).finished;
  },

  result(state) {
    const scores = scoresOf(state);
    // Kusursuz bırakış sayısı sunucuda "Kule Ustası" rozeti için tutulur; istemciye gitmez.
    const stats: Record<string, Record<string, number>> = {};
    for (const id of state.order) stats[id] = { perfects: state.perfects[id] ?? 0 };
    return { miniScores: { ...scores }, awards: { ...scores }, stats };
  },

  secrets() {
    return [];
  },
};
