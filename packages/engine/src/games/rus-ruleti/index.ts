import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  RUS_RULETI_DECISION_MS,
  RUS_RULETI_FIRST_BAND_MS,
  RUS_RULETI_KAHIN_MIN_CORRECT,
  RUS_RULETI_LAST_WORD_AFTER_MS,
  RUS_RULETI_LAST_WORD_MS,
  RUS_RULETI_MAX_RISK,
  RUS_RULETI_OFFLINE_DECISION_MS,
  RUS_RULETI_OPEN_MS,
  RUS_RULETI_OUTRO_MS,
  RUS_RULETI_RISK_STEP,
  RUS_RULETI_START_RISK,
  type RusRuletiAction,
  type RusRuletiHandoff,
  type RusRuletiLastWord,
  type RusRuletiPredictionResult,
  type RusRuletiPublicView,
  type RusRuletiResult,
  type RusRuletiShot,
  type RusRuletiView,
} from "./types.js";

export * from "./types.js";

export interface RusRuletiState {
  players: string[];
  startedAt: number;
  /**
   * GİZLİ: atış sonuçlarının tohumu. Her atışın zarı `shotRng(seed, atışNo)` ile atış anında çıkar;
   * böylece sonuç tick takvimine ve reddedilen eylemlere bağlı kalmaz (ortak `ctx.rng` akışı tüketilmez).
   */
  seed: number;
  alive: string[];
  eliminated: string[];
  holder: string;
  risk: number;
  shots: number;
  last: RusRuletiShot | null;
  /** RR-U3: bütün atışlar (herkese açık). */
  history: RusRuletiShot[];
  /** RR-M3: bekleyen son söz. */
  lastWord: RusRuletiLastWord | null;
  /** RR-M3: son patlamadan sonra silahın kime geçtiği (yeni atışta silinir). */
  handoff: RusRuletiHandoff | null;
  /**
   * RR-M4: bağlantısı kopuk katılımcılar. Yalnız `setup` ve `onPresence` (bağlantı kaydı) yazar; böylece `tick`
   * `ctx.connected`'a bakmadan kopan sahibin kısa karar süresini uygular ve kayıttan tekrar oynatma birebir kalır.
   */
  offline: string[];
  openAt: number;
  /** Karar bitişi; son söz sürerken, son söz süre dolunca biterse geçerli olacak bitiş. */
  deadline: number;
  over: boolean;
  /** GİZLİ (O9): sıradaki atış için elenenlerin tahmini (oyuncu → patlar mı). Yalnız sahibinin `view`ına girer. */
  predictions: Record<string, boolean>;
  /** GİZLİ (O9): oyuncu başına doğru çıkan "Evet, patlar" tahmini sayısı; yalnız oyun bitince "Kâhin" olarak açılır. */
  correct: Record<string, number>;
  /** GİZLİ (O9): oyuncu başına verilen "Evet, patlar" tahmini sayısı (Kâhin için en az yarısı doğru olmalı). */
  yes: Record<string, number>;
  /** GİZLİ (O9): son çözülen tahminin sonucu; yalnız sahibine gider. */
  results: Record<string, RusRuletiPredictionResult>;
  /** GİZLİ (RR-U13): oyuncu başına çözülen tahmin sayısı ve bunların tutanı; yalnız sahibine gider. */
  made: Record<string, number>;
  hits: Record<string, number>;
}

/** Atış sonucuna göre tahminleri çözer (saf): doğru sayaçlarını ve sahiplerinin sonucunu günceller. */
function resolvePredictions(
  state: RusRuletiState,
  exploded: boolean,
): Pick<RusRuletiState, "predictions" | "correct" | "yes" | "results" | "made" | "hits"> {
  const correct = { ...state.correct };
  const yes = { ...state.yes };
  const results = { ...state.results };
  const made = { ...state.made };
  const hits = { ...state.hits };
  for (const [id, guess] of Object.entries(state.predictions)) {
    const hit = guess === exploded;
    results[id] = { turn: state.shots, correct: hit };
    made[id] = (made[id] ?? 0) + 1;
    if (hit) hits[id] = (hits[id] ?? 0) + 1;
    // Kâhin yalnız patlamayı bilenleri sayar: "Hayır" çoğu atışta zaten doğrudur.
    if (guess) {
      yes[id] = (yes[id] ?? 0) + 1;
      if (exploded) correct[id] = (correct[id] ?? 0) + 1;
    }
  }
  return { predictions: {}, correct, yes, results, made, hits };
}

