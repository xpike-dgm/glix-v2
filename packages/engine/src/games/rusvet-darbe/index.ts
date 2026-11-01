import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { everyoneReady } from "../ready.js";
import { derivedRng, drawSeed } from "../seeded.js";
import {
  type Allocation,
  type DuelHand,
  PLEDGES,
  type Pledge,
  RUSVET_COUP_MS,
  RUSVET_CROWN_MS,
  RUSVET_GIVE_MS,
  RUSVET_LOCK_GRACE_MS,
  RUSVET_MAX_HANDS,
  RUSVET_MAX_PER_PLAYER,
  RUSVET_PRESIDENT_SCORE,
  RUSVET_REVEAL_MS,
  RUSVET_RUNOFF_FROM,
  RUSVET_RUNOFF_MS,
  RUSVET_SIGN_MS,
  RUSVET_SIGN_REVEAL_MS,
  type RusvetAction,
  type RusvetCoupResult,
  type RusvetLedger,
  type RusvetPhase,
  type RusvetPledgeVerdict,
  type RusvetPublicView,
  type RusvetReveal,
  type RusvetView,
  rusvetVoteMs,
  SIGNS,
  type Sign,
} from "./types.js";

export * from "./types.js";

type Stage = RusvetPhase;

export interface RusvetState {
  players: string[];
  /** Rastgele doldurma için `ctx.rng`'den kurulumda alınan tohum (görünümlere girmez). */
  seed: number;
  startedAt: number;
  /** Oylama bitişi; herkes kilitleyince reduce'ta öne çekilir. */
  voteEndsAt: number;
  /** Oylamada "Tamam" diyenler; herkes kilitlediyse `voteClosing` olur. */
  votesLocked: string[];
  voteClosing: boolean;
  stage: Stage;
  /** Oyuncu -> son verilen başkanlık oyu (gizli). */
  votes: Record<string, string>;
  /** RD-M3: asılı vaatler (herkese açık; seçim bitince kilitlenir). */
  pledges: Record<string, Pledge>;
  /** Seçim bitince kurulur: eksik oylar tamamlanmış hâli. */
  finalVotes: Record<string, string> | null;
  /** RD-M5: seçim bitince oyu rastgele atananlar (oy vermeyenler). */
  randomVoters: string[];
  /**
   * RD-M6: bağlantısı kopuk katılımcılar. Yalnız `setup` ve `onPresence` (bağlantı kaydı) yazar; böylece `tick`
   * `ctx.connected`'a bakmadan kopan başkanın jetonlarını seçmenlerine verir ve kayıttan tekrar oynatma birebir kalır.
   */
  offline: string[];
  /** RD-M4: ikinci oylama yapıldı mı; bitişi, oyları (gizli), kilitleyenler ve kapanış. */
  runoffHeld: boolean;
  runoffEndsAt: number;
  runoffVotes: Record<string, string>;
  runoffLocked: string[];
  runoffClosing: boolean;
  /** Seçimde alınan oy sayıları (seçim bitince). */
  counts: Record<string, number> | null;
  /** Dağıtılacak jeton sayısı (başkanın aldığı oy). */
  budget: number;
  president: string | null;
  /** Düello: başlamış el sayısı, adaylar, elin başlangıcı, işaretler ve işaretlerin kapandığı. */
  hand: number;
  candidates: string[];
  handStartedAt: number;
  signs: Record<string, Sign>;
  handClosed: boolean;
  /** Herkes işaret verdiyse elin işaret bitişi (reduce'ta yazılır); yoksa null. */
  handSignEnd: number | null;
  hands: DuelHand[];
  /** RD-U7: başkanın belli olduğu an ("Başkan seçildi" anı bu andan `giveStartedAt`'e kadar sürer). */
  electedAt: number;
  /** Dağıtım: başlangıç (taç anından sonra), bitiş ve başkanın son dağıtımı (gizli; başkandan başkasına açılmaz). */
  giveStartedAt: number;
  giveEndsAt: number;
  /** Başkan "Bitti" dediyse true: dağıtım kesinleşmiştir, `giveEndsAt` öne çekilmiştir. */
  giveLocked: boolean;
  tokens: Record<string, number>;
  /** Dağıtım bitince kurulur: kalan jetonlar rastgele tamamlanmış hâli. */
  finalTokens: Record<string, number> | null;
  /** RD-M5: dağıtım bitince rastgele (ya da kopan başkanda seçmenlerine) giden jetonlar. */
  randomTokens: Record<string, number>;
  /** RD-M6: kalan jetonlar kopan başkanın seçmenlerine öncelikle gitti. */
  offlineRefill: boolean;
  /** Darbe aşaması: oy hakkı olanlar (jeton almayan, başkan olmayan), başlangıç ve bitiş. */
  coupEligible: string[];
  coupStartedAt: number;
  coupEndsAt: number;
  /** Oyuncu -> darbe oyu (gizli; sonuç açılırken yalnız sayı açılır). */
  coupVotes: Record<string, boolean>;
  finishAt: number | null;
}

