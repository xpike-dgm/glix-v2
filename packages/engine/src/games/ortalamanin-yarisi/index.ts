import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { rankAwards } from "../scoring.js";
import {
  ORTALAMA_CHOOSE_MS,
  ORTALAMA_LOCK_GRACE_MS,
  ORTALAMA_MAX,
  ORTALAMA_MIN,
  ORTALAMA_REVEAL_MS,
  ORTALAMA_ROUND_REVEAL_MS,
  ORTALAMA_ROUNDS,
  type OrtalamaAction,
  type OrtalamaPublicView,
  type OrtalamaReveal,
  type OrtalamaRoundSummary,
  type OrtalamaView,
  ortalamaMultiplier,
} from "./types.js";

export * from "./types.js";

/** Bir turun durumu. Erken bitişte `endsAt`/`revealEndsAt` öne çekilir ve sonraki turlar aynı kadar kayar. */
export interface OrtalamaRoundState {
  startAt: number;
  endsAt: number;
  revealEndsAt: number;
  /** Yalnız seçim gönderenler; son seçim geçerlidir. */
  choices: Record<string, number>;
  /** Seçimini kilitleyenler (kilit sırasıyla). */
  locked: string[];
  /**
   * Göndermeyene atanacak sayılar: kurulumda sunucu rastgeleliğiyle çekilir (gizli; tur açılana kadar hiçbir
   * görünümde yok). Önceden çekildiği için sonuç tick zamanlamasına bağlı değildir.
   */
  fallback: Record<string, number>;
}

export interface OrtalamaState {
  players: string[];
  startedAt: number;
  rounds: OrtalamaRoundState[];
  /** Süresi dolmuş tur sayısı. Görünümler `ctx.now`'dan türetilir; sayaç yalnız "durum değişti" sinyalidir. */
  revealed: number;
}

function finalChoices(state: OrtalamaState, round: OrtalamaRoundState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of state.players) out[id] = round.choices[id] ?? round.fallback[id] ?? ORTALAMA_MIN;
  return out;
}

/**
 * Bir turun puanlaması. Hedef = ortalama × çarpan (½, ⅔, ¾). Uzaklıklar tam sayı aritmetiğiyle karşılaştırılır
 * (|den·n·seçim − num·toplam| ∝ |seçim − hedef|), böylece ondalık hata eşitliği bozmaz.
 * En yakın tek kişiyse +2, sonraki derece(ler) +1; en yakınlar eşitse hepsi +1, ikinci ödül yok.
 */
export function ortalamaSettle(state: OrtalamaState, roundIndex = 0): OrtalamaReveal {
  const round = state.rounds[roundIndex];
  const choices = round ? finalChoices(state, round) : {};
  const { num, den } = ortalamaMultiplier(roundIndex);
  const n = state.players.length;
  const sum = state.players.reduce((a, id) => a + (choices[id] ?? 0), 0);
  const key = (id: string): number => Math.abs(den * n * (choices[id] ?? 0) - num * sum);
  const order = [...state.players].sort((a, b) => key(a) - key(b));
  const ranks: Record<string, number> = {};
  const points: Record<string, number> = {};
  const distances: Record<string, number> = {};
  const target = n > 0 ? (num * sum) / (den * n) : 0;
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

/** Mini puan toplamı: ilk `count` turun tur puanları. */
function totalsOf(state: OrtalamaState, count: number): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of state.players) totals[id] = 0;
  for (let r = 0; r < Math.min(count, state.rounds.length); r++) {
    const { points } = ortalamaSettle(state, r);
    for (const id of state.players) totals[id] = (totals[id] ?? 0) + (points[id] ?? 0);
  }
  return totals;
}

/**
 * Genel skor, oyun sonunda bir kez: 3 turun mini toplamına göre en yüksek +2, ikinci +1; en yüksek eşitse
 * paylaşanların hepsi +1 (+2 yok). Bu oyunda negatif kural yoktur.
 */
export function ortalamaAwards(totals: Record<string, number>): Record<string, number> {
  const awards = rankAwards(totals);
  const out: Record<string, number> = {};
  for (const id of Object.keys(totals)) out[id] = awards[id] ?? 0;
  return out;
}

/** `now` anında gösterilecek tur: süresi (sonuç dahil) dolmamış ilk tur, yoksa son tur. */
function currentRound(state: OrtalamaState, now: number): number {
  const i = state.rounds.findIndex((r) => now < r.revealEndsAt);
  return i === -1 ? state.rounds.length - 1 : i;
}

/** Oyunun bitişi: son turun sonuç ekranının bitişi. */
function gameEndsAt(state: OrtalamaState): number {
  return state.rounds[state.rounds.length - 1]?.revealEndsAt ?? state.startedAt;
}

