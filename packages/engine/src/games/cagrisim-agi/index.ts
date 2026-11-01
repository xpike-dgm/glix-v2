import { poolEntries } from "../../content.js";
import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import { foldKey } from "../text.js";
import { groupAnswers } from "./grouping.js";
import { CAGRISIM_POOL, type CagrisimWord, levelOf } from "./pool.js";
import {
  CAGRISIM_ANSWER_MS,
  CAGRISIM_CONTENT_MEMORY,
  CAGRISIM_FINAL_MS,
  CAGRISIM_LOCK_GRACE_MS,
  CAGRISIM_MAX_LENGTH,
  CAGRISIM_MINI_MS,
  CAGRISIM_ROUNDS,
  CAGRISIM_SERIES,
  type CagrisimAgiAction,
  type CagrisimAgiPublicView,
  type CagrisimAgiView,
  type CagrisimLevel,
  type CagrisimPhase,
  type CagrisimRoundResult,
  cagrisimAwards,
} from "./types.js";

export {
  displayAnswer,
  groupAnswers,
  matchKey,
  normalizeAnswer,
  oneLetterApart,
} from "./grouping.js";
export { CAGRISIM_POOL, type CagrisimWord, cagrisimLevel, levelOf } from "./pool.js";
export * from "./types.js";
export { CAGRISIM_EASY, CAGRISIM_ENTRIES, CAGRISIM_HARD, CAGRISIM_WORDS } from "./words.js";

export interface CagrisimSeriesWord {
  text: string;
  /** Tekrar önleme anahtarı (havuzun `key`'i; CG-M4). */
  key: string;
  level: CagrisimLevel;
}

export interface CagrisimAgiState {
  players: string[];
  /** Oyunun (ilk kelimenin) başlangıcı. */
  startedAt: number;
  /** Kolaydan zora üç kelime (CG-M2, CG-M5). */
  words: CagrisimSeriesWord[];
  /** Oynanan kelimenin sırası (0..2). */
  round: number;
  roundStartedAt: number;
  answerEndsAt: number;
  phase: CagrisimPhase;
  /** Kelime başına: oyuncu -> gönderdiği cevap (kırpılmış, ham). Yalnız gönderenlerde anahtar vardır. */
  answers: Record<string, string>[];
  /** Kelime başına cevap sırası (eşitlikte gösterilecek yazılış için). */
  order: string[][];
}

const LAST = CAGRISIM_ROUNDS - 1;

/** Bu kelimenin açılışının bitişi: arada 4 sn'lik mini, sonda büyük açılış. */
function revealEndsAt(s: CagrisimAgiState): number {
  return s.answerEndsAt + (s.round >= LAST ? CAGRISIM_FINAL_MS : CAGRISIM_MINI_MS);
}

/** Oyunun bitişi: kalan kelimeler tam süreyle oynanırsa. Erken bitişle öne gelir. */
function seriesEndsAt(s: CagrisimAgiState): number {
  return s.answerEndsAt + (LAST - s.round) * (CAGRISIM_MINI_MS + CAGRISIM_ANSWER_MS) + CAGRISIM_FINAL_MS;
}

/**
 * Zamanla ilerleme: cevap süresi bitince açılış (son kelimede büyük), mini açılış bitince sonraki kelime. Geçiş anları
 * hesaplanmış zamanlardır (tick gecikse de değişmez); değişiklik yoksa aynı nesne döner.
 */
function advance(state: CagrisimAgiState, now: number): CagrisimAgiState {
  let s = state;
  for (;;) {
    if (s.phase === "answer" && now >= s.answerEndsAt) {
      s = { ...s, phase: s.round >= LAST ? "final" : "mini" };
    } else if (s.phase === "mini" && now >= revealEndsAt(s)) {
      const roundStartedAt = revealEndsAt(s);
      s = {
        ...s,
        round: s.round + 1,
        phase: "answer",
        roundStartedAt,
        answerEndsAt: roundStartedAt + CAGRISIM_ANSWER_MS,
        answers: [...s.answers, {}],
        order: [...s.order, []],
      };
    } else return s;
  }
}

/** Zorluğa göre komşu sırası (CG-M5): o zorlukta kelime kalmadıysa komşusundan çekilir. */
const NEIGHBORS: Record<CagrisimLevel, readonly CagrisimLevel[]> = {
  kolay: ["kolay", "orta", "zor"],
  orta: ["orta", "kolay", "zor"],
  zor: ["zor", "orta", "kolay"],
};