/** Darbe tutar mı: oy hakkı olanların kesin çoğunluğu (yarıdan fazlası) "Darbe" demeli; eşitlik çoğunluk değildir. */
export function coupSucceeds(eligible: readonly string[], votes: Record<string, boolean>): boolean {
  const yes = eligible.filter((id) => own(votes, id) === true).length;
  return yes * 2 > eligible.length;
}

/** Elin işaret bitişi: herkes işaret verdiyse erken. */
const signEndOf = (s: RusvetState): number => s.handSignEnd ?? s.handStartedAt + RUSVET_SIGN_MS;

const own = <T>(rec: Record<string, T>, id: string): T | undefined =>
  Object.hasOwn(rec, id) ? rec[id] : undefined;

/** Eksik oyları, kendisi dışındaki rastgele bir katılımcıyla tamamlar (tohumdan, belirli). */
export function rusvetFillVotes(
  players: readonly string[],
  seed: number,
  votes: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of players) {
    const v = own(votes, id);
    if (v !== undefined && v !== id && players.includes(v)) {
      out[id] = v;
      continue;
    }
    const others = players.filter((p) => p !== id);
    out[id] = others[derivedRng(seed, "vote", id).int(others.length)] as string;
  }
  return out;
}

/** RD-M5: oyu rastgele atanacak (oy vermemiş ya da geçersiz oy vermiş) oyuncular. */
export function rusvetRandomVoters(players: readonly string[], votes: Record<string, string>): string[] {
  return players.filter((id) => {
    const v = own(votes, id);
    return !(v !== undefined && v !== id && players.includes(v));
  });
}

export function rusvetCounts(
  players: readonly string[],
  votes: Record<string, string>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of players) counts[id] = 0;
  for (const id of players) {
    const to = own(votes, id);
    if (to !== undefined && Object.hasOwn(counts, to)) counts[to] = (counts[to] ?? 0) + 1;
  }
  return counts;
}

/** `a` işareti `b` işaretini yener mi: taş makası, makas kâğıdı, kâğıt taşı. */
export function signBeats(a: Sign, b: Sign): boolean {
  return (a === "tas" && b === "makas") || (a === "makas" && b === "kagit") || (a === "kagit" && b === "tas");
}

function fillSigns(seed: number, hand: number, candidates: readonly string[], signs: Record<string, Sign>) {
  const out: Record<string, Sign> = {};
  for (const id of candidates) {
    const given = own(signs, id);
    out[id] = given ?? (SIGNS[derivedRng(seed, "sign", hand, id).int(SIGNS.length)] as Sign);
  }
  return out;
}

/**
 * Bir elin sonucu. Tam iki farklı işaret varsa kazanan işareti verenler devam eder; tek ya da üç işaret varsa
 * sonuç yok sayılır ve el tekrarlanır (adayların hepsi devam eder).
 */
export function resolveHand(candidates: readonly string[], signs: Record<string, Sign>): DuelHand {
  const used = [...new Set(candidates.map((id) => signs[id] as Sign))];
  const x = used[0];
  const y = used[1];
  let advance = [...candidates];
  let replay = true;
  if (used.length === 2 && x !== undefined && y !== undefined) {
    const winner = signBeats(x, y) ? x : y;
    advance = candidates.filter((id) => signs[id] === winner);
    replay = false;
  }
  return { candidates: [...candidates], signs: { ...signs }, advance, replay };
}

/**
 * Kalan jetonları, kişi başı sınıra uyarak rastgele dağıtır (tohumdan, belirli). Başkan kendine veremez.
 * RD-M6: `first` verilirse (kopan başkanın seçmenleri) kalan jetonlar önce onlara sırayla birer birer gider.
 */
