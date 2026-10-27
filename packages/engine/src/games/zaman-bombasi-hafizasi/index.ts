import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  ZAMAN_BOMBASI_COLORS,
  ZAMAN_BOMBASI_INPUT_BASE_MS,
  ZAMAN_BOMBASI_INPUT_PER_ELEMENT_MS,
  ZAMAN_BOMBASI_INTRO_MS,
  ZAMAN_BOMBASI_PAUSE_FAIL_MS,
  ZAMAN_BOMBASI_PAUSE_OK_MS,
  ZAMAN_BOMBASI_START_LENGTH,
  ZAMAN_BOMBASI_STEP_MS,
  ZAMAN_BOMBASI_SUDDEN_DEATH_AFTER_MS,
  ZAMAN_BOMBASI_SUDDEN_DEATH_GROWTH,
  ZAMAN_BOMBASI_TOTAL_MS,
  type ZamanBombasiAction,
  type ZamanBombasiColor,
  type ZamanBombasiLast,
  type ZamanBombasiPhase,
  type ZamanBombasiPublicView,
  type ZamanBombasiView,
} from "./types.js";

export * from "./types.js";

export interface ZamanBombasiState {
  /** Sabit çevrim sırası (setup'ta bir kez karıştırılır). */
  order: string[];
  /** Elenenler, elenme sırasıyla. */
  eliminated: string[];
  scores: Record<string, number>;
  /** Rastgele renkler bu tohumdan ve sayaçtan türer; `ctx.rng` yalnız setup'ta kullanılır (okuma yolları saf kalır). */
  seed: number;
  draws: number;
  sequence: ZamanBombasiColor[];
  /** Sırası olan oyuncunun `order` içindeki yeri. */
  turnIndex: number;
  turn: number;
  /** Oynatmanın başladığı an (gelecekte olabilir: hazırlık evresi). */
  turnStart: number;
  /** Aktif oyuncunun şimdiye dek doğru bastıkları. */
  entered: ZamanBombasiColor[];
  /** Oyunun bitmesi için gereken elenme sayısı: ⌈başlangıç / 2⌉. */
  need: number;
  /** Oyunun kurulduğu an; 90 sn'lik toplam süre ve ani ölüm buradan ölçülür. */
  startedAt: number;
  /** Süre dolduğu için mi bitti (değilse elenmeyle). */
  timeUp: boolean;
  finished: boolean;
  endedAt: number | null;
  last: ZamanBombasiLast | null;
}

