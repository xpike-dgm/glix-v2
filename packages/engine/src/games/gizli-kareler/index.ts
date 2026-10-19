import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  KARELER_BETWEEN_MS,
  KARELER_FINAL_MS,
  KARELER_LOCK_GRACE_MS,
  KARELER_STAGE_MS,
  type KarelerAction,
  type KarelerPublicView,
  type KarelerView,
  type KareReveal,
  type KareStatus,
  kareCells,
  kareSize,
} from "./types.js";

export * from "./types.js";

export interface KarelerState {
  players: string[];
  size: number;
  startedAt: number;
  /** 1. aşamanın en geç seçim bitişi. */
  stage1EndsAt: number;
  /** Herkes kilitlediyse 1. aşamanın erken bitişi (reduce'ta yazılır). */
  end1At: number | null;
  /** 2. aşama için aynı. */
  end2At: number | null;
  /** "Tamam" diyenler (aşama başına). */
  locked1: string[];
  locked2: string[];
  /** Yalnız seçim gönderenler; son seçim geçerlidir. */
  choices1: Record<string, number>;
  /** 2. aşama seçimleri (yalnız 1. aşamada tek kalanlar). */
  choices2: Record<string, number>;
  /**
   * Son tick'te görülen aşama. Görünümler `ctx.now`'dan türetilir; bu alan yalnız sunucunun
   * "durum değişti" sinyalini almasını sağlar (aksi halde aşama geçişleri yayınlanmaz). Sonuca etkisi yoktur.
   */
  seen: KarelerPhase;
}

/** 0 = 1. aşama seçimi, 1 = 1. aşama sonucu, 2 = 2. aşama seçimi, 3 = son sonuç, 4 = bitti. */
export type KarelerPhase = 0 | 1 | 2 | 3 | 4;

/** Bir aşamanın puanlaması: tek kalan +1, çakışan elenir, seçmeyen pasif. */
export function kareSettle(
  participants: readonly string[],
  choices: Readonly<Record<string, number>>,
): KareReveal {
  const per = new Map<number, number>();
  for (const id of participants) {
    const c = choices[id];
    if (c !== undefined) per.set(c, (per.get(c) ?? 0) + 1);
  }
  const out: KareReveal = { choices: {}, status: {} };
  for (const id of participants) {
    const c = choices[id];
    out.choices[id] = c ?? null;
    const status: KareStatus = c === undefined ? "passive" : (per.get(c) ?? 0) === 1 ? "solo" : "clash";
    out.status[id] = status;
  }
  return out;
}

const soloIds = (r: KareReveal): string[] =>
  Object.entries(r.status)
    .filter(([, s]) => s === "solo")
    .map(([id]) => id);

/** Oyunun aşamalarının tümünün (1. aşama bittikten sonra) türetilmiş planı. */
interface Plan {
  stage1: KareReveal;
  survivors: string[];
  walkover: string | null;
  stage2: { startsAt: number; endsAt: number; players: string[] } | null;
  stage2Reveal: KareReveal | null;
  finishesAt: number;
  points: Record<string, number>;
}

/** 1. aşamanın gerçek seçim bitişi. */
const stage1End = (state: KarelerState): number => state.end1At ?? state.stage1EndsAt;

function plan(state: KarelerState): Plan {
  const s1End = stage1End(state);
  const stage1 = kareSettle(state.players, state.choices1);
  const survivors = soloIds(stage1);
  const points: Record<string, number> = {};
  for (const id of state.players) points[id] = stage1.status[id] === "solo" ? 1 : 0;
  if (survivors.length < 2) {
    // Kimse kalmadı: oyun biter. Tek kişi kaldıysa ikinci aşamada rakipsiz sayılır ve +1 alır.
    const walkover = survivors[0] ?? null;
    if (walkover !== null) points[walkover] = (points[walkover] ?? 0) + 1;
    return {
      stage1,
      survivors,
      walkover,
      stage2: null,
      stage2Reveal: null,
      finishesAt: s1End + KARELER_FINAL_MS,
      points,
    };
  }
  const startsAt = s1End + KARELER_BETWEEN_MS;
  const endsAt = state.end2At ?? startsAt + KARELER_STAGE_MS;
  const stage2Reveal = kareSettle(survivors, state.choices2);
  for (const id of soloIds(stage2Reveal)) points[id] = (points[id] ?? 0) + 1;
  return {
    stage1,
    survivors,
    walkover: null,
    stage2: { startsAt, endsAt, players: survivors },
    stage2Reveal,
    finishesAt: endsAt + KARELER_FINAL_MS,
    points,
  };
}

export function karelerPhase(state: KarelerState, now: number): KarelerPhase {
  if (now < stage1End(state)) return 0;
  const p = plan(state);
  if (now >= p.finishesAt) return 4;
  if (!p.stage2) return 1;
  if (now < p.stage2.startsAt) return 1;
  if (now < p.stage2.endsAt) return 2;
  return 3;
}

