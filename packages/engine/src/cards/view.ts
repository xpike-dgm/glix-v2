import { CARDS, type CardId, isCardId } from "./catalog.js";
import type { CardLine, PlayedCard } from "./resolve.js";
import { type CardsState, pickDone } from "./state.js";

/** Herkese açık oynayış (gizli Ayna / Koruma bunda yer almaz). */
export interface PublicPlay {
  playerId: string;
  cardId: CardId;
  target?: string;
  gameId?: string;
  /** Kesinleşirken işleyemedi. */
  void?: true;
}

/** Odadaki herkesin (izleyici ve TV dahil) gördüğü kart bilgisi. */
export interface CardsPublic {
  /** Kart seçimi sürerken: seçimini bitirenler ve bu turu kaçıranlar. */
  phase: { done: string[]; silenced: string[] } | null;
  /** Oyuncu başına eldeki kart SAYISI (kartlar gizlidir). */
  hands: Record<string, number>;
  /** Son aşamada çekilen kötü kartlar. */
  announce: { playerId: string; cardId: CardId }[];
  /** Oyun başında açıklanan kartlar (tetiklenmemiş Ayna / Koruma hariç). */
  plays: PublicPlay[];
  /** Sonuç ekranında: kart etki satırları (tetiklenen Ayna / Koruma dahil). */
  lines: CardLine[];
}

/** Veto / Oyunu Seç için sunulan oyun. */
export interface GameChoice {
  id: string;
  name: string;
}

/** Yalnız sahibine giden kart bilgisi. */
export interface CardsMine {
  hand: CardId[];
  /** Anlatım sırasında: Veto'da çıkarılabilecek ve Oyunu Seç'te seçilebilecek oyunlar (diğer aşamalarda boş). */
  gameOptions: { veto: GameChoice[]; pick: GameChoice[] };
  /** Kart seçimi sürerken kendi durumu. */
  pick: {
    /** Kör Seçim ya da alınmış seçenekler `null`. */
    options: (CardId | null)[];
    blind: boolean;
    /** Alınmış seçenek sıraları. */
    taken: number[];
    /** Kaç seçim hakkı var (1 ya da 2). */
    total: number;
    /** Şimdiye dek seçtiğin kartlar. */
    got: CardId[];
    /** El doluyken seçilen ve değiştirme bekleyen iyi kart. */
    held: CardId | null;
    silenced: boolean;
    done: boolean;
  } | null;
  /** Anlatımda oynanıp henüz kesinleşmemiş kart (geri alınabilir). */
  staged: PlayedCard | null;
  /** Kesinleşmiş, bu oyunda oynadığın kart (gizli olanlar dahil). */
  played: PlayedCard | null;
}

const isPublic = (p: { cardId: CardId }): boolean => !CARDS[p.cardId].hidden;

export function publicCards(state: CardsState, inResults: boolean): CardsPublic {
  const done = pickDone(state);
  return {
    phase: state.picking
      ? {
          done,
          silenced: Object.entries(state.picking)
            .filter(([, ps]) => ps.silenced)
            .map(([id]) => id),
        }
      : null,
    hands: Object.fromEntries(state.players.map((id) => [id, state.by[id]?.hand.length ?? 0])),
    // Kötü kartlar seçim bitene dek açıklanmaz (kimin ne çektiği aşama sürerken sızmasın).
    announce: state.picking ? [] : state.announce.map((a) => ({ ...a })),
    plays: state.plays.filter(isPublic).map((p) => ({
      playerId: p.playerId,
      cardId: p.cardId,
      ...(p.target !== undefined ? { target: p.target } : {}),
      ...(p.gameId !== undefined ? { gameId: p.gameId } : {}),
      ...(p.void ? { void: true as const } : {}),
    })),
    lines: inResults && state.resolved ? state.resolved.lines.map((l) => ({ ...l })) : [],
  };
}

export function mineCards(
  state: CardsState,
  playerId: string,
  gameOptions: CardsMine["gameOptions"] = { veto: [], pick: [] },
): CardsMine | null {
  const pc = state.by[playerId];
  if (!pc) return null;
  const ps = state.picking?.[playerId];
  const staged = state.staged.find((p) => p.playerId === playerId);
  const played = state.plays.find((p) => p.playerId === playerId);
  return {
    hand: [...pc.hand],
    gameOptions,
    pick: ps
      ? {
          options: ps.options.map((c, i) => (ps.blind || ps.taken.includes(i) ? null : c)),
          blind: ps.blind,
          taken: [...ps.taken],
          total: ps.total,
          got: [...ps.got],
          held: ps.held,
          silenced: ps.silenced,
          done: ps.done,
        }
      : null,
    staged: staged ? { ...staged } : null,
    played: played
      ? {
          playerId: played.playerId,
          cardId: played.cardId,
          ...(played.target !== undefined ? { target: played.target } : {}),
          ...(played.gameId !== undefined ? { gameId: played.gameId } : {}),
        }
      : null,
  };
}

