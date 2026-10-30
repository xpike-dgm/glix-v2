import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import { everyoneReady } from "../ready.js";
import {
  type Clue,
  type ClueCondition,
  KONTROL_LOCK_GRACE_MS,
  KONTROL_PLAY_MS,
  KONTROL_REVEAL_MS,
  type KontrolAction,
  type KontrolPublicView,
  type KontrolReveal,
  type KontrolRevealRow,
  type KontrolStage,
  type KontrolView,
  WIRE_COLORS,
  type WireColor,
} from "./types.js";

export * from "./types.js";

export interface KontrolState {
  players: string[];
  startedAt: number;
  endsAt: number;
  finishAt: number;
  /** Görünümlerin gösterdiği aşama; yalnız `tick` ilerletir (yayın tetikler). Kurallar zamana bakar. */
  stage: KontrolStage;
  /** Oyuncu -> panel dizilimi (hepsi farklı permütasyon). Gizli. */
  panels: Record<string, WireColor[]>;
  /** İpucu taşıyıcı -> hedef panelin sahibi (tek döngü, kimse kendini hedeflemez). Gizli. */
  targets: Record<string, string>;
  /** Hedef panel sahibi -> kesmesi gereken doğru renk. Gizli. */
  answers: Record<string, WireColor>;
  /** Taşıyıcı -> ipucu. Gizli. */
  clues: Record<string, Clue>;
  /** Oyuncu -> kesimi (geri alınamaz). Sonuca kadar gizli. */
  cuts: Record<string, WireColor>;
  /** Herkes kestiyse true: `endsAt` öne çekilmiştir. */
  closing: boolean;
}

const has = <T>(rec: Record<string, T>, id: string): boolean => Object.hasOwn(rec, id);
const isColor = (v: unknown): v is WireColor =>
  typeof v === "string" && (WIRE_COLORS as readonly string[]).includes(v);

/** 4 rengin 24 dizilimi. */
export function wirePermutations(): WireColor[][] {
  const out: WireColor[][] = [];
  const walk = (rest: readonly WireColor[], acc: WireColor[]): void => {
    if (rest.length === 0) {
      out.push(acc);
      return;
    }
    for (const c of rest)
      walk(
        rest.filter((x) => x !== c),
        [...acc, c],
      );
  };
  walk(WIRE_COLORS, []);
  return out;
}

/** Koşulların hepsi bu dizilimde doğru mu. */
export function panelMatches(panel: readonly WireColor[], conditions: readonly ClueCondition[]): boolean {
  return conditions.every((c) => panel[c.position - 1] === c.color);
}

/** Koşulları sağlayan panel sayısı (hedefin kendisi dahil). */
export function matchingPanels(
  panels: readonly (readonly WireColor[])[],
  conditions: readonly ClueCondition[],
): number {
  return panels.filter((p) => panelMatches(p, conditions)).length;
}

/** 1..4 konumlarından `size` elemanlı tüm kümeler (artan sırada). */
function positionSets(size: number): number[][] {
  const out: number[][] = [];
  const walk = (start: number, acc: number[]): void => {
    if (acc.length === size) {
      out.push(acc);
      return;
    }
    for (let p = start; p <= WIRE_COLORS.length; p++) walk(p + 1, [...acc, p]);
  };
  walk(1, []);
  return out;
}

const cloneClue = (c: Clue): Clue => ({ conditions: c.conditions.map((x) => ({ ...x })), cut: c.cut });

/**
 * Hedef panel için ipucu koşulu: önce iki konumlu koşullar arasından yalnız hedef paneli tanımlayanlar (rastgele biri),
 * yoksa üç konumlu; o da yoksa en az panel eşleşen üç konumlu koşul. Koşul hedef panelde her zaman doğrudur.
 */
export function chooseCondition(
  panels: readonly (readonly WireColor[])[],
  target: readonly WireColor[],
  pickIndex: (n: number) => number,
): ClueCondition[] {
  const conditionsFor = (positions: readonly number[]): ClueCondition[] =>
    positions.map((position) => ({ position, color: target[position - 1] as WireColor }));
  for (const size of [2, 3]) {
    const sets = positionSets(size).map(conditionsFor);
    const unique = sets.filter((c) => matchingPanels(panels, c) === 1);
    if (unique.length > 0) return unique[pickIndex(unique.length)] as ClueCondition[];
    if (size === 3) {
      const least = Math.min(...sets.map((c) => matchingPanels(panels, c)));
      const best = sets.filter((c) => matchingPanels(panels, c) === least);
      return best[pickIndex(best.length)] as ClueCondition[];
    }
  }
  return conditionsFor([1, 2, 3]);
}

function stageAt(state: KontrolState, now: number): KontrolStage {
  return now >= state.endsAt ? "reveal" : "play";
}

function buildReveal(state: KontrolState): KontrolReveal {
  const carrierOf: Record<string, string> = {};
  for (const [carrier, target] of Object.entries(state.targets)) carrierOf[target] = carrier;
  const rows: Record<string, KontrolRevealRow> = {};
  const scores: Record<string, number> = {};
  for (const id of state.players) scores[id] = 0;
  for (const id of state.players) {
    const cut = has(state.cuts, id) ? (state.cuts[id] as WireColor) : null;
    const correct = cut !== null && cut === state.answers[id];
    const carrier = carrierOf[id] as string;
    rows[id] = {
      panel: [...(state.panels[id] as WireColor[])],
      cut,
      correct,
      carrier,
      clue: cloneClue(state.clues[carrier] as Clue),
    };
    if (correct) {
      scores[id] = (scores[id] ?? 0) + 1;
      scores[carrier] = (scores[carrier] ?? 0) + 1;
    }
  }
  return { rows, scores };
}

