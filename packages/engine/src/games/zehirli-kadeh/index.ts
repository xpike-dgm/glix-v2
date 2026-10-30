import { type GameContext, type GameDefinition, LATE_ACTION_GRACE_MS, type Rejected } from "../../game.js";
import {
  ZEHIRLI_KADEH_BASE_MS,
  ZEHIRLI_KADEH_LOCK_GRACE_MS,
  ZEHIRLI_KADEH_SWAP_BONUS_MS,
  type ZehirliKadehAction,
  type ZehirliKadehPublicView,
  type ZehirliKadehResult,
  type ZehirliKadehSwap,
  type ZehirliKadehView,
  zehirliKadehPoisonCount,
} from "./types.js";

export * from "./types.js";

export interface ZehirliKadehState {
  players: string[];
  startedAt: number;
  endsAt: number;
  /** GİZLİ: zehirli kadehlerin numaraları (sonuca kadar hiçbir görünümde yok, sahibi dahil kimse bilmez). */
  poisoned: number[];
  /** `holds[i]`: players[i]'nin elindeki kadeh numarası. */
  holds: number[];
  swapped: string[];
  swaps: ZehirliKadehSwap[];
  /** `tick` süre bitişini fark edince true; sonuç yalnız o zaman açılır. */
  ended: boolean;
}

function resultOf(state: ZehirliKadehState): ZehirliKadehResult {
  const clean: string[] = [];
  const poisoned: string[] = [];
  state.players.forEach((id, i) => {
    (state.poisoned.includes(state.holds[i] as number) ? poisoned : clean).push(id);
  });
  return { clean, poisoned, poisonedCups: [...state.poisoned].sort((a, b) => a - b) };
}

const over = (state: ZehirliKadehState, now: number): boolean => state.ended || now >= state.endsAt;

export const zehirliKadeh: GameDefinition<
  ZehirliKadehState,
  ZehirliKadehAction,
  ZehirliKadehView,
  ZehirliKadehPublicView
> = {
  id: "zehirli-kadeh",
  graceMs: LATE_ACTION_GRACE_MS,
  name: "Zehirli Kadeh",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Zehirli kadehle kalma!",
    steps: [
      "Hangi kadeh zehirli, kimse göremez",
      "İstersen bir arkadaşınla tek takas yap; her takas süreyi uzatır",
      "Süre bitince temiz kadeh +1, zehirli kadeh 0",
    ],
  },

  parseAction(raw: unknown): ZehirliKadehAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (Object.keys(rec).length !== 2 || rec.kind !== "swap") return null;
    const target = rec.target;
    if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
    return { kind: "swap", target };
  },

  setup(players: readonly string[], ctx: GameContext): ZehirliKadehState {
    const order = ctx.rng.shuffle(players.map((_, i) => i));
    const poisoned = order.slice(0, zehirliKadehPoisonCount(players.length)).sort((a, b) => a - b);
    return {
      players: [...players],
      startedAt: ctx.now,
      endsAt: ctx.now + ZEHIRLI_KADEH_BASE_MS,
      poisoned,
      holds: players.map((_, i) => i),
      swapped: [],
      swaps: [],
      ended: false,
    };
  },

  reduce(state, playerId, action, ctx): ZehirliKadehState | Rejected {
    const me = state.players.indexOf(playerId);
    if (me < 0) return { rejected: "not_participant" };
    if (over(state, ctx.now)) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (state.swapped.includes(playerId)) return { rejected: "already_swapped" };
    if (action.target === playerId) return { rejected: "self_target" };
    const them = state.players.indexOf(action.target);
    if (them < 0) return { rejected: "bad_target" };
    if (!ctx.connected.includes(action.target)) return { rejected: "target_offline" };
    const holds = [...state.holds];
    holds[me] = state.holds[them] as number;
    holds[them] = state.holds[me] as number;
    const swapped = [...state.swapped, playerId];
    // Herkes takas hakkını kullandıysa sonuç değişemez: bütün katılımcılar (bağlantıdan bağımsız) takas edince
    // 1 sn sonra biter. Aksi halde her takas süreyi uzatır.
    const everyone = state.players.every((id) => swapped.includes(id));
    return {
      ...state,
      holds,
      endsAt: everyone
        ? Math.min(state.endsAt + ZEHIRLI_KADEH_SWAP_BONUS_MS, ctx.now + ZEHIRLI_KADEH_LOCK_GRACE_MS)
        : state.endsAt + ZEHIRLI_KADEH_SWAP_BONUS_MS,
      swapped,
      swaps: [
        ...state.swaps,
        { seq: state.swaps.length + 1, from: playerId, to: action.target, at: ctx.now },
      ],
    };
  },

  tick(state, ctx): ZehirliKadehState {
    if (state.ended || ctx.now < state.endsAt) return state;
    return { ...state, ended: true };
  },

  publicView(state): ZehirliKadehPublicView {
    const holdings: Record<string, number> = {};
    state.players.forEach((id, i) => {
      holdings[id] = state.holds[i] as number;
    });
    return {
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      players: [...state.players],
      holdings,
      swapped: [...state.swapped],
      swaps: state.swaps.map((s) => ({ ...s })),
      poisonCount: state.poisoned.length,
      ended: state.ended,
      result: state.ended ? resultOf(state) : null,
    };
  },

  view(state, playerId): ZehirliKadehView {
    return { role: playerId !== null && state.players.includes(playerId) ? "player" : "spectator" };
  },

  /** Sonuç açılışı (kadehler) süre bittiği an başlar. */
  revealAt(state): number | null {
    return state.endsAt;
  },

  isFinished(state, ctx): boolean {
    return over(state, ctx.now);
  },

  /** Zehirli kadeh numaraları: sonuç açılana kadar kimsenin (sahipleri dahil) görünümünde olamaz. */
  secrets(state) {
    if (state.ended) return [];
    return state.poisoned.map((cup) => ({
      ownerIds: [] as string[],
      value: `zehirli-kadeh-no-${cup}`,
      label: `zehirli kadeh ${cup}`,
    }));
  },

  result(state) {
    const r = resultOf(state);
    const scores: Record<string, number> = {};
    for (const id of state.players) scores[id] = r.clean.includes(id) ? 1 : 0;
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
