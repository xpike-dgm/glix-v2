import { poolEntries } from "../../content.js";
import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import {
  addStroke,
  clearStrokes,
  DRAW_PALETTE_CLASSIC,
  type DrawLimits,
  EMPTY_DRAWING,
  hasExactKeys,
  isPlainObject,
  type PlayerDrawing,
  parseStrokeFields,
  undoStroke,
} from "../drawing.js";
import { foldKey } from "../text.js";
import {
  closenessOf,
  KARALAMA_POOL,
  KARALAMA_WORD_MEMORY_ID,
  type KaralamaPair,
  pairWordKeys,
} from "./pool.js";
import {
  KARALAMA_ALL_VOTED_MS,
  KARALAMA_DRAW_MS,
  KARALAMA_FINAL_MS,
  KARALAMA_GUESS_MAX,
  KARALAMA_GUESS_MS,
  KARALAMA_LOCK_GRACE_MS,
  KARALAMA_MAX_DRAW_ACTIONS,
  KARALAMA_MAX_STROKES,
  KARALAMA_MAX_TOTAL_POINTS,
  KARALAMA_PAIR_MEMORY,
  KARALAMA_TYPO_MIN_LETTERS,
  KARALAMA_UNMASK_MS,
  KARALAMA_WORD_MEMORY,
  type KaralamaAction,
  type KaralamaPhase,
  type KaralamaPublicView,
  type KaralamaReveal,
  type KaralamaStroke,
  type KaralamaView,
  karalamaVoteMs,
} from "./types.js";

export * from "./types.js";

/**
 * Oynanabilir çiftler: iki kelime de en az 3 karakter ve biri ötekinin içinde geçmez
 * (aksi halde bir oyuncunun kelimesi ötekinin görünümünde "sızmış" sayılırdı ve ipucu olurdu).
 */
export const KARALAMA_PAIRS: readonly KaralamaPair[] = KARALAMA_POOL.builtin;
export {
  closenessOf,
  KARALAMA_POOL,
  KARALAMA_WORD_MEMORY_ID,
  type KaralamaPair,
} from "./pool.js";

const LIMITS: DrawLimits = {
  maxStrokes: KARALAMA_MAX_STROKES,
  maxTotalPoints: KARALAMA_MAX_TOTAL_POINTS,
  maxActions: KARALAMA_MAX_DRAW_ACTIONS,
};

export interface KaralamaState {
  players: string[];
  startedAt: number;
  drawEndsAt: number;
  voteEndsAt: number;
  /** Bu oyunun oylama süresi (KD-M7: oyuncu sayısına göre). */
  voteMs: number;
  outsider: string;
  /** Çoğunluğun kelimesi (yön KD-M4 ile rastgele seçildikten sonra). */
  mainWord: string;
  /** Bilgisizin kelimesi. */
  nearWord: string;
  /** Çekilen çiftin havuz anahtarı (tekrar önleme ve karne; yönden bağımsız). */
  pairKey: string;
  drawings: Record<string, PlayerDrawing>;
  /** Oy veren -> hedef (son oy geçerli). */
  votes: Record<string, string>;
  /** Çizimini "Bitti" ile kesinleştirenler. `drawEndsAt`/`voteEndsAt` erken bitişte reduce içinde öne çekilir. */
  drawDone: string[];
  /** Oyunu "Tamam" ile kesinleştirenler. */
  locked: string[];
  /**
   * Görünür aşama; zamanla olan geçişleri `advanceKaralama` saklı anlara göre yapar (tick ne zaman çalışırsa çalışsın
   * aynı sonuç). "done": ana kelime, tahmin ve puanlar açıldı.
   */
  stage: KaralamaPhase;
  /** Bilgisizin bağlantısı kopuk mu (kurulumda ve `onPresence` ile; son şans buna göre açılır ya da atlanır). */
  outsiderAway: boolean;
  /** Son şans penceresi ve bitiş (oylama bitince belli olur). */
  guessOpensAt: number | null;
  guessEndsAt: number | null;
  finishAt: number | null;
  /** Bilgisizin tahmini (temizlenmiş, yazdığı biçimde); yoksa null. */
  guess: string | null;
}

