import {
  LATE_ACTION_GRACE_MS,
  ZEHIRLI_KADEH_REVEAL,
  type ZehirliKadehCheck,
  type ZehirliKadehPublicView,
  type ZehirliKadehResult,
  type ZehirliKadehSwap,
  type ZehirliKadehView,
} from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Kadeh rengi: başlangıçtaki sahibinin sırasına göre (oyuncu renk dizisiyle aynı sıra). */
export const CUP_COLORS = [
  "#2EF2FF",
  "#FF2BD6",
  "#FFC23B",
  "#B6FF3B",
  "#8B5CFF",
  "#FF8A3B",
  "#2BFFA8",
  "#3B7BFF",
] as const;

export function cupColor(cup: number): string {
  return CUP_COLORS[((cup % 8) + 8) % 8] ?? CUP_COLORS[0];
}

function parseSwaps(v: unknown): ZehirliKadehSwap[] | null {
  if (!Array.isArray(v)) return null;
  const out: ZehirliKadehSwap[] = [];
  for (const s of v) {
    if (!isRec(s) || !isNum(s.seq) || typeof s.from !== "string" || typeof s.to !== "string" || !isNum(s.at))
      return null;
    out.push({ seq: s.seq, from: s.from, to: s.to, at: s.at });
  }
  return out;
}

function parseResult(v: unknown): ZehirliKadehResult | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !isStrArr(v.clean) || !isStrArr(v.poisoned)) return undefined;
  if (!Array.isArray(v.poisonedCups) || !v.poisonedCups.every(isNum)) return undefined;
  return { clean: v.clean, poisoned: v.poisoned, poisonedCups: v.poisonedCups as number[] };
}

/** Sunucudan gelen `publicView` bilinmez; Zehirli Kadeh ortak görünümü olarak doğrulanır. */
export function parseZehirliKadehPublicView(v: unknown): ZehirliKadehPublicView | null {
  if (!isRec(v) || !isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.poisonCount)) return null;
  if (!isStrArr(v.players) || !isStrArr(v.swapped) || typeof v.ended !== "boolean") return null;
  if (!isRec(v.holdings)) return null;
  const holdings: Record<string, number> = {};
  for (const [id, cup] of Object.entries(v.holdings)) {
    if (!isNum(cup)) return null;
    holdings[id] = cup;
  }
  const swaps = parseSwaps(v.swaps);
  const result = parseResult(v.result);
  if (!swaps || result === undefined) return null;
  return {
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    players: v.players,
    holdings,
    swapped: v.swapped,
    swaps,
    poisonCount: v.poisonCount,
    ended: v.ended,
    result,
  };
}

