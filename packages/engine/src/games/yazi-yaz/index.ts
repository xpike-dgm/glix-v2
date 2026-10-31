import { poolEntries } from "../../content.js";
import {
  type GameContext,
  type GameDefinition,
  LATE_ACTION_GRACE_MS,
  type Rejected,
  type SecretEntry,
} from "../../game.js";
import { foldKey, sanitizeWord } from "../text.js";
import { YAZI_YAZ_TOPIC_POOL } from "./pool.js";
import {
  YAZI_YAZ_FREE_TOPIC,
  YAZI_YAZ_GUESS_MS,
  YAZI_YAZ_HIDDEN_POINT,
  YAZI_YAZ_INNOCENT_WORD,
  YAZI_YAZ_LOCK_GRACE_MS,
  YAZI_YAZ_PERSON_POINT,
  YAZI_YAZ_REVEAL_MS,
  YAZI_YAZ_TALK_MS,
  YAZI_YAZ_TOPIC_MEMORY,
  YAZI_YAZ_TYPO_MIN_LETTERS,
  YAZI_YAZ_WORD_POINT,
  YAZI_YAZ_WRITE_MS,
  YAZI_YAZ_WRITER_COUNT,
  type YaziYazAction,
  type YaziYazGuessResult,
  type YaziYazPublicView,
  type YaziYazReveal,
  type YaziYazRole,
  type YaziYazStage,
  type YaziYazView,
  yaziYazAwards,
  yaziYazLetterCount,
} from "./types.js";

export * from "./pool.js";
export * from "./types.js";

export interface YaziYazState {
  players: string[];
  /** Gizli: rastgele seçilen iki yazan (katılım sırasıyla). */
  writers: string[];
  /** Havuzdan çekilen konu kaydı (tekrar denetimi için; "SERBEST" dahil). */
  topicEntry: string;
  /** Herkese açık konu; konusuz turda null. */
  topic: string | null;
  startedAt: number;
  writeEndsAt: number;
  talkEndsAt: number;
  guessEndsAt: number;
  finishAt: number;
  /** Görünümlerin gösterdiği aşama; yalnız `tick` ilerletir (yayın tetikler). Kurallar zamana bakar. */
  stage: YaziYazStage;
  /** Oyuncu -> yazma girdisi (temizlenmiş). Yazanın kelimesi gizlidir. */
  texts: Record<string, string>;
  writeLocked: string[];
  writeClosing: boolean;
  skipped: string[];
  talkClosing: boolean;
  /** Oyuncu -> seçtiği kişi ve kelime (değiştirilebilir). */
  guessTarget: Record<string, string>;
  guessWord: Record<string, string>;
  guessLocked: string[];
  guessClosing: boolean;
}

function stageAt(state: YaziYazState, now: number): YaziYazStage {
  if (now >= state.guessEndsAt) return "reveal";
  if (now >= state.talkEndsAt) return "guess";
  if (now >= state.writeEndsAt) return "talk";
  return "write";
}

const has = (rec: Record<string, string>, id: string): boolean => Object.hasOwn(rec, id);

/** Bağlı katılımcıların hepsi listedeyse (ve en az bir bağlı varsa) true. */
function everyoneReady(state: YaziYazState, list: readonly string[], connected: readonly string[]): boolean {
  const active = state.players.filter((id) => connected.includes(id));
  return active.length > 0 && active.every((id) => list.includes(id));
}

/** Aşama bitişini öne çeker; sonraki aşamalar süreleriyle birlikte kayar. */
function retime(state: YaziYazState, stage: "write" | "talk" | "guess", endsAt: number): YaziYazState {
  let { writeEndsAt, talkEndsAt, guessEndsAt } = state;
  if (stage === "write") {
    writeEndsAt = Math.min(writeEndsAt, endsAt);
    talkEndsAt = writeEndsAt + YAZI_YAZ_TALK_MS;
    guessEndsAt = talkEndsAt + YAZI_YAZ_GUESS_MS;
  } else if (stage === "talk") {
    talkEndsAt = Math.min(talkEndsAt, endsAt);
    guessEndsAt = talkEndsAt + YAZI_YAZ_GUESS_MS;
  } else {
    guessEndsAt = Math.min(guessEndsAt, endsAt);
  }
  return { ...state, writeEndsAt, talkEndsAt, guessEndsAt, finishAt: guessEndsAt + YAZI_YAZ_REVEAL_MS };
}

