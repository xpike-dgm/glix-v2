import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import type { Rng } from "../../rng.js";
import { everyoneReady } from "../ready.js";
import { answerFor, buildClue } from "./clues.js";
import {
  type Clue,
  KONTROL_TIMELINE,
  KONTROL_WAVES,
  type KontrolAction,
  type KontrolPublicView,
  type KontrolReveal,
  type KontrolRevealRow,
  type KontrolStage,
  type KontrolView,
  type KontrolWaveResult,
  WIRE_COLORS,
  type WireColor,
  waveColors,
} from "./types.js";

export * from "./clues.js";
export * from "./types.js";

/** Tek bir dalganın gizli ve açık durumu. */
export interface KontrolWave {
  /** Oyuncu -> panel dizilimi (dalgada hepsi farklı). Dalga bitene kadar gizli. */
  panels: Record<string, WireColor[]>;
  /** İpucu taşıyıcı -> hedef panelin sahibi (tek döngü, kimse kendini hedeflemez). Gizli. */
  targets: Record<string, string>;
  /** Hedef panel sahibi -> kesmesi gereken renk (sistemce kesin). Gizli. */
  answers: Record<string, WireColor>;
  /** Taşıyıcı -> ipucu. Gizli. */
  clues: Record<string, Clue>;
  /** Oyuncu -> kesimi (dalga başına tek, geri alınamaz). Dalga bitene kadar gizli. */
  cuts: Record<string, WireColor>;
  startedAt: number;
  /** Bomba saati bitişi: yanlış kesim ve erken bitiş öne çeker. */
  endsAt: number;
  /** Bağlı herkes kesti: `endsAt` öne çekilmiştir. */
  closing: boolean;
  /** Saat atlamalarının anları (yanlış kesim; hangi kablo olduğu tutulmaz). */
  jumps: number[];
}

export interface KontrolState {
  players: string[];
  startedAt: number;
  finishAt: number;
  /** Görünümlerin gösterdiği aşama ve dalga; `tick` (ve kesim) zamana göre ilerletir. Kurallar zamana bakar. */
  stage: KontrolStage;
  wave: number;
  waves: KontrolWave[];
}

const has = <T>(rec: Record<string, T>, id: string): boolean => Object.hasOwn(rec, id);
const isColor = (v: unknown): v is WireColor =>
  typeof v === "string" && (WIRE_COLORS as readonly string[]).includes(v);

/** Verilen renklerin bütün dizilimleri (4 renk 24, 5 renk 120). */
export function wirePermutations(colors: readonly WireColor[] = waveColors(0)): WireColor[][] {
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
  walk(colors, []);
  return out;
}

const cloneClue = (c: Clue): Clue => ({
  wave: c.wave,
  wires: c.wires,
  conditions: c.conditions.map((x) => ({ ...x })),
  cut: { ...c.cut },
});

/** Tek yönlü rastgele döngü; önceki dalgadakiyle aynı hedefi taşıyan kimse kalmasın diye yeniden karıştırılır. */
function chain(
  players: readonly string[],
  rng: Rng,
  previous: Record<string, string> | null,
): Record<string, string> {
  let targets: Record<string, string> = {};
  for (let attempt = 0; attempt < 40; attempt++) {
    const order = rng.shuffle(players);
    targets = {};
    order.forEach((carrier, i) => {
      targets[carrier] = order[(i + 1) % order.length] as string;
    });
    // 2 oyuncuda tek döngü vardır: aynı eşleşme kaçınılmazdır.
    if (!previous || players.length < 3 || players.every((id) => targets[id] !== previous[id])) break;
  }
  return targets;
}

function buildWave(
  index: number,
  players: readonly string[],
  layouts: readonly WireColor[][],
  rng: Rng,
  previous: Record<string, string> | null,
  startedAt: number,
): KontrolWave {
  const colors = waveColors(index);
  const panels: Record<string, WireColor[]> = {};
  players.forEach((id, i) => {
    panels[id] = [...(layouts[i % layouts.length] as WireColor[])];
  });
  const all = players.map((id) => panels[id] as WireColor[]);
  const targets = chain(players, rng, previous);
  const answers: Record<string, WireColor> = {};
  const clues: Record<string, Clue> = {};
  for (const carrier of players) {
    const target = targets[carrier] as string;
    const panel = panels[target] as WireColor[];
    const clue = buildClue({
      wave: index,
      panels: all,
      target: panel,
      colors,
      answer: colors[rng.int(colors.length)] as WireColor,
      pick: (n) => rng.int(n),
    });
    clues[carrier] = clue;
    answers[target] = answerFor(panel, clue.cut);
  }
  return {
    panels,
    targets,
    answers,
    clues,
    cuts: {},
    startedAt,
    endsAt: startedAt + (KONTROL_TIMELINE.waveMs[index] as number),
    closing: false,
    jumps: [],
  };
}

