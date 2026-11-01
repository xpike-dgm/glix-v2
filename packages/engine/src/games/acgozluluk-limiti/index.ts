import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { rankAwards } from "../scoring.js";
import {
  ACGOZLULUK_CHOOSE_MS,
  ACGOZLULUK_LOCK_GRACE_MS,
  ACGOZLULUK_PEEK_MS,
  ACGOZLULUK_REVEAL_MS,
  ACGOZLULUK_ROUND_REVEAL_MS,
  ACGOZLULUK_ROUNDS,
  ACGOZLULUK_WIRE_MAX,
  type AcgozlulukAction,
  type AcgozlulukBand,
  type AcgozlulukPublicView,
  type AcgozlulukReveal,
  type AcgozlulukRoundRecord,
  type AcgozlulukScoutWord,
  type AcgozlulukView,
  acgozlulukBand,
  acgozlulukScoutWord,
} from "./types.js";

export * from "./types.js";

/** Bir turun durumu. Erken bitişte `endsAt`/`revealEndsAt` öne çekilir ve sonraki turlar aynı kadar kayar. */
export interface AcgozlulukRoundState {
  startAt: number;
  endsAt: number;
  revealEndsAt: number;
  /**
   * Bu turun gerçek limiti (AL-M4): kurulumda sunucu rastgeleliğiyle bandın içinden çekilir. Gizli; tur açılana kadar
   * hiçbir görünümde yoktur (Gözcü yalnız ondan türeyen tek kelimeyi görür).
   */
  limit: number;
  /** Yalnız seçim gönderenler; son seçim geçerlidir. Gönderilmeyen 0 sayılır. */
  choices: Record<string, number>;
  /** Seçimini kilitleyenler (kilit sırasıyla). */
  locked: string[];
  /** Gözcü tur başında (ilk `catchUp`ta) atandı mı. */
  assigned: boolean;
  /** Bu turun Gözcü'sü; bağlı kimse yoksa null. */
  scoutId: string | null;
  /** Gözcü'nün bakışı: o anki gönderilmiş seçimlerin fotoğrafı (güncellenmez). */
  peek: { at: number; word: AcgozlulukScoutWord } | null;
}

export interface AcgozlulukState {
  players: string[];
  startedAt: number;
  maxChoice: number;
  band: AcgozlulukBand;
  /** Gözcü sırası: maç başında karıştırılan oyuncu listesi (AL-M3). */
  scoutOrder: string[];
  /** Bağlantısı kopuk katılımcılar. Yalnız `setup` ve `onPresence` yazar; böylece `tick` birebir tekrar oynatılır. */
  offline: string[];
  rounds: AcgozlulukRoundState[];
  /**
   * Süresi dolmuş tur sayısı ve ekrandaki tur. Görünümler `ctx.now`'dan türetilir; bunlar yalnız sunucunun
   * "durum değişti" sinyalini almasını sağlar (aksi halde tur açılışı ve geçişi kimseye yayınlanmaz).
   */
  revealed: number;
  shown: number;
}

/** Turun açılmış sonucu (dolum sırası ve taşıranlar dahil). */
export function acgozlulukSettle(state: AcgozlulukState, roundIndex: number): AcgozlulukReveal {
  const round = state.rounds[roundIndex];
  const limit = round?.limit ?? 0;
  const choices: Record<string, number> = {};
  const missing: string[] = [];
  let total = 0;
  for (const id of state.players) {
    const picked = round?.choices[id];
    if (picked === undefined) missing.push(id);
    const value = picked ?? 0;
    choices[id] = value;
    total += value;
  }
  const over = total > limit;
  const points: Record<string, number> = {};
  for (const id of state.players) points[id] = over ? 0 : (choices[id] ?? 0);
  // Küçükten büyüğe; `sort` kararlıdır, eşitlerde katılım sırası korunur.
  const order = state.players.filter((id) => (choices[id] ?? 0) > 0);
  order.sort((a, b) => (choices[a] ?? 0) - (choices[b] ?? 0));
  const spillers: string[] = [];
  if (over) {
    let sum = 0;
    let first = -1;
    for (let i = 0; i < order.length; i++) {
      sum += choices[order[i] as string] ?? 0;
      if (sum > limit) {
        first = i;
        break;
      }
    }
    const firstValue = choices[order[first] as string] ?? 0;
    for (let i = 0; i < order.length; i++) {
      const id = order[i] as string;
      if (i >= first || (choices[id] ?? 0) === firstValue) spillers.push(id);
    }
  }
  return { choices, missing, total, limit, over, points, order, spillers };
}

