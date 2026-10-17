import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  CAPRAZ_ATES_DURATION_MS,
  CAPRAZ_ATES_FIRE_MS,
  type CaprazAtesAction,
  type CaprazAtesPublicView,
  type CaprazAtesReveal,
  type CaprazAtesView,
} from "./types.js";

export * from "./types.js";

export interface CaprazAtesState {
  players: string[];
  startedAt: number;
  endsAt: number;
  finishAt: number;
  /** Oyuncu -> son seçilen hedef (gizli; süre bitene kadar yalnız sahibinin görünümünde). */
  targets: Record<string, string>;
  /** Hedef süresi dolduğunda tick tarafından işaretlenir; yalnız sunucunun yayın tetiklemesi içindir. */
  fireClosed: boolean;
}

function targetOf(targets: Record<string, string>, id: string): string | null {
  return Object.hasOwn(targets, id) ? (targets[id] ?? null) : null;
}

/**
 * Puanlama (docs/A4-OYUNLAR.md): karşılıklı çift 0; aksi halde hedeflenen −1 (kaç kişi hedeflese de bir kez);
 * hedeflenmeyen ve karşılıklı olmayan bir hedefe ateş eden +1; hedefsiz ve hedeflenmeyen 0.
 */
export function caprazAtesReveal(
  players: readonly string[],
  targets: Record<string, string>,
): CaprazAtesReveal {
  const targeted = new Set<string>();
  for (const id of players) {
    const t = targetOf(targets, id);
    if (t !== null) targeted.add(t);
  }
  const outTargets: Record<string, string | null> = {};
  const scores: Record<string, number> = {};
  const mutual: [string, string][] = [];
  for (const id of players) {
    const t = targetOf(targets, id);
    outTargets[id] = t;
    const isMutual = t !== null && targetOf(targets, t) === id;
    if (isMutual) {
      scores[id] = 0;
      if (players.indexOf(id) < players.indexOf(t)) mutual.push([id, t]);
    } else if (targeted.has(id)) {
      scores[id] = -1;
    } else {
      scores[id] = t !== null ? 1 : 0;
    }
  }
  return { targets: outTargets, scores, mutual };
}

export const caprazAtes: GameDefinition<
  CaprazAtesState,
  CaprazAtesAction,
  CaprazAtesView,
  CaprazAtesPublicView
> = {
  id: "capraz-ates",
  name: "Çapraz Ateş",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Gizlice bir arkadaşına nişan al!",
    steps: [
      "Kendin dışında birini hedefle, süre bitene kadar değiştirebilirsin",
      "Seni kimin seçtiğini göremezsin",
      "Seçilen −1, seçilmeyen +1, karşılıklı ateşte ikiniz 0",
    ],
  },

  parseAction(raw: unknown): CaprazAtesAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    const keys = Object.keys(r);
    if (keys.length !== 2 || r.kind !== "target") return null;
    const target = r.target;
    if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
    return { kind: "target", target };
  },

  setup(players: readonly string[], ctx: GameContext): CaprazAtesState {
    return {
      players: [...players],
      startedAt: ctx.now,
      endsAt: ctx.now + CAPRAZ_ATES_FIRE_MS,
      finishAt: ctx.now + CAPRAZ_ATES_DURATION_MS,
      targets: {},
      fireClosed: false,
    };
  },

  reduce(state, playerId, action, ctx): CaprazAtesState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now >= state.endsAt) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (action.target === playerId) return { rejected: "self_target" };
    if (!state.players.includes(action.target)) return { rejected: "unknown_target" };
    if (!ctx.connected.includes(action.target)) return { rejected: "target_offline" };
    if (targetOf(state.targets, playerId) === action.target) return state;
    return { ...state, targets: { ...state.targets, [playerId]: action.target } };
  },

  // Süre dolunca durum bir kez değişir: sunucu değişiklikte yayın yapar, böylece hedefler tam süre bitiminde açılır.
  tick(state, ctx): CaprazAtesState {
    if (state.fireClosed || ctx.now < state.endsAt) return state;
    return { ...state, fireClosed: true };
  },

  publicView(state, ctx): CaprazAtesPublicView {
    return {
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      finishAt: state.finishAt,
      reveal: ctx.now >= state.endsAt ? caprazAtesReveal(state.players, state.targets) : null,
    };
  },

  view(state, playerId): CaprazAtesView {
    return { myTarget: playerId === null ? null : targetOf(state.targets, playerId) };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.finishAt;
  },

  // Hedefler oyuncu kimlikleridir (kısa, ayırt edici değil): metin araması koruyamaz.
  // Gizlilik yapısal olarak sağlanır (publicView süre bitene kadar hedef içermez, view yalnız kendi hedefini verir);
  // bkz. capraz-ates.test.ts "gizlilik".
  secrets() {
    return [];
  },

  result(state) {
    const { scores } = caprazAtesReveal(state.players, state.targets);
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