const MAX_ID_LENGTH = 64;

/** Tahmini görünür hâle getirir: tek satır, en çok 24 karakter, harf içermeli; değilse null. */
export function cleanKaralamaGuess(raw: string): string | null {
  const text = raw
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (text.length === 0 || [...text].length > KARALAMA_GUESS_MAX) return null;
  return /\p{L}/u.test(text) && foldKey(text) !== "" ? text : null;
}

/**
 * Son şans eşleşmesi (KD-M1): klavyeden bağımsız; ana kelime 6+ harfliyse ve harf sayısı aynıysa tek harf farkı da
 * doğru sayılır (Yazı Yaz YY-M7 ile aynı). Bilgisizin kendi kelimesini yazması hiçbir zaman doğru sayılmaz.
 */
export function karalamaGuessMatch(guess: string, mainWord: string, nearWord: string): boolean {
  const a = foldKey(guess).replace(/ /g, "");
  const b = foldKey(mainWord).replace(/ /g, "");
  if (a === "" || b === "") return false;
  if (a === foldKey(nearWord).replace(/ /g, "")) return false;
  if (a === b) return true;
  const x = Array.from(a);
  const y = Array.from(b);
  if (y.length < KARALAMA_TYPO_MIN_LETTERS || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) diff++;
  return diff === 1;
}

export interface KaralamaOutcome {
  scores: Record<string, number>;
  tally: Record<string, number>;
  caught: boolean;
  /** Bilgisize oy veren oyuncular (katılım sırasıyla). */
  rightVoters: string[];
}

/**
 * Puan (KD-M2): bilgisize oy veren her oyuncu +1 (yakalansa da yakalanmasa da); bilgisiz tek başına en çok oyu
 * almadıysa (eşitlik, hiç oy) kurtulur ve +1; son şansta ana kelimeyi bildiyse (KD-M1) +1. Eksi yok.
 */
export function karalamaScores(
  players: readonly string[],
  outsider: string,
  votes: Record<string, string>,
  guessed = false,
): KaralamaOutcome {
  const tally: Record<string, number> = {};
  for (const id of players) tally[id] = 0;
  for (const voter of players) {
    const target = Object.hasOwn(votes, voter) ? votes[voter] : undefined;
    if (target === undefined || target === voter || !players.includes(target)) continue;
    tally[target] = (tally[target] ?? 0) + 1;
  }
  const outsiderVotes = tally[outsider] ?? 0;
  const caught =
    outsiderVotes > 0 && players.every((id) => id === outsider || (tally[id] ?? 0) < outsiderVotes);
  const rightVoters = players.filter((id) => id !== outsider && votes[id] === outsider);
  const scores: Record<string, number> = {};
  for (const id of players) {
    scores[id] = id === outsider ? (caught ? 0 : 1) + (guessed ? 1 : 0) : rightVoters.includes(id) ? 1 : 0;
  }
  return { scores, tally, caught, rightVoters };
}

const guessedOf = (s: KaralamaState): boolean =>
  s.guess !== null && karalamaGuessMatch(s.guess, s.mainWord, s.nearWord);

const outcomeOf = (s: KaralamaState): KaralamaOutcome =>
  karalamaScores(s.players, s.outsider, s.votes, guessedOf(s));

/**
 * Zamanla olan bütün geçişler (saklı anlara göre, `now`'a kadar): çizim → oylama → açılış → son şans → bitti.
 * Oylama bitince son şans penceresi belli olur; bilgisiz bağlı değilse son şans hiç açılmaz. `ctx.connected`'a bakmaz.
 */
