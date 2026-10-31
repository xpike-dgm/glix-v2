import type {
  Clue,
  ClueCondition,
  ClueCut,
  KontrolPublicView,
  KontrolReveal,
  KontrolRevealRow,
  KontrolStage,
  KontrolView,
  KontrolWaveResult,
  WireColor,
} from "@glix/engine";
import { WIRE_COLORS } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const isColor = (v: unknown): v is WireColor => isStr(v) && (WIRE_COLORS as readonly string[]).includes(v);
const isPanel = (v: unknown): v is WireColor[] =>
  Array.isArray(v) && v.length <= WIRE_COLORS.length && v.every(isColor);
const STAGES: readonly KontrolStage[] = ["play", "break", "reveal"];
const MAX_WIRES = WIRE_COLORS.length;
const MAX_WAVES = 3;

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type KontrolScreenView = KontrolPublicView & KontrolView;

function parseCondition(c: unknown, wires: number): ClueCondition | null {
  if (!isRec(c)) return null;
  if (c.kind === "at" || c.kind === "notAt") {
    if (!isInt(c.position, 1, wires) || !isColor(c.color)) return null;
    return { kind: c.kind, position: c.position, color: c.color };
  }
  if (c.kind === "adjacent" || c.kind === "above") {
    if (!isColor(c.a) || !isColor(c.b) || c.a === c.b) return null;
    return { kind: c.kind, a: c.a, b: c.b };
  }
  return null;
}

function parseCut(v: unknown, wires: number): ClueCut | null {
  if (!isRec(v)) return null;
  if (v.kind === "color" && isColor(v.color)) return { kind: "color", color: v.color };
  if (v.kind === "position" && isInt(v.position, 1, wires)) return { kind: "position", position: v.position };
  return null;
}

export function parseClue(v: unknown): Clue | null {
  if (!isRec(v) || !Array.isArray(v.conditions)) return null;
  if (!isInt(v.wave, 1, MAX_WAVES) || !isInt(v.wires, 2, MAX_WIRES)) return null;
  const wires = v.wires;
  const cut = parseCut(v.cut, wires);
  if (!cut || v.conditions.length === 0 || v.conditions.length > 6) return null;
  const conditions: ClueCondition[] = [];
  for (const c of v.conditions) {
    const parsed = parseCondition(c, wires);
    if (!parsed) return null;
    conditions.push(parsed);
  }
  return { wave: v.wave, wires, conditions, cut };
}

function parseRow(v: unknown): KontrolRevealRow | null {
  if (!isRec(v) || !isPanel(v.panel) || !isStr(v.carrier) || typeof v.correct !== "boolean") return null;
  if (v.cut !== null && !isColor(v.cut)) return null;
  if (!isColor(v.answer)) return null;
  const clue = parseClue(v.clue);
  if (!clue) return null;
  return { panel: [...v.panel], cut: v.cut, answer: v.answer, correct: v.correct, carrier: v.carrier, clue };
}

function parseWaveResult(v: unknown): KontrolWaveResult | null {
  if (!isRec(v) || !isRec(v.rows) || !isInt(v.wave, 0, MAX_WAVES - 1)) return null;
  const rows: Record<string, KontrolRevealRow> = {};
  for (const [id, row] of Object.entries(v.rows)) {
    const parsed = parseRow(row);
    if (!parsed) return null;
    rows[id] = parsed;
  }
  const scores = parseNumberRecord(v.scores);
  return scores ? { wave: v.wave, rows, scores } : null;
}

function parseReveal(v: unknown): KontrolReveal | null {
  if (!isRec(v)) return null;
  const totals = parseNumberRecord(v.totals);
  const awards = parseNumberRecord(v.awards);
  return totals && awards ? { totals, awards } : null;
}

