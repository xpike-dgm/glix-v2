import {
  ORTAK_COLORS,
  ORTAK_ROUNDS,
  ORTAK_SHAPES,
  ORTAK_TILES,
  type OrtakPublicView,
  type OrtakReveal,
  type OrtakTile,
  type OrtakView,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;
const isIdList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= 64 && v.every((x) => typeof x === "string" && x.length <= 64);

function parseTile(v: unknown): OrtakTile | null {
  if (!isRec(v) || !isInt(v.color, 0, ORTAK_COLORS - 1) || !isInt(v.shape, 0, ORTAK_SHAPES - 1)) return null;
  return { color: v.color, shape: v.shape };
}

function parseReveal(v: unknown): OrtakReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const picks = parseNumberRecord(v.picks);
  const points = parseNumberRecord(v.points);
  if (!picks || !points) return undefined;
  if (!Object.values(picks).every((t) => isInt(t, 0, ORTAK_TILES - 1))) return undefined;
  if (!Array.isArray(v.groups) || v.groups.length > ORTAK_TILES) return undefined;
  const groups: OrtakReveal["groups"] = [];
  for (const g of v.groups) {
    if (!isRec(g) || !isInt(g.tile, 0, ORTAK_TILES - 1) || !isIdList(g.ids)) return undefined;
    groups.push({ tile: g.tile, ids: g.ids });
  }
  if (v.topTile !== null && !isInt(v.topTile, 0, ORTAK_TILES - 1)) return undefined;
  return { picks, groups, topTile: v.topTile, points };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type OrtakScreenView = OrtakPublicView & OrtakView;

export function parseOrtakPublicView(v: unknown): OrtakPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.phaseStartedAt) || !isNum(v.phaseEndsAt)) return null;
  if (!isInt(v.rounds, 1, ORTAK_ROUNDS) || !isInt(v.round, 1, v.rounds)) return null;
  if (v.phase !== "choose" && v.phase !== "reveal") return null;
  if (!Array.isArray(v.board) || v.board.length !== ORTAK_TILES) return null;
  const board: OrtakTile[] = [];
  for (const t of v.board) {
    const tile = parseTile(t);
    if (!tile) return null;
    board.push(tile);
  }
  const totals = parseNumberRecord(v.totals);
  if (!totals || !isIdList(v.lockedIds)) return null;
  const reveal = parseReveal(v.reveal);
  if (reveal === undefined) return null;
  let final: Record<string, number> | null = null;
  if (v.final !== null) {
    final = parseNumberRecord(v.final);
    if (!final) return null;
  }
  return {
    startedAt: v.startedAt,
    round: v.round,
    rounds: v.rounds,
    phase: v.phase,
    phaseStartedAt: v.phaseStartedAt,
    phaseEndsAt: v.phaseEndsAt,
    board,
    totals,
    lockedIds: v.lockedIds,
    reveal,
    final,
  };
}

export function parseOrtakPrivateView(v: unknown): OrtakView | null {
  if (!isRec(v) || !Array.isArray(v.layout) || v.layout.length !== ORTAK_TILES) return null;
  const layout: number[] = [];
  for (const t of v.layout) {
    if (!isInt(t, 0, ORTAK_TILES - 1) || layout.includes(t)) return null;
    layout.push(t);
  }
  if (v.myTile !== null && !isInt(v.myTile, 0, ORTAK_TILES - 1)) return null;
  if (typeof v.locked !== "boolean") return null;
  return { layout, myTile: v.myTile, locked: v.locked };
}

export function parseOrtakView(publicView: unknown, view: unknown): OrtakScreenView | null {
  const pub = parseOrtakPublicView(publicView);
  const priv = parseOrtakPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Kutu renkleri (oyuncu paletiyle aynı sıra; 6 renk). */
export const TILE_COLORS: readonly string[] = [
  "#2EF2FF",
  "#FF2BD6",
  "#FFC23B",
  "#B6FF3B",
  "#8B5CFF",
  "#FF8A3B",
];
export const tileColor = (c: number): string => TILE_COLORS[((c % 6) + 6) % 6] ?? "#2EF2FF";

/** Bir oyuncunun bu turdaki puanı. */
export const pointsOf = (reveal: OrtakReveal, id: string): number => reveal.points[id] ?? 0;

/** Seninle aynı kutuyu seçen diğer kişi sayısı. */
export function partnersOf(reveal: OrtakReveal, id: string): number {
  const g = reveal.groups.find((x) => x.ids.includes(id));
  return g ? g.ids.length - 1 : 0;
}