/**
 * "Kâhin" rozeti: elenmiş olup en az bir kez "Evet, patlar" deyip bilen ve "Evet" tahminlerinin en az yarısı
 * doğru çıkanlar (oyuncu sırasıyla).
 */
export function rusRuletiKahinler(state: RusRuletiState): string[] {
  return state.players.filter((id) => {
    const hits = state.correct[id] ?? 0;
    const calls = state.yes[id] ?? 0;
    return state.eliminated.includes(id) && hits >= RUS_RULETI_KAHIN_MIN_CORRECT && hits * 2 >= calls;
  });
}

/** Atış `no` için rastgelelik: tohum + sıra numarasından türetilir. */
function shotRng(seed: number, no: number, salt = 0) {
  const rng = createRng((seed ^ Math.imul(no + 1, 0x9e3779b1) ^ salt) >>> 0);
  rng.next();
  return rng;
}

/** RR-U8: oyun bitişi: son atıştan sonra oyun içi açılış en az bu kadar gösterilir. */
const outroEnd = (state: RusRuletiState): number => (state.last?.at ?? state.startedAt) + RUS_RULETI_OUTRO_MS;

/** Yarı eşiği: hayatta kalan sayısı başlangıcın yarısına veya altına düşünce biter. */
export function rusRuletiShouldEnd(startCount: number, aliveCount: number): boolean {
  return aliveCount * 2 <= startCount;
}

/** RR-U2: oyunun bitmesi için gereken elenme sayısı (2→1, 3/4→2, 5/6→3, 7/8→4). */
export function rusRuletiNeededOuts(startCount: number): number {
  return startCount - Math.floor(startCount / 2);
}

/** RR-M4: sahibin karar süresi; bağlantısı kopuksa kısa. */
const decisionMs = (state: Pick<RusRuletiState, "offline">, holder: string): number =>
  state.offline.includes(holder) ? RUS_RULETI_OFFLINE_DECISION_MS : RUS_RULETI_DECISION_MS;

/**
 * RR-M1: hemen geri ateş yok. Son atış boş geçip silahı başkasından şimdiki sahibe getirdiyse, sahip bu kararında ona
 * sıkanı hedefleyemez. Yalnız en az 3 kişi hayattayken; patlamadan ve kendine sıkmadan sonra yasak yoktur.
 */
export function rusRuletiNoReturn(
  state: Pick<RusRuletiState, "last" | "alive" | "holder" | "over" | "lastWord">,
): string | null {
  const l = state.last;
  if (state.over || state.lastWord || !l || l.exploded || l.shooter === l.target) return null;
  if (l.target !== state.holder || state.alive.length < 3 || !state.alive.includes(l.shooter)) return null;
  return l.shooter;
}

/** Son sözü bitirir: silah `to`'ya geçer, karar penceresi `at`'te açılır. */
function settleLastWord(
  state: RusRuletiState,
  from: string,
  to: string,
  chosen: boolean,
  at: number,
): RusRuletiState {
  return {
    ...state,
    holder: to,
    lastWord: null,
    handoff: { from, to, chosen },
    openAt: at,
    deadline: at + decisionMs(state, to),
  };
}

/** Son söz seçilmeden bitince (süre ya da kopma) silah hayatta kalanlardan rastgele birine gider (atışa bağlı tohum). */
function randomHeir(state: RusRuletiState): string {
  const pick = shotRng(state.seed, state.shots, 0x2c1b3c6d);
  return state.alive[pick.int(state.alive.length)] ?? state.holder;
}

