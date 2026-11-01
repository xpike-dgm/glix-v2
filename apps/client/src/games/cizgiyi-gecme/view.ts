import {
  CIZGI_MAX,
  type CizgiPublicView,
  type CizgiRadar,
  type CizgiReveal,
  type CizgiStatus,
  type CizgiView,
  cizgiPeakZone,
  cizgiScore,
  cizgiZone,
  cizgiZoneRange,
} from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

/** Bölge genişliği olarak kabul edilen aralık (motor tablosu 4–25; doğrulama biraz geniş tutulur). */
const WIDTH_MIN = 2;
const WIDTH_MAX = 50;
const ROUNDS_MAX = 4;
const PLAYERS_MAX = 64;

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
    if (!isId(id) || (c !== null && !isInt(c, 0, CIZGI_MAX))) return undefined;
    const s = v.status[id];
    const p = v.points[id];
    if (!isStatus(s) || !isInt(p, 0, 2)) return undefined;
    // Seçmeyen "none", seçen "none" olamaz.
    if ((c === null) !== (s === "none")) return undefined;
    choices[id] = c;
    status[id] = s;
    points[id] = p;
  }
  const n = Object.keys(choices).length;
  if (n > PLAYERS_MAX || Object.keys(v.status).length !== n || Object.keys(v.points).length !== n)
    return undefined;
  return { zoneWidth: v.zoneWidth, choices, status, points };
}

function parseRadar(v: unknown, width: number): CizgiRadar | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !isNum(v.at) || !Array.isArray(v.zones) || v.zones.length > 64) return undefined;
  const peak = cizgiPeakZone(width);
  const zones: number[] = [];
  for (const z of v.zones) {
    if (!isInt(z, 0, peak)) return undefined;
    zones.push(z);
  }
  return { at: v.at, zones };
}

