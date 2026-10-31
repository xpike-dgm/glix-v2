/**
 * İpucu üretimi ve denetimi. Her ipucu hedef panelde doğrudur ve o dalganın panelleri arasında YALNIZ hedef paneli
 * tanımlar (üretimde denetlenir; istenen tür bunu sağlayamazsa daha basit "N. kablo R" türüne düşülür).
 * Doğru kablo her zaman sistemce kesin hesaplanır (`answerFor`).
 */
import type { Clue, ClueCondition, ClueCut, WireColor } from "./types.js";

type Panel = readonly WireColor[];

/** Tek koşul bu panelde doğru mu. */
export function conditionHolds(panel: Panel, c: ClueCondition): boolean {
  switch (c.kind) {
    case "at":
      return panel[c.position - 1] === c.color;
    case "notAt":
      return c.position >= 1 && c.position <= panel.length && panel[c.position - 1] !== c.color;
    case "adjacent": {
      const i = panel.indexOf(c.a);
      const j = panel.indexOf(c.b);
      return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
    }
    case "above": {
      const i = panel.indexOf(c.a);
      const j = panel.indexOf(c.b);
      return i >= 0 && j >= 0 && i < j;
    }
  }
}

/** Koşulların hepsi bu dizilimde doğru mu. */
export function panelMatches(panel: Panel, conditions: readonly ClueCondition[]): boolean {
  return conditions.every((c) => conditionHolds(panel, c));
}

/** Koşulları sağlayan panel sayısı (hedefin kendisi dahil). */
export function matchingPanels(panels: readonly Panel[], conditions: readonly ClueCondition[]): number {
  return panels.filter((p) => panelMatches(p, conditions)).length;
}

/** İpucunun bu panelde kestirdiği renk. */
export function answerFor(panel: Panel, cut: ClueCut): WireColor {
  return cut.kind === "color" ? cut.color : (panel[cut.position - 1] as WireColor);
}

/** Bir ipucunun dalganın panelleri arasında yalnız hedefi tanımladığını doğrular. */
export function identifiesOnly(
  panels: readonly Panel[],
  target: Panel,
  conditions: readonly ClueCondition[],
): boolean {
  return panelMatches(target, conditions) && matchingPanels(panels, conditions) === 1;
}

export type ClueStyle = "basic" | "notAt" | "adjacent" | "above" | "position" | "three" | "mixed";

/** Dalgada kullanılacak ipucu türleri: 1 bugünkü tür; 2 yeni türler; 3 üç koşullu ya da karma. */
export const WAVE_STYLES: readonly (readonly ClueStyle[])[] = [
  ["basic"],
  ["notAt", "adjacent", "above", "position"],
  ["three", "mixed"],
];

const at = (target: Panel, position: number): ClueCondition => ({
  kind: "at",
  position,
  color: target[position - 1] as WireColor,
});

/** 1..n konumlarından `size` elemanlı tüm kümeler (artan sırada). */
function subsets<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, acc: T[]): void => {
    if (acc.length === size) {
      out.push(acc);
      return;
    }
    for (let i = start; i < items.length; i++) walk(i + 1, [...acc, items[i] as T]);
  };
  walk(0, []);
  return out;
}

const positionsOf = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

/** Hedefte doğru olan bütün tek koşullar. */
function atomsFor(target: Panel, colors: readonly WireColor[]): ClueCondition[] {
  const out: ClueCondition[] = [];
  const n = target.length;
  for (const p of positionsOf(n)) out.push(at(target, p));
  for (const p of positionsOf(n))
    for (const c of colors) if (c !== target[p - 1]) out.push({ kind: "notAt", position: p, color: c });
  for (let i = 0; i + 1 < n; i++) {
    const [a, b] = orderPair(target[i] as WireColor, target[i + 1] as WireColor, colors);
    out.push({ kind: "adjacent", a, b });
  }
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      out.push({ kind: "above", a: target[i] as WireColor, b: target[j] as WireColor });
  return out;
}

/** Yan yana çiftini renk sırasına göre yazar ("mavi ile sarı"). */
function orderPair(x: WireColor, y: WireColor, colors: readonly WireColor[]): [WireColor, WireColor] {
  return colors.indexOf(x) <= colors.indexOf(y) ? [x, y] : [y, x];
}

const isPositional = (c: ClueCondition): c is Extract<ClueCondition, { position: number }> =>
  c.kind === "at" || c.kind === "notAt";

/**
 * Okunur, çelişkisiz ve gereksizsiz koşul kümesi: aynı konum iki kez geçmez; "değil" rengi sabitlenmiş olmaz; iki rengi de "N. kablo R" ile
 * sabitlenmiş bir ilişki koşulu olmaz; aynı renk çifti iki ilişkide geçmez; konum hedefinde o konum koşul değildir.
 */
function tidy(conds: readonly ClueCondition[], cut: ClueCut): boolean {
  const positions = new Set<number>();
  const pinned = new Set<WireColor>();
  for (const c of conds) {
    if (!isPositional(c)) continue;
    if (positions.has(c.position)) return false;
    positions.add(c.position);
    if (c.kind === "at") pinned.add(c.color);
  }
  if (cut.kind === "position" && positions.has(cut.position)) return false;
  // "N. kablo R değil" rengi başka yerde sabitlenmişse kendiliğinden doğrudur (gereksiz).
  for (const c of conds) if (c.kind === "notAt" && pinned.has(c.color)) return false;
  const pairs = new Set<string>();
  for (const c of conds) {
    if (isPositional(c)) continue;
    if (pinned.has(c.a) && pinned.has(c.b)) return false;
    const key = [c.a, c.b].sort().join("|");
    if (pairs.has(key)) return false;
    pairs.add(key);
  }
  return true;
}