const isInnocentWord = (text: string): boolean => foldKey(text) === foldKey(YAZI_YAZ_INNOCENT_WORD);

/**
 * Yazanın geçerli kelimesi: yazmadıysa ya da MASUM bıraktıysa boş (YY-M5: yazan MASUM yazamaz; MASUM bırakan
 * yazan "kelime yazmadı" sayılır).
 */
function writerWord(texts: Readonly<Record<string, string>>, writer: string): string {
  const text = Object.hasOwn(texts, writer) ? (texts[writer] ?? "") : "";
  return text === "" || isInnocentWord(text) ? "" : text;
}

function wordOf(state: YaziYazState, writer: string): string {
  return writerWord(state.texts, writer);
}

/**
 * Kelime eşleşmesi: klavyeden bağımsız; YY-M7 ile en az 6 harfli kelimede, harf sayısı aynıysa tek harf farkı da
 * doğru sayılır (eksik/fazla harf kabul edilmez).
 */
export function yaziYazWordMatch(guess: string, real: string): boolean {
  const a = foldKey(guess);
  const b = foldKey(real);
  if (a === "" || b === "") return false;
  if (a === b) return true;
  if (yaziYazLetterCount(real) < YAZI_YAZ_TYPO_MIN_LETTERS) return false;
  const x = Array.from(a.replace(/ /g, ""));
  const y = Array.from(b.replace(/ /g, ""));
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) diff++;
  return diff === 1;
}

/**
 * Tahmin puanı: kişi doğruysa +1 (masum için herhangi bir yazan, yazan için diğer yazan); kelime yalnız kişi
 * doğruysa ve o yazanın kelimesiyle eşleşirse +1. Kelime yazmamış yazanın kelimesi bilinemez.
 */
export function yaziYazJudge(
  state: Pick<YaziYazState, "writers" | "texts">,
  playerId: string,
  target: string | null,
  word: string,
): YaziYazGuessResult {
  const personOk = target !== null && target !== playerId && state.writers.includes(target);
  const real = personOk && target !== null ? writerWord(state.texts, target) : "";
  const wordOk = personOk && real !== "" && word !== "" && yaziYazWordMatch(word, real);
  return { target, word, personOk, wordOk };
}

/** Harf sayısı ipucu: küçükten büyüğe, yazılmamış kelime (null) sonda. */
function lettersOf(state: YaziYazState): (number | null)[] {
  const counts = state.writers.map((w) => {
    const word = wordOf(state, w);
    return word === "" ? null : yaziYazLetterCount(word);
  });
  return counts.sort((x, y) => (x === null ? 1 : y === null ? -1 : x - y));
}

function buildReveal(state: YaziYazState): YaziYazReveal {
  const words: Record<string, string> = {};
  for (const w of state.writers) words[w] = wordOf(state, w);
  const guesses: Record<string, YaziYazGuessResult> = {};
  for (const id of state.players) {
    const target = has(state.guessTarget, id) ? (state.guessTarget[id] as string) : null;
    const word = has(state.guessWord, id) ? (state.guessWord[id] as string) : "";
    guesses[id] = yaziYazJudge(state, id, target, word);
  }
  // YY-M3: yalnız masumların seçimi sayılır; kelime yazmamış yazan bu ödülü alamaz.
  const innocents = state.players.filter((id) => !state.writers.includes(id));
  const hidden = state.writers.filter(
    (w) => words[w] !== "" && !innocents.some((id) => guesses[id]?.target === w),
  );
  const scores: Record<string, number> = {};
  for (const id of state.players) {
    const g = guesses[id];
    scores[id] =
      (g?.personOk ? YAZI_YAZ_PERSON_POINT : 0) +
      (g?.wordOk ? YAZI_YAZ_WORD_POINT : 0) +
      (hidden.includes(id) ? YAZI_YAZ_HIDDEN_POINT : 0);
  }
  return { writers: [...state.writers], words, guesses, hidden, scores, awards: yaziYazAwards(scores) };
}

