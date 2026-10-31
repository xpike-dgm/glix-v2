import { randomInt } from "node:crypto";
import {
  type AnyGame,
  type CardRecorder,
  type CardsMine,
  type CardsState,
  CONTINUE_GRACE_MS,
  collectPublicTexts,
  createRng,
  GAMES,
  type GameContext,
  GameRecorder,
  type GameResult,
  gameClock,
  INSPIRE_MAX_REQUESTS,
  type InspireMine,
  isRejected,
  type MatchSnapshot,
  REVEAL_HOLD_MS,
  type Rng,
} from "@glix/engine";
import { buildGameRecord, buildMatchRecord, type Entrant } from "./accountStats.js";
import { commentPrompt, hasCommentPrompt } from "./aiCommentGames.js";
import {
  freshInspire,
  INSPIRE_GAME_ID,
  INSPIRE_MAX_TOKENS,
  type InspireEntry,
  inspireMine,
  inspirePrompt,
  isFirstWriteStep,
  parseIdeas,
} from "./aiInspire.js";
import {
  archiveCardLog,
  cardPhaseDue,
  cardsMineOf,
  cardsPublicOf,
  commitCards,
  openCardPhase,
  resolveGameCards,
  startCards,
  stepCardPhase,
} from "./cards.js";
import { scrubText } from "./errorScrub.js";
import { pruneClosedGames } from "./gameSwitches.js";
import { log } from "./log.js";
import { errorMessage } from "./messages.js";
import { notifyPlayers, roomHasPush } from "./push.js";
import type { Player, Room, Runtime } from "./runtime.js";
import { isConnected } from "./runtime.js";

export const TICK_MS = 100;
export const BRIEFING_TIMEOUT_MS = 40_000;
export const COUNTDOWN_MS = 3_000;
export const RESULTS_MS = 60_000;
/** Bellekte tutulan son oyun kaydı sayısı (docs/PROTOKOL.md "Maç kaydı"). */
export const RECENT_LOGS = 20;

export interface Match {
  games: AnyGame[];
  /** 0 tabanlı geçerli oyun sırası. */
  index: number;
  /** Maç başında bağlı olanlar; sonradan odadan çıkanlar geçerli oyunda süzülür. */
  startParticipants: string[];
  /** Geçerli oyunun katılımcıları. */
  participants: string[];
  readyIds: Set<string>;
  /** results aşamasında "Devam" diyenler (her sonuç aşaması başında sıfırlanır). */
  continueIds: Set<string>;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  state: unknown;
  rng: Rng | null;
  result: GameResult | null;
  /** Geçerli oyunun kaydı (playing aşamasında dolu). */
  recorder: GameRecorder | null;
  /** İstatistik deposundaki maç kimliği (devre dışıysa null). Kişisel veri içermez. */
  statsId: number | null;
  /** Geçerli oyunun başladığı an (playing'e girerken); istatistik süresi için. */
  gameStartedAt: number | null;
  /** Maçın istatistik kaydı kapatıldı mı (tamamlandı ya da yarıda kaldı). */
  statsEnded: boolean;
  /** Final'de geri bildirim vermiş oyuncular (maç başına bir kez). */
  feedbackBy: Set<string>;
  /** Geçerli oyunda performans özeti göndermiş oyuncular (oyun başına bir kez). */
  perfBy: Set<string>;
  /** Oyunun "sıra kimde" dediği son oyuncular (`notify`); yalnız yeni sıra alanlara bildirim gider. */
  turnHolders: Set<string>;
  /** Kartlar (docs/KURALLAR.md K1..K8); kartlar kapalıysa ya da hiç kart etkin değilse null. */
  cards: CardsState | null;
  cardRec: CardRecorder | null;
  cardLogArchived: boolean;
  /**
   * Oyun içi sonuç ekranı (docs/ERKEN-BITIS.md "Oyun içi sonuç ekranı"): oyunun `revealAt`'i geldiyse dolu, her oyun
   * başında sıfırlanır. Zamanlar sunucu saatiyle (gerçek saat).
   */
  reveal: RevealHold | null;
  /** Maç başındaki oyun listesi: manuel seçimde lobiye dönünce host'un listesi geri gelir (Veto / Oyunu Seç yalnız maçı etkiler). */
  originalGameIds: string[];
  /** Geçerli oyunun sonu için yorum istendi mi (oyun başına en çok bir istek). */
  commentAsked: boolean;
  /** Geçerli oyunun sonu yorumu (aiComment.ts; doğrulanmış tek satır); yoksa null. */
  comment: string | null;
  /** Geçerli oyunda "İlham ver" kişisel durumları (aiInspire.ts; yalnız bellekte, oyun değişince silinir). */
  inspire: Map<string, InspireEntry>;
}

/** Oyun içi sonuç ekranının sunucu tarafı: "Devam et" diyenler ve bitişi belirleyen anlar. */
export interface RevealHold {
  /** Açılışın başladığı an (gerçek saat). */
  startedAt: number;
  /** Oyunun `isFinished`'i ilk kez true döndüğü an (açılış animasyonu bitti); henüz değilse null. */
  doneAt: number | null;
  /** Bağlı katılımcıların hepsinin "Devam et" dediği ilk an; henüz değilse null. */
  everyoneAt: number | null;
  continueIds: Set<string>;
}