/** `from` dalgasının bitişi değişti: sonraki dalgalar ve oyun sonu ona göre kayar. */
function reschedule(waves: KontrolWave[], from: number): { waves: KontrolWave[]; finishAt: number } {
  const out = waves.map((w) => ({ ...w }));
  for (let i = from + 1; i < out.length; i++) {
    const prev = out[i - 1] as KontrolWave;
    const w = out[i] as KontrolWave;
    w.startedAt = prev.endsAt + KONTROL_TIMELINE.breakMs;
    w.endsAt = w.startedAt + (KONTROL_TIMELINE.waveMs[i] as number);
  }
  const last = out[out.length - 1] as KontrolWave;
  return { waves: out, finishAt: last.endsAt + KONTROL_TIMELINE.revealMs };
}

/** Bu anda hangi dalga ve aşama: dalga sürüyor, dalgalar arası ya da oyun sonu açılışı. */
export function phaseAt(
  state: Pick<KontrolState, "waves">,
  now: number,
): { stage: KontrolStage; wave: number } {
  for (let i = 0; i < state.waves.length; i++) {
    const w = state.waves[i] as KontrolWave;
    if (now < w.startedAt) return i === 0 ? { stage: "play", wave: 0 } : { stage: "break", wave: i - 1 };
    if (now < w.endsAt) return { stage: "play", wave: i };
  }
  return { stage: "reveal", wave: state.waves.length - 1 };
}

function carrierOf(wave: KontrolWave): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [carrier, target] of Object.entries(wave.targets)) out[target] = carrier;
  return out;
}

/** Dalganın açık sonucu ve imha puanı (doğru kesen +1, o panelin ipucu taşıyıcısı +1). */
export function waveResult(players: readonly string[], wave: KontrolWave, index: number): KontrolWaveResult {
  const carriers = carrierOf(wave);
  const rows: Record<string, KontrolRevealRow> = {};
  const scores: Record<string, number> = {};
  for (const id of players) scores[id] = 0;
  for (const id of players) {
    const cut = has(wave.cuts, id) ? (wave.cuts[id] as WireColor) : null;
    const answer = wave.answers[id] as WireColor;
    const correct = cut !== null && cut === answer;
    const carrier = carriers[id] as string;
    rows[id] = {
      panel: [...(wave.panels[id] as WireColor[])],
      cut,
      answer,
      correct,
      carrier,
      clue: cloneClue(wave.clues[carrier] as Clue),
    };
    if (correct) {
      scores[id] = (scores[id] ?? 0) + 1;
      scores[carrier] = (scores[carrier] ?? 0) + 1;
    }
  }
  return { wave: index, rows, scores };
}

/**
 * Mini oyun puanı toplam imha puanından: en yüksek toplam +2, ikinci farklı toplam +1, diğerleri 0. Birincide
 * eşitlikte hepsi +2 ve sonraki farklı değer +1. Toplamı 0 olan ödül almaz. Herkesin toplamı aynı ve > 0 ise herkes +1.
 */
export function rankAwards(
  players: readonly string[],
  totals: Readonly<Record<string, number>>,
): Record<string, number> {
  const awards: Record<string, number> = {};
  const value = (id: string): number => totals[id] ?? 0;
  for (const id of players) awards[id] = 0;
  if (players.length === 0) return awards;
  const first = value(players[0] as string);
  if (first > 0 && players.every((id) => value(id) === first)) {
    for (const id of players) awards[id] = 1;
    return awards;
  }
  const distinct = [...new Set(players.map(value))].filter((v) => v > 0).sort((a, b) => b - a);
  for (const id of players) {
    const v = value(id);
    if (v > 0 && v === distinct[0]) awards[id] = 2;
    else if (v > 0 && v === distinct[1]) awards[id] = 1;
  }
  return awards;
}

