import type { KarelerPublicView, KarelerView, KareReveal, KareStage2, KareStatus } from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;

const STATUSES: readonly KareStatus[] = ["solo", "clash", "passive"];
const isStatus = (v: unknown): v is KareStatus => STATUSES.includes(v as KareStatus);

function parseReveal(v: unknown, cells: number): KareReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !isRec(v.choices) || !isRec(v.status)) return undefined;
  const choices: Record<string, number | null> = {};
  const status: Record<string, KareStatus> = {};
  for (const [id, c] of Object.entries(v.choices)) {
    if (c !== null && !isInt(c, 0, cells - 1)) return undefined;
    const s = v.status[id];
    if (!isStatus(s)) return undefined;
    // Seçmeyen pasiftir; seçen pasif olamaz.
    if ((c === null) !== (s === "passive")) return undefined;
    choices[id] = c;
    status[id] = s;
  }
  if (Object.keys(v.status).length !== Object.keys(choices).length) return undefined;
  return { choices, status };
}

function parseStage2(v: unknown): KareStage2 | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !isNum(v.startsAt) || !isNum(v.endsAt) || !Array.isArray(v.players)) return undefined;
  if (!v.players.every((p) => typeof p === "string")) return undefined;
  return { startsAt: v.startsAt, endsAt: v.endsAt, players: v.players as string[] };
}

function parsePoints(v: unknown): Record<string, number> | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [id, p] of Object.entries(v)) {
    if (!isInt(p, 0, 2)) return undefined;
    out[id] = p;
  }
  return out;
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
  const stage1 = parseReveal(v.stage1, cells);
  const stage2Reveal = parseReveal(v.stage2Reveal, cells);
  const stage2 = parseStage2(v.stage2);
  const points = parsePoints(v.points);
  if (stage1 === undefined || stage2Reveal === undefined || stage2 === undefined || points === undefined) {
    return null;
  }
  if (v.finishesAt !== null && !isNum(v.finishesAt)) return null;
  if (v.walkover !== null && typeof v.walkover !== "string") return null;
  if (!Array.isArray(v.ready) || !v.ready.every((p) => typeof p === "string")) return null;
  // Sonuç sırası tutarlı olmalı: 1. aşama açılmadan sonrası olamaz.
  if (stage1 === null && (stage2 !== null || stage2Reveal !== null || points !== null)) return null;
  if (stage2Reveal !== null && stage2 === null) return null;
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
    ready: v.ready as string[],
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseKarelerPrivateView(v: unknown, cells: number): KarelerView | null {
  if (!isRec(v)) return null;
  if (v.myChoice !== null && !isInt(v.myChoice, 0, cells - 1)) return null;
  if (typeof v.locked !== "boolean") return null;
  return { myChoice: v.myChoice, locked: v.locked };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseKarelerView(publicView: unknown, view: unknown): KarelerScreenView | null {
  const pub = parseKarelerPublicView(publicView);
  if (!pub) return null;
  const priv = parseKarelerPrivateView(view, pub.size * pub.size);
  return priv ? { ...pub, ...priv } : null;
}

export type KarelerScreenPhase = "choose1" | "reveal1" | "choose2" | "reveal2";

/** Ekranın hangi aşamada olduğu: açılmış sonuçlardan ve sunucu saatinden. */
export function screenPhase(v: KarelerPublicView, now: number): KarelerScreenPhase {
  if (v.stage1 === null) return "choose1";
  if (v.stage2Reveal !== null) return "reveal2";
  if (v.stage2 === null || now < v.stage2.startsAt) return "reveal1";
  return "choose2";
}

/** Hücrenin satır/sütun adı ("A1" … "D4") — ekran okuyucu etiketi. */
export function cellName(cell: number, size: number): string {
  return `${String.fromCharCode(65 + Math.floor(cell / size))}${(cell % size) + 1}`;
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

export function statusOf(reveal: KareReveal | null, playerId: string): KareStatus | null {
  return reveal?.status[playerId] ?? null;
}

/** Oyuncunun şimdiye kadar kazandığı puan. */
export function pointsOf(v: KarelerPublicView, playerId: string): number {
  return v.points?.[playerId] ?? 0;
}

/** Hücredeki kişi sayısına göre avatar sütun sayısı (kalabalık hücrede küçülür). */
export function whoColumns(count: number): number {
  return count <= 1 ? 1 : count <= 4 ? 2 : 3;
}
