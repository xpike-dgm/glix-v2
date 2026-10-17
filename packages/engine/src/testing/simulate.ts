import { type AnyGame, type GameLog, type GameResult, isRejected } from "../game.js";
import { GameRecorder } from "../replay.js";
import { createRng, type Rng } from "../rng.js";
import { deepFreeze } from "./deep.js";

export interface BotContext {
  playerId: string;
  players: readonly string[];
  /** Oyun başından beri geçen ms. */
  elapsed: number;
  durationMs: number;
}

/** Geçerli (parseAction'ın kabul edeceği) bir ham eylem üretir. Duruma bakmaz: kayıt tekrarlanabilir kalır. */
export type ActionGenerator = (rng: Rng, ctx: BotContext) => unknown;

export interface GameBot {
  /** Oyunun bildirilen süresi; simülasyon bu süre + pay içinde bitmek zorundadır. */
  durationMs: number;
  generate: ActionGenerator;
  /** Eylem kümelerinin dağılma payları (ms); varsayılan [40, 150, 400]. */
  burstJitterMs?: readonly number[];
}

export type EventKind = "valid" | "garbage" | "outsider" | "outsiderGarbage";

export interface ScheduledAction {
  t: number;
  playerId: string;
  raw: unknown;
  kind: EventKind;
}

export type TickMode = "irregular" | "dense" | "sparse";

export const OUTSIDER_IDS: readonly string[] = ["ghost", "", "__proto__", "constructor", "p0"];
export const DEFAULT_SLACK_MS = 3_000;
export const DEFAULT_START = 1_700_000_000_000;

export class SimulationError extends Error {}

export function garbageValue(rng: Rng, depth = 0): unknown {
  switch (rng.int(14)) {
    case 0:
      return null;
    case 1:
      return undefined;
    case 2:
      return [0, 1, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, -0, 1e308, 2 ** 53][rng.int(9)];
    case 3:
      return ["", "press", "a".repeat(5000), "ünicode İıĞğ 😀", "__proto__", "{}"][rng.int(6)];
    case 4:
      return rng.int(2) === 0;
    case 5: {
      const out: unknown[] = [];
      const n = rng.int(5);
      for (let i = 0; i < n && depth < 4; i++) out.push(garbageValue(rng, depth + 1));
      return out;
    }
    case 6: {
      let deep: unknown = "x";
      const levels = 20 + rng.int(40);
      for (let i = 0; i < levels; i++) deep = rng.int(2) === 0 ? { a: deep } : [deep];
      return deep;
    }
    case 7:
      return { kind: "__yok__" };
    case 8:
      return { kind: null };
    case 9:
      return { kind: rng.int(1000) };
    case 10:
      return JSON.parse('{"__proto__":{"kind":"press"}}');
    case 11:
      return JSON.parse('{"constructor":{"prototype":{"kind":"press"}}}');
    case 12:
      return { type: "press" };
    default:
      return {};
  }
}

/** Dürtülü (kümeli) + dağınık eylem takvimi: eşleşme de tek başına basış da oluşur. */
export function buildActions(
  bot: GameBot,
  seed: number,
  players: readonly string[],
  startedAt: number,
  slackMs = DEFAULT_SLACK_MS,
): ScheduledAction[] {
  const rng = createRng((seed ^ 0x5eed1234) >>> 0);
  const span = bot.durationMs + slackMs;
  const jitters = bot.burstJitterMs ?? [40, 150, 400];
  const out: ScheduledAction[] = [];
  const ctxFor = (playerId: string, elapsed: number): BotContext => ({
    playerId,
    players,
    elapsed,
    durationMs: bot.durationMs,
  });
  const valid = (playerId: string, elapsed: number, kind: EventKind) =>
    out.push({
      t: startedAt + elapsed,
      playerId,
      raw: bot.generate(rng, ctxFor(playerId, elapsed)),
      kind,
    });

  const bursts = 3 + rng.int(40);
  for (let b = 0; b < bursts; b++) {
    const center = rng.int(span);
    const jitter = jitters[rng.int(jitters.length)] ?? 100;
    const participation = 0.3 + rng.next() * 0.7;
    for (const id of players) {
      if (rng.next() < participation) valid(id, Math.min(span, center + rng.int(jitter + 1)), "valid");
    }
  }
  const solos = rng.int(60);
  for (let i = 0; i < solos; i++)
    valid(players[rng.int(players.length)] as string, rng.int(span + 1), "valid");
  const outsiders = rng.int(25);
  for (let i = 0; i < outsiders; i++) {
    valid(OUTSIDER_IDS[rng.int(OUTSIDER_IDS.length)] as string, rng.int(span + 1), "outsider");
  }
  const garbage = rng.int(40);
  for (let i = 0; i < garbage; i++) {
    const pool = rng.int(4) === 0 ? OUTSIDER_IDS : players;
    out.push({
      t: startedAt + rng.int(span + 1),
      playerId: pool[rng.int(pool.length)] as string,
      raw: garbageValue(rng),
      kind: "garbage",
    });
  }
  return out
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.t - b.e.t || a.i - b.i)
    .map((x) => x.e);
}