/** Biten dalgaların sonuçları (şu anki aşamaya göre). */
function finishedResults(state: KontrolState): KontrolWaveResult[] {
  const count = state.stage === "play" ? state.wave : state.wave + 1;
  return state.waves.slice(0, count).map((w, i) => waveResult(state.players, w, i));
}

export function kontrolTotals(state: KontrolState): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of state.players) totals[id] = 0;
  state.waves.forEach((w, i) => {
    for (const [id, pts] of Object.entries(waveResult(state.players, w, i).scores))
      totals[id] = (totals[id] ?? 0) + pts;
  });
  return totals;
}

function finalReveal(state: KontrolState): KontrolReveal {
  const totals = kontrolTotals(state);
  return { totals, awards: rankAwards(state.players, totals) };
}

export const kontrolPaneliKaosu: GameDefinition<KontrolState, KontrolAction, KontrolView, KontrolPublicView> =
  {
    id: "kontrol-paneli-kaosu",
    name: "Kontrol Paneli Kaosu",
    minPlayers: 2,
    maxPlayers: 8,
    orientation: "portrait",
    briefing: {
      goal: "Üç dalgada bombayı imha et: doğru kabloyu kes!",
      steps: [
        "Herkesin telefonunda kablolar farklı sırada; ipucun başka birinin panelini anlatır",
        "İpucunu sesli oku; her dalgada tek kablo kesersin, geri alınmaz",
        "Yanlış kesim ortak saatten 5 sn düşer; en çok imha eden kazanır",
      ],
    },

    parseAction(raw: unknown): KontrolAction | null {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
      const r = raw as Record<string, unknown>;
      if (Object.keys(r).length !== 3 || r.kind !== "cut" || !isColor(r.color)) return null;
      const wave = r.wave;
      if (typeof wave !== "number" || !Number.isInteger(wave) || wave < 0 || wave >= KONTROL_WAVES)
        return null;
      return { kind: "cut", color: r.color, wave };
    },

    setup(players: readonly string[], ctx: GameContext): KontrolState {
      // Dalga 1 ve 2 paneli ayrı dizilimlerden gelir (en çok 8 + 8 <= 24): her dalgada yeni panel.
      const four = ctx.rng.shuffle(wirePermutations(waveColors(0)));
      const five = ctx.rng.shuffle(wirePermutations(waveColors(2)));
      const n = players.length;
      const layouts = [four.slice(0, n), four.slice(n, 2 * n), five.slice(0, n)];
      const waves: KontrolWave[] = [];
      let at = ctx.now;
      for (let i = 0; i < KONTROL_WAVES; i++) {
        const prev = waves[i - 1];
        const w = buildWave(i, players, layouts[i] ?? four, ctx.rng, prev ? prev.targets : null, at);
        waves.push(w);
        at = w.endsAt + KONTROL_TIMELINE.breakMs;
      }
      const last = waves[waves.length - 1] as KontrolWave;
      return {
        players: [...players],
        startedAt: ctx.now,
        finishAt: last.endsAt + KONTROL_TIMELINE.revealMs,
        stage: "play",
        wave: 0,
        waves,
      };
    },

    reduce(state, playerId, action, ctx): KontrolState | Rejected {
      if (!state.players.includes(playerId)) return { rejected: "not_participant" };
      if (ctx.now < state.startedAt) return { rejected: "not_started" };
      const phase = phaseAt(state, ctx.now);
      if (phase.stage !== "play") return { rejected: "ended" };
      if (action.wave !== phase.wave) return { rejected: "wrong_wave" };
      const cur = state.waves[phase.wave] as KontrolWave;
      if (has(cur.cuts, playerId)) return { rejected: "already_cut" };
      if (!waveColors(phase.wave).includes(action.color)) return { rejected: "no_wire" };
      const cuts = { ...cur.cuts, [playerId]: action.color };
      let endsAt = cur.endsAt;
      let jumps = cur.jumps;
      // Yanlış kesim: ortak saat 5 sn atlar, ama 3 sn'nin altına inmez (3 sn'deyken düşmez).
      if (action.color !== cur.answers[playerId]) {
        const left = endsAt - ctx.now;
        if (left > KONTROL_TIMELINE.floorMs) {
          endsAt = ctx.now + Math.max(KONTROL_TIMELINE.floorMs, left - KONTROL_TIMELINE.penaltyMs);
          jumps = [...jumps, ctx.now];
        }
      }
      // Bağlı her katılımcı bu dalgadaki tek hakkını kullandıysa dalga 1 sn sonra biter (kopuk oyuncu beklenmez).
      let closing = cur.closing;
      if (everyoneReady(state.players, ctx.connected, (id) => has(cuts, id))) {
        endsAt = Math.min(endsAt, ctx.now + KONTROL_TIMELINE.lockGraceMs);
        closing = true;
      }
      const waves = state.waves.map((w, i) =>
        i === phase.wave ? { ...w, cuts, endsAt, jumps, closing } : w,
      );
      const timed = reschedule(waves, phase.wave);
      return { ...state, ...phase, waves: timed.waves, finishAt: timed.finishAt };
    },

    // Aşama değişimi durumu bir kez değiştirir: sunucu değişiklikte yayın yapar, geçiş tam zamanında görünür.
    tick(state, ctx): KontrolState {
      const phase = phaseAt(state, ctx.now);
      return phase.stage === state.stage && phase.wave === state.wave ? state : { ...state, ...phase };
    },

    nextWake(state, ctx): number | null {
      const times = state.waves.flatMap((w) => [w.startedAt, w.endsAt]).concat(state.finishAt);
      const future = times.filter((t) => t > ctx.now);
      return future.length > 0 ? Math.min(...future) : null;
    },

    publicView(state): KontrolPublicView {
      const cur = state.waves[state.wave] as KontrolWave;
      const next = state.waves[state.wave + 1];
      const nextAt =
        state.stage === "break" && next
          ? next.startedAt
          : state.stage === "reveal"
            ? state.finishAt
            : cur.endsAt;
      return {
        players: [...state.players],
        stage: state.stage,
        wave: state.wave,
        waves: state.waves.length,
        wires: waveColors(state.wave).length,
        startedAt: cur.startedAt,
        endsAt: cur.endsAt,
        nextAt,
        finishAt: state.finishAt,
        done: state.players.filter((id) => has(cur.cuts, id)),
        jumps: cur.jumps.length,
        lastJumpAt: cur.jumps[cur.jumps.length - 1] ?? null,
        results: finishedResults(state),
        reveal: state.stage === "reveal" ? finalReveal(state) : null,
      };
    },

    view(state, playerId): KontrolView {
      if (playerId === null || !state.players.includes(playerId) || state.stage !== "play")
        return { panel: [], clue: null, myCut: null };
      const cur = state.waves[state.wave] as KontrolWave;
      const clue = cur.clues[playerId];
      return {
        panel: [...(cur.panels[playerId] as WireColor[])],
        clue: clue ? cloneClue(clue) : null,
        myCut: has(cur.cuts, playerId) ? (cur.cuts[playerId] as WireColor) : null,
      };
    },

    isFinished(state, ctx): boolean {
      return ctx.now >= state.finishAt;
    },

    // Süren dalganın panelleri ve ipuçları yalnız sahibinde (ipucu, taşıyıcıda). Dalga 1 ve 2 dizilimleri ayrıdır,
    // ipucu dalga numarasını taşır: açılmış önceki dalgalar metin aramasında yanlış alarm vermez. Kesimler ve
    // ipucu-hedef eşlemesi kısa/ayırt edici olmadığından gizlilikleri yapısaldır (kontrol-paneli-kaosu.test.ts).
    secrets(state): readonly SecretEntry[] {
      if (state.stage !== "play") return [];
      const cur = state.waves[state.wave] as KontrolWave;
      const entries: SecretEntry[] = [];
      for (const id of state.players) {
        entries.push({ ownerIds: [id], value: JSON.stringify(cur.panels[id]), label: `${id} paneli` });
        const clue = cur.clues[id];
        if (clue) entries.push({ ownerIds: [id], value: JSON.stringify(clue), label: `${id} ipucu` });
      }
      return entries;
    },

    result(state) {
      const { awards } = finalReveal(state);
      return { miniScores: { ...awards }, awards: { ...awards } };
    },
  };
