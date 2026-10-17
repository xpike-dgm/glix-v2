import type { Rng } from "./rng.js";

/** Oyun fonksiyonlarına sunucunun verdiği bağlam. `now` sunucu saatidir (ms). */
export interface GameContext {
  now: number;
  rng: Rng;
}

export interface Rejected {
  rejected: string;
}

export function isRejected(value: unknown): value is Rejected {
  return typeof value === "object" && value !== null && "rejected" in value;
}

/** Oyun öncesi tam ekran anlatım: kısa amaç + en fazla 3 madde. */
export interface Briefing {
  goal: string;
  steps: readonly string[];
}

export interface GameResult {
  /** Mini oyun içi puanlar. */
  miniScores: Record<string, number>;
  /** Genel skora eklenecek puanlar (kural dosyasındaki aktarım). */
  awards: Record<string, number>;
}

/**
 * Bir mini oyun saf fonksiyonlardan oluşur. Durum değiştirilmez; her çağrı yeni durum döner.
 * İstemciye yalnız `view` çıktısı gider: gizli bilgi yalnız hak sahibinin görünümüne konur.
 */
export interface GameDefinition<State, Action, View> {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  orientation: "portrait" | "landscape";
  briefing: Briefing;
  /** Ağdan gelen ham eylemi doğrular; geçersizse null. */
  parseAction(raw: unknown): Action | null;
  setup(players: readonly string[], ctx: GameContext): State;
  reduce(state: State, playerId: string, action: Action, ctx: GameContext): State | Rejected;
  /** Zamana bağlı ilerleme; sunucu düzenli aralıklarla çağırır. Değişiklik yoksa aynı nesneyi döner. */
  tick(state: State, ctx: GameContext): State;
  /** playerId null ise izleyici görünümü. */
  view(state: State, playerId: string | null, ctx: GameContext): View;
  isFinished(state: State, ctx: GameContext): boolean;
  result(state: State): GameResult;
}

// biome-ignore lint/suspicious/noExplicitAny: kayıt defteri farklı tipte oyunları birlikte tutar.
export type AnyGame = GameDefinition<any, any, any>;
