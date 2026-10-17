import {
  KARALAMA_COLORS,
  KARALAMA_ERASER_INDEX,
  KARALAMA_GRID,
  type KaralamaPhase,
  type KaralamaPublicView,
  type KaralamaReveal,
  type KaralamaStroke,
  type KaralamaView,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Bir oyuncunun çizimi: darbeler + yalnız değişimi anlamak için ucuz bir anahtar. */
export interface ParsedDrawing {
  strokes: KaralamaStroke[];
  key: string;
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export interface KaralamaScreenView {
  phase: KaralamaPhase;
  drawEndsAt: number;
  voteEndsAt: number;
  players: string[];
  drawings: Record<string, ParsedDrawing> | null;
  voted: string[];
  reveal: KaralamaReveal | null;
  word: string | null;
  near: boolean;
  /** Kendi darbelerin, sıra numarasına göre. */
  strokes: KaralamaStroke[];
  pointsLeft: number;
  myVote: string | null;
}

const clampCoord = (n: number): number => Math.min(KARALAMA_GRID, Math.max(0, Math.round(n)));

/** Geçerli darbeyi (renk, kalınlık, en az 2 nokta) döner; bozuksa null. Koordinatlar ızgaraya sıkıştırılır. */
export function parseStroke(v: unknown): KaralamaStroke | null {
  if (!Array.isArray(v) || v.length < 6 || v.length % 2 !== 0) return null;
  const color = v[0];
  const size = v[1];
  if (!isNum(color) || !Number.isInteger(color) || color < 0 || color > KARALAMA_ERASER_INDEX) return null;
  if (size !== 1 && size !== 2 && size !== 3) return null;
  const out: number[] = [color, size];
  for (let i = 2; i < v.length; i++) {
    const n: unknown = v[i];
    if (!isNum(n)) return null;
    out.push(clampCoord(n));
  }
  return out;
}

function parseStrokeList(list: unknown[]): ParsedDrawing {
  const strokes: KaralamaStroke[] = [];
  let total = 0;
  for (const raw of list) {
    const s = parseStroke(raw);
    if (!s) continue;
    strokes.push(s);
    total += s.length;
  }
  const last = strokes.at(-1);
  return { strokes, key: `${strokes.length}:${total}:${last?.[2] ?? 0}:${last?.[3] ?? 0}` };
}

function parseDrawings(v: unknown): Record<string, ParsedDrawing> | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const out: Record<string, ParsedDrawing> = {};
  for (const [id, list] of Object.entries(v)) {
    if (!Array.isArray(list)) return undefined;
    out[id] = parseStrokeList(list);
  }
  return out;
}

function parseReveal(v: unknown): KaralamaReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const { outsider, mainWord, nearWord, caught } = v;
  if (typeof outsider !== "string" || typeof mainWord !== "string" || typeof nearWord !== "string")
    return undefined;
  if (typeof caught !== "boolean") return undefined;
  const tally = parseNumberRecord(v.tally);
  if (!tally || !isRec(v.votes)) return undefined;
  const votes: Record<string, string> = {};
  for (const [voter, target] of Object.entries(v.votes)) {
    if (typeof target !== "string") return undefined;
    votes[voter] = target;
  }
  return { outsider, mainWord, nearWord, votes, tally, caught };
}

export interface KaralamaPublicParsed extends Omit<KaralamaPublicView, "drawings"> {
  drawings: Record<string, ParsedDrawing> | null;
}

/** Sunucudan gelen `publicView` bilinmez; Karalama Defteri ortak görünümü olarak doğrulanır. */
export function parseKaralamaPublicView(v: unknown): KaralamaPublicParsed | null {
  if (!isRec(v)) return null;
  const { phase } = v;
  if (phase !== "draw" && phase !== "vote" && phase !== "done") return null;
  if (!isNum(v.drawEndsAt) || !isNum(v.voteEndsAt)) return null;
  if (!isStrArray(v.players) || !isStrArray(v.voted)) return null;
  const drawings = parseDrawings(v.drawings);
  const reveal = parseReveal(v.reveal);
  if (drawings === undefined || reveal === undefined) return null;
  return {
    phase,
    drawEndsAt: v.drawEndsAt,
    voteEndsAt: v.voteEndsAt,
    players: v.players,
    drawings,
    voted: v.voted,
    reveal,
  };
}

export interface KaralamaPrivateParsed extends Omit<KaralamaView, "strokes"> {
  strokes: KaralamaStroke[];
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. Darbeler numaraya göre sıralanır. */
export function parseKaralamaPrivateView(v: unknown): KaralamaPrivateParsed | null {
  if (!isRec(v)) return null;
  if (v.word !== null && typeof v.word !== "string") return null;
  if (typeof v.near !== "boolean") return null;
  if (!isNum(v.pointsLeft)) return null;
  if (v.myVote !== null && typeof v.myVote !== "string") return null;
  if (!isRec(v.strokes)) return null;
  const keyed: { n: number; s: KaralamaStroke }[] = [];
  for (const [k, raw] of Object.entries(v.strokes)) {
    const n = Number(k);
    const s = parseStroke(raw);
    if (!Number.isInteger(n) || !s) continue;
    keyed.push({ n, s });
  }
  keyed.sort((a, b) => a.n - b.n);
  return {
    word: v.word,
    near: v.near,
    strokes: keyed.map((x) => x.s),
    pointsLeft: Math.max(0, v.pointsLeft),
    myVote: v.myVote,
  } as KaralamaPrivateParsed;
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseKaralamaView(publicView: unknown, view: unknown): KaralamaScreenView | null {
  const pub = parseKaralamaPublicView(publicView);
  const priv = parseKaralamaPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Kelimeyi ekranda büyük harfle, Türkçe kurallarıyla göster. */
export const shownWord = (w: string): string => w.toLocaleUpperCase("tr-TR");

/** Palet dizinini (0..5) kimliğe çevirir; silgi için "eraser". */
export function penIdOf(index: number): (typeof KARALAMA_COLORS)[number] | "eraser" {
  return KARALAMA_COLORS[index] ?? "eraser";
}
