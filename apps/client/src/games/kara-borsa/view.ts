import {
  BORSA_START_COINS,
  type BorsaHint,
  type BorsaHintPair,
  type BorsaPhase,
  type BorsaRoundResult,
} from "@glix/engine";

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

/** Ana + ek ipucu çifti; ikisi de geçerli olmalı. */
export function parseHintPair(v: unknown): BorsaHintPair | null {
  if (!isRec(v)) return null;
  const main = parseHint(v.main);
  const extra = parseHint(v.extra);
  return main && extra ? { main, extra } : null;
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
  hint: BorsaHintPair | null;
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
  const hint = view.hint === null ? null : parseHintPair(view.hint);
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
  70: "ten",
  80: "den",
  90: "dan",
};

/** "30'dan", "5'ten", "100'den": sayının okunuşuna göre ayrılma eki (Büyük Kutu'da 120'ye kadar). */
export function fromNumber(n: number): string {
  const a = Math.abs(n);
  const tens = a % 100;
  const suffix =
    a % 10 !== 0
      ? (ABLATIVE_DIGIT[a % 10] ?? "dan")
      : a === 0
        ? "dan"
        : tens === 0
          ? "den"
          : (ABLATIVE_TENS[tens] ?? "dan");
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

/** Teklifler açılış sırasıyla: düşükten yükseğe, kazanan en son (eşit teklifte önce veren kazanandır). */
export function revealOrder(
  r: BorsaRoundResult,
  players: readonly string[],
): { id: string; amount: number }[] {
  const rows = sortedBids(r, players).reverse();
  if (r.winner === null) return rows;
  const win = rows.find((x) => x.id === r.winner);
  return win ? [...rows.filter((x) => x.id !== r.winner), win] : rows;
}

/** Kazanan, kendisiyle eşit teklif veren biri varken mi kazandı (satırda "önce verdi" etiketi)? */
export function wonOnTie(r: BorsaRoundResult): boolean {
  if (r.winner === null) return false;
  return Object.entries(r.bids).some(([id, amount]) => id !== r.winner && amount === r.price && amount > 0);
}

/** Oyun içi puan: kâr = jeton + kutu değerleri − başlangıç jetonu. */
export const profitOf = (v: Pick<BorsaScreenView, "coins" | "boxes">, id: string): number =>
  (v.coins[id] ?? 0) + (v.boxes[id] ?? 0) - BORSA_START_COINS;

/** "+12", "−7", "0" (eksi işareti tipografik). */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

export type Verdict = "bargain" | "even" | "ripoff" | "cursed";

/** Kazananın tur sonucu: kelepir (kâr), başa baş, kazık (zarar) ya da lanet. */
export function verdictOf(r: BorsaRoundResult): { kind: Verdict; net: number } | null {
  if (r.winner === null) return null;
  const net = r.value - r.price;
  if (r.value < 0) return { kind: "cursed", net };
  return { kind: net > 0 ? "bargain" : net === 0 ? "even" : "ripoff", net };
}

/** Damga metni: "Kelepir! +15", "Başa baş", "Kazık! −7", "LANETLENDİ −64". */
export function verdictText(v: { kind: Verdict; net: number }): string {
  switch (v.kind) {
    case "bargain":
      return `Kelepir! ${signed(v.net)}`;
    case "even":
      return "Başa baş";
    case "ripoff":
      return `Kazık! ${signed(v.net)}`;
    case "cursed":
      return `LANETLENDİ ${signed(v.net)}`;
  }
}

/** Kârda en öndekiler (taç); en yüksek kâr 0'dan büyük değilse kimse. Eşitlikte hepsi. */
export function profitLeaders(v: Pick<BorsaScreenView, "coins" | "boxes" | "players">): string[] {
  const all = v.players.map((id) => ({ id, p: profitOf(v, id) }));
  const best = Math.max(...all.map((x) => x.p), 0);
  return best > 0 ? all.filter((x) => x.p === best).map((x) => x.id) : [];
}

/** Şerit için kısa ad: en çok 8 harf, taşarsa "…" (harf ortadan bölünmez, birleşik karakterler korunur). */
export function shortName(name: string, max = 8): string {
  const chars = Array.from(name.trim());
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : chars.join("");
}

export interface LedgerTile {
  round: number;
  state: "done" | "current" | "future";
  /** Açılmış turun değeri; açılmadıysa null. */
  value: number | null;
  winner: string | null;
  price: number;
  big: boolean;
}

/** Pazar defteri: her tur için kutucuk (açılmış, sıradaki, gelecek). */
export function ledgerTiles(v: Pick<BorsaScreenView, "history" | "round" | "rounds">): LedgerTile[] {
  return Array.from({ length: v.rounds }, (_, i) => {
    const h = v.history[i];
    return {
      round: i,
      state: h ? "done" : i === v.round ? "current" : "future",
      value: h ? h.value : null,
      winner: h ? h.winner : null,
      price: h ? h.price : 0,
      big: i === v.rounds - 1,
    };
  });
}

/** Son tur mu (Büyük Kutu)? */
export const isBigRound = (v: Pick<BorsaScreenView, "round" | "rounds">): boolean => v.round === v.rounds - 1;
