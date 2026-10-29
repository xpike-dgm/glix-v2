import {
  type AnyGame,
  type GameLog,
  type GameResult,
  gameClock,
  isRejected,
  type LegacyContentTone,
} from "../game.js";
import { GameRecorder } from "../replay.js";
import { createRng, type Rng } from "../rng.js";
import { deepFreeze } from "./deep.js";

/**
 * Bot eylem üreticisi: geçerli (parseAction'ın kabul edeceği) ham eylem üretir.
 * Eylemin verildiği andaki görünümler ve bağlı katılımcılar (katılım sırasıyla) iletilir; hedef seçen bir oyun
 * botu hedefi `connected` içinden seçmelidir (kendisi hariç: `connected.filter((id) => id !== playerId)`).
 * Yalnız verilen argümanlara ve `rng`'ye bakmalıdır; böylece kayıt tekrarlanabilir kalır. Görünümler eylem
 * anındaki (o ana kadar tick'lenmiş) durumdan hesaplanır, tick takvimine bağlı değildir. Katılımcı olmayan
 * (outsider) için `privateView` izleyici görünümüdür.
 */
export type ActionGenerator = (
  rng: Rng,
  playerId: string,
  publicView: unknown,
  privateView: unknown,
  connected: readonly string[],
) => unknown;

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
  /** `make` yoksa gönderilecek ham eylem. */
  raw: unknown;
  /** Geçerli eylemlerde ham eylem, eylem anında bot üreticisiyle üretilir (seed ile sabit rng). */
  make?: (views: { publicView: unknown; privateView: unknown; connected: readonly string[] }) => unknown;
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
  const valid = (playerId: string, elapsed: number, kind: EventKind) => {
    const genSeed = rng.int(2 ** 30);
    out.push({
      t: startedAt + elapsed,
      playerId,
      raw: undefined,
      make: (v) => bot.generate(createRng(genSeed), playerId, v.publicView, v.privateView, v.connected),
      kind,
    });
  };

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

export interface PresenceEvent {
  t: number;
  playerId: string;
  connected: boolean;
}

export const DEFAULT_DISCONNECT_PROBABILITY = 0.3;

/**
 * Rastgele kopma/dönüş takvimi (tohumdan, tick takvimine bağlı değil). Her oyuncu için en çok 3 kopma;
 * `probability` bir oyuncunun kopma dönemi yaşama olasılığıdır. Herkes aynı anda kopuk kalamaz: bağlı sayısını
 * sıfıra indirecek kopma atılır. Durumu değiştirmeyen olaylar elenir; t > startedAt.
 */
export function buildPresence(
  seed: number,
  players: readonly string[],
  startedAt: number,
  durationMs: number,
  probability = DEFAULT_DISCONNECT_PROBABILITY,
): PresenceEvent[] {
  if (probability <= 0) return [];
  const rng = createRng((seed ^ 0x9e3779b1) >>> 0);
  const span = durationMs + DEFAULT_SLACK_MS;
  const raw: PresenceEvent[] = [];
  for (const playerId of players) {
    if (rng.next() >= probability) continue;
    let t = startedAt + 1 + rng.int(span);
    const episodes = 1 + rng.int(3);
    for (let i = 0; i < episodes; i++) {
      raw.push({ t, playerId, connected: false });
      if (rng.next() < 0.1) break; // bir daha dönmez
      t += 1 + rng.int(4_000);
      raw.push({ t, playerId, connected: true });
      t += 1 + rng.int(4_000);
    }
  }
  raw.sort((a, b) => a.t - b.t);
  const online = new Set(players);
  const out: PresenceEvent[] = [];
  for (const e of raw) {
    if (e.connected === online.has(e.playerId)) continue;
    if (!e.connected && online.size <= 1) continue;
    if (e.connected) online.add(e.playerId);
    else online.delete(e.playerId);
    out.push(e);
  }
  return out;
}

