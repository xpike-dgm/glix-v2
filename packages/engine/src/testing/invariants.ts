import { type AnyGame, type GameResult, isRejected, REVEAL_HOLD_MS } from "../game.js";
import { replay } from "../replay.js";
import { createRng } from "../rng.js";
import { deepClone, deepEqual } from "./deep.js";
import {
  buildActions,
  buildPresence,
  buildTicks,
  DEFAULT_SLACK_MS,
  DEFAULT_START,
  type GameBot,
  type RunOutput,
  runSimulation,
  type StepInfo,
} from "./simulate.js";

export type ViolationCode =
  | "leak"
  | "short-secret"
  | "view-throws"
  | "impure"
  | "mutated"
  | "outsider-accepted"
  | "nondeterministic"
  | "tick-dependent"
  | "bad-result"
  | "replay-mismatch"
  | "reveal";

export class InvariantViolation extends Error {
  constructor(
    readonly code: ViolationCode,
    message: string,
  ) {
    super(`[${code}] ${message}`);
  }
}

const fresh = (now: number, connected: readonly string[]) => ({ now, rng: createRng(12345), connected });

function leaksValue(json: string, value: string): boolean {
  return json.includes(value) || json.includes(JSON.stringify(value).slice(1, -1));
}

/** Gizli değerlerin hak sahibi olmayanların (ve izleyicinin) görünümüne sızıp sızmadığını arar. */
export function findLeaks(
  game: AnyGame,
  state: unknown,
  players: readonly string[],
  now: number,
  connected: readonly string[] = players,
): { code: "leak" | "short-secret" | "view-throws"; message: string }[] {
  const found: { code: "leak" | "short-secret" | "view-throws"; message: string }[] = [];
  const finished = game.isFinished(state, fresh(now, connected));
  const views = new Map<string | null, string>();
  let publicJson = "";
  try {
    publicJson = JSON.stringify(game.publicView(state, fresh(now, connected))) ?? "";
  } catch (e) {
    found.push({ code: "view-throws", message: `publicView hata fırlattı: ${String(e)}` });
  }
  for (const p of [...players, null]) {
    try {
      views.set(p, JSON.stringify(game.view(state, p, fresh(now, connected))) ?? "");
    } catch (e) {
      found.push({
        code: "view-throws",
        message: `view(${p === null ? "izleyici" : p}) hata fırlattı: ${String(e)}`,
      });
    }
  }
  for (const entry of game.secrets(state)) {
    if (entry.value.length < 3) {
      found.push({ code: "short-secret", message: `"${entry.label}" değeri 3 karakterden kısa` });
      continue;
    }
    if (finished && entry.ownerIds.length === 0) continue;
    if (leaksValue(publicJson, entry.value)) {
      found.push({ code: "leak", message: `"${entry.label}" herkese açık görünüme (publicView) sızdı` });
    }
    for (const [viewer, json] of views) {
      if (viewer !== null && entry.ownerIds.includes(viewer)) continue;
      if (leaksValue(json, entry.value)) {
        found.push({
          code: "leak",
          message: `"${entry.label}" ${viewer === null ? "izleyici" : viewer} görünümüne sızdı`,
        });
      }
    }
  }
  return found;
}

function twice<T>(
  label: string,
  now: number,
  connected: readonly string[],
  fn: (ctx: { now: number; rng: ReturnType<typeof createRng>; connected: readonly string[] }) => T,
): T {
  const a = fn(fresh(now, connected));
  const b = fn(fresh(now, connected));
  if (!deepEqual(a, b)) throw new InvariantViolation("impure", `${label}: aynı girdi farklı çıktı verdi`);
  return a;
}

/**
 * Sonuç ekranı sözleşmesi (`revealAt`, docs/ERKEN-BITIS.md): saf; açılış başladıktan sonra an kaymaz ve sonuç
 * değişmez; oyun açılış başlamadan bitmez (sunucu "Devam et"i yalnız açılışta gösterir).
 */