function roundLength(round: number): { choose: number; reveal: number } {
  return {
    choose: ORTALAMA_CHOOSE_MS,
    reveal: round === ORTALAMA_ROUNDS - 1 ? ORTALAMA_REVEAL_MS : ORTALAMA_ROUND_REVEAL_MS,
  };
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
    goal: "Ortalamanın katını tahmin et: 3 tur, her turda hedef değişir!",
    steps: [
      "Her tur gizlice 0 ile 100 arasında bir sayı seç",
      "Hedef sırayla ortalamanın ½'si, ⅔'si, ¾'ü olur",
      "Hedefe yakınlık puanları toplanır; toplamı en yüksek +2, ikinci +1",
    ],
  },

  parseAction(raw: unknown): OrtalamaAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (rec.kind === "lock") return Object.keys(rec).length === 1 ? { kind: "lock" } : null;
    if (Object.keys(rec).length !== 2 || rec.kind !== "choose") return null;
    const value = rec.value;
    if (typeof value !== "number" || !Number.isInteger(value)) return null;
    if (value < ORTALAMA_MIN || value > ORTALAMA_MAX) return null;
    return { kind: "choose", value };
  },

  setup(players: readonly string[], ctx: GameContext): OrtalamaState {
    const rounds: OrtalamaRoundState[] = [];
    let at = ctx.now;
    for (let r = 0; r < ORTALAMA_ROUNDS; r++) {
      const len = roundLength(r);
      const fallback: Record<string, number> = {};
      for (const id of players) fallback[id] = ctx.rng.int(ORTALAMA_MAX - ORTALAMA_MIN + 1) + ORTALAMA_MIN;
      rounds.push({
        startAt: at,
        endsAt: at + len.choose,
        revealEndsAt: at + len.choose + len.reveal,
        choices: {},
        locked: [],
        fallback,
      });
      at += len.choose + len.reveal;
    }
    return { players: [...players], startedAt: ctx.now, rounds, revealed: 0 };
  },

  reduce(state, playerId, action, ctx): OrtalamaState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    const index = currentRound(state, ctx.now);
    const round = state.rounds[index];
    if (!round || ctx.now >= gameEndsAt(state)) return { rejected: "ended" };
    // Sonuç gösterilirken (seçim süresi bitti, sonraki tur henüz başlamadı) seçim alınmaz.
    if (ctx.now >= round.endsAt) return { rejected: "ended" };
    if (round.locked.includes(playerId)) return { rejected: "locked" };
    const put = (next: OrtalamaRoundState, shift = 0): OrtalamaState => ({
      ...state,
      rounds: state.rounds.map((r, i) =>
        i === index
          ? next
          : i > index && shift !== 0
            ? { ...r, startAt: r.startAt + shift, endsAt: r.endsAt + shift, revealEndsAt: r.revealEndsAt + shift }
            : r,
      ),
    });
    if (action.kind === "lock") {
      if (round.choices[playerId] === undefined) return { rejected: "nothing_to_lock" };
      const locked = [...round.locked, playerId];
      const waiting = state.players.some((id) => ctx.connected.includes(id) && !locked.includes(id));
      if (waiting) return put({ ...round, locked });
      // Bağlı herkes kilitledi: bu turun seçimi 1 sn sonra biter; sonraki turlar aynı kadar öne çekilir.
      const endsAt = Math.min(round.endsAt, ctx.now + ORTALAMA_LOCK_GRACE_MS);
      const revealEndsAt = endsAt + roundLength(index).reveal;
      return put({ ...round, locked, endsAt, revealEndsAt }, revealEndsAt - round.revealEndsAt);
    }
    if (action.value < ORTALAMA_MIN || action.value > ORTALAMA_MAX) return { rejected: "out_of_range" };
    if (round.choices[playerId] === action.value) return state;
    return put({ ...round, choices: { ...round.choices, [playerId]: action.value } });
  },

  tick(state, ctx): OrtalamaState {
    let revealed = state.revealed;
    while (revealed < state.rounds.length && ctx.now >= (state.rounds[revealed]?.endsAt ?? Number.POSITIVE_INFINITY)) {
      revealed++;
    }
    return revealed === state.revealed ? state : { ...state, revealed };
  },

  publicView(state, ctx): OrtalamaPublicView {
    const index = currentRound(state, ctx.now);
    const round = state.rounds[index] ?? state.rounds[0];
    if (!round) throw new Error("ortalama: tur yok");
    const open = ctx.now >= round.endsAt;
    // Açılmış önceki turlar: gösterilen turdan önceki hepsi (süreleri dolmuştur).
    const previous: OrtalamaRoundSummary[] = [];
    for (let r = 0; r < index; r++) {
      const { mean, target } = ortalamaSettle(state, r);
      previous.push({ mean, target, multiplier: ortalamaMultiplier(r) });
    }
    const totals = totalsOf(state, open ? index + 1 : index);
    return {
      startedAt: state.startedAt,
      roundStartedAt: round.startAt,
      endsAt: round.endsAt,
      revealEndsAt: round.revealEndsAt,
      round: index + 1,
      rounds: state.rounds.length,
      multiplier: ortalamaMultiplier(index),
      previous,
      totals,
      // Tur süresi dolmadan kimsenin seçimi, ortalama ya da hedef yoktur.
      reveal: open ? ortalamaSettle(state, index) : null,
      final: open && index === state.rounds.length - 1 ? ortalamaAwards(totals) : null,
      lockedIds: [...round.locked],
    };
  },

  view(state, playerId, ctx): OrtalamaView {
    const round = state.rounds[currentRound(state, ctx.now)];
    const mine = playerId === null ? undefined : round?.choices[playerId];
    return {
      myChoice: mine ?? null,
      locked: playerId !== null && (round?.locked.includes(playerId) ?? false),
    };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= gameEndsAt(state);
  },

  /**
   * Gizli değerler 0–100 arası kısa sayılardır; alt dizgi sızıntı denetimi onları koruyamaz
   * (en az 3 karakter şartı). Gizlilik yapısal olarak sağlanır ve ayrıca test edilir
   * (ortalamanin-yarisi.test.ts, "gizlilik"): `publicView` tur açılmadan seçim, ortalama ya da sıra
   * taşımaz (önceki turlar yalnız ortalama ve hedef), `view` yalnız sahibinin bu turdaki seçimini taşır,
   * atanacak rastgele sayılar hiçbir görünümde yoktur.
   */
  secrets() {
    return [];
  },

  result(state) {
    const totals = totalsOf(state, state.rounds.length);
    return { miniScores: { ...totals }, awards: ortalamaAwards(totals) };
  },
};
