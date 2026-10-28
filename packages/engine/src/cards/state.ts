import type { Rejected } from "../game.js";
import {
  BASE_OPTIONS,
  CARDS,
  type CardId,
  type CardSettings,
  enabledCards,
  isBadCard,
  MAX_HAND,
  WIDE_OPTIONS,
} from "./catalog.js";
import { deriveRng, drawOptions, halfOf } from "./draw.js";
import { type CardLine, type PlayedCard, type ResolveInput, resolveCards } from "./resolve.js";

/** Kesinleşmiş oynayış; `void`: kesinleşirken işleyemedi (ör. başkası aynı oyunu çıkardı), kart yine yanar. */
export type StatePlay = PlayedCard & { void?: true };

/** Bir oyuncunun maç boyunca taşıdığı kart durumu. */
export interface PlayerCards {
  hand: CardId[];
  /** Sonraki kart seçiminde işleyecek bayraklar (aşama açılırken okunur ve tüketilir). */
  wide: boolean;
  blind: boolean;
  silenced: boolean;
  gamble: boolean;
  boost: boolean;
  /** Sonraki mini oyunun hesabında işleyecek kötü kartlar. */
  pending: CardId[];
}

/** Açık kart seçimi aşamasında bir oyuncunun durumu. */
export interface PickState {
  options: CardId[];
  blind: boolean;
  /** Toplam seçim hakkı (1 ya da Kumarbaz ile 2). */
  total: number;
  /** Seçilmiş seçenek sıraları. */
  taken: number[];
  /** Seçilen kartlar (kötü dahil), seçim sırasıyla; yalnız sahibine gösterilir. */
  got: CardId[];
  /** El doluyken seçilen iyi kart: değiştirme kararı bekler. */
  held: CardId | null;
  silenced: boolean;
  done: boolean;
}

export interface CardsState {
  seed: number;
  /** Kart hakkı olanlar (maç başındaki katılımcılar). */
  players: string[];
  /** Maç başında sabitlenen etkin kartlar. */
  enabled: CardId[];
  /** Kaç kart aşaması açıldı. */
  phaseNo: number;
  by: Record<string, PlayerCards>;
  picking: Record<string, PickState> | null;
  /** Anlatımda oynanmış, henüz kesinleşmemiş kartlar. */
  staged: PlayedCard[];
  /** Bu oyun için kesinleşmiş kartlar. */
  plays: StatePlay[];
  /** Son aşamada çekilen kötü kartlar (herkese açık duyuru). */
  announce: { playerId: string; cardId: CardId }[];
  /** Son kesinleşmede liste (kalan oyunlar); sunucu okur. */
  remaining: string[] | null;
  /** Son oyunun hesabı. */
  resolved: { awards: Record<string, number>; lines: CardLine[] } | null;
  /** Tetiklenip açılan gizli kartlar (son oyun). */
  revealed: PlayedCard[];
}

export function createCardsState(
  seed: number,
  players: readonly string[],
  settings: CardSettings,
): CardsState {
  return {
    seed,
    players: [...players],
    enabled: enabledCards(settings),
    phaseNo: 0,
    by: Object.fromEntries(
      players.map((id) => [
        id,
        { hand: [], wide: false, blind: false, silenced: false, gamble: false, boost: false, pending: [] },
      ]),
    ),
    picking: null,
    staged: [],
    plays: [],
    announce: [],
    remaining: null,
    resolved: null,
    revealed: [],
  };
}

/** Oynama / kesinleştirme bağlamı: sunucunun o anki gerçekleri (olaya yazılır, tekrar oynatma birebir). */
export interface PlayContext {
  participants: string[];
  present: string[];
  /** Henüz oynanmamış sonraki oyunlar (sırayla). */
  remaining: string[];
  /** Oyunu Seç ile seçilebilen oyun kimlikleri. */
  selectable: string[];
}