/**
 * Bir atış uygular (elle ya da süre dolunca). `at` atışın zamanı; sonraki karar penceresi buna göre kurulur.
 * Rastgelelik yalnız atış sırasından türer.
 */
function fire(state: RusRuletiState, target: string, auto: boolean, at: number): RusRuletiState {
  const rng = shotRng(state.seed, state.shots);
  const exploded = rng.int(100) < state.risk;
  const seq = state.shots + 1;
  const last: RusRuletiShot = {
    seq,
    shooter: state.holder,
    target,
    auto,
    exploded,
    risk: state.risk,
    at,
  };
  const openAt = at + RUS_RULETI_OPEN_MS;
  const resolved = resolvePredictions(state, exploded);
  const history = [...state.history, last];
  if (!exploded) {
    return {
      ...state,
      ...resolved,
      holder: target,
      risk: Math.min(RUS_RULETI_MAX_RISK, state.risk + RUS_RULETI_RISK_STEP),
      shots: seq,
      last,
      history,
      handoff: null,
      openAt,
      deadline: openAt + decisionMs(state, target),
    };
  }
  const alive = state.alive.filter((id) => id !== target);
  const eliminated = [...state.eliminated, target];
  const over = rusRuletiShouldEnd(state.players.length, alive.length);
  const next: RusRuletiState = {
    ...state,
    ...resolved,
    alive,
    eliminated,
    risk: RUS_RULETI_START_RISK,
    shots: seq,
    last,
    history,
    handoff: null,
    lastWord: null,
    openAt,
    deadline: openAt + RUS_RULETI_DECISION_MS,
    over,
  };
  if (over) return next;
  // RR-M3: bağlantısı kopuk elenen son söz söyleyemez; silah hemen rastgele birine gider (eski kural).
  if (state.offline.includes(target)) return settleLastWord(next, target, randomHeir(next), false, openAt);
  const endsAt = openAt + RUS_RULETI_LAST_WORD_MS;
  return {
    ...next,
    lastWord: { from: target, opensAt: openAt, endsAt },
    openAt: endsAt,
    deadline: endsAt + RUS_RULETI_DECISION_MS,
  };
}

/**
 * Süresi dolan son sözler ve kararlar. Karar için sunucu atışı: sahip dışındaki (ve RR-M1 yasaklısı dışındaki)
 * rastgele bir hayatta oyuncu (yoksa sahibin kendisi). Atış zamanı gerçek bitiş anıdır (tick geç kalsa da sonuç
 * aynıdır). `connected`'a bakmaz.
 */
function catchUp(state: RusRuletiState, now: number): RusRuletiState {
  let s = state;
  while (!s.over) {
    if (s.lastWord) {
      if (now < s.lastWord.endsAt) break;
      s = settleLastWord(s, s.lastWord.from, randomHeir(s), false, s.lastWord.endsAt);
      continue;
    }
    if (now < s.deadline) break;
    const banned = rusRuletiNoReturn(s);
    const others = s.alive.filter((id) => id !== s.holder);
    const allowed = others.filter((id) => id !== banned);
    const pool = allowed.length > 0 ? allowed : others;
    const pick = shotRng(s.seed, s.shots, 0x5bd1e995); // hedef seçimi atışın zarından ayrı bir akış kullanır
    const target = pool.length > 0 ? (pool[pick.int(pool.length)] ?? s.holder) : s.holder;
    s = fire(s, target, true, s.deadline);
  }
  return s;
}

export function rusRuletiResult(state: RusRuletiState): RusRuletiResult {
  return {
    survivors: [...state.alive],
    eliminated: [...state.eliminated],
    kahinler: rusRuletiKahinler(state),
  };
}

