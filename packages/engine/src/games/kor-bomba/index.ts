import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  KOR_BOMBA_MAX_BONUS_MS,
  KOR_BOMBA_MAX_FUSE_MS,
  KOR_BOMBA_MIN_BONUS_MS,
  KOR_BOMBA_MIN_FUSE_MS,
  KOR_BOMBA_OUTRO_MS,
  type KorBombaAction,
  type KorBombaPass,
  type KorBombaPublicView,
  type KorBombaView,
} from "./types.js";

export * from "./types.js";

export interface KorBombaState {
  players: string[];
  startedAt: number;
  holder: string;
  /** Gizli: yalnız taşıyıcı dışındaki katılımcılar bilir (patlayana kadar). */
  explodeAt: number;
  passes: number;
  lastPass: KorBombaPass | null;
  /** Son pasın eklediği süre (gizli; taşıyıcı dışındakilere). */
  lastBonusMs: number | null;
  /** `tick` patlamayı fark edince true. */
  exploded: boolean;
}

const ended = (state: KorBombaState, now: number): boolean => state.exploded || now >= state.explodeAt;

export function korBombaScores(state: KorBombaState): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of state.players) scores[id] = id === state.holder ? -1 : 0;
  return scores;
}

export const korBomba: GameDefinition<KorBombaState, KorBombaAction, KorBombaView, KorBombaPublicView> = {
  id: "kor-bomba",
  name: "Kör Bomba",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "landscape",
  briefing: {
    goal: "Bomba sende patlamasın!",
    steps: [
      "Bomba rastgele birinde başlar",
      "Taşıyan süreyi görmez; kandır ya da ikna et",
      "Pas ver, süreyi uzat; patlayan −1 alır",
    ],
  },

  parseAction(raw: unknown): KorBombaAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (Object.keys(rec).length !== 2 || rec.kind !== "pass") return null;
    const to = rec.to;
    if (typeof to !== "string" || to.length === 0 || to.length > 64) return null;
    return { kind: "pass", to };
  },

  setup(players: readonly string[], ctx: GameContext): KorBombaState {
    const pool = ctx.connected.filter((id) => players.includes(id));
    const candidates = pool.length > 0 ? pool : players;
    const holder = candidates[ctx.rng.int(candidates.length)] ?? players[0] ?? "";
    const fuse = KOR_BOMBA_MIN_FUSE_MS + ctx.rng.int(KOR_BOMBA_MAX_FUSE_MS - KOR_BOMBA_MIN_FUSE_MS + 1);
    return {
      players: [...players],
      startedAt: ctx.now,
      holder,
      explodeAt: ctx.now + fuse,
      passes: 0,
      lastPass: null,
      lastBonusMs: null,
      exploded: false,
    };
  },

  reduce(state, playerId, action, ctx): KorBombaState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    // Patlamayla aynı ya da sonraki ms'deki pas geçersizdir (patlama önce işlenir).
    if (ended(state, ctx.now)) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (playerId !== state.holder) return { rejected: "not_holder" };
    if (action.to === playerId) return { rejected: "self_target" };
    if (!state.players.includes(action.to)) return { rejected: "bad_target" };
    if (!ctx.connected.includes(action.to)) return { rejected: "target_offline" };
    const bonus = KOR_BOMBA_MIN_BONUS_MS + ctx.rng.int(KOR_BOMBA_MAX_BONUS_MS - KOR_BOMBA_MIN_BONUS_MS + 1);
    const passes = state.passes + 1;
    return {
      ...state,
      holder: action.to,
      explodeAt: state.explodeAt + bonus,
      passes,
      lastPass: { seq: passes, from: playerId, to: action.to },
      lastBonusMs: bonus,
    };
  },

  tick(state, ctx): KorBombaState {
    if (state.exploded || ctx.now < state.explodeAt) return state;
    return { ...state, exploded: true };
  },

  publicView(state): KorBombaPublicView {
    return {
      startedAt: state.startedAt,
      holder: state.holder,
      passes: state.passes,
      lastPass: state.lastPass ? { ...state.lastPass } : null,
      exploded: state.exploded,
      explodedAt: state.exploded ? state.explodeAt : null,
    };
  },

  view(state, playerId): KorBombaView {
    if (playerId === null || !state.players.includes(playerId)) return { role: "spectator" };
    if (playerId === state.holder && !state.exploded) return { role: "holder" };
    return { role: "watcher", explodeAt: state.explodeAt, lastBonusMs: state.lastBonusMs };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.explodeAt + KOR_BOMBA_OUTRO_MS;
  },

  secrets(state) {
    if (state.exploded) return [];
    return [
      {
        ownerIds: state.players.filter((id) => id !== state.holder),
        value: String(state.explodeAt),
        label: "patlama zamanı",
      },
    ];
  },

  result(state) {
    const scores = korBombaScores(state);
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
