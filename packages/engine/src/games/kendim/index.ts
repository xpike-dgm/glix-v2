import { poolEntries } from "../../content.js";
import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import { derivedRng, drawSeed } from "../seeded.js";
import { foldKey, sanitizeWord } from "../text.js";
import { KENDIM_TOPIC_POOL } from "./pool.js";
import {
  KENDIM_BONUS_POINT,
  KENDIM_DEFAULT_TOPIC,
  KENDIM_LOCK_GRACE_MS,
  KENDIM_RIGHT_POINT,
  KENDIM_TOPIC_MEMORY,
  KENDIM_WRITE_MS,
  type KendimAction,
  type KendimCard,
  type KendimPublicView,
  type KendimReveal,
  type KendimRevealCard,
  type KendimRevealPair,
  type KendimStage,
  type KendimTopic,
  type KendimView,
  kendimAwards,
  kendimMatchMs,
  kendimRevealMs,
} from "./types.js";

export * from "./pool.js";
export * from "./topics.js";
export * from "./types.js";

export interface KendimState {
  players: string[];
  /** Havuzdan çekilen konu (KN-M2; herkese açık). */
  topic: KendimTopic;
  /** Konunun çekildiği etkin havuzun boyu (tekrar belleği için). */
  topicCount: number;
  /** Kart karıştırma tohumu (görünümlere girmez). */
  seed: number;
  startedAt: number;
  writeEndsAt: number;
  matchEndsAt: number;
  finishAt: number;
  /** Görünümlerin gösterdiği aşama; yalnız `tick` ilerletir (yayın tetikler). Kurallar zamana bakar. */
  stage: KendimStage;
  /** Oyuncu -> kelime (temizlenmiş). Süre bitene kadar yalnız sahibine açık. */
  texts: Record<string, string>;
  writeLocked: string[];
  writeClosing: boolean;
  /** Oyuncu -> (kart numarası -> eşlediği oyuncu). Sonuca kadar gizli. */
  pairs: Record<string, Record<string, string>>;
  matchLocked: string[];
  matchClosing: boolean;
}

const has = <T>(rec: Record<string, T>, id: string): boolean => Object.hasOwn(rec, id);

function stageAt(state: KendimState, now: number): KendimStage {
  if (now >= state.matchEndsAt) return "reveal";
  if (now >= state.writeEndsAt) return "match";
  return "write";
}

function everyoneReady(state: KendimState, list: readonly string[], connected: readonly string[]): boolean {
  const active = state.players.filter((id) => connected.includes(id));
  return active.length > 0 && active.every((id) => list.includes(id));
}

/** Kart sayısı yazma bitince sabittir: yazma sürerken o ana kadar yazılanlar sayılır (bitiş tick ile düzeltilir). */
function cardCount(state: Pick<KendimState, "players" | "texts">): number {
  return state.players.filter((id) => has(state.texts, id)).length;
}

function finishOf(state: Pick<KendimState, "players" | "texts">, matchEndsAt: number): number {
  return matchEndsAt + kendimRevealMs(cardCount(state));
}

function retime(state: KendimState, stage: "write" | "match", endsAt: number): KendimState {
  let { writeEndsAt, matchEndsAt } = state;
  if (stage === "write") {
    writeEndsAt = Math.min(writeEndsAt, endsAt);
    matchEndsAt = writeEndsAt + kendimMatchMs(state.players.length);
  } else {
    matchEndsAt = Math.min(matchEndsAt, endsAt);
  }
  return { ...state, writeEndsAt, matchEndsAt, finishAt: finishOf(state, matchEndsAt) };
}

/** Kartlar: kelime yazanların kelimeleri, tohumdan karıştırılmış sırada (numara = sıra). Yazma bittikten sonra sabittir. */
export function kendimCards(state: Pick<KendimState, "players" | "seed" | "texts">): (KendimCard & {
  owner: string;
})[] {
  const owners = state.players.filter((id) => has(state.texts, id));
  return derivedRng(state.seed, "cards")
    .shuffle(owners)
    .map((owner, id) => ({ id, text: state.texts[owner] as string, owner }));
}