function parseScores(v: unknown, max: number): Record<string, number> | undefined {
  if (!isRec(v) || Object.keys(v).length > PLAYERS_MAX) return undefined;
  const out: Record<string, number> = {};
  for (const [id, x] of Object.entries(v)) {
    if (!isId(id) || !isInt(x, 0, max)) return undefined;
    out[id] = x;
  }
  return out;
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type CizgiScreenView = CizgiPublicView & CizgiView;

/** Sunucudan gelen `publicView` bilinmez; Çizgiyi Geçme ortak görünümü olarak doğrulanır. */
export function parseCizgiPublicView(v: unknown): CizgiPublicView | null {
  if (!isRec(v)) return null;
  const times = [v.startedAt, v.roundStartedAt, v.endsAt, v.revealEndsAt];
  if (!times.every(isNum)) return null;
  if (!isInt(v.zoneWidth, WIDTH_MIN, WIDTH_MAX)) return null;
  if (!isInt(v.rounds, 1, ROUNDS_MAX) || !isInt(v.round, 1, v.rounds)) return null;
  if (v.radarAt !== null && !isNum(v.radarAt)) return null;
  const radar = parseRadar(v.radar, v.zoneWidth);
  if (radar === undefined) return null;
  const reveal = parseReveal(v.reveal);
  if (reveal === undefined) return null;
  if (!Array.isArray(v.history) || v.history.length > ROUNDS_MAX) return null;
  const history: CizgiReveal[] = [];
  for (const h of v.history) {
    const r = parseReveal(h);
    if (!r) return null;
    history.push(r);
  }
  const totals = parseScores(v.totals, 2 * ROUNDS_MAX);
  if (!totals) return null;
  let final: Record<string, number> | null = null;
  if (v.final !== null) {
    const f = parseScores(v.final, 2);
    if (!f) return null;
    final = f;
  }
  if (!Array.isArray(v.lockedIds) || v.lockedIds.length > PLAYERS_MAX) return null;
  const lockedIds: string[] = [];
  for (const id of v.lockedIds) {
    if (!isId(id)) return null;
    lockedIds.push(id);
  }
  return {
    startedAt: v.startedAt as number,
    roundStartedAt: v.roundStartedAt as number,
    zoneWidth: v.zoneWidth,
    endsAt: v.endsAt as number,
    revealEndsAt: v.revealEndsAt as number,
    round: v.round,
    rounds: v.rounds,
    radarAt: v.radarAt,
    radar,
    history,
    totals,
    reveal,
    final,
    lockedIds,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseCizgiPrivateView(v: unknown): CizgiView | null {
  if (!isRec(v)) return null;
  if (v.myChoice !== null && !isInt(v.myChoice, 0, CIZGI_MAX)) return null;
  if (typeof v.locked !== "boolean") return null;
  return { myChoice: v.myChoice, locked: v.locked };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseCizgiView(publicView: unknown, view: unknown): CizgiScreenView | null {
  const pub = parseCizgiPublicView(publicView);
  const priv = parseCizgiPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

// ——— Platformlar ———

/** Platform sayısı: 0–99'un platformları + Zirve (CZ-M4). */
export function zoneCount(width: number): number {
  return cizgiPeakZone(width) + 1;
}

/** Bölge numarası (motordaki kuralla aynı). */
export function zoneOf(value: number, width: number): number {
  return cizgiZone(value, width);
}

export function isPeak(zone: number, width: number): boolean {
  return zone >= cizgiPeakZone(width);
}

/** Bölgenin yazılı aralığı: "40–49"; tek sayılık bölge "100". */
export function zoneLabel(zone: number, width: number): string {
  const { from, to } = cizgiZoneRange(zone, width);
  return from === to ? String(from) : `${from}–${to}`;
}

/** Platformlar üstten alta sıralanır: üstte Zirve, altta 0'dan başlayan platform. */
export function zonesTopDown(width: number): number[] {
  const n = zoneCount(width);
  return Array.from({ length: n }, (_, i) => n - 1 - i);
}

/** Çok sayıda platform (5+ kişi): kule onluk kuşaklara ayrılır (CZ-U2). */
export function isDense(width: number): boolean {
  return zoneCount(width) > 11;
}

/** Bölgenin onluk kuşağı (0–9 → 0, 90–99 → 9, Zirve → 10). */
export function decadeOf(zone: number, width: number): number {
  return Math.floor(cizgiZoneRange(zone, width).from / 10);
}

const DECADE_SUFFIX = ["", "'lar", "'ler", "'lar", "'lar", "'ler", "'lar", "'ler", "'ler", "'lar"];

/**
 * Yoğun kulede kuşak etiketi (CZ-U2): her kuşağın ortasındaki platformda "90'lar"; diğer platformlarda null.
 * 0–9 kuşağı "0–9", Zirve "Zirve".
 */
export function bandLabel(zone: number, width: number): string | null {
  if (isPeak(zone, width)) return "Zirve";
  for (let d = 0; d <= 9; d++) {
    if (zoneOf(d * 10 + 5, width) !== zone) continue;
    return d === 0 ? "0–9" : `${d * 10}${DECADE_SUFFIX[d] ?? "'lar"}`;
  }
  return null;
}

/** Platform darlığı (CZ-U3): 2 kişide geniş, 3–4 kişide orta, 5+ kişide dar. */
export function widthWord(players: number): "geniş" | "orta" | "dar" {
  return players <= 2 ? "geniş" : players <= 4 ? "orta" : "dar";
}

/** Kulede pinin dikey yeri (0 alt, 1 üst): platformun ortasında, platform içinde sayıya göre hafif kayık. */
export function towerRatio(value: number, width: number): number {
  const z = zoneOf(value, width);
  const { from, to } = cizgiZoneRange(z, width);
  const f = to === from ? 0.5 : 0.15 + (0.7 * (value - from)) / (to - from);
  return (z + f) / zoneCount(width);
}

/** Kuleye dokunulan yükseklikten sayı (CZ-U1): `ratio` 0 alt, 1 üst. `towerRatio`nun tersidir. */
export function valueAtRatio(ratio: number, width: number): number {
  const n = zoneCount(width);
  const r = Math.min(1, Math.max(0, ratio)) * n;
  const z = Math.min(n - 1, Math.floor(r));
  const { from, to } = cizgiZoneRange(z, width);
  if (from === to) return from;
  const f = Math.min(1, Math.max(0, (r - z - 0.15) / 0.7));
  return from + Math.round(f * (to - from));
}

/** Ad kısaltma (sonuç çipleri, TV). */
export function shortName(name: string, max = 8): string {
  const chars = Array.from(name.trim());
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : chars.join("");
}

export function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? "?").toLocaleUpperCase("tr");
}

// ——— Sonuç ———

/** Bir bölgede kimler var: bölge → oyuncu kimlikleri, seçim değerine göre azalan. */
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

/** Kendi sonucun büyük yazısı (CZ-U9). */
export function myHeadline(reveal: CizgiReveal, selfId: string): { text: string; kind: CizgiStatus } {
  const st = statusOf(reveal, selfId);
  const v = reveal.choices[selfId];
  if (st === "first") return { text: v === CIZGI_MAX ? "+2 ZİRVEDEN!" : "+2 BİRİNCİ", kind: st };
  if (st === "second") return { text: "+1 İKİNCİ", kind: st };
  if (st === "safe") return { text: "TEK KALDIN", kind: st };
  if (st === "crashed") return { text: "ÇARPIŞTIN", kind: st };
  return { text: "SEÇMEDİN", kind: st };
}

/** Masanın özeti (CZ-U9): "3 çarpışan · 2 tek kalan · en yüksek tek: Cihad 72". */
export function tableLine(reveal: CizgiReveal, nameOf: (id: string) => string): string {
  const ids = Object.keys(reveal.choices);
  const crashed = ids.filter((id) => reveal.status[id] === "crashed").length;
  const alone = ids.filter((id) => ["first", "second", "safe"].includes(reveal.status[id] ?? "none"));
  const first = ids.find((id) => reveal.status[id] === "first");
  if (ids.every((id) => reveal.choices[id] === null)) return "Kimse sayı seçmedi.";
  if (first === undefined) return "Herkes çarpıştı! Kimse puan alamadı.";
  const parts: string[] = [];
  if (crashed > 0) parts.push(`${crashed} çarpışan`);
  parts.push(`${alone.length} tek kalan`);
  parts.push(`en yüksek tek: ${nameOf(first)} ${reveal.choices[first]}`);
  return parts.join(" · ");
}

/** Bir aralığın yazısı: "84–90" ya da "100". */
const rangeText = (from: number, to: number): string => (from === to ? String(from) : `${from}–${to}`);

/**
 * "Ne olurdu?" satırı (CZ-U8): her X için senin seçimin X olsaydı sonuç yeniden hesaplanır (senin uzaklaşmanla
 * çarpıştığın kişinin tek kalması dahil). En iyi puanı veren X'lerden kendi sayına en yakın kesintisiz aralık yazılır.
 * `selfId` null (izleyici/TV): "En yüksek boş platform: …".
 */
export function whatIfLine(reveal: CizgiReveal, selfId: string | null): string {
  const width = reveal.zoneWidth;
  const ids = Object.keys(reveal.choices);
  const others = (id: string | null) =>
    ids.filter((x) => x !== id && reveal.choices[x] !== null).map((x) => reveal.choices[x] as number);
  if (selfId === null || !ids.includes(selfId)) {
    const used = new Set(others(null).map((v) => zoneOf(v, width)));
    const free = zonesTopDown(width).find((z) => !used.has(z));
    if (free === undefined) return "Boş platform kalmadı.";
    return isPeak(free, width)
      ? "Zirve (100) boş kaldı."
      : `En yüksek boş platform: ${zoneLabel(free, width)}.`;
  }
  const mine = reveal.choices[selfId];
  if (mine === null || mine === undefined) return "Seçmedin, pasif kaldın.";
  const st = statusOf(reveal, selfId);
  const myZone = zoneOf(mine, width);
  if (st === "first") {
    const used = new Set(others(selfId).map((v) => zoneOf(v, width)));
    const higher = zonesTopDown(width)
      .filter((z) => z > myZone && !used.has(z))
      .sort((a, b) => a - b)[0];
    if (higher === undefined) return "Daha iyisi yoktu.";
    const label = isPeak(higher, width) ? "Zirve (100)" : zoneLabel(higher, width);
    return `Üstündeki ilk boş platform: ${label}. Biraz daha cesur olabilirdin.`;
  }
  const pts: number[] = [];
  for (let x = 0; x <= CIZGI_MAX; x++) {
    pts.push(cizgiScore(ids, { ...reveal.choices, [selfId]: x }, width).points[selfId] ?? 0);
  }
  const best = Math.max(...pts);
  const now = pointsOf(reveal, selfId);
  if (best <= now) return st === "second" ? "Daha iyisi yoktu." : "Bu turda hiçbir sayı puan getirmezdi.";
  // En iyi puanı veren kesintisiz aralıklar; kendi sayına en yakın olanı.
  const runs: { from: number; to: number }[] = [];
  for (let x = 0; x <= CIZGI_MAX; x++) {
    if (pts[x] !== best) continue;
    const last = runs[runs.length - 1];
    if (last && last.to === x - 1) last.to = x;
    else runs.push({ from: x, to: x });
  }
  const dist = (r: { from: number; to: number }) =>
    mine < r.from ? r.from - mine : mine > r.to ? mine - r.to : 0;
  const run = runs.reduce((a, b) => (dist(b) < dist(a) ? b : a));
  const text = rangeText(run.from, run.to);
  const arasi = run.from === run.to ? "" : " arası";
  if (st === "crashed") {
    const zoneOfRun = zoneOf(run.from, width);
    const sameZone = zoneOf(run.to, width) === zoneOfRun;
    if (sameZone && zoneOfRun === myZone - 1) return `Bir platform aşağıda (${text}) tek kalırdın: +${best}.`;
    if (sameZone && zoneOfRun === myZone + 1)
      return `Bir platform yukarıda (${text}) tek kalırdın: +${best}.`;
    return `${text}${arasi} yazsaydın tek kalırdın: +${best}.`;
  }
  return `${text}${arasi} yazsaydın ${best >= 2 ? "birinci" : "ikinci"} olurdun.`;
}

// ——— Açılış zaman çizelgesi (CZ-U6) ———

export interface ClimbPin {
  id: string;
  value: number;
  zone: number;
  /** Tırmanmaya başladığı ve platformuna oturduğu an (açılıştan itibaren ms). */
  startAt: number;
  seatAt: number;
}

export interface ClimbPlan {
  pins: ClimbPin[];
  /** Platform → çarpışmanın olduğu an (ikinci pinin oturduğu an). */
  crashAt: Map<number, number>;
  /** En yüksek tek kalanın fırladığı an. */
  launchAt: number;
  /** Başlık ve puanların göründüğü an. */
  pointsAt: number;
  /** "Ne olurdu?" satırının göründüğü an. */
  whatIfAt: number;
}

/** Pinler en düşükten en yükseğe tek tek tırmanır; eşit sayılar (katılım sırası) aynı anda oturur. */
export function climbPlan(
  reveal: CizgiReveal,
  order: readonly string[],
  reduced: boolean,
  interim: boolean,
): ClimbPlan {
  const width = reveal.zoneWidth;
  const ids = [
    ...order.filter((id) => id in reveal.choices),
    ...Object.keys(reveal.choices).filter((id) => !order.includes(id)),
  ];
  const chosen = ids.filter((id) => reveal.choices[id] !== null);
  // `sort` kararlıdır: eşitlerde katılım sırası korunur.
  chosen.sort((a, b) => (reveal.choices[a] ?? 0) - (reveal.choices[b] ?? 0));
  const step = interim ? 250 : 350;
  const climb = interim ? 380 : 500;
  const pins: ClimbPin[] = [];
  let k = -1;
  let prev: number | null = null;
  for (const id of chosen) {
    const value = reveal.choices[id] as number;
    if (value !== prev) k++;
    prev = value;
    const startAt = reduced ? 0 : 300 + k * step;
    pins.push({ id, value, zone: zoneOf(value, width), startAt, seatAt: reduced ? 0 : startAt + climb });
  }
  const crashAt = new Map<number, number>();
  const seen = new Map<number, number>();
  for (const p of pins) {
    const n = (seen.get(p.zone) ?? 0) + 1;
    seen.set(p.zone, n);
    if (n === 2) crashAt.set(p.zone, reduced ? 400 : p.seatAt);
  }
  const lastSeat = pins.reduce((m, p) => Math.max(m, p.seatAt), 0);
  const launchAt = reduced ? 800 : lastSeat + (interim ? 250 : 300);
  const pointsAt = reduced ? 800 : launchAt + (interim ? 300 : 400);
  const whatIfAt = reduced ? 1_200 : pointsAt + (interim ? 300 : 450);
  return { pins, crashAt, launchAt, pointsAt, whatIfAt };
}

export type PinPhase = "wait" | "climb" | "seat";

/** Pinin `elapsed` anındaki hâli: tırmanış oranı (0..1) ve sayaç gibi akan sayı. */
export function pinAt(pin: ClimbPin, elapsed: number): { phase: PinPhase; progress: number; shown: number } {
  if (elapsed < pin.startAt) return { phase: "wait", progress: 0, shown: 0 };
  if (elapsed >= pin.seatAt) return { phase: "seat", progress: 1, shown: pin.value };
  const p = (elapsed - pin.startAt) / Math.max(1, pin.seatAt - pin.startAt);
  return { phase: "climb", progress: p, shown: Math.round(pin.value * p) };
}