export function rusvetFillTokens(
  players: readonly string[],
  seed: number,
  president: string,
  budget: number,
  tokens: Record<string, number>,
  first: readonly string[] = [],
): Record<string, number> {
  const out: Record<string, number> = {};
  let given = 0;
  for (const id of players) {
    const n = id === president ? 0 : Math.min(RUSVET_MAX_PER_PLAYER, Math.max(0, own(tokens, id) ?? 0));
    out[id] = n;
    given += n;
  }
  for (const id of first) {
    if (given >= budget) break;
    if (id === president || !players.includes(id) || (out[id] ?? 0) >= RUSVET_MAX_PER_PLAYER) continue;
    out[id] = (out[id] ?? 0) + 1;
    given++;
  }
  let k = 0;
  while (given < budget) {
    const open = players.filter((id) => id !== president && (out[id] ?? 0) < RUSVET_MAX_PER_PLAYER);
    if (open.length === 0) break;
    const pick = open[derivedRng(seed, "token", k++).int(open.length)] as string;
    out[pick] = (out[pick] ?? 0) + 1;
    given++;
  }
  return out;
}

/** Başkana kendi eliyle oy verenler (ilk tur; rastgele düşenler hariç). */
function handVotersOf(s: RusvetState, president: string): string[] {
  const fv = s.finalVotes ?? {};
  return s.players.filter((id) => own(fv, id) === president && !s.randomVoters.includes(id));
}

/** RD-M3: vaat tuttu mu (son dağılıma göre). */
export function rusvetPledgeKept(
  pledge: Pledge,
  players: readonly string[],
  president: string,
  budget: number,
  handVoters: readonly string[],
  tokens: Record<string, number>,
): boolean {
  if (pledge === "voters") return handVoters.every((id) => (own(tokens, id) ?? 0) >= 1);
  const receivers = players.filter((id) => id !== president && (own(tokens, id) ?? 0) > 0).length;
  return receivers >= Math.min(budget, players.length - 1);
}

/** Başkan belli oldu: önce "Başkan seçildi" anı (RD-U7), dağıtım süresi onun bitiminden sayılır. */
function toGive(s: RusvetState, at: number, president: string): RusvetState {
  return {
    ...s,
    stage: "give",
    president,
    electedAt: at,
    giveStartedAt: at + RUSVET_CROWN_MS,
    giveEndsAt: at + RUSVET_CROWN_MS + RUSVET_GIVE_MS,
  };
}

/** Eşit adaylarla düello başlatır. */
function toDuel(s: RusvetState, at: number, candidates: string[]): RusvetState {
  return {
    ...s,
    stage: "duel",
    hand: 1,
    candidates,
    handStartedAt: at,
    signs: {},
    handClosed: false,
    handSignEnd: null,
  };
}

/** RD-M4: ikinci oylamanın sonucu: oy vermeyen sayılmaz; kimse oy vermezse bütün adaylar. */
export function rusvetRunoffLeaders(candidates: readonly string[], votes: Record<string, string>): string[] {
  const counts: Record<string, number> = {};
  for (const id of candidates) counts[id] = 0;
  for (const to of Object.values(votes)) if (Object.hasOwn(counts, to)) counts[to] = (counts[to] ?? 0) + 1;
  const top = Math.max(...candidates.map((id) => counts[id] ?? 0));
  if (top === 0) return [...candidates];
  return candidates.filter((id) => counts[id] === top);
}

