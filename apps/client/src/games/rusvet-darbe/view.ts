import {
  type Allocation,
  type DuelHand,
  PLEDGES,
  type Pledge,
  RUSVET_MAX_PER_PLAYER,
  RUSVET_PRESIDENT_SCORE,
  type RusvetCoupPublic,
  type RusvetCoupResult,
  type RusvetDuel,
  type RusvetLedger,
  type RusvetPhase,
  type RusvetPledgeVerdict,
  type RusvetPublicView,
  type RusvetReveal,
  type RusvetView,
  resolveHand,
  SIGNS,
  type Sign,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const PHASES: readonly RusvetPhase[] = ["vote", "runoff", "duel", "give", "coup", "reveal"];
const asPledge = (v: unknown): Pledge | null => PLEDGES.find((p) => p === v) ?? null;
const asSign = (v: unknown): Sign | null => SIGNS.find((s) => s === v) ?? null;

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type RusvetScreenView = RusvetPublicView & RusvetView;

function parseSigns(v: unknown): Record<string, Sign> | null {
  if (!isRec(v)) return null;
  const out: Record<string, Sign> = {};
  for (const [id, s] of Object.entries(v)) {
    const sign = asSign(s);
    if (sign === null) return null;
    out[id] = sign;
  }
  return out;
}

const strArr = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every(isStr) ? [...(v as string[])] : null;

function parseHand(v: unknown): DuelHand | null {
  if (!isRec(v)) return null;
  const candidates = strArr(v.candidates);
  const advance = strArr(v.advance);
  const signs = parseSigns(v.signs);
  if (!candidates || !advance || !signs || typeof v.replay !== "boolean") return null;
  return { candidates, advance, signs, replay: v.replay };
}

function parseHands(v: unknown): DuelHand[] | null {
  if (!Array.isArray(v)) return null;
  const out: DuelHand[] = [];
  for (const item of v) {
    const h = parseHand(item);
    if (!h) return null;
    out.push(h);
  }
  return out;
}

function parseStringRecord(v: unknown): Record<string, string> | null {
  if (!isRec(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v)) {
    if (!isStr(x)) return null;
    out[k] = x;
  }
  return out;
}

function parsePledges(v: unknown): Record<string, Pledge> | null {
  if (v === undefined || v === null) return {};
  if (!isRec(v)) return null;
  const out: Record<string, Pledge> = {};
  for (const [k, x] of Object.entries(v)) {
    const p = asPledge(x);
    if (p === null) return null;
    out[k] = p;
  }
  return out;
}

function parseDuel(v: unknown): RusvetDuel | null {
  if (!isRec(v)) return null;
  const candidates = strArr(v.candidates);
  const history = parseHands(v.history);
  if (!candidates || !history) return null;
  if (!isNum(v.hand) || !isNum(v.signStartedAt) || !isNum(v.signEndsAt) || !isNum(v.revealEndsAt))
    return null;
  let signs: Record<string, Sign> | null = null;
  if (v.signs !== null && v.signs !== undefined) {
    signs = parseSigns(v.signs);
    if (!signs) return null;
  }
  if (v.lottery !== null && v.lottery !== undefined && !isStr(v.lottery)) return null;
  return {
    hand: v.hand,
    candidates,
    signStartedAt: v.signStartedAt,
    signEndsAt: v.signEndsAt,
    revealEndsAt: v.revealEndsAt,
    signs,
    history,
    lottery: v.lottery ?? null,
  };
}

function parseCoupResult(v: unknown): RusvetCoupResult | null {
  if (!isRec(v)) return null;
  const eligible = strArr(v.eligible);
  if (!eligible || !isNum(v.yes) || typeof v.success !== "boolean") return null;
  return { eligible, yes: v.yes, success: v.success };
}

function parseCoupPublic(v: unknown): RusvetCoupPublic | null {
  if (!isRec(v)) return null;
  const eligible = strArr(v.eligible);
  const tokens = parseNumberRecord(v.tokens);
  return eligible && tokens ? { eligible, tokens } : null;
}

function parsePledgeVerdict(v: unknown): RusvetPledgeVerdict | null {
  if (!isRec(v)) return null;
  const pledge = asPledge(v.pledge);
  if (pledge === null || typeof v.kept !== "boolean" || typeof v.timedOut !== "boolean") return null;
  return { pledge, kept: v.kept, timedOut: v.timedOut };
}

function parseReveal(v: unknown): RusvetReveal | null {
  if (!isRec(v)) return null;
  const votes = parseStringRecord(v.votes);
  const counts = parseNumberRecord(v.counts);
  const tokens = parseNumberRecord(v.tokens);
  const scores = parseNumberRecord(v.scores);
  const duelHands = parseHands(v.duelHands);
  if (!votes || !counts || !tokens || !scores || !duelHands) return null;
  const randomVoters = v.randomVoters === undefined ? [] : strArr(v.randomVoters);
  const randomTokens = v.randomTokens === undefined ? {} : parseNumberRecord(v.randomTokens);
  if (!randomVoters || !randomTokens) return null;
  let runoffVotes: Record<string, string> | null = null;
  if (v.runoffVotes !== null && v.runoffVotes !== undefined) {
    runoffVotes = parseStringRecord(v.runoffVotes);
    if (!runoffVotes) return null;
  }
  if (v.offlineRefill !== undefined && typeof v.offlineRefill !== "boolean") return null;
  let coup: RusvetCoupResult | null = null;
  if (v.coup !== null && v.coup !== undefined) {
    coup = parseCoupResult(v.coup);
    if (!coup) return null;
  }
  let pledge: RusvetPledgeVerdict | null = null;
  if (v.pledge !== null && v.pledge !== undefined) {
    pledge = parsePledgeVerdict(v.pledge);
    if (!pledge) return null;
  }
  return {
    votes,
    counts,
    randomVoters,
    runoffVotes,
    tokens,
    randomTokens,
    offlineRefill: v.offlineRefill ?? false,
    scores,
    duelHands,
    coup,
    pledge,
  };
}

/** Sunucudan gelen `publicView` bilinmez; Rüşvet ve Darbe ortak görünümü olarak doğrulanır. */
export function parseRusvetPublicView(v: unknown): RusvetPublicView | null {
  if (!isRec(v)) return null;
  const players = strArr(v.players);
  if (!players) return null;
  if (!isStr(v.phase) || !PHASES.includes(v.phase as RusvetPhase)) return null;
  if (!isNum(v.startedAt) || !isNum(v.phaseStartedAt) || !isNum(v.phaseEndsAt)) return null;
  if (v.president !== null && v.president !== undefined && !isStr(v.president)) return null;
  if (v.budget !== null && v.budget !== undefined && !isNum(v.budget)) return null;
  const ready = strArr(v.ready);
  if (!ready) return null;
  const pledges = parsePledges(v.pledges);
  if (!pledges) return null;
  let crown: { startedAt: number; endsAt: number } | null = null;
  if (v.crown !== null && v.crown !== undefined) {
    if (!isRec(v.crown) || !isNum(v.crown.startedAt) || !isNum(v.crown.endsAt)) return null;
    crown = { startedAt: v.crown.startedAt, endsAt: v.crown.endsAt };
  }
  let runoff: { candidates: string[] } | null = null;
  if (v.runoff !== null && v.runoff !== undefined) {
    const candidates = isRec(v.runoff) ? strArr(v.runoff.candidates) : null;
    if (!candidates) return null;
    runoff = { candidates };
  }
  let duel: RusvetDuel | null = null;
  if (v.duel !== null && v.duel !== undefined) {
    duel = parseDuel(v.duel);
    if (!duel) return null;
  }
  let coup: RusvetCoupPublic | null = null;
  if (v.coup !== null && v.coup !== undefined) {
    coup = parseCoupPublic(v.coup);
    if (!coup) return null;
  }
  let reveal: RusvetReveal | null = null;
  if (v.reveal !== null && v.reveal !== undefined) {
    reveal = parseReveal(v.reveal);
    if (!reveal) return null;
  }
  return {
    players,
    phase: v.phase as RusvetPhase,
    startedAt: v.startedAt,
    phaseStartedAt: v.phaseStartedAt,
    phaseEndsAt: v.phaseEndsAt,
    president: v.president ?? null,
    budget: v.budget ?? null,
    crown,
    pledges,
    ready,
    runoff,
    duel,
    coup,
    reveal,
  };
}

function parseAllocations(v: unknown): Allocation[] | null {
  if (!Array.isArray(v)) return null;
  const out: Allocation[] = [];
  for (const item of v) {
    if (!isRec(item) || !isStr(item.to) || !isNum(item.n)) return null;
    out.push({ to: item.to, n: item.n });
  }
  return out;
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseRusvetPrivateView(v: unknown): RusvetView | null {
  if (!isRec(v)) return null;
  if (v.myVote !== null && !isStr(v.myVote)) return null;
  const mySign = v.mySign === null || v.mySign === undefined ? null : asSign(v.mySign);
  if (v.mySign !== null && v.mySign !== undefined && mySign === null) return null;
  let myTokens: Allocation[] | null = null;
  if (v.myTokens !== null && v.myTokens !== undefined) {
    myTokens = parseAllocations(v.myTokens);
    if (!myTokens) return null;
  }
  if (v.myCoup !== null && v.myCoup !== undefined && typeof v.myCoup !== "boolean") return null;
  if (v.canCoup !== undefined && typeof v.canCoup !== "boolean") return null;
  if (typeof v.locked !== "boolean") return null;
  if (v.myVoteRandom !== undefined && typeof v.myVoteRandom !== "boolean") return null;
  let ledger: RusvetLedger | null = null;
  if (v.ledger !== null && v.ledger !== undefined) {
    const voters = isRec(v.ledger) ? strArr(v.ledger.voters) : null;
    const random = isRec(v.ledger) ? strArr(v.ledger.random) : null;
    if (!voters || !random) return null;
    ledger = { voters, random };
  }
  return {
    myVote: v.myVote,
    myVoteRandom: v.myVoteRandom ?? false,
    mySign,
    myTokens,
    ledger,
    myCoup: v.myCoup ?? null,
    canCoup: v.canCoup ?? false,
    locked: v.locked,
  };
}

export function parseRusvetView(publicView: unknown, view: unknown): RusvetScreenView | null {
  const pub = parseRusvetPublicView(publicView);
  const priv = parseRusvetPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Dağıtım listesinden kişi → jeton sözlüğü. */
export function tokenMap(list: readonly Allocation[] | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { to, n } of list ?? []) out[to] = n;
  return out;
}

export function tokenTotal(tokens: Record<string, number>): number {
  return Object.values(tokens).reduce((a, b) => a + b, 0);
}

/**
 * RD-U3: bir kişiye dokununca jeton sayısı: yer ve bütçe varsa +1, yoksa aynı kalır (2 → 0 geri alma döngüsü
 * yok; geri almak "−" düğmesiyle). `canAdd` false ise (ör. bağlantısı kopuk) artış yapılmaz.
 */
export function addToken(current: number, remaining: number, canAdd = true): number {
  return canAdd && current < RUSVET_MAX_PER_PLAYER && remaining > 0 ? current + 1 : current;
}

/** RD-U3: "−" düğmesi: bir jeton geri alınır (en az 0). */
export const removeToken = (current: number): number => Math.max(0, current - 1);

export function tokensToAllocations(tokens: Record<string, number>, order: readonly string[]): Allocation[] {
  return order.flatMap((to) => ((tokens[to] ?? 0) > 0 ? [{ to, n: tokens[to] as number }] : []));
}

/** Açılmış elin sonucu (devam edenler / tekrar); istemci kuralı yeniden icat etmez, motorun işlevini kullanır. */
export function handOutcome(candidates: readonly string[], signs: Record<string, Sign>): DuelHand | null {
  if (!candidates.every((id) => signs[id] !== undefined)) return null;
  return resolveHand(candidates, signs);
}

/** Daire üzerinde yerleşim (yüzde): ilk oyuncu üstte, saat yönünde. */
export function ringPosition(index: number, count: number, radius = 38): { x: number; y: number } {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
}

export const SIGN_LABEL: Record<Sign, string> = { tas: "Taş", kagit: "Kâğıt", makas: "Makas" };

/** RD-M3: vaat adları. */
export const PLEDGE_LABEL: Record<Pledge, string> = { voters: "Oy verene jeton", all: "Herkese jeton" };

/** RD-U2: sonuç çıkmayan elin nedeni. */
export function replayReason(hand: DuelHand): string {
  const used = [...new Set(hand.candidates.map((id) => hand.signs[id]))];
  if (used.length >= 3) return "Üç işaret de çıktı";
  const only = used[0];
  return only ? `Herkes ${SIGN_LABEL[only].toLocaleUpperCase("tr")} dedi` : "Sonuç yok";
}

/** RD-U2: el şeridi: "1. el · sonuç yok (üç işaret)" / "2. el · Elif ve Mert devam". */
export function handStrip(hands: readonly DuelHand[], nameOf: (id: string) => string): string[] {
  return hands.map((h, i) => {
    if (h.replay) {
      const r = replayReason(h);
      return `${i + 1}. el · sonuç yok (${r === "Üç işaret de çıktı" ? "üç işaret" : "aynı işaret"})`;
    }
    return `${i + 1}. el · ${joinNames(h.advance.map(nameOf))} ${h.advance.length > 1 ? "devam" : "kazandı"}`;
  });
}

/** "Elif", "Elif ve Mert", "Elif, Mert ve Kaan". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ve ${names[names.length - 1]}`;
}

const VOWELS = "aıoueiöüAIOUEİÖÜ";
const lastVowel = (name: string): string => {
  for (let i = name.length - 1; i >= 0; i--) {
    const c = name[i] as string;
    if (VOWELS.includes(c)) return c.toLocaleLowerCase("tr");
  }
  return "e";
};
const endsWithVowel = (name: string): boolean => VOWELS.includes(name.slice(-1));

/** Yönelme eki (ünlü uyumu): Elif'e, Kaan'a, Ayşe'ye, Burak'a. */
export function toName(name: string): string {
  const back = "aıou".includes(lastVowel(name));
  return `${name}'${endsWithVowel(name) ? "y" : ""}${back ? "a" : "e"}`;
}

/** İlgi eki (ünlü uyumu): Elif'in, Kaan'ın, Ayşe'nin, Burak'ın, Ümüt'ün, Onur'un. */
export function ofName(name: string): string {
  const v = lastVowel(name);
  const vowel = "aı".includes(v) ? "ı" : "ou".includes(v) ? "u" : "öü".includes(v) ? "ü" : "i";
  return `${name}'${endsWithVowel(name) ? "n" : ""}${vowel}n`;
}

/** RD-U6: darbe kural satırı. */
export const coupRuleLine = (presidentName: string): string =>
  `Çoğunluk Darbe derse ${ofName(presidentName)} +${RUSVET_PRESIDENT_SCORE}'si gider`;

/** RD-U10: açılıştaki portre etiketi: başkana oy verip jeton alan / alamayan. */
export type Loyalty = "paid" | "ingrate";

/** Başkana (ilk turda) kendi eliyle oy verenlerin karşılık durumu. */
export function loyaltyOf(reveal: RusvetReveal, president: string): Record<string, Loyalty> {
  const out: Record<string, Loyalty> = {};
  for (const [from, to] of Object.entries(reveal.votes)) {
    if (to !== president || from === president || reveal.randomVoters.includes(from)) continue;
    out[from] = (reveal.tokens[from] ?? 0) > 0 ? "paid" : "ingrate";
  }
  return out;
}

/** RD-U10: kendi hikâyen (tek cümle). */
export function storyLine(
  reveal: RusvetReveal,
  president: string,
  selfId: string,
  nameOf: (id: string) => string,
): string {
  const score = reveal.scores[selfId] ?? 0;
  const pName = nameOf(president);
  if (selfId === president) {
    if (reveal.coup?.success) return `Tahtın devrildi · +0`;
    const votes = reveal.counts[selfId] ?? 0;
    const coup = reveal.coup
      ? ` · darbe ${reveal.coup.yes}/${reveal.coup.eligible.length}`
      : " · darbe olmadı";
    return `${votes} oyla başkan${coup} · +${score}`;
  }
  const to = reveal.votes[selfId];
  const random = reveal.randomVoters.includes(selfId);
  const got = reveal.tokens[selfId] ?? 0;
  if (to === president && !random) {
    return got > 0
      ? `${toName(pName)} oy verdin, sana ${got} jeton verdi`
      : `${toName(pName)} oy verdin, eli boş döndün`;
  }
  const lead =
    to === undefined
      ? ""
      : random
        ? `Oyun rastgele ${toName(nameOf(to))} gitti`
        : `${toName(nameOf(to))} oy verdin`;
  const tail = got > 0 ? `${pName} yine de ${got} jeton verdi` : "jeton gelmedi";
  return lead ? `${lead} · ${tail}` : tail;
}

/** RD-U9: sahne sahne açılış (ms, açılış başından). */
export const REVEAL_SCENES = {
  votes: 0,
  throne: 2_500,
  coins: 3_500,
  coup: 6_000,
  pledge: 8_500,
  scores: 9_500,
} as const;
export type RevealScene = keyof typeof REVEAL_SCENES;

/** Açılışın şu anki sahnesi. */
export function revealScene(elapsed: number): RevealScene {
  const order: RevealScene[] = ["scores", "pledge", "coup", "coins", "throne", "votes"];
  return order.find((k) => elapsed >= REVEAL_SCENES[k]) ?? "votes";
}

/** RD-U1: ortalanmış satırlar: 5 → 3+2, 8 → 3+3+2, 4 → 2+2, 7 → 3+2+2 gibi en çok 3 sütun. */
export function seatRows(count: number, cols = count <= 4 ? 2 : 3): number[] {
  const rows: number[] = [];
  let left = count;
  const n = Math.ceil(count / cols);
  for (let i = 0; i < n; i++) {
    const take = Math.ceil(left / (n - i));
    rows.push(take);
    left -= take;
  }
  return rows;
}

/** RD-M5: rastgele oy verenler ve rastgele giden jetonlar (kime, kaç); hiç yoksa boş. */
export function randomSummary(r: RusvetReveal, nameOf: (id: string) => string): string {
  const parts: string[] = [];
  if (r.randomVoters.length > 0) parts.push(`Zarla oy: ${r.randomVoters.map(nameOf).join(", ")}`);
  const rt = Object.entries(r.randomTokens).filter(([, n]) => n > 0);
  if (rt.length > 0) {
    const lead = r.offlineRefill ? "Başkan kopuktu, seçmenlerine" : "Süre doldu, rastgele";
    parts.push(`${lead}: ${rt.map(([id, n]) => `${nameOf(id)} ${n} jeton`).join(", ")}`);
  }
  return parts.join(" · ");
}
