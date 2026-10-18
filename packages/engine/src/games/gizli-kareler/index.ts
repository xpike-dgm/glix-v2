import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  KARELER_BETWEEN_MS,
  KARELER_FINAL_MS,
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
  /** 1. aşamanın seçim bitişi. */
  stage1EndsAt: number;
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

function plan(state: KarelerState): Plan {
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
      finishesAt: state.stage1EndsAt + KARELER_FINAL_MS,
      points,
    };
  }
  const startsAt = state.stage1EndsAt + KARELER_BETWEEN_MS;
  const endsAt = startsAt + KARELER_STAGE_MS;
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
  if (now < state.stage1EndsAt) return 0;
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
      choices1: {},
      choices2: {},
      seen: 0,
    };
  },

  reduce(state, playerId, action, ctx): KarelerState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (action.cell >= kareCells(state.size)) return { rejected: "out_of_range" };
    const phase = karelerPhase(state, ctx.now);
    if (phase === 0) {
      if (state.choices1[playerId] === action.cell) return state;
      return { ...state, choices1: { ...state.choices1, [playerId]: action.cell } };
    }
    if (phase === 2) {
      if (!plan(state).survivors.includes(playerId)) return { rejected: "eliminated" };
      if (state.choices2[playerId] === action.cell) return state;
      return { ...state, choices2: { ...state.choices2, [playerId]: action.cell } };
    }
    return { rejected: phase === 4 ? "ended" : "closed" };
  },

  tick(state, ctx): KarelerState {
    const phase = karelerPhase(state, ctx.now);
    return phase === state.seen ? state : { ...state, seen: phase };
  },

  publicView(state, ctx): KarelerPublicView {
    const base = { size: state.size, startedAt: state.startedAt, endsAt: state.stage1EndsAt };
    if (ctx.now < state.stage1EndsAt) {
      return {
        ...base,
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
    };
  },

  view(state, playerId, ctx): KarelerView {
    if (playerId === null) return { myChoice: null };
    const phase = karelerPhase(state, ctx.now);
    if (phase === 0) return { myChoice: state.choices1[playerId] ?? null };
    if (phase === 2) return { myChoice: state.choices2[playerId] ?? null };
    return { myChoice: null };
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
