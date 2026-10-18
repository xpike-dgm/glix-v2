import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  ORTALAMA_CHOOSE_MS,
  ORTALAMA_DURATION_MS,
  ORTALAMA_MAX,
  ORTALAMA_MIN,
  type OrtalamaAction,
  type OrtalamaPublicView,
  type OrtalamaReveal,
  type OrtalamaView,
} from "./types.js";

export * from "./types.js";

export interface OrtalamaState {
  players: string[];
  startedAt: number;
  endsAt: number;
  revealEndsAt: number;
  /** Yalnız seçim gönderenler; son seçim geçerlidir. */
  choices: Record<string, number>;
  /**
   * Göndermeyene atanacak sayılar: kurulumda sunucu rastgeleliğiyle çekilir (gizli; süre dolana kadar
   * hiçbir görünümde yok). Önceden çekildiği için sonuç tick zamanlamasına bağlı değildir.
   */
  fallback: Record<string, number>;
  /** Görünümler `ctx.now`'dan türetilir; bayrak yalnız "durum değişti" sinyali içindir. */
  revealed: boolean;
}

function finalChoices(state: OrtalamaState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of state.players) out[id] = state.choices[id] ?? state.fallback[id] ?? ORTALAMA_MIN;
  return out;
}

/**
 * Puanlama. Hedef = ortalama / 2. Uzaklıklar tam sayı aritmetiğiyle karşılaştırılır
 * (|2n·seçim − toplam| ∝ |seçim − hedef|), böylece ondalık hata eşitliği bozmaz.
 * En yakın tek kişiyse +2, sonraki derece(ler) +1; en yakınlar eşitse hepsi +1, ikinci ödül yok.
 */
export function ortalamaSettle(state: OrtalamaState): OrtalamaReveal {
  const choices = finalChoices(state);
  const n = state.players.length;
  const sum = state.players.reduce((a, id) => a + (choices[id] ?? 0), 0);
  const key = (id: string): number => Math.abs(2 * n * (choices[id] ?? 0) - sum);
  const order = [...state.players].sort((a, b) => key(a) - key(b));
  const ranks: Record<string, number> = {};
  const points: Record<string, number> = {};
  const distances: Record<string, number> = {};
  const target = n > 0 ? sum / (2 * n) : 0;
  let rank = 0;
  let prev: number | null = null;
  const groups: string[][] = [];
  for (const id of order) {
    const k = key(id);
    if (prev === null || k !== prev) {
      rank = groups.length + 1;
      groups.push([]);
      prev = k;
    }
    groups[groups.length - 1]?.push(id);
    ranks[id] = rank;
    distances[id] = Math.abs((choices[id] ?? 0) - target);
    points[id] = 0;
  }
  const first = groups[0] ?? [];
  if (first.length === 1) {
    for (const id of first) points[id] = 2;
    for (const id of groups[1] ?? []) points[id] = 1;
  } else {
    for (const id of first) points[id] = 1;
  }
  return { choices, mean: n > 0 ? sum / n : 0, target, distances, order, ranks, points };
}

export const ortalamaninYarisi: GameDefinition<
  OrtalamaState,
  OrtalamaAction,
  OrtalamaView,
  OrtalamaPublicView
> = {
  id: "ortalamanin-yarisi",
  name: "Ortalamaya En Yakın",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Herkesin sayısının ortalamasının yarısını tahmin et!",
    steps: [
      "Gizlice 0 ile 100 arasında bir sayı seç",
      "Süre bitince ortalamanın yarısı hedef olur",
      "Hedefe en yakın +2, ikinci yakın +1 alır; en yakınlar eşitse herkes +1",
    ],
  },

  parseAction(raw: unknown): OrtalamaAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (Object.keys(rec).length !== 2 || rec.kind !== "choose") return null;
    const value = rec.value;
    if (typeof value !== "number" || !Number.isInteger(value)) return null;
    if (value < ORTALAMA_MIN || value > ORTALAMA_MAX) return null;
    return { kind: "choose", value };
  },

  setup(players: readonly string[], ctx: GameContext): OrtalamaState {
    const fallback: Record<string, number> = {};
    for (const id of players) fallback[id] = ctx.rng.int(ORTALAMA_MAX - ORTALAMA_MIN + 1) + ORTALAMA_MIN;
    return {
      players: [...players],
      startedAt: ctx.now,
      endsAt: ctx.now + ORTALAMA_CHOOSE_MS,
      revealEndsAt: ctx.now + ORTALAMA_DURATION_MS,
      choices: {},
      fallback,
      revealed: false,
    };
  },

  reduce(state, playerId, action, ctx): OrtalamaState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now >= state.endsAt) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (action.value < ORTALAMA_MIN || action.value > ORTALAMA_MAX) return { rejected: "out_of_range" };
    if (state.choices[playerId] === action.value) return state;
    return { ...state, choices: { ...state.choices, [playerId]: action.value } };
  },

  tick(state, ctx): OrtalamaState {
    if (state.revealed || ctx.now < state.endsAt) return state;
    return { ...state, revealed: true };
  },

  publicView(state, ctx): OrtalamaPublicView {
    return {
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      revealEndsAt: state.revealEndsAt,
      // Süre dolmadan kimsenin seçimi, ortalama ya da hedef yoktur.
      reveal: ctx.now >= state.endsAt ? ortalamaSettle(state) : null,
    };
  },

  view(state, playerId): OrtalamaView {
    const mine = playerId === null ? undefined : state.choices[playerId];
    return { myChoice: mine ?? null };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.revealEndsAt;
  },

  /**
   * Gizli değerler 0–100 arası kısa sayılardır; alt dizgi sızıntı denetimi onları koruyamaz
   * (en az 3 karakter şartı). Gizlilik yapısal olarak sağlanır ve ayrıca test edilir
   * (ortalamanin-yarisi.test.ts, "gizlilik"): `publicView` süre dolmadan seçim, ortalama ya da sıra
   * taşımaz, `view` yalnız sahibinin seçimini taşır, atanacak rastgele sayılar hiçbir görünümde yoktur.
   */
  secrets() {
    return [];
  },

  result(state) {
    const { points } = ortalamaSettle(state);
    return { miniScores: { ...points }, awards: { ...points } };
  },
};
