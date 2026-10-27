import type {
  Clue,
  ClueCondition,
  KontrolPublicView,
  KontrolReveal,
  KontrolRevealRow,
  KontrolStage,
  KontrolView,
  WireColor,
} from "@glix/engine";
import { WIRE_COLORS } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const isColor = (v: unknown): v is WireColor => isStr(v) && (WIRE_COLORS as readonly string[]).includes(v);
const isPanel = (v: unknown): v is WireColor[] => Array.isArray(v) && v.every(isColor);
const STAGES: readonly KontrolStage[] = ["play", "reveal"];

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type KontrolScreenView = KontrolPublicView & KontrolView;

export function parseClue(v: unknown): Clue | null {
  if (!isRec(v) || !Array.isArray(v.conditions) || !isColor(v.cut)) return null;
  const conditions: ClueCondition[] = [];
  for (const c of v.conditions) {
    if (!isRec(c) || !isNum(c.position) || !Number.isInteger(c.position) || !isColor(c.color)) return null;
    if (c.position < 1 || c.position > WIRE_COLORS.length) return null;
    conditions.push({ position: c.position, color: c.color });
  }
  if (conditions.length === 0) return null;
  return { conditions, cut: v.cut };
}

function parseRow(v: unknown): KontrolRevealRow | null {
  if (!isRec(v) || !isPanel(v.panel) || !isStr(v.carrier) || typeof v.correct !== "boolean") return null;
  if (v.cut !== null && !isColor(v.cut)) return null;
  const clue = parseClue(v.clue);
  if (!clue) return null;
  return { panel: [...v.panel], cut: v.cut, correct: v.correct, carrier: v.carrier, clue };
}

function parseReveal(v: unknown): KontrolReveal | null {
  if (!isRec(v) || !isRec(v.rows)) return null;
  const rows: Record<string, KontrolRevealRow> = {};
  for (const [id, row] of Object.entries(v.rows)) {
    const parsed = parseRow(row);
    if (!parsed) return null;
    rows[id] = parsed;
  }
  const scores = parseNumberRecord(v.scores);
  return scores ? { rows, scores } : null;
}

export function parseKontrolPublicView(v: unknown): KontrolPublicView | null {
  if (!isRec(v) || !isStrArr(v.players)) return null;
  if (!isStr(v.stage) || !STAGES.includes(v.stage as KontrolStage)) return null;
  if (!isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.finishAt) || !isStrArr(v.done)) return null;
  const reveal = v.reveal === null || v.reveal === undefined ? null : parseReveal(v.reveal);
  if (v.reveal !== null && v.reveal !== undefined && reveal === null) return null;
  return {
    players: [...v.players],
    stage: v.stage as KontrolStage,
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    finishAt: v.finishAt,
    done: [...v.done],
    reveal,
  };
}

export function parseKontrolPrivateView(v: unknown): KontrolView | null {
  if (!isRec(v) || !isPanel(v.panel)) return null;
  if (v.myCut !== null && !isColor(v.myCut)) return null;
  const clue = v.clue === null || v.clue === undefined ? null : parseClue(v.clue);
  if (v.clue !== null && v.clue !== undefined && clue === null) return null;
  return { panel: [...v.panel], clue, myCut: v.myCut };
}

export function parseKontrolView(publicView: unknown, view: unknown): KontrolScreenView | null {
  const pub = parseKontrolPublicView(publicView);
  const priv = parseKontrolPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Renk adları (Türkçe) ve belirtme hâli ("maviyi"). */
export const COLOR_NAME: Record<WireColor, string> = {
  blue: "mavi",
  green: "yeşil",
  red: "kırmızı",
  yellow: "sarı",
};
const COLOR_ACCUSATIVE: Record<WireColor, string> = {
  blue: "maviyi",
  green: "yeşili",
  red: "kırmızıyı",
  yellow: "sarıyı",
};
/** Neon renkleri (CSS). */
export const COLOR_CSS: Record<WireColor, string> = {
  blue: "#3b7bff",
  green: "#2bffa8",
  red: "#ff3b5c",
  yellow: "#ffc23b",
};

/**
 * Renk körlüğü dostu mod: her kablo rengine ayrı şekil (`ui/cbShapes.ts` sırası) ve desen.
 * Şekiller Zaman Bombası tuşlarıyla aynı: mavi daire, yeşil kare, kırmızı üçgen, sarı yıldız.
 */
export const COLOR_MARK: Record<WireColor, number> = { blue: 0, green: 1, red: 2, yellow: 3 };
/** Desen sırası (`styles/colorblind.css` `data-p`; 0 = düz). */
export const COLOR_PATTERN: Record<WireColor, number> = { blue: 4, green: 1, red: 2, yellow: 5 };

/** İpucu cümlesi: "1. kablo mavi ve 3. kablo sarı ise maviyi kes". */
export function clueText(clue: Clue): string {
  const parts = clue.conditions.map((c) => `${c.position}. kablo ${COLOR_NAME[c.color]}`);
  const last = parts.pop() ?? "";
  const cond = parts.length === 0 ? last : `${parts.join(", ")} ve ${last}`;
  return `${cond} ise ${COLOR_ACCUSATIVE[clue.cut]} kes`;
}

export interface MyOutcome {
  /** Kendi kesimin doğru muydu; kesmediysen null. */
  own: boolean | null;
  /** Taşıdığın ipucunun panelindeki kesim doğru muydu. */
  carried: boolean;
  points: number;
}

export function outcomeOf(reveal: KontrolReveal, id: string): MyOutcome {
  const row = reveal.rows[id];
  const carriedRow = Object.values(reveal.rows).find((r) => r.carrier === id);
  return {
    own: !row || row.cut === null ? null : row.correct,
    carried: carriedRow?.correct === true,
    points: reveal.scores[id] ?? 0,
  };
}
