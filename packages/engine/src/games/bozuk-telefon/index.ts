import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import {
  addStroke,
  clearStrokes,
  type DrawLimits,
  EMPTY_DRAWING,
  hasExactKeys,
  isPlainObject,
  type PlayerDrawing,
  parseStrokeFields,
  undoStroke,
} from "../drawing.js";
import { sanitizeWord } from "../text.js";
import {
  BOZUK_EMPTY_TEXT,
  BOZUK_LOCK_GRACE_MS,
  BOZUK_MAX_DRAW_ACTIONS,
  BOZUK_MAX_STROKES,
  BOZUK_MAX_TOTAL_POINTS,
  BOZUK_RESULT_MS,
  BOZUK_SHOW_STEP_MS,
  BOZUK_TEXT_MAX,
  BOZUK_VOTE_MS,
  type BozukAction,
  type BozukPhase,
  type BozukPrompt,
  type BozukPublicView,
  type BozukReveal,
  type BozukRevealStage,
  type BozukStep,
  type BozukView,
  bozukStepCount,
  bozukStepKind,
  bozukStepMs,
} from "./types.js";

export * from "./types.js";

const LIMITS: DrawLimits = {
  maxStrokes: BOZUK_MAX_STROKES,
  maxTotalPoints: BOZUK_MAX_TOTAL_POINTS,
  maxActions: BOZUK_MAX_DRAW_ACTIONS,
};

/** Bir oyuncunun geçerli adımdaki taslağı. */
interface Draft {
  text: string | null;
  drawing: PlayerDrawing;
}

/** Gösteri imleci: yalnız `advance` günceller; görünümler ve gizli bilgi listesi buradan türer. */
interface Cursor {
  chain: number;
  stage: BozukRevealStage;
  shown: number;
}

export interface BozukState {
  players: string[];
  /** Karıştırılmış döngü: zincir `c`'yi `order[c]` başlatır, `s`. adımda `order[(c + s) % n]` tutar. */
  order: string[];
  steps: number;
  startedAt: number;
  /** Başlamış adımların bitiş anı (erken bitişte öne çekilir). Uzunluk = min(step + 1, steps). */
  endAt: number[];
  /** Geçerli girdi adımı; `steps` ise gösteri. */
  step: number;
  /** Bitmiş adımlar: zinciri başlatan oyuncu -> adımlar. */
  chains: Record<string, BozukStep[]>;
  /** Geçerli adımın taslakları (oyuncu -> taslak). */
  drafts: Record<string, Draft>;
  /** Geçerli adımı "Tamam" ile kesinleştirenler. */
  done: string[];
  /** Zincir numarası (metin) -> oy veren -> adım numarası. */
  votes: Record<string, Record<string, number>>;
  /** Zincir numarası (metin) -> herkes oy verince öne çekilen oylama bitişi. */
  voteEnds: Record<string, number>;
  cursor: Cursor | null;
  over: boolean;
}

// ---------------------------------------------------------------------------
// Yardımcılar

const FOLD: Record<string, string> = {
  Ç: "C",
  Ğ: "G",
  İ: "I",
  Ö: "O",
  Ş: "S",
  Ü: "U",
  Â: "A",
  Î: "I",
  Û: "U",
};

/** Karşılaştırma için Türkçe normalize edilmiş kelimeler (büyük harf, aksansız, noktalamasız; "…" kelime sayılmaz). */
export function bozukNormalizeWords(text: string): string[] {
  const upper = text.normalize("NFC").toLocaleUpperCase("tr-TR");
  const folded = Array.from(upper, (ch) => FOLD[ch] ?? ch).join("");
  return folded.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0);
}

/**
 * "Sağlam zincir": ilk cümle ile son yazı adımı aynı anlamda — normalize kelime kümelerinin ortağı, büyük kümenin
 * en az yarısı kadar (kural: "kelimelerin en az yarısı ortak"; iki yönde de yarı koşulu sağlanır).
 */
export function bozukIsRobust(first: string, last: string): boolean {
  const a = new Set(bozukNormalizeWords(first));
  const b = new Set(bozukNormalizeWords(last));
  if (a.size === 0 || b.size === 0) return false;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return common * 2 >= Math.max(a.size, b.size);
}

