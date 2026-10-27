import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  KOR_KRONOMETRE_LOCK_GRACE_MS,
  KOR_KRONOMETRE_REVEAL_MS,
  KOR_KRONOMETRE_TARGET_MAX_S,
  KOR_KRONOMETRE_TARGET_MIN_S,
  type KorKronometreAction,
  type KorKronometreEntry,
  type KorKronometrePublicView,
  type KorKronometreReveal,
  type KorKronometreView,
  korKronometreDurationMs,
} from "./types.js";

export * from "./types.js";

export interface KorKronometreState {
  players: string[];
  /** Herkese açık hedef an (ms): setup'ta tohumlu RNG ile seçilen tam saniye. */
  targetMs: number;
  startedAt: number;
  /** Basış süresinin bitişi; herkes bastıysa reduce'ta öne çekilir (basış anı + 1 sn). */
  endsAt: number;
  revealEndsAt: number;
  /** Yalnız basanlar: oyuncu → basış anı (oyun başından ms). Basmayan için kayıt yoktur. */
  presses: Record<string, number>;
  /** Süre doldu mu. Görünümler bundan değil `ctx.now`'dan türetilir; bayrak yalnız "durum değişti" sinyalidir. */
  revealed: boolean;
}

/**
 * Derece (1, 1, 3 …) ve puan (derece 1 → +2, derece 2 → +1) hesabı. Yalnız basanlar sıralanır (yakından uzağa);
 * basmayanlar sıralamaya girmez, puan almaz ve listenin sonunda katılım sırasıyla yer alır.
 */
export function korKronometreEntries(state: KorKronometreState): KorKronometreEntry[] {
  const pressed: { playerId: string; order: number; ms: number; distance: number }[] = [];
  const missed: KorKronometreEntry[] = [];
  state.players.forEach((playerId, order) => {
    const ms = state.presses[playerId];
    if (ms === undefined) {
      missed.push({ playerId, ms: null, pressed: false, distance: null, rank: null, points: 0 });
    } else {
      pressed.push({ playerId, order, ms, distance: Math.abs(ms - state.targetMs) });
    }
  });
  pressed.sort((a, b) => a.distance - b.distance || a.order - b.order);
  const ranked = pressed.map((r): KorKronometreEntry => {
    const rank = pressed.findIndex((x) => x.distance === r.distance) + 1;
    return {
      playerId: r.playerId,
      ms: r.ms,
      pressed: true,
      distance: r.distance,
      rank,
      points: rank === 1 ? 2 : rank === 2 ? 1 : 0,
    };
  });
  return [...ranked, ...missed];
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
    goal: "İçinden say, hedef saniyede bas!",
    steps: [
      "Sayaç görünmez; yalnız hedef süre yazılı",
      "İçinden hedef süreyi say",
      "Tek basışını doğru anda yap; en yakın +2, ikinci +1",
    ],
  },

  parseAction(raw: unknown): KorKronometreAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (Object.keys(rec).length !== 1 || rec.kind !== "press") return null;
    return { kind: "press" };
  },

  setup(players: readonly string[], ctx: GameContext): KorKronometreState {
    // Hedef: 7–13 sn arası tam saniye, tohumlu RNG'den (tekrar oynatmada aynı sonuç).
    const span = KOR_KRONOMETRE_TARGET_MAX_S - KOR_KRONOMETRE_TARGET_MIN_S + 1;
    const targetMs = (KOR_KRONOMETRE_TARGET_MIN_S + ctx.rng.int(span)) * 1_000;
    const duration = korKronometreDurationMs(targetMs);
    return {
      players: [...players],
      targetMs,
      startedAt: ctx.now,
      endsAt: ctx.now + duration,
      revealEndsAt: ctx.now + duration + KOR_KRONOMETRE_REVEAL_MS,
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
    const presses = { ...state.presses, [playerId]: ctx.now - state.startedAt };
    // Herkes bastıysa sonuç kesindir: bütün katılımcılar (bağlantıdan bağımsız) basınca 1 sn sonra açılır.
    if (!state.players.every((id) => presses[id] !== undefined)) return { ...state, presses };
    const endsAt = Math.min(state.endsAt, ctx.now + KOR_KRONOMETRE_LOCK_GRACE_MS);
    return { ...state, presses, endsAt, revealEndsAt: endsAt + KOR_KRONOMETRE_REVEAL_MS };
  },

  tick(state, ctx): KorKronometreState {
    if (state.revealed || ctx.now < state.endsAt) return state;
    return { ...state, revealed: true };
  },

  publicView(state, ctx): KorKronometrePublicView {
    return {
      startedAt: state.startedAt,
      targetMs: state.targetMs,
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
   * Basış anları 0–21 000 arası, çoğu kez kısa sayılardır; alt dizgi sızıntı denetimi bunları koruyamaz.
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