function drawColor(seed: number, index: number): ZamanBombasiColor {
  const rng = createRng((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  return ZAMAN_BOMBASI_COLORS[rng.int(ZAMAN_BOMBASI_COLORS.length)] as ZamanBombasiColor;
}

const inputStartOf = (s: ZamanBombasiState): number =>
  s.turnStart + s.sequence.length * ZAMAN_BOMBASI_STEP_MS;
const deadlineOf = (s: ZamanBombasiState): number =>
  inputStartOf(s) + ZAMAN_BOMBASI_INPUT_BASE_MS + s.sequence.length * ZAMAN_BOMBASI_INPUT_PER_ELEMENT_MS;
const endsAtOf = (s: ZamanBombasiState): number => s.startedAt + ZAMAN_BOMBASI_TOTAL_MS;

function nextActiveIndex(order: readonly string[], eliminated: readonly string[], from: number): number {
  for (let step = 1; step <= order.length; step++) {
    const i = (from + step) % order.length;
    if (!eliminated.includes(order[i] as string)) return i;
  }
  return from;
}

function phaseAt(s: ZamanBombasiState, now: number): ZamanBombasiPhase {
  if (s.finished) return "over";
  if (now < s.turnStart) return "pause";
  if (now < inputStartOf(s)) return "playback";
  return "input";
}

/** Sıradaki oyuncu elenir (yanlış basış veya zaman aşımı): −1, kalan aktifler +1, dizi yeni 2 renge döner. */
function eliminate(
  s: ZamanBombasiState,
  at: number,
  kind: "fail" | "timeout",
  color?: ZamanBombasiColor,
): ZamanBombasiState {
  const player = s.order[s.turnIndex] as string;
  const eliminated = [...s.eliminated, player];
  const scores = { ...s.scores };
  for (const id of s.order) {
    if (id === player) scores[id] = (scores[id] ?? 0) - 1;
    else if (!eliminated.includes(id)) scores[id] = (scores[id] ?? 0) + 1;
  }
  const last: ZamanBombasiLast = {
    turn: s.turn,
    player,
    kind,
    at,
    ...(kind === "fail" && color !== undefined
      ? { color, expected: s.sequence[s.entered.length] as ZamanBombasiColor }
      : {}),
  };
  if (eliminated.length >= s.need) {
    return { ...s, eliminated, scores, entered: [], finished: true, endedAt: at, last };
  }
  const sequence: ZamanBombasiColor[] = [];
  for (let i = 0; i < ZAMAN_BOMBASI_START_LENGTH; i++) sequence.push(drawColor(s.seed, s.draws + i));
  return {
    ...s,
    eliminated,
    scores,
    sequence,
    draws: s.draws + ZAMAN_BOMBASI_START_LENGTH,
    turnIndex: nextActiveIndex(s.order, eliminated, s.turnIndex),
    turn: s.turn + 1,
    turnStart: at + ZAMAN_BOMBASI_PAUSE_FAIL_MS,
    entered: [],
    last,
  };
}

/** Dizi tam ve doğru tekrarlandı: dizi 1 renk uzar, sıra sonraki aktif oyuncuya geçer. */
function succeed(s: ZamanBombasiState, at: number): ZamanBombasiState {
  const player = s.order[s.turnIndex] as string;
  // Ani ölüm: yeni dizi kurulduğu an (= bu sıranın bittiği an `at`) oyun başından 60 sn'den fazla geçmişse +2.
  const growth = at - s.startedAt > ZAMAN_BOMBASI_SUDDEN_DEATH_AFTER_MS ? ZAMAN_BOMBASI_SUDDEN_DEATH_GROWTH : 1;
  const sequence = [...s.sequence];
  for (let i = 0; i < growth; i++) sequence.push(drawColor(s.seed, s.draws + i));
  return {
    ...s,
    sequence,
    draws: s.draws + growth,
    turnIndex: nextActiveIndex(s.order, s.eliminated, s.turnIndex),
    turn: s.turn + 1,
    turnStart: at + ZAMAN_BOMBASI_PAUSE_OK_MS,
    entered: [],
    last: { turn: s.turn, player, kind: "ok", at },
  };
}

/**
 * `now`'a kadar süresi dolmuş sıraları kronolojik işler. Okuma yolları (görünümler, isFinished) ve reduce/tick
 * hep bunu kullanır; sonuç yalnız mutlak zamanlara bağlıdır, tick takvimine değil. Değişim yoksa aynı nesne döner.
 */
function advance(s: ZamanBombasiState, now: number): ZamanBombasiState {
  let cur = s;
  while (!cur.finished) {
    const due = deadlineOf(cur);
    const limit = endsAtOf(cur);
    // Toplam süre önce dolarsa (ya da aynı anda) giriş yapan oyuncunun sırası cezasız iptal edilir; oyun biter.
    if (limit <= due) {
      if (now < limit) break;
      return { ...cur, entered: [], finished: true, timeUp: true, endedAt: limit };
    }
    if (now < due) break;
    cur = eliminate(cur, due, "timeout");
  }
  return cur;
}

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const zamanBombasiHafizasi: GameDefinition<
  ZamanBombasiState,
  ZamanBombasiAction,
  ZamanBombasiView,
  ZamanBombasiPublicView
> = {
  id: "zaman-bombasi-hafizasi",
  name: "Zaman Bombası Hafızası",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Işık dizisini ezberle, sıra sende bomba patlamadan tekrarla!",
    steps: [
      "Yanan renkleri sırasıyla ezberle",
      "Sıran gelince aynı renklere aynı sırayla bas",
      "Yanlış basan ya da geç kalan elenir",
    ],
  },

  parseAction(raw: unknown): ZamanBombasiAction | null {
    if (!isRec(raw)) return null;
    const keys = Object.keys(raw);
    if (keys.length !== 2 || !keys.includes("kind") || !keys.includes("color")) return null;
    if (raw.kind !== "press") return null;
    const color = ZAMAN_BOMBASI_COLORS.find((c) => c === raw.color);
    return color === undefined ? null : { kind: "press", color };
  },

  setup(players: readonly string[], ctx: GameContext): ZamanBombasiState {
    const order = ctx.rng.shuffle(players);
    const seed = ctx.rng.int(2 ** 31);
    const scores: Record<string, number> = {};
    for (const id of players) scores[id] = 0;
    const sequence: ZamanBombasiColor[] = [];
    for (let i = 0; i < ZAMAN_BOMBASI_START_LENGTH; i++) sequence.push(drawColor(seed, i));
    return {
      order,
      eliminated: [],
      scores,
      seed,
      draws: ZAMAN_BOMBASI_START_LENGTH,
      sequence,
      turnIndex: 0,
      turn: 1,
      turnStart: ctx.now + ZAMAN_BOMBASI_INTRO_MS,
      entered: [],
      need: Math.ceil(players.length / 2),
      startedAt: ctx.now,
      timeUp: false,
      finished: false,
      endedAt: null,
      last: null,
    };
  },

  reduce(state, playerId, action, ctx): ZamanBombasiState | Rejected {
    const s = advance(state, ctx.now);
    if (s.finished) return { rejected: "ended" };
    if (!s.order.includes(playerId)) return { rejected: "not_participant" };
    if (s.eliminated.includes(playerId)) return { rejected: "eliminated" };
    if (s.order[s.turnIndex] !== playerId) return { rejected: "not_your_turn" };
    if (ctx.now < inputStartOf(s)) return { rejected: "not_input_yet" };
    const expected = s.sequence[s.entered.length] as ZamanBombasiColor;
    if (action.color !== expected) return eliminate(s, ctx.now, "fail", action.color);
    const entered = [...s.entered, action.color];
    if (entered.length === s.sequence.length) return succeed({ ...s, entered }, ctx.now);
    return { ...s, entered };
  },

  tick(state, ctx): ZamanBombasiState {
    return advance(state, ctx.now);
  },

  publicView(state, ctx): ZamanBombasiPublicView {
    const s = advance(state, ctx.now);
    const phase = phaseAt(s, ctx.now);
    const playbackIndex =
      phase === "playback"
        ? Math.min(s.sequence.length - 1, Math.floor((ctx.now - s.turnStart) / ZAMAN_BOMBASI_STEP_MS))
        : -1;
    return {
      order: [...s.order],
      eliminated: [...s.eliminated],
      scores: { ...s.scores },
      active: s.finished ? null : (s.order[s.turnIndex] ?? null),
      length: s.sequence.length,
      phase,
      turn: s.turn,
      turnStart: s.turnStart,
      inputStart: inputStartOf(s),
      deadline: deadlineOf(s),
      stepMs: ZAMAN_BOMBASI_STEP_MS,
      playbackIndex,
      sequence: phase === "pause" || phase === "playback" ? [...s.sequence] : null,
      pressed: phase === "input" ? [...s.entered] : [],
      need: s.need,
      startedAt: s.startedAt,
      endsAt: endsAtOf(s),
      suddenDeathAt: s.startedAt + ZAMAN_BOMBASI_SUDDEN_DEATH_AFTER_MS,
      timeUp: s.timeUp,
      last: s.last ? { ...s.last } : null,
    };
  },

  view(state, playerId, ctx): ZamanBombasiView {
    const s = advance(state, ctx.now);
    if (playerId === null || !s.order.includes(playerId)) {
      return { isOut: false, myTurn: false, turnsAway: null };
    }
    const eliminated = s.eliminated.includes(playerId);
    if (eliminated || s.finished) return { isOut: eliminated, myTurn: false, turnsAway: null };
    let away = 0;
    let i = s.turnIndex;
    while (s.order[i] !== playerId) {
      i = nextActiveIndex(s.order, s.eliminated, i);
      away++;
    }
    return { isOut: false, myTurn: away === 0, turnsAway: away };
  },

  isFinished(state, ctx): boolean {
    return advance(state, ctx.now).finished;
  },

  result(state) {
    return { miniScores: { ...state.scores }, awards: { ...state.scores } };
  },

  secrets() {
    return [];
  },
};
