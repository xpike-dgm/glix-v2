import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  CAPRAZ_ATES_FIRE_MS,
  CAPRAZ_ATES_INTERVAL_MS,
  CAPRAZ_ATES_LOCK_GRACE_MS,
  CAPRAZ_ATES_REVEAL_MS,
  type CaprazAtesAction,
  type CaprazAtesPublicView,
  type CaprazAtesRoundReveal,
  type CaprazAtesView,
} from "./types.js";

export * from "./types.js";

export interface CaprazAtesState {
  players: string[];
  /** Oyunun (tur 1'in) başlangıcı. */
  startedAt: number;
  /** Şu anki seçim turu. Tur 1'in süresi bitince `advance` 2 yapar. */
  round: 1 | 2;
  /** Bu turun seçim başlangıcı. */
  roundStartedAt: number;
  /** Bu turun seçim bitişi; erken bitişte reduce içinde öne çekilir. */
  endsAt: number;
  /** Oyunun bitişi (tur 1'de beklenen bitiş). */
  finishAt: number;
  /** Bu turda oyuncu -> son seçilen hedef (gizli; tur bitene kadar yalnız sahibinin görünümünde). */
  targets: Record<string, string>;
  /** Bu turda siper alanlar (gizli; yalnız sahibinin görünümünde). */
  cover: string[];
  /** Bu turda seçimini kilitleyenler (kilit sırasıyla). */
  locked: string[];
  /** Açılmış turlar. */
  rounds: CaprazAtesRoundReveal[];
  /** Tur 2'nin süresi dolunca işaretlenir; yalnız sunucunun yayın tetiklemesi içindir. */
  fireClosed: boolean;
}

function targetOf(targets: Record<string, string>, id: string): string | null {
  return Object.hasOwn(targets, id) ? (targets[id] ?? null) : null;
}

/**
 * Bir turun puanlaması (docs/KURALLAR.md §23), sırayla:
 * (1) siperdeki oyuncu 0 (hedeflense de; hedefi olmadığı için +1 de alamaz);
 * (2) karşılıklı çift (A→B, B→A) 0;
 * (3) en az bir kişi tarafından hedeflenen −1 (kaç kişi hedeflese de bir kez);
 * (4) hedeflenmeyen ve birine (siperdekine de) ateş eden +1; (5) hedefsiz ve hedeflenmeyen 0.
 */
export function caprazAtesReveal(
  players: readonly string[],
  targets: Record<string, string>,
  cover: readonly string[] = [],
): CaprazAtesRoundReveal {
  const sheltered = new Set(cover.filter((id) => players.includes(id)));
  const aim = (id: string): string | null => (sheltered.has(id) ? null : targetOf(targets, id));
  const targeted = new Set<string>();
  for (const id of players) {
    const t = aim(id);
    if (t !== null) targeted.add(t);
  }
  const outTargets: Record<string, string | null> = {};
  const scores: Record<string, number> = {};
  const mutual: [string, string][] = [];
  for (const id of players) {
    const t = aim(id);
    outTargets[id] = t;
    if (sheltered.has(id)) {
      scores[id] = 0;
      continue;
    }
    const isMutual = t !== null && aim(t) === id;
    if (isMutual) {
      scores[id] = 0;
      if (players.indexOf(id) < players.indexOf(t)) mutual.push([id, t]);
    } else if (targeted.has(id)) {
      scores[id] = -1;
    } else {
      scores[id] = t !== null ? 1 : 0;
    }
  }
  return { targets: outTargets, cover: players.filter((id) => sheltered.has(id)), scores, mutual };
}

/** Turların puan toplamı (oyuncu başına). */
export function caprazAtesTotals(
  players: readonly string[],
  rounds: readonly CaprazAtesRoundReveal[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of players) out[id] = rounds.reduce((sum, r) => sum + (r.scores[id] ?? 0), 0);
  return out;
}

/**
 * Zamana bağlı geçişler (saf): tur 1'in süresi dolunca sonucu dondurulur ve tur 2 kısa açılıştan sonra boş
 * seçimlerle başlar; tur 2'nin süresi dolunca o da dondurulur. Değişiklik yoksa aynı nesne döner.
 */
function advance(state: CaprazAtesState, now: number): CaprazAtesState {
  if (state.round === 1 && now >= state.endsAt) {
    const first = caprazAtesReveal(state.players, state.targets, state.cover);
    const roundStartedAt = state.endsAt + CAPRAZ_ATES_INTERVAL_MS;
    const endsAt = roundStartedAt + CAPRAZ_ATES_FIRE_MS;
    return advance(
      {
        ...state,
        round: 2,
        roundStartedAt,
        endsAt,
        finishAt: endsAt + CAPRAZ_ATES_REVEAL_MS,
        targets: {},
        cover: [],
        locked: [],
        rounds: [first],
      },
      now,
    );
  }
  if (state.round === 2 && !state.fireClosed && now >= state.endsAt) {
    const second = caprazAtesReveal(state.players, state.targets, state.cover);
    return { ...state, rounds: [...state.rounds, second], fireClosed: true };
  }
  return state;
}