export type CardEvent =
  | { k: "open"; scores: Record<string, number>; present: string[] }
  | { k: "pick"; p: string; i: number }
  | { k: "discard"; p: string; drop: "new" | number }
  | { k: "close" }
  | { k: "play"; p: string; card: CardId; target?: string; gameId?: string; ctx: PlayContext }
  | { k: "unplay"; p: string }
  | { k: "commit"; ctx: PlayContext }
  | {
      k: "resolve";
      participants: string[];
      present: string[];
      miniScores: Record<string, number>;
      awards: Record<string, number>;
      gameIndex: number;
    };

/** Sunucunun tuttuğu kart kaydı: tohum, ayar ve zaman damgalı olaylar. `replayCards` bunu birebir yeniden kurar. */
export interface CardLog {
  seed: number;
  players: string[];
  settings: CardSettings;
  events: { t: number; event: CardEvent }[];
}

const rejected = (why: string): Rejected => ({ rejected: why });

function fresh(state: CardsState): CardsState {
  return JSON.parse(JSON.stringify(state)) as CardsState;
}

/** Aşamayı açar: bayraklar tüketilir, her oyuncunun seçenekleri çekilir. */
function openPhase(s: CardsState, ev: Extract<CardEvent, { k: "open" }>): void {
  s.phaseNo += 1;
  s.announce = [];
  s.resolved = null;
  const here = s.players.filter((id) => ev.present.includes(id));
  const picking: Record<string, PickState> = {};
  for (const id of here) {
    const pc = s.by[id] as PlayerCards;
    if (pc.silenced) {
      pc.silenced = false;
      picking[id] = {
        options: [],
        blind: false,
        total: 0,
        taken: [],
        got: [],
        held: null,
        silenced: true,
        done: true,
      };
      continue;
    }
    const count = pc.wide ? WIDE_OPTIONS : BASE_OPTIONS;
    const blind = pc.blind;
    const boost = pc.boost;
    const total = pc.gamble ? 2 : 1;
    pc.wide = false;
    pc.blind = false;
    pc.gamble = false;
    pc.boost = false;
    const options = drawOptions(deriveRng(s.seed, "draw", s.phaseNo, id), {
      enabled: s.enabled,
      half: halfOf(id, ev.scores, here),
      boost,
      count,
    });
    picking[id] = {
      options,
      blind,
      total: Math.min(total, options.length),
      taken: [],
      got: [],
      held: null,
      silenced: false,
      done: options.length === 0,
    };
  }
  s.picking = picking;
}

/** Seçilen kartın etkisi: iyi kart ele (ya da değiştirme beklemeye), kötü kart anında. */
function take(s: CardsState, id: string, ps: PickState, card: CardId): void {
  const pc = s.by[id] as PlayerCards;
  ps.got.push(card);
  if (isBadCard(card)) {
    s.announce.push({ playerId: id, cardId: card });
    switch (card) {
      case "bos-el": {
        if (pc.hand.length > 0) {
          const rng = deriveRng(s.seed, "burn", s.phaseNo, id, ps.got.length);
          pc.hand.splice(rng.int(pc.hand.length), 1);
        }
        break;
      }
      case "kor-secim":
        pc.blind = true;
        break;
      case "sessizlik":
        pc.silenced = true;
        break;
      case "kumarbaz":
        pc.gamble = true;
        pc.pending.push(card);
        break;
      case "lanetli-hediye":
        pc.boost = true;
        pc.pending.push(card);
        break;
      default:
        pc.pending.push(card);
    }
  } else if (pc.hand.length < MAX_HAND) pc.hand.push(card);
  else ps.held = card;
  settle(ps);
}

function settle(ps: PickState): void {
  if (ps.held === null && ps.taken.length >= ps.total) ps.done = true;
}

