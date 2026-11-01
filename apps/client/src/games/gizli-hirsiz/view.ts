import {
  GIZLI_HIRSIZ_DURATION_MS,
  GIZLI_HIRSIZ_REVEAL_MS,
  GIZLI_HIRSIZ_SIGNAL_MS,
  type GizliHirsizChoice,
  type GizliHirsizPublicView,
  type GizliHirsizReveal,
  type GizliHirsizSignal,
  type GizliHirsizView,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every((t) => typeof t === "string");

function parseReveal(v: unknown): GizliHirsizReveal | null {
  if (!isRec(v) || !isStrList(v.thieves)) return null;
  if (!Array.isArray(v.pressedAt) || !v.pressedAt.every(isNum)) return null;
  if (v.pressedAt.length !== v.thieves.length) return null;
  if (v.outcome !== "solo" && v.outcome !== "multi" && v.outcome !== "none") return null;
  const scores = parseNumberRecord(v.scores);
  if (!scores) return null;
  return { thieves: [...v.thieves], pressedAt: [...v.pressedAt], outcome: v.outcome, scores };
}

const isSignal = (v: unknown): v is GizliHirsizSignal => v === "quiet" || v === "stir";

/** Sunucudan gelen `publicView` bilinmez; Gizli Hırsız ortak görünümü olarak doğrulanır. */
export function parseGizliHirsizPublicView(v: unknown): GizliHirsizPublicView | null {
  if (!isRec(v) || !isNum(v.startedAt) || !isNum(v.endsAt) || typeof v.finished !== "boolean") return null;
  if (!isStrList(v.decided)) return null;
  if (v.signalAt !== null && !isNum(v.signalAt)) return null;
  if (v.signal !== null && !isSignal(v.signal)) return null;
  let reveal: GizliHirsizReveal | null = null;
  if (v.reveal !== null) {
    reveal = parseReveal(v.reveal);
    if (!reveal) return null;
  }
  return {
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    finished: v.finished,
    decided: [...v.decided],
    signalAt: v.signalAt,
    signal: v.signal,
    reveal,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseGizliHirsizPrivateView(v: unknown): GizliHirsizView | null {
  if (!isRec(v)) return null;
  const c = v.choice;
  if (c !== null && c !== "steal" && c !== "pass") return null;
  return { choice: c as GizliHirsizChoice | null };
}

export type GizliHirsizScreenView = GizliHirsizPublicView & GizliHirsizView;

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseGizliHirsizView(publicView: unknown, view: unknown): GizliHirsizScreenView | null {
  const pub = parseGizliHirsizPublicView(publicView);
  const priv = parseGizliHirsizPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** GH-U8: genel sonuç şeridinin başlığı (360 px'te tek satır). */
export function revealHeadline(r: GizliHirsizReveal): string {
  if (r.outcome === "solo") return "Kasa soyuldu!";
  if (r.outcome === "multi") return `ALARM! ${r.thieves.length} hırsız`;
  return "Kimse çalmadı";
}

/** GH-U8: şeridin alt satırı. */
export function revealSubline(r: GizliHirsizReveal): string {
  if (r.outcome === "multi") return "Çalmayan kazanır";
  if (r.outcome === "none") return "Kasa sağlam kaldı";
  return "Tek hırsız +1";
}

/** GH-U5: açılışın son damgası. */
export function stampText(r: GizliHirsizReveal, nameOf: (id: string) => string): string {
  const first = r.thieves[0];
  if (r.outcome === "solo" && first !== undefined) return `SOYULDU! ${nameOf(first)} +1`;
  if (r.outcome === "multi") return "ALARM! −1";
  return "Kasa sağlam kaldı";
}

/** GH-U5: parmak izi sayacının cümlesi. */
export const printCountLine = (n: number): string => `Kasada ${n} parmak izi`;

/** Saniye (tam sayıya yuvarlanmış, en az 1). GH-U6. */
export const secondOf = (ms: number): number => Math.min(30, Math.max(1, Math.round(ms / 1000)));

/** GH-U6: zaman şeridindeki konum (%). */
export const stripPos = (ms: number): number =>
  Math.min(100, Math.max(0, (ms / GIZLI_HIRSIZ_DURATION_MS) * 100));

/** GH-U5: açılışın evreleri (açılış başından ms). */
export type OutroStep = "dark" | "door" | "count" | "crew" | "stamp";
export const OUTRO_DOOR_MS = 600;
export const OUTRO_COUNT_MS = 1_200;
export const OUTRO_CREW_MS = 2_000;

/** Her hırsızın açılış aralığı: kalabalıkta kısalır; açılış 4,5 sn'ye sığar. */
export const crewStepMs = (n: number): number => (n <= 5 ? 400 : 250);

/** Damganın geldiği an (açılış başından ms). */
export const stampAtMs = (n: number): number =>
  Math.min(GIZLI_HIRSIZ_REVEAL_MS - 500, OUTRO_CREW_MS + n * crewStepMs(n));

export function outroStep(elapsed: number, thieves: number): OutroStep {
  if (elapsed < OUTRO_DOOR_MS) return "dark";
  if (elapsed < OUTRO_COUNT_MS) return "door";
  if (elapsed < OUTRO_CREW_MS) return "count";
  if (thieves > 0 && elapsed < stampAtMs(thieves)) return "crew";
  return "stamp";
}

/** Açılışta kaç hırsızın göründüğü. */
export function crewShown(elapsed: number, thieves: number): number {
  if (elapsed < OUTRO_CREW_MS) return 0;
  return Math.min(thieves, Math.floor((elapsed - OUTRO_CREW_MS) / crewStepMs(thieves)) + 1);
}

/**
 * GH-U1: koltuklar. Kendin en altta ortada; diğerleri kasanın üstünde yarım daire üzerinde (soldan sağa oyuncu sırası
 * seni izler). `selfId` katılımcı değilse (izleyici, TV) herkes yarım daireye dizilir. Konumlar kutunun %'si.
 */
export interface Seat {
  id: string;
  x: number;
  y: number;
  self: boolean;
}
export function seatArc(ids: readonly string[], selfId: string): Seat[] {
  const mine = ids.indexOf(selfId);
  const others = mine >= 0 ? [...ids.slice(mine + 1), ...ids.slice(0, mine)] : [...ids];
  const m = others.length;
  const seats: Seat[] = others.map((id, i) => {
    // Kendin yoksa (izleyici, TV) koltuklar kasanın çevresinde alt boşluk dışında dağılır.
    const deg = mine >= 0 ? 180 + ((i + 1) * 180) / (m + 1) : 140 + ((i + 0.5) * 260) / m;
    const a = (deg * Math.PI) / 180;
    return { id, x: 50 + 44 * Math.cos(a), y: 52 + 46 * Math.sin(a), self: false };
  });
  if (mine >= 0) seats.push({ id: selfId, x: 50, y: 96, self: true });
  return seats;
}

/** Ad en çok 8 harf; uzunsa "…". */
export function shortName(name: string, max = 8): string {
  const chars = Array.from(name);
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : name;
}

/** GH-U12: "4/6 karar verdi". */
export const decidedLine = (decided: number, total: number): string => `${decided}/${total} karar verdi`;

/** GH-M2 / GH-U9: işaretin yazısı. */
export const signalText = (s: GizliHirsizSignal): string =>
  s === "stir" ? "Kasada kıpırtı var!" : "Kasa sessiz";

export interface HeadInput {
  spectator: boolean;
  choice: GizliHirsizChoice | null;
  /** Oyun aşaması bitti (açılış başladı). */
  over: boolean;
  /** İşaret verilecek mi (3+ oyuncu). */
  hasSignal: boolean;
}

/** GH-U2 / GH-U12: başlık ve alt yazı (zamanın rolüne göre). İşaret ayrı bir satırda gösterilir. */
export function headOf(i: HeadInput): { head: string; sub: string } {
  if (i.over) return { head: "Süre doldu! Kasa açılıyor…", sub: "" };
  if (i.spectator) return { head: "Kasayı izliyorsun · Kim çalacak?", sub: "" };
  if (i.choice !== null) return { head: "Kararın kayıtlı", sub: "Kimin çaldığı süre bitince belli olur" };
  return {
    head: "Çal ya da bekle",
    sub: i.hasSignal ? "Erken çalan kasaya ilk el koyar" : "Kimin çaldığı süre bitince belli olur",
  };
}

/** GH-U5: parmak izi sayacının o anki değeri (her rakam 150 ms). */
export function shownCount(elapsed: number, n: number): number {
  if (elapsed < OUTRO_COUNT_MS) return 0;
  return Math.min(n, Math.floor((elapsed - OUTRO_COUNT_MS) / 150));
}

/** GH-M2 / GH-U5: işarete sebep olan (15. saniyeden önce çalan) hırsız. */
export const stirredBy = (ms: number, signal: GizliHirsizSignal | null): boolean =>
  signal === "stir" && ms < GIZLI_HIRSIZ_SIGNAL_MS;