/** Bir oyun fonksiyonu hata fırlattı; `fn` hangisi olduğunu söyler (setup, reduce, tick, view, result...). */
export class GameFault extends Error {
  constructor(
    readonly fn: string,
    readonly original: unknown,
  ) {
    super(`oyun fonksiyonu hata verdi: ${fn}`);
  }
}

function guard<T>(fn: string, call: () => T): T {
  try {
    return call();
  } catch (cause) {
    throw new GameFault(fn, cause);
  }
}

/**
 * Bir odadaki oyun hata verince maçı zarifçe bitirir: günlüğe yapılandırılmış kayıt, oyunculara hata
 * mesajı, oda lobiye döner (genel skorlar korunur). Diğer odalar etkilenmez.
 */
export function abortMatch(rt: Runtime, room: Room, err: unknown): void {
  const fault = err instanceof GameFault ? err : new GameFault("engine", err);
  const match = room.match;
  const gameId = match?.games[match.index]?.id ?? null;
  const cause = fault.original;
  let gameLog: unknown = null;
  try {
    gameLog = match?.recorder ? match.recorder.finish(gameNow(rt, match)) : null;
  } catch {
    // kayıt alınamadı; hata yine de günlüğe yazılır
  }
  log.error("game_failed", {
    roomCode: room.code,
    gameId,
    fn: fault.fn,
    phase: room.phase,
    error: cause instanceof Error ? cause.message : String(cause),
    stack: cause instanceof Error ? cause.stack : undefined,
    gameLog,
  });
  // Panel için asgari kayıt: oyun, çöken işlev ve kısaltılmış hata metni. Maç kaydı (eylemler) yazılmaz.
  rt.stats.gameFailure(rt.clock.now(), {
    gameId,
    fn: fault.fn,
    message: scrubText(cause instanceof Error ? cause.message : String(cause)),
  });
  for (const player of room.players.values()) {
    player.conn?.send(errorMessage("game_failed"));
  }
  clearMatch(rt, room, "failed");
  rt.broadcaster.markDirty(room);
}

export function currentGame(match: Match): AnyGame {
  const game = match.games[match.index];
  if (!game) throw new Error("oyun yok");
  return game;
}

export function requiredPlayers(gameIds: readonly string[]): number {
  return Math.max(0, ...gameIds.map((id) => GAMES[id]?.minPlayers ?? 0));
}

function enterBriefing(rt: Runtime, room: Room, match: Match): void {
  const now = rt.clock.now();
  match.participants = match.startParticipants.filter((id) => room.players.has(id));
  match.readyIds = new Set();
  match.perfBy = new Set();
  match.turnHolders = new Set();
  match.reveal = null;
  match.state = null;
  match.rng = null;
  match.result = null;
  match.recorder = null;
  match.gameStartedAt = null;
  match.commentAsked = false;
  match.comment = null;
  match.inspire = new Map();
  match.phaseStartedAt = now;
  match.phaseEndsAt = now + BRIEFING_TIMEOUT_MS;
  room.phase = "briefing";
}

/**
 * Bağlı oyuncu sayısına uyan oyunlar arasından tekrarsız, rastgele sırayla en çok `count` tane seçer.
 * `randomPool: false` olan oyunlar (ör. onay bekleyen yeni oyun) havuza girmez; yalnız elle seçilir.
 */
export function pickRandomGames(rt: Runtime, connected: number, count: number): string[] {
  // Etkin katalog: kapalı oyunlar yok, `randomPool` yönetici ayarına göre (bkz. gameSwitches.ts).
  const pool = rt.catalog
    .filter((g) => g.randomPool !== false && g.minPlayers <= connected && connected <= g.maxPlayers)
    .map((g) => g.id);
  // Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rt.randomInt(i + 1);
    const a = pool[i] as string;
    pool[i] = pool[j] as string;
    pool[j] = a;
  }
  return pool.slice(0, count);
}

/** Maçı başlatır. Ön koşullar (host, lobi, oyuncu sayısı) çağıran tarafından denetlenir. */
export function beginMatch(rt: Runtime, room: Room): void {
  const games = room.gameIds.map((id) => GAMES[id]).filter((g): g is AnyGame => g !== undefined);
  // İzleyici lobide bulunmaz (lobiye dönünce bayrağı silinir); yine de oyun kurulumuna asla girmez.
  const participants = [...room.players.values()]
    .filter((p) => !p.spectator && isConnected(p))
    .map((p) => p.id);
  const match: Match = {
    games,
    index: 0,
    startParticipants: participants,
    participants,
    readyIds: new Set(),
    continueIds: new Set(),
    phaseStartedAt: 0,
    phaseEndsAt: null,
    state: null,
    rng: null,
    result: null,
    recorder: null,
    statsId: rt.stats.matchStarted(rt.clock.now(), {
      playerCount: participants.length,
      selectionMode: room.selection.mode,
      gameCount: games.length,
    }),
    gameStartedAt: null,
    statsEnded: false,
    feedbackBy: new Set(),
    perfBy: new Set(),
    turnHolders: new Set(),
    cards: null,
    cardRec: null,
    cardLogArchived: false,
    reveal: null,
    originalGameIds: [...room.gameIds],
    commentAsked: false,
    comment: null,
    inspire: new Map(),
  };
  startCards(rt, room, match);
  room.match = match;
  for (const p of room.players.values()) p.lobbyReady = false;
  enterBriefing(rt, room, match);
  rt.active.add(room);
}