/** Bağlantı değişince (ya da eylemde) bulunulan aşamada bağlı herkes hazırsa aşamayı 1 sn sonraya çeker. */
function closeIfReady(state: YaziYazState, ctx: GameContext): YaziYazState {
  const now = ctx.now;
  if (now < state.startedAt || now >= state.guessEndsAt) return state;
  const end = now + YAZI_YAZ_LOCK_GRACE_MS;
  if (now < state.writeEndsAt) {
    if (state.writeClosing || !everyoneReady(state, state.writeLocked, ctx.connected)) return state;
    return { ...retime(state, "write", end), writeClosing: true };
  }
  if (now < state.talkEndsAt) {
    if (state.talkClosing || !everyoneReady(state, state.skipped, ctx.connected)) return state;
    return { ...retime(state, "talk", end), talkClosing: true };
  }
  if (state.guessClosing || !everyoneReady(state, state.guessLocked, ctx.connected)) return state;
  return { ...retime(state, "guess", end), guessClosing: true };
}

function jsonHas(json: string, value: string): boolean {
  return json.includes(value) || json.includes(JSON.stringify(value).slice(1, -1));
}

function parseText(raw: unknown, allowEmpty: boolean): string | null {
  if (typeof raw !== "string") return null;
  if (allowEmpty && raw.trim() === "") return "";
  return sanitizeWord(raw);
}