// ---------------------------------------------------------------- doğrulama (istemci ağdan okurken)

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length <= 64;
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 64 && v.every(isStr);

function parsePlay(v: unknown): PlayedCard | null {
  if (!isRec(v) || !isStr(v.playerId) || !isCardId(v.cardId)) return null;
  const out: PlayedCard = { playerId: v.playerId, cardId: v.cardId };
  if (v.target !== undefined) {
    if (!isStr(v.target)) return null;
    out.target = v.target;
  }
  if (v.gameId !== undefined) {
    if (!isStr(v.gameId)) return null;
    out.gameId = v.gameId;
  }
  return out;
}

function parseLine(v: unknown): CardLine | null {
  if (!isRec(v) || !isCardId(v.cardId) || !isStr(v.owner) || !isStr(v.subject)) return null;
  if (!isInt(v.before) || !isInt(v.after)) return null;
  const note = v.note;
  if (note !== undefined && note !== "korundu" && note !== "yansidi" && note !== "etkisiz") return null;
  return {
    cardId: v.cardId,
    owner: v.owner,
    subject: v.subject,
    before: v.before,
    after: v.after,
    ...(note !== undefined ? { note } : {}),
  };
}

export function parseCardsPublic(v: unknown): CardsPublic | null {
  if (!isRec(v)) return null;
  let phase: CardsPublic["phase"] = null;
  if (v.phase !== null && v.phase !== undefined) {
    if (!isRec(v.phase) || !isStrArr(v.phase.done) || !isStrArr(v.phase.silenced)) return null;
    phase = { done: v.phase.done, silenced: v.phase.silenced };
  }
  if (!isRec(v.hands)) return null;
  const hands: Record<string, number> = {};
  for (const [k, n] of Object.entries(v.hands)) {
    if (!isInt(n) || n < 0 || n > 8) return null;
    hands[k] = n;
  }
  if (!Array.isArray(v.announce) || !Array.isArray(v.plays) || !Array.isArray(v.lines)) return null;
  if (v.announce.length > 64 || v.plays.length > 64 || v.lines.length > 256) return null;
  const announce: CardsPublic["announce"] = [];
  for (const a of v.announce) {
    if (!isRec(a) || !isStr(a.playerId) || !isCardId(a.cardId)) return null;
    announce.push({ playerId: a.playerId, cardId: a.cardId });
  }
  const plays: PublicPlay[] = [];
  for (const p of v.plays) {
    const pp = parsePlay(p);
    if (!pp || !isRec(p)) return null;
    plays.push({ ...pp, ...(p.void === true ? { void: true as const } : {}) });
  }
  const lines: CardLine[] = [];
  for (const l of v.lines) {
    const ll = parseLine(l);
    if (!ll) return null;
    lines.push(ll);
  }
  return { phase, hands, announce, plays, lines };
}

export function parseCardsMine(v: unknown): CardsMine | null {
  if (!isRec(v) || !Array.isArray(v.hand) || v.hand.length > 8 || !v.hand.every(isCardId)) return null;
  let pick: CardsMine["pick"] = null;
  const p = v.pick;
  if (p !== null && p !== undefined) {
    if (!isRec(p) || !Array.isArray(p.options) || p.options.length > 8) return null;
    if (!p.options.every((c) => c === null || isCardId(c))) return null;
    if (!Array.isArray(p.taken) || !p.taken.every(isInt)) return null;
    if (!isInt(p.total) || !Array.isArray(p.got) || !p.got.every(isCardId)) return null;
    if (p.held !== null && !isCardId(p.held)) return null;
    if (typeof p.blind !== "boolean" || typeof p.silenced !== "boolean" || typeof p.done !== "boolean")
      return null;
    pick = {
      options: p.options as (CardId | null)[],
      blind: p.blind,
      taken: p.taken as number[],
      total: p.total,
      got: p.got as CardId[],
      held: p.held as CardId | null,
      silenced: p.silenced,
      done: p.done,
    };
  }
  const parseChoices = (c: unknown): GameChoice[] | null => {
    if (!Array.isArray(c) || c.length > 64) return null;
    const out: GameChoice[] = [];
    for (const g of c) {
      if (!isRec(g) || !isStr(g.id) || typeof g.name !== "string" || g.name.length > 64) return null;
      out.push({ id: g.id, name: g.name });
    }
    return out;
  };
  const ch = isRec(v.gameOptions)
    ? { veto: parseChoices(v.gameOptions.veto), pick: parseChoices(v.gameOptions.pick) }
    : null;
  if (!ch?.veto || !ch.pick) return null;
  const staged = v.staged === null || v.staged === undefined ? null : parsePlay(v.staged);
  const played = v.played === null || v.played === undefined ? null : parsePlay(v.played);
  if ((v.staged ?? null) !== null && !staged) return null;
  if ((v.played ?? null) !== null && !played) return null;
  return { hand: v.hand as CardId[], gameOptions: { veto: ch.veto, pick: ch.pick }, pick, staged, played };
}
