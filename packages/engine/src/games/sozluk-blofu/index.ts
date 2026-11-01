import { poolEntries } from "../../content.js";
import {
  type GameContext,
  type GameDefinition,
  LATE_ACTION_GRACE_MS,
  type Rejected,
  type SecretEntry,
} from "../../game.js";
import { derivedRng, drawSeed } from "../seeded.js";
import { SOZLUK_POOL, type SozlukEntry, type SozlukWordType } from "./pool.js";
import { bluffDisplayForm, charCount, compareKey } from "./text.js";
import {
  SOZLUK_CONTENT_MEMORY,
  SOZLUK_KNEW_DELAY_MS,
  SOZLUK_LOCK_GRACE_MS,
  SOZLUK_MAX_LENGTH,
  SOZLUK_MAX_RAW_LENGTH,
  SOZLUK_PICK_MS,
  SOZLUK_REVEAL_MS,
  SOZLUK_WRITE_MS,
  type SozlukAction,
  type SozlukCard,
  type SozlukPhase,
  type SozlukPublicView,
  type SozlukReveal,
  type SozlukView,
  sozlukAwards,
} from "./types.js";
import { SOZLUK_ENTRIES } from "./words.js";

export {
  SOZLUK_DEFINITION_MAX,
  SOZLUK_POOL,
  SOZLUK_WORD_TYPES,
  type SozlukEntry,
  type SozlukWordType,
  sozlukDefinitionProblem,
  sozlukWordType,
} from "./pool.js";
export { bluffDisplayForm } from "./text.js";
export * from "./types.js";
export { SOZLUK_ENTRIES } from "./words.js";

export interface SozlukState {
  players: string[];
  /** Kart karıştırması için kurulumda `ctx.rng`'den alınan tohum (görünümlere girmez). */
  seed: number;
  startedAt: number;
  word: string;
  /** Kelimenin türü (SB-M3); havuzda yoksa null. */
  wordType: SozlukWordType | null;
  /** Tekrar önleme anahtarı (havuzun `key`'i; SB-M2). */
  entryKey: string;
  /** Gerçek tanım (gizli: seçme aşamasına kadar hiçbir görünümde yok). */
  definition: string;
  writeEndsAt: number;
  pickEndsAt: number;
  finishAt: number;
  /** Oyuncu -> gönderilen (temizlenmiş) sahte tanım. Yazmayanın kartı olmaz. */
  bluffs: Record<string, string>;
  /** Seçme aşamasında "Tamam" diyenler. */
  locked: string[];
  pickClosing: boolean;
  /** Oyuncu -> son seçilen kart. */
  picks: Record<string, string>;
  /** Açılışta "Bu kelimeyi biliyordum" diyenler (SB-M7); hiçbir görünüme liste olarak girmez. */
  knew: string[];
  /** Yalnız sunucunun yayın tetiklemesi içindir: tick aşama geçişlerinde durumu bir kez değiştirir. */
  stage: SozlukPhase;
}

interface InternalCard extends SozlukCard {
  /** Sahte kartın sahibi; gerçek kartta null. */
  author: string | null;
}

const has = <T>(rec: Record<string, T>, key: string): boolean => Object.hasOwn(rec, key);

/**
 * Kartlar: gerçek tanım + yazan herkesin sahte tanımı, tohumdan belirli biçimde karıştırılır.
 * Yazma bittikten sonra sabittir (bluffs değişmez); zamanlamadan bağımsızdır.
 */
export function sozlukCards(state: SozlukState): InternalCard[] {
  const items: { text: string; author: string | null }[] = [{ text: state.definition, author: null }];
  for (const id of state.players) {
    const text = has(state.bluffs, id) ? state.bluffs[id] : undefined;
    if (text !== undefined) items.push({ text, author: id });
  }
  return derivedRng(state.seed, "cards")
    .shuffle(items)
    .map((item, i) => ({ id: `k${i + 1}`, text: item.text, author: item.author }));
}

/** Puanlar: gerçeği seçen +1; sahte kartı seçilen her seçim için sahibine +1. */
export function sozlukScores(state: SozlukState): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of state.players) scores[id] = 0;
  const cards = sozlukCards(state);
  for (const id of state.players) {
    const pick = has(state.picks, id) ? state.picks[id] : undefined;
    const card = cards.find((c) => c.id === pick);
    if (!card || card.author === id) continue;
    const owner = card.author ?? id;
    scores[owner] = (scores[owner] ?? 0) + 1;
  }
  return scores;
}

function reveal(state: SozlukState): SozlukReveal {
  const cards = sozlukCards(state);
  const authors: Record<string, string> = {};
  let realCard = "";
  for (const c of cards) {
    if (c.author === null) realCard = c.id;
    else authors[c.id] = c.author;
  }
  const scores = sozlukScores(state);
  return { realCard, authors, picks: { ...state.picks }, scores, awards: sozlukAwards(scores) };
}

