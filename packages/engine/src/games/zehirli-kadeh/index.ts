import {
  type GameContext,
  type GameDefinition,
  LATE_ACTION_GRACE_MS,
  type Rejected,
  type SecretEntry,
} from "../../game.js";
import {
  ZEHIRLI_KADEH_BASE_MS,
  ZEHIRLI_KADEH_LOCK_GRACE_MS,
  ZEHIRLI_KADEH_SWAP_BONUS_MS,
  type ZehirliKadehAction,
  type ZehirliKadehCheck,
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
  /**
   * GİZLİ: kontroller (kim, hangi kadeh numarası). Her biri yalnız `by` oyuncusunun `view`'ında görünür; ortak
   * görünümde, izleyicide ve başka oyuncularda hiçbir iz bırakmaz (kontrol hakkının kullanıldığı bile).
   */
  checks: { by: string; cup: number }[];
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

function checkOf(state: ZehirliKadehState, playerId: string): ZehirliKadehCheck | null {
  const c = state.checks.find((x) => x.by === playerId);
  return c ? { cup: c.cup, poisoned: state.poisoned.includes(c.cup) } : null;
}

/** Kontrol: hedefin O ANKİ kadeh numarası kaydedilir; hedefin bağlı olması gerekmez, süre ve takaslar değişmez. */
function check(state: ZehirliKadehState, playerId: string, target: string): ZehirliKadehState | Rejected {
  if (state.checks.some((c) => c.by === playerId)) return { rejected: "already_checked" };
  if (target === playerId) return { rejected: "self_target" };
  const them = state.players.indexOf(target);
  if (them < 0) return { rejected: "bad_target" };
  return { ...state, checks: [...state.checks, { by: playerId, cup: state.holds[them] as number }] };
}

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
      "Bir arkadaşının kadehini gizlice kontrol et (1 hak)",
      "İstersen biriyle tek takas yap; her takas süreyi uzatır",
      "Süre bitince temiz kadeh +1, zehirli kadeh 0",
    ],
  },

  parseAction(raw: unknown): ZehirliKadehAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (Object.keys(rec).length !== 2 || (rec.kind !== "swap" && rec.kind !== "check")) return null;
    const target = rec.target;
    if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
    return { kind: rec.kind, target };
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
      checks: [],
      ended: false,
    };
  },

  reduce(state, playerId, action, ctx): ZehirliKadehState | Rejected {
    const me = state.players.indexOf(playerId);
    if (me < 0) return { rejected: "not_participant" };
    if (over(state, ctx.now)) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (action.kind === "check") return check(state, playerId, action.target);
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
    if (playerId === null || !state.players.includes(playerId)) return { role: "spectator", check: null };
    return { role: "player", check: checkOf(state, playerId) };
  },

  isFinished(state, ctx): boolean {
    return over(state, ctx.now);
  },

  /**
   * Zehirli kadeh numaraları: sonuç açılana kadar kimsenin (sahipleri dahil) görünümünde olamaz.
   * Kontrol sonuçları (görünümdeki `check` nesnesi): yalnız o kadehi kontrol edenlerde; sonuçtan sonra da gizli.
   */
  secrets(state) {
    const entries: SecretEntry[] = state.ended
      ? []
      : state.poisoned.map((cup) => ({
          ownerIds: [] as string[],
          value: `zehirli-kadeh-no-${cup}`,
          label: `zehirli kadeh ${cup}`,
        }));
    const byValue = new Map<string, string[]>();
    for (const c of state.checks) {
      const value = JSON.stringify(checkOf(state, c.by));
      byValue.set(value, [...(byValue.get(value) ?? []), c.by]);
    }
    for (const [value, ownerIds] of byValue)
      entries.push({ ownerIds, value, label: `kontrol sonucu ${value}` });
    return entries;
  },

  result(state) {
    const r = resultOf(state);
    const scores: Record<string, number> = {};
    for (const id of state.players) scores[id] = r.clean.includes(id) ? 1 : 0;
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