/** Tick zamanları (artan); son tick her zaman süre + pay sonundadır. */
export function buildTicks(
  seed: number,
  mode: TickMode,
  startedAt: number,
  durationMs: number,
  slackMs = DEFAULT_SLACK_MS,
): number[] {
  const rng = createRng((seed ^ 0x71c4) >>> 0);
  const deadline = startedAt + durationMs + slackMs;
  const ticks: number[] = [];
  let t = startedAt;
  while (t < deadline) {
    t +=
      mode === "dense" ? 25 + rng.int(50) : mode === "sparse" ? 3_000 + rng.int(9_000) : 1 + rng.int(2_500);
    ticks.push(Math.min(t, deadline));
  }
  if (mode === "irregular") {
    // Aynı ms'de birden çok tick ve oyun başında tick de olabilir.
    ticks.push(startedAt, ...ticks.slice(0, 5));
    ticks.sort((a, b) => a - b);
  }
  return ticks;
}

export interface StepInfo {
  label: "setup" | "action" | "tick" | "finish-tick";
  now: number;
  /** Adımdan önceki durum (setup'ta null). */
  prev: unknown;
  /** Adımdan sonraki durum. */
  state: unknown;
  event: ScheduledAction | null;
  /** `reduce` çağrıldıysa dönüşü (parseAction null ise çağrılmaz). */
  reduced: unknown;
  parsed: unknown;
}

export interface RunOptions {
  seed: number;
  players: readonly string[];
  startedAt: number;
  actions: readonly ScheduledAction[];
  ticks: readonly number[];
  durationMs: number;
  slackMs?: number;
  maxSteps?: number;
  /** Durumları derin dondurur (varsayılan true). */
  freeze?: boolean;
  onStep?: (info: StepInfo) => void;
}

export interface RunOutput {
  result: GameResult;
  state: unknown;
  endedAt: number;
  steps: number;
  accepted: number;
  rejected: number;
  unparsed: number;
  log: GameLog;
}

type Item = { t: number; order: number; action: ScheduledAction | null };

/** Oyunu sunucu gibi sürer: kabul edilen eylemleri kaydeder, `isFinished` olunca son tick ve `result`. */
export function runSimulation(game: AnyGame, opts: RunOptions): RunOutput {
  const { seed, players, startedAt } = opts;
  const freeze = opts.freeze ?? true;
  const slack = opts.slackMs ?? DEFAULT_SLACK_MS;
  const maxSteps = opts.maxSteps ?? 50_000;
  const deadline = startedAt + opts.durationMs + slack;
  const f = <T>(v: T): T => (freeze ? deepFreeze(v) : v);

  const items: Item[] = [];
  for (const t of opts.ticks) items.push({ t, order: 0, action: null });
  for (const a of opts.actions) items.push({ t: a.t, order: 1, action: a });
  items.sort((a, b) => a.t - b.t || a.order - b.order);

  const rng = createRng(seed);
  const recorder = new GameRecorder(game.id, seed, players, startedAt);
  const roster = f([...players]);
  let state: unknown = f(game.setup(roster, { now: startedAt, rng }));
  let steps = 1;
  let accepted = 0;
  let rejected = 0;
  let unparsed = 0;
  opts.onStep?.({
    label: "setup",
    now: startedAt,
    prev: null,
    state,
    event: null,
    reduced: null,
    parsed: null,
  });

  const finish = (now: number): RunOutput => {
    const prev = state;
    state = f(game.tick(state, { now, rng }));
    steps++;
    opts.onStep?.({ label: "finish-tick", now, prev, state, event: null, reduced: null, parsed: null });
    return {
      result: game.result(state),
      state,
      endedAt: now,
      steps,
      accepted,
      rejected,
      unparsed,
      log: recorder.finish(now),
    };
  };

  if (game.isFinished(state, { now: startedAt, rng })) return finish(startedAt);

  for (const item of items) {
    if (steps++ > maxSteps) throw new SimulationError(`adım sınırı aşıldı (${maxSteps}); oyun bitmiyor`);
    const now = item.t;
    const prev = state;
    if (item.action === null) {
      state = f(game.tick(state, { now, rng }));
      opts.onStep?.({ label: "tick", now, prev, state, event: null, reduced: null, parsed: null });
    } else {
      const event = item.action;
      const parsed = game.parseAction(event.raw);
      let reduced: unknown = null;
      if (parsed === null) {
        unparsed++;
      } else {
        f(parsed);
        reduced = game.reduce(state, event.playerId, parsed, { now, rng });
        if (isRejected(reduced)) {
          rejected++;
        } else {
          accepted++;
          state = f(reduced);
          recorder.record(now, event.playerId, event.raw);
        }
      }
      opts.onStep?.({ label: "action", now, prev, state, event, reduced, parsed });
    }
    if (game.isFinished(state, { now, rng })) return finish(now);
  }
  throw new SimulationError(
    `oyun süre + pay içinde (${opts.durationMs + slack} ms, son an ${deadline}) bitmedi: ${game.id}`,
  );
}