export function parseKontrolPublicView(v: unknown): KontrolPublicView | null {
  if (!isRec(v) || !isStrArr(v.players)) return null;
  if (!isStr(v.stage) || !STAGES.includes(v.stage as KontrolStage)) return null;
  if (!isInt(v.wave, 0, MAX_WAVES - 1) || !isInt(v.waves, 1, MAX_WAVES) || !isInt(v.wires, 2, MAX_WIRES))
    return null;
  if (!isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.nextAt) || !isNum(v.finishAt)) return null;
  if (!isStrArr(v.done) || !isInt(v.jumps, 0, 1000)) return null;
  if (v.lastJumpAt !== null && !isNum(v.lastJumpAt)) return null;
  if (!Array.isArray(v.results) || v.results.length > MAX_WAVES) return null;
  const results: KontrolWaveResult[] = [];
  for (const r of v.results) {
    const parsed = parseWaveResult(r);
    if (!parsed) return null;
    results.push(parsed);
  }
  const reveal = v.reveal === null || v.reveal === undefined ? null : parseReveal(v.reveal);
  if (v.reveal !== null && v.reveal !== undefined && reveal === null) return null;
  return {
    players: [...v.players],
    stage: v.stage as KontrolStage,
    wave: v.wave,
    waves: v.waves,
    wires: v.wires,
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    nextAt: v.nextAt,
    finishAt: v.finishAt,
    done: [...v.done],
    jumps: v.jumps,
    lastJumpAt: v.lastJumpAt,
    results,
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

/** Renk adları (Türkçe). */
export const COLOR_NAME: Record<WireColor, string> = {
  blue: "mavi",
  green: "yeşil",
  red: "kırmızı",
  yellow: "sarı",
  purple: "mor",
};
/** Belirtme hâli ("maviyi kes"). */
const COLOR_ACCUSATIVE: Record<WireColor, string> = {
  blue: "maviyi",
  green: "yeşili",
  red: "kırmızıyı",
  yellow: "sarıyı",
  purple: "moru",
};
/** Ayrılma hâli ("maviden yukarıda"). */
const COLOR_ABLATIVE: Record<WireColor, string> = {
  blue: "maviden",
  green: "yeşilden",
  red: "kırmızıdan",
  yellow: "sarıdan",
  purple: "mordan",
};
/** Neon renkleri (CSS). */
export const COLOR_CSS: Record<WireColor, string> = {
  blue: "#3b7bff",
  green: "#2bffa8",
  red: "#ff3b5c",
  yellow: "#ffc23b",
  purple: "#b25cff",
};

/**
 * Renk körlüğü dostu mod: her kablo rengine ayrı şekil (`ui/cbShapes.ts` sırası) ve desen.
 * Şekiller Zaman Bombası tuşlarıyla aynı: mavi daire, yeşil kare, kırmızı üçgen, sarı yıldız; mor baklava.
 */
export const COLOR_MARK: Record<WireColor, number> = { blue: 0, green: 1, red: 2, yellow: 3, purple: 4 };
/** Desen sırası (`styles/colorblind.css` `data-p`; 0 = düz). */
export const COLOR_PATTERN: Record<WireColor, number> = { blue: 4, green: 1, red: 2, yellow: 5, purple: 6 };

/** Kesilecek kablo: renk ya da konum ("en alttaki kabloyu"). */
export function cutText(cut: ClueCut, wires: number): string {
  if (cut.kind === "color") return COLOR_ACCUSATIVE[cut.color];
  if (cut.position === 1) return "en üstteki kabloyu";
  if (cut.position === wires) return "en alttaki kabloyu";
  return `${cut.position}. kabloyu`;
}

/** Şart kipi ("maviyse", "yeşilse", "morsa"): ünlü uyumlu ek. */
const COLOR_IF: Record<WireColor, string> = {
  blue: "maviyse",
  green: "yeşilse",
  red: "kırmızıysa",
  yellow: "sarıysa",
  purple: "morsa",
};

/**
 * Tek koşul: "2. kablo kırmızı değil", "mavi ile sarı yan yana", "kırmızı maviden yukarıda". `last` cümlenin son
 * koşulu ise şart ekiyle: "2. kablo kırmızı değilse", "mavi ile sarı yan yanaysa", "kırmızı maviden yukarıdaysa",
 * "4. kablo sarıysa".
 */
export function conditionText(c: ClueCondition, last = false): string {
  switch (c.kind) {
    case "at":
      return `${c.position}. kablo ${last ? COLOR_IF[c.color] : COLOR_NAME[c.color]}`;
    case "notAt":
      return `${c.position}. kablo ${COLOR_NAME[c.color]} ${last ? "değilse" : "değil"}`;
    case "adjacent":
      return `${COLOR_NAME[c.a]} ile ${COLOR_NAME[c.b]} ${last ? "yan yanaysa" : "yan yana"}`;
    case "above":
      return `${COLOR_NAME[c.a]} ${COLOR_ABLATIVE[c.b]} ${last ? "yukarıdaysa" : "yukarıda"}`;
  }
}

const capitalize = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase("tr") + s.slice(1) : s);

/**
 * İpucu cümlesi: "1. kablo mavi ve 3. kablo sarıysa maviyi kes". Şart eki yalnız son koşulda. İlişki koşulları
 * ("mavi ile sarı yan yana") başa alınır; "3. kablo yeşil ve mavi ile sarı" gibi yanlış okunabilecek dizilişler olmaz.
 */
export function clueText(clue: Clue): string {
  const relation = (c: ClueCondition): boolean => c.kind === "adjacent" || c.kind === "above";
  const ordered = [...clue.conditions.filter(relation), ...clue.conditions.filter((c) => !relation(c))];
  const parts = ordered.map((c, i) => conditionText(c, i === ordered.length - 1));
  const last = parts.pop() ?? "";
  const cond = parts.length === 0 ? last : `${parts.join(", ")} ve ${last}`;
  return capitalize(`${cond} ${cutText(clue.cut, clue.wires)} kes`);
}

/** Dalga adları. */
export const WAVE_NAMES = ["Isınma", "Karmaşa", "Kaos"] as const;
export const waveName = (wave: number): string => WAVE_NAMES[wave] ?? "";

export interface MyOutcome {
  /** Kendi kesimin doğru muydu; kesmediysen null. */
  own: boolean | null;
  /** Taşıdığın ipucunun panelindeki kesim doğru muydu. */
  carried: boolean;
  points: number;
}

/** Bir dalgada kendi sonucun. */
export function outcomeOf(result: KontrolWaveResult, id: string): MyOutcome {
  const row = result.rows[id];
  const carriedRow = Object.values(result.rows).find((r) => r.carrier === id);
  return {
    own: !row || row.cut === null ? null : row.correct,
    carried: carriedRow?.correct === true,
    points: result.scores[id] ?? 0,
  };
}

/** Dalgadaki bütün paneller doğru kesildi mi (bomba tamamen imha edildi). */
export const waveCleared = (result: KontrolWaveResult): boolean => {
  const rows = Object.values(result.rows);
  return rows.length > 0 && rows.every((r) => r.correct);
};

/** Saatte kalan süre (ms, 0'ın altına inmez). */
export const remainingMs = (endsAt: number, now: number): number => Math.max(0, endsAt - now);

/** 7 segmentli saat için "SS.cc" basamakları (en çok 99.99). */
export function clockDigits(ms: number): string {
  const clamped = Math.min(99_990, Math.max(0, ms));
  const s = Math.floor(clamped / 1000);
  const cs = Math.floor((clamped % 1000) / 10);
  return `${String(s).padStart(2, "0")}${String(cs).padStart(2, "0")}`;
}
