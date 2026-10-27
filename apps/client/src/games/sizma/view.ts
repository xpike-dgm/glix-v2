import type { SizmaPhase, SizmaPublicView, SizmaReveal, SizmaView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((p) => typeof p === "string");
const PHASES: readonly SizmaPhase[] = ["clue", "vote", "notice", "reveal"];

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type SizmaScreenView = SizmaPublicView & SizmaView;

function parseReveal(v: unknown): SizmaReveal | null {
  if (!isRec(v)) return null;
  if (typeof v.infiltrator !== "string") return null;
  if (typeof v.commonWord !== "string" || typeof v.infiltratorWord !== "string") return null;
  if (typeof v.caught !== "boolean" || !isRec(v.votes)) return null;
  if (v.selfNoticed !== undefined && typeof v.selfNoticed !== "boolean") return null;
  const votes: Record<string, string> = {};
  for (const [from, to] of Object.entries(v.votes)) {
    if (typeof to !== "string") return null;
    votes[from] = to;
  }
  const tally = parseNumberRecord(v.tally);
  const scores = parseNumberRecord(v.scores);
  if (!tally || !scores) return null;
  return {
    infiltrator: v.infiltrator,
    commonWord: v.commonWord,
    infiltratorWord: v.infiltratorWord,
    votes,
    tally,
    caught: v.caught,
    selfNoticed: v.selfNoticed === true,
    scores,
  };
}

/** Sunucudan gelen `publicView` bilinmez; Sızma ortak görünümü olarak doğrulanır. */
export function parseSizmaPublicView(v: unknown): SizmaPublicView | null {
  if (!isRec(v)) return null;
  if (!isStrArr(v.players) || !isStrArr(v.order) || !isStrArr(v.ready)) return null;
  if (typeof v.phase !== "string" || !PHASES.includes(v.phase as SizmaPhase)) return null;
  if (!isNum(v.startedAt) || !isNum(v.clueEndsAt) || !isNum(v.voteEndsAt) || !isNum(v.finishAt)) return null;
  if (v.noticeEndsAt !== undefined && !isNum(v.noticeEndsAt)) return null;
  const reveal = v.reveal === null || v.reveal === undefined ? null : parseReveal(v.reveal);
  if (v.reveal !== null && v.reveal !== undefined && reveal === null) return null;
  return {
    players: [...v.players],
    phase: v.phase as SizmaPhase,
    order: [...v.order],
    startedAt: v.startedAt,
    clueEndsAt: v.clueEndsAt,
    voteEndsAt: v.voteEndsAt,
    noticeEndsAt: v.noticeEndsAt ?? v.voteEndsAt,
    finishAt: v.finishAt,
    ready: [...v.ready],
    reveal,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseSizmaPrivateView(v: unknown): SizmaView | null {
  if (!isRec(v)) return null;
  if (v.word !== null && typeof v.word !== "string") return null;
  if (v.myVote !== null && typeof v.myVote !== "string") return null;
  if (v.myNotice !== undefined && v.myNotice !== null && typeof v.myNotice !== "boolean") return null;
  if (typeof v.locked !== "boolean") return null;
  return { word: v.word, myVote: v.myVote, myNotice: v.myNotice ?? null, locked: v.locked };
}

export function parseSizmaView(publicView: unknown, view: unknown): SizmaScreenView | null {
  const pub = parseSizmaPublicView(publicView);
  const priv = parseSizmaPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

export interface CrewMember {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

/** Benim açımdan sonuç: puan aldıysam kazandım. */
export function outcomeOf(reveal: SizmaReveal, selfId: string): "win" | "lose" {
  return (reveal.scores[selfId] ?? 0) > 0 ? "win" : "lose";
}

/** Kelime uzunluğuna göre yazı boyu (px): uzun kelime küçülür ki kristale sığsın. */
export function wordSize(word: string): number {
  const n = [...word].length;
  if (n <= 5) return 40;
  if (n <= 7) return 34;
  if (n <= 9) return 28;
  return 24;
}

export interface TallyPlan {
  /** Oyuncu kimliği → açılış adımı: aynı oy sayısındakiler birlikte, az oydan çok oya. */
  step: Record<string, number>;
  /** Sızmanın kimliğinin açıldığı adım (oy adımlarından sonra gelir). */
  finale: number;
  /** Sızmanın "fark ettin mi" cevabının açıldığı son adım (kimlikten sonra). */
  notice: number;
  steps: number;
}

/**
 * Sıralı açılış (yalnız sunum): oylar az alandan çok alana doğru açılır; son adımda sızmanın maskesi düşer.
 * Hiç oy almayanlar ilk adımda birlikte görünür. Açılışta zaten herkese giden `tally` ile hesaplanır.
 */
export function tallyPlan(ids: readonly string[], tally: Readonly<Record<string, number>>): TallyPlan {
  const counts = [...new Set(ids.map((id) => tally[id] ?? 0))].sort((a, b) => a - b);
  const step: Record<string, number> = {};
  for (const id of ids) step[id] = counts.indexOf(tally[id] ?? 0);
  return { step, finale: counts.length, notice: counts.length + 1, steps: counts.length + 2 };
}