/** Mini puan toplamı: ilk `count` turun puanları (taşan tur 0). */
function totalsOf(state: AcgozlulukState, count: number): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of state.players) totals[id] = 0;
  for (let r = 0; r < Math.min(count, state.rounds.length); r++) {
    const { points } = acgozlulukSettle(state, r);
    for (const id of state.players) totals[id] = (totals[id] ?? 0) + (points[id] ?? 0);
  }
  return totals;
}

/**
 * Genel skor (AL-M1), oyun sonunda bir kez: mini puan toplamına göre tek lider +2, sonraki puanı paylaşanlar +1;
 * lider eşitse liderlerin hepsi +1. Mini puanı 0 olan ödül almaz. Eksi puan yok.
 */
export function acgozlulukAwards(totals: Record<string, number>): Record<string, number> {
  const awards = rankAwards(totals, { positiveOnly: true });
  const out: Record<string, number> = {};
  for (const id of Object.keys(totals)) out[id] = awards[id] ?? 0;
  return out;
}

/** `now` anında gösterilecek tur: açılışı bitmemiş ilk tur, yoksa son tur. */
function currentRound(state: AcgozlulukState, now: number): number {
  const i = state.rounds.findIndex((r) => now < r.revealEndsAt);
  return i === -1 ? state.rounds.length - 1 : i;
}

function gameEndsAt(state: AcgozlulukState): number {
  return state.rounds[state.rounds.length - 1]?.revealEndsAt ?? state.startedAt;
}

function revealLength(round: number): number {
  return round === ACGOZLULUK_ROUNDS - 1 ? ACGOZLULUK_REVEAL_MS : ACGOZLULUK_ROUND_REVEAL_MS;
}

/** Gözcü seçimi: sıradaki, daha önce Gözcü olmamış, bağlı oyuncu; yoksa bağlı herhangi biri; yoksa kimse. */
function pickScout(state: AcgozlulukState, roundIndex: number): string | null {
  const order = state.scoutOrder;
  const used = new Set(
    state.rounds
      .slice(0, roundIndex)
      .map((r) => r.scoutId)
      .filter((id) => id !== null),
  );
  const online = (id: string) => !state.offline.includes(id);
  for (let k = 0; k < order.length; k++) {
    const id = order[(roundIndex + k) % order.length] as string;
    if (online(id) && !used.has(id)) return id;
  }
  for (let k = 0; k < order.length; k++) {
    const id = order[(roundIndex + k) % order.length] as string;
    if (online(id)) return id;
  }
  return null;
}

function takePeek(state: AcgozlulukState, round: AcgozlulukRoundState, at: number): AcgozlulukRoundState {
  let total = 0;
  for (const id of state.players) total += round.choices[id] ?? 0;
  return { ...round, peek: { at, word: acgozlulukScoutWord(total, round.limit) } };
}

/**
 * Zamana bağlı ilerleme (saf): başlamış turlara Gözcü atar, bakış anı gelmiş turlarda Gözcü'nün fotoğrafını çeker.
 * Her eylemden, tick'ten ve bağlantı kaydından önce çağrılır; böylece fotoğraf bakış anındaki seçimleri taşır.
 */