export const kontrolPaneliKaosu: GameDefinition<KontrolState, KontrolAction, KontrolView, KontrolPublicView> =
  {
    id: "kontrol-paneli-kaosu",
    name: "Kontrol Paneli Kaosu",
    minPlayers: 2,
    maxPlayers: 8,
    orientation: "portrait",
    briefing: {
      goal: "Doğru kabloyu kes, ipucunu arkadaşından al!",
      steps: [
        "Her telefonda dört renk kablo farklı sıradadır",
        "İpucunu sesli oku, panelin ipucunu kimin taşıdığını bul",
        "Tek kablo kes: doğruysa sen ve ipucu sahibi +1",
      ],
    },

    parseAction(raw: unknown): KontrolAction | null {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
      const r = raw as Record<string, unknown>;
      if (Object.keys(r).length !== 2 || r.kind !== "cut" || !isColor(r.color)) return null;
      return { kind: "cut", color: r.color };
    },

    setup(players: readonly string[], ctx: GameContext): KontrolState {
      const perms = ctx.rng.shuffle(wirePermutations());
      const panels: Record<string, WireColor[]> = {};
      players.forEach((id, i) => {
        panels[id] = perms[i % perms.length] as WireColor[];
      });
      const order = ctx.rng.shuffle(players);
      const targets: Record<string, string> = {};
      const answers: Record<string, WireColor> = {};
      const clues: Record<string, Clue> = {};
      const all = players.map((id) => panels[id] as WireColor[]);
      order.forEach((carrier, i) => {
        const target = order[(i + 1) % order.length] as string;
        targets[carrier] = target;
        answers[target] = WIRE_COLORS[ctx.rng.int(WIRE_COLORS.length)] as WireColor;
        clues[carrier] = {
          conditions: chooseCondition(all, panels[target] as WireColor[], (n) => ctx.rng.int(n)),
          cut: answers[target],
        };
      });
      const endsAt = ctx.now + KONTROL_PLAY_MS;
      return {
        players: [...players],
        startedAt: ctx.now,
        endsAt,
        finishAt: endsAt + KONTROL_REVEAL_MS,
        stage: "play",
        panels,
        targets,
        answers,
        clues,
        cuts: {},
        closing: false,
      };
    },

    reduce(state, playerId, action, ctx): KontrolState | Rejected {
      if (!state.players.includes(playerId)) return { rejected: "not_participant" };
      if (ctx.now < state.startedAt) return { rejected: "not_started" };
      if (ctx.now >= state.endsAt) return { rejected: "ended" };
      if (has(state.cuts, playerId)) return { rejected: "already_cut" };
      const cuts = { ...state.cuts, [playerId]: action.color };
      // Bağlı her katılımcı tek hakkını kullandıysa 1 sn sonra biter (kopuk oyuncu beklenmez).
      if (!everyoneReady(state.players, ctx.connected, (id) => has(cuts, id))) return { ...state, cuts };
      const endsAt = Math.min(state.endsAt, ctx.now + KONTROL_LOCK_GRACE_MS);
      return { ...state, cuts, closing: true, endsAt, finishAt: endsAt + KONTROL_REVEAL_MS };
    },

    // Aşama değişimi durumu bir kez değiştirir: sunucu değişiklikte yayın yapar, geçiş tam zamanında görünür.
    tick(state, ctx): KontrolState {
      const stage = stageAt(state, ctx.now);
      return stage === state.stage ? state : { ...state, stage };
    },

    publicView(state): KontrolPublicView {
      return {
        players: [...state.players],
        stage: state.stage,
        startedAt: state.startedAt,
        endsAt: state.endsAt,
        finishAt: state.finishAt,
        done: state.players.filter((id) => has(state.cuts, id)),
        reveal: state.stage === "reveal" ? buildReveal(state) : null,
      };
    },

    view(state, playerId): KontrolView {
      if (playerId === null || !state.players.includes(playerId))
        return { panel: [], clue: null, myCut: null };
      const clue = state.clues[playerId];
      return {
        panel: [...(state.panels[playerId] as WireColor[])],
        clue: clue ? cloneClue(clue) : null,
        myCut: has(state.cuts, playerId) ? (state.cuts[playerId] as WireColor) : null,
      };
    },

    /** Sonuç açılışı kesim süresinin bittiği an başlar. */
    revealAt(state): number | null {
      return state.endsAt;
    },

    isFinished(state, ctx): boolean {
      return ctx.now >= state.finishAt;
    },

    // Paneller ve ipuçları sonuç açılana kadar yalnız sahibinde (ipucu, taşıyıcıda). Kesimler ve ipucu-hedef eşlemesi
    // kısa/ayırt edici olmadığından metinle aranamaz; gizlilikleri yapısaldır (kontrol-paneli-kaosu.test.ts "gizlilik").
    secrets(state): readonly SecretEntry[] {
      if (state.stage === "reveal") return [];
      const entries: SecretEntry[] = [];
      for (const id of state.players) {
        entries.push({
          ownerIds: [id],
          value: JSON.stringify(state.panels[id]),
          label: `${id} paneli`,
        });
        const clue = state.clues[id];
        if (clue) entries.push({ ownerIds: [id], value: JSON.stringify(clue), label: `${id} ipucu` });
      }
      return entries;
    },

    result(state) {
      const { scores } = buildReveal(state);
      return { miniScores: { ...scores }, awards: { ...scores } };
    },
  };
