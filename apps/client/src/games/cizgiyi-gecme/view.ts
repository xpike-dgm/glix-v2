import {
  type CizgiPublicView,
  type CizgiReveal,
  type CizgiStatus,
  type CizgiView,
  cizgiZone,
  cizgiZoneRange,
} from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;

/** Bölge genişliği olarak kabul edilen aralık (motor tablosu 4–25; doğrulama biraz geniş tutulur). */
const WIDTH_MIN = 2;
const WIDTH_MAX = 50;

const STATUSES: readonly CizgiStatus[] = ["first", "second", "safe", "crashed", "none"];
const isStatus = (v: unknown): v is CizgiStatus => STATUSES.includes(v as CizgiStatus);

function parseReveal(v: unknown): CizgiReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !isInt(v.zoneWidth, WIDTH_MIN, WIDTH_MAX)) return undefined;
  if (!isRec(v.choices) || !isRec(v.status) || !isRec(v.points)) return undefined;
  const choices: Record<string, number | null> = {};
  const status: Record<string, CizgiStatus> = {};
  const points: Record<string, number> = {};
  for (const [id, c] of Object.entries(v.choices)) {
    if (c !== null && !isInt(c, 0, 100)) return undefined;
    const s = v.status[id];
    const p = v.points[id];
    if (!isStatus(s) || !isInt(p, 0, 2)) return undefined;
    // Seçmeyen "none", seçen "none" olamaz.
    if ((c === null) !== (s === "none")) return undefined;
    choices[id] = c;
    status[id] = s;
    points[id] = p;
  }
  if (Object.keys(v.status).length !== Object.keys(choices).length) return undefined;
  if (Object.keys(v.points).length !== Object.keys(choices).length) return undefined;
  return { zoneWidth: v.zoneWidth, choices, status, points };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type CizgiScreenView = CizgiPublicView & CizgiView;

/** Sunucudan gelen `publicView` bilinmez; Çizgiyi Geçme ortak görünümü olarak doğrulanır. */
export function parseCizgiPublicView(v: unknown): CizgiPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.revealEndsAt)) return null;
  if (!isInt(v.zoneWidth, WIDTH_MIN, WIDTH_MAX)) return null;
  const reveal = parseReveal(v.reveal);
  if (reveal === undefined) return null;
  if (!Array.isArray(v.lockedIds) || v.lockedIds.length > 64) return null;
  const lockedIds: string[] = [];
  for (const id of v.lockedIds) {
    if (typeof id !== "string" || id.length > 64) return null;
    lockedIds.push(id);
  }
  return {
    startedAt: v.startedAt,
    zoneWidth: v.zoneWidth,
    endsAt: v.endsAt,
    revealEndsAt: v.revealEndsAt,
    reveal,
    lockedIds,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseCizgiPrivateView(v: unknown): CizgiView | null {
  if (!isRec(v)) return null;
  if (v.myChoice !== null && !isInt(v.myChoice, 0, 100)) return null;
  if (typeof v.locked !== "boolean") return null;
  return { myChoice: v.myChoice, locked: v.locked };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseCizgiView(publicView: unknown, view: unknown): CizgiScreenView | null {
  const pub = parseCizgiPublicView(publicView);
  const priv = parseCizgiPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Platform (bölge) sayısı: `⌊100 ÷ genişlik⌋ + 1` (100 son bölgeye düşer). */
export function zoneCount(width: number): number {
  return cizgiZone(100, width) + 1;
}

/** Bölge numarası (motordaki kuralla aynı): `⌊sayı ÷ genişlik⌋`. */
export function zoneOf(value: number, width: number): number {
  return cizgiZone(value, width);
}

/** Bölgenin yazılı aralığı: "40–49"; tek sayılık son bölge "100". */
export function zoneLabel(zone: number, width: number): string {
  const { from, to } = cizgiZoneRange(zone, width);
  return from === to ? String(from) : `${from}–${to}`;
}

/** Bölge içindeki yükseklik oranı (0..1): pimin platform üzerindeki konumu. */
export function zoneFill(value: number, width: number): number {
  const z = zoneOf(value, width);
  const { from, to } = cizgiZoneRange(z, width);
  return to === from ? 1 : (value - from) / (to - from);
}

/** Pimin tüm yoldaki yüksekliği (0..1, alttan yukarı). */
export function pinHeight(value: number): number {
  return Math.min(1, Math.max(0, value / 100));
}

/** Platformlar üstten alta sıralanır: üstte 100, altta 0–9. */
export function zonesTopDown(width: number): number[] {
  const n = zoneCount(width);
  return Array.from({ length: n }, (_, i) => n - 1 - i);
}

/** Çok sayıda platform (genişlik < 10): kule sıkıştırılır, boş platformlar sonuçta gizlenir. */
export function isDense(width: number): boolean {
  return zoneCount(width) > 11;
}

/** Bir bölgede kimler var (sonuç ekranı): bölge → oyuncu kimlikleri, seçim değerine göre azalan. */
export function groupByZone(reveal: CizgiReveal): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const [id, c] of Object.entries(reveal.choices)) {
    if (c === null) continue;
    const z = zoneOf(c, reveal.zoneWidth);
    out.set(z, [...(out.get(z) ?? []), id]);
  }
  for (const [z, ids] of out) {
    out.set(
      z,
      ids.sort((a, b) => (reveal.choices[b] ?? 0) - (reveal.choices[a] ?? 0)),
    );
  }
  return out;
}

export function pointsOf(reveal: CizgiReveal, playerId: string): number {
  return reveal.points[playerId] ?? 0;
}

export function statusOf(reveal: CizgiReveal, playerId: string): CizgiStatus {
  return reveal.status[playerId] ?? "none";
}
