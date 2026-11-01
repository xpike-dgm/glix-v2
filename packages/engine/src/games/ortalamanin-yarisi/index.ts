import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { rankAwards } from "../scoring.js";
import {
  ORTALAMA_CHOOSE_MS,
  ORTALAMA_CROWD,
  ORTALAMA_INTRO_MS,
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
  /** Tur kartının açıldığı an (OY-U3). */
  startAt: number;
  /** Seçimin başladığı an: kart yerleşince (`startAt` + `ORTALAMA_INTRO_MS`). */
  chooseAt: number;
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
  /** Süresi dolmuş (sonucu açılmış) tur sayısı. */
  revealed: number;
  /**
   * Ekranda gösterilen tur (0 tabanlı). Görünümler `ctx.now`'dan türetilir; `revealed` ve `shown` yalnız
   * "durum değişti" sinyalidir (sunucu yalnız durum değişince yayın yapar; tur geçişi de yayın gerektirir).
   */
  shown: number;
}

function finalChoices(state: OrtalamaState, round: OrtalamaRoundState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of state.players) out[id] = round.choices[id] ?? round.fallback[id] ?? ORTALAMA_MIN;
  return out;
}

/**
 * Bir turun puanlaması (saf; istemci "ne olurdu?" satırı da bunu kullanır, OY-U7). `players` katılım sırasıdır (eşit
 * uzaklıklar bu sırayla dizilir). Hedef = ortalama × çarpan (½, ⅔, ¾). Uzaklıklar tam sayı aritmetiğiyle
 * karşılaştırılır (|den·n·seçim − num·toplam| ∝ |seçim − hedef|), böylece ondalık hata eşitliği bozmaz.
 *
 * - OY-M2: `random` (sunucunun atadığı sayılar) ortalamaya girer ama sahibi puan almaz.
 * - OY-M1: aynı sayıyı seçen (rastgele olmayan) oyuncu sayısı `ORTALAMA_CROWD` ya da daha çoksa o sayı yanar; yananlar
 *   puan almaz, sayıları ortalamaya girer. Rastgele sayılar kalabalık sayımına girmez.
 * - Puan, yalnız uygun oyuncular arasında: en yakın tek kişiyse +2, sonraki derece(ler) +1; en yakınlar eşitse hepsi +1,
 *   ikinci ödül yok. Uygun kimse yoksa o tur kimse puan almaz.
 */
export function ortalamaScore(
  players: readonly string[],
  choices: Readonly<Record<string, number>>,
  random: readonly string[],
  multiplier: { num: number; den: number },
): OrtalamaReveal {
  const { num, den } = multiplier;
  const n = players.length;
  const value = (id: string): number => choices[id] ?? ORTALAMA_MIN;
  const sum = players.reduce((a, id) => a + value(id), 0);
  const key = (id: string): number => Math.abs(den * n * value(id) - num * sum);
  const isRandom = new Set(random.filter((id) => players.includes(id)));
  const crowd = new Map<number, number>();
  for (const id of players) {
    if (isRandom.has(id)) continue;
    crowd.set(value(id), (crowd.get(value(id)) ?? 0) + 1);
  }
  const burnedSet = new Set(
    players.filter((id) => !isRandom.has(id) && (crowd.get(value(id)) ?? 0) >= ORTALAMA_CROWD),
  );
  const order = [...players].sort((a, b) => key(a) - key(b));
  const target = n > 0 ? (num * sum) / (den * n) : 0;
  const ranks: Record<string, number> = {};
  const points: Record<string, number> = {};
  const distances: Record<string, number> = {};
  const out: Record<string, number> = {};
  for (const id of players) out[id] = value(id);
  const groups: string[][] = [];
  let prev: number | null = null;
  for (const id of order) {
    distances[id] = Math.abs(value(id) - target);
    points[id] = 0;
    ranks[id] = 0;
    if (isRandom.has(id) || burnedSet.has(id)) continue;
    const k = key(id);
    if (prev === null || k !== prev) {
      groups.push([]);
      prev = k;
    }
    groups[groups.length - 1]?.push(id);
    ranks[id] = groups.length;
  }
  const first = groups[0] ?? [];
  if (first.length === 1) {
    for (const id of first) points[id] = 2;
    for (const id of groups[1] ?? []) points[id] = 1;
  } else {
    for (const id of first) points[id] = 1;
  }
  return {
    choices: out,
    random: players.filter((id) => isRandom.has(id)),
    burned: players.filter((id) => burnedSet.has(id)),
    mean: n > 0 ? sum / n : 0,
    target,
    distances,
    order,
    ranks,
    points,
  };
}