function makeRevealChecker(game: AnyGame) {
  let opened: { at: number; result: GameResult } | null = null;
  return (info: StepInfo, where: string): void => {
    if (!game.revealAt) return;
    const at = twice(`${where} revealAt`, info.now, info.connected, (ctx) =>
      game.revealAt?.(info.state, ctx),
    );
    if (at !== null && at !== undefined && (typeof at !== "number" || !Number.isFinite(at)))
      throw new InvariantViolation("reveal", `${where}: revealAt sayı ya da null olmalı (${String(at)})`);
    const reached = typeof at === "number" && at <= info.now;
    if (reached) {
      const ticked = game.tick(info.state, fresh(info.now, info.connected));
      const result = game.result(ticked);
      if (opened === null) opened = { at, result };
      else if (at !== opened.at)
        throw new InvariantViolation("reveal", `${where}: açılış anı kaydı (${opened.at} → ${at})`);
      else if (!deepEqual(result, opened.result))
        throw new InvariantViolation("reveal", `${where}: açılış başladıktan sonra sonuç değişti`);
    } else if (opened !== null) {
      throw new InvariantViolation("reveal", `${where}: açılış başladıktan sonra revealAt geri döndü`);
    }
    if (game.isFinished(info.state, fresh(info.now, info.connected)) && !reached)
      throw new InvariantViolation("reveal", `${where}: oyun sonuç açılışı başlamadan bitti`);
  };
}

/** Her adımda çalışan genel kontroller (b, c, g, h). */
export function makeStepChecker(game: AnyGame, players: readonly string[]) {
  let snapshot: unknown;
  const checkReveal = makeRevealChecker(game);
  return (info: StepInfo): void => {
    const where = `${game.id} @${info.label} t=${info.now}`;
    checkReveal(info, where);
    if (info.prev !== null && !deepEqual(info.prev, snapshot)) {
      throw new InvariantViolation("mutated", `${where}: önceki durum değiştirildi`);
    }
    if (info.event && info.parsed !== null && !players.includes(info.event.playerId)) {
      if (!isRejected(info.reduced)) {
        throw new InvariantViolation(
          "outsider-accepted",
          `${where}: katılımcı olmayan "${info.event.playerId}" kabul edildi`,
        );
      }
    }
    if (info.label === "action" && info.parsed !== null && info.prev !== null) {
      const again = game.reduce(
        info.prev,
        info.event?.playerId ?? "",
        info.parsed,
        fresh(info.now, info.connected),
      );
      const again2 = game.reduce(
        info.prev,
        info.event?.playerId ?? "",
        info.parsed,
        fresh(info.now, info.connected),
      );
      if (!deepEqual(again, again2)) throw new InvariantViolation("impure", `${where}: reduce saf değil`);
    }
    if (info.label === "tick" || info.label === "finish-tick") {
      twice(`${where} tick`, info.now, info.connected, (ctx) => game.tick(info.prev, ctx));
    }
    twice(`${where} isFinished`, info.now, info.connected, (ctx) => game.isFinished(info.state, ctx));
    if (game.nextWake) {
      const wake = twice(`${where} nextWake`, info.now, info.connected, (ctx) =>
        game.nextWake?.(info.state, ctx),
      );
      if (wake !== null && wake !== undefined && !(wake > info.now)) {
        throw new InvariantViolation("impure", `${where}: nextWake şimdiden sonra olmalı (${wake})`);
      }
    }
    twice(`${where} secrets`, info.now, info.connected, () => game.secrets(info.state));
    twice(`${where} publicView`, info.now, info.connected, (ctx) => game.publicView(info.state, ctx));
    for (const p of [...players, null]) {
      twice(`${where} view(${p})`, info.now, info.connected, (ctx) => game.view(info.state, p, ctx));
    }
    const leaks = findLeaks(game, info.state, players, info.now, info.connected);
    const first = leaks[0];
    if (first) throw new InvariantViolation(first.code, `${where}: ${first.message}`);
    const after = deepClone(info.state);
    // Okuma işlevleri durumu değiştirmemeli (donuk durumda hata verirdi; kopya karşılaştırması da yapılır).
    if (!deepEqual(after, info.state))
      throw new InvariantViolation("mutated", `${where}: durum kopyası farklı`);
    snapshot = after;
  };
}

