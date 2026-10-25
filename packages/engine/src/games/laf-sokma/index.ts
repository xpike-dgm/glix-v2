import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import { moderateText } from "../../moderation/blocklist.js";
import type { Rng } from "../../rng.js";
import { derivedRng, drawSeed } from "../seeded.js";
import { LAF_DEFAULT_TONE, LAF_PROMPTS, type LafTone } from "./prompts.js";
import { cleanAnswer } from "./text.js";
import {
  LAF_ANSWER_MAX,
  LAF_EMPTY_REVEAL_MS,
  LAF_FINAL_ID,
  LAF_FINAL_REVEAL_MS,
  LAF_FINAL_VOTE_MS,
  LAF_FINAL_WRITE_MS,
  LAF_LOCK_GRACE_MS,
  LAF_RAW_MAX,
  LAF_REVEAL_MS,
  LAF_VOTE_MS,
  LAF_WRITE_MS,
  type LafAction,
  type LafCard,
  type LafCardResult,
  type LafDuelReveal,
  type LafPhase,
  type LafPublicView,
  type LafTask,
  type LafView,
} from "./types.js";

export * from "./prompts.js";
export * from "./types.js";

/** Bir sorunun iki sahibi: sıra rastgele, çift tekrar etmez. */
export type LafPair = readonly [string, string];

export interface LafDuelState {
  id: string;
  prompt: string;
  authors: LafPair;
}

export interface LafState {
  players: string[];
  seed: number;
  tone: LafTone;
  startedAt: number;
  duels: LafDuelState[];
  finalPrompt: string;
  /** Şimdiki adım: 0 yazma; 1+2i oylama, 2+2i açılış (i. düello); sonra final yazma, final oylama, final açılış. */
  step: number;
  stepStartedAt: number;
  stepEndsAt: number;
  /** Soru kimliği -> oyuncu -> temizlenmiş cevap. */
  answers: Record<string, Record<string, string>>;
  /** Şimdiki yazma adımında "Tamam" diyenler. */
  locked: string[];
  /** Soru kimliği -> oy veren -> oy verilen yazar (gizli: yalnız açılışta görünür). */
  votes: Record<string, Record<string, string>>;
}

const has = <T>(rec: Record<string, T>, key: string): boolean => Object.hasOwn(rec, key);
const get = <T>(rec: Record<string, T>, key: string): T | undefined => (has(rec, key) ? rec[key] : undefined);

/**
 * Soru dağıtımı: N oyuncu için N soru; her soru tam iki oyuncuya, her oyuncu tam iki soruya, hiçbir çift
 * tekrar etmez (3 oyuncuda üçgen). Karışık bir halkada `adım` kadar uzaktaki oyuncular eşleşir; 1 ≤ adım <
 * N/2 olduğundan çift ikinci kez oluşmaz.
 */
export function lafAssign(players: readonly string[], rng: Rng): LafPair[] {
  const n = players.length;
  const ring = rng.shuffle(players);
  const maxStride = Math.max(1, Math.floor((n - 1) / 2));
  const stride = 1 + rng.int(maxStride);
  const pairs: LafPair[] = [];
  for (let i = 0; i < n; i++) {
    const a = ring[i] as string;
    const b = ring[(i + stride) % n] as string;
    pairs.push(rng.int(2) === 0 ? [a, b] : [b, a]);
  }
  return rng.shuffle(pairs);
}

// ---- adım düzeni ----

export type LafStepKind =
  | { phase: "write" }
  | { phase: "vote"; duel: number }
  | { phase: "reveal"; duel: number }
  | { phase: "finalWrite" }
  | { phase: "finalVote" }
  | { phase: "finalReveal" };

export function lafLastStep(total: number): number {
  return 3 + 2 * total;
}

export function lafStepKind(step: number, total: number): LafStepKind {
  if (step <= 0) return { phase: "write" };
  if (step <= 2 * total) {
    const duel = Math.floor((step - 1) / 2);
    return step % 2 === 1 ? { phase: "vote", duel } : { phase: "reveal", duel };
  }
  const k = step - 2 * total;
  if (k <= 1) return { phase: "finalWrite" };
  return k === 2 ? { phase: "finalVote" } : { phase: "finalReveal" };
}