function stageAt(state: SozlukState, now: number): SozlukPhase {
  if (now >= state.pickEndsAt) return "reveal";
  return now >= state.writeEndsAt ? "pick" : "write";
}

function jsonHas(json: string, value: string): boolean {
  return json.includes(value) || json.includes(JSON.stringify(value).slice(1, -1));
}

export const sozlukBlofu: GameDefinition<SozlukState, SozlukAction, SozlukView, SozlukPublicView> = {
  id: "sozluk-blofu",
  graceMs: LATE_ACTION_GRACE_MS,
  name: "Sözlük Blöfü",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Garip kelimenin gerçek anlamını bul, arkadaşlarını kandır!",
    steps: [
      "Garip kelimeye inandırıcı sahte bir anlam yaz",
      "Karışık anlamlardan gerçeğini seç: bulursan +1",
      "Senin blöfünü seçen her kişi +1 kazandırır; en çok puanlayan +2",
    ],
  },

  parseAction(raw: unknown): SozlukAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (r.kind === "lock") return Object.keys(r).length === 1 ? { kind: "lock" } : null;
    if (r.kind === "knew") {
      if (Object.keys(r).length !== 2 || typeof r.on !== "boolean") return null;
      return { kind: "knew", on: r.on };
    }
    if (r.kind === "bluff") {
      if (Object.keys(r).length !== 2) return null;
      const text = r.text;
      if (typeof text !== "string" || text.length > SOZLUK_MAX_RAW_LENGTH) return null;
      return { kind: "bluff", text };
    }
    if (r.kind === "pick") {
      if (Object.keys(r).length !== 2) return null;
      const card = r.card;
      if (typeof card !== "string" || card.length === 0 || card.length > 16) return null;
      return { kind: "pick", card };
    }
    return null;
  },

  setup(players: readonly string[], ctx: GameContext): SozlukState {
    const pool = poolEntries(SOZLUK_POOL, ctx.content);
    const entry = pool[ctx.rng.int(pool.length)] as SozlukEntry;
    const writeEndsAt = ctx.now + SOZLUK_WRITE_MS;
    const pickEndsAt = writeEndsAt + SOZLUK_PICK_MS;
    return {
      players: [...players],
      seed: drawSeed(ctx.rng),
      startedAt: ctx.now,
      word: entry.word.toLocaleUpperCase("tr-TR"),
      wordType: entry.type ?? null,
      entryKey: SOZLUK_POOL.key(entry),
      definition: entry.definition,
      writeEndsAt,
      pickEndsAt,
      finishAt: pickEndsAt + SOZLUK_REVEAL_MS,
      bluffs: {},
      locked: [],
      pickClosing: false,
      picks: {},
      knew: [],
      stage: "write",
    };
  },

  reduce(state, playerId, action, ctx): SozlukState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (action.kind === "knew") {
      // Açılış başladıktan 1,5 sn sonra; oyuncu başına bir kez sayılır, geri alınabilir. Puanı etkilemez.
      if (ctx.now < state.pickEndsAt + SOZLUK_KNEW_DELAY_MS) return { rejected: "not_yet" };
      const already = state.knew.includes(playerId);
      if (already === action.on) return state;
      return {
        ...state,
        knew: action.on ? [...state.knew, playerId] : state.knew.filter((id) => id !== playerId),
      };
    }
    if (ctx.now >= state.pickEndsAt) return { rejected: "ended" };
    const everyoneIn = (done: (id: string) => boolean): boolean => {
      const active = state.players.filter((id) => ctx.connected.includes(id));
      return active.length > 0 && active.every(done);
    };

    if (action.kind === "bluff") {
      if (ctx.now >= state.writeEndsAt) return { rejected: "not_writing" };
      if (has(state.bluffs, playerId)) return { rejected: "already_written" };
      const text = bluffDisplayForm(action.text);
      if (text === "") return { rejected: "empty" };
      if (charCount(text) > SOZLUK_MAX_LENGTH) return { rejected: "too_long" };
      // Gerçek tanımın aynısı yazılırsa kart ikilenir ve gerçek ele verilir: dostça reddedilir.
      if (compareKey(text) === compareKey(state.definition)) return { rejected: "same_as_real" };
      const bluffs = { ...state.bluffs, [playerId]: text };
      if (!everyoneIn((id) => has(bluffs, id))) return { ...state, bluffs };
      // Bağlı herkes yazdı: yazma 1 sn sonra biter (seçme süresi aynı kalır).
      const writeEndsAt = Math.min(state.writeEndsAt, ctx.now + SOZLUK_LOCK_GRACE_MS);
      const pickEndsAt = writeEndsAt + SOZLUK_PICK_MS;
      return { ...state, bluffs, writeEndsAt, pickEndsAt, finishAt: pickEndsAt + SOZLUK_REVEAL_MS };
    }

    if (ctx.now < state.writeEndsAt) return { rejected: "not_picking_yet" };
    if (state.locked.includes(playerId)) return { rejected: "locked" };
    if (state.pickClosing) return { rejected: "closed" };

    if (action.kind === "lock") {
      if (!has(state.picks, playerId)) return { rejected: "nothing_to_lock" };
      const locked = [...state.locked, playerId];
      if (!everyoneIn((id) => locked.includes(id))) return { ...state, locked };
      const pickEndsAt = Math.min(state.pickEndsAt, ctx.now + SOZLUK_LOCK_GRACE_MS);
      return { ...state, locked, pickClosing: true, pickEndsAt, finishAt: pickEndsAt + SOZLUK_REVEAL_MS };
    }

    const card = sozlukCards(state).find((c) => c.id === action.card);
    if (!card) return { rejected: "unknown_card" };
    if (card.author === playerId) return { rejected: "own_card" };
    if ((has(state.picks, playerId) ? state.picks[playerId] : undefined) === card.id) return state;
    return { ...state, picks: { ...state.picks, [playerId]: card.id } };
  },

  // Aşama geçişleri durumu bir kez değiştirir: sunucu değişiklikte yayın yapar, geçişler tam zamanında görünür.
  tick(state, ctx): SozlukState {
    const stage = stageAt(state, ctx.now);
    return stage === state.stage ? state : { ...state, stage };
  },

  publicView(state): SozlukPublicView {
    const phase = state.stage;
    return {
      players: [...state.players],
      phase,
      word: state.word,
      wordType: state.wordType,
      startedAt: state.startedAt,
      writeEndsAt: state.writeEndsAt,
      pickEndsAt: state.pickEndsAt,
      finishAt: state.finishAt,
      ready:
        phase === "write"
          ? state.players.filter((id) => has(state.bluffs, id))
          : phase === "pick"
            ? [...state.locked]
            : [],
      cards: phase === "write" ? null : sozlukCards(state).map(({ id, text }) => ({ id, text })),
      reveal: phase === "reveal" ? reveal(state) : null,
    };
  },

  view(state, playerId): SozlukView {
    if (playerId === null || !state.players.includes(playerId)) {
      return { myBluff: null, myCard: null, myPick: null, locked: false, myKnew: false };
    }
    const phase = state.stage;
    const cards = phase === "write" ? [] : sozlukCards(state);
    return {
      myBluff: has(state.bluffs, playerId) ? (state.bluffs[playerId] ?? null) : null,
      myCard: cards.find((c) => c.author === playerId)?.id ?? null,
      myPick: has(state.picks, playerId) ? (state.picks[playerId] ?? null) : null,
      locked:
        phase === "write" ? has(state.bluffs, playerId) : phase === "pick" && state.locked.includes(playerId),
      myKnew: state.knew.includes(playerId),
    };
  },

  /** Sonuç açılışı seçme süresinin bittiği an başlar. */
  revealAt(state): number | null {
    return state.pickEndsAt;
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.finishAt;
  },

  // Yazma aşamasında gerçek tanım hiç kimsenin, her sahte tanım yalnız sahibinin görünümündedir. Seçme aşamasından
  // itibaren metinler kartlarda herkese açıktır; gizli kalan şey kart-sahip eşleşmesi ve gerçek kartın numarasıdır
  // (kısa kimlikler: metin araması koruyamaz, bkz. sozluk-blofu.test.ts "gizlilik").
  secrets(state): readonly SecretEntry[] {
    if (state.stage !== "write") return [];
    const entries: SecretEntry[] = [{ ownerIds: [], value: state.definition, label: "gerçek tanım" }];
    for (const id of state.players) {
      const value = has(state.bluffs, id) ? state.bluffs[id] : undefined;
      // Çok kısa tanımlar alt dizgi sızıntı denetimine uygun değildir; yapısal testlerle korunur.
      if (value === undefined || value.length < 3) continue;
      // Başkasının kendi tanımı bunu içeriyorsa (aynı ya da daha uzun yazdıysa) onun da görmeye hakkı var.
      const owners = state.players.filter((other) => {
        const mine = has(state.bluffs, other) ? state.bluffs[other] : undefined;
        return other === id || (mine !== undefined && jsonHas(JSON.stringify({ myBluff: mine }), value));
      });
      entries.push({ ownerIds: owners, value, label: `${id} sahte tanımı` });
    }
    return entries;
  },

  /** Blöf puanı mini puandır; genel skora sıralama ödülü gider (SB-M1). */
  result(state) {
    const scores = sozlukScores(state);
    return { miniScores: { ...scores }, awards: sozlukAwards(scores) };
  },

  contentUsed(state) {
    return [{ poolId: SOZLUK_POOL.id, key: state.entryKey, memory: SOZLUK_CONTENT_MEMORY }];
  },

  contentFeedback(state) {
    return [{ poolId: SOZLUK_POOL.id, key: state.entryKey, knew: state.knew.length }];
  },
};