/**
 * İstatistik: maç yarıda kalırsa (herkes çıktı, sunucu kapandı, oyun çöktü) süren oyun ve maç kapatılır.
 * Zaten kapanmışsa (final) hiçbir şey yapmaz.
 */
export function endMatchStats(rt: Runtime, match: Match, outcome: "aborted" | "failed" | "completed"): void {
  if (match.statsEnded) return;
  match.statsEnded = true;
  const now = rt.clock.now();
  if (outcome !== "completed" && match.gameStartedAt !== null) {
    rt.stats.gamePlayed(match.statsId, {
      gameId: currentGame(match).id,
      playerCount: match.participants.length,
      startedAt: match.gameStartedAt,
      durationMs: now - match.gameStartedAt,
      outcome,
    });
  }
  rt.stats.matchEnded(match.statsId, now, outcome === "completed");
}

/** Maçı bırakıp lobiye döner (skorlara dokunmaz). */
export function clearMatch(rt: Runtime, room: Room, outcome: "aborted" | "failed" = "aborted"): void {
  if (room.match) {
    endMatchStats(rt, room.match, outcome);
    archiveCardLog(rt, room.match);
    // Veto / Oyunu Seç yalnız o maçı etkiler: manuel seçimde host'un listesi geri gelir.
    if (room.selection.mode === "manual") room.gameIds = [...room.match.originalGameIds];
  }
  cancelWake(room);
  room.match = null;
  room.phase = "lobby";
  // Maç bitti: izleyiciler normal oyuncu olur.
  for (const p of room.players.values()) {
    p.lobbyReady = false;
    p.spectator = false;
  }
  if (room.selection.mode === "random") room.gameIds = [];
  // Maç sırasında kapatılan oyun elle seçimde kalmış olabilir: lobiye dönünce çıkarılır.
  pruneClosedGames(rt, room);
  rt.active.delete(room);
}

export function markReady(room: Room, playerId: string): void {
  room.match?.readyIds.add(playerId);
}

/**
 * "Devam": results aşamasında oyuncunun onayını kaydeder. Katılımcı olmayan (izleyici) sessizce sayılmaz.
 * Sonuç true ise onay yeni kaydedildi.
 */
export function markContinue(room: Room, playerId: string): boolean {
  const match = room.match;
  if (!match || room.phase !== "results" || !match.participants.includes(playerId)) return false;
  if (match.continueIds.has(playerId)) return false;
  match.continueIds.add(playerId);
  return true;
}

/**
 * Oyun içi sonuç ekranında "Devam et": yalnız `playing` aşamasında, oyunun açılışı başladıysa ve `round` geçerli oyunsa.
 * Katılımcı olmayan (izleyici) sessizce sayılmaz. Sonuç: "wrong_phase" (yanlış aşama / oyun), "ignored" (izleyici ya da
 * tekrar), "counted" (yeni kaydedildi).
 */
export function markRevealContinue(
  room: Room,
  playerId: string,
  round: number,
): "wrong_phase" | "ignored" | "counted" {
  const match = room.match;
  if (!match || room.phase !== "playing" || !match.reveal || match.index !== round) return "wrong_phase";
  if (!match.participants.includes(playerId) || room.players.get(playerId)?.spectator) return "ignored";
  if (match.reveal.continueIds.has(playerId)) return "ignored";
  match.reveal.continueIds.add(playerId);
  return "counted";
}

/** Katılımcılardan şu an canlı bağlantısı olanlar (katılımcı sırasıyla). */
function connectedParticipants(room: Room, match: Match): string[] {
  return match.participants.filter((id) => {
    const player = room.players.get(id);
    return player !== undefined && isConnected(player);
  });
}

/**
 * Oyunun gördüğü saat (`gameClock`): payı olmayan oyunda gerçek saat; payı olanda `gameStartedAt`'tan sonra
 * `graceMs` geriden gelir. Oyuna, kayda (eylem, bağlantı, bitiş) ve `nextWake` çevirisine hep bu verilir.
 */
function gameNow(rt: Runtime, match: Match): number {
  const now = rt.clock.now();
  return match.gameStartedAt === null ? now : gameClock(match.gameStartedAt, now, currentGame(match).graceMs);
}

function ctxFor(rt: Runtime, room: Room, match: Match): GameContext {
  if (!match.rng) throw new Error("rng yok");
  return { now: gameNow(rt, match), rng: match.rng, connected: connectedParticipants(room, match) };
}

