import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  ZAMAN_BOMBASI_ALERT_MS,
  ZAMAN_BOMBASI_COLORS,
  ZAMAN_BOMBASI_FAIL_SHOW_MS,
  ZAMAN_BOMBASI_INPUT_BASE_MS,
  ZAMAN_BOMBASI_INPUT_PER_ELEMENT_MS,
  ZAMAN_BOMBASI_INTRO_MS,
  ZAMAN_BOMBASI_NOBODY_OUT_POINTS,
  ZAMAN_BOMBASI_OK_SHOW_MS,
  ZAMAN_BOMBASI_PICK_MS,
  ZAMAN_BOMBASI_START_LENGTH,
  ZAMAN_BOMBASI_STEP_MS,
  ZAMAN_BOMBASI_SUDDEN_DEATH_AFTER_MS,
  ZAMAN_BOMBASI_SUDDEN_DEATH_GROWTH,
  ZAMAN_BOMBASI_SURVIVOR_POINTS,
  ZAMAN_BOMBASI_TOTAL_MS,
  type ZamanBombasiAction,
  type ZamanBombasiColor,
  type ZamanBombasiLast,
  type ZamanBombasiPhase,
  type ZamanBombasiPublicView,
  type ZamanBombasiThrow,
  type ZamanBombasiView,
} from "./types.js";

export * from "./types.js";

/** Seçim evresinin durumu (ZB-M1/M2). */
export interface ZamanBombasiPickState {
  by: string;
  kind: "throw" | "restart";
  opensAt: number;
  deadline: number;
  /** Seçilen renk (yalnız `throw`); seçilmediyse null. */
  color: ZamanBombasiColor | null;
  /** Diziye eklenecek renk sayısı (`throw`: 1, ani ölümde 2; `restart`: 0, dizi yeni 2 renktir). */
  growth: number;
  /** Hemen geri atılamayacak oyuncu (bombayı az önce atan; 3+ aktif oyuncuda). */
  blocked: string | null;
}

