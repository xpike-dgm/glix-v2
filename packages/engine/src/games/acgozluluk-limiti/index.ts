import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  ACGOZLULUK_CHOOSE_MS,
  ACGOZLULUK_DURATION_MS,
  ACGOZLULUK_LOCK_GRACE_MS,
  ACGOZLULUK_REVEAL_MS,
  ACGOZLULUK_WIRE_MAX,
  type AcgozlulukAction,
  type AcgozlulukPublicView,
  type AcgozlulukReveal,
  type AcgozlulukView,
  acgozlulukLimit,
} from "./types.js";

export * from "./types.js";

export interface AcgozlulukState {
  players: string[];
  startedAt: number;
  /** Seçim süresinin bitişi. */
  endsAt: number;
  /** Oyunun bitişi (seçimler açıldıktan sonra sonuç süresi dahil). */
  revealEndsAt: number;
  limit: number;
  maxChoice: number;
  /** Yalnız seçim gönderenler; son seçim geçerlidir. Gönderilmeyen 0 sayılır. */
  choices: Record<string, number>;
  /** Seçimini kilitleyenler (kilit sırasıyla). `endsAt`/`revealEndsAt` erken bitişte reduce içinde öne çekilir. */
  locked: string[];
  /**
   * Seçim süresi doldu mu. Görünümler bundan değil `ctx.now`'dan türetilir; bayrak yalnız sunucunun
   * "durum değişti" sinyalini almasını sağlar (aksi halde seçimlerin açıldığı an kimseye yayınlanmaz).
   */
  revealed: boolean;
}

function settle(state: AcgozlulukState): AcgozlulukReveal {
  const choices: Record<string, number> = {};
  let total = 0;
  for (const id of state.players) {
    const value = state.choices[id] ?? 0;
    choices[id] = value;
    total += value;
  }
  return { choices, total, over: total > state.limit };
}

export const acgozlulukLimiti: GameDefinition<
  AcgozlulukState,
  AcgozlulukAction,
  AcgozlulukView,
  AcgozlulukPublicView
> = {
  id: "acgozluluk-limiti",
  name: "Açgözlülük Limiti",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Ortak hazneyi taşırma, ama olabildiğince çok jeton koy!",
    steps: [
      "Gizli olarak 0 ile oyuncu sayısı arasında bir sayı seç",
      "Hepinizin toplamı limit çizgisinin altında kalsın",
      "Taşarsa herkes 0 alır, taşmazsa seçtiğin kadar puan kazanırsın",
    ],
  },

  parseAction(raw: unknown): AcgozlulukAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (rec.kind === "lock") return Object.keys(rec).length === 1 ? { kind: "lock" } : null;
    if (Object.keys(rec).length !== 2 || rec.kind !== "choose") return null;
    const value = rec.value;
    if (typeof value !== "number" || !Number.isInteger(value)) return null;
    if (value < 0 || value > ACGOZLULUK_WIRE_MAX) return null;
    return { kind: "choose", value };
  },

  setup(players: readonly string[], ctx: GameContext): AcgozlulukState {
    return {
      players: [...players],
      startedAt: ctx.now,
      endsAt: ctx.now + ACGOZLULUK_CHOOSE_MS,
      revealEndsAt: ctx.now + ACGOZLULUK_DURATION_MS,
      limit: acgozlulukLimit(players.length),
      maxChoice: players.length,
      choices: {},
      locked: [],
      revealed: false,
    };
  },

  reduce(state, playerId, action, ctx): AcgozlulukState | Rejected {
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
      const endsAt = Math.min(state.endsAt, ctx.now + ACGOZLULUK_LOCK_GRACE_MS);
      return { ...state, locked, endsAt, revealEndsAt: endsAt + ACGOZLULUK_REVEAL_MS };
    }
    if (action.value < 0 || action.value > state.maxChoice) return { rejected: "out_of_range" };
    if (state.choices[playerId] === action.value) return state;
    return { ...state, choices: { ...state.choices, [playerId]: action.value } };
  },

  tick(state, ctx): AcgozlulukState {
    if (state.revealed || ctx.now < state.endsAt) return state;
    return { ...state, revealed: true };
  },

  publicView(state, ctx): AcgozlulukPublicView {
    return {
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      revealEndsAt: state.revealEndsAt,
      limit: state.limit,
      maxChoice: state.maxChoice,
      // Süre dolmadan kimsenin seçimi ve toplam yoktur.
      reveal: ctx.now >= state.endsAt ? settle(state) : null,
      lockedIds: [...state.locked],
    };
  },

  view(state, playerId): AcgozlulukView {
    const mine = playerId === null ? undefined : state.choices[playerId];
    return { myChoice: mine ?? null, locked: playerId !== null && state.locked.includes(playerId) };
  },

  /** Sonuç açılışı seçim süresinin bittiği an başlar. */
  revealAt(state): number | null {
    return state.endsAt;
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.revealEndsAt;
  },

  /**
   * Gizli değerler 0..8 arası kısa sayılardır; alt dizgi sızıntı denetimi bunları koruyamaz
   * (en az 3 karakter şartı). Gizlilik yapısal olarak sağlanır: `publicView` süre dolmadan seçim ve toplam
   * taşımaz, `view` yalnız sahibinin seçimini taşır (bkz. acgozluluk-limiti.test.ts, "gizlilik").
   */
  secrets() {
    return [];
  },

  result(state) {
    const { choices, over } = settle(state);
    const miniScores: Record<string, number> = {};
    for (const id of state.players) miniScores[id] = over ? 0 : (choices[id] ?? 0);
    return { miniScores, awards: { ...miniScores } };
  },
};