/**
 * Oyun sırasında bir katılımcının bağlantı durumu değişti: kayıt, sonraki tick/eylemden önce tutulur.
 * Bağlantı durumu zaten `player.conn` ile değişmiş olmalıdır.
 */
export function recordPresence(rt: Runtime, room: Room, playerId: string, connected: boolean): void {
  const match = room.match;
  if (!match?.recorder || room.phase !== "playing" || !match.participants.includes(playerId)) return;
  try {
    match.recorder.presence(gameNow(rt, match), playerId, connected);
  } catch (err) {
    log.warn("recorder_failed", { room: room.code, error: String(err) });
  }
}

/**
 * Sıra tabanlı oyunlarda sırası yeni gelen oyunculara "Sıra sende!" bildirimi gider (yalnız arka plandakilere,
 * `notifyPlayers` süzer). Oyunun `notify` kancası hata verirse yalnız günlüğe yazılır; maç etkilenmez.
 */
function notifyTurns(rt: Runtime, room: Room, match: Match): void {
  const game = currentGame(match);
  if (!game.notify || !roomHasPush(rt, room) || !match.rng) return;
  let holders: readonly string[];
  try {
    holders = game.notify(match.state, ctxFor(rt, room, match));
  } catch (err) {
    log.warn("notify_failed", { room: room.code, error: String(err) });
    return;
  }
  const fresh = holders.filter((id) => !match.turnHolders.has(id));
  match.turnHolders = new Set(holders);
  if (fresh.length > 0) notifyPlayers(rt, room, "turn", fresh);
}

function startPlaying(rt: Runtime, room: Room, match: Match): void {
  const now = rt.clock.now();
  const seed = randomInt(0, 2 ** 32);
  const game = currentGame(match);
  match.gameStartedAt = now;
  match.rng = createRng(seed);
  const rng = match.rng;
  // Havuz değişiklikleri yalnız bu andan sonra başlayan oyunlara uygulanır; etkin havuz kayda da yazılır (replay birebir).
  const content = rt.content.forGame(game.id);
  match.recorder = new GameRecorder(game.id, seed, match.participants, now, content);
  // Briefing sırasında kopanlar başlangıçta bağlı değildir.
  const connected = connectedParticipants(room, match);
  for (const id of match.participants) {
    if (!connected.includes(id)) match.recorder.presence(now, id, false);
  }
  match.state = guard("setup", () =>
    game.setup(match.participants, {
      now,
      rng,
      connected,
      ...(content !== undefined ? { content } : {}),
    }),
  );
  match.reveal = null;
  match.phaseStartedAt = now;
  match.phaseEndsAt = null;
  room.phase = "playing";
}

function finishGame(rt: Runtime, room: Room, match: Match): void {
  cancelWake(room);
  const now = rt.clock.now();
  const baseResult = guard("result", () => currentGame(match).result(match.state));
  // Kartlar: oyunun ham puanları kart etkileriyle nihai genel skor puanlarına çevrilir (docs/KURALLAR.md K6).
  const result = resolveGameCards(rt, room, match, baseResult);
  archiveLog(rt, match);
  if (match.gameStartedAt !== null) {
    rt.stats.gamePlayed(match.statsId, {
      gameId: currentGame(match).id,
      playerCount: match.participants.length,
      startedAt: match.gameStartedAt,
      durationMs: now - match.gameStartedAt,
      outcome: "finished",
    });
    match.gameStartedAt = null;
  }
  for (const [id, points] of Object.entries(result.awards)) {
    const player = room.players.get(id);
    if (player) player.score += points;
  }
  recordGameStats(rt, room, match, result, now);
  match.result = result;
  captureEvidence(rt, room, match);
  match.reveal = null;
  match.continueIds = new Set();
  match.phaseStartedAt = now;
  match.phaseEndsAt = now + RESULTS_MS;
  room.phase = "results";
}

/**
 * Hesaplı oyuncuların istatistiği (docs/HESAP.md): oyun bitince mini sonuçlar, maç bitince final sırası yazılır.
 * Oyun akışını asla bozmaz; yazıcı tek işlemde, küçük bir toplu yazma yapar. Misafir ve izleyici yazılmaz.
 */
function recordGameStats(rt: Runtime, room: Room, match: Match, result: GameResult, now: number): void {
  try {
    const entrants: Entrant[] = [];
    for (const id of match.participants) {
      const player = room.players.get(id);
      const score = result.miniScores[id];
      if (!player || player.spectator || score === undefined) continue;
      entrants.push({
        playerId: id,
        accountId: player.accountId,
        score,
        stats: cleanStats(result.stats?.[id]),
      });
    }
    rt.accountStats.gameFinished(buildGameRecord(currentGame(match).id, now, entrants));
  } catch (err) {
    log.warn("account_stats_failed", { room: room.code, error: String(err) });
  }
}

/** Sonuç sayaçlarını muhasebe için süzer: kısa ad, sonlu tamsayı >= 1; fazlası atılır. */
function cleanStats(raw: Readonly<Record<string, number>> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw ?? {}))
    if (key.length > 0 && key.length <= 32 && Number.isSafeInteger(value) && value > 0) out[key] = value;
  return out;
}