export const rusRuleti: GameDefinition<RusRuletiState, RusRuletiAction, RusRuletiView, RusRuletiPublicView> =
  {
    id: "rus-ruleti",
    name: "Rus Ruleti",
    minPlayers: 2,
    maxPlayers: 8,
    orientation: "portrait",
    briefing: {
      goal: "Silah patlamadan hayatta kal!",
      steps: [
        "Silah sendeyse birini ya da kendini seç; boş geçerse silah ona geçer",
        "Risk %16'dan başlar, her boş atışta 10 artar; patlayınca sıfırlanır",
        "Yarınız elenince biter: hayatta kalanlar +1",
      ],
    },

    parseAction(raw: unknown): RusRuletiAction | null {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
      const rec = raw as Record<string, unknown>;
      if (rec.kind === "predict") {
        const { turn, explodes } = rec;
        if (Object.keys(rec).length !== 3 || typeof explodes !== "boolean") return null;
        if (typeof turn !== "number" || !Number.isInteger(turn) || turn < 0 || turn > 100_000) return null;
        return { kind: "predict", turn, explodes };
      }
      if (rec.kind === "pass") {
        const to = rec.to;
        if (Object.keys(rec).length !== 2 || typeof to !== "string" || to.length === 0 || to.length > 64)
          return null;
        return { kind: "pass", to };
      }
      if (Object.keys(rec).length !== 2 || rec.kind !== "shoot") return null;
      const target = rec.target;
      if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
      return { kind: "shoot", target };
    },

    setup(players: readonly string[], ctx: GameContext): RusRuletiState {
      const pool = ctx.connected.filter((id) => players.includes(id));
      const candidates = pool.length > 0 ? pool : players;
      const holder = candidates[ctx.rng.int(candidates.length)] ?? players[0] ?? "";
      const seed = ctx.rng.int(2 ** 30);
      return {
        players: [...players],
        startedAt: ctx.now,
        seed,
        alive: [...players],
        eliminated: [],
        holder,
        risk: RUS_RULETI_START_RISK,
        shots: 0,
        last: null,
        history: [],
        lastWord: null,
        handoff: null,
        offline: players.filter((id) => !ctx.connected.includes(id)),
        openAt: ctx.now,
        // RR-U9: ilk kararda önceden bekleme olmadığı için "SİLAH SENDE!" bandı kadar uzun açılır.
        deadline: ctx.now + RUS_RULETI_FIRST_BAND_MS + RUS_RULETI_DECISION_MS,
        over: false,
        predictions: {},
        correct: {},
        yes: {},
        results: {},
        made: {},
        hits: {},
      };
    },

    reduce(state, playerId, action, ctx): RusRuletiState | Rejected {
      if (!state.players.includes(playerId)) return { rejected: "not_participant" };
      // Süresi dolmuş kararlar önce işlenir; bu hâlâ saf ve rastgele akışı tüketmez.
      const s = catchUp(state, ctx.now);
      if (s.over) return { rejected: "ended" };
      if (ctx.now < s.startedAt) return { rejected: "not_started" };
      if (action.kind === "pass") {
        // RR-M3: yalnız son sözü bekleyen elenen, sonuç beklemesi bittikten sonra.
        const lw = s.lastWord;
        if (!lw || lw.from !== playerId) return { rejected: "not_last_word" };
        if (ctx.now < lw.opensAt) return { rejected: "not_open" };
        if (!s.alive.includes(action.to)) return { rejected: "bad_target" };
        return settleLastWord(s, lw.from, action.to, true, ctx.now + RUS_RULETI_LAST_WORD_AFTER_MS);
      }
      if (action.kind === "predict") {
        // O9: yalnız elenenler; atış sonucu önceden belirsiz olduğundan zamana bağlı sınır yoktur.
        if (s.alive.includes(playerId)) return { rejected: "alive_cannot_predict" };
        // RR-M3: az önce elenenin tahmini son sözünden sonra başlar.
        if (s.lastWord?.from === playerId) return { rejected: "last_word" };
        if (action.turn !== s.shots) return { rejected: "stale_turn" };
        if (playerId in s.predictions) return { rejected: "already_predicted" };
        return { ...s, predictions: { ...s.predictions, [playerId]: action.explodes } };
      }
      if (!s.alive.includes(playerId)) return { rejected: "eliminated" };
      if (s.lastWord) return { rejected: "last_word" };
      if (ctx.now < s.openAt) return { rejected: "not_open" };
      if (playerId !== s.holder) return { rejected: "not_holder" };
      if (!s.alive.includes(action.target)) return { rejected: "bad_target" };
      // RR-M4: bağlantısı kopan hayattaki oyuncu da elle hedeflenebilir.
      if (action.target === rusRuletiNoReturn(s)) return { rejected: "no_return_fire" };
      return fire(s, action.target, false, ctx.now);
    },

    tick(state, ctx): RusRuletiState {
      return catchUp(state, ctx.now);
    },

    /**
     * RR-M4 / RR-M3: kopan sahibin karar süresi 6 sn'ye iner (pencere açıksa kalan süre, en çok 6 sn); dönen kalan süreyle
     * oynar. Son sözünü bekleyen elenen koparsa silah hemen rastgele birine gider.
     */
    onPresence(state, ctx): RusRuletiState {
      const offline = state.players.filter((id) => !ctx.connected.includes(id));
      if (offline.length === state.offline.length && offline.every((id) => state.offline.includes(id)))
        return state;
      const s: RusRuletiState = { ...state, offline };
      if (s.over) return s;
      if (s.lastWord) {
        if (!offline.includes(s.lastWord.from)) return s;
        return settleLastWord(
          s,
          s.lastWord.from,
          randomHeir(s),
          false,
          Math.max(ctx.now, s.lastWord.opensAt),
        );
      }
      if (offline.includes(s.holder) && !state.offline.includes(s.holder)) {
        const cap = Math.max(ctx.now, s.openAt) + RUS_RULETI_OFFLINE_DECISION_MS;
        if (cap < s.deadline) return { ...s, deadline: cap };
      }
      return s;
    },

    publicView(state): RusRuletiPublicView {
      return {
        startedAt: state.startedAt,
        players: [...state.players],
        alive: [...state.alive],
        eliminated: [...state.eliminated],
        holder: state.holder,
        risk: state.risk,
        shots: state.shots,
        last: state.last ? { ...state.last } : null,
        history: state.history.map((h) => ({ ...h })),
        noReturn: rusRuletiNoReturn(state),
        lastWord: state.lastWord && !state.over ? { ...state.lastWord } : null,
        handoff: state.handoff ? { ...state.handoff } : null,
        openAt: state.openAt,
        deadline: state.over ? null : state.deadline,
        over: state.over,
        result: state.over ? rusRuletiResult(state) : null,
      };
    },

    view(state, playerId): RusRuletiView {
      if (playerId === null || !state.players.includes(playerId)) return { role: "spectator" };
      if (state.alive.includes(playerId)) return { role: "alive" };
      const guess = state.predictions[playerId];
      return {
        role: "out",
        turn: state.shots,
        prediction: guess === undefined ? null : guess,
        lastResult: state.results[playerId] ?? null,
        tally: {
          made: state.made[playerId] ?? 0,
          hit: state.hits[playerId] ?? 0,
          yes: state.yes[playerId] ?? 0,
          yesHit: state.correct[playerId] ?? 0,
        },
      };
    },

    /** Sonuç açılışı oyunu bitiren son atışla başlar. */
    revealAt(state): number | null {
      return state.over ? (state.last?.at ?? state.startedAt) : null;
    },

    isFinished(state, ctx): boolean {
      return state.over && ctx.now >= outroEnd(state);
    },

    /** Atış tohumu: kimsenin görünümünde olamaz (sonuçlar atış anında bu tohumdan çıkar). */
    secrets(state) {
      return [{ ownerIds: [], value: `rr-tohum-${state.seed}`, label: "atış tohumu" }];
    },

    result(state) {
      const scores: Record<string, number> = {};
      for (const id of state.players) scores[id] = state.alive.includes(id) ? 1 : 0;
      // Kâhin unvanı sunucuda "Kâhin ×10" rozeti için sayılır; istemciye gitmez (sonuçtan ayıklanır).
      const stats: Record<string, Record<string, number>> = {};
      for (const id of rusRuletiKahinler(state)) stats[id] = { kahin: 1 };
      return { miniScores: { ...scores }, awards: { ...scores }, stats };
    },
  };