/** Bir olayı uygular; geçersizse `Rejected`. Girdi durum değişmez. */
export function applyCardEvent(state: CardsState, ev: CardEvent): CardsState | Rejected {
  const s = fresh(state);
  switch (ev.k) {
    case "open":
      openPhase(s, ev);
      return s;
    case "pick": {
      const ps = s.picking?.[ev.p];
      if (!ps || ps.done || ps.held !== null) return rejected("not_picking");
      if (!Number.isInteger(ev.i) || ev.i < 0 || ev.i >= ps.options.length || ps.taken.includes(ev.i))
        return rejected("bad_option");
      ps.taken.push(ev.i);
      take(s, ev.p, ps, ps.options[ev.i] as CardId);
      return s;
    }
    case "discard": {
      const ps = s.picking?.[ev.p];
      const pc = s.by[ev.p];
      if (!ps || !pc || ps.held === null) return rejected("not_discarding");
      if (ev.drop !== "new") {
        if (!Number.isInteger(ev.drop) || ev.drop < 0 || ev.drop >= pc.hand.length)
          return rejected("bad_card");
        pc.hand.splice(ev.drop, 1);
        pc.hand.push(ps.held);
      }
      ps.held = null;
      settle(ps);
      return s;
    }
    case "close": {
      const picking = s.picking;
      if (!picking) return rejected("not_picking");
      // Süre doldu: bitirmemiş herkese rastgele seçim; değiştirme bekleyen yeni kartı atar.
      for (const id of s.players) {
        const ps = picking[id];
        if (!ps) continue;
        let guard = 0;
        while (!ps.done && guard++ < 8) {
          if (ps.held !== null) {
            ps.held = null;
            settle(ps);
            continue;
          }
          const free = ps.options.map((_, i) => i).filter((i) => !ps.taken.includes(i));
          if (free.length === 0) {
            ps.done = true;
            break;
          }
          const i = free[
            deriveRng(s.seed, "auto", s.phaseNo, id, ps.taken.length).int(free.length)
          ] as number;
          ps.taken.push(i);
          take(s, id, ps, ps.options[i] as CardId);
        }
      }
      s.picking = null;
      return s;
    }
    case "play": {
      const pc = s.by[ev.p];
      if (!pc || s.picking) return rejected("wrong_phase");
      const c = ev.ctx;
      if (!c.participants.includes(ev.p) || !c.present.includes(ev.p)) return rejected("not_participant");
      if (s.staged.some((x) => x.playerId === ev.p)) return rejected("already_played");
      const at = pc.hand.indexOf(ev.card);
      if (at < 0) return rejected("no_card");
      const def = CARDS[ev.card];
      const play: PlayedCard = { playerId: ev.p, cardId: ev.card };
      switch (def.target) {
        case "none":
          if (ev.target !== undefined || ev.gameId !== undefined) return rejected("bad_target");
          break;
        case "player":
        case "playerOrSelf": {
          const t = ev.target;
          if (ev.gameId !== undefined || t === undefined) return rejected("bad_target");
          if (!c.participants.includes(t) || !c.present.includes(t)) return rejected("bad_target");
          if (def.target === "player" && t === ev.p) return rejected("bad_target");
          play.target = t;
          break;
        }
        case "game": {
          const g = ev.gameId;
          if (ev.target !== undefined || g === undefined) return rejected("bad_target");
          const ok =
            ev.card === "veto"
              ? c.remaining.length >= 2 && c.remaining.includes(g)
              : c.selectable.includes(g) && c.remaining.length >= 1;
          if (!ok) return rejected("bad_game");
          play.gameId = g;
          break;
        }
      }
      pc.hand.splice(at, 1);
      s.staged.push(play);
      return s;
    }
    case "unplay": {
      const at = s.staged.findIndex((x) => x.playerId === ev.p);
      const pc = s.by[ev.p];
      if (at < 0 || !pc) return rejected("nothing_played");
      const [play] = s.staged.splice(at, 1);
      if (play) pc.hand.push(play.cardId);
      return s;
    }
    case "commit": {
      const present = new Set(ev.ctx.present);
      let remaining = [...ev.ctx.remaining];
      let chosen = false;
      s.plays = [];
      s.revealed = [];
      for (const staged of s.staged) {
        const play: StatePlay = { ...staged };
        if (!present.has(play.playerId)) play.void = true;
        else if (play.cardId === "genis-secim") (s.by[play.playerId] as PlayerCards).wide = true;
        else if (play.cardId === "veto") {
          const g = play.gameId;
          if (g !== undefined && remaining.length >= 2 && remaining.includes(g))
            remaining = remaining.filter((x) => x !== g);
          else play.void = true;
        } else if (play.cardId === "oyunu-sec") {
          const g = play.gameId;
          if (!chosen && g !== undefined && remaining.length >= 1 && ev.ctx.selectable.includes(g)) {
            chosen = true;
            remaining = remaining.includes(g)
              ? [g, ...remaining.filter((x) => x !== g)]
              : [g, ...remaining.slice(1)];
          } else play.void = true;
        }
        s.plays.push(play);
      }
      s.staged = [];
      s.remaining = remaining;
      return s;
    }
    case "resolve": {
      const out = resolveCards({
        participants: ev.participants,
        miniScores: ev.miniScores,
        awards: ev.awards,
        ...cardsResolveInput(s, ev),
      });
      for (const id of s.players) {
        const pc = s.by[id] as PlayerCards;
        pc.hand = out.hands[id] ?? pc.hand;
        // Bu oyunun hesabına katılan oyuncuların bekleyen kötü kartları tüketilir.
        if (ev.participants.includes(id)) pc.pending = [];
      }
      s.resolved = { awards: out.awards, lines: out.lines };
      s.revealed = out.revealed;
      s.plays = [];
      s.announce = [];
      return s;
    }
  }
}