const voteStepOf = (duel: number): number => 1 + 2 * duel;
const revealStepOf = (duel: number): number => 2 + 2 * duel;
const finalVoteStep = (total: number): number => 2 * total + 2;
const finalRevealStep = (total: number): number => 2 * total + 3;

// ---- kartlar ve puanlar ----

interface InternalCard extends LafCard {
  author: string;
}

/** Bir sorunun kartları (sıra tohumdan sabit; cevaplar kesinleştikten sonra değişmez). */
export function lafCards(state: LafState, key: string): InternalCard[] {
  const rng = derivedRng(state.seed, "cards", key);
  const answers = get(state.answers, key) ?? {};
  if (key === LAF_FINAL_ID) {
    const authors = state.players.filter((id) => has(answers, id));
    return rng.shuffle(authors).map((author, i) => ({
      id: `k${i + 1}`,
      author,
      text: get(answers, author) ?? null,
    }));
  }
  const duel = state.duels.find((d) => d.id === key);
  if (!duel) return [];
  return rng.shuffle(duel.authors).map((author, i) => ({
    id: `k${i + 1}`,
    author,
    text: get(answers, author) ?? null,
  }));
}

/** Soruda oy verebilecek oyuncular (katılım sırasıyla). */
export function lafVoters(state: LafState, key: string): string[] {
  if (key === LAF_FINAL_ID) {
    const cards = lafCards(state, key);
    return state.players.filter((p) => cards.some((c) => c.author !== p));
  }
  const duel = state.duels.find((d) => d.id === key);
  return duel ? state.players.filter((p) => !duel.authors.includes(p)) : [];
}

/** Oy verilebilen (cevabı olan) kart var mı. */
const hasVotable = (state: LafState, key: string): boolean =>
  lafCards(state, key).some((c) => c.text !== null) && lafVoters(state, key).length > 0;

function cardResults(state: LafState, key: string): LafCardResult[] {
  const cards = lafCards(state, key);
  const votes = get(state.votes, key) ?? {};
  const byAuthor = new Map<string, string[]>();
  for (const p of state.players) {
    const target = get(votes, p);
    if (target === undefined) continue;
    byAuthor.set(target, [...(byAuthor.get(target) ?? []), p]);
  }
  const total = [...byAuthor.values()].reduce((sum, v) => sum + v.length, 0);
  return cards.map((c) => {
    const voters = byAuthor.get(c.author) ?? [];
    // Laf Ustası yalnız düelloda: iki kart arasında tüm oyları (en az 2) almak.
    const master = key !== LAF_FINAL_ID && total >= 2 && voters.length === total;
    return {
      id: c.id,
      author: c.author,
      text: c.text,
      voters,
      points: voters.length + (master ? 1 : 0),
      master,
    };
  });
}

function reveal(state: LafState, key: string): LafDuelReveal {
  const prompt =
    key === LAF_FINAL_ID ? state.finalPrompt : (state.duels.find((d) => d.id === key)?.prompt ?? "");
  return { id: key, prompt, cards: cardResults(state, key) };
}

function addPoints(scores: Record<string, number>, results: LafCardResult[]): void {
  for (const r of results) scores[r.author] = (scores[r.author] ?? 0) + r.points;
}

const zeroScores = (players: readonly string[]): Record<string, number> =>
  Object.fromEntries(players.map((p) => [p, 0]));

/** Açılmış sorulardan (`step` dahil) toplanan puanlar; `all` ise hepsi. */
export function lafScores(state: LafState, all = false): Record<string, number> {
  const scores = zeroScores(state.players);
  const n = state.duels.length;
  state.duels.forEach((d, i) => {
    if (all || state.step >= revealStepOf(i)) addPoints(scores, cardResults(state, d.id));
  });
  if (all || state.step >= finalRevealStep(n)) addPoints(scores, cardResults(state, LAF_FINAL_ID));
  return scores;
}

// ---- adım ilerletme (saf; tick ve reduce ortak kullanır) ----

function stepDuration(state: LafState, step: number): number {
  const n = state.duels.length;
  const kind = lafStepKind(step, n);
  switch (kind.phase) {
    case "write":
      return LAF_WRITE_MS;
    case "finalWrite":
      return LAF_FINAL_WRITE_MS;
    case "vote": {
      const id = state.duels[kind.duel]?.id ?? "";
      return hasVotable(state, id) ? LAF_VOTE_MS : 0;
    }
    case "finalVote":
      return hasVotable(state, LAF_FINAL_ID) ? LAF_FINAL_VOTE_MS : 0;
    case "reveal": {
      const id = state.duels[kind.duel]?.id ?? "";
      return lafCards(state, id).some((c) => c.text !== null) ? LAF_REVEAL_MS : LAF_EMPTY_REVEAL_MS;
    }
    case "finalReveal":
      return lafCards(state, LAF_FINAL_ID).length > 0 ? LAF_FINAL_REVEAL_MS : LAF_EMPTY_REVEAL_MS;
  }
}

