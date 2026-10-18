import type { CizgiPublicView, CizgiReveal, CizgiStatus, CizgiView } from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;

const STATUSES: readonly CizgiStatus[] = ["first", "second", "safe", "crashed", "none"];
const isStatus = (v: unknown): v is CizgiStatus => STATUSES.includes(v as CizgiStatus);

function parseReveal(v: unknown): CizgiReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !isRec(v.choices) || !isRec(v.status) || !isRec(v.points)) return undefined;
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
  return { choices, status, points };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type CizgiScreenView = CizgiPublicView & CizgiView;

/** Sunucudan gelen `publicView` bilinmez; Çizgiyi Geçme ortak görünümü olarak doğrulanır. */
export function parseCizgiPublicView(v: unknown): CizgiPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.revealEndsAt)) return null;
  const reveal = parseReveal(v.reveal);
  if (reveal === undefined) return null;
  return { startedAt: v.startedAt, endsAt: v.endsAt, revealEndsAt: v.revealEndsAt, reveal };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseCizgiPrivateView(v: unknown): CizgiView | null {
  if (!isRec(v)) return null;
  if (v.myChoice !== null && !isInt(v.myChoice, 0, 100)) return null;
  return { myChoice: v.myChoice };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseCizgiView(publicView: unknown, view: unknown): CizgiScreenView | null {
  const pub = parseCizgiPublicView(publicView);
  const priv = parseCizgiPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Platform sayısı: 0–9 … 90–99 ve 100. */
export const ZONE_COUNT = 11;

/** Bölge numarası (motordaki kuralla aynı): 100 tek elemanlı son bölgedir. */
export function zoneOf(value: number): number {
  return Math.floor(value / 10);
}

/** Bölgenin yazılı aralığı: "40–49", son bölge "100". */
export function zoneLabel(zone: number): string {
  return zone >= 10 ? "100" : `${zone * 10}–${zone * 10 + 9}`;
}

/** Bölge içindeki yükseklik oranı (0..1): pimin platform üzerindeki konumu. */
export function zoneFill(value: number): number {
  const z = zoneOf(value);
  return z >= 10 ? 1 : (value - z * 10) / 9;
}

/** Pimin tüm yoldaki yüksekliği (0..1, alttan yukarı). */
export function pinHeight(value: number): number {
  return Math.min(1, Math.max(0, value / 100));
}

/** Platformlar üstten alta sıralanır: üstte 100, altta 0–9. */
export function zonesTopDown(): number[] {
  return Array.from({ length: ZONE_COUNT }, (_, i) => ZONE_COUNT - 1 - i);
}

/** Bir bölgede kimler var (sonuç ekranı): bölge → oyuncu kimlikleri, seçim değerine göre azalan. */
export function groupByZone(reveal: CizgiReveal): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const [id, c] of Object.entries(reveal.choices)) {
    if (c === null) continue;
    const z = zoneOf(c);
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