/** Doğruluk: eşlediğin oyuncunun kelimesi kartın kelimesiyle aynıysa doğrudur (aynı kelimeyi yazanlar denktir). */
function isCorrect(state: KendimState, text: string, target: string): boolean {
  return has(state.texts, target) && foldKey(state.texts[target] ?? "") === foldKey(text);
}

function buildReveal(state: KendimState): KendimReveal {
  const cards = kendimCards(state);
  const pairs: Record<string, KendimRevealPair[]> = {};
  const scores: Record<string, number> = {};
  const finders = new Map<number, string[]>();
  for (const id of state.players) {
    const mine = state.pairs[id] ?? {};
    const list: KendimRevealPair[] = [];
    let total = 0;
    for (const card of cards) {
      const target = has(mine, String(card.id)) ? (mine[String(card.id)] as string) : undefined;
      if (target === undefined) continue;
      const ok = isCorrect(state, card.text, target);
      list.push({ card: card.id, target, ok });
      if (ok) total += KENDIM_RIGHT_POINT;
      if (ok) finders.set(card.id, [...(finders.get(card.id) ?? []), id]);
    }
    pairs[id] = list;
    scores[id] = total;
  }
  // KN-M1: sessiz oyuncu kuralı yok; hiç eşleme yapmasan da kelimeni tek kişi bulursa bonus alırsın.
  const revealCards: KendimRevealCard[] = cards.map((c) => {
    const found = finders.get(c.id) ?? [];
    const bonus = found.length === 1;
    if (bonus) scores[c.owner] = (scores[c.owner] ?? 0) + KENDIM_BONUS_POINT;
    const twin = cards.some((o) => o.id !== c.id && foldKey(o.text) === foldKey(c.text));
    return { id: c.id, text: c.text, owner: c.owner, finders: found, bonus, twin };
  });
  const order = derivedRng(state.seed, "reveal").shuffle(cards.map((c) => c.id));
  return { cards: revealCards, order, pairs, scores, awards: kendimAwards(scores) };
}

function jsonHas(json: string, value: string): boolean {
  return json.includes(value) || json.includes(JSON.stringify(value).slice(1, -1));
}

/** KN-M3: gerçekten tek kelime; boşluklu yazı reddedilir (tire serbest). */
function parseText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = sanitizeWord(raw);
  return text === null || /\s/u.test(text) ? null : text;
}