export const yaziYaz: GameDefinition<YaziYazState, YaziYazAction, YaziYazView, YaziYazPublicView> = {
  id: "yazi-yaz",
  graceMs: LATE_ACTION_GRACE_MS,
  name: "Yazı Yaz",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "İki gizli yazanı ve kelimelerini bul!",
    steps: [
      "Rol kartına basılı tut; yazansan konudan bir kelime yaz, masumsan MASUM",
      "60 sn konuş: harf ipucuyla kelimeyi, davranışlarla yazanı bul; yazansan saklan",
      "Kişi +1, kelime +1, hiç bulunmayan yazan +1",
    ],
  },

  parseAction(raw: unknown): YaziYazAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    const keys = Object.keys(r);
    switch (r.kind) {
      case "lock":
      case "skip":
        return keys.length === 1 ? { kind: r.kind } : null;
      case "write": {
        if (keys.length !== 2) return null;
        const text = parseText(r.text, false);
        return text === null ? null : { kind: "write", text };
      }
      case "guessWord": {
        if (keys.length !== 2) return null;
        const text = parseText(r.text, true);
        return text === null ? null : { kind: "guessWord", text };
      }
      case "guessPlayer": {
        if (keys.length !== 2) return null;
        const target = r.target;
        if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
        return { kind: "guessPlayer", target };
      }
      default:
        return null;
    }
  },

  setup(players: readonly string[], ctx: GameContext): YaziYazState {
    const writers = new Set(ctx.rng.shuffle(players).slice(0, YAZI_YAZ_WRITER_COUNT));
    // Konu yazanlar seçildikten sonra çekilir (rastgele sayı sırası eski kayıtlarla aynı kalır).
    const topics = poolEntries(YAZI_YAZ_TOPIC_POOL, ctx.content);
    const topicEntry = topics.length > 0 ? (topics[ctx.rng.int(topics.length)] ?? "") : "";
    const free =
      topicEntry === "" ||
      YAZI_YAZ_TOPIC_POOL.key(topicEntry) === YAZI_YAZ_TOPIC_POOL.key(YAZI_YAZ_FREE_TOPIC);
    const writeEndsAt = ctx.now + YAZI_YAZ_WRITE_MS;
    const talkEndsAt = writeEndsAt + YAZI_YAZ_TALK_MS;
    const guessEndsAt = talkEndsAt + YAZI_YAZ_GUESS_MS;
    return {
      players: [...players],
      writers: players.filter((id) => writers.has(id)),
      topicEntry,
      topic: free ? null : topicEntry,
      startedAt: ctx.now,
      writeEndsAt,
      talkEndsAt,
      guessEndsAt,
      finishAt: guessEndsAt + YAZI_YAZ_REVEAL_MS,
      stage: "write",
      texts: {},
      writeLocked: [],
      writeClosing: false,
      skipped: [],
      talkClosing: false,
      guessTarget: {},
      guessWord: {},
      guessLocked: [],
      guessClosing: false,
    };
  },

  reduce(state, playerId, action, ctx): YaziYazState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (ctx.now >= state.guessEndsAt) return { rejected: "ended" };
    const writing = ctx.now < state.writeEndsAt;
    const talking = !writing && ctx.now < state.talkEndsAt;
    const guessing = !writing && !talking;

    if (action.kind === "skip") {
      if (!talking) return { rejected: "not_talking" };
      if (state.talkClosing) return { rejected: "closed" };
      if (state.skipped.includes(playerId)) return state;
      return closeIfReady({ ...state, skipped: [...state.skipped, playerId] }, ctx);
    }

    if (action.kind === "write") {
      if (!writing) return { rejected: "not_writing" };
      if (state.writeLocked.includes(playerId)) return { rejected: "locked" };
      if (state.writeClosing) return { rejected: "closed" };
      const isWriter = state.writers.includes(playerId);
      if (!isWriter && action.text !== YAZI_YAZ_INNOCENT_WORD) return { rejected: "innocent_text" };
      if (state.texts[playerId] === action.text) return state;
      return { ...state, texts: { ...state.texts, [playerId]: action.text } };
    }

    if (action.kind === "lock") {
      if (talking) return { rejected: "not_locking" };
      if (writing) {
        if (state.writeLocked.includes(playerId)) return { rejected: "locked" };
        if (state.writeClosing) return { rejected: "closed" };
        const isWriter = state.writers.includes(playerId);
        let texts = state.texts;
        if (!has(texts, playerId)) {
          // YY-M5: boş "Tamam" diyen masumun panosu MASUM ile dolar; yazan önce kelimesini yazmalı.
          if (isWriter) return { rejected: "nothing_to_lock" };
          texts = { ...texts, [playerId]: YAZI_YAZ_INNOCENT_WORD };
        } else if (isWriter && isInnocentWord(texts[playerId] ?? "")) {
          return { rejected: "writer_innocent" };
        }
        return closeIfReady({ ...state, texts, writeLocked: [...state.writeLocked, playerId] }, ctx);
      }
      if (state.guessLocked.includes(playerId)) return { rejected: "locked" };
      if (state.guessClosing) return { rejected: "closed" };
      if (!has(state.guessTarget, playerId)) return { rejected: "nothing_to_lock" };
      return closeIfReady({ ...state, guessLocked: [...state.guessLocked, playerId] }, ctx);
    }

    // guessPlayer / guessWord
    if (!guessing) return { rejected: "not_guessing" };
    if (state.guessLocked.includes(playerId)) return { rejected: "locked" };
    if (state.guessClosing) return { rejected: "closed" };
    if (action.kind === "guessPlayer") {
      if (action.target === playerId) return { rejected: "self_target" };
      if (!state.players.includes(action.target)) return { rejected: "unknown_target" };
      if (state.guessTarget[playerId] === action.target) return state;
      return { ...state, guessTarget: { ...state.guessTarget, [playerId]: action.target } };
    }
    if ((state.guessWord[playerId] ?? "") === action.text) return state;
    return { ...state, guessWord: { ...state.guessWord, [playerId]: action.text } };
  },

  // Aşama değişimi durumu bir kez değiştirir: sunucu değişiklikte yayın yapar, geçişler tam zamanında görünür.
  tick(state, ctx): YaziYazState {
    const stage = stageAt(state, ctx.now);
    return stage === state.stage ? state : { ...state, stage };
  },

  // YY-M5: son eksik oyuncu koparsa "herkes hazır mı" yeniden denetlenir.
  onPresence(state, ctx): YaziYazState {
    return closeIfReady(state, ctx);
  },

  contentUsed(state) {
    if (state.topicEntry === "") return [];
    return [
      {
        poolId: YAZI_YAZ_TOPIC_POOL.id,
        key: YAZI_YAZ_TOPIC_POOL.key(state.topicEntry),
        memory: YAZI_YAZ_TOPIC_MEMORY,
      },
    ];
  },

  publicView(state): YaziYazPublicView {
    const done =
      state.stage === "write"
        ? state.writeLocked
        : state.stage === "talk"
          ? state.skipped
          : state.stage === "guess"
            ? state.guessLocked
            : [];
    return {
      players: [...state.players],
      stage: state.stage,
      topic: state.topic,
      letters: state.stage === "write" ? null : lettersOf(state),
      startedAt: state.startedAt,
      writeEndsAt: state.writeEndsAt,
      talkEndsAt: state.talkEndsAt,
      guessEndsAt: state.guessEndsAt,
      finishAt: state.finishAt,
      // YY-M6: yazmada kimin Tamam dediği gizli; yalnız sayı.
      ready: state.stage === "write" ? [] : [...done],
      readyCount: done.length,
      reveal: state.stage === "reveal" ? buildReveal(state) : null,
    };
  },

  view(state, playerId): YaziYazView {
    if (playerId === null || !state.players.includes(playerId)) {
      return { role: null, myText: null, locked: false, myGuess: { target: null, word: "" } };
    }
    const role: YaziYazRole = state.writers.includes(playerId) ? "writer" : "innocent";
    const locked =
      state.stage === "write"
        ? state.writeLocked.includes(playerId)
        : state.stage === "talk"
          ? state.skipped.includes(playerId)
          : state.stage === "guess"
            ? state.guessLocked.includes(playerId)
            : false;
    return {
      role,
      myText: has(state.texts, playerId) ? (state.texts[playerId] as string) : null,
      locked,
      myGuess: {
        target: has(state.guessTarget, playerId) ? (state.guessTarget[playerId] as string) : null,
        word: state.guessWord[playerId] ?? "",
      },
    };
  },

  /** Sonuç açılışı tahmin süresinin bittiği an başlar. */
  revealAt(state): number | null {
    return state.guessEndsAt;
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.finishAt;
  },

  // Yazanların kelimeleri sonuç açılana kadar gizli. Roller (oyuncu kimlikleri) kısa olduğundan metinle aranamaz;
  // gizlilikleri yapısaldır (publicView hiçbir rol içermez, view yalnız kendi rolünü verir): yazi-yaz.test.ts "gizlilik".
  secrets(state): readonly SecretEntry[] {
    if (state.stage === "reveal") return [];
    const entries: SecretEntry[] = [];
    for (const w of state.writers) {
      const value = wordOf(state, w);
      if (value.length < 3) continue;
      // Aynı metni kendi girdisinde/tahmininde gören oyuncunun da görmeye hakkı var (ör. "MASUM" ya da doğru tahmin).
      const owners = state.players.filter(
        (id) =>
          id === w ||
          jsonHas(JSON.stringify({ t: state.texts[id] ?? null, g: state.guessWord[id] ?? "" }), value),
      );
      entries.push({ ownerIds: owners, value, label: `${w} kelimesi` });
    }
    return entries;
  },

  result(state) {
    const { scores, awards } = buildReveal(state);
    return { miniScores: { ...scores }, awards: { ...awards } };
  },
};
