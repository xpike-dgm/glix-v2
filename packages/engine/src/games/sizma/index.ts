import { poolEntries } from "../../content.js";
import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import { SIZMA_POOL } from "./pool.js";
import {
  SIZMA_CLUE_CAP_MS,
  SIZMA_COUNTDOWN_MS,
  SIZMA_FINAL_MS,
  SIZMA_GUESS_MAX,
  SIZMA_GUESS_MS,
  SIZMA_LOCK_GRACE_MS,
  SIZMA_NOTICE_MS,
  SIZMA_NOTICE_POINTS,
  SIZMA_REVEAL_MS,
  SIZMA_ROUNDS,
  SIZMA_RUNOFF_MS,
  SIZMA_STEAL_POINTS,
  SIZMA_TURN_MS,
  SIZMA_UNMASK_MS,
  SIZMA_VOTE_MS,
  type SizmaAction,
  type SizmaFinal,
  type SizmaPhase,
  type SizmaPublicView,
  type SizmaReveal,
  type SizmaView,
} from "./types.js";

export * from "./types.js";

export interface SizmaState {
  players: string[];
  startedAt: number;
  /** Söyleme sırası (herkese açık). */
  order: string[];
  infiltrator: string;
  /** Büyük harf (tr-TR) kelimeler. */
  commonWord: string;
  infiltratorWord: string;
  /** Aşama; zamanla değişen geçişler `advance` ile, saklı bitiş anlarına göre yapılır (tick zamanından bağımsız). */
  stage: SizmaPhase;
  /** Konuşma sırası: kaçıncı konuşma (0 tabanlı, iki tur boyunca) ve o konuşmanın penceresi. */
  turn: number;
  turnStartedAt: number;
  turnEndsAt: number;
  /** Oylamanın başlangıcı: teknik tavan; sıralar biterse geri sayım sonu; herkes geçerse 1 sn sonrası. */
  clueEndsAt: number;
  clueClosing: boolean;
  /** "Oylamaya geç" diyenler. */
  ready: string[];
  voteEndsAt: number;
  /** Bulunulan oylamada kilitleyenler (ikinci oylamada sıfırlanır). */
  locked: string[];
  voteClosing: boolean;
  /** İlk oylama: oyuncu -> son verilen oy (gizli; açılana kadar yalnız sahibinin görünümünde). */
  votes: Record<string, string>;
  /** İkinci oylama adayları (ilk oylama eşitlikle bitince belli olur). */
  runoff: string[] | null;
  runoffEndsAt: number | null;
  runoffVotes: Record<string, string>;
  /** "Sızma sen miydin?" aşamasının bitişi (oylamalar bitince belli olur). */
  noticeEndsAt: number | null;
  /** "Sızma sen miydin?" cevapları (gizli; yalnız sızmanınki sonuçta açılır). */
  notices: Record<string, boolean>;
  /** Yakalandıysa son şans penceresi. */
  guessOpensAt: number | null;
  guessEndsAt: number | null;
  /** Sızmanın tahmini (büyük harf, temizlenmiş); tahmin yoksa null. */
  guess: string | null;
  /** Oyunun bittiği an (açılış belli olunca). */
  finishAt: number | null;
}

function voteOf(votes: Record<string, string>, id: string): string | null {
  return Object.hasOwn(votes, id) ? (votes[id] ?? null) : null;
}

function upper(word: string): string {
  return word.toLocaleUpperCase("tr-TR");
}

/** Konuşma sayısı (iki tur). */
export const sizmaTurns = (order: readonly string[]): number => order.length * SIZMA_ROUNDS;

/** Konuşma `turn`'de sırası gelen oyuncu; sıralar bittiyse null. */
export function speakerAt(order: readonly string[], turn: number): string | null {
  if (order.length === 0 || turn < 0 || turn >= sizmaTurns(order)) return null;
  return order[turn % order.length] ?? null;
}

/** Oy sayımı ve en çok oyu alanlar (katılımcı sırasıyla). */
export function sizmaTally(
  players: readonly string[],
  votes: Record<string, string>,
): { tally: Record<string, number>; top: number; leaders: string[] } {
  const tally: Record<string, number> = {};
  for (const id of players) tally[id] = 0;
  for (const id of players) {
    const to = voteOf(votes, id);
    if (to !== null && Object.hasOwn(tally, to)) tally[to] = (tally[to] ?? 0) + 1;
  }
  const top = Math.max(0, ...Object.values(tally));
  return { tally, top, leaders: top > 0 ? players.filter((id) => (tally[id] ?? 0) === top) : [] };
}