/** Zamana göre ilerletir; saftır ve mantıksal zamanla çalışır (tick sıklığından bağımsız). */
function advance(state: RusvetState, now: number): RusvetState {
  let s = state;
  for (;;) {
    if (s.stage === "vote") {
      if (now < s.voteEndsAt) return s;
      const finalVotes = rusvetFillVotes(s.players, s.seed, s.votes);
      const randomVoters = rusvetRandomVoters(s.players, s.votes);
      const counts = rusvetCounts(s.players, finalVotes);
      const top = Math.max(...s.players.map((id) => counts[id] ?? 0));
      const leaders = s.players.filter((id) => counts[id] === top);
      s = { ...s, finalVotes, randomVoters, counts, budget: top };
      const only = leaders[0];
      if (leaders.length === 1 && only !== undefined) {
        s = toGive(s, s.voteEndsAt, only);
      } else if (leaders.length >= RUSVET_RUNOFF_FROM) {
        s = {
          ...s,
          stage: "runoff",
          candidates: leaders,
          runoffHeld: true,
          runoffEndsAt: s.voteEndsAt + RUSVET_RUNOFF_MS,
        };
      } else {
        s = toDuel(s, s.voteEndsAt, leaders);
      }
    } else if (s.stage === "runoff") {
      if (now < s.runoffEndsAt) return s;
      const leaders = rusvetRunoffLeaders(s.candidates, s.runoffVotes);
      const only = leaders[0];
      s =
        leaders.length === 1 && only !== undefined
          ? toGive(s, s.runoffEndsAt, only)
          : toDuel(s, s.runoffEndsAt, leaders);
    } else if (s.stage === "duel") {
      const signEnd = signEndOf(s);
      const revealEnd = signEnd + RUSVET_SIGN_REVEAL_MS;
      if (!s.handClosed) {
        if (now < signEnd) return s;
        s = { ...s, handClosed: true, signs: fillSigns(s.seed, s.hand, s.candidates, s.signs) };
      } else {
        if (now < revealEnd) return s;
        const done = resolveHand(s.candidates, s.signs);
        const hands = [...s.hands, done];
        const next = done.advance;
        const last = next[0];
        if (next.length === 1 && last !== undefined) {
          s = toGive({ ...s, hands }, revealEnd, last);
        } else if (s.hand >= RUSVET_MAX_HANDS) {
          const pick = next[derivedRng(s.seed, "president").int(next.length)] as string;
          s = toGive({ ...s, hands }, revealEnd, pick);
        } else {
          s = {
            ...s,
            hands,
            hand: s.hand + 1,
            candidates: next,
            handStartedAt: revealEnd,
            signs: {},
            handClosed: false,
            handSignEnd: null,
          };
        }
      }
    } else if (s.stage === "give") {
      if (now < s.giveEndsAt) return s;
      const president = s.president as string;
      // RD-M6: başkan kopuk ve Bitti dememişse kalan jetonlar önce ona gerçekten oy verenlere birer birer.
      const offlineRefill = !s.giveLocked && s.offline.includes(president);
      const first = offlineRefill ? handVotersOf(s, president) : [];
      const finalTokens = rusvetFillTokens(s.players, s.seed, president, s.budget, s.tokens, first);
      const randomTokens: Record<string, number> = {};
      for (const id of s.players) {
        const mine =
          id === president ? 0 : Math.min(RUSVET_MAX_PER_PLAYER, Math.max(0, own(s.tokens, id) ?? 0));
        const extra = (own(finalTokens, id) ?? 0) - mine;
        if (extra > 0) randomTokens[id] = extra;
      }
      s = { ...s, randomTokens, offlineRefill };
      const coupEligible = s.players.filter((id) => id !== president && (own(finalTokens, id) ?? 0) === 0);
      if (coupEligible.length === 0) {
        // Oy hakkı olan yok: darbe aşaması atlanır.
        s = {
          ...s,
          stage: "reveal",
          finalTokens,
          coupEligible,
          coupStartedAt: s.giveEndsAt,
          coupEndsAt: s.giveEndsAt,
          finishAt: s.giveEndsAt + RUSVET_REVEAL_MS,
        };
      } else {
        s = {
          ...s,
          stage: "coup",
          finalTokens,
          coupEligible,
          coupStartedAt: s.giveEndsAt,
          coupEndsAt: s.giveEndsAt + RUSVET_COUP_MS,
        };
      }
    } else if (s.stage === "coup") {
      if (now < s.coupEndsAt) return s;
      s = { ...s, stage: "reveal", finishAt: s.coupEndsAt + RUSVET_REVEAL_MS };
    } else {
      return s;
    }
  }
}

function scoresOf(s: RusvetState): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of s.players) scores[id] = (s.finalTokens ? own(s.finalTokens, id) : 0) ?? 0;
  if (s.president !== null && !coupResultOf(s)?.success)
    scores[s.president] = (scores[s.president] ?? 0) + RUSVET_PRESIDENT_SCORE;
  return scores;
}

/** Darbe oylamasının sonucu (aşama bittiyse); oy hakkı olan yoksa ya da henüz bitmediyse null. */
function coupResultOf(s: RusvetState): RusvetCoupResult | null {
  if (s.stage !== "reveal" || s.coupEligible.length === 0) return null;
  return {
    eligible: [...s.coupEligible],
    yes: s.coupEligible.filter((id) => own(s.coupVotes, id) === true).length,
    success: coupSucceeds(s.coupEligible, s.coupVotes),
  };
}

