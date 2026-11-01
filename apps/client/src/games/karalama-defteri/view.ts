import {
  DRAW_PENS,
  type DrawPen,
  KARALAMA_GRID,
  type KaralamaFinal,
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
  voteMs: number;
  players: string[];
  drawings: Record<string, ParsedDrawing> | null;
  voted: string[];
  /** Çizimini "Bitti" ile kesinleştirenler. */
  drawDoneIds: string[];
  /** Oyunu "Tamam" ile kesinleştirenler. */
  lockedIds: string[];
  reveal: KaralamaReveal | null;
  word: string | null;
  near: boolean;
  /** Kendi darbelerin, sıra numarasına göre. */
  strokes: KaralamaStroke[];
  pointsLeft: number;
  myVote: string | null;
  drawDone: boolean;
  locked: boolean;
}

const clampCoord = (n: number): number => Math.min(KARALAMA_GRID, Math.max(0, Math.round(n)));

/** Geçerli darbeyi (renk, kalınlık, en az 2 nokta) döner; bozuksa null. Koordinatlar ızgaraya sıkıştırılır. */
export function parseStroke(v: unknown): KaralamaStroke | null {
  if (!Array.isArray(v) || v.length < 6 || v.length % 2 !== 0) return null;
  const color = v[0];
  const size = v[1];
  if (!isNum(color) || !Number.isInteger(color) || color < 0 || color >= DRAW_PENS.length) return null;
  if (size !== 1 && size !== 2 && size !== 3 && size !== 4) return null;
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

function parseFinal(v: unknown): KaralamaFinal | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const { mainWord, guess, guessed } = v;
  if (typeof mainWord !== "string" || typeof guessed !== "boolean") return undefined;
  if (guess !== null && typeof guess !== "string") return undefined;
  const scores = parseNumberRecord(v.scores);
  if (!scores) return undefined;
  return { mainWord, guess, guessed, scores };
}

function parseReveal(v: unknown): KaralamaReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const { outsider, nearWord, caught, guessSent } = v;
  if (typeof outsider !== "string" || typeof nearWord !== "string") return undefined;
  if (typeof caught !== "boolean" || typeof guessSent !== "boolean") return undefined;
  if (!isStrArray(v.rightVoters)) return undefined;
  const times = [v.openedAt, v.guessOpensAt, v.guessEndsAt, v.finishAt];
  if (!times.every(isNum)) return undefined;
  const [openedAt, guessOpensAt, guessEndsAt, finishAt] = times as number[];
  const tally = parseNumberRecord(v.tally);
  if (!tally || !isRec(v.votes)) return undefined;
  const votes: Record<string, string> = {};
  for (const [voter, target] of Object.entries(v.votes)) {
    if (typeof target !== "string") return undefined;
    votes[voter] = target;
  }
  const final = parseFinal(v.final);
  if (final === undefined) return undefined;
  return {
    outsider,
    nearWord,
    votes,
    tally,
    caught,
    rightVoters: v.rightVoters,
    openedAt: openedAt as number,
    guessOpensAt: guessOpensAt as number,
    guessEndsAt: guessEndsAt as number,
    finishAt: finishAt as number,
    guessSent,
    final,
  };
}

const PHASES: readonly KaralamaPhase[] = ["draw", "vote", "unmask", "guess", "done"];

export interface KaralamaPublicParsed extends Omit<KaralamaPublicView, "drawings"> {
  drawings: Record<string, ParsedDrawing> | null;
}

/** Sunucudan gelen `publicView` bilinmez; Karalama Defteri ortak görünümü olarak doğrulanır. */
export function parseKaralamaPublicView(v: unknown): KaralamaPublicParsed | null {
  if (!isRec(v)) return null;
  const phase = PHASES.find((p) => p === v.phase);
  if (phase === undefined) return null;
  if (!isNum(v.drawEndsAt) || !isNum(v.voteEndsAt) || !isNum(v.voteMs)) return null;
  if (!isStrArray(v.players) || !isStrArray(v.voted)) return null;
  if (!isStrArray(v.drawDoneIds) || !isStrArray(v.lockedIds)) return null;
  const drawings = parseDrawings(v.drawings);
  const reveal = parseReveal(v.reveal);
  if (drawings === undefined || reveal === undefined) return null;
  return {
    phase,
    drawEndsAt: v.drawEndsAt,
    voteEndsAt: v.voteEndsAt,
    voteMs: v.voteMs,
    players: v.players,
    drawings,
    voted: v.voted,
    drawDoneIds: v.drawDoneIds,
    lockedIds: v.lockedIds,
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
  if (typeof v.drawDone !== "boolean" || typeof v.locked !== "boolean") return null;
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
    drawDone: v.drawDone,
    locked: v.locked,
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

/** Kalem dizinini (`DRAW_PENS` sırası; silgi 6) kimliğe çevirir; bilinmeyen dizin silgi sayılmaz, beyaz olur. */
export function penIdOf(index: number): DrawPen {
  return DRAW_PENS[index] ?? "beyaz";
}

/** Oylama bitti mi (açılış, son şans ya da bitti). */
export const isRevealPhase = (p: KaralamaPhase): boolean => p === "unmask" || p === "guess" || p === "done";

/** Sergi duvarında isim: en çok 7 harf, uzunsa "…" ile kesilir (KD-U4). */
export function wallName(nickname: string): string {
  const chars = Array.from(nickname);
  return chars.length > 7 ? `${chars.slice(0, 6).join("")}…` : nickname;
}

/** Sergi açılışı (KD-U6): çerçevelerin örtüsü soldan sağa 0,3 sn arayla kalkar; Tamam ilk 3 sn pasif. */
export const UNVEIL_STEP_MS = 300;
export const TAMAM_ARM_MS = 3_000;

/**
 * Sergi duvarı düzeni (KD-U4): 3–4 oyuncuda (2–3 çizim) tek satır büyük, 5–6'da 2 sütun, 7–8'de 2 × 4 (son satır
 * ortalı). Kendi çizimin duvarda değil. Yatayda (KD-U9) 2 satır.
 */
export function wallColumns(count: number, landscape: boolean): number {
  if (count <= 0) return 1;
  if (landscape) return Math.max(1, Math.ceil(count / 2));
  return count <= 3 ? count : 2;
}

/** Puan şeridi (KD-U5): "Doğru oy: Cihad, Zeynep +1 · Mert kurtuldu +1 · Mert kelimeyi bildi +1". */
export function scoreStrip(
  reveal: Pick<KaralamaReveal, "rightVoters" | "caught" | "outsider" | "final">,
  nameOf: (id: string) => string,
): string[] {
  const parts: string[] = [];
  if (reveal.rightVoters.length > 0) parts.push(`Doğru oy: ${reveal.rightVoters.map(nameOf).join(", ")} +1`);
  else parts.push("Kimse doğru oy vermedi");
  const who = nameOf(reveal.outsider);
  if (!reveal.caught) parts.push(`${who} kurtuldu +1`);
  if (reveal.final?.guessed) parts.push(`${who} kelimeyi bildi +1`);
  return parts;
}
