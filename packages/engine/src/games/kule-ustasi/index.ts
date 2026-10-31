import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  KULE_AT_MAX_AGE_MS,
  KULE_INTRO_MS,
  KULE_PAUSE_MISS_MS,
  KULE_PAUSE_OK_MS,
  KULE_POINTS_FLOOR,
  KULE_POINTS_PERFECT,
  KULE_POINTS_STANDING,
  KULE_SPEED_START,
  KULE_START_WIDTH,
  KULE_TOTAL_MS,
  KULE_TRACK,
  KULE_TURN_MS,
  KULE_WARN_MS,
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
  /** Usta puanı (oyun sürerken; ayakta kalma +3'ü sonda eklenir). */
  usta: Record<string, number>;
  /** Yıkılan kulelerin en yükseği (kat). */
  record: number;
  /** Art arda kusursuz sayısı (oyuncudan bağımsız). */
  streak: number;
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
 * Usta puanı (KU-M1): kat +1, kusursuz kat +2; oyun bittiyse hâlâ oyunda olanlara +3 ("ayakta kaldın").
 * Oyun sürerken +3 eklenmez (şerit yalnız kazanılmış puanı gösterir).
 */
function ustaOf(s: KuleState, final = s.finished): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of s.order) {
    const standing = final && !s.eliminated.includes(id) ? KULE_POINTS_STANDING : 0;
    out[id] = (s.usta[id] ?? 0) + standing;
  }
  return out;
}

/**
 * Usta puanından genel skora giden sıralama ödülü (+2 / +1 / 0; eksi yok). Birincide eşitlikte hepsi +2, sonraki
 * farklı toplam +1; usta puanı 0 olan ödül almaz; herkesin toplamı aynı ve 0'dan büyükse herkes +1.
 * 2 oyuncuda: ıskalayıp çıkan (usta puanı ne olursa olsun) 0, kalan +2; ıska olmadan süre dolarsa yüksek olan +2,
 * diğeri +1, eşitse ikisi de +2.
 */
export function kuleAwards(
  order: readonly string[],
  usta: Readonly<Record<string, number>>,
  eliminated: readonly string[],
): Record<string, number> {
  const awards: Record<string, number> = Object.fromEntries(order.map((id) => [id, 0]));
  const value = (id: string): number => usta[id] ?? 0;
  if (order.length === 2) {
    const [a, b] = order as [string, string];
    const out = order.filter((id) => eliminated.includes(id));
    if (out.length > 0) {
      for (const id of order) awards[id] = out.includes(id) ? 0 : 2;
      return awards;
    }
    if (value(a) === value(b)) {
      awards[a] = 2;
      awards[b] = 2;
    } else {
      awards[value(a) > value(b) ? a : b] = 2;
      awards[value(a) > value(b) ? b : a] = 1;
    }
    return awards;
  }
  const positive = [...new Set(order.map(value).filter((v) => v > 0))].sort((x, y) => y - x);
  const top = positive[0];
  if (top === undefined) return awards;
  if (order.every((id) => value(id) === top)) {
    for (const id of order) awards[id] = 1;
    return awards;
  }
  const second = positive[1];
  for (const id of order) {
    if (value(id) === top) awards[id] = 2;
    else if (second !== undefined && value(id) === second) awards[id] = 1;
  }
  return awards;
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
      record: Math.max(s.record, s.floors),
      streak: 0,
      last,
    };
    if (eliminated.length >= s.need) return { ...reset, finished: true, endedAt: at };
    return {
      ...reset,
      turnIndex: nextActiveIndex(s.order, eliminated, s.turnIndex),
      turn: s.turn + 1,
      turnStart: at + KULE_PAUSE_MISS_MS + KULE_WARN_MS,
    };
  }
  const perfect = cut.kind === "perfect";
  const perfects = perfect ? { ...s.perfects, [player]: (s.perfects[player] ?? 0) + 1 } : s.perfects;
  const gain = perfect ? KULE_POINTS_PERFECT : KULE_POINTS_FLOOR;
  return {
    ...s,
    perfects,
    usta: { ...s.usta, [player]: (s.usta[player] ?? 0) + gain },
    streak: perfect ? s.streak + 1 : 0,
    tower: [...s.tower, cut.block],
    speed: kuleNextSpeed(s.speed),
    floors: s.floors + 1,
    turnIndex: nextActiveIndex(s.order, s.eliminated, s.turnIndex),
    turn: s.turn + 1,
    turnStart: at + KULE_PAUSE_OK_MS + KULE_WARN_MS,
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
      "Taşan kısım kesilir, kule daralır; tam oturtursan Kusursuz! (altın kat)",
      "Iskalayan kuleyi yıkar ve çıkar; ayakta kalan ve çok kat koyan kazanır",
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
      usta: { ...perfects },
      record: 0,
      streak: 0,
      tower: freshTower(),
      speed: KULE_SPEED_START,
      floors: 0,
      turnIndex: 0,
      turn: 1,
      turnStart: ctx.now + KULE_INTRO_MS + KULE_WARN_MS,
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
      usta: ustaOf(s),
      perfects: { ...s.perfects },
      awards: s.finished ? kuleAwards(s.order, ustaOf(s), s.eliminated) : null,
      record: s.record,
      streak: s.streak,
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
    // Oyun içi puan (miniScores) usta puanıdır; genel skora sıralama ödülü (+2 / +1 / 0) gider. Kartlardaki
    // "birinci/sonuncu" usta puanına göredir.
    // Sonuç her zaman bitmiş oyun gibi hesaplanır (erken bitişte de hâlâ oyunda olanlar "ayakta" sayılır).
    const usta = ustaOf(state, true);
    // Kusursuz bırakış sayısı sunucuda "Kule Ustası" rozeti için de tutulur (`stats`; yalnız sunucu muhasebesi).
    const stats: Record<string, Record<string, number>> = {};
    for (const id of state.order) stats[id] = { perfects: state.perfects[id] ?? 0 };
    return { miniScores: { ...usta }, awards: kuleAwards(state.order, usta, state.eliminated), stats };
  },

  secrets() {
    return [];
  },
};