export function checkResult(result: GameResult, players: readonly string[], gameId: string): void {
  for (const [name, table] of [
    ["miniScores", result.miniScores],
    ["awards", result.awards],
  ] as const) {
    for (const [id, value] of Object.entries(table)) {
      if (!players.includes(id))
        throw new InvariantViolation("bad-result", `${gameId}: ${name} katılımcı olmayan "${id}" içeriyor`);
      if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
        throw new InvariantViolation(
          "bad-result",
          `${gameId}: ${name}[${id}] sonlu tam sayı değil (${String(value)})`,
        );
      }
    }
  }
}

export interface InvariantOptions {
  seed: number;
  playerCount: number;
  slackMs?: number;
  /** Oyuncu başına kopma dönemi olasılığı (varsayılan DEFAULT_DISCONNECT_PROBABILITY). */
  disconnectProbability?: number;
}

export interface InvariantReport {
  primary: RunOutput;
  players: string[];
}

/** Bir oyun + bot için tüm genel değişmezleri tek tohum/oyuncu sayısı için doğrular; ihlalde fırlatır. */
export function checkGameInvariants(game: AnyGame, bot: GameBot, opts: InvariantOptions): InvariantReport {
  const slackMs = opts.slackMs ?? DEFAULT_SLACK_MS;
  const count = Math.min(game.maxPlayers, Math.max(game.minPlayers, opts.playerCount));
  const players = Array.from({ length: count }, (_, i) => `p${i + 1}`);
  const startedAt = DEFAULT_START + (opts.seed % 100_000);
  const actions = buildActions(bot, opts.seed, players, startedAt, slackMs);
  const base = {
    seed: opts.seed,
    players,
    startedAt,
    actions,
    durationMs: bot.durationMs,
    slackMs,
    ...(game.graceMs !== undefined ? { graceMs: game.graceMs } : {}),
    // Tüm koşulların aynı presence takvimini kullanması tick-bağımsızlığı karşılaştırmasını anlamlı kılar.
    presence: buildPresence(opts.seed, players, startedAt, bot.durationMs, opts.disconnectProbability),
  };
  const ticks = (mode: "irregular" | "dense" | "sparse") =>
    buildTicks(opts.seed, mode, startedAt, bot.durationMs, slackMs);

  // (a, b, c, g, h) adım adım kontroller.
  const primary = runSimulation(game, {
    ...base,
    ticks: ticks("irregular"),
    onStep: makeStepChecker(game, players),
  });
  checkResult(primary.result, players, game.id);
  twice("result", primary.endedAt, players, () => game.result(primary.state));

  // (d) belirlilik.
  const again = runSimulation(game, { ...base, ticks: ticks("irregular"), freeze: false });
  if (!deepEqual(again.result, primary.result) || !deepEqual(again.log, primary.log)) {
    throw new InvariantViolation("nondeterministic", `${game.id}: aynı tohum ve takvim farklı sonuç verdi`);
  }
  // (e) tick takvimi bağımsızlığı.
  for (const mode of ["dense", "sparse"] as const) {
    const other = runSimulation(game, { ...base, ticks: ticks(mode), freeze: false });
    if (!deepEqual(other.result, primary.result)) {
      throw new InvariantViolation(
        "tick-dependent",
        `${game.id}: "${mode}" tick takvimi farklı sonuç verdi: ${JSON.stringify(other.result)} ≠ ${JSON.stringify(primary.result)}`,
      );
    }
  }
  // (b) kayıt (presence dahil) tekrar oynatılınca aynı sonucu verir.
  const replayed = replay(game, primary.log);
  if (!deepEqual(replayed, primary.result)) {
    throw new InvariantViolation(
      "replay-mismatch",
      `${game.id}: replay farklı sonuç verdi: ${JSON.stringify(replayed)} ≠ ${JSON.stringify(primary.result)}`,
    );
  }
  // Sonuç ekranı: sunucu oyunu `isFinished`'ten sonra en çok REVEAL_HOLD_MS açık tutar; geç biten kayıt aynı sonucu verir.
  const held = replay(game, { ...primary.log, endedAt: primary.log.endedAt + REVEAL_HOLD_MS });
  if (!deepEqual(held, primary.result)) {
    throw new InvariantViolation(
      "reveal",
      `${game.id}: sonuç ekranında bekletilen kayıt farklı sonuç verdi: ${JSON.stringify(held)} ≠ ${JSON.stringify(primary.result)}`,
    );
  }
  return { primary, players };
}
