import type { SizmaFinal, SizmaPhase, SizmaPublicView, SizmaReveal, SizmaView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((p) => typeof p === "string");
const numOrNull = (v: unknown): v is number | null => v === null || isNum(v);
const PHASES: readonly SizmaPhase[] = ["clue", "vote", "runoff", "notice", "guess", "reveal"];

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type SizmaScreenView = SizmaPublicView & SizmaView;

function parseVotes(v: unknown): Record<string, string> | null {
  if (!isRec(v)) return null;
  const votes: Record<string, string> = {};
  for (const [from, to] of Object.entries(v)) {
    if (typeof to !== "string") return null;
    votes[from] = to;
  }
  return votes;
}

function parseFinal(v: unknown): SizmaFinal | null {
  if (!isRec(v)) return null;
  if (typeof v.commonWord !== "string" || typeof v.infiltratorWord !== "string") return null;
  if (v.guess !== null && typeof v.guess !== "string") return null;
  if (typeof v.stole !== "boolean" || !isStrArr(v.rightVoters)) return null;
  const scores = parseNumberRecord(v.scores);
  if (!scores) return null;
  return {
    commonWord: v.commonWord,
    infiltratorWord: v.infiltratorWord,
    guess: v.guess,
    stole: v.stole,
    scores,
    rightVoters: [...v.rightVoters],
  };
}

function parseReveal(v: unknown): SizmaReveal | null {
  if (!isRec(v) || typeof v.infiltrator !== "string") return null;
  if (typeof v.caught !== "boolean" || typeof v.selfNoticed !== "boolean") return null;
  if (v.runoff !== null && !isStrArr(v.runoff)) return null;
  if (!isNum(v.openedAt) || !isNum(v.finalAt) || !isNum(v.finishAt)) return null;
  if (!numOrNull(v.guessOpensAt) || !numOrNull(v.guessEndsAt)) return null;
  const votes = parseVotes(v.votes);
  const tally = parseNumberRecord(v.tally);
  if (!votes || !tally) return null;
  const final = v.final === null ? null : parseFinal(v.final);
  if (v.final !== null && final === null) return null;
  return {
    infiltrator: v.infiltrator,
    votes,
    tally,
    caught: v.caught,
    runoff: v.runoff === null ? null : [...v.runoff],
    selfNoticed: v.selfNoticed,
    openedAt: v.openedAt,
    guessOpensAt: v.guessOpensAt,
    guessEndsAt: v.guessEndsAt,
    finalAt: v.finalAt,
    finishAt: v.finishAt,
    final,
  };
}

/** Sunucudan gelen `publicView` bilinmez; Sızma ortak görünümü olarak doğrulanır. */
export function parseSizmaPublicView(v: unknown): SizmaPublicView | null {
  if (!isRec(v)) return null;
  if (!isStrArr(v.players) || !isStrArr(v.order) || !isStrArr(v.ready)) return null;
  if (typeof v.phase !== "string" || !PHASES.includes(v.phase as SizmaPhase)) return null;
  for (const k of ["startedAt", "phaseStartedAt", "phaseEndsAt", "turn", "turnStartedAt", "turnEndsAt"]) {
    if (!isNum(v[k])) return null;
  }
  if (v.runoff !== null && !isStrArr(v.runoff)) return null;
  const reveal = v.reveal === null ? null : parseReveal(v.reveal);
  if (v.reveal !== null && reveal === null) return null;
  return {
    players: [...v.players],
    phase: v.phase as SizmaPhase,
    order: [...v.order],
    startedAt: v.startedAt as number,
    phaseStartedAt: v.phaseStartedAt as number,
    phaseEndsAt: v.phaseEndsAt as number,
    turn: v.turn as number,
    turnStartedAt: v.turnStartedAt as number,
    turnEndsAt: v.turnEndsAt as number,
    runoff: v.runoff === null ? null : [...v.runoff],
    ready: [...v.ready],
    reveal,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseSizmaPrivateView(v: unknown): SizmaView | null {
  if (!isRec(v)) return null;
  if (v.word !== null && typeof v.word !== "string") return null;
  if (v.myVote !== null && typeof v.myVote !== "string") return null;
  if (v.myNotice !== null && typeof v.myNotice !== "boolean") return null;
  if (typeof v.locked !== "boolean") return null;
  return { word: v.word, myVote: v.myVote, myNotice: v.myNotice, locked: v.locked };
}

export function parseSizmaView(publicView: unknown, view: unknown): SizmaScreenView | null {
  const pub = parseSizmaPublicView(publicView);
  // Kişisel görünüm yoksa (TV sahnesi) izleyici görünümü kullanılır.
  const priv =
    view === null || view === undefined
      ? { word: null, myVote: null, myNotice: null, locked: false }
      : parseSizmaPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

export interface CrewMember {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

/** Kelime uzunluğuna göre yazı boyu (px): uzun kelime küçülür ki kristale sığsın. */
export function wordSize(word: string): number {
  const n = [...word].length;
  if (n <= 5) return 40;
  if (n <= 7) return 34;
  if (n <= 9) return 28;
  return 24;
}

/** Konuşma sırası özeti: tur, konuşan, sıradaki ve kimlerin bu turda konuştuğu. */
export interface TurnInfo {
  /** 1 ya da 2; sıralar bittiyse 2. */
  round: number;
  rounds: number;
  /** Konuşan (sıralar bittiyse null). */
  speaker: string | null;
  /** Sıradaki konuşan (bu turun içinde ya da bir sonraki turun ilki); yoksa null. */
  next: string | null;
  /** Bu turda konuşmuş olanlar. */
  spoken: string[];
  /** İki tur bitti (oylamaya geri sayım). */
  done: boolean;
}

export function turnInfo(order: readonly string[], turn: number, rounds = 2): TurnInfo {
  const n = order.length;
  const total = n * rounds;
  if (n === 0) return { round: 1, rounds, speaker: null, next: null, spoken: [], done: true };
  if (turn >= total)
    return { round: rounds, rounds, speaker: null, next: null, spoken: [...order], done: true };
  const round = Math.floor(turn / n) + 1;
  const pos = turn % n;
  return {
    round,
    rounds,
    speaker: order[pos] ?? null,
    next: turn + 1 < total ? (order[(turn + 1) % n] ?? null) : null,
    spoken: order.slice(0, pos),
    done: false,
  };
}

/** Benim açımdan son sonuç: puan aldıysam kazandım. */
export function outcomeOf(reveal: SizmaReveal, selfId: string): "win" | "lose" {
  return (reveal.final?.scores[selfId] ?? 0) > 0 ? "win" : "lose";
}

export interface Flight {
  from: string;
  to: string;
  /** Uçuş sırası (0'dan). */
  index: number;
}

/**
 * Oyların uçuş sırası: az oy alan hedeften çok oy alana (bugünkü sayım sırası); aynı hedefe gidenler oyuncu
 * sırasıyla. Oy vermeyen uçmaz.
 */
export function flightPlan(ids: readonly string[], votes: Readonly<Record<string, string>>): Flight[] {
  const tally: Record<string, number> = {};
  for (const id of ids) {
    const to = votes[id];
    if (to !== undefined && ids.includes(to)) tally[to] = (tally[to] ?? 0) + 1;
  }
  const pos = (id: string) => ids.indexOf(id);
  return ids
    .flatMap((from) => {
      const to = votes[from];
      return to !== undefined && ids.includes(to) ? [{ from, to }] : [];
    })
    .sort(
      (a, b) => (tally[a.to] ?? 0) - (tally[b.to] ?? 0) || pos(a.to) - pos(b.to) || pos(a.from) - pos(b.from),
    )
    .map((f, index) => ({ ...f, index }));
}

/** Kendi puan satırın: "+1 · Doğru oy" ya da "Bu sefer puan yok". */
export function scoreLine(reveal: SizmaReveal, selfId: string, myNotice: boolean | null): string {
  const f = reveal.final;
  if (!f) return "";
  const pts = f.scores[selfId] ?? 0;
  if (selfId === reveal.infiltrator) {
    if (pts === 0) return "Bu sefer puan yok";
    const why = [
      reveal.caught ? null : "Kurtuldun",
      reveal.selfNoticed ? "Fark ettin" : null,
      f.stole ? "Kelimeyi çaldın" : null,
    ].filter((x) => x !== null);
    return `+${pts} · ${why.join(" · ")}`;
  }
  if (pts > 0) return `+${pts} · Doğru oy`;
  if (f.rightVoters.includes(selfId) && myNotice === true) return "Evet dedin, yakalama puanı alamadın";
  return "Bu sefer puan yok";
}

/** Türkçe soru eki: son ünlüye göre mı / mi / mu / mü (ünlü yoksa "mi"). */
export function questionSuffix(name: string): string {
  const vowels = [...name.toLocaleLowerCase("tr-TR")].filter((ch) => "aeıioöuü".includes(ch));
  const last = vowels[vowels.length - 1];
  if (last === "a" || last === "ı") return "mı";
  if (last === "o" || last === "u") return "mu";
  if (last === "ö" || last === "ü") return "mü";
  return "mi";
}

/** "Elif mi, Zeynep mi?" */
export function runoffQuestion(names: readonly string[]): string {
  return `${names.map((n) => `${n} ${questionSuffix(n)}`).join(", ")}?`;
}

/** Neden kurtuldu / nasıl yakalandı: açık yazı (SZ-U5). */
export function reasonLine(reveal: SizmaReveal, name: (id: string) => string): string {
  const top = Math.max(0, ...Object.values(reveal.tally));
  const leaders = Object.keys(reveal.tally).filter((id) => (reveal.tally[id] ?? 0) === top && top > 0);
  if (reveal.caught) return reveal.runoff ? "İkinci oylamada en çok oyu aldı" : "En çok oyu tek başına aldı";
  if (top === 0)
    return reveal.runoff
      ? "İkinci oylamada kimse oy vermedi: sızma kurtuldu"
      : "Kimse oy vermedi: sızma kurtuldu";
  if (leaders.length > 1)
    return reveal.runoff ? "İkinci oylamada da eşitlik: sızma kurtuldu" : "Oylar eşit: sızma kurtuldu";
  return `En çok oyu ${name(leaders[0] ?? "")} aldı: sızma kurtuldu`;
}