function recordMatchStats(rt: Runtime, room: Room, match: Match, now: number): void {
  try {
    const entrants: Entrant[] = [];
    for (const id of match.startParticipants) {
      const player = room.players.get(id);
      if (!player || player.spectator) continue;
      entrants.push({ playerId: id, accountId: player.accountId, score: player.score });
    }
    rt.accountStats.matchFinished(buildMatchRecord(match.games.length, now, entrants));
  } catch (err) {
    log.warn("account_stats_failed", { room: room.code, error: String(err) });
  }
}

/**
 * "Bildir" kanıtı: oyun biterken herkese açık görünümden (`publicView`) oyuncuların herkese gösterilmiş metinleri
 * alınır. Hiçbir şey eklenmeyen oyunlarda önceki oyunun kanıtı silinir (kanıt hep "son oyun"a aittir).
 * Hata oyun akışını bozmaz.
 */
function captureEvidence(rt: Runtime, room: Room, match: Match): void {
  try {
    const game = currentGame(match);
    const view = game.publicView(match.state, ctxFor(rt, room, match));
    const texts = collectPublicTexts(game.id, view, match.participants);
    room.evidence = Object.keys(texts).length > 0 ? { gameId: game.id, texts } : null;
  } catch (err) {
    room.evidence = null;
    log.warn("evidence_failed", { room: room.code, error: String(err) });
  }
}

/** Biten oyunun kaydını son-N listesine ekler. */
function archiveLog(rt: Runtime, match: Match): void {
  try {
    if (!match.recorder) return;
    rt.recentLogs.push(match.recorder.finish(gameNow(rt, match)));
    if (rt.recentLogs.length > RECENT_LOGS) rt.recentLogs.splice(0, rt.recentLogs.length - RECENT_LOGS);
  } catch (err) {
    log.warn("recorder_failed", { error: String(err) });
  }
}

function nextGameOrFinal(rt: Runtime, room: Room, match: Match): void {
  if (match.index + 1 < match.games.length) {
    // Her 3. oyundan sonra (son oyun hariç) kart seçimi gelir; sıradaki oyun o aşamadan sonra başlar.
    if (cardPhaseDue(room, match)) {
      openCardPhase(rt, room, match);
      return;
    }
    match.index += 1;
    enterBriefing(rt, room, match);
    return;
  }
  archiveCardLog(rt, match);
  match.phaseStartedAt = rt.clock.now();
  match.phaseEndsAt = null;
  room.phase = "final";
  endMatchStats(rt, match, "completed");
  recordMatchStats(rt, room, match, rt.clock.now());
  rt.active.delete(room);
}

/**
 * Süreye bağlı ilerlemeyi işler. Görünür bir şey değiştiyse odayı yayına işaretler.
 * Oyun fonksiyonu (veya adım) hata verirse yalnız bu odanın maçı iptal edilir.
 */
export function stepMatch(rt: Runtime, room: Room): void {
  try {
    stepMatchUnsafe(rt, room);
    armWake(rt, room);
  } catch (err) {
    abortMatch(rt, room, err);
  }
}

export function cancelWake(room: Room): void {
  if (room.wakeCancel) room.wakeCancel();
  room.wakeCancel = null;
  room.wakeAt = null;
}

/** Sunucunun kendi başına ilerleyeceği en erken an: geri sayım sonu ya da oyunun `nextWake`i (yoksa null). */
function wakeTime(rt: Runtime, room: Room, match: Match): number | null {
  if (room.phase === "countdown") return match.phaseEndsAt;
  if (room.phase !== "playing") return null;
  // Sonuç ekranı animasyonu bittiyse sıradaki an onun bitişidir ("Devam et" ya da tavan).
  if (match.reveal && match.reveal.doneAt !== null) return revealEndAt(match.reveal);
  const game = currentGame(match);
  if (game.nextWake === undefined) return null;
  const ctx = ctxFor(rt, room, match);
  const at = guard("nextWake", () => game.nextWake?.(match.state, ctx) ?? null);
  // Oyun saati gerçek saatten `graceMs` geridedir: oyunun bildirdiği an gerçek saate geri çevrilir.
  return at === null ? null : at + (game.graceMs ?? 0);
}

/**
 * Görünür bir geçişin tam anına tek bir uyandırma kurar; 100 ms'lik tick'i beklemek yerine o anda `stepMatch`
 * çalışır. Yalnız gecikmeyi azaltır: tick her durumda yedek olarak sürer. Vadesi gelmiş/geçmiş an için kurulmaz
 * (sıfır gecikmeli döngü olmaz); tick onu işler. Aşama değişince ya da maç bitince iptal edilir.
 */
function armWake(rt: Runtime, room: Room): void {
  const match = room.match;
  const now = rt.clock.now();
  const at = match ? wakeTime(rt, room, match) : null;
  if (!match || at === null || at <= now) {
    cancelWake(room);
    return;
  }
  if (room.wakeCancel && room.wakeAt === at) return;
  cancelWake(room);
  room.wakeAt = at;
  room.wakeCancel = rt.clock.setTimeout(
    () => {
      room.wakeCancel = null;
      room.wakeAt = null;
      if (room.match !== match) return;
      stepMatch(rt, room);
    },
    Math.max(1, at - now),
  );
}