/**
 * Süresi dolan adımları zincirleme geçer: her adım öncekinin bitiş anında başlar, bu yüzden sonuç
 * `tick` takvimine bağlı değildir.
 */
export function lafAdvance(state: LafState, now: number): LafState {
  const last = lafLastStep(state.duels.length);
  let s = state;
  while (s.step < last && now >= s.stepEndsAt) {
    const step = s.step + 1;
    const start = s.stepEndsAt;
    s = { ...s, step, stepStartedAt: start, stepEndsAt: start + stepDuration(s, step), locked: [] };
  }
  return s;
}

function stageKey(state: LafState): { key: string; kind: LafStepKind } {
  const kind = lafStepKind(state.step, state.duels.length);
  const key =
    kind.phase === "vote" || kind.phase === "reveal"
      ? (state.duels[kind.duel]?.id ?? "")
      : kind.phase === "finalVote" || kind.phase === "finalReveal" || kind.phase === "finalWrite"
        ? LAF_FINAL_ID
        : "";
  return { key, kind };
}

/** Oyuncunun yazma aşamasındaki soruları: düello kimlikleri ya da final. */
function tasksOf(state: LafState, playerId: string): LafTask[] {
  const { kind } = stageKey(state);
  if (kind.phase === "write") {
    return state.duels
      .filter((d) => d.authors.includes(playerId))
      .map((d) => ({
        id: d.id,
        prompt: d.prompt,
        answer: get(get(state.answers, d.id) ?? {}, playerId) ?? null,
      }));
  }
  if (kind.phase === "finalWrite") {
    return [
      {
        id: LAF_FINAL_ID,
        prompt: state.finalPrompt,
        answer: get(get(state.answers, LAF_FINAL_ID) ?? {}, playerId) ?? null,
      },
    ];
  }
  return [];
}

function jsonHas(json: string, value: string): boolean {
  return json.includes(value) || json.includes(JSON.stringify(value).slice(1, -1));
}

function isDone(state: LafState, now: number): boolean {
  const s = lafAdvance(state, now);
  return s.step === lafLastStep(s.duels.length) && now >= s.stepEndsAt;
}

function lafPublic(state: LafState): LafPublicView {
  const n = state.duels.length;
  const { key, kind } = stageKey(state);
  const phase: LafPhase = kind.phase;
  const inDuel = kind.phase === "vote" || kind.phase === "reveal";
  const inFinal = kind.phase === "finalVote" || kind.phase === "finalReveal";
  const showCards = inDuel || inFinal;
  const prompt = inFinal ? state.finalPrompt : inDuel ? (state.duels[kind.duel]?.prompt ?? "") : "";
  const revealed = kind.phase === "reveal" || kind.phase === "finalReveal";
  const history: LafDuelReveal[] = [];
  state.duels.forEach((d, i) => {
    if (state.step > revealStepOf(i)) history.push(reveal(state, d.id));
  });
  const castKeys = get(state.votes, key) ?? {};
  return {
    players: [...state.players],
    tone: state.tone,
    phase,
    index: inDuel ? kind.duel : null,
    total: n,
    startedAt: state.startedAt,
    stageStartedAt: state.stepStartedAt,
    stageEndsAt: state.stepEndsAt,
    ready:
      kind.phase === "write" || kind.phase === "finalWrite"
        ? [...state.locked]
        : kind.phase === "vote" || kind.phase === "finalVote"
          ? state.players.filter((p) => has(castKeys, p))
          : [],
    voters: kind.phase === "vote" || kind.phase === "finalVote" ? lafVoters(state, key) : [],
    duel: showCards
      ? { id: key, prompt, cards: lafCards(state, key).map(({ id, text }) => ({ id, text })) }
      : null,
    reveal: revealed ? reveal(state, key) : null,
    history,
    scores: lafScores(state),
  };
}