function pledgeVerdictOf(s: RusvetState): RusvetPledgeVerdict | null {
  if (s.president === null || !s.finalTokens) return null;
  const pledge = own(s.pledges, s.president);
  if (pledge === undefined) return null;
  const kept = rusvetPledgeKept(
    pledge,
    s.players,
    s.president,
    s.budget,
    handVotersOf(s, s.president),
    s.finalTokens,
  );
  return { pledge, kept, timedOut: !s.giveLocked };
}

function span(s: RusvetState): [number, number] {
  switch (s.stage) {
    case "vote":
      return [s.startedAt, s.voteEndsAt];
    case "runoff":
      return [s.voteEndsAt, s.runoffEndsAt];
    case "duel": {
      const signEnd = signEndOf(s);
      return s.handClosed ? [signEnd, signEnd + RUSVET_SIGN_REVEAL_MS] : [s.handStartedAt, signEnd];
    }
    case "give":
      return [s.giveStartedAt, s.giveEndsAt];
    case "coup":
      return [s.coupStartedAt, s.coupEndsAt];
    default:
      return [s.coupEndsAt, s.finishAt ?? s.coupEndsAt];
  }
}

/** Aşamadaki hazır oyuncular (yalnız kimler; seçimler değil). */
function readyOf(s: RusvetState): string[] {
  if (s.stage === "vote") return [...s.votesLocked];
  if (s.stage === "runoff") return [...s.runoffLocked];
  if (s.stage === "duel") return s.candidates.filter((id) => own(s.signs, id) !== undefined);
  if (s.stage === "give" && s.giveLocked && s.president !== null) return [s.president];
  if (s.stage === "coup") return s.coupEligible.filter((id) => own(s.coupVotes, id) !== undefined);
  return [];
}

function allocationList(tokens: Record<string, number>, players: readonly string[]): Allocation[] {
  return players.flatMap((to) => {
    const n = own(tokens, to) ?? 0;
    return n > 0 ? [{ to, n }] : [];
  });
}

/** Sırası korunarak iki kimlik listesi aynı mı. */
const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, i) => b[i] === id);

/** RD-U8: son elde de eşitlik kalırsa kurayla seçilecek başkan (`advance` ile aynı hesap). */
function lotteryOf(s: RusvetState): string | null {
  if (s.stage !== "duel" || !s.handClosed || s.hand < RUSVET_MAX_HANDS) return null;
  const next = resolveHand(s.candidates, s.signs).advance;
  if (next.length < 2) return null;
  return next[derivedRng(s.seed, "president").int(next.length)] ?? null;
}

function ledgerOf(s: RusvetState, president: string): RusvetLedger {
  const fv = s.finalVotes ?? {};
  return {
    voters: handVotersOf(s, president),
    random: s.players.filter((id) => own(fv, id) === president && s.randomVoters.includes(id)),
  };
}