/**
 * Oyun içi sonuç ekranının bitiş anı (gerçek saat): animasyon bitmeden asla; bağlı herkes "Devam et" dediyse
 * `CONTINUE_GRACE_MS` sonra, değilse açılış başından `REVEAL_HOLD_MS` sonra. Animasyon henüz bitmediyse null.
 */
function revealEndAt(hold: RevealHold): number | null {
  if (hold.doneAt === null) return null;
  const cap = Math.max(hold.startedAt + REVEAL_HOLD_MS, hold.doneAt);
  if (hold.everyoneAt === null) return cap;
  return Math.min(cap, Math.max(hold.everyoneAt, hold.doneAt) + CONTINUE_GRACE_MS);
}

/**
 * Oyun içi sonuç ekranı (docs/ERKEN-BITIS.md): oyunun `revealAt`'i geldiyse açılır; oyun bittiğinde (`isFinished`)
 * bitiş, "Devam et" kuralına bağlanır. Bu bir oyun kuralı değil, sunucunun sonuç ekranı hızıdır (oyun durumu ve kayıt
 * etkilenmez); bağlantıya bakmak burada serbesttir. Sonuç true ise oyun şimdi bitmeli.
 */
function stepReveal(
  rt: Runtime,
  room: Room,
  match: Match,
  game: AnyGame,
  ctx: GameContext,
  finished: boolean,
): boolean {
  const now = rt.clock.now();
  if (!match.reveal && game.revealAt) {
    const at = guard("revealAt", () => game.revealAt?.(match.state, ctx) ?? null);
    if (at !== null && at <= ctx.now) {
      // Oyun saati gerçek saatten `graceMs` geridedir: açılış anı gerçek saate geri çevrilir.
      match.reveal = {
        startedAt: Math.min(now, at + (game.graceMs ?? 0)),
        doneAt: null,
        everyoneAt: null,
        continueIds: new Set(),
      };
      rt.broadcaster.markDirty(room);
    }
  }
  const hold = match.reveal;
  if (!hold) return finished;
  if (finished && hold.doneAt === null) hold.doneAt = now;
  if (hold.everyoneAt === null) {
    const connected = connectedParticipants(room, match);
    if (connected.length > 0 && connected.every((id) => hold.continueIds.has(id))) hold.everyoneAt = now;
  }
  const end = revealEndAt(hold);
  return finished && end !== null && now >= end;
}

/** Oyunun zamana bağlı adımı: tick, ardından bitti mi (bitti ise — sonuç ekranı kuralıyla — sonuç aşamasına geçer). */
function stepPlaying(rt: Runtime, room: Room, match: Match): void {
  const game = currentGame(match);
  const ctx = ctxFor(rt, room, match);
  const next = guard("tick", () => game.tick(match.state, ctx));
  const changed = next !== match.state;
  match.state = next;
  const finished = guard("isFinished", () => game.isFinished(match.state, ctx));
  if (finished) askComment(rt, room, match);
  if (stepReveal(rt, room, match, game, ctx, finished)) {
    finishGame(rt, room, match);
    rt.broadcaster.markDirty(room);
  } else if (changed) {
    notifyTurns(rt, room, match);
    askComment(rt, room, match);
    rt.broadcaster.markDirty(room);
  }
}

/**
 * Oyun sonu yorumu (aiComment.ts): oyunun sonucu herkese açık görünümde açıldığı ilk anda tek istek başlatılır;
 * oyun beklemez. Yanıt aynı oyunun içi sürerken (oyunun kendi sonuç açılışı) gelirse ortak görünüme eklenir.
 * Kapalıysa ya da oyun yorum desteklemiyorsa hiçbir şey hesaplanmaz. Hata maçı asla etkilemez.
 */
function askComment(rt: Runtime, room: Room, match: Match): void {
  if (match.commentAsked || !rt.aiComment.enabled) return;
  const game = currentGame(match);
  if (!hasCommentPrompt(game.id)) return;
  try {
    const view = game.publicView(match.state, ctxFor(rt, room, match));
    const nickname = (id: string): string | null => room.players.get(id)?.nickname ?? null;
    const prompt = commentPrompt(game.id, view, nickname);
    if (!prompt) return;
    match.commentAsked = true;
    const index = match.index;
    rt.aiComment.request(prompt, (text) => {
      if (room.match !== match || match.index !== index) return;
      if (room.phase !== "playing") return;
      match.comment = text;
      rt.broadcaster.markDirty(room);
    });
  } catch (err) {
    log.warn("ai_comment_prompt_failed", { room: room.code, error: String(err) });
  }
}