/** Bir turun sonucu: seçim göndermeyenlere atanan sayılar `random` olarak işaretlenir (OY-M2). */
export function ortalamaSettle(state: OrtalamaState, roundIndex = 0): OrtalamaReveal {
  const round = state.rounds[roundIndex];
  const choices = round ? finalChoices(state, round) : {};
  const random = round ? state.players.filter((id) => round.choices[id] === undefined) : [];
  return ortalamaScore(state.players, choices, random, ortalamaMultiplier(roundIndex));
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
 * paylaşanların hepsi +1 (+2 yok). Bu oyunda negatif kural yoktur. OY-M1 ile her turda herkes yanabildiği için
 * en yüksek toplam 0 olabilir: o zaman kimse genel puan almaz (puansız oyuncu "lider" sayılmaz).
 */
export function ortalamaAwards(totals: Record<string, number>): Record<string, number> {
  const top = Math.max(0, ...Object.values(totals));
  const awards = top > 0 ? rankAwards(totals) : {};
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

function roundLength(round: number): { intro: number; choose: number; reveal: number } {
  return {
    intro: ORTALAMA_INTRO_MS,
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
  // OY-U16: örnek hesaplı üç madde (madde başına en çok iki satır).
  briefing: {
    goal: "Ortalamanın katını tahmin et: 3 tur, her turda hedef değişir!",
    steps: [
      "Gizlice 0–100 yaz. Ortalamayı değil, kesrini (½ ⅔ ¾) tahmin et.",
      "Örnek: 10·20·30·40·50 → ort. 30 → yarısı 15. 10 ve 20 eşit: ikisi +1.",
      "En yakın +2, ikinci +1. Aynı sayıyı 3 kişi yazarsa sayı yanar.",
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
      const chooseAt = at + len.intro;
      rounds.push({
        startAt: at,
        chooseAt,
        endsAt: chooseAt + len.choose,
        revealEndsAt: chooseAt + len.choose + len.reveal,
        choices: {},
        locked: [],
        fallback,
      });
      at = chooseAt + len.choose + len.reveal;
    }
    return { players: [...players], startedAt: ctx.now, rounds, revealed: 0, shown: 0 };
  },

  reduce(state, playerId, action, ctx): OrtalamaState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    const index = currentRound(state, ctx.now);
    const round = state.rounds[index];
    if (!round || ctx.now >= gameEndsAt(state)) return { rejected: "ended" };
    // Tur kartı sırasında (OY-U3) seçim alınmaz: seçim süresi kart yerleşince başlar.
    if (ctx.now < round.chooseAt) return { rejected: "not_started" };
    // Sonuç gösterilirken (seçim süresi bitti, sonraki tur henüz başlamadı) seçim alınmaz.
    if (ctx.now >= round.endsAt) return { rejected: "ended" };
    if (round.locked.includes(playerId)) return { rejected: "locked" };
    const put = (next: OrtalamaRoundState, shift = 0): OrtalamaState => ({
      ...state,
      rounds: state.rounds.map((r, i) =>
        i === index
          ? next
          : i > index && shift !== 0
            ? {
                ...r,
                startAt: r.startAt + shift,
                chooseAt: r.chooseAt + shift,
                endsAt: r.endsAt + shift,
                revealEndsAt: r.revealEndsAt + shift,
              }
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
    while (
      revealed < state.rounds.length &&
      ctx.now >= (state.rounds[revealed]?.endsAt ?? Number.POSITIVE_INFINITY)
    ) {
      revealed++;
    }
    const shown = currentRound(state, ctx.now);
    return revealed === state.revealed && shown === state.shown ? state : { ...state, revealed, shown };
  },

  publicView(state, ctx): OrtalamaPublicView {
    const index = currentRound(state, ctx.now);
    const round = state.rounds[index] ?? state.rounds[0];
    if (!round) throw new Error("ortalama: tur yok");
    const open = ctx.now >= round.endsAt;
    // Açılmış önceki turlar: gösterilen turdan önceki hepsi (süreleri dolmuştur).
    const previous: OrtalamaRoundSummary[] = [];
    for (let r = 0; r < index; r++) {
      const { mean, target, choices, points, random, burned } = ortalamaSettle(state, r);
      previous.push({ mean, target, multiplier: ortalamaMultiplier(r), choices, points, random, burned });
    }
    const totals = totalsOf(state, open ? index + 1 : index);
    return {
      startedAt: state.startedAt,
      introAt: round.startAt,
      roundStartedAt: round.chooseAt,
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

  /** Sonuç açılışı son turun seçim süresi bittiği an başlar. */
  revealAt(state): number | null {
    return state.rounds[state.rounds.length - 1]?.endsAt ?? null;
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