function catchUp(state: AcgozlulukState, now: number): AcgozlulukState {
  let rounds: AcgozlulukRoundState[] | null = null;
  let s = state;
  for (let i = 0; i < state.rounds.length; i++) {
    let r = (rounds ?? state.rounds)[i] as AcgozlulukRoundState;
    const before = r;
    if (!r.assigned && now >= r.startAt) {
      r = { ...r, assigned: true, scoutId: pickScout(s, i) };
    }
    const peekAt = r.startAt + ACGOZLULUK_PEEK_MS;
    if (r.assigned && r.scoutId !== null && r.peek === null && now >= peekAt && peekAt < r.endsAt) {
      r = takePeek(s, r, peekAt);
    }
    if (r !== before) {
      rounds = [...(rounds ?? state.rounds)];
      rounds[i] = r;
      s = { ...state, rounds };
    }
  }
  return s;
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
      "3 tur: gizlice 0 ile oyuncu sayısı arasında bir sayı seç. Seçmezsen 0 sayılır.",
      "Toplam sisli limiti geçmesin. Gözcü hazneye bir kez bakar.",
      "Taşarsa o tur kimse puan almaz; taşmazsa en çok koyan kazanır.",
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
    const band = acgozlulukBand(players.length);
    const rounds: AcgozlulukRoundState[] = [];
    let at = ctx.now;
    for (let r = 0; r < ACGOZLULUK_ROUNDS; r++) {
      const reveal = revealLength(r);
      rounds.push({
        startAt: at,
        endsAt: at + ACGOZLULUK_CHOOSE_MS,
        revealEndsAt: at + ACGOZLULUK_CHOOSE_MS + reveal,
        limit: band.low + ctx.rng.int(band.high - band.low + 1),
        choices: {},
        locked: [],
        assigned: false,
        scoutId: null,
        peek: null,
      });
      at += ACGOZLULUK_CHOOSE_MS + reveal;
    }
    const state: AcgozlulukState = {
      players: [...players],
      startedAt: ctx.now,
      maxChoice: players.length,
      band,
      scoutOrder: ctx.rng.shuffle(players),
      offline: players.filter((id) => !ctx.connected.includes(id)),
      rounds,
      revealed: 0,
      shown: 0,
    };
    return catchUp(state, ctx.now);
  },

  reduce(prev, playerId, action, ctx): AcgozlulukState | Rejected {
    if (!prev.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < prev.startedAt) return { rejected: "not_started" };
    const state = catchUp(prev, ctx.now);
    const index = currentRound(state, ctx.now);
    const round = state.rounds[index];
    if (!round || ctx.now >= gameEndsAt(state)) return { rejected: "ended" };
    // Açılış sırasında (seçim süresi bitti, sonraki tur başlamadı) seçim alınmaz.
    if (ctx.now >= round.endsAt || ctx.now < round.startAt) return { rejected: "ended" };
    if (round.locked.includes(playerId)) return { rejected: "locked" };
    const put = (next: AcgozlulukRoundState, shift = 0): AcgozlulukState => ({
      ...state,
      rounds: state.rounds.map((r, i) =>
        i === index
          ? next
          : i > index && shift !== 0
            ? {
                ...r,
                startAt: r.startAt + shift,
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
      // Bağlı herkes kilitledi: seçim 1 sn sonra biter, sonraki turlar öne çekilir. Gözcü henüz bakmadıysa şimdi bakar.
      const endsAt = Math.min(round.endsAt, ctx.now + ACGOZLULUK_LOCK_GRACE_MS);
      const revealEndsAt = endsAt + revealLength(index);
      let next: AcgozlulukRoundState = { ...round, locked, endsAt, revealEndsAt };
      if (next.scoutId !== null && next.peek === null) next = takePeek(state, next, ctx.now);
      return put(next, revealEndsAt - round.revealEndsAt);
    }
    if (action.value < 0 || action.value > state.maxChoice) return { rejected: "out_of_range" };
    if (round.choices[playerId] === action.value) return state;
    return put({ ...round, choices: { ...round.choices, [playerId]: action.value } });
  },

  tick(prev, ctx): AcgozlulukState {
    const state = catchUp(prev, ctx.now);
    let revealed = state.revealed;
    while (
      revealed < state.rounds.length &&
      ctx.now >= (state.rounds[revealed]?.endsAt ?? Number.POSITIVE_INFINITY)
    ) {
      revealed++;
    }
    const shown = currentRound(state, ctx.now);
    if (revealed === state.revealed && shown === state.shown) return state;
    return { ...state, revealed, shown };
  },

  /** Bağlantı kaydı: kopuk listesini günceller (Gözcü seçimi yalnız buna bakar; AL-M3). */
  onPresence(prev, ctx): AcgozlulukState {
    const state = catchUp(prev, ctx.now);
    const offline = state.players.filter((id) => !ctx.connected.includes(id));
    if (offline.length === state.offline.length && offline.every((id) => state.offline.includes(id)))
      return state;
    return { ...state, offline };
  },

  nextWake(state, ctx): number | null {
    let best: number | null = null;
    for (const r of state.rounds) {
      for (const at of [r.startAt, r.startAt + ACGOZLULUK_PEEK_MS, r.endsAt, r.revealEndsAt]) {
        if (at > ctx.now && (best === null || at < best)) best = at;
      }
    }
    return best;
  },

  publicView(raw, ctx): AcgozlulukPublicView {
    const state = catchUp(raw, ctx.now);
    const index = currentRound(state, ctx.now);
    const round = state.rounds[index] ?? state.rounds[0];
    if (!round) throw new Error("açgözlülük: tur yok");
    const open = ctx.now >= round.endsAt;
    const history: AcgozlulukRoundRecord[] = [];
    for (let r = 0; r < index; r++) {
      history.push({ scoutId: state.rounds[r]?.scoutId ?? null, reveal: acgozlulukSettle(state, r) });
    }
    const totals = totalsOf(state, open ? index + 1 : index);
    return {
      startedAt: state.startedAt,
      roundStartedAt: round.startAt,
      endsAt: round.endsAt,
      revealEndsAt: round.revealEndsAt,
      round: index + 1,
      rounds: state.rounds.length,
      band: { ...state.band },
      maxChoice: state.maxChoice,
      scoutId: round.assigned ? round.scoutId : null,
      scoutPeekedAt: round.peek?.at ?? null,
      history,
      totals,
      // Tur süresi dolmadan kimsenin seçimi, toplam ya da gerçek limit yoktur.
      reveal: open ? acgozlulukSettle(state, index) : null,
      final: open && index === state.rounds.length - 1 ? acgozlulukAwards(totals) : null,
      lockedIds: [...round.locked],
    };
  },

  view(raw, playerId, ctx): AcgozlulukView {
    const state = catchUp(raw, ctx.now);
    const round = state.rounds[currentRound(state, ctx.now)];
    const mine = playerId === null ? undefined : round?.choices[playerId];
    const peek = round?.peek ?? null;
    return {
      myChoice: mine ?? null,
      locked: playerId !== null && (round?.locked.includes(playerId) ?? false),
      // Gözcü kelimesi yalnız Gözcü'ye gider (izleyici ve TV hiçbir zaman görmez).
      scout:
        playerId !== null && round?.scoutId === playerId && peek ? { word: peek.word, at: peek.at } : null,
    };
  },

  /** Son açılış son turun seçim süresinin bittiği an başlar. */
  revealAt(state): number | null {
    return state.rounds[state.rounds.length - 1]?.endsAt ?? null;
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= gameEndsAt(state);
  },

  /**
   * Gizli değerler 0..8 arası seçimler, 5..46 arası gerçek limitler ve turdan tura tekrar edebilen tek Gözcü kelimesidir;
   * alt dizgi sızıntı denetimi bunları koruyamaz (kısa sayılar; aynı kelime başka turun Gözcü'sünde meşru olarak
   * görünebilir). Gizlilik yapısal olarak sağlanır ve test edilir (acgozluluk-limiti.test.ts, "gizlilik"): `publicView`
   * tur açılmadan seçim, toplam ya da gerçek limit taşımaz; `view` yalnız sahibinin seçimini ve yalnız Gözcü'ye kelimesini.
   */
  secrets() {
    return [];
  },

  result(state) {
    const totals = totalsOf(state, state.rounds.length);
    return { miniScores: { ...totals }, awards: acgozlulukAwards(totals) };
  },
};
