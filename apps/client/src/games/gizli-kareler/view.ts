import {
  KARELER_BAND_MS,
  type KareBonus,
  type KareHint,
  type KarelerPublicView,
  type KarelerView,
  type KareReveal,
  type KareReveal2,
  type KareStage2,
  type KareStatus,
} from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;
const isIds = (v: unknown): v is string[] => Array.isArray(v) && v.every((p) => typeof p === "string");

const STAGE1_STATUSES: readonly KareStatus[] = ["solo", "clash", "passive"];
/** 2. aşamada ayrıca "hayalete çarptı" (GK-M2). */
const STAGE2_STATUSES: readonly KareStatus[] = ["solo", "clash", "haunted", "passive"];

function parseReveal(
  v: unknown,
  cells: number,
  allowed: readonly KareStatus[],
): KareReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !isRec(v.choices) || !isRec(v.status)) return undefined;
  const choices: Record<string, number | null> = {};
  const status: Record<string, KareStatus> = {};
  for (const [id, c] of Object.entries(v.choices)) {
    if (c !== null && !isInt(c, 0, cells - 1)) return undefined;
    const s = v.status[id];
    if (!allowed.includes(s as KareStatus)) return undefined;
    // Seçmeyen pasiftir; seçen pasif olamaz.
    if ((c === null) !== (s === "passive")) return undefined;
    choices[id] = c;
    status[id] = s as KareStatus;
  }
  if (Object.keys(v.status).length !== Object.keys(choices).length) return undefined;
  return { choices, status };
}

const HALVES = ["top", "bottom", "left", "right"] as const;

/** Pusula ipucu (GK-M1); satır/sütun ızgara içinde olmalı, yarılar yalnız 4×4'te. */
export function parseHint(v: unknown, size: number): KareHint | null {
  if (!isRec(v)) return null;
  switch (v.kind) {
    case "notRow":
      return isInt(v.row, 0, size - 1) ? { kind: "notRow", row: v.row } : null;
    case "notCol":
      return isInt(v.col, 0, size - 1) ? { kind: "notCol", col: v.col } : null;
    case "corner":
    case "notCorner":
      return { kind: v.kind };
    case "edge":
    case "inner":
      return size === 4 ? { kind: v.kind } : null;
    case "half": {
      const side = HALVES.find((h) => h === v.side);
      return size === 4 && side ? { kind: "half", side } : null;
    }
    default:
      return null;
  }
}

function parseReveal2(v: unknown, cells: number, size: number): KareReveal2 | null | undefined {
  if (v === null) return null;
  const base = parseReveal(v, cells, STAGE2_STATUSES);
  if (!base || !isRec(v) || !isRec(v.ghosts) || !isRec(v.compass)) return undefined;
  const ghosts: Record<string, number | null> = {};
  for (const [id, c] of Object.entries(v.ghosts)) {
    if (c !== null && !isInt(c, 0, cells - 1)) return undefined;
    if (id in base.status) return undefined;
    ghosts[id] = c;
  }
  const compass: Record<string, KareHint> = {};
  for (const [id, h] of Object.entries(v.compass)) {
    const hint = parseHint(h, size);
    if (!hint || !(id in base.status)) return undefined;
    compass[id] = hint;
  }
  return { ...base, ghosts, compass };
}

function parseStage2(v: unknown): KareStage2 | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !isNum(v.startsAt) || !isNum(v.endsAt) || !isIds(v.players) || !isIds(v.ghosts)) {
    return undefined;
  }
  return { startsAt: v.startsAt, endsAt: v.endsAt, players: v.players, ghosts: v.ghosts };
}

function parsePoints(v: unknown): Record<string, number> | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [id, p] of Object.entries(v)) {
    // En çok: 1. aşama +1, 2. aşama +1, ödül karesi +2.
    if (!isInt(p, 0, 4)) return undefined;
    out[id] = p;
  }
  return out;
}

