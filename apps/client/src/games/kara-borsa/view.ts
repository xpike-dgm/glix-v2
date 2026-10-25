import type { BorsaHint, BorsaPhase, BorsaRoundResult } from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function numRecord(v: unknown): Record<string, number> | null {
  if (!isRec(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) {
    if (!isNum(n)) return null;
    out[k] = n;
  }
  return out;
}

function parseRound(v: unknown): BorsaRoundResult | null {
  if (!isRec(v) || !isNum(v.value) || !isNum(v.price)) return null;
  if (v.winner !== null && typeof v.winner !== "string") return null;
  const bids = numRecord(v.bids);
  return bids ? { value: v.value, winner: v.winner, price: v.price, bids } : null;
}

export function parseHint(v: unknown): BorsaHint | null {
  if (!isRec(v)) return null;
  switch (v.kind) {
    case "gt":
    case "lt":
    case "multiple":
    case "notMultiple":
      return isNum(v.n) ? ({ kind: v.kind, n: v.n } as BorsaHint) : null;
    case "between":
      return isNum(v.lo) && isNum(v.hi) ? { kind: "between", lo: v.lo, hi: v.hi } : null;
    case "even":
    case "odd":
    case "cursed":
    case "notCursed":
      return { kind: v.kind };
    default:
      return null;
  }
}

export interface BorsaScreenView {
  phase: BorsaPhase;
  round: number;
  rounds: number;
  startedAt: number;
  stageStartedAt: number;
  stageEndsAt: number;
  players: string[];
  coins: Record<string, number>;
  boxes: Record<string, number>;
  bidIds: string[];
  history: BorsaRoundResult[];
  reveal: BorsaRoundResult | null;
  hint: BorsaHint | null;
  myBid: number | null;
}

/** Sunucudan gelen görünümler bilinmez; doğrulanır, bozuksa null. */
export function parseBorsaView(publicView: unknown, view: unknown): BorsaScreenView | null {
  if (!isRec(publicView) || !isRec(view)) return null;
  const p = publicView;
  const { phase } = p;
  if (phase !== "bid" && phase !== "reveal" && phase !== "done") return null;
  if (![p.round, p.rounds, p.startedAt, p.stageStartedAt, p.stageEndsAt].every(isNum)) return null;
  const coins = numRecord(p.coins);
  const boxes = numRecord(p.boxes);
  if (!coins || !boxes || !isStrArray(p.players) || !isStrArray(p.bidIds) || !Array.isArray(p.history))
    return null;
  const history: BorsaRoundResult[] = [];
  for (const raw of p.history) {
    const r = parseRound(raw);
    if (!r) return null;
    history.push(r);
  }
  const reveal = p.reveal === null ? null : parseRound(p.reveal);
  if (p.reveal !== null && reveal === null) return null;
  const hint = view.hint === null ? null : parseHint(view.hint);
  if (view.hint !== null && hint === null) return null;
  if (view.myBid !== null && !isNum(view.myBid)) return null;
  return {
    phase,
    round: p.round as number,
    rounds: p.rounds as number,
    startedAt: p.startedAt as number,
    stageStartedAt: p.stageStartedAt as number,
    stageEndsAt: p.stageEndsAt as number,
    players: p.players,
    coins,
    boxes,
    bidIds: p.bidIds,
    history,
    reveal,
    hint,
    myBid: view.myBid as number | null,
  };
}

const ABLATIVE_DIGIT = ["dan", "den", "den", "ten", "ten", "ten", "dan", "den", "den", "dan"];
const ABLATIVE_TENS: Record<number, string> = {
  10: "dan",
  20: "den",
  30: "dan",
  40: "tan",
  50: "den",
  60: "tan",
};

/** "30'dan", "5'ten": sayının okunuşuna göre ayrılma eki. */
export function fromNumber(n: number): string {
  const suffix = n % 10 === 0 ? (ABLATIVE_TENS[n] ?? "dan") : (ABLATIVE_DIGIT[n % 10] ?? "dan");
  return `${n}'${suffix}`;
}

/** "3'ün", "5'in", "10'un": tamlayan eki (ipucu havuzundaki sayılar için). */
function multipleOf(n: number): string {
  const suffix: Record<number, string> = { 3: "ün", 5: "in", 10: "un" };
  return `${n}'${suffix[n] ?? "in"}`;
}

/** İpucunun Türkçe cümlesi. */
export function hintText(h: BorsaHint): string {
  switch (h.kind) {
    case "gt":
      return `Değeri ${fromNumber(h.n)} büyük`;
    case "lt":
      return `Değeri ${fromNumber(h.n)} küçük`;
    case "between":
      return `Değeri ${h.lo} ile ${h.hi} arasında`;
    case "even":
      return "Değeri çift sayı";
    case "odd":
      return "Değeri tek sayı";
    case "multiple":
      return `Değeri ${multipleOf(h.n)} katı`;
    case "notMultiple":
      return `Değeri ${multipleOf(h.n)} katı değil`;
    case "cursed":
      return "Kutu lanetli!";
    case "notCursed":
      return "Kutu lanetli değil";
  }
}

/** Sıralı teklifler (yüksekten düşüğe; verilmeyenler sonda). */
export function sortedBids(
  r: BorsaRoundResult,
  players: readonly string[],
): { id: string; amount: number }[] {
  return players
    .map((id, i) => ({ id, amount: r.bids[id] ?? 0, i }))
    .sort((a, b) => b.amount - a.amount || a.i - b.i)
    .map(({ id, amount }) => ({ id, amount }));
}