/** Üç farklı kelime, kolaydan zora. Havuz tekrar süzgecinden geçmiş olarak gelir (sunucu, CG-M4). */
function drawSeries(pool: readonly CagrisimWord[], ctx: GameContext): CagrisimSeriesWord[] {
  const picked: CagrisimSeriesWord[] = [];
  const free = (e: CagrisimWord): boolean => !picked.some((p) => p.key === CAGRISIM_POOL.key(e));
  for (const want of CAGRISIM_SERIES) {
    let cands: CagrisimWord[] = [];
    for (const level of NEIGHBORS[want]) {
      cands = pool.filter((e) => levelOf(e) === level && free(e));
      if (cands.length > 0) break;
    }
    if (cands.length === 0) cands = [...pool];
    const e = cands[ctx.rng.int(cands.length)] as CagrisimWord;
    picked.push({ text: e.text, key: CAGRISIM_POOL.key(e), level: levelOf(e) });
  }
  return picked;
}

/** Açılmış kelimelerin sonuçları (cevap aşamasındaki kelime hariç). */
function revealedRounds(s: CagrisimAgiState): CagrisimRoundResult[] {
  const count = s.phase === "answer" ? s.round : s.round + 1;
  const out: CagrisimRoundResult[] = [];
  for (let r = 0; r < count; r++) {
    out.push({
      word: s.words[r]?.text ?? "",
      reveal: groupAnswers(s.players, s.answers[r] ?? {}, s.order[r] ?? []),
    });
  }
  return out;
}

/** Ağ puanlarının toplamı (oyuncu başına; ağ yoksa 0). */
function totalsOf(
  players: readonly string[],
  results: readonly CagrisimRoundResult[],
): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(players.map((id) => [id, 0]));
  for (const { reveal } of results)
    for (const g of reveal.groups) for (const id of g.members) totals[id] = (totals[id] ?? 0) + g.points;
  return totals;
}

function jsonHas(json: string, value: string): boolean {
  return json.includes(value) || json.includes(JSON.stringify(value).slice(1, -1));
}

export const cagrisimAgi: GameDefinition<
  CagrisimAgiState,
  CagrisimAgiAction,
  CagrisimAgiView,
  CagrisimAgiPublicView