export function advanceKaralama(state: KaralamaState, now: number): KaralamaState {
  let s = state;
  for (let guard = 0; guard < 8; guard++) {
    const before = s;
    if (s.stage === "draw" && now >= s.drawEndsAt) s = { ...s, stage: "vote" };
    else if (s.stage === "vote" && now >= s.voteEndsAt) {
      const guessOpensAt = s.voteEndsAt + KARALAMA_UNMASK_MS;
      const guessEndsAt = s.outsiderAway ? guessOpensAt : guessOpensAt + KARALAMA_GUESS_MS;
      s = { ...s, stage: "unmask", guessOpensAt, guessEndsAt, finishAt: guessEndsAt + KARALAMA_FINAL_MS };
    } else if (s.stage === "unmask" && now >= (s.guessOpensAt ?? 0)) {
      s = { ...s, stage: (s.guessEndsAt ?? 0) > (s.guessOpensAt ?? 0) ? "guess" : "done" };
    } else if (s.stage === "guess" && now >= (s.guessEndsAt ?? 0)) {
      s = { ...s, stage: "done" };
    }
    if (s === before) return s;
  }
  return s;
}

/** Son şansı öne çeker (tahmin geldi ya da bilgisiz koptu): kelimeler `at`'te açılır. */
function endGuess(s: KaralamaState, at: number): KaralamaState {
  const guessEndsAt = Math.max(s.guessOpensAt ?? at, Math.min(s.guessEndsAt ?? at, at));
  return { ...s, guessEndsAt, finishAt: guessEndsAt + KARALAMA_FINAL_MS };
}

/**
 * Erken bitiş denetimi (eylemden ve bağlantı değişiminden sonra): bağlı herkes "Bitti" dediyse oylama 1 sn sonra
 * başlar; oylamada bağlı herkes "Tamam" dediyse 1 sn, herkes oyunu verdiyse en geç 3 sn sonra biter (KD-M7 sahip notu).
 */
function settle(s: KaralamaState, now: number, connected: readonly string[]): KaralamaState {
  const active = s.players.filter((id) => connected.includes(id));
  const all = (done: (id: string) => boolean): boolean => active.length > 0 && active.every(done);
  if (s.stage === "draw" && now < s.drawEndsAt) {
    if (!all((id) => s.drawDone.includes(id))) return s;
    const drawEndsAt = Math.min(s.drawEndsAt, now + KARALAMA_LOCK_GRACE_MS);
    if (drawEndsAt === s.drawEndsAt) return s;
    return { ...s, drawEndsAt, voteEndsAt: drawEndsAt + s.voteMs };
  }
  if (s.stage === "vote" && now < s.voteEndsAt) {
    const wait = all((id) => s.locked.includes(id))
      ? KARALAMA_LOCK_GRACE_MS
      : all((id) => s.votes[id] !== undefined)
        ? KARALAMA_ALL_VOTED_MS
        : null;
    if (wait === null) return s;
    const voteEndsAt = Math.min(s.voteEndsAt, now + wait);
    return voteEndsAt === s.voteEndsAt ? s : { ...s, voteEndsAt };
  }
  return s;
}

function drawingOf(state: KaralamaState, playerId: string): PlayerDrawing {
  return state.drawings[playerId] ?? EMPTY_DRAWING;
}

function withDrawing(state: KaralamaState, playerId: string, drawing: PlayerDrawing): KaralamaState {
  return { ...state, drawings: { ...state.drawings, [playerId]: drawing } };
}

/**
 * Çift seçimi (KD-M6): "uzak" çiftler çekilmez; 3–5 oyuncuda "yakın", 6–8 oyuncuda %50 "yakın" / %50 "çok yakın".
 * Uygun etiketli çift kalmazsa etiket şartı düşer (önce uzak olmayanlar, sonra hepsi).
 */
export function pickKaralamaPair(
  pool: readonly KaralamaPair[],
  players: number,
  ctx: GameContext,
): KaralamaPair {
  const playable = pool.filter((p) => closenessOf(p) !== "uzak");
  const base = playable.length > 0 ? playable : pool;
  const want = players >= 6 && ctx.rng.int(2) === 1 ? "çok yakın" : "yakın";
  const fit = base.filter((p) => closenessOf(p) === want);
  const list = fit.length > 0 ? fit : base;
  return list[ctx.rng.int(list.length)] as KaralamaPair;
}