export function createLafSokma(
  tone: LafTone = LAF_DEFAULT_TONE,
): GameDefinition<LafState, LafAction, LafView, LafPublicView> {
  return {
    id: "laf-sokma",
    name: "Laf Sokma Düellosu",
    minPlayers: 3,
    maxPlayers: 8,
    orientation: "portrait",
    briefing: {
      goal: "Aynı soruya rakibinden daha komik cevap yaz, oyları topla!",
      steps: [
        "Sana verilen iki soruya kısa ve komik cevaplar yaz",
        "İsimsiz iki cevaptan hangisi daha komikse ona oy ver",
        "Son soruda herkes yarışır, en çok oyu alan güler",
      ],
    },

    parseAction(raw: unknown): LafAction | null {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
      const r = raw as Record<string, unknown>;
      const keys = Object.keys(r).length;
      if (r.kind === "lock") return keys === 1 ? { kind: "lock" } : null;
      if (r.kind === "answer") {
        if (keys !== 3) return null;
        const { prompt, text } = r;
        if (typeof prompt !== "string" || prompt.length === 0 || prompt.length > 16) return null;
        if (typeof text !== "string" || text.length > LAF_RAW_MAX) return null;
        return { kind: "answer", prompt, text };
      }
      if (r.kind === "vote") {
        if (keys !== 2) return null;
        const card = r.card;
        if (typeof card !== "string" || card.length === 0 || card.length > 16) return null;
        return { kind: "vote", card };
      }
      return null;
    },

    setup(players: readonly string[], ctx: GameContext): LafState {
      const list = [...players];
      const seed = drawSeed(ctx.rng);
      const rng = derivedRng(seed, "setup");
      const pool = rng.shuffle(LAF_PROMPTS[tone]);
      const pairs = lafAssign(list, rng);
      const duels: LafDuelState[] = pairs.map((authors, i) => ({
        id: `q${i + 1}`,
        prompt: pool[i] as string,
        authors,
      }));
      return {
        players: list,
        seed,
        tone,
        startedAt: ctx.now,
        duels,
        finalPrompt: pool[list.length] as string,
        step: 0,
        stepStartedAt: ctx.now,
        stepEndsAt: ctx.now + LAF_WRITE_MS,
        answers: {},
        locked: [],
        votes: {},
      };
    },

    reduce(state, playerId, action, ctx): LafState | Rejected {
      if (!state.players.includes(playerId)) return { rejected: "not_participant" };
      if (ctx.now < state.startedAt) return { rejected: "not_started" };
      if (isDone(state, ctx.now)) return { rejected: "ended" };
      const s = lafAdvance(state, ctx.now);
      const { key, kind } = stageKey(s);
      const connectedAll = (ids: readonly string[], done: (id: string) => boolean): boolean => {
        const active = ids.filter((id) => ctx.connected.includes(id));
        return active.length > 0 && active.every(done);
      };
      const writing = kind.phase === "write" || kind.phase === "finalWrite";
      const voting = kind.phase === "vote" || kind.phase === "finalVote";

      if (action.kind === "answer") {
        if (!writing) return { rejected: "not_writing" };
        if (s.locked.includes(playerId)) return { rejected: "locked" };
        const mine = tasksOf(s, playerId).find((t) => t.id === action.prompt);
        if (!mine) return { rejected: "not_yours" };
        const prev = get(s.answers, action.prompt) ?? {};
        if (action.text.trim() === "") {
          if (!has(prev, playerId)) return s;
          const rest = Object.fromEntries(Object.entries(prev).filter(([id]) => id !== playerId));
          return { ...s, answers: { ...s.answers, [action.prompt]: rest } };
        }
        const clean = cleanAnswer(action.text, LAF_ANSWER_MAX);
        if (!clean.ok) return { rejected: clean.reason };
        if (!moderateText(clean.text).ok) return { rejected: "inappropriate" };
        if (get(prev, playerId) === clean.text) return s;
        return { ...s, answers: { ...s.answers, [action.prompt]: { ...prev, [playerId]: clean.text } } };
      }

      if (action.kind === "lock") {
        if (!writing) return { rejected: "not_writing" };
        if (s.locked.includes(playerId)) return { rejected: "locked" };
        if (!tasksOf(s, playerId).some((t) => t.answer !== null)) return { rejected: "nothing_to_lock" };
        const locked = [...s.locked, playerId];
        if (!connectedAll(s.players, (id) => locked.includes(id))) return { ...s, locked };
        return { ...s, locked, stepEndsAt: Math.min(s.stepEndsAt, ctx.now + LAF_LOCK_GRACE_MS) };
      }

      // vote
      if (!voting) return { rejected: "not_voting" };
      const voters = lafVoters(s, key);
      if (!voters.includes(playerId)) return { rejected: "cannot_vote" };
      const casts = get(s.votes, key) ?? {};
      if (has(casts, playerId)) return { rejected: "already_voted" };
      const card = lafCards(s, key).find((c) => c.id === action.card);
      if (!card) return { rejected: "unknown_card" };
      if (card.text === null) return { rejected: "no_answer" };
      if (card.author === playerId) return { rejected: "own_card" };
      const nextCasts = { ...casts, [playerId]: card.author };
      const votes = { ...s.votes, [key]: nextCasts };
      if (!connectedAll(voters, (id) => has(nextCasts, id))) return { ...s, votes };
      return { ...s, votes, stepEndsAt: Math.min(s.stepEndsAt, ctx.now + LAF_LOCK_GRACE_MS) };
    },

    // Adım geçişleri durumu bir kez değiştirir: sunucu değişiklikte yayın yapar, geçişler tam zamanında görünür.
    tick(state, ctx): LafState {
      return lafAdvance(state, ctx.now);
    },

    publicView(state): LafPublicView {
      return lafPublic(state);
    },

    view(state, playerId): LafView {
      if (playerId === null || !state.players.includes(playerId)) {
        return { tasks: [], locked: false, myCard: null, myVote: null };
      }
      const { key, kind } = stageKey(state);
      const voting = kind.phase === "vote" || kind.phase === "finalVote";
      const writing = kind.phase === "write" || kind.phase === "finalWrite";
      const cards = voting ? lafCards(state, key) : [];
      const casts = voting ? (get(state.votes, key) ?? {}) : {};
      const target = get(casts, playerId);
      return {
        tasks: tasksOf(state, playerId),
        locked: writing && state.locked.includes(playerId),
        myCard: cards.find((c) => c.author === playerId && c.text !== null)?.id ?? null,
        myVote: target === undefined ? null : (cards.find((c) => c.author === target)?.id ?? null),
      };
    },

    isFinished(state, ctx): boolean {
      return isDone(state, ctx.now);
    },

    // Henüz oylamaya girmemiş sorulardaki cevaplar yalnız sahibinin (ve aynı metni kendi yazanların) görünümündedir.
    // Cevap-kart eşleşmesi ve oylar kısa kimliklerle tutulur: metin araması koruyamaz, yapısal testlerle korunur.
    secrets(state): readonly SecretEntry[] {
      const n = state.duels.length;
      const entries: SecretEntry[] = [];
      // Görünümlerde meşru olarak bulunan metinler: sorular ve şimdiye kadar açılmış kartlar.
      const pub = lafPublic(state);
      const legit = JSON.stringify({
        prompts: [...state.duels.map((d) => d.prompt), state.finalPrompt],
        players: state.players,
        tone: state.tone,
        cards: [
          pub.duel?.cards,
          pub.reveal?.cards.map((c) => c.text),
          pub.history.map((h) => h.cards.map((c) => c.text)),
        ],
      });
      const ownTexts = (p: string): string[] =>
        tasksOf(state, p).flatMap((t) => (t.answer === null ? [] : [t.answer]));
      const add = (key: string, label: string): void => {
        const answers = get(state.answers, key) ?? {};
        for (const author of state.players) {
          const value = get(answers, author);
          if (value === undefined || value.length < 3 || jsonHas(legit, value)) continue;
          const owners = state.players.filter(
            (p) => p === author || ownTexts(p).some((t) => jsonHas(JSON.stringify({ t }), value)),
          );
          entries.push({ ownerIds: owners, value, label: `${author} cevabı (${label})` });
        }
      };
      state.duels.forEach((d, i) => {
        if (state.step < voteStepOf(i)) add(d.id, d.id);
      });
      if (state.step < finalVoteStep(n)) add(LAF_FINAL_ID, "final");
      return entries;
    },

    result(state) {
      const scores = lafScores(state, true);
      return { miniScores: { ...scores }, awards: { ...scores } };
    },
  };
}

export const lafSokma = createLafSokma();