/** İlk oylamanın eşitlik adayları (ikinci oylama gerekiyorsa); yoksa null. Hiç oy yoksa ikinci oylama olmaz. */
export function sizmaRunoff(players: readonly string[], votes: Record<string, string>): string[] | null {
  const { leaders } = sizmaTally(players, votes);
  return leaders.length >= 2 ? leaders : null;
}

/**
 * Tahmin karşılaştırması: Türkçe büyük harf, baştaki/sondaki boşluk ve noktalama atılır, şapkalı harf düz sayılır
 * (Â = A). Ek almış hâl (ÇAYI) doğru sayılmaz; Ç/Ş/Ğ/İ/Ö/Ü harfleri korunur.
 */
export function sizmaGuessKey(raw: string): string {
  return upper(raw)
    .replace(/Â/g, "A")
    .replace(/Î/g, "İ")
    .replace(/Û/g, "U")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tahmini görünür hâle getirir: tek satır, büyük harf, en çok `SIZMA_GUESS_MAX` karakter; boşsa null. */
export function cleanGuess(raw: string): string | null {
  const text = upper(raw.replace(/[\p{Cc}\p{Cf}]/gu, " "))
    .replace(/\s+/g, " ")
    .trim();
  if (text.length === 0 || [...text].length > SIZMA_GUESS_MAX) return null;
  return sizmaGuessKey(text).length > 0 ? text : null;
}

export interface SizmaOutcome {
  /** Sayılan oylar (ikinci oylama olduysa onunkiler). */
  votes: Record<string, string>;
  tally: Record<string, number>;
  caught: boolean;
  runoff: string[] | null;
  stole: boolean;
  /** Sızmaya oy veren sızma olmayanlar (yakalandıysa; Evet deseler de listede). */
  rightVoters: string[];
  scores: Record<string, number>;
}

/**
 * Sonuç (saf): sızma tek başına en çok oyu alırsa yakalanır. İlk oylamada eşitlik varsa yalnız ikinci oylama
 * sayılır; o da eşitse ya da oy yoksa sızma kurtulur. Yakalanırsa yalnız sızmaya oy veren ve "Sızma sen miydin?"e
 * Evet demeyen sızma olmayanlar +1; sızma Evet dediyse +1, kelimeyi çaldıysa +1. Kurtulursa sızma +2 (+1 Evet).
 */
export function sizmaOutcome(
  players: readonly string[],
  infiltrator: string,
  firstVotes: Record<string, string>,
  runoffVotes: Record<string, string> = {},
  notices: Record<string, boolean> = {},
  stole = false,
): SizmaOutcome {
  const runoff = sizmaRunoff(players, firstVotes);
  const votes = runoff ? runoffVotes : firstVotes;
  const { tally, leaders } = sizmaTally(players, votes);
  const caught = leaders.length === 1 && leaders[0] === infiltrator;
  const noticed = notices[infiltrator] === true;
  const rightVoters = caught
    ? players.filter((id) => id !== infiltrator && voteOf(votes, id) === infiltrator)
    : [];
  const scores: Record<string, number> = {};
  for (const id of players) {
    if (id === infiltrator) {
      scores[id] =
        (caught ? 0 : 2) + (noticed ? SIZMA_NOTICE_POINTS : 0) + (caught && stole ? SIZMA_STEAL_POINTS : 0);
    } else {
      scores[id] = rightVoters.includes(id) && notices[id] !== true ? 1 : 0;
    }
  }
  return { votes: { ...votes }, tally, caught, runoff, stole: caught && stole, rightVoters, scores };
}

const stoleOf = (s: SizmaState): boolean =>
  s.guess !== null && sizmaGuessKey(s.guess) === sizmaGuessKey(s.commonWord);

const outcomeOf = (s: SizmaState): SizmaOutcome =>
  sizmaOutcome(s.players, s.infiltrator, s.votes, s.runoffVotes, s.notices, stoleOf(s));

/** Sıralar bitti (ya da herkes geçti): oylama geri sayımdan sonra başlar. */
function endTurns(s: SizmaState, at: number, wait: number): SizmaState {
  const clueEndsAt = Math.min(s.clueEndsAt, at + wait);
  return {
    ...s,
    turn: sizmaTurns(s.order),
    clueClosing: true,
    clueEndsAt,
    voteEndsAt: clueEndsAt + SIZMA_VOTE_MS,
  };
}

/**
 * Zamanla olan bütün geçişler: saklı bitiş anlarına göre ve `now`'a kadar (tick ne zaman çalışırsa çalışsın aynı
 * sonuç). `ctx.connected`'a bakmaz; `reduce` eylemden önce, `tick`, `isFinished` ve `revealAt` de bunu çağırır.
 */
export function advanceSizma(state: SizmaState, now: number): SizmaState {
  let s = state;
  for (let guard = 0; guard < 64; guard++) {
    const before = s;
    if (s.stage === "clue") {
      const total = sizmaTurns(s.order);
      if (!s.clueClosing && s.turn < total && now >= s.turnEndsAt && s.turnEndsAt < s.clueEndsAt) {
        const turn = s.turn + 1;
        s =
          turn >= total
            ? endTurns(s, s.turnEndsAt, SIZMA_COUNTDOWN_MS)
            : { ...s, turn, turnStartedAt: s.turnEndsAt, turnEndsAt: s.turnEndsAt + SIZMA_TURN_MS };
      } else if (now >= s.clueEndsAt) {
        s = { ...s, stage: "vote" };
      }
    } else if (s.stage === "vote") {
      if (now >= s.voteEndsAt) {
        const runoff = sizmaRunoff(s.players, s.votes);
        s = runoff
          ? {
              ...s,
              stage: "runoff",
              runoff,
              runoffEndsAt: s.voteEndsAt + SIZMA_RUNOFF_MS,
              locked: [],
              voteClosing: false,
            }
          : {
              ...s,
              stage: "notice",
              runoffEndsAt: s.voteEndsAt,
              noticeEndsAt: s.voteEndsAt + SIZMA_NOTICE_MS,
            };
      }
    } else if (s.stage === "runoff") {
      const end = s.runoffEndsAt ?? s.voteEndsAt;
      if (now >= end) s = { ...s, stage: "notice", noticeEndsAt: end + SIZMA_NOTICE_MS };
    } else if (s.stage === "notice") {
      const end = s.noticeEndsAt ?? s.voteEndsAt;
      if (now >= end) {
        if (outcomeOf(s).caught) {
          const guessOpensAt = end + SIZMA_UNMASK_MS;
          const guessEndsAt = guessOpensAt + SIZMA_GUESS_MS;
          s = { ...s, stage: "guess", guessOpensAt, guessEndsAt, finishAt: guessEndsAt + SIZMA_FINAL_MS };
        } else {
          s = { ...s, stage: "reveal", finishAt: end + SIZMA_REVEAL_MS };
        }
      }
    } else if (s.stage === "guess") {
      const end = s.guessEndsAt ?? 0;
      if (now >= end) s = { ...s, stage: "reveal", finishAt: end + SIZMA_FINAL_MS };
    }
    if (s === before) return s;
  }
  return s;
}

/** Bulunulan aşamanın penceresi. */
function windowOf(s: SizmaState): { from: number; to: number } {
  switch (s.stage) {
    case "clue":
      return { from: s.startedAt, to: s.clueEndsAt };
    case "vote":
      return { from: s.clueEndsAt, to: s.voteEndsAt };
    case "runoff":
      return { from: s.voteEndsAt, to: s.runoffEndsAt ?? s.voteEndsAt };
    case "notice":
      return { from: s.runoffEndsAt ?? s.voteEndsAt, to: s.noticeEndsAt ?? s.voteEndsAt };
    case "guess":
      return { from: s.noticeEndsAt ?? 0, to: s.guessEndsAt ?? 0 };
    case "reveal":
      return { from: finalAtOf(s), to: s.finishAt ?? 0 };
  }
}

/** Son açılışın başladığı an: yakalandıysa son şans bitişi, kurtulduysa "Sızma sen miydin?" bitişi. */
function finalAtOf(s: SizmaState): number {
  return s.guessEndsAt ?? s.noticeEndsAt ?? 0;
}

export const sizma: GameDefinition<SizmaState, SizmaAction, SizmaView, SizmaPublicView> = {
  id: "sizma",
  name: "Sızma",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Farklı kelimeyi gören sızmayı ipuçlarından yakala!",
    steps: [
      "Çoğunluk aynı kelimeyi görür, biri farklısını",
      "İki turda sırayla sesli ipucu ver",
      "Sızmayı oyla; eşitlikte yeniden oylanır",
    ],
  },

  parseAction(raw: unknown): SizmaAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    const n = Object.keys(r).length;
    if (r.kind === "skip" || r.kind === "lock") return n === 1 ? { kind: r.kind } : null;
    if (n !== 2) return null;
    if (r.kind === "notice") return typeof r.yes === "boolean" ? { kind: "notice", yes: r.yes } : null;
    if (r.kind === "said") {
      return typeof r.turn === "number" && Number.isInteger(r.turn) && r.turn >= 0 && r.turn < 64
        ? { kind: "said", turn: r.turn }
        : null;
    }
    if (r.kind === "guess") {
      return typeof r.text === "string" && r.text.length > 0 && r.text.length <= 64
        ? { kind: "guess", text: r.text }
        : null;
    }
    if (r.kind !== "vote") return null;
    const target = r.target;
    if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
    return { kind: "vote", target };
  },

  setup(players: readonly string[], ctx: GameContext): SizmaState {
    const pairs = poolEntries(SIZMA_POOL, ctx.content);
    const pair = pairs[ctx.rng.int(pairs.length)] as readonly [string, string];
    const flip = ctx.rng.int(2) === 1;
    const [common, other] = flip ? [pair[1], pair[0]] : [pair[0], pair[1]];
    const infiltrator = players[ctx.rng.int(players.length)] as string;
    const clueEndsAt = ctx.now + SIZMA_CLUE_CAP_MS;
    return {
      players: [...players],
      startedAt: ctx.now,
      order: ctx.rng.shuffle(players),
      infiltrator,
      commonWord: upper(common),
      infiltratorWord: upper(other),
      stage: "clue",
      turn: 0,
      turnStartedAt: ctx.now,
      turnEndsAt: ctx.now + SIZMA_TURN_MS,
      clueEndsAt,
      clueClosing: false,
      ready: [],
      voteEndsAt: clueEndsAt + SIZMA_VOTE_MS,
      locked: [],
      voteClosing: false,
      votes: {},
      runoff: null,
      runoffEndsAt: null,
      runoffVotes: {},
      noticeEndsAt: null,
      notices: {},
      guessOpensAt: null,
      guessEndsAt: null,
      guess: null,
      finishAt: null,
    };
  },

  reduce(state, playerId, action, ctx): SizmaState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    const s = advanceSizma(state, ctx.now);
    const online = (id: string): boolean => ctx.connected.includes(id);
    const everyoneIn = (done: readonly string[]): boolean => {
      const active = s.players.filter(online);
      return active.length > 0 && active.every((id) => done.includes(id));
    };

    if (action.kind === "said") {
      if (s.stage !== "clue" || s.clueClosing) return { rejected: "not_clue" };
      if (action.turn !== s.turn) return { rejected: "stale_turn" };
      const speaker = speakerAt(s.order, s.turn);
      if (speaker === null) return { rejected: "not_clue" };
      // Yalnız sırası gelen basar; bağlantısı kopmuş konuşanın sırasını herhangi bir katılımcı geçirebilir.
      if (speaker !== playerId && online(speaker)) return { rejected: "not_your_turn" };
      // Sıradaki bağlantısı kopuk konuşmacılar anında atlanır.
      const total = sizmaTurns(s.order);
      let turn = s.turn + 1;
      while (turn < total && !online(speakerAt(s.order, turn) ?? "")) turn++;
      if (turn >= total) return endTurns(s, ctx.now, SIZMA_COUNTDOWN_MS);
      return { ...s, turn, turnStartedAt: ctx.now, turnEndsAt: ctx.now + SIZMA_TURN_MS };
    }

    if (action.kind === "skip") {
      if (s.stage !== "clue") return { rejected: "not_clue" };
      if (s.clueClosing) return { rejected: "closed" };
      // Yeniden basmak yeniden kontrol eder (arada bağlantısı kopanlar beklenmesin).
      const ready = s.ready.includes(playerId) ? s.ready : [...s.ready, playerId];
      if (!everyoneIn(ready)) return ready === s.ready ? s : { ...s, ready };
      // Kalan sıralar atlanır; oylama 1 sn sonra başlar, oylama süresi aynı kalır.
      return endTurns({ ...s, ready }, ctx.now, SIZMA_LOCK_GRACE_MS);
    }

    if (action.kind === "notice") {
      if (s.stage !== "notice") return { rejected: "not_notice" };
      // Cevap tek seferliktir.
      if (Object.hasOwn(s.notices, playerId)) return { rejected: "locked" };
      const notices = { ...s.notices, [playerId]: action.yes };
      if (!everyoneIn(Object.keys(notices))) return { ...s, notices };
      // Herkes cevapladı: aşama 1 sn sonra biter.
      const noticeEndsAt = Math.min(s.noticeEndsAt ?? ctx.now, ctx.now + SIZMA_LOCK_GRACE_MS);
      return { ...s, notices, noticeEndsAt };
    }

    if (action.kind === "guess") {
      if (s.stage !== "guess") return { rejected: "not_guess" };
      if (playerId !== s.infiltrator) return { rejected: "not_infiltrator" };
      if (ctx.now < (s.guessOpensAt ?? 0)) return { rejected: "not_guess_yet" };
      if (s.guess !== null) return { rejected: "locked" };
      const guess = cleanGuess(action.text);
      if (guess === null) return { rejected: "bad_guess" };
      // Tek hak: tahminden 1 sn sonra kelimeler açılır.
      const guessEndsAt = Math.min(s.guessEndsAt ?? ctx.now, ctx.now + SIZMA_LOCK_GRACE_MS);
      return { ...s, guess, guessEndsAt, finishAt: guessEndsAt + SIZMA_FINAL_MS };
    }

    if (s.stage !== "vote" && s.stage !== "runoff") return { rejected: "not_voting" };
    const runoff = s.stage === "runoff";
    if (s.locked.includes(playerId)) return { rejected: "locked" };
    if (s.voteClosing) return { rejected: "closed" };
    const current = runoff ? s.runoffVotes : s.votes;

    if (action.kind === "lock") {
      if (voteOf(current, playerId) === null) return { rejected: "nothing_to_lock" };
      const locked = [...s.locked, playerId];
      if (!everyoneIn(locked)) return { ...s, locked };
      const end = Math.min(
        runoff ? (s.runoffEndsAt ?? ctx.now) : s.voteEndsAt,
        ctx.now + SIZMA_LOCK_GRACE_MS,
      );
      return runoff
        ? { ...s, locked, voteClosing: true, runoffEndsAt: end }
        : { ...s, locked, voteClosing: true, voteEndsAt: end };
    }

    // Oyun başında oyuncu olan herkes oylanabilir (bağlantısı kopmuş olsa da); ikinci oylamada yalnız adaylar.
    if (!s.players.includes(action.target)) return { rejected: "unknown_target" };
    if (runoff && !(s.runoff ?? []).includes(action.target)) return { rejected: "not_candidate" };
    if (voteOf(current, playerId) === action.target) return s;
    const votes = { ...current, [playerId]: action.target };
    return runoff ? { ...s, runoffVotes: votes } : { ...s, votes };
  },

  // Aşama ve konuşma geçişleri durumu değiştirir: sunucu değişiklikte yayın yapar.
  tick(state, ctx): SizmaState {
    return advanceSizma(state, ctx.now);
  },

  nextWake(state, ctx): number | null {
    const s = advanceSizma(state, ctx.now);
    const at: number[] = [];
    if (s.stage === "clue") at.push(s.clueEndsAt, s.clueClosing ? Number.POSITIVE_INFINITY : s.turnEndsAt);
    else if (s.stage === "guess") at.push(s.guessOpensAt ?? 0, s.guessEndsAt ?? 0);
    else at.push(windowOf(s).to);
    const next = at.filter((t) => Number.isFinite(t) && t > ctx.now);
    return next.length > 0 ? Math.min(...next) : null;
  },

  notify(state, ctx): readonly string[] {
    const s = advanceSizma(state, ctx.now);
    if (s.stage !== "clue" || s.clueClosing) return [];
    const speaker = speakerAt(s.order, s.turn);
    return speaker ? [speaker] : [];
  },

  // Görünümler durumu olduğu gibi okur (sunucu önce `tick` çalıştırır); böylece `secrets` ile aynı aşamayı görürler.
  publicView(state): SizmaPublicView {
    const s = state;
    const phase = s.stage;
    let reveal: SizmaReveal | null = null;
    if (phase === "guess" || phase === "reveal") {
      const o = outcomeOf(s);
      const final: SizmaFinal | null =
        phase === "reveal"
          ? {
              commonWord: s.commonWord,
              infiltratorWord: s.infiltratorWord,
              guess: o.caught ? s.guess : null,
              stole: o.stole,
              scores: o.scores,
              rightVoters: o.rightVoters,
            }
          : null;
      reveal = {
        infiltrator: s.infiltrator,
        votes: o.votes,
        tally: o.tally,
        caught: o.caught,
        runoff: o.runoff,
        selfNoticed: s.notices[s.infiltrator] === true,
        openedAt: s.noticeEndsAt ?? 0,
        guessOpensAt: o.caught ? s.guessOpensAt : null,
        guessEndsAt: o.caught ? s.guessEndsAt : null,
        finalAt: finalAtOf(s),
        finishAt: s.finishAt ?? 0,
        final,
      };
    }
    const w = windowOf(s);
    return {
      players: [...s.players],
      phase,
      order: [...s.order],
      startedAt: s.startedAt,
      phaseStartedAt: w.from,
      phaseEndsAt: w.to,
      turn: s.turn,
      turnStartedAt: s.turnStartedAt,
      turnEndsAt: s.turnEndsAt,
      runoff: phase === "clue" || phase === "vote" ? null : s.runoff ? [...s.runoff] : null,
      ready:
        phase === "clue"
          ? [...s.ready]
          : phase === "vote" || phase === "runoff"
            ? [...s.locked]
            : phase === "notice"
              ? Object.keys(s.notices)
              : [],
      reveal,
    };
  },

  view(state, playerId): SizmaView {
    if (playerId === null || !state.players.includes(playerId)) {
      return { word: null, myVote: null, myNotice: null, locked: false };
    }
    const s = state;
    const phase = s.stage;
    const isOdd = playerId === s.infiltrator;
    // Son şans sırasında ortak kelime hiçbir ekranda olmaz: sızma yalnız kendi kelimesini görür.
    const word = isOdd ? s.infiltratorWord : phase === "guess" ? null : s.commonWord;
    const votes = phase === "runoff" ? s.runoffVotes : phase === "vote" ? s.votes : null;
    return {
      word,
      myVote: votes ? voteOf(votes, playerId) : null,
      myNotice: Object.hasOwn(s.notices, playerId) ? (s.notices[playerId] ?? null) : null,
      locked:
        phase === "clue"
          ? s.ready.includes(playerId)
          : phase === "vote" || phase === "runoff"
            ? s.locked.includes(playerId)
            : phase === "notice"
              ? Object.hasOwn(s.notices, playerId)
              : phase === "guess" && isOdd && s.guess !== null,
    };
  },

  /** Son açılış: kurtulduysa "Sızma sen miydin?" bitişi, yakalandıysa son şansın bitişi. */
  revealAt(state, ctx): number | null {
    const s = advanceSizma(state, ctx.now);
    return s.stage === "reveal" ? finalAtOf(s) : null;
  },

  isFinished(state, ctx): boolean {
    const s = advanceSizma(state, ctx.now);
    return s.stage === "reveal" && s.finishAt !== null && ctx.now >= s.finishAt;
  },

  // Kelimeler yalnız sahiplerinin görünümünde olur; kimin sızma olduğu hiçbir görünümde yoktur (oyuncu kimliği
  // kısa, metin aramasıyla denetlenemez: bkz. sizma.test.ts "gizlilik"). Çok kısa kelimeler (ör. "at") alt dizgi
  // denetimine uygun değildir; onlar da aynı yapısal testlerle korunur.
  secrets(state): readonly SecretEntry[] {
    if (state.stage === "reveal") return [];
    const entries: SecretEntry[] = [];
    if (state.commonWord.length >= 3) {
      entries.push({
        ownerIds: state.stage === "guess" ? [] : state.players.filter((id) => id !== state.infiltrator),
        value: state.commonWord,
        label: "ortak kelime",
      });
    }
    if (state.infiltratorWord.length >= 3) {
      entries.push({ ownerIds: [state.infiltrator], value: state.infiltratorWord, label: "sızma kelimesi" });
    }
    return entries;
  },

  result(state) {
    const { scores } = outcomeOf(state);
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
