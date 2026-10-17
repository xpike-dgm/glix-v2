import { type AnyGame, type GameLog, type GameResult, isRejected } from "./game.js";
import { createRng } from "./rng.js";

/** Bir oyunda kaydedilecek en çok eylem; aşılırsa kayıt durur ve `truncated` işaretlenir. */
export const MAX_RECORDED_ACTIONS = 20_000;

/**
 * Sunucunun maç kaydı tutma yolu: oyun başlarken `new GameRecorder(gameId, seed, players, startedAt)`,
 * `parseAction`'ın ürettiği eylem `reduce` tarafından da kabul edilince (Rejected değilse)
 * `record(t, playerId, parsedAction)`, oyun bitince `finish(endedAt)`. Kaydedilen, ağdan gelen ham
 * veri değil `parseAction` çıktısıdır (bellek şişirmeyi önler); `replay` onu yeniden `parseAction`
 * ile işler, bu yüzden `parseAction` kendi çıktısını değiştirmeden kabul etmelidir (idempotent).
 */
export class GameRecorder {
  private truncated = false;
  private readonly actions: GameLog["actions"] = [];
  private readonly players: string[];

  constructor(
    private readonly gameId: string,
    private readonly seed: number,
    players: readonly string[],
    private readonly startedAt: number,
  ) {
    this.players = [...players];
  }

  record(t: number, playerId: string, action: unknown): void {
    const last = this.actions[this.actions.length - 1];
    if (this.truncated) return;
    if (this.actions.length >= MAX_RECORDED_ACTIONS) {
      this.truncated = true;
      return;
    }
    if (last && t < last.t) throw new Error("GameRecorder: eylemler zaman sıralı olmalı");
    this.actions.push({ t, playerId, action });
  }

  finish(endedAt: number): GameLog {
    return {
      gameId: this.gameId,
      seed: this.seed,
      players: [...this.players],
      startedAt: this.startedAt,
      actions: this.actions.map((a) => ({ ...a })),
      endedAt,
      ...(this.truncated ? { truncated: true } : {}),
    };
  }
}

/**
 * Kaydı deterministik olarak yeniden oynatır: tohumdan rng, `startedAt`'ta setup, her eylemden önce
 * o andaki tick, sonda `endedAt`'ta tick. Sonuç `tick` zamanlamasından bağımsızdır (docs/PROTOKOL.md).
 */
export function replay(game: AnyGame, log: GameLog): GameResult {
  if (game.id !== log.gameId) throw new Error(`replay: oyun uyuşmuyor (${game.id} / ${log.gameId})`);
  if (log.truncated) throw new Error("replay: kayıt eksik (eylem sınırı aşıldı)");
  const rng = createRng(log.seed);
  let state = game.setup(log.players, { now: log.startedAt, rng });
  for (const entry of log.actions) {
    state = game.tick(state, { now: entry.t, rng });
    const action = game.parseAction(entry.action);
    if (action === null) throw new Error(`replay: geçersiz eylem kaydı (t=${entry.t})`);
    const next = game.reduce(state, entry.playerId, action, { now: entry.t, rng });
    if (isRejected(next))
      throw new Error(`replay: kayıtlı eylem reddedildi (${next.rejected}, t=${entry.t})`);
    state = next;
  }
  state = game.tick(state, { now: log.endedAt, rng });
  return game.result(state);
}
