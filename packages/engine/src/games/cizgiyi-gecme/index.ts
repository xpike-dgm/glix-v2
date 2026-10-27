import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  CIZGI_CHOOSE_MS,
  CIZGI_DURATION_MS,
  CIZGI_LOCK_GRACE_MS,
  CIZGI_MAX,
  CIZGI_MIN,
  CIZGI_REVEAL_MS,
  type CizgiAction,
  type CizgiPublicView,
  type CizgiReveal,
  type CizgiStatus,
  type CizgiView,
  cizgiZone,
  cizgiZoneWidth,
} from "./types.js";

export * from "./types.js";

export interface CizgiState {
  players: string[];
  startedAt: number;
  endsAt: number;
  revealEndsAt: number;
  /** Yalnız seçim gönderenler; son seçim geçerlidir. Seçmeyen pasiftir. */
  choices: Record<string, number>;
  /** Seçimini kilitleyenler (kilit sırasıyla). `endsAt`/`revealEndsAt` erken bitişte reduce içinde öne çekilir. */
  locked: string[];
  /** Görünümler `ctx.now`'dan türetilir; bayrak yalnız "durum değişti" sinyali içindir. */
  revealed: boolean;
}

/**
 * Puanlama: aynı bölgede ≥ 2 kişi olanların hepsi pasif (0, ceza yok); seçmeyen pasif.
 * Bölge genişliği oyuncu sayısına göre (`cizgiZoneWidth`). Tek kalanlar arasında en yüksek sayı +2, ikinci +1.
 * Tek kalanlar farklı bölgelerde olduğundan sayıları da farklıdır; eşitlik oluşamaz.
 */
export function cizgiSettle(state: CizgiState): CizgiReveal {
  const choices: Record<string, number | null> = {};
  const status: Record<string, CizgiStatus> = {};
  const points: Record<string, number> = {};
  const width = cizgiZoneWidth(state.players.length);
  const perZone = new Map<number, number>();
  for (const id of state.players) {
    const v = state.choices[id];
    choices[id] = v ?? null;
    if (v !== undefined) perZone.set(cizgiZone(v, width), (perZone.get(cizgiZone(v, width)) ?? 0) + 1);
  }
  const alone: string[] = [];
  for (const id of state.players) {
    const v = state.choices[id];
    points[id] = 0;
    if (v === undefined) status[id] = "none";
    else if ((perZone.get(cizgiZone(v, width)) ?? 0) >= 2) status[id] = "crashed";
    else {
      status[id] = "safe";
      alone.push(id);
    }
  }
  alone.sort((a, b) => (state.choices[b] ?? 0) - (state.choices[a] ?? 0));
  const [first, second] = alone;
  if (first !== undefined) {
    status[first] = "first";
    points[first] = 2;
  }
  if (second !== undefined) {
    status[second] = "second";
    points[second] = 1;
  }
  return { zoneWidth: width, choices, status, points };
}

export const cizgiyiGecme: GameDefinition<CizgiState, CizgiAction, CizgiView, CizgiPublicView> = {
  id: "cizgiyi-gecme",
  name: "Çizgiyi Geçme",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "En yükseğe çık ama kimseyle aynı platformda kalma!",
    steps: [
      "Gizlice 0 ile 100 arasında bir sayı seç",
      "Aynı bölgeye düşen elenir; bölge genişliği oyuncu sayısına göre değişir",
      "Tek kalanların en yükseği +2, ikincisi +1 alır",
    ],
  },

  parseAction(raw: unknown): CizgiAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (rec.kind === "lock") return Object.keys(rec).length === 1 ? { kind: "lock" } : null;
    if (Object.keys(rec).length !== 2 || rec.kind !== "choose") return null;
    const value = rec.value;
    if (typeof value !== "number" || !Number.isInteger(value)) return null;
    if (value < CIZGI_MIN || value > CIZGI_MAX) return null;
    return { kind: "choose", value };
  },

  setup(players: readonly string[], ctx: GameContext): CizgiState {
    return {
      players: [...players],
      startedAt: ctx.now,
      endsAt: ctx.now + CIZGI_CHOOSE_MS,
      revealEndsAt: ctx.now + CIZGI_DURATION_MS,
      choices: {},
      locked: [],
      revealed: false,
    };
  },

  reduce(state, playerId, action, ctx): CizgiState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now >= state.endsAt) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (state.locked.includes(playerId)) return { rejected: "locked" };
    if (action.kind === "lock") {
      if (state.choices[playerId] === undefined) return { rejected: "nothing_to_lock" };
      const locked = [...state.locked, playerId];
      const waiting = state.players.some((id) => ctx.connected.includes(id) && !locked.includes(id));
      if (waiting) return { ...state, locked };
      // Bağlı herkes kilitledi: seçim aşaması 1 sn sonra biter.
      const endsAt = Math.min(state.endsAt, ctx.now + CIZGI_LOCK_GRACE_MS);
      return { ...state, locked, endsAt, revealEndsAt: endsAt + CIZGI_REVEAL_MS };
    }
    if (action.value < CIZGI_MIN || action.value > CIZGI_MAX) return { rejected: "out_of_range" };
    if (state.choices[playerId] === action.value) return state;
    return { ...state, choices: { ...state.choices, [playerId]: action.value } };
  },

  tick(state, ctx): CizgiState {
    if (state.revealed || ctx.now < state.endsAt) return state;
    return { ...state, revealed: true };
  },

  publicView(state, ctx): CizgiPublicView {
    return {
      startedAt: state.startedAt,
      zoneWidth: cizgiZoneWidth(state.players.length),
      endsAt: state.endsAt,
      revealEndsAt: state.revealEndsAt,
      // Süre dolmadan kimsenin seçimi ya da durumu yoktur.
      reveal: ctx.now >= state.endsAt ? cizgiSettle(state) : null,
      lockedIds: [...state.locked],
    };
  },

  view(state, playerId): CizgiView {
    const mine = playerId === null ? undefined : state.choices[playerId];
    return { myChoice: mine ?? null, locked: playerId !== null && state.locked.includes(playerId) };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.revealEndsAt;
  },

  /**
   * Gizli değerler 0–100 arası kısa sayılardır; alt dizgi sızıntı denetimi onları koruyamaz
   * (en az 3 karakter şartı). Gizlilik yapısal olarak sağlanır ve ayrıca test edilir
   * (cizgiyi-gecme.test.ts, "gizlilik").
   */
  secrets() {
    return [];
  },

  result(state) {
    const { points } = cizgiSettle(state);
    return { miniScores: { ...points }, awards: { ...points } };
  },
};