/** `resolve` olayının kart hesabına verdiği girdiler (kayıt için de buradan alınır). */
export function cardsResolveInput(
  state: CardsState,
  ev: Pick<Extract<CardEvent, { k: "resolve" }>, "present" | "gameIndex">,
): Omit<ResolveInput, "participants" | "miniScores" | "awards"> {
  const pending: Record<string, CardId[]> = {};
  const hands: Record<string, CardId[]> = {};
  for (const id of state.players) {
    const pc = state.by[id] as PlayerCards;
    pending[id] = [...pc.pending];
    hands[id] = [...pc.hand];
  }
  return {
    present: ev.present,
    plays: state.plays
      .filter((p) => !p.void)
      .map(({ playerId, cardId, target, gameId }) => ({
        playerId,
        cardId,
        ...(target !== undefined ? { target } : {}),
        ...(gameId !== undefined ? { gameId } : {}),
      })),
    pending,
    hands,
    seed: state.seed,
    gameIndex: ev.gameIndex,
  };
}

/** Seçimini bitirmiş (ya da hiç seçeneği/hakkı olmayan) oyuncular. */
export function pickDone(state: CardsState): string[] {
  const picking = state.picking;
  if (!picking) return [];
  return Object.entries(picking)
    .filter(([, ps]) => ps.done)
    .map(([id]) => id);
}

/** Kayıttan durumu yeniden kurar; reddedilen olay kayıtta bulunmamalıdır. */
export function replayCards(log: CardLog): CardsState {
  let state = createCardsState(log.seed, log.players, log.settings);
  for (const { event } of log.events) {
    const next = applyCardEvent(state, event);
    if ("rejected" in next) throw new Error(`replayCards: kayıtlı olay reddedildi (${next.rejected})`);
    state = next;
  }
  return state;
}

/** Sunucu tarafı yardımcı: olayı uygular ve kabul edilirse kayda ekler. */
export class CardRecorder {
  readonly log: CardLog;
  constructor(seed: number, players: readonly string[], settings: CardSettings) {
    this.log = {
      seed,
      players: [...players],
      settings: { enabled: settings.enabled, off: [...settings.off] },
      events: [],
    };
  }
  record(t: number, event: CardEvent): void {
    this.log.events.push({ t, event: JSON.parse(JSON.stringify(event)) as CardEvent });
  }
}