export interface ZamanBombasiState {
  /** Gösterim sırası (setup'ta bir kez karıştırılır); ilk eleman ilk sıranın sahibidir. */
  order: string[];
  /** Elenenler, elenme sırasıyla. */
  eliminated: string[];
  /** Oyun sırasında herkes 0; bitişte ZB-M3'e göre kesinleşir. */
  scores: Record<string, number>;
  /** Rastgele renk ve hedefler bu tohumdan ve sayaçtan türer; `ctx.rng` yalnız setup'ta kullanılır (okuma yolları saf kalır). */
  seed: number;
  draws: number;
  sequence: ZamanBombasiColor[];
  /** Bomba kimde: sıranın sahibi; seçim evresinde seçimi yapan. */
  active: string;
  /** Seçim evresi (bomba atılıyor); sıra evrelerinde null. */
  pick: ZamanBombasiPickState | null;
  /** Bombayı şu anki sıra sahibine atan (elenmede yeni kurbanı o seçer); atan yoksa null. */
  thrower: string | null;
  lastThrow: ZamanBombasiThrow | null;
  turn: number;
  /** Oynatmanın başladığı an (gelecekte olabilir: hazırlık/uyarı evresi). Seçim evresinde anlamsız. */
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

/** Maç tohumundan `index`'inci rastgele sayı üreteci (sayaç tabanlı: kayıttan tekrar birebir aynı). */
function drawRng(seed: number, index: number) {
  return createRng((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
}

function drawColor(seed: number, index: number): ZamanBombasiColor {
  return ZAMAN_BOMBASI_COLORS[drawRng(seed, index).int(ZAMAN_BOMBASI_COLORS.length)] as ZamanBombasiColor;
}

const inputStartOf = (s: ZamanBombasiState): number =>
  s.turnStart + s.sequence.length * ZAMAN_BOMBASI_STEP_MS;
const deadlineOf = (s: ZamanBombasiState): number =>
  inputStartOf(s) + ZAMAN_BOMBASI_INPUT_BASE_MS + s.sequence.length * ZAMAN_BOMBASI_INPUT_PER_ELEMENT_MS;
const endsAtOf = (s: ZamanBombasiState): number => s.startedAt + ZAMAN_BOMBASI_TOTAL_MS;

const activePlayers = (s: Pick<ZamanBombasiState, "order" | "eliminated">): string[] =>
  s.order.filter((id) => !s.eliminated.includes(id));

/** Seçimde atılabilecek oyuncular: aktif, kendisi değil, hemen geri atma engeli değil (gösterim sırasıyla). */
export function validTargets(
  s: Pick<ZamanBombasiState, "order" | "eliminated">,
  pick: Pick<ZamanBombasiPickState, "by" | "blocked">,
): string[] {
  return activePlayers(s).filter((id) => id !== pick.by && id !== pick.blocked);
}

function phaseAt(s: ZamanBombasiState, now: number): ZamanBombasiPhase {
  if (s.finished) return "over";
  if (s.pick) return "pick";
  if (now < s.turnStart) return "pause";
  if (now < inputStartOf(s)) return "playback";
  return "input";
}

/** Oyun biter; puanlar ZB-M3'e göre kesinleşir: hayatta kalan +2, elenen 0; kimse elenmediyse herkes +1. */
function finish(s: ZamanBombasiState, at: number, timeUp: boolean): ZamanBombasiState {
  const scores: Record<string, number> = {};
  const nobodyOut = s.eliminated.length === 0;
  for (const id of s.order) {
    scores[id] = nobodyOut
      ? ZAMAN_BOMBASI_NOBODY_OUT_POINTS
      : s.eliminated.includes(id)
        ? 0
        : ZAMAN_BOMBASI_SURVIVOR_POINTS;
  }
  return { ...s, scores, entered: [], pick: null, finished: true, timeUp, endedAt: at };
}

/** Bomba `to`'ya atılır (an `at`): yeni sıra uyarı payından sonra oynatmayla başlar. */
function throwTo(
  s: ZamanBombasiState,
  to: string,
  at: number,
  from: string | null,
  auto: boolean,
  sequence: ZamanBombasiColor[],
  draws: number,
): ZamanBombasiState {
  return {
    ...s,
    sequence,
    draws,
    active: to,
    pick: null,
    thrower: from,
    lastThrow: { from, to, at, auto },
    turn: s.turn + 1,
    turnStart: at + ZAMAN_BOMBASI_ALERT_MS,
    entered: [],
  };
}

/** Seçim tamamlanır (hedef seçildi ya da süre doldu): eksik renkler rastgele eklenir, bomba atılır. */
function resolvePick(s: ZamanBombasiState, at: number, target: string | null): ZamanBombasiState {
  const pick = s.pick;
  if (!pick) return s;
  let draws = s.draws;
  const sequence = [...s.sequence];
  for (let i = 0; i < pick.growth; i++) {
    if (i === 0 && pick.color !== null) sequence.push(pick.color);
    else sequence.push(drawColor(s.seed, draws++));
  }
  let to = target;
  if (to === null) {
    const options = validTargets(s, pick);
    to = options[drawRng(s.seed, draws++).int(options.length)] as string;
  }
  return throwTo(s, to, at, pick.by, target === null, sequence, draws);
}

/**
 * Sıradaki oyuncu elenir (yanlış basış veya zaman aşımı): dizi yeni 2 renge döner; yeni kurbanı bombayı ona atan
 * seçer (atan yoksa rastgele). Puan bitişte verilir (ZB-M3).
 */
function eliminate(
  s: ZamanBombasiState,
  at: number,
  kind: "fail" | "timeout",
  color?: ZamanBombasiColor,
): ZamanBombasiState {
  const player = s.active;
  const eliminated = [...s.eliminated, player];
  const last: ZamanBombasiLast = {
    turn: s.turn,
    player,
    kind,
    at,
    ...(kind === "fail" && color !== undefined
      ? { color, expected: s.sequence[s.entered.length] as ZamanBombasiColor }
      : {}),
  };
  const out: ZamanBombasiState = { ...s, eliminated, entered: [], last };
  if (eliminated.length >= s.need) return finish(out, at, false);
  let draws = s.draws;
  const sequence: ZamanBombasiColor[] = [];
  for (let i = 0; i < ZAMAN_BOMBASI_START_LENGTH; i++) sequence.push(drawColor(s.seed, draws++));
  const opensAt = at + ZAMAN_BOMBASI_FAIL_SHOW_MS;
  const picker = s.thrower !== null && !eliminated.includes(s.thrower) ? s.thrower : null;
  if (picker === null) {
    // Atan yok (ilk sıra): yeni kurban rastgele, patlama gösteriminden sonra.
    const options = activePlayers(out);
    const to = options[drawRng(s.seed, draws++).int(options.length)] as string;
    return throwTo(out, to, opensAt, null, true, sequence, draws);
  }
  return {
    ...out,
    sequence,
    draws,
    active: picker,
    pick: {
      by: picker,
      kind: "restart",
      opensAt,
      deadline: opensAt + ZAMAN_BOMBASI_PICK_MS,
      color: null,
      growth: 0,
      blocked: null,
    },
  };
}

/** Dizi tam ve doğru tekrarlandı: doğru giren rengi ve hedefi seçer (ZB-M1/M2). */
function succeed(s: ZamanBombasiState, at: number): ZamanBombasiState {
  const player = s.active;
  // Ani ölüm: yeni dizi kurulduğu an (= bu sıranın bittiği an `at`) oyun başından 60 sn'den fazla geçmişse +2.
  const growth =
    at - s.startedAt > ZAMAN_BOMBASI_SUDDEN_DEATH_AFTER_MS ? ZAMAN_BOMBASI_SUDDEN_DEATH_GROWTH : 1;
  // Hemen geri atma engeli yalnız 3+ aktif oyuncuda; 2 oyuncuda tek hedef bombayı atandır.
  const blocked = activePlayers(s).length >= 3 ? s.thrower : null;
  const opensAt = at + ZAMAN_BOMBASI_OK_SHOW_MS;
  return {
    ...s,
    entered: [],
    pick: {
      by: player,
      kind: "throw",
      opensAt,
      deadline: opensAt + ZAMAN_BOMBASI_PICK_MS,
      color: null,
      growth,
      blocked,
    },
    last: { turn: s.turn, player, kind: "ok", at },
  };
}

/**
 * `now`'a kadar süresi dolmuş sıraları ve seçimleri kronolojik işler. Okuma yolları (görünümler, isFinished) ve
 * reduce/tick hep bunu kullanır; sonuç yalnız mutlak zamanlara bağlıdır, tick takvimine değil. Değişim yoksa aynı
 * nesne döner.
 */
function advance(s: ZamanBombasiState, now: number): ZamanBombasiState {
  let cur = s;
  while (!cur.finished) {
    const due = cur.pick ? cur.pick.deadline : deadlineOf(cur);
    const limit = endsAtOf(cur);
    // Toplam süre önce dolarsa (ya da aynı anda) giriş yapan oyuncunun sırası (ya da seçim) cezasız iptal edilir.
    if (limit <= due) {
      if (now < limit) break;
      return finish(cur, limit, true);
    }
    if (now < due) break;
    cur = cur.pick ? resolvePick(cur, due, null) : eliminate(cur, due, "timeout");
  }
  return cur;
}

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const hasOnlyKeys = (raw: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(raw);
  return own.length === keys.length && keys.every((k) => own.includes(k));
};

/** Oyuncu kimliği sınırı (ağdan gelen hedef). */
const MAX_ID_LENGTH = 64;

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
    goal: "Işık dizisini ezberle, bomba patlamadan tekrarla ve bombayı birine at!",
    steps: [
      "Yanan renkleri sırasıyla ezberle; sıran gelince aynı sırayla bas",
      "Doğru girersen diziye bir renk ekle ve bombayı kime atacağını seç",
      "Yanlış basan ya da geç kalan elenir; sonda hayatta kalanlar kazanır",
    ],
  },

  parseAction(raw: unknown): ZamanBombasiAction | null {
    if (!isRec(raw)) return null;
    if (raw.kind === "press" || raw.kind === "color") {
      if (!hasOnlyKeys(raw, ["kind", "color"])) return null;
      const color = ZAMAN_BOMBASI_COLORS.find((c) => c === raw.color);
      return color === undefined ? null : { kind: raw.kind, color };
    }
    if (raw.kind === "target") {
      if (!hasOnlyKeys(raw, ["kind", "target"])) return null;
      const target = raw.target;
      if (typeof target !== "string" || target.length === 0 || target.length > MAX_ID_LENGTH) return null;
      return { kind: "target", target };
    }
    return null;
  },

  setup(players: readonly string[], ctx: GameContext): ZamanBombasiState {
    // İlk sıra sahibi rastgele: karıştırılmış sıranın ilki.
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
      active: order[0] as string,
      pick: null,
      thrower: null,
      lastThrow: null,
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
    if (action.kind !== "press") {
      // Renk ve hedef seçimi: yalnız seçim evresinde, yalnız seçim hakkı olana, süresi içinde (advance bitişte çözer).
      const pick = s.pick;
      if (!pick) return { rejected: "not_picking" };
      if (pick.by !== playerId) return { rejected: "not_your_pick" };
      if (action.kind === "color") {
        if (pick.kind !== "throw") return { rejected: "no_color_pick" };
        if (pick.color !== null) return { rejected: "color_done" };
        return { ...s, pick: { ...pick, color: action.color } };
      }
      if (pick.kind === "throw" && pick.color === null) return { rejected: "color_first" };
      if (!validTargets(s, pick).includes(action.target)) return { rejected: "bad_target" };
      return resolvePick(s, ctx.now, action.target);
    }
    if (s.pick) return { rejected: "picking" };
    if (s.active !== playerId) return { rejected: "not_your_turn" };
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
    // Seçim evresinde sıra henüz kurulmadı: süreler en geç başlangıca göre (seçim bitişi + uyarı) verilir.
    const turnStart = s.pick ? s.pick.deadline + ZAMAN_BOMBASI_ALERT_MS : s.turnStart;
    const length = s.sequence.length + (s.pick?.growth ?? 0);
    const inputStart = turnStart + length * ZAMAN_BOMBASI_STEP_MS;
    return {
      order: [...s.order],
      eliminated: [...s.eliminated],
      scores: { ...s.scores },
      active: s.finished ? null : s.active,
      pick: s.pick
        ? {
            by: s.pick.by,
            kind: s.pick.kind,
            opensAt: s.pick.opensAt,
            deadline: s.pick.deadline,
            colorDone: s.pick.kind === "restart" || s.pick.color !== null,
            blocked: s.pick.blocked,
          }
        : null,
      lastThrow: s.lastThrow ? { ...s.lastThrow } : null,
      length: s.pick ? s.sequence.length : length,
      phase,
      turn: s.turn,
      turnStart,
      inputStart,
      deadline: inputStart + ZAMAN_BOMBASI_INPUT_BASE_MS + length * ZAMAN_BOMBASI_INPUT_PER_ELEMENT_MS,
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
    const none: ZamanBombasiView = { isOut: false, myTurn: false, myPick: false, pickColor: null };
    if (playerId === null || !s.order.includes(playerId)) return none;
    const isOut = s.eliminated.includes(playerId);
    if (isOut || s.finished) return { ...none, isOut };
    const holder = s.active === playerId;
    if (s.pick) return { ...none, myPick: holder, pickColor: holder ? s.pick.color : null };
    return { ...none, myTurn: holder };
  },

  isFinished(state, ctx): boolean {
    return advance(state, ctx.now).finished;
  },

  result(state) {
    return { miniScores: { ...state.scores }, awards: { ...state.scores } };
  },

  notify(state, ctx) {
    // "Sıra sende!" yalnız diziyi girecek oyuncuya; seçim evresinde (bomba henüz atılmadı) kimseye.
    const s = advance(state, ctx.now);
    return s.finished || s.pick ? [] : [s.active];
  },

  nextWake(state, ctx): number | null {
    const s = advance(state, ctx.now);
    if (s.finished) return null;
    // Durum yalnız seçim/giriş süresi bitince ya da toplam süre dolunca kendiliğinden değişir.
    const due = s.pick ? s.pick.deadline : deadlineOf(s);
    const at = Math.min(due, endsAtOf(s));
    return at > ctx.now ? at : null;
  },

  secrets() {
    // Metin olarak aranabilir gizli değer yok. Seçilen renk hedef belli olana dek yalnız seçenin görünümündedir
    // (sonra dizinin parçası olarak herkese oynatılır); giriş evresinde dizi hiçbir görünümde yoktur.
    return [];
  },
};