function parseCheck(v: unknown): ZehirliKadehCheck | null | undefined {
  if (v === null || v === undefined) return null;
  if (!isRec(v) || !isNum(v.cup) || !Number.isInteger(v.cup) || v.cup < 0 || typeof v.poisoned !== "boolean")
    return undefined;
  return { cup: v.cup, poisoned: v.poisoned };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. İzleyicinin kontrol sonucu olamaz. */
export function parseZehirliKadehPrivateView(v: unknown): ZehirliKadehView | null {
  if (!isRec(v)) return null;
  if (v.role !== "player" && v.role !== "spectator") return null;
  const check = parseCheck(v.check);
  if (check === undefined || (v.role === "spectator" && check !== null)) return null;
  return { role: v.role, check };
}

export interface ZehirliKadehScreenView {
  pub: ZehirliKadehPublicView;
  priv: ZehirliKadehView;
}

export function parseZehirliKadehView(publicView: unknown, view: unknown): ZehirliKadehScreenView | null {
  const pub = parseZehirliKadehPublicView(publicView);
  const priv = parseZehirliKadehPrivateView(view);
  return pub && priv ? { pub, priv } : null;
}

/** Kalan süre oranı (0–1) ve takasların eklediği amber payın oranı. */
export function clockFractions(
  startedAt: number,
  endsAt: number,
  swaps: number,
  now: number,
): { left: number; bonus: number } {
  const total = Math.max(1, endsAt - startedAt);
  return {
    left: Math.min(1, Math.max(0, (endsAt - now) / total)),
    bonus: Math.min(1, (swaps * 5000) / total),
  };
}

/** Kalan tam saniye (yukarı yuvarlanır). */
export function secondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** Son saniyeler gerilimi (mum titrer, kalp atışı, masa kararır) bu kadar saniye kala başlar. */
export const ZK_TENSE_SECS = 5;

/** Takas anında üstte görünen "Mert ⇄ Elif" şeridinin süresi ve kadehlerin yay çizerek yer değiştirme süresi (ms). */
export const ZK_SWAP_BANNER_MS = 2_000;
export const ZK_SWAP_FLIGHT_MS = 720;
/** Kontrol anında kadehin sana gizlice "açılma" animasyonunun süresi (ms). */
export const ZK_PEEK_MS = 1_400;

export function isTense(endsAt: number, now: number, ended: boolean): boolean {
  return !ended && now < endsAt && endsAt - now <= ZK_TENSE_SECS * 1000;
}

/** Ziyafet masasındaki bir koltuk: kadehin ve sahibinin (avatar + ad) masaya göre konumu (yüzde). */
export interface Seat {
  /** Kadehin masadaki yeri. */
  cx: number;
  cy: number;
  /** Sahibinin (avatar) yeri: kadehin arkasında, masanın dışında. */
  ax: number;
  ay: number;
  side: "l" | "r" | "head";
}

/**
 * Uzun masa (dikey, yukarıdan bakış): oyuncular sırayla sol-sağ karşılıklı oturur; tek sayıda oyuncuda sonuncu
 * masanın başına (alt uç) oturur. Sıra herkes için aynıdır (oyuncu sırası), TV ile telefonlar aynı masayı gösterir.
 */
export function seatLayout(n: number): Seat[] {
  const count = Math.max(0, Math.min(8, Math.trunc(n)));
  const pairs = Math.floor(count / 2);
  const head = count % 2 === 1;
  const rows = pairs + (head ? 1 : 0);
  // Kadehler sahiplerinin hemen önünde (masanın kenarında); az oyuncuda kadehler daha büyük olduğundan biraz içeride.
  const cupX = count <= 3 ? 32 : 30;
  const top = 3;
  const span = head ? 86 : 94;
  const rowH = rows > 0 ? span / (head ? rows - 0.35 : rows) : span;
  const seats: Seat[] = [];
  for (let i = 0; i < count; i++) {
    if (head && i === count - 1) {
      seats.push({
        cx: 50,
        cy: Math.min(top + (rows - 1) * rowH + rowH * 0.32, 80),
        ax: 50,
        ay: 94,
        side: "head",
      });
      continue;
    }
    const row = Math.floor(i / 2);
    const left = i % 2 === 0;
    const y = top + (row + 0.5) * rowH;
    seats.push({ cx: left ? cupX : 100 - cupX, cy: y, ax: left ? 9 : 91, ay: y, side: left ? "l" : "r" });
  }
  return seats;
}

/** Bir kadehin şu an hangi koltukta (sahibinin önünde) durduğu: holdings tersine çevrilir. */
export function cupSeats(players: readonly string[], holdings: Record<string, number>): Map<number, number> {
  const out = new Map<number, number>();
  players.forEach((id, seat) => {
    const cup = holdings[id];
    if (cup !== undefined) out.set(cup, seat);
  });
  return out;
}

/** Mum: kalan süre oranı (0–1). Her takas bitişi 5 sn uzattığından oran artar: mum uzar. */
export function candleLeft(startedAt: number, endsAt: number, now: number): number {
  return clockFractions(startedAt, endsAt, 0, now).left;
}

/**
 * "Şerefe!" açılış evresinin zaman çizelgesi: motordaki tek sabit (`ZEHIRLI_KADEH_REVEAL`). Evre süre bitişinde
 * başlar ve sabit sürer; oyun evrenin sonunda biter.
 */
export const ZK_REVEAL = ZEHIRLI_KADEH_REVEAL;

/** Açılış evresinin başı (sunucu saatiyle): oyun saati geç eylem payı kadar geriden gelir. */
export const revealStart = (endsAt: number): number => endsAt + LATE_ACTION_GRACE_MS;

/** Küçük, belirli (her cihazda aynı) karıştırma: maçtan türetilen tohumla. */
function seeded(seed: number): () => number {
  let x = seed >>> 0 || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0x1_0000_0000;
  };
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Açılış sırası ve her kadehin açılma anı: rastgele sıra, senin kadehin EN SON (katılımcıysan). Aynı tohumla
 * aynı sıra çıkar; ekran yeniden çizilince ya da yeniden bağlanınca sıra değişmez.
 */
export function revealPlan(
  players: readonly string[],
  selfId: string,
  seed: number,
): { order: string[]; at: Record<string, number>; doneMs: number } {
  const rnd = seeded(seed);
  const others = players.filter((id) => id !== selfId);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [others[i], others[j]] = [others[j] as string, others[i] as string];
  }
  const mine = players.includes(selfId);
  const order = mine ? [...others, selfId] : others;
  const at: Record<string, number> = {};
  // Kadehler arası aralık: evreye sığacak kadar; az oyuncuda daha ağır çekim (en çok maxStepMs).
  const room = ZK_REVEAL.totalMs - ZK_REVEAL.cheersMs - ZK_REVEAL.selfPauseMs - ZK_REVEAL.holdMs;
  const step = Math.min(ZK_REVEAL.maxStepMs, Math.floor(room / Math.max(1, order.length)));
  let t = ZK_REVEAL.cheersMs;
  order.forEach((id, i) => {
    if (mine && i === order.length - 1 && i > 0) t += ZK_REVEAL.selfPauseMs;
    at[id] = t;
    t += step;
  });
  return { order, at, doneMs: t };
}
