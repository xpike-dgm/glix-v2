import type { ContentSet } from "./content.js";
import { type AnyGame, type GameContext, type GameLog, type GameResult, isRejected } from "./game.js";
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
  private readonly presenceLog: GameLog["presence"] = [];
  private readonly players: string[];
  private readonly content?: ContentSet;

  constructor(
    private readonly gameId: string,
    private readonly seed: number,
    players: readonly string[],
    private readonly startedAt: number,
    content?: ContentSet,
  ) {
    this.players = [...players];
    // Kayıt, sunucunun sonradan değiştirebileceği nesneye bağlı kalmasın.
    if (content !== undefined) this.content = JSON.parse(JSON.stringify(content)) as ContentSet;
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

  /** Bağlantı değişimi (zaman sıralı). Bir sonraki tick/eylemden önce kaydedilmelidir. */
  presence(t: number, playerId: string, connected: boolean): void {
    const last = this.presenceLog[this.presenceLog.length - 1];
    if (this.truncated) return;
    if (this.presenceLog.length >= MAX_RECORDED_ACTIONS) {
      this.truncated = true;
      return;
    }
    if (last && t < last.t) throw new Error("GameRecorder: bağlantı değişimleri zaman sıralı olmalı");
    this.presenceLog.push({ t, playerId, connected });
  }

  finish(endedAt: number): GameLog {
    return {
      gameId: this.gameId,
      seed: this.seed,
      players: [...this.players],
      startedAt: this.startedAt,
      actions: this.actions.map((a) => ({ ...a })),
      endedAt,
      presence: this.presenceLog.map((p) => ({ ...p })),
      ...(this.content !== undefined ? { content: this.content } : {}),
      ...(this.truncated ? { truncated: true } : {}),
    };
  }
}

/**
 * Kaydı deterministik olarak yeniden oynatır: tohumdan rng, `startedAt`'ta setup, her eylemden önce
 * o andaki tick, sonda `endedAt`'ta tick. Başta herkes bağlıdır; `presence` değişimleri aynı andaki
 * tick ve eylemlerden önce uygulanır (`ctx.connected` katılım sırasını korur).
 * Sonuç `tick` zamanlamasından bağımsızdır (docs/PROTOKOL.md).
 */
export function replay(game: AnyGame, log: GameLog): GameResult {
  if (game.id !== log.gameId) throw new Error(`replay: oyun uyuşmuyor (${game.id} / ${log.gameId})`);
  if (log.truncated) throw new Error("replay: kayıt eksik (eylem sınırı aşıldı)");
  const rng = createRng(log.seed);
  const online = new Set(log.players);
  let next = 0;
  const ctxAt = (now: number): GameContext => {
    while (next < log.presence.length && (log.presence[next]?.t ?? Number.POSITIVE_INFINITY) <= now) {
      const p = log.presence[next++];
      if (!p || !log.players.includes(p.playerId))
        throw new Error(`replay: bilinmeyen oyuncu bağlantı kaydı (${p?.playerId})`);
      if (p.connected) online.add(p.playerId);
      else online.delete(p.playerId);
    }
    return { now, rng, connected: log.players.filter((id) => online.has(id)) };
  };
  let state = game.setup(log.players, {
    ...ctxAt(log.startedAt),
    ...(log.tone !== undefined ? { tone: log.tone } : {}),
    ...(log.content !== undefined ? { content: log.content } : {}),
  });
  for (const entry of log.actions) {
    state = game.tick(state, ctxAt(entry.t));
    const action = game.parseAction(entry.action);
    if (action === null) throw new Error(`replay: geçersiz eylem kaydı (t=${entry.t})`);
    const result = game.reduce(state, entry.playerId, action, ctxAt(entry.t));
    if (isRejected(result))
      throw new Error(`replay: kayıtlı eylem reddedildi (${result.rejected}, t=${entry.t})`);
    state = result;
  }
  state = game.tick(state, ctxAt(log.endedAt));
  return game.result(state);
}