function stepMatchUnsafe(rt: Runtime, room: Room): void {
  const match = room.match;
  if (!match) return;
  const now = rt.clock.now();
  switch (room.phase) {
    case "briefing": {
      const waiting = match.participants
        .map((id) => room.players.get(id))
        .filter((p): p is Player => p !== undefined && isConnected(p));
      const allReady = waiting.length > 0 && waiting.every((p) => match.readyIds.has(p.id));
      if (allReady || (match.phaseEndsAt !== null && now >= match.phaseEndsAt)) {
        // Anlatım bitti: oynanan kartlar kesinleşir ve herkese açıklanır (geri sayım ekranı).
        commitCards(rt, room, match);
        match.phaseStartedAt = now;
        match.phaseEndsAt = now + COUNTDOWN_MS;
        room.phase = "countdown";
        rt.broadcaster.markDirty(room);
      }
      return;
    }
    case "countdown": {
      if (match.phaseEndsAt !== null && now >= match.phaseEndsAt) {
        startPlaying(rt, room, match);
        rt.broadcaster.markDirty(room);
      }
      return;
    }
    case "playing":
      stepPlaying(rt, room, match);
      return;
    case "results": {
      // Erken bitiş (docs/ERKEN-BITIS.md): bağlı katılımcıların hepsi "Devam" dediyse 1 sn sonra biter.
      // Bu bir oyun kuralı değil, sunucunun sonuç ekranı hızıdır; bağlantıya bakmak burada serbesttir.
      const connected = connectedParticipants(room, match);
      const everyone = connected.length > 0 && connected.every((id) => match.continueIds.has(id));
      if (everyone && match.phaseEndsAt !== null && match.phaseEndsAt > now + CONTINUE_GRACE_MS) {
        match.phaseEndsAt = now + CONTINUE_GRACE_MS;
        rt.broadcaster.markDirty(room);
      }
      if (match.phaseEndsAt !== null && now >= match.phaseEndsAt) {
        nextGameOrFinal(rt, room, match);
        rt.broadcaster.markDirty(room);
      }
      return;
    }
    case "cards": {
      const step = stepCardPhase(rt, room, match);
      if (step === "done") {
        match.index += 1;
        enterBriefing(rt, room, match);
        rt.broadcaster.markDirty(room);
      } else if (step === "dirty") rt.broadcaster.markDirty(room);
      return;
    }
    default:
      return;
  }
}

export type ActionOutcome = { ok: true } | { ok: false; reason: string };

export function applyAction(rt: Runtime, room: Room, playerId: string, payload: unknown): ActionOutcome {
  try {
    return applyActionUnsafe(rt, room, playerId, payload);
  } catch (err) {
    abortMatch(rt, room, err);
    return { ok: false, reason: "wrong_phase" };
  }
}

function applyActionUnsafe(rt: Runtime, room: Room, playerId: string, payload: unknown): ActionOutcome {
  const match = room.match;
  if (!match || room.phase !== "playing") return { ok: false, reason: "wrong_phase" };
  if (!match.participants.includes(playerId)) return { ok: false, reason: "not_participant" };
  const game = currentGame(match);
  const action = guard("parseAction", () => game.parseAction(payload));
  if (action === null) return { ok: false, reason: "invalid_action" };
  const ctx = ctxFor(rt, room, match);
  const next = guard("reduce", () => game.reduce(match.state, playerId, action, ctx));
  if (isRejected(next)) return { ok: false, reason: next.rejected };
  try {
    match.recorder?.record(ctx.now, playerId, action);
  } catch (err) {
    log.warn("recorder_failed", { room: room.code, error: String(err) });
  }
  if (next !== match.state) {
    match.state = next;
    notifyTurns(rt, room, match);
    rt.broadcaster.markDirty(room);
    // Eylem oyunu bitirdiyse sonucu bir sonraki tick'i beklemeden işle (tick ile aynı adım; tick bağımsızlığı
    // gereği sonuç değişmez, yalnız sonuç ekranı 0-100 ms erken görünür).
    if (guard("isFinished", () => game.isFinished(match.state, ctx))) stepPlaying(rt, room, match);
    armWake(rt, room);
  }
  return { ok: true };
}

/**
 * Sonucun istemciye giden hâli: `stats` (rozet muhasebesi) ASLA gönderilmez. Tüm anlık görüntüler
 * (oyuncu, TV/sahne, izleyici) `sharedMatchSnapshot`'tan geçtiği için tek ayıklama noktası burasıdır.
 */
function publicResult(result: GameResult | null): GameResult | null {
  return result ? { miniScores: result.miniScores, awards: result.awards } : null;
}

/** Maçın herkese ortak görünen kısmı (`publicView` dahil; oyuncuya özel `view` hariç). Oda başına bir kez hesaplanır. */
export function sharedMatchSnapshot(rt: Runtime, room: Room): Omit<MatchSnapshot, "view" | "mine"> | null {
  const match = room.match;
  if (!match) return null;
  const game = currentGame(match);
  let publicView: unknown = null;
  if (match.rng && (room.phase === "playing" || room.phase === "results")) {
    const ctx = ctxFor(rt, room, match);
    publicView = guard("publicView", () => game.publicView(match.state, ctx));
  }
  return {
    round: match.index,
    total: match.games.length,
    gameId: game.id,
    gameName: game.name,
    briefing: { goal: game.briefing.goal, steps: [...game.briefing.steps] },
    orientation: game.orientation,
    participants: [...match.participants],
    readyIds: [...match.readyIds],
    continueIds: room.phase === "results" ? [...match.continueIds] : [],
    reveal:
      room.phase === "playing" && match.reveal
        ? {
            startedAt: match.reveal.startedAt,
            endsAt: match.reveal.startedAt + REVEAL_HOLD_MS,
            continueIds: [...match.reveal.continueIds],
          }
        : null,
    phaseStartedAt: match.phaseStartedAt,
    phaseEndsAt: match.phaseEndsAt,
    publicView,
    result: room.phase === "results" || room.phase === "final" ? publicResult(match.result) : null,
    cards: cardsPublicOf(room, match),
    // Yorum yalnız oyunun kendi sonuç açılışında gösterilir: sonuç ekranına gönderilmez.
    ...(match.comment !== null && room.phase === "playing" ? { comment: match.comment } : {}),
  };
}