function chainRobust(steps: readonly BozukStep[], stepCount: number): boolean {
  const first = steps[0];
  if (first?.kind !== "write" || steps.length < stepCount) return false;
  for (let s = steps.length - 1; s > 0; s--) {
    const step = steps[s];
    if (step?.kind === "write") return bozukIsRobust(first.text, step.text);
  }
  return false;
}

const holderOf = (state: BozukState, chain: number, step: number): string =>
  state.order[(chain + step) % state.order.length] as string;

/** `playerId`'nin `step`. adımda tuttuğu zincirin numarası. */
const chainHeldBy = (state: BozukState, playerId: string, step: number): number => {
  const n = state.order.length;
  return (((state.order.indexOf(playerId) - step) % n) + n) % n;
};

const chainSteps = (state: BozukState, chain: number): BozukStep[] =>
  state.chains[state.order[chain] as string] ?? [];

function draftOf(state: BozukState, playerId: string): Draft {
  return state.drafts[playerId] ?? { text: null, drawing: EMPTY_DRAWING };
}

function stepOfDraft(state: BozukState, playerId: string, step: number): BozukStep {
  const draft = state.drafts[playerId];
  if (bozukStepKind(step) === "write") {
    return { kind: "write", author: playerId, text: draft?.text ?? BOZUK_EMPTY_TEXT };
  }
  return { kind: "draw", author: playerId, strokes: Object.values(draft?.drawing.strokes ?? {}) };
}

/** Geçerli adımı bitirir: taslaklar zincirlere işlenir, sonraki adım (varsa) başlar. */
function finishStep(state: BozukState): BozukState {
  const chains: Record<string, BozukStep[]> = { ...state.chains };
  state.order.forEach((starter, c) => {
    chains[starter] = [
      ...(chains[starter] ?? []),
      stepOfDraft(state, holderOf(state, c, state.step), state.step),
    ];
  });
  const step = state.step + 1;
  const endAt =
    step < state.steps
      ? [...state.endAt, (state.endAt[state.step] as number) + bozukStepMs(step)]
      : state.endAt;
  return { ...state, chains, drafts: {}, done: [], step, endAt };
}

interface ChainTiming {
  showStart: number;
  voteStart: number;
  voteEnd: number;
  resultEnd: number;
}

/** Gösterinin zaman çizelgesi (oylama erken bitişleri dahil). Yalnız `step === steps` iken anlamlıdır. */
function revealPlan(state: BozukState): { chains: ChainTiming[]; end: number } {
  let t = state.endAt[state.steps - 1] as number;
  const chains: ChainTiming[] = [];
  for (let c = 0; c < state.order.length; c++) {
    const showStart = t;
    const voteStart = showStart + state.steps * BOZUK_SHOW_STEP_MS;
    const early = state.voteEnds[String(c)];
    const voteEnd = Math.min(voteStart + BOZUK_VOTE_MS, early ?? Number.POSITIVE_INFINITY);
    const resultEnd = voteEnd + BOZUK_RESULT_MS;
    chains.push({ showStart, voteStart, voteEnd, resultEnd });
    t = resultEnd;
  }
  return { chains, end: t };
}

function locate(state: BozukState, now: number): BozukState {
  const plan = revealPlan(state);
  let cursor: Cursor;
  let over = false;
  const last = state.order.length - 1;
  if (now >= plan.end) {
    over = true;
    cursor = { chain: last, stage: "result", shown: state.steps };
  } else {
    let c = plan.chains.findIndex((x) => now < x.resultEnd);
    if (c < 0) c = last;
    const timing = plan.chains[c] as ChainTiming;
    if (now < timing.voteStart) {
      const shown = Math.min(
        state.steps,
        Math.max(1, Math.floor((now - timing.showStart) / BOZUK_SHOW_STEP_MS) + 1),
      );
      cursor = { chain: c, stage: "show", shown };
    } else if (now < timing.voteEnd) {
      cursor = { chain: c, stage: "vote", shown: state.steps };
    } else {
      cursor = { chain: c, stage: "result", shown: state.steps };
    }
  }
  const same =
    state.over === over &&
    state.cursor?.chain === cursor.chain &&
    state.cursor.stage === cursor.stage &&
    state.cursor.shown === cursor.shown;
  return same ? state : { ...state, cursor, over };
}