/** Ödül karesi: yalnız 2. aşamanın sonucuyla birlikte gelir. */
function parseBonus(v: unknown, cells: number): KareBonus | null | undefined {
  if (v === null || v === undefined) return null;
  if (!isRec(v) || !isInt(v.cell, 0, cells - 1)) return undefined;
  if (v.winner !== null && typeof v.winner !== "string") return undefined;
  return { cell: v.cell, winner: v.winner };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type KarelerScreenView = KarelerPublicView & KarelerView;

/** Sunucudan gelen `publicView` bilinmez; Gizli Kareler ortak görünümü olarak doğrulanır. */
export function parseKarelerPublicView(v: unknown): KarelerPublicView | null {
  if (!isRec(v)) return null;
  if (v.size !== 3 && v.size !== 4) return null;
  const size = v.size;
  if (!isNum(v.startedAt) || !isNum(v.endsAt)) return null;
  const cells = size * size;
  const stage1 = parseReveal(v.stage1, cells, STAGE1_STATUSES);
  const stage2Reveal = parseReveal2(v.stage2Reveal, cells, size);
  const stage2 = parseStage2(v.stage2);
  const points = parsePoints(v.points);
  const bonus = parseBonus(v.bonus, cells);
  if (bonus === undefined) return null;
  if (stage1 === undefined || stage2Reveal === undefined || stage2 === undefined || points === undefined) {
    return null;
  }
  if (v.finishesAt !== null && !isNum(v.finishesAt)) return null;
  if (v.walkover !== null && typeof v.walkover !== "string") return null;
  if (!isIds(v.ready)) return null;
  // Sonuç sırası tutarlı olmalı: 1. aşama açılmadan sonrası olamaz.
  if (stage1 === null && (stage2 !== null || stage2Reveal !== null || points !== null)) return null;
  if (stage2Reveal !== null && stage2 === null) return null;
  // Ödül karesi 2. aşamanın sonucundan önce bilinemez.
  if (bonus !== null && stage2Reveal === null) return null;
  return {
    size,
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    stage2,
    stage1,
    stage2Reveal,
    finishesAt: v.finishesAt,
    walkover: v.walkover,
    points,
    bonus,
    ready: v.ready,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseKarelerPrivateView(v: unknown, size: number): KarelerView | null {
  if (!isRec(v)) return null;
  if (v.myChoice !== null && !isInt(v.myChoice, 0, size * size - 1)) return null;
  if (typeof v.locked !== "boolean") return null;
  const compass = v.compass === null || v.compass === undefined ? null : parseHint(v.compass, size);
  if (v.compass != null && compass === null) return null;
  return { myChoice: v.myChoice, locked: v.locked, compass };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseKarelerView(publicView: unknown, view: unknown): KarelerScreenView | null {
  const pub = parseKarelerPublicView(publicView);
  if (!pub) return null;
  const priv = parseKarelerPrivateView(view, pub.size);
  return priv ? { ...pub, ...priv } : null;
}

export type KarelerScreenPhase = "choose1" | "reveal1" | "band" | "choose2" | "reveal2";

/** Ekranın hangi aşamada olduğu: açılmış sonuçlardan ve sunucu saatinden. */
export function screenPhase(v: KarelerPublicView, now: number): KarelerScreenPhase {
  if (v.stage1 === null) return "choose1";
  if (v.stage2Reveal !== null) return "reveal2";
  if (v.stage2 === null || now < v.stage2.startsAt - KARELER_BAND_MS) return "reveal1";
  // GK-U5: 2. aşamadan önceki 1 sn'lik bant.
  if (now < v.stage2.startsAt) return "band";
  return "choose2";
}

/** Sütun harfi (A…D). */
export const colName = (col: number): string => String.fromCharCode(65 + col);

/** Hücrenin koordinatı (GK-U1): sütun harfi + satır numarası ("B3" = B sütunu, 3. satır). */
export function cellName(cell: number, size: number): string {
  return `${colName(cell % size)}${Math.floor(cell / size) + 1}`;
}

/** "B3'te", "A1'de": satır numarasının okunuşuna göre bulunma eki (3 ve 4 sert ünsüzle biter). */
export function cellAt(cell: number, size: number): string {
  const row = Math.floor(cell / size) + 1;
  return `${cellName(cell, size)}'${row === 3 || row === 4 ? "te" : "de"}`;
}

/** Pusula ipucunun kısa yazısı ("köşede değil", "B sütununda değil"). */
export function hintText(h: KareHint): string {
  switch (h.kind) {
    case "notRow":
      return `${h.row + 1}. satırda değil`;
    case "notCol":
      return `${colName(h.col)} sütununda değil`;
    case "corner":
      return "köşede";
    case "notCorner":
      return "köşede değil";
    case "edge":
      return "kenarda";
    case "inner":
      return "içeride";
    case "half":
      return { top: "üst yarıda", bottom: "alt yarıda", left: "sol yarıda", right: "sağ yarıda" }[h.side];
  }
}

/** Hücre → o hücreyi seçenler (kimlik sırasıyla). */
export function groupByCell(reveal: KareReveal): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const [id, c] of Object.entries(reveal.choices)) {
    if (c === null) continue;
    out.set(c, [...(out.get(c) ?? []), id]);
  }
  return out;
}

/** Hücre → o hücreyi tutan hayaletler (GK-M2). */
export function ghostsByCell(reveal: KareReveal2 | null): Map<number, string[]> {
  const out = new Map<number, string[]>();
  if (!reveal) return out;
  for (const [id, c] of Object.entries(reveal.ghosts)) {
    if (c === null) continue;
    out.set(c, [...(out.get(c) ?? []), id]);
  }
  return out;
}

export function statusOf(reveal: KareReveal | null, playerId: string): KareStatus | null {
  return reveal?.status[playerId] ?? null;
}

/** Oyuncunun şimdiye kadar kazandığı puan. */
export function pointsOf(v: KarelerPublicView, playerId: string): number {
  return v.points?.[playerId] ?? 0;
}

/** Hücredeki kişi sayısına göre avatar sütun sayısı (kalabalık hücrede küçülür; GK-U11: en çok 4 avatar). */
export function whoColumns(count: number): number {
  return count <= 1 ? 1 : 2;
}

/** GK-U11: kalabalık hücrede en çok 4 avatar; fazlası "+N". */
export const CELL_MAX_AVATARS = 4;
export function cellCrowd(ids: readonly string[]): { shown: string[]; more: number } {
  if (ids.length <= CELL_MAX_AVATARS) return { shown: [...ids], more: 0 };
  return { shown: ids.slice(0, CELL_MAX_AVATARS - 1), more: ids.length - (CELL_MAX_AVATARS - 1) };
}

/** GK-U11: tek kalan karede avatarın altındaki kısa ad (en çok 6 harf). */
export function shortName(name: string): string {
  const chars = [...name.trim()];
  return chars.length <= 6 ? chars.join("") : `${chars.slice(0, 5).join("")}.`;
}

/**
 * GK-U6: kareler tek tek döner. Sıra: önce boş kareler (hızlı), sonra tek kalanlar, sonra çakışmalar, en son kendi
 * karen. Dönen: hücre → dönme anı (açılıştan ms) ve hepsinin bittiği an.
 */
export const FLIP_FAST_MS = 45;
export const FLIP_MS = 150;
export function flipPlan(
  size: number,
  groups: ReadonlyMap<number, readonly string[]>,
  mine: number | null,
  ghosts: ReadonlyMap<number, readonly string[]> = new Map(),
  start = 300,
): { at: Map<number, number>; end: number } {
  const cells = Array.from({ length: size * size }, (_, i) => i).filter((c) => c !== mine);
  const count = (c: number): number => groups.get(c)?.length ?? 0;
  const busy = (c: number): boolean => count(c) > 0 || (ghosts.get(c)?.length ?? 0) > 0;
  const empty = cells.filter((c) => !busy(c));
  const solo = cells.filter((c) => busy(c) && count(c) <= 1);
  const clash = cells.filter((c) => count(c) > 1);
  const at = new Map<number, number>();
  let t = start;
  for (const c of empty) {
    at.set(c, t);
    t += FLIP_FAST_MS;
  }
  for (const c of [...solo, ...clash]) {
    t += FLIP_MS;
    at.set(c, t);
  }
  if (mine !== null) {
    t += FLIP_MS * 2;
    at.set(mine, t);
  }
  return { at, end: t + FLIP_MS * 2 };
}

/** Hücre kartı (GK-U11): "C2 · Elif, Mert · çakıştı". */
export function cellCard(
  cell: number,
  size: number,
  names: readonly string[],
  ghostNames: readonly string[],
  bonus: boolean,
): string {
  const parts = [cellName(cell, size)];
  if (names.length === 0) parts.push(ghostNames.length > 0 ? "yarışan yok" : "boş");
  else parts.push(names.join(", "));
  if (names.length > 1) parts.push("çakıştı");
  else if (names.length === 1) parts.push(ghostNames.length > 0 ? "hayalete çarptı" : "tek kaldı");
  if (ghostNames.length > 0) parts.push(`hayalet: ${ghostNames.join(", ")}`);
  if (bonus) parts.push("ödül karesi");
  return parts.join(" · ");
}

export interface HeadInput {
  /** 1. aşama sonucu mu (false: son sonuç). */
  final: boolean;
  status: KareStatus | null;
  /** Kendi karen ve onu paylaşan diğer yarışanların adları. */
  cell: number | null;
  size: number;
  mates: readonly string[];
  walkover: boolean;
  wonBonus: boolean;
  /** Son sonuçta hayaletsin (GK-M2): düşürdüğün yarışanların adları. */
  ghost: boolean;
  ghostHits: readonly string[];
  ghostPicked: boolean;
  spectator: boolean;
  soloCount: number;
}

/**
 * GK-U8: başlığın büyük satırı yalnız BU aşamanın sonucunu söyler; toplam ayrı satırdadır.
 * `kind`: renk (gold / clash / calm / ghost / dim).
 */
export function stageHead(i: HeadInput): { text: string; kind: string } {
  if (i.spectator || (i.status === null && !i.ghost)) {
    return i.soloCount > 0
      ? { text: `${i.soloCount} kişi tek kaldı`, kind: "gold" }
      : { text: "Kimse tek kalamadı", kind: "dim" };
  }
  if (i.ghost) {
    if (!i.ghostPicked) return { text: "Hayaletin kare tutmadı", kind: "ghost" };
    return i.ghostHits.length > 0
      ? { text: `Hayaletin düşürdü: ${i.ghostHits.join(", ")}`, kind: "ghost" }
      : { text: "Hayaletin kimseye çarpmadı", kind: "ghost" };
  }
  const where = i.cell === null ? "" : `${cellAt(i.cell, i.size)} `;
  switch (i.status) {
    case "solo":
      if (i.wonBonus) return { text: "Ödül karesi! +1 +2", kind: "gold" };
      if (i.walkover) return { text: "Rakipsiz · +1 +1", kind: "gold" };
      return { text: "Tek kaldın · +1", kind: "gold" };
    case "clash": {
      const who = i.mates.length > 0 ? ` · ${i.mates.join(", ")}` : "";
      return i.final
        ? { text: `2. aşamada çakıştın${who}`, kind: "calm" }
        : { text: `${where}çakıştın${who}`, kind: "clash" };
    }
    case "haunted":
      return { text: `${where}hayalete çarptın`, kind: "calm" };
    default:
      return { text: "Seçmedin · pasif", kind: "dim" };
  }
}

/** Hücre rozeti (GK-U8): o hücrenin bu aşama kazancı. */
export function cellGain(status: "solo" | "clash" | "empty", wonBonus: boolean): string {
  if (status !== "solo") return "";
  return wonBonus ? "+1 +2" : "+1";
}

/** GK-U7: ödül karesi anının sonucu. */
export type BonusOutcome = "win" | "clash" | "haunted" | "none";
export function bonusOutcome(
  bonus: KareBonus,
  groups: ReadonlyMap<number, readonly string[]>,
  ghosts: ReadonlyMap<number, readonly string[]>,
): BonusOutcome {
  if (bonus.winner !== null) return "win";
  const racers = groups.get(bonus.cell)?.length ?? 0;
  if (racers > 1) return "clash";
  if (racers === 1 && (ghosts.get(bonus.cell)?.length ?? 0) > 0) return "haunted";
  return "none";
}

export function bonusLine(
  outcome: BonusOutcome,
  winnerName: string | null,
  meOnCell: boolean,
): { title: string; sub: string } {
  switch (outcome) {
    case "win":
      return { title: "ÖDÜL KARESİ!", sub: `${winnerName ?? "Biri"} +2` };
    case "clash":
      return {
        title: "Sandık kırıldı",
        sub: meOnCell ? "Ödülde çakıştınız: ödül yok" : "Ödülde çakışma: ödül yok",
      };
    case "haunted":
      return { title: "Sandık kırıldı", sub: "Bir hayalet ödülü kapattı" };
    default:
      return { title: "Sandık kapandı", sub: "Ödül karesini kimse bulamadı" };
  }
}

export interface SummaryRow {
  id: string;
  /** 1. aşama: tek / çakıştı / pasif. */
  s1: "solo" | "clash" | "passive";
  /** 2. aşama: yarışan sonucu, hayalet ya da oynanmadı. */
  s2: "solo" | "clash" | "haunted" | "passive" | "ghost" | "none";
  bonus: boolean;
  total: number;
}

/** GK-U9: özet tablosu: toplamı en yüksek en üstte; eşitlikte katılım sırası. */
export function summaryRows(v: KarelerPublicView, ids: readonly string[]): SummaryRow[] {
  const rows = ids.map((id): SummaryRow => {
    const s1 = v.stage1?.status[id];
    const s2r = v.stage2Reveal?.status[id];
    const ghost = v.stage2?.ghosts.includes(id) === true;
    return {
      id,
      s1: s1 === "solo" || s1 === "clash" ? s1 : "passive",
      s2: s2r ?? (ghost && v.stage2Reveal ? "ghost" : "none"),
      bonus: v.bonus?.winner === id,
      total: v.points?.[id] ?? 0,
    };
  });
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.total - a.r.total || a.i - b.i)
    .map(({ r }) => r);
}

/** Hayaletin düşürdüğü yarışanlar (aynı karede yarışan, hayalete çarpan ya da çakışan). */
export function ghostHits(reveal: KareReveal2, ghostId: string): string[] {
  const c = reveal.ghosts[ghostId];
  if (c === null || c === undefined) return [];
  return Object.entries(reveal.choices)
    .filter(([id, x]) => x === c && reveal.status[id] === "haunted")
    .map(([id]) => id);
}

/** İzleyici için hazır sayacı satırı. */
export const readyLine = (ready: number, total: number): string => `${ready}/${total} hazır`;