export interface StepInfo {
  label: "setup" | "action" | "tick" | "presence" | "finish-tick";
  now: number;
  /** Adım anında bağlı katılımcılar. */
  connected: readonly string[];
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
  /**
   * Bağlantı değişimleri. Verilmezse `disconnectProbability` ile tohumdan üretilir (varsayılan
   * DEFAULT_DISCONNECT_PROBABILITY; 0 = kopma yok). Aynı anda presence, tick ve eylem varsa sıra: presence, tick, eylem.
   */
  presence?: readonly PresenceEvent[];
  disconnectProbability?: number;
  durationMs: number;
  slackMs?: number;
  maxSteps?: number;
  /** Durumları derin dondurur (varsayılan true). */
  freeze?: boolean;
  onStep?: (info: StepInfo) => void;
  /**
   * Geç gelen eylem payı (`GameDefinition.graceMs`): verilirse oyun, sunucudaki gibi `gameClock` saatini görür
   * (`setup` gerçek `startedAt`'ta); kayıt ve `onStep.now` da oyun saatindedir. `takvim` (ticks/actions) gerçek saattir.
   */
  graceMs?: number;
  /** Yalnız eski ton taşıyan kaydı sınamak için. */
  tone?: LegacyContentTone;
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

type Item =
  | { t: number; order: -1; presence: PresenceEvent }
  | { t: number; order: 0 | 1; presence?: undefined; action: ScheduledAction | null };

/** Oyunu sunucu gibi sürer: kabul edilen eylemleri kaydeder, `isFinished` olunca son tick ve `result`. */
export function runSimulation(game: AnyGame, opts: RunOptions): RunOutput {
  const { seed, players, startedAt } = opts;
  const freeze = opts.freeze ?? true;
  const slack = opts.slackMs ?? DEFAULT_SLACK_MS;
  const maxSteps = opts.maxSteps ?? 50_000;
  const deadline = startedAt + opts.durationMs + slack;
  const f = <T>(v: T): T => (freeze ? deepFreeze(v) : v);

  const presence =
    opts.presence ?? buildPresence(seed, players, startedAt, opts.durationMs, opts.disconnectProbability);
  const items: Item[] = [];
  for (const p of presence) items.push({ t: p.t, order: -1, presence: p });
  for (const t of opts.ticks) items.push({ t, order: 0, action: null });
  for (const a of opts.actions) items.push({ t: a.t, order: 1, action: a });
  items.sort((a, b) => a.t - b.t || a.order - b.order);

  const rng = createRng(seed);
  const recorder = new GameRecorder(game.id, seed, players, startedAt);
  const roster = f([...players]);
  const online = new Set(players);
  let connected: readonly string[] = f([...players]);
  const gc = (t: number): number => gameClock(startedAt, t, opts.graceMs);
  const ctxAt = (now: number) => ({ now: gc(now), rng, connected });
  let state: unknown = f(
    game.setup(roster, { ...ctxAt(startedAt), ...(opts.tone !== undefined ? { tone: opts.tone } : {}) }),
  );
  let steps = 1;
  let accepted = 0;
  let rejected = 0;
  let unparsed = 0;
  opts.onStep?.({
    label: "setup",
    now: startedAt,
    connected,
    prev: null,
    state,
    event: null,
    reduced: null,
    parsed: null,
  });

  const finish = (now: number): RunOutput => {
    const prev = state;
    state = f(game.tick(state, ctxAt(now)));
    steps++;
    opts.onStep?.({
      label: "finish-tick",
      now: gc(now),
      connected,
      prev,
      state,
      event: null,
      reduced: null,
      parsed: null,
    });
    return {
      result: game.result(state),
      state,
      endedAt: now,
      steps,
      accepted,
      rejected,
      unparsed,
      // Yeni kayıt ton yazmaz; eski ton taşıyan kaydı taklit etmek için yalnız istenirse eklenir.
      log: { ...recorder.finish(gc(now)), ...(opts.tone !== undefined ? { tone: opts.tone } : {}) },
    };
  };

  if (game.isFinished(state, ctxAt(startedAt))) return finish(startedAt);

  for (const item of items) {
    if (steps++ > maxSteps) throw new SimulationError(`adım sınırı aşıldı (${maxSteps}); oyun bitmiyor`);
    const now = item.t;
    const prev = state;
    if (item.order === -1) {
      const p = item.presence;
      if (p.connected) online.add(p.playerId);
      else online.delete(p.playerId);
      connected = f(players.filter((id) => online.has(id)));
      recorder.presence(gc(now), p.playerId, p.connected);
      opts.onStep?.({
        label: "presence",
        now: gc(now),
        connected,
        prev,
        state,
        event: null,
        reduced: null,
        parsed: null,
      });
      continue;
    }
    if (item.action === null) {
      state = f(game.tick(state, ctxAt(now)));
      opts.onStep?.({
        label: "tick",
        now: gc(now),
        connected,
        prev,
        state,
        event: null,
        reduced: null,
        parsed: null,
      });
    } else {
      const event = item.action;
      let raw = event.raw;
      if (event.make) {
        // Görünümler eylem anına tick'lenmiş (saf) durumdan; tick takvimine bağlı olmasın.
        const at = game.tick(state, ctxAt(now));
        const who = players.includes(event.playerId) ? event.playerId : null;
        raw = event.make({
          publicView: game.publicView(at, ctxAt(now)),
          privateView: game.view(at, who, ctxAt(now)),
          connected,
        });
      }
      const parsed = game.parseAction(raw);
      let reduced: unknown = null;
      if (parsed === null) {
        unparsed++;
      } else {
        f(parsed);
        reduced = game.reduce(state, event.playerId, parsed, ctxAt(now));
        if (isRejected(reduced)) {
          rejected++;
        } else {
          accepted++;
          state = f(reduced);
          recorder.record(gc(now), event.playerId, raw);
        }
      }
      opts.onStep?.({ label: "action", now: gc(now), connected, prev, state, event, reduced, parsed });
    }
    if (game.isFinished(state, ctxAt(now))) return finish(now);
  }
  throw new SimulationError(
    `oyun süre + pay içinde (${opts.durationMs + slack} ms, son an ${deadline}) bitmedi: ${game.id}`,
  );
}