/** Zamanı geldiğinde adımları bitirir ve gösteri imlecini günceller. Değişiklik yoksa aynı nesneyi döner. */
function advance(state: BozukState, now: number): BozukState {
  let s = state;
  while (s.step < s.steps && now >= (s.endAt[s.step] as number)) s = finishStep(s);
  return s.step === s.steps ? locate(s, now) : s;
}

/** Tüm girdi adımlarını bitirir (sonuç hesabı tick zamanlamasına bağlı kalmasın). */
function settle(state: BozukState): BozukState {
  let s = state;
  while (s.step < s.steps) s = finishStep(s);
  return s;
}

/** Zincir `c` için adım başına oy sayısı. */
function tallyOf(state: BozukState, c: number): number[] {
  const tally = new Array<number>(state.steps).fill(0);
  for (const step of Object.values(state.votes[String(c)] ?? {})) {
    if (step >= 0 && step < state.steps) tally[step] = (tally[step] as number) + 1;
  }
  return tally;
}

/** Tek zincirin puanı: en komik adım oyları sahibine +1, sağlam zincirde yazarların her biri +1. */
function chainScores(state: BozukState, c: number): Record<string, number> {
  const out: Record<string, number> = {};
  const steps = chainSteps(state, c);
  const tally = tallyOf(state, c);
  steps.forEach((step, i) => {
    out[step.author] = (out[step.author] ?? 0) + (tally[i] ?? 0);
  });
  if (chainRobust(steps, state.steps)) {
    for (const step of steps) out[step.author] = (out[step.author] ?? 0) + 1;
  }
  return out;
}

function totalScores(state: BozukState, upTo: number): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of state.players) scores[id] = 0;
  for (let c = 0; c < upTo; c++) {
    for (const [id, v] of Object.entries(chainScores(state, c))) scores[id] = (scores[id] ?? 0) + v;
  }
  return scores;
}

/** Sonucu açılmış zincir sayısı (imleç sonuç aşamasına ulaşmış olanlar). */
function resolvedChains(state: BozukState): number {
  if (state.cursor === null) return 0;
  return state.cursor.stage === "result" ? state.cursor.chain + 1 : state.cursor.chain;
}

function promptOf(state: BozukState, playerId: string): BozukPrompt | null {
  if (state.step === 0 || state.step >= state.steps) return null;
  const prev = chainSteps(state, chainHeldBy(state, playerId, state.step))[state.step - 1];
  if (!prev) return null;
  return prev.kind === "write" ? { kind: "write", text: prev.text } : { kind: "draw", strokes: prev.strokes };
}

function visibleSteps(state: BozukState, cursor: Cursor): BozukStep[] {
  return chainSteps(state, cursor.chain).slice(0, cursor.shown);
}

const MAX_STEP_INDEX = 64;