/** Okuma sırası: konumlu koşullar yukarıdan aşağı, ilişkiler sonda. */
function ordered(conds: readonly ClueCondition[]): ClueCondition[] {
  const pos = conds.filter(isPositional).sort((x, y) => x.position - y.position);
  return [...pos, ...conds.filter((c) => !isPositional(c))];
}

type Pick = (n: number) => number;

/** Adaylar arasından yalnız hedefi tanımlayan ilk (en kısa) boy grubundan rastgele biri. */
function firstUnique(
  groups: readonly (() => readonly ClueCondition[][])[],
  panels: readonly Panel[],
  target: Panel,
  pick: Pick,
): ClueCondition[] | null {
  for (const group of groups) {
    const ok = group().filter((c) => identifiesOnly(panels, target, c));
    if (ok.length > 0) return ordered(ok[pick(ok.length)] as ClueCondition[]);
  }
  return null;
}

/**
 * "N. kablo R" koşulları: `minSize` konumdan başlayıp yalnız hedefi tanımlayan ilk boy; paneller farklıysa
 * (N-1) konum hep yeter. Hiçbiri tek değilse (gerçekte olmaz) en az panelin eşleştiği en büyük küme.
 */
export function basicConditions(
  panels: readonly Panel[],
  target: Panel,
  pick: Pick,
  minSize = 2,
  cut?: ClueCut,
): ClueCondition[] {
  const n = target.length;
  const free = positionsOf(n).filter((p) => cut?.kind !== "position" || p !== cut.position);
  const groups: ClueCondition[][][] = [];
  // Paneller farklıysa (N-1) konum dizilimi tam belirler; daha büyük küme gerekmez.
  const max = Math.min(free.length, n - 1);
  for (let size = Math.min(minSize, max); size <= max; size++)
    groups.push(subsets(free, size).map((ps) => ps.map((p) => at(target, p))));
  const unique = firstUnique(
    groups.map((g) => () => g),
    panels,
    target,
    pick,
  );
  if (unique) return unique;
  const last = groups[groups.length - 1] ?? [free.map((p) => at(target, p))];
  const least = Math.min(...last.map((c) => matchingPanels(panels, c)));
  const best = last.filter((c) => matchingPanels(panels, c) === least);
  return ordered(best[pick(best.length)] as ClueCondition[]);
}

/** Geriye dönük ad: iki konumdan başlayan "N. kablo R" koşulları. */
export function chooseCondition(panels: readonly Panel[], target: Panel, pick: Pick): ClueCondition[] {
  return basicConditions(panels, target, pick, 2);
}

/** Bir türün aday koşul kümeleri (boy sırasıyla gruplanmış; büyük gruplar yalnız gerekirse kurulur). */
function candidates(
  style: ClueStyle,
  target: Panel,
  colors: readonly WireColor[],
  cut: ClueCut,
): (() => ClueCondition[][])[] {
  const atoms = atomsFor(target, colors);
  const ats = atoms.filter((c) => c.kind === "at");
  const keep = (list: ClueCondition[][]): ClueCondition[][] => list.filter((c) => tidy(c, cut));
  const withAt = (base: readonly ClueCondition[]): ClueCondition[][] =>
    keep(base.flatMap((b) => ats.map((a) => [b, a])));
  switch (style) {
    case "notAt":
      return [() => withAt(atoms.filter((c) => c.kind === "notAt"))];
    case "adjacent":
    case "above": {
      const rel = atoms.filter((c) => c.kind === style);
      return [() => keep(rel.map((r) => [r])), () => withAt(rel)];
    }
    case "position":
      return [() => keep(subsets(ats, 1)), () => keep(subsets(ats, 2))];
    case "three":
      return [() => keep(subsets(ats, 3))];
    case "mixed": {
      const karma = (c: ClueCondition[]): boolean => c.some((x) => x.kind !== "at");
      return [() => keep(subsets(atoms, 2).filter(karma)), () => keep(subsets(atoms, 3).filter(karma))];
    }
    case "basic":
      return [];
  }
}

export interface ClueRequest {
  /** 0 tabanlı dalga. */
  wave: number;
  /** Dalganın bütün panelleri (hedef dahil). */
  panels: readonly Panel[];
  target: Panel;
  /** Dalganın renkleri. */
  colors: readonly WireColor[];
  /** Renk hedefinde kesilecek renk (sistemce rastgele seçilmiş). */
  answer: WireColor;
  pick: Pick;
}

/**
 * Dalganın türlerinden birini rastgele dener; yalnız hedefi tanımlayan bir koşul kümesi bulamazsa basit türe düşer.
 * Konum hedefi ("en alttaki kabloyu kes") dalga 2'de bir tür, dalga 3'te üçte bir olasılıkla kullanılır.
 */
export function buildClue(req: ClueRequest): Clue {
  const { wave, panels, target, colors, pick } = req;
  const wires = target.length;
  const styles = WAVE_STYLES[wave] ?? WAVE_STYLES[0] ?? ["basic"];
  const style = styles[pick(styles.length)] as ClueStyle;
  const usePosition = style === "position" || (wave >= 2 && pick(3) === 0);
  const cut: ClueCut = usePosition
    ? { kind: "position", position: pick(2) === 0 ? 1 : wires }
    : { kind: "color", color: req.answer };
  const found = firstUnique(candidates(style, target, colors, cut), panels, target, pick);
  if (found) return { wave: wave + 1, wires, conditions: found, cut };
  // Daha basit türe düş: "N. kablo R" koşulları ve renk hedefi.
  const conditions = basicConditions(panels, target, pick, style === "three" ? 3 : 2);
  return { wave: wave + 1, wires, conditions, cut: { kind: "color", color: req.answer } };
}