/** Sonuç için iki turun da sonucu (tick hiç çalışmamış olsa bile aynı). */
function finalRounds(state: CaprazAtesState): CaprazAtesRoundReveal[] {
  if (state.rounds.length >= 2) return state.rounds;
  const current = caprazAtesReveal(state.players, state.targets, state.cover);
  if (state.round === 2) return [...state.rounds, current];
  return [current, caprazAtesReveal(state.players, {}, [])];
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
    goal: "Gizlice nişan al ya da sipere gir!",
    steps: [
      "İki tur: birini hedefle ya da siper al, süre bitene kadar değiştirebilirsin",
      "Tur 1'in hedefleri açılır; tur 2'de kim kimi vurdu bilinir",
      "Seçilen −1, seçilmeyen atıcı +1; karşılıklı ateşte ve siperde 0",
    ],
  },

  parseAction(raw: unknown): CaprazAtesAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    const keys = Object.keys(r);
    if (r.kind === "lock") return keys.length === 1 ? { kind: "lock" } : null;
    if (r.kind === "cover") return keys.length === 1 ? { kind: "cover" } : null;
    if (keys.length !== 2 || r.kind !== "target") return null;
    const target = r.target;
    if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
    return { kind: "target", target };
  },

  setup(players: readonly string[], ctx: GameContext): CaprazAtesState {
    const endsAt = ctx.now + CAPRAZ_ATES_FIRE_MS;
    return {
      players: [...players],
      startedAt: ctx.now,
      round: 1,
      roundStartedAt: ctx.now,
      endsAt,
      finishAt: endsAt + CAPRAZ_ATES_INTERVAL_MS + CAPRAZ_ATES_FIRE_MS + CAPRAZ_ATES_REVEAL_MS,
      targets: {},
      cover: [],
      locked: [],
      rounds: [],
      fireClosed: false,
    };
  },

  reduce(state, playerId, action, ctx): CaprazAtesState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    const s = advance(state, ctx.now);
    if (s.fireClosed) return { rejected: "ended" };
    // Oyun başlamadan ya da tur 1'in kısa açılışı sürerken seçim yapılmaz.
    if (ctx.now < s.roundStartedAt) return { rejected: "not_started" };
    if (s.locked.includes(playerId)) return { rejected: "locked" };
    const inCover = s.cover.includes(playerId);
    if (action.kind === "lock") {
      if (targetOf(s.targets, playerId) === null && !inCover) return { rejected: "nothing_to_lock" };
      const locked = [...s.locked, playerId];
      const waiting = s.players.some((id) => ctx.connected.includes(id) && !locked.includes(id));
      if (waiting) return { ...s, locked };
      // Bağlı herkes kilitledi: bu turun seçimi 1 sn sonra biter.
      const endsAt = Math.min(s.endsAt, ctx.now + CAPRAZ_ATES_LOCK_GRACE_MS);
      const finishAt =
        s.round === 1
          ? endsAt + CAPRAZ_ATES_INTERVAL_MS + CAPRAZ_ATES_FIRE_MS + CAPRAZ_ATES_REVEAL_MS
          : endsAt + CAPRAZ_ATES_REVEAL_MS;
      return { ...s, locked, endsAt, finishAt };
    }
    if (action.kind === "cover") {
      if (inCover) return s;
      const { [playerId]: _drop, ...targets } = s.targets;
      return { ...s, targets, cover: [...s.cover, playerId] };
    }
    if (action.target === playerId) return { rejected: "self_target" };
    if (!s.players.includes(action.target)) return { rejected: "unknown_target" };
    if (!ctx.connected.includes(action.target)) return { rejected: "target_offline" };
    if (!inCover && targetOf(s.targets, playerId) === action.target) return s;
    return {
      ...s,
      targets: { ...s.targets, [playerId]: action.target },
      cover: inCover ? s.cover.filter((id) => id !== playerId) : s.cover,
    };
  },

  // Süre dolunca durum değişir (tur 1 açılır / tur 2 açılır): sunucu değişiklikte yayın yapar.
  tick(state, ctx): CaprazAtesState {
    return advance(state, ctx.now);
  },

  publicView(state, ctx): CaprazAtesPublicView {
    const s = advance(state, ctx.now);
    return {
      startedAt: s.startedAt,
      round: s.round,
      roundStartedAt: s.roundStartedAt,
      endsAt: s.endsAt,
      finishAt: s.finishAt,
      rounds: s.rounds.map((r) => ({
        targets: { ...r.targets },
        cover: [...r.cover],
        scores: { ...r.scores },
        mutual: r.mutual.map(([a, b]): [string, string] => [a, b]),
      })),
      totals: s.rounds.length >= 2 ? caprazAtesTotals(s.players, s.rounds) : null,
      lockedIds: [...s.locked],
    };
  },

  view(state, playerId, ctx): CaprazAtesView {
    const s = advance(state, ctx.now);
    return {
      myTarget: playerId === null ? null : targetOf(s.targets, playerId),
      cover: playerId !== null && s.cover.includes(playerId),
      locked: playerId !== null && s.locked.includes(playerId),
    };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= advance(state, ctx.now).finishAt;
  },

  // Hedefler oyuncu kimlikleridir (kısa, ayırt edici değil): metin araması koruyamaz.
  // Gizlilik yapısal olarak sağlanır (publicView tur bitene kadar o turun hedefini/siperini içermez, view yalnız
  // kendi seçimini verir); bkz. capraz-ates.test.ts "gizlilik".
  secrets() {
    return [];
  },

  result(state) {
    const totals = caprazAtesTotals(state.players, finalRounds(state));
    return { miniScores: { ...totals }, awards: { ...totals } };
  },
};