export const rusvetDarbe: GameDefinition<RusvetState, RusvetAction, RusvetView, RusvetPublicView> = {
  id: "rusvet-darbe",
  name: "Rüşvet ve Darbe",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Başkan ol, jetonları dağıt!",
    steps: [
      "Gizli oy ver: en çok oy alan başkan olur",
      "Başkan, aldığı oy kadar jeton dağıtır (kişiye en çok 2)",
      "Jeton alamayanlar darbe yaparsa başkanın puanı gider",
    ],
  },

  parseAction(raw: unknown): RusvetAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    const keys = Object.keys(r);
    if (r.kind === "vote") {
      if (keys.length !== 2) return null;
      const target = r.target;
      if (typeof target !== "string" || target.length === 0 || target.length > 64) return null;
      return { kind: "vote", target };
    }
    if (r.kind === "pledge") {
      if (keys.length !== 2 || !keys.includes("pledge")) return null;
      if (r.pledge === null) return { kind: "pledge", pledge: null };
      const pledge = PLEDGES.find((x) => x === r.pledge);
      return pledge === undefined ? null : { kind: "pledge", pledge };
    }
    if (r.kind === "sign") {
      if (keys.length !== 2) return null;
      const sign = SIGNS.find((x) => x === r.sign);
      return sign === undefined ? null : { kind: "sign", sign };
    }
    if (r.kind === "coup") {
      return keys.length === 2 && typeof r.yes === "boolean" ? { kind: "coup", yes: r.yes } : null;
    }
    if (r.kind === "lock") return keys.length === 1 ? { kind: "lock" } : null;
    if (r.kind === "give") {
      if (keys.length !== 2 || !Array.isArray(r.tokens) || r.tokens.length > 8) return null;
      const seen = new Set<string>();
      const tokens: Allocation[] = [];
      for (const item of r.tokens as unknown[]) {
        if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
        const a = item as Record<string, unknown>;
        if (Object.keys(a).length !== 2) return null;
        const { to, n } = a;
        if (typeof to !== "string" || to.length === 0 || to.length > 64 || seen.has(to)) return null;
        if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > RUSVET_MAX_PER_PLAYER) return null;
        seen.add(to);
        tokens.push({ to, n });
      }
      return { kind: "give", tokens };
    }
    return null;
  },

  setup(players: readonly string[], ctx: GameContext): RusvetState {
    return {
      players: [...players],
      seed: drawSeed(ctx.rng),
      startedAt: ctx.now,
      voteEndsAt: ctx.now + rusvetVoteMs(players.length),
      votesLocked: [],
      voteClosing: false,
      stage: "vote",
      votes: {},
      pledges: {},
      finalVotes: null,
      randomVoters: [],
      offline: players.filter((id) => !ctx.connected.includes(id)),
      runoffHeld: false,
      runoffEndsAt: 0,
      runoffVotes: {},
      runoffLocked: [],
      runoffClosing: false,
      counts: null,
      budget: 0,
      president: null,
      hand: 0,
      candidates: [],
      handStartedAt: 0,
      signs: {},
      handClosed: false,
      handSignEnd: null,
      hands: [],
      electedAt: 0,
      giveStartedAt: 0,
      giveEndsAt: 0,
      giveLocked: false,
      tokens: {},
      finalTokens: null,
      randomTokens: {},
      offlineRefill: false,
      coupEligible: [],
      coupStartedAt: 0,
      coupEndsAt: 0,
      coupVotes: {},
      finishAt: null,
    };
  },

  reduce(state, playerId, action, ctx): RusvetState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    const s = advance(state, ctx.now);
    if (s.stage === "reveal") return { rejected: "ended" };

    if (action.kind === "pledge") {
      // Vaat yalnız seçim süresince asılır / değiştirilir; seçim bitince kilitlenir.
      if (s.stage !== "vote") return { rejected: "wrong_phase" };
      if (s.voteClosing) return { rejected: "closed" };
      const current = own(s.pledges, playerId) ?? null;
      if (current === action.pledge) return s;
      const pledges = { ...s.pledges };
      if (action.pledge === null) delete pledges[playerId];
      else pledges[playerId] = action.pledge;
      return { ...s, pledges };
    }

    if (action.kind === "coup") {
      if (s.stage !== "coup") return { rejected: "wrong_phase" };
      if (!s.coupEligible.includes(playerId)) return { rejected: "not_eligible" };
      // Darbe oyu tek seferliktir.
      if (own(s.coupVotes, playerId) !== undefined) return { rejected: "locked" };
      const coupVotes = { ...s.coupVotes, [playerId]: action.yes };
      const all = everyoneReady(s.coupEligible, ctx.connected, (id) => own(coupVotes, id) !== undefined);
      // Bağlı hak sahiplerinin hepsi oy verdiyse aşama kısa bir süre sonra biter (kopuk hak sahibi beklenmez).
      return all
        ? { ...s, coupVotes, coupEndsAt: Math.min(s.coupEndsAt, ctx.now + RUSVET_LOCK_GRACE_MS) }
        : { ...s, coupVotes };
    }

    if (action.kind === "lock") {
      if (s.stage === "vote") {
        if (s.votesLocked.includes(playerId)) return { rejected: "locked" };
        if (s.voteClosing) return { rejected: "closed" };
        if (own(s.votes, playerId) === undefined) return { rejected: "nothing_to_lock" };
        const votesLocked = [...s.votesLocked, playerId];
        const active = s.players.filter((id) => ctx.connected.includes(id));
        if (active.length === 0 || !active.every((id) => votesLocked.includes(id))) {
          return { ...s, votesLocked };
        }
        return {
          ...s,
          votesLocked,
          voteClosing: true,
          voteEndsAt: Math.min(s.voteEndsAt, ctx.now + RUSVET_LOCK_GRACE_MS),
        };
      }
      if (s.stage === "runoff") {
        if (s.runoffLocked.includes(playerId)) return { rejected: "locked" };
        if (s.runoffClosing) return { rejected: "closed" };
        if (own(s.runoffVotes, playerId) === undefined) return { rejected: "nothing_to_lock" };
        const runoffLocked = [...s.runoffLocked, playerId];
        if (!everyoneReady(s.players, ctx.connected, (id) => runoffLocked.includes(id))) {
          return { ...s, runoffLocked };
        }
        return {
          ...s,
          runoffLocked,
          runoffClosing: true,
          runoffEndsAt: Math.min(s.runoffEndsAt, ctx.now + RUSVET_LOCK_GRACE_MS),
        };
      }
      if (s.stage === "give") {
        if (s.president !== playerId) return { rejected: "not_president" };
        if (s.giveLocked) return { rejected: "locked" };
        if (allocationList(s.tokens, s.players).length === 0) return { rejected: "nothing_to_lock" };
        return { ...s, giveLocked: true, giveEndsAt: Math.min(s.giveEndsAt, ctx.now + RUSVET_LOCK_GRACE_MS) };
      }
      return { rejected: "wrong_phase" };
    }

    if (action.kind === "vote") {
      if (s.stage === "runoff") {
        // RD-M4: ikinci oylamada yalnız eşit adaylardan birine (aday kendine veremez).
        if (s.runoffLocked.includes(playerId)) return { rejected: "locked" };
        if (s.runoffClosing) return { rejected: "closed" };
        if (action.target === playerId) return { rejected: "self_target" };
        if (!s.candidates.includes(action.target)) return { rejected: "not_candidate" };
        if (!ctx.connected.includes(action.target)) return { rejected: "target_offline" };
        if (own(s.runoffVotes, playerId) === action.target) return s;
        return { ...s, runoffVotes: { ...s.runoffVotes, [playerId]: action.target } };
      }
      if (s.stage !== "vote") return { rejected: "wrong_phase" };
      if (s.votesLocked.includes(playerId)) return { rejected: "locked" };
      if (s.voteClosing) return { rejected: "closed" };
      if (action.target === playerId) return { rejected: "self_target" };
      if (!s.players.includes(action.target)) return { rejected: "unknown_target" };
      if (!ctx.connected.includes(action.target)) return { rejected: "target_offline" };
      if (own(s.votes, playerId) === action.target) return s;
      return { ...s, votes: { ...s.votes, [playerId]: action.target } };
    }

    if (action.kind === "sign") {
      if (s.stage !== "duel") return { rejected: "wrong_phase" };
      if (!s.candidates.includes(playerId)) return { rejected: "not_candidate" };
      if (s.handClosed) return { rejected: "wrong_phase" };
      // İşaret tek seferliktir: ilk işaret kesindir.
      if (own(s.signs, playerId) !== undefined) return { rejected: "locked" };
      const signs = { ...s.signs, [playerId]: action.sign };
      // Düellodaki bağlı herkes işaret verdiyse açılış hemen başlar (kopuk düellocu beklenmez).
      const all = everyoneReady(s.candidates, ctx.connected, (id) => own(signs, id) !== undefined);
      return all ? { ...s, signs, handSignEnd: Math.min(signEndOf(s), ctx.now) } : { ...s, signs };
    }

    if (s.stage !== "give") return { rejected: "wrong_phase" };
    if (s.president !== playerId) return { rejected: "not_president" };
    if (s.giveLocked) return { rejected: "locked" };
    let total = 0;
    const next: Record<string, number> = {};
    for (const { to, n } of action.tokens) {
      if (to === playerId) return { rejected: "self_target" };
      if (!s.players.includes(to)) return { rejected: "unknown_target" };
      if (n > (own(s.tokens, to) ?? 0) && !ctx.connected.includes(to)) return { rejected: "target_offline" };
      total += n;
      next[to] = n;
    }
    if (total > s.budget) return { rejected: "over_budget" };
    return { ...s, tokens: next };
  },

  // Aşama değişimleri durumu değiştirir: sunucu değişiklikte yayın yapar, böylece geçişler tam zamanında görünür.
  tick(state, ctx): RusvetState {
    return advance(state, ctx.now);
  },

  /** RD-M6: bağlantı kaydı; kopuk katılımcılar durumda tutulur (tick bağlantıya bakmaz). */
  onPresence(state, ctx): RusvetState {
    const offline = state.players.filter((id) => !ctx.connected.includes(id));
    return sameIds(offline, state.offline) ? state : { ...state, offline };
  },

  publicView(state, ctx): RusvetPublicView {
    const s = advance(state, ctx.now);
    const [from, to] = span(s);
    const elected = s.stage === "give" || s.stage === "coup" || s.stage === "reveal";
    let reveal: RusvetReveal | null = null;
    if (s.stage === "reveal" && s.finalVotes && s.counts && s.finalTokens) {
      reveal = {
        votes: { ...s.finalVotes },
        counts: { ...s.counts },
        randomVoters: [...s.randomVoters],
        runoffVotes: s.runoffHeld ? { ...s.runoffVotes } : null,
        tokens: { ...s.finalTokens },
        randomTokens: { ...s.randomTokens },
        offlineRefill: s.offlineRefill,
        scores: scoresOf(s),
        duelHands: s.hands,
        coup: coupResultOf(s),
        pledge: pledgeVerdictOf(s),
      };
    }
    let pledges: Record<string, Pledge> = { ...s.pledges };
    if (elected) {
      const p = s.president === null ? undefined : own(s.pledges, s.president);
      pledges = s.president !== null && p !== undefined ? { [s.president]: p } : {};
    }
    return {
      players: [...s.players],
      phase: s.stage,
      startedAt: s.startedAt,
      phaseStartedAt: from,
      phaseEndsAt: to,
      president: elected ? s.president : null,
      budget: elected ? s.budget : null,
      crown: s.stage === "give" ? { startedAt: s.electedAt, endsAt: s.giveStartedAt } : null,
      pledges,
      ready: readyOf(s),
      runoff: s.stage === "runoff" ? { candidates: [...s.candidates] } : null,
      duel:
        s.stage === "duel"
          ? {
              hand: s.hand,
              candidates: [...s.candidates],
              signStartedAt: s.handStartedAt,
              signEndsAt: signEndOf(s),
              revealEndsAt: signEndOf(s) + RUSVET_SIGN_REVEAL_MS,
              signs: s.handClosed ? { ...s.signs } : null,
              history: s.hands,
              lottery: lotteryOf(s),
            }
          : null,
      coup:
        s.stage === "coup" && s.finalTokens
          ? { tokens: { ...s.finalTokens }, eligible: [...s.coupEligible] }
          : null,
      reveal,
    };
  },

  view(state, playerId, ctx): RusvetView {
    const empty: RusvetView = {
      myVote: null,
      myVoteRandom: false,
      mySign: null,
      myTokens: null,
      ledger: null,
      myCoup: null,
      canCoup: false,
      locked: false,
    };
    if (playerId === null || !state.players.includes(playerId)) return empty;
    const s = advance(state, ctx.now);
    const president = s.president === playerId;
    return {
      myVote:
        s.stage === "runoff"
          ? (own(s.runoffVotes, playerId) ?? null)
          : (own(s.finalVotes ?? s.votes, playerId) ?? null),
      myVoteRandom: s.finalVotes !== null && s.randomVoters.includes(playerId),
      mySign: s.stage === "duel" && s.candidates.includes(playerId) ? (own(s.signs, playerId) ?? null) : null,
      myTokens:
        president && (s.stage === "give" || s.stage === "reveal")
          ? allocationList(s.finalTokens ?? s.tokens, s.players)
          : null,
      ledger: president && (s.stage === "give" || s.stage === "coup") ? ledgerOf(s, playerId) : null,
      myCoup: s.stage === "coup" ? (own(s.coupVotes, playerId) ?? null) : null,
      canCoup: s.stage === "coup" && s.coupEligible.includes(playerId),
      locked: readyOf(s).includes(playerId),
    };
  },

  /** Sonuç açılışı darbe aşaması bittiği (ya da atlandığı) an başlar. */
  revealAt(state, ctx): number | null {
    const s = advance(state, ctx.now);
    return s.stage === "reveal" && s.finishAt !== null ? s.finishAt - RUSVET_REVEAL_MS : null;
  },

  isFinished(state, ctx): boolean {
    const s = advance(state, ctx.now);
    return s.finishAt !== null && ctx.now >= s.finishAt;
  },

  // Oylar, işaretler, dağıtım ve defter kısa kimlik/sözcüklerdir: metin araması koruyamaz. Gizlilik yapısaldır;
  // bkz. rusvet-darbe.test.ts "gizlilik".
  secrets() {
    return [];
  },

  result(state) {
    const scores = scoresOf(advance(state, Number.POSITIVE_INFINITY));
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