export const karalamaDefteri: GameDefinition<
  KaralamaState,
  KaralamaAction,
  KaralamaView,
  KaralamaPublicView
> = {
  id: "karalama-defteri",
  name: "Karalama Defteri",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Çizimlere bakıp kelimeyi bilmeyeni bul!",
    steps: [
      "Çoğunluk aynı kelimeyi, biri yakın kelimeyi görür; kelimene basılı tutarak bak",
      "Kelimeni çiz; harf ve yazı yasak",
      "Bilgisize oy ver: doğru oy +1. Bilgisizsen saklan, sonunda ortak kelimeyi tahmin et",
    ],
  },

  parseAction(raw: unknown): KaralamaAction | null {
    if (!isPlainObject(raw)) return null;
    switch (raw.kind) {
      case "lock":
        return hasExactKeys(raw, ["kind"]) ? { kind: "lock" } : null;
      case "undo":
        return hasExactKeys(raw, ["kind"]) ? { kind: "undo" } : null;
      case "clear":
        return hasExactKeys(raw, ["kind"]) ? { kind: "clear" } : null;
      case "vote": {
        if (!hasExactKeys(raw, ["kind", "target"])) return null;
        const target = raw.target;
        if (typeof target !== "string" || target.length === 0 || target.length > MAX_ID_LENGTH) return null;
        return { kind: "vote", target };
      }
      case "guess": {
        if (!hasExactKeys(raw, ["kind", "text"])) return null;
        const text = raw.text;
        if (typeof text !== "string" || text.length === 0 || text.length > 4 * KARALAMA_GUESS_MAX)
          return null;
        return { kind: "guess", text };
      }
      case "stroke": {
        const fields = parseStrokeFields(raw, DRAW_PALETTE_CLASSIC);
        return fields === null ? null : { kind: "stroke", ...fields };
      }
      default:
        return null;
    }
  },

  setup(players: readonly string[], ctx: GameContext): KaralamaState {
    const pair = pickKaralamaPair(poolEntries(KARALAMA_POOL, ctx.content), players.length, ctx);
    // Yön (KD-M4): "yön sabit" değilse yazı-tura; "Kelime 1" bazen çoğunluğun, bazen bilgisizin.
    const flip = !pair.fixed && ctx.rng.int(2) === 1;
    const outsider = players[ctx.rng.int(players.length)] as string;
    const voteMs = karalamaVoteMs(players.length);
    return {
      players: [...players],
      startedAt: ctx.now,
      drawEndsAt: ctx.now + KARALAMA_DRAW_MS,
      voteEndsAt: ctx.now + KARALAMA_DRAW_MS + voteMs,
      voteMs,
      outsider,
      mainWord: flip ? pair.near : pair.main,
      nearWord: flip ? pair.main : pair.near,
      pairKey: KARALAMA_POOL.key(pair),
      drawings: {},
      votes: {},
      drawDone: [],
      locked: [],
      stage: "draw",
      outsiderAway: !ctx.connected.includes(outsider),
      guessOpensAt: null,
      guessEndsAt: null,
      finishAt: null,
      guess: null,
    };
  },

  reduce(state, playerId, action, ctx): KaralamaState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    const s = advanceKaralama(state, ctx.now);

    if (action.kind === "guess") {
      if (s.stage !== "guess") return { rejected: "not_guess" };
      if (playerId !== s.outsider) return { rejected: "not_outsider" };
      if (s.guess !== null) return { rejected: "locked" };
      const guess = cleanKaralamaGuess(action.text);
      if (guess === null) return { rejected: "bad_guess" };
      // Tek tahmin, kesin: kelimeler 1 sn sonra açılır.
      return endGuess({ ...s, guess }, ctx.now + KARALAMA_LOCK_GRACE_MS);
    }
    if (s.stage !== "draw" && s.stage !== "vote") return { rejected: "ended" };
    const drawing = s.stage === "draw";

    if (action.kind === "lock") {
      if (drawing) {
        if (s.drawDone.includes(playerId)) return { rejected: "locked" };
        if (Object.keys(drawingOf(s, playerId).strokes).length === 0) return { rejected: "nothing_to_lock" };
        return settle({ ...s, drawDone: [...s.drawDone, playerId] }, ctx.now, ctx.connected);
      }
      if (s.locked.includes(playerId)) return { rejected: "locked" };
      if (s.votes[playerId] === undefined) return { rejected: "nothing_to_lock" };
      return settle({ ...s, locked: [...s.locked, playerId] }, ctx.now, ctx.connected);
    }

    if (action.kind === "vote") {
      if (drawing) return { rejected: "wrong_phase" };
      if (s.locked.includes(playerId)) return { rejected: "locked" };
      if (action.target === playerId) return { rejected: "self_vote" };
      // KD-M3: bağlantısı kopuk oyuncuya da oy verilebilir (kopan bilgisiz böyle kurtulamaz).
      if (!s.players.includes(action.target)) return { rejected: "bad_target" };
      if (s.votes[playerId] === action.target) return s;
      return settle({ ...s, votes: { ...s.votes, [playerId]: action.target } }, ctx.now, ctx.connected);
    }

    if (!drawing) return { rejected: "wrong_phase" };
    if (s.drawDone.includes(playerId)) return { rejected: "locked" };
    const mine = drawingOf(s, playerId);
    const out =
      action.kind === "stroke"
        ? addStroke(mine, action, LIMITS)
        : action.kind === "undo"
          ? undoStroke(mine, LIMITS)
          : clearStrokes(mine, LIMITS);
    return "rejected" in out ? { rejected: out.rejected } : withDrawing(s, playerId, out.drawing);
  },

  tick(state, ctx): KaralamaState {
    return advanceKaralama(state, ctx.now);
  },

  /**
   * Bağlantı değişimi: bilgisizin durumu son şansı belirler (kopan bilgisiz son şansa katılamaz; son şans sürerken
   * koparsa 1 sn sonra kelimeler açılır). Eksik kalan son oyuncu koptuysa erken bitiş denetlenir.
   */
  onPresence(state, ctx): KaralamaState {
    let s = advanceKaralama(state, ctx.now);
    const away = !ctx.connected.includes(s.outsider);
    if (away !== s.outsiderAway && (s.stage === "draw" || s.stage === "vote"))
      s = { ...s, outsiderAway: away };
    if (away && (s.stage === "unmask" || s.stage === "guess") && s.guess === null) {
      const end = s.stage === "unmask" ? (s.guessOpensAt ?? ctx.now) : ctx.now + KARALAMA_LOCK_GRACE_MS;
      if ((s.guessEndsAt ?? 0) > end) s = endGuess({ ...s, outsiderAway: true }, end);
    }
    const settled = settle(s, ctx.now, ctx.connected);
    return settled === s && s === state ? state : settled;
  },

  nextWake(state, ctx): number | null {
    const s = advanceKaralama(state, ctx.now);
    const at = [s.drawEndsAt, s.voteEndsAt, s.guessOpensAt ?? 0, s.guessEndsAt ?? 0, s.finishAt ?? 0];
    const next = at.filter((t) => t > ctx.now);
    return next.length > 0 ? Math.min(...next) : null;
  },

  // Görünümler durumu olduğu gibi okur (sunucu önce `tick` çalıştırır); böylece `secrets` ile aynı aşamayı görürler.
  publicView(state): KaralamaPublicView {
    const s = state;
    const phase = s.stage;
    let drawings: Record<string, KaralamaStroke[]> | null = null;
    if (phase !== "draw") {
      drawings = {};
      for (const id of s.players) drawings[id] = Object.values(drawingOf(s, id).strokes);
    }
    let reveal: KaralamaReveal | null = null;
    if (phase !== "draw" && phase !== "vote") {
      const o = outcomeOf(s);
      reveal = {
        outsider: s.outsider,
        nearWord: s.nearWord,
        votes: { ...s.votes },
        tally: o.tally,
        caught: o.caught,
        rightVoters: o.rightVoters,
        openedAt: s.voteEndsAt,
        guessOpensAt: s.guessOpensAt ?? s.voteEndsAt,
        guessEndsAt: s.guessEndsAt ?? s.voteEndsAt,
        finishAt: s.finishAt ?? s.voteEndsAt,
        guessSent: s.guess !== null,
        final:
          phase === "done"
            ? { mainWord: s.mainWord, guess: s.guess, guessed: guessedOf(s), scores: o.scores }
            : null,
      };
    }
    return {
      phase,
      drawEndsAt: s.drawEndsAt,
      voteEndsAt: s.voteEndsAt,
      voteMs: s.voteMs,
      players: [...s.players],
      drawings,
      voted: s.players.filter((id) => s.votes[id] !== undefined),
      drawDoneIds: [...s.drawDone],
      lockedIds: [...s.locked],
      reveal,
    };
  },

  view(state, playerId): KaralamaView {
    if (playerId === null || !state.players.includes(playerId)) {
      return {
        word: null,
        near: false,
        strokes: {},
        pointsLeft: 0,
        myVote: null,
        drawDone: false,
        locked: false,
      };
    }
    const mine = drawingOf(state, playerId);
    const drawing = state.stage === "draw";
    const isOutsider = playerId === state.outsider;
    // Açılış ve son şans sürerken ana kelime hiçbir ekranda olmaz (bilgisiz yan ekrandan okumasın).
    const hideMain = state.stage === "unmask" || state.stage === "guess";
    return {
      word: isOutsider ? state.nearWord : hideMain ? null : state.mainWord,
      near: isOutsider,
      strokes: drawing ? { ...mine.strokes } : {},
      pointsLeft: drawing ? KARALAMA_MAX_TOTAL_POINTS - mine.points : 0,
      myVote: state.votes[playerId] ?? null,
      drawDone: state.drawDone.includes(playerId),
      locked: state.locked.includes(playerId),
    };
  },

  /** Son açılış (ana kelime, tahmin, puanlar) son şans bitince başlar; o andan sonra sonuç değişmez. */
  revealAt(state, ctx): number | null {
    const s = advanceKaralama(state, ctx.now);
    return s.stage === "done" ? (s.guessEndsAt ?? s.voteEndsAt) : null;
  },

  isFinished(state, ctx): boolean {
    const s = advanceKaralama(state, ctx.now);
    return s.stage === "done" && ctx.now >= (s.finishAt ?? 0);
  },

  secrets(state): readonly SecretEntry[] {
    if (state.stage === "done") return [];
    if (state.stage === "unmask" || state.stage === "guess") {
      // Bilgisizin kelimesi açıldı; ana kelime son şans bitene kadar kimsede yok.
      return [{ ownerIds: [], value: state.mainWord, label: "ana kelime" }];
    }
    return [
      {
        ownerIds: state.players.filter((id) => id !== state.outsider),
        value: state.mainWord,
        label: "ana kelime",
      },
      { ownerIds: [state.outsider], value: state.nearWord, label: "yakın kelime" },
    ];
  },

  /** Tekrar önleme (KD-M5): çift son 50 oyunda, kelimeleri son 10 oyunda gelmez. */
  contentUsed(state) {
    return [
      { poolId: KARALAMA_POOL.id, key: state.pairKey, memory: KARALAMA_PAIR_MEMORY },
      ...pairWordKeys({ main: state.mainWord, near: state.nearWord }).map((key) => ({
        poolId: KARALAMA_WORD_MEMORY_ID,
        key,
        memory: KARALAMA_WORD_MEMORY,
      })),
    ];
  },

  /** Çift karnesi (KD-M8): yalnız iki sayı, bilgisiz yakalandı mı ve ana kelimeyi bildi mi. */
  contentFeedback(state) {
    const o = outcomeOf(state);
    return [
      {
        poolId: KARALAMA_POOL.id,
        key: state.pairKey,
        play: { top: o.caught ? 1 : 0, single: guessedOf(state) ? 1 : 0 },
      },
    ];
  },

  result(state) {
    const { scores } = outcomeOf(state);
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
