import { poolEntries } from "../../content.js";
import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import { derivedRng, drawSeed } from "../seeded.js";
import { SOZLUK_POOL, type SozlukEntry } from "./pool.js";
import { bluffDisplayForm, charCount, compareKey } from "./text.js";
import {
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
} from "./types.js";
import { SOZLUK_ENTRIES } from "./words.js";

export { SOZLUK_POOL, type SozlukEntry } from "./pool.js";
export * from "./types.js";
export { SOZLUK_ENTRIES } from "./words.js";

export interface SozlukState {
  players: string[];
  /** Kart karıştırması için kurulumda `ctx.rng`'den alınan tohum (görünümlere girmez). */
  seed: number;
  startedAt: number;
  word: string;
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
  return { realCard, authors, picks: { ...state.picks }, scores: sozlukScores(state) };
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
  name: "Sözlük Blöfü",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Garip kelimenin gerçek anlamını bul, arkadaşlarını kandır!",
    steps: [
      "Kelimeye inandırıcı sahte bir anlam yaz",
      "Karışık anlamlardan gerçeğini seç",
      "Seni seçen her arkadaşın bir puan kazandırır",
    ],
  },

  parseAction(raw: unknown): SozlukAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (r.kind === "lock") return Object.keys(r).length === 1 ? { kind: "lock" } : null;
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
      definition: entry.definition,
      writeEndsAt,
      pickEndsAt,
      finishAt: pickEndsAt + SOZLUK_REVEAL_MS,
      bluffs: {},
      locked: [],
      pickClosing: false,
      picks: {},
      stage: "write",
    };
  },

  reduce(state, playerId, action, ctx): SozlukState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
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
      return { myBluff: null, myCard: null, myPick: null, locked: false };
    }
    const phase = state.stage;
    const cards = phase === "write" ? [] : sozlukCards(state);
    return {
      myBluff: has(state.bluffs, playerId) ? (state.bluffs[playerId] ?? null) : null,
      myCard: cards.find((c) => c.author === playerId)?.id ?? null,
      myPick: has(state.picks, playerId) ? (state.picks[playerId] ?? null) : null,
      locked:
        phase === "write" ? has(state.bluffs, playerId) : phase === "pick" && state.locked.includes(playerId),
    };
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

  result(state) {
    const scores = sozlukScores(state);
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