export const bozukTelefon: GameDefinition<BozukState, BozukAction, BozukView, BozukPublicView> = {
  id: "bozuk-telefon",
  name: "Bozuk Telefon",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Cümle çizimde ve tahminde bozulsun, birlikte gülelim!",
    steps: [
      "Bir cümle yaz; zincirler her adımda el değiştirir",
      "Elindeki zincirin yalnız bir önceki adımını görür, çizer ya da yazarsın",
      "Sonunda zincirleri izle, en komik adıma oy ver",
    ],
  },

  parseAction(raw: unknown): BozukAction | null {
    if (!isPlainObject(raw)) return null;
    switch (raw.kind) {
      case "lock":
        return hasExactKeys(raw, ["kind"]) ? { kind: "lock" } : null;
      case "undo":
        return hasExactKeys(raw, ["kind"]) ? { kind: "undo" } : null;
      case "clear":
        return hasExactKeys(raw, ["kind"]) ? { kind: "clear" } : null;
      case "text": {
        if (!hasExactKeys(raw, ["kind", "text"])) return null;
        const text = sanitizeWord(raw.text, BOZUK_TEXT_MAX);
        return text === null ? null : { kind: "text", text };
      }
      case "vote": {
        if (!hasExactKeys(raw, ["kind", "step"])) return null;
        const step = raw.step;
        if (typeof step !== "number" || !Number.isInteger(step) || step < 0 || step > MAX_STEP_INDEX)
          return null;
        return { kind: "vote", step };
      }
      case "stroke": {
        const fields = parseStrokeFields(raw);
        return fields === null ? null : { kind: "stroke", ...fields };
      }
      default:
        return null;
    }
  },

  setup(players: readonly string[], ctx: GameContext): BozukState {
    const order = ctx.rng.shuffle(players);
    const steps = bozukStepCount(players.length);
    return {
      players: [...players],
      order,
      steps,
      startedAt: ctx.now,
      endAt: [ctx.now + bozukStepMs(0)],
      step: 0,
      chains: {},
      drafts: {},
      done: [],
      votes: {},
      voteEnds: {},
      cursor: null,
      over: false,
    };
  },

  reduce(raw, playerId, action, ctx): BozukState | Rejected {
    if (!raw.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < raw.startedAt) return { rejected: "not_started" };
    const state = advance(raw, ctx.now);

    if (state.step >= state.steps) {
      // Gösteri: yalnız oylama aşamasında oy.
      if (state.over) return { rejected: "ended" };
      if (action.kind !== "vote") return { rejected: "wrong_phase" };
      const cursor = state.cursor as Cursor;
      if (cursor.stage !== "vote") return { rejected: "wrong_phase" };
      const key = String(cursor.chain);
      if (state.votes[key]?.[playerId] !== undefined) return { rejected: "voted" };
      if (action.step >= state.steps) return { rejected: "bad_step" };
      if ((chainSteps(state, cursor.chain)[action.step] as BozukStep).author === playerId)
        return { rejected: "own_step" };
      const chainVotes = { ...(state.votes[key] ?? {}), [playerId]: action.step };
      const votes = { ...state.votes, [key]: chainVotes };
      const active = state.players.filter((id) => ctx.connected.includes(id));
      const all = active.length > 0 && active.every((id) => chainVotes[id] !== undefined);
      if (!all) return { ...state, votes };
      const nominal = (revealPlan(state).chains[cursor.chain] as ChainTiming).voteEnd;
      return {
        ...state,
        votes,
        voteEnds: { ...state.voteEnds, [key]: Math.min(nominal, ctx.now + BOZUK_LOCK_GRACE_MS) },
      };
    }

    const kind = bozukStepKind(state.step);
    if (action.kind === "vote") return { rejected: "wrong_phase" };
    if (state.done.includes(playerId)) return { rejected: "locked" };
    const draft = draftOf(state, playerId);
    const withDraft = (next: Draft): BozukState => ({
      ...state,
      drafts: { ...state.drafts, [playerId]: next },
    });

    if (action.kind === "lock") {
      const hasInput = kind === "write" ? draft.text !== null : Object.keys(draft.drawing.strokes).length > 0;
      if (!hasInput) return { rejected: "nothing_to_lock" };
      const done = [...state.done, playerId];
      const active = state.players.filter((id) => ctx.connected.includes(id));
      const all = active.length > 0 && active.every((id) => done.includes(id));
      if (!all) return { ...state, done };
      // Bağlı herkes bitirdi: adım 1 sn sonra biter.
      const current = state.endAt[state.step] as number;
      const endAt = [...state.endAt];
      endAt[state.step] = Math.min(current, ctx.now + BOZUK_LOCK_GRACE_MS);
      return { ...state, done, endAt };
    }

    if (action.kind === "text") {
      if (kind !== "write") return { rejected: "wrong_phase" };
      if (draft.text === action.text) return state;
      return withDraft({ ...draft, text: action.text });
    }

    if (kind !== "draw") return { rejected: "wrong_phase" };
    const out =
      action.kind === "stroke"
        ? addStroke(draft.drawing, action, LIMITS)
        : action.kind === "undo"
          ? undoStroke(draft.drawing, LIMITS)
          : clearStrokes(draft.drawing, LIMITS);
    return "rejected" in out ? { rejected: out.rejected } : withDraft({ ...draft, drawing: out.drawing });
  },

  tick(state, ctx): BozukState {
    return advance(state, ctx.now);
  },

  publicView(state): BozukPublicView {
    const cursor = state.cursor;
    const phase: BozukPhase = state.over
      ? "done"
      : state.step >= state.steps
        ? "reveal"
        : bozukStepKind(state.step);
    let reveal: BozukReveal | null = null;
    if (state.step >= state.steps && cursor !== null) {
      const plan = revealPlan(state);
      const timing = plan.chains[cursor.chain] as ChainTiming;
      const result = cursor.stage === "result";
      const steps = chainSteps(state, cursor.chain);
      reveal = {
        chain: cursor.chain,
        chains: state.order.length,
        starter: state.order[cursor.chain] as string,
        stage: cursor.stage,
        shown: cursor.shown,
        steps: visibleSteps(state, cursor),
        chainStartedAt: timing.showStart,
        stageEndsAt:
          cursor.stage === "show"
            ? timing.voteStart
            : cursor.stage === "vote"
              ? timing.voteEnd
              : timing.resultEnd,
        voted: state.players.filter((id) => state.votes[String(cursor.chain)]?.[id] !== undefined),
        tally: result ? tallyOf(state, cursor.chain) : null,
        robust: result ? chainRobust(steps, state.steps) : null,
      };
    }
    const resolved = resolvedChains(state);
    return {
      phase,
      startedAt: state.startedAt,
      step: state.step,
      steps: state.steps,
      stepStartedAt: state.step < state.steps ? (state.endAt[state.step - 1] ?? state.startedAt) : null,
      stepEndsAt: state.step < state.steps ? (state.endAt[state.step] as number) : null,
      players: [...state.players],
      doneIds: state.step < state.steps ? [...state.done] : [],
      reveal,
      scores: state.step >= state.steps ? totalScores(state, resolved) : null,
    };
  },

  view(state, playerId): BozukView {
    const empty: BozukView = {
      role: null,
      prompt: null,
      text: null,
      strokes: {},
      pointsLeft: 0,
      done: false,
      myVote: null,
    };
    if (playerId === null || !state.players.includes(playerId)) return empty;
    if (state.step >= state.steps) {
      const chain = state.cursor?.chain;
      const mine = chain === undefined ? undefined : state.votes[String(chain)]?.[playerId];
      return { ...empty, myVote: mine ?? null };
    }
    const kind = bozukStepKind(state.step);
    const draft = draftOf(state, playerId);
    return {
      role: kind,
      prompt: promptOf(state, playerId),
      text: kind === "write" ? draft.text : null,
      strokes: kind === "draw" ? { ...draft.drawing.strokes } : {},
      pointsLeft: kind === "draw" ? BOZUK_MAX_TOTAL_POINTS - draft.drawing.points : 0,
      done: state.done.includes(playerId),
      myVote: null,
    };
  },

  isFinished(state, ctx): boolean {
    const s = advance(state, ctx.now);
    return s.step >= s.steps && ctx.now >= revealPlan(s).end;
  },

  /**
   * Henüz herkese açılmamış cümleler. Çizimler sayısal darbe dizisidir (alt dizgi denetimiyle izlenemez);
   * gizlilikleri yapısal olarak sağlanır ve ayrıca test edilir (bozuk-telefon.test.ts, "gizlilik").
   * Kısa (3 karakterden az) cümleler de yalnız yapısal olarak sınanır.
   */
  secrets(state): readonly SecretEntry[] {
    if (state.over) return [];
    const out: SecretEntry[] = [];
    const add = (ownerIds: string[], value: string, label: string): void => {
      if (value !== BOZUK_EMPTY_TEXT && value.length >= 3) out.push({ ownerIds, value, label });
    };
    if (state.step < state.steps) {
      state.order.forEach((starter, c) => {
        (state.chains[starter] ?? []).forEach((step, s) => {
          if (step.kind !== "write") return;
          const owners = [step.author];
          if (s + 1 === state.step) owners.push(holderOf(state, c, state.step));
          add(owners, step.text, `zincir ${c} adım ${s}`);
        });
      });
      for (const [id, draft] of Object.entries(state.drafts)) {
        if (draft.text !== null) add([id], draft.text, `${id} taslağı`);
      }
      return out;
    }
    const cursor = state.cursor;
    state.order.forEach((starter, c) => {
      (state.chains[starter] ?? []).forEach((step, s) => {
        if (step.kind !== "write") return;
        const hidden =
          cursor === null ||
          c > cursor.chain ||
          (c === cursor.chain && cursor.stage === "show" && s >= cursor.shown);
        if (hidden) add([], step.text, `zincir ${c} adım ${s}`);
      });
    });
    return out;
  },

  result(raw) {
    const state = settle(raw);
    const scores = totalScores(state, state.order.length);
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