/**
 * Oyuncuya özel oyun görünümü. Katılımcı olmayan (izleyici dahil) kimse için oyuncu kimliği oyuna hiç
 * verilmez: `view(state, null)`, yani kimseye bağlı olmayan izleyici görünümü gider.
 */
export function matchViewFor(rt: Runtime, room: Room, playerId: string | null): unknown {
  const match = room.match;
  if (!match?.rng || (room.phase !== "playing" && room.phase !== "results")) return null;
  const who =
    playerId !== null && match.participants.includes(playerId) && !room.players.get(playerId)?.spectator
      ? playerId
      : null;
  const game = currentGame(match);
  const ctx = ctxFor(rt, room, match);
  return guard("view", () => game.view(match.state, who, ctx));
}

/** "İlham ver" bu oyuncu için şu an kullanılabilir mi: özellik açık, Bozuk Telefon ilk cümle adımı, katılımcı. */
function inspireOpen(rt: Runtime, room: Room, match: Match, playerId: string | null): playerId is string {
  if (!rt.aiInspire.enabled || playerId === null || room.phase !== "playing" || !match.rng) return false;
  const game = currentGame(match);
  if (game.id !== INSPIRE_GAME_ID) return false;
  if (!match.participants.includes(playerId) || room.players.get(playerId)?.spectator) return false;
  const view = guard("publicView", () => game.publicView(match.state, ctxFor(rt, room, match)));
  return isFirstWriteStep(view);
}

/** Yalnız bu oyuncunun "İlham ver" durumu; kullanılamıyorsa null (düğme görünmez). */
export function matchInspireFor(rt: Runtime, room: Room, playerId: string | null): InspireMine | null {
  const match = room.match;
  if (!match || !inspireOpen(rt, room, match, playerId)) return null;
  return inspireMine(match.inspire.get(playerId));
}

/**
 * "İlham ver" isteği. Yalnız ilk cümle adımında, yalnız katılımcı, kişi başı oyun başına en çok
 * `INSPIRE_MAX_REQUESTS`; aynı anda tek istek. Yanıt (ya da hata) yalnız bu oyuncunun kişisel görünümüne yazılır.
 */
export function requestInspire(
  rt: Runtime,
  room: Room,
  playerId: string,
  round: number,
): "ok" | "wrong_phase" | "limit" | "busy" {
  const match = room.match;
  if (!match || match.index !== round || !inspireOpen(rt, room, match, playerId)) return "wrong_phase";
  const entry = match.inspire.get(playerId) ?? freshInspire();
  if (entry.pending) return "busy";
  if (entry.used >= INSPIRE_MAX_REQUESTS) return "limit";
  const index = match.index;
  const sent = rt.aiInspire.generate(
    {
      prompt: inspirePrompt(),
      maxTokens: INSPIRE_MAX_TOKENS,
      tag: "ai_inspire",
      parse: (raw) => parseIdeas(raw, (text) => rt.bannedWords.matches(text)),
    },
    (ideas) => {
      if (room.match !== match || match.index !== index) return;
      const cur = match.inspire.get(playerId);
      if (!cur) return;
      cur.pending = false;
      cur.failed = ideas === null;
      if (ideas !== null) cur.ideas = ideas;
      rt.broadcaster.markDirty(room);
    },
  );
  if (!sent) {
    // Sunucu genelindeki hız sınırı: hak harcanmaz, "Şu an ilham yok".
    match.inspire.set(playerId, { ...entry, failed: true });
    return "ok";
  }
  match.inspire.set(playerId, { ...entry, used: entry.used + 1, pending: true, failed: false });
  return "ok";
}

/** Oyuncuya özel kart bilgisi (el, seçenekler, oynadığı kart); izleyicide ve sahnede null. */
export function matchMineFor(rt: Runtime, room: Room, playerId: string | null): CardsMine | null {
  const match = room.match;
  return match ? cardsMineOf(rt, room, match, playerId) : null;
}

export function runTick(rt: Runtime): void {
  for (const room of [...rt.active]) {
    try {
      stepMatch(rt, room);
    } catch (err) {
      // abortMatch'in kendisi de hata verirse diğer odalar yine de ilerler.
      log.error("tick_failed", { roomCode: room.code, error: String(err) });
    }
  }
}