export const kendim: GameDefinition<KendimState, KendimAction, KendimView, KendimPublicView> = {
  id: "kendim",
  name: "Kendim",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Kelimeleri sahipleriyle eşleştir!",
    steps: [
      "Konu kartına göre kendini tek kelimeyle anlat",
      "Karışık kartları oyuncularla eşleştir",
      "Doğru eşleme +1, yanlış ceza yok",
    ],
  },

  parseAction(raw: unknown): KendimAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    const keys = Object.keys(r);
    switch (r.kind) {
      case "lock":
        return keys.length === 1 ? { kind: "lock" } : null;
      case "write": {
        if (keys.length !== 2) return null;
        const text = parseText(r.text);
        return text === null ? null : { kind: "write", text };
      }
      case "match": {
        if (keys.length !== 3) return null;
        const { card, target } = r;
        if (typeof card !== "number" || !Number.isInteger(card) || card < 0 || card > 64) return null;
        if (target !== null && (typeof target !== "string" || target.length === 0 || target.length > 64)) {
          return null;
        }
        return { kind: "match", card, target };
      }
      default:
        return null;
    }
  },

  setup(players: readonly string[], ctx: GameContext): KendimState {
    const writeEndsAt = ctx.now + KENDIM_WRITE_MS;
    const matchEndsAt = writeEndsAt + kendimMatchMs(players.length);
    // Tohum önce çekilir (kart sırası eski kayıtlarla aynı kalır), konu sonra.
    const seed = drawSeed(ctx.rng);
    const topics = poolEntries(KENDIM_TOPIC_POOL, ctx.content);
    const topic =
      topics.length > 0 ? (topics[ctx.rng.int(topics.length)] ?? KENDIM_DEFAULT_TOPIC) : KENDIM_DEFAULT_TOPIC;
    return {
      players: [...players],
      topic: { topic: topic.topic, hint: topic.hint },
      topicCount: topics.length,
      seed,
      startedAt: ctx.now,
      writeEndsAt,
      matchEndsAt,
      finishAt: matchEndsAt + kendimRevealMs(0),
      stage: "write",
      texts: {},
      writeLocked: [],
      writeClosing: false,
      pairs: {},
      matchLocked: [],
      matchClosing: false,
    };
  },

  reduce(state, playerId, action, ctx): KendimState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (ctx.now >= state.matchEndsAt) return { rejected: "ended" };
    const writing = ctx.now < state.writeEndsAt;

    if (action.kind === "write") {
      if (!writing) return { rejected: "not_writing" };
      if (state.writeLocked.includes(playerId)) return { rejected: "locked" };
      if (state.writeClosing) return { rejected: "closed" };
      if (state.texts[playerId] === action.text) return state;
      return { ...state, texts: { ...state.texts, [playerId]: action.text } };
    }

    if (action.kind === "lock") {
      if (writing) {
        if (state.writeLocked.includes(playerId)) return { rejected: "locked" };
        if (state.writeClosing) return { rejected: "closed" };
        if (!has(state.texts, playerId)) return { rejected: "nothing_to_lock" };
        const writeLocked = [...state.writeLocked, playerId];
        if (!everyoneReady(state, writeLocked, ctx.connected)) return { ...state, writeLocked };
        return {
          ...retime(state, "write", ctx.now + KENDIM_LOCK_GRACE_MS),
          writeLocked,
          writeClosing: true,
        };
      }
      if (state.matchLocked.includes(playerId)) return { rejected: "locked" };
      if (state.matchClosing) return { rejected: "closed" };
      // Hiç eşleştirme yapmamak anlamlıdır: boş Tamam serbest.
      const matchLocked = [...state.matchLocked, playerId];
      if (!everyoneReady(state, matchLocked, ctx.connected)) return { ...state, matchLocked };
      return {
        ...retime(state, "match", ctx.now + KENDIM_LOCK_GRACE_MS),
        matchLocked,
        matchClosing: true,
      };
    }

    // match
    if (writing) return { rejected: "not_matching" };
    if (state.matchLocked.includes(playerId)) return { rejected: "locked" };
    if (state.matchClosing) return { rejected: "closed" };
    const cards = kendimCards(state);
    const card = cards[action.card];
    if (card === undefined) return { rejected: "unknown_card" };
    if (card.owner === playerId) return { rejected: "own_card" };
    const mine = state.pairs[playerId] ?? {};
    const key = String(action.card);
    if (action.target === null) {
      if (!has(mine, key)) return state;
      const { [key]: _drop, ...rest } = mine;
      return { ...state, pairs: { ...state.pairs, [playerId]: rest } };
    }
    if (action.target === playerId) return { rejected: "self_target" };
    if (!state.players.includes(action.target)) return { rejected: "unknown_target" };
    if (!has(state.texts, action.target)) return { rejected: "no_word" };
    if (mine[key] === action.target) return state;
    // Her kişi en çok bir karta eşlenir: aynı kişi başka bir karttaysa oradan alınır.
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(mine)) if (v !== action.target) next[k] = v;
    next[key] = action.target;
    return { ...state, pairs: { ...state.pairs, [playerId]: next } };
  },

  // Aşama değişimi durumu bir kez değiştirir: sunucu değişiklikte yayın yapar, geçişler tam zamanında görünür.
  // Yazma bitince kart sayısı sabitlenir; açılış süresi (kart × 3 sn + 3 sn) bitişe yazılır.
  // Yazma sürerken bitiş değişmez (kaç kişinin yazdığı görünmesin).
  tick(state, ctx): KendimState {
    const stage = stageAt(state, ctx.now);
    const finishAt = stage === "write" ? state.finishAt : finishOf(state, state.matchEndsAt);
    if (stage === state.stage && finishAt === state.finishAt) return state;
    return { ...state, stage, finishAt };
  },

  contentUsed(state) {
    const n = state.topicCount;
    // Havuz 5'ten uzunsa son 5 konu, kısaysa yalnız bir önceki tekrar edilmez.
    const memory = n > KENDIM_TOPIC_MEMORY ? KENDIM_TOPIC_MEMORY : n === KENDIM_TOPIC_MEMORY ? n - 1 : 1;
    return [{ poolId: KENDIM_TOPIC_POOL.id, key: KENDIM_TOPIC_POOL.key(state.topic), memory }];
  },

  publicView(state): KendimPublicView {
    const ready =
      state.stage === "write" ? state.writeLocked : state.stage === "match" ? state.matchLocked : [];
    return {
      players: [...state.players],
      stage: state.stage,
      topic: state.topic.topic,
      hint: state.topic.hint,
      startedAt: state.startedAt,
      writeEndsAt: state.writeEndsAt,
      matchEndsAt: state.matchEndsAt,
      finishAt: state.finishAt,
      ready: [...ready],
      owners: state.stage === "write" ? [] : state.players.filter((id) => has(state.texts, id)),
      // KN-U7: eşleştirmeden itibaren kelime kartları sahipsiz olarak herkese (izleyici ve TV dahil) açıktır.
      cards: state.stage === "write" ? [] : kendimCards(state).map(({ id, text }) => ({ id, text })),
      reveal: state.stage === "reveal" ? buildReveal(state) : null,
    };
  },

  view(state, playerId): KendimView {
    if (playerId === null || !state.players.includes(playerId)) {
      return { myText: null, locked: false, cards: [], myPairs: {} };
    }
    const cards =
      state.stage === "write"
        ? []
        : kendimCards(state)
            .filter((c) => c.owner !== playerId)
            .map(({ id, text }) => ({ id, text }));
    return {
      myText: has(state.texts, playerId) ? (state.texts[playerId] as string) : null,
      locked:
        state.stage === "write"
          ? state.writeLocked.includes(playerId)
          : state.stage === "match"
            ? state.matchLocked.includes(playerId)
            : false,
      cards,
      myPairs: { ...(state.pairs[playerId] ?? {}) },
    };
  },

  /** Sonuç açılışı eşleştirme süresinin bittiği an başlar. */
  revealAt(state): number | null {
    return state.matchEndsAt;
  },

  isFinished(state, ctx): boolean {
    // Kelimeler yazma bitince sabittir: bitiş her zaman kart sayısından hesaplanır (tick beklenmez).
    return ctx.now >= state.matchEndsAt && ctx.now >= finishOf(state, state.matchEndsAt);
  },

  // Kelimeler yazma aşamasında yalnız sahibinde; eşleştirmeden itibaren kartlar herkese (sahipsiz) görünür.
  // Kart-sahip ilişkisi ve eşleştirmeler oyuncu kimlikleridir (kısa): metinle aranamaz, gizlilikleri yapısaldır
  // (kendim.test.ts "gizlilik").
  secrets(state): readonly SecretEntry[] {
    if (state.stage !== "write") return [];
    const entries: SecretEntry[] = [];
    for (const id of state.players) {
      const value = state.texts[id];
      if (value === undefined || value.length < 3) continue;
      // Konu ve ipucu herkese açık: aynı metni taşıyan kelime sızıntı sayılmaz.
      const open = `${state.topic.topic} ${state.topic.hint}`.toLocaleUpperCase("tr-TR");
      if (open.includes(value.toLocaleUpperCase("tr-TR"))) continue;
      const owners = state.players.filter(
        (other) => other === id || jsonHas(JSON.stringify({ t: state.texts[other] ?? null }), value),
      );
      entries.push({ ownerIds: owners, value, label: `${id} kelimesi` });
    }
    return entries;
  },

  result(state) {
    const { scores, awards } = buildReveal(state);
    return { miniScores: { ...scores }, awards: { ...awards } };
  },
};