> = {
  id: "cagrisim-agi",
  name: "Çağrışım Ağı",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Arkadaşlarınla aynı şeyi düşün!",
    // CG-U14; "Cevabını yüksek sesle söyleme!" notu anlatım görselinde (istemci BriefingArt).
    steps: [
      "Ortadaki kelimeyi gör",
      "Çoğunluk ne yazar? Tek bir cevap yaz",
      "Aynısını yazanlarla ağ kur: üç kelime, puanlar toplanır",
    ],
  },

  parseAction(raw: unknown): CagrisimAgiAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const keys = Object.keys(raw);
    const rec = raw as Record<string, unknown>;
    if (keys.length !== 2 || rec.kind !== "answer" || typeof rec.text !== "string") return null;
    const text = rec.text.trim();
    if (text.length > CAGRISIM_MAX_LENGTH) return null;
    return { kind: "answer", text };
  },

  setup(players: readonly string[], ctx: GameContext): CagrisimAgiState {
    const words = drawSeries(poolEntries(CAGRISIM_POOL, ctx.content), ctx);
    return {
      players: [...players],
      startedAt: ctx.now,
      words,
      round: 0,
      roundStartedAt: ctx.now,
      answerEndsAt: ctx.now + CAGRISIM_ANSWER_MS,
      phase: "answer",
      answers: [{}],
      order: [[]],
    };
  },

  reduce(state, playerId, action, ctx): CagrisimAgiState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    const s = advance(state, ctx.now);
    if (s.phase !== "answer" || ctx.now >= s.answerEndsAt) return { rejected: "ended" };
    if (ctx.now < s.roundStartedAt) return { rejected: "not_started" };
    const current = s.answers[s.round] ?? {};
    if (Object.hasOwn(current, playerId)) return { rejected: "already_answered" };
    const text = action.text.trim();
    if (foldKey(text) === "") return { rejected: "empty" };
    if (text.length > CAGRISIM_MAX_LENGTH) return { rejected: "too_long" };
    const mine = { ...current, [playerId]: text };
    const answers = s.answers.map((a, i) => (i === s.round ? mine : a));
    const order = s.order.map((o, i) => (i === s.round ? [...o, playerId] : o));
    const waiting = s.players.some((id) => ctx.connected.includes(id) && !Object.hasOwn(mine, id));
    if (waiting) return { ...s, answers, order };
    // Bağlı herkes cevapladı: bu kelimenin cevap aşaması 1 sn sonra biter (cevaplar zaten kesin).
    const answerEndsAt = Math.min(s.answerEndsAt, ctx.now + CAGRISIM_LOCK_GRACE_MS);
    return { ...s, answers, order, answerEndsAt };
  },

  tick(state, ctx): CagrisimAgiState {
    return advance(state, ctx.now);
  },

  nextWake(state, ctx): number | null {
    const at =
      state.phase === "answer"
        ? state.answerEndsAt
        : state.phase === "mini"
          ? revealEndsAt(state)
          : seriesEndsAt(state);
    return at > ctx.now ? at : null;
  },

  publicView(state): CagrisimAgiPublicView {
    const results = revealedRounds(state);
    const totals = totalsOf(state.players, results);
    return {
      startedAt: state.startedAt,
      round: state.round,
      rounds: CAGRISIM_ROUNDS,
      roundStartedAt: state.roundStartedAt,
      answerEndsAt: state.answerEndsAt,
      revealEndsAt: revealEndsAt(state),
      endsAt: seriesEndsAt(state),
      word: state.words[state.round]?.text ?? "",
      phase: state.phase,
      answeredIds: state.players.filter((id) => Object.hasOwn(state.answers[state.round] ?? {}, id)),
      results,
      totals,
      awards: state.phase === "final" ? cagrisimAwards(totals) : null,
    };
  },

  view(state, playerId): CagrisimAgiView {
    const mine = playerId === null ? undefined : state.answers[state.round]?.[playerId];
    return { myAnswer: mine ?? null };
  },

  /** Büyük açılış üçüncü kelimenin cevap süresinin bittiği an başlar. */
  revealAt(state): number | null {
    return state.round >= LAST ? state.answerEndsAt : null;
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= seriesEndsAt(state);
  },

  secrets(state): readonly SecretEntry[] {
    if (state.phase !== "answer") return [];
    const current = state.answers[state.round] ?? {};
    // Önceki kelimelerin açılmış cevapları ve kelimeler herkese açıktır: aynı metin bu kelimede yeniden yazıldıysa alt
    // dizgi denetimi onu ayırt edemez (yapı yine gizlidir: görünümde yalnız bu kelimenin `answeredIds`'i var).
    const shown = JSON.stringify({ words: state.words.map((w) => w.text), results: revealedRounds(state) });
    const entries: SecretEntry[] = [];
    for (const id of state.players) {
      const value = current[id];
      // Çok kısa cevaplar alt dizgi sızıntı denetimine uygun değildir; yapısal testlerle korunur.
      if (value === undefined || value.length < 3 || jsonHas(shown, value)) continue;
      // Başkasının kendi cevabı, bu cevabı içeriyorsa (aynı ya da daha uzun yazdıysa) onun da görmeye hakkı var.
      const owners = state.players.filter((other) => {
        const mine = current[other];
        return other === id || (mine !== undefined && jsonHas(JSON.stringify({ myAnswer: mine }), value));
      });
      entries.push({ ownerIds: owners, value, label: `${id} cevabı` });
    }
    return entries;
  },

  /** Ağ puanları üç kelimede toplanır (mini puan); genel skora sıralama ödülü gider (CG-M1). */
  result(state) {
    const all: CagrisimRoundResult[] = state.answers.map((a, r) => ({
      word: state.words[r]?.text ?? "",
      reveal: groupAnswers(state.players, a, state.order[r] ?? []),
    }));
    const totals = totalsOf(state.players, all);
    return { miniScores: { ...totals }, awards: cagrisimAwards(totals) };
  },

  contentUsed(state) {
    return state.words.map((w) => ({
      poolId: CAGRISIM_POOL.id,
      key: w.key,
      memory: CAGRISIM_CONTENT_MEMORY,
    }));
  },

  /** Kelime karnesi (CG-M6): oynanan her kelime için iki oran; cevap metni, ad ya da oda gitmez. */
  contentFeedback(state) {
    const out: { poolId: string; key: string; play: { top: number; single: number } }[] = [];
    state.answers.forEach((a, r) => {
      const word = state.words[r];
      const answered = Object.keys(a).length;
      if (!word || answered === 0) return;
      const reveal = groupAnswers(state.players, a, state.order[r] ?? []);
      out.push({
        poolId: CAGRISIM_POOL.id,
        key: word.key,
        play: {
          top: (reveal.groups[0]?.members.length ?? 0) / answered,
          single: reveal.singles.length / answered,
        },
      });
    });
    return out;
  },
};
