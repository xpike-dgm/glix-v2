import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  KOR_KRONOMETRE_DURATION_MS,
  KOR_KRONOMETRE_REVEAL_MS,
  KOR_KRONOMETRE_TARGET_MS,
  type KorKronometreAction,
  type KorKronometreEntry,
  type KorKronometrePublicView,
  type KorKronometreReveal,
  type KorKronometreView,
} from "./types.js";

export * from "./types.js";

export interface KorKronometreState {
  players: string[];
  startedAt: number;
  endsAt: number;
  revealEndsAt: number;
  /** Yalnız basanlar: oyuncu → basış anı (oyun başından ms). Basmayan için kayıt yoktur. */
  presses: Record<string, number>;
  /** Süre doldu mu. Görünümler bundan değil `ctx.now`'dan türetilir; bayrak yalnız "durum değişti" sinyalidir. */
  revealed: boolean;
}

/** Derece (1, 1, 3 …) ve puan (derece 1 → +2, derece 2 → +1) hesabı; yakından uzağa sıralı. */
export function korKronometreEntries(state: KorKronometreState): KorKronometreEntry[] {
  const rows = state.players.map((playerId, order) => {
    const at = state.presses[playerId];
    const ms = at ?? KOR_KRONOMETRE_DURATION_MS;
    return {
      playerId,
      order,
      ms,
      pressed: at !== undefined,
      distance: Math.abs(ms - KOR_KRONOMETRE_TARGET_MS),
    };
  });
  rows.sort((a, b) => a.distance - b.distance || a.order - b.order);
  return rows.map((r) => {
    const rank = rows.findIndex((x) => x.distance === r.distance) + 1;
    return {
      playerId: r.playerId,
      ms: r.ms,
      pressed: r.pressed,
      distance: r.distance,
      rank,
      points: rank === 1 ? 2 : rank === 2 ? 1 : 0,
    };
  });
}

function settle(state: KorKronometreState): KorKronometreReveal {
  return { entries: korKronometreEntries(state) };
}

export const korKronometre: GameDefinition<
  KorKronometreState,
  KorKronometreAction,
  KorKronometreView,
  KorKronometrePublicView
> = {
  id: "kor-kronometre",
  name: "Kör Kronometre",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "İçinden say, tam 10. saniyede bas!",
    steps: [
      "Sayaç yok; saniyeleri içinden say",
      "Tek bir basışın var",
      "10. saniyeye en yakın +2, ikinci +1",
    ],
  },

  parseAction(raw: unknown): KorKronometreAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (Object.keys(rec).length !== 1 || rec.kind !== "press") return null;
    return { kind: "press" };
  },

  setup(players: readonly string[], ctx: GameContext): KorKronometreState {
    return {
      players: [...players],
      startedAt: ctx.now,
      endsAt: ctx.now + KOR_KRONOMETRE_DURATION_MS,
      revealEndsAt: ctx.now + KOR_KRONOMETRE_DURATION_MS + KOR_KRONOMETRE_REVEAL_MS,
      presses: {},
      revealed: false,
    };
  },

  reduce(state, playerId, _action, ctx): KorKronometreState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    // Süre sunucu saatiyle ölçülür; bitiş anında ve sonrasında gelen basış geçersizdir.
    if (ctx.now >= state.endsAt) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (state.presses[playerId] !== undefined) return { rejected: "already_pressed" };
    return { ...state, presses: { ...state.presses, [playerId]: ctx.now - state.startedAt } };
  },

  tick(state, ctx): KorKronometreState {
    if (state.revealed || ctx.now < state.endsAt) return state;
    return { ...state, revealed: true };
  },

  publicView(state, ctx): KorKronometrePublicView {
    return {
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      revealEndsAt: state.revealEndsAt,
      // Süre dolmadan kimin bastığı ve ne zaman bastığı yoktur.
      reveal: ctx.now >= state.endsAt ? settle(state) : null,
    };
  },

  view(state, playerId): KorKronometreView {
    return { pressed: playerId !== null && state.presses[playerId] !== undefined };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.revealEndsAt;
  },

  /**
   * Basış anları 0–17 999 arası, çoğu kez kısa sayılardır; alt dizgi sızıntı denetimi bunları koruyamaz.
   * Gizlilik yapısal olarak sağlanır: `publicView` süre dolmadan basış taşımaz, `view` yalnız "bastın mı" der
   * (bkz. kor-kronometre.test.ts, "gizlilik").
   */
  secrets() {
    return [];
  },

  result(state) {
    const miniScores: Record<string, number> = {};
    for (const e of korKronometreEntries(state)) miniScores[e.playerId] = e.points;
    return { miniScores, awards: { ...miniScores } };
  },
};