export const gizliKareler: GameDefinition<KarelerState, KarelerAction, KarelerView, KarelerPublicView> = {
  id: "gizli-kareler",
  name: "Gizli Kareler",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Kimseyle çakışmayan karede tek başına kal!",
    steps: [
      "Gizli karelerden yalnızca birini seç",
      "Aynı kareyi seçen arkadaşların birlikte elenir",
      "Her aşamada tek kalan +1 alır; iki aşama var",
    ],
  },

  parseAction(raw: unknown): KarelerAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (rec.kind === "lock") return Object.keys(rec).length === 1 ? { kind: "lock" } : null;
    if (Object.keys(rec).length !== 2 || rec.kind !== "pick") return null;
    const cell = rec.cell;
    if (typeof cell !== "number" || !Number.isInteger(cell) || cell < 0 || cell > 15) return null;
    return { kind: "pick", cell };
  },

  setup(players: readonly string[], ctx: GameContext): KarelerState {
    return {
      players: [...players],
      size: kareSize(players.length),
      startedAt: ctx.now,
      stage1EndsAt: ctx.now + KARELER_STAGE_MS,
      end1At: null,
      end2At: null,
      locked1: [],
      locked2: [],
      choices1: {},
      choices2: {},
      seen: 0,
    };
  },

  reduce(state, playerId, action, ctx): KarelerState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (action.kind === "pick" && action.cell >= kareCells(state.size)) return { rejected: "out_of_range" };
    const phase = karelerPhase(state, ctx.now);
    if (phase !== 0 && phase !== 2) return { rejected: phase === 4 ? "ended" : "closed" };
    const stage = phase === 0 ? 1 : 2;
    if (stage === 2 && !plan(state).survivors.includes(playerId)) return { rejected: "eliminated" };
    const locked = stage === 1 ? state.locked1 : state.locked2;
    const choices = stage === 1 ? state.choices1 : state.choices2;
    if (locked.includes(playerId)) return { rejected: "locked" };
    // Herkes kilitlediyse aşama kapanmak üzeredir; geç gelen değişiklik kabul edilmez.
    if ((stage === 1 ? state.end1At : state.end2At) !== null) return { rejected: "closed" };
    if (action.kind === "pick") {
      if (choices[playerId] === action.cell) return state;
      return stage === 1
        ? { ...state, choices1: { ...state.choices1, [playerId]: action.cell } }
        : { ...state, choices2: { ...state.choices2, [playerId]: action.cell } };
    }
    if (choices[playerId] === undefined) return { rejected: "nothing_to_lock" };
    const nextLocked = [...locked, playerId];
    const participants = stage === 1 ? state.players : plan(state).survivors;
    const active = participants.filter((id) => ctx.connected.includes(id));
    const all = active.length > 0 && active.every((id) => nextLocked.includes(id));
    const nominal =
      stage === 1 ? state.stage1EndsAt : stage1End(state) + KARELER_BETWEEN_MS + KARELER_STAGE_MS;
    const endAt = all ? Math.min(ctx.now + KARELER_LOCK_GRACE_MS, nominal) : null;
    if (stage === 1) {
      return { ...state, locked1: nextLocked, end1At: endAt };
    }
    return { ...state, locked2: nextLocked, end2At: endAt };
  },

  tick(state, ctx): KarelerState {
    const phase = karelerPhase(state, ctx.now);
    return phase === state.seen ? state : { ...state, seen: phase };
  },

  publicView(state, ctx): KarelerPublicView {
    const base = { size: state.size, startedAt: state.startedAt, endsAt: stage1End(state) };
    if (ctx.now < stage1End(state)) {
      return {
        ...base,
        ready: [...state.locked1],
        stage2: null,
        stage1: null,
        stage2Reveal: null,
        finishesAt: null,
        walkover: null,
        points: null,
      };
    }
    const p = plan(state);
    const stage2Open = p.stage2 !== null && ctx.now >= p.stage2.endsAt;
    // 2. aşama seçimleri aşama bitene kadar yok; puanlar yalnız açılmış sonuçları içerir.
    const points: Record<string, number> = {};
    for (const id of state.players) {
      let v = p.stage1.status[id] === "solo" ? 1 : 0;
      if (p.walkover === id) v += 1;
      if (stage2Open && p.stage2Reveal?.status[id] === "solo") v += 1;
      points[id] = v;
    }
    return {
      ...base,
      stage2: p.stage2,
      stage1: p.stage1,
      stage2Reveal: stage2Open ? p.stage2Reveal : null,
      finishesAt: p.finishesAt,
      walkover: p.walkover,
      points,
      ready: karelerPhase(state, ctx.now) === 2 ? [...state.locked2] : [],
    };
  },

  view(state, playerId, ctx): KarelerView {
    if (playerId === null) return { myChoice: null, locked: false };
    const phase = karelerPhase(state, ctx.now);
    if (phase === 0) {
      return { myChoice: state.choices1[playerId] ?? null, locked: state.locked1.includes(playerId) };
    }
    if (phase === 2) {
      return { myChoice: state.choices2[playerId] ?? null, locked: state.locked2.includes(playerId) };
    }
    return { myChoice: null, locked: false };
  },

  isFinished(state, ctx): boolean {
    return karelerPhase(state, ctx.now) === 4;
  },

  /**
   * Gizli değerler 0–15 arası kısa hücre numaralarıdır; alt dizgi sızıntı denetimi onları koruyamaz
   * (en az 3 karakter şartı). Gizlilik yapısal olarak sağlanır ve ayrıca test edilir
   * (gizli-kareler.test.ts, "gizlilik").
   */
  secrets() {
    return [];
  },

  result(state) {
    const { points } = plan(state);
    return { miniScores: { ...points }, awards: { ...points } };
  },
};
