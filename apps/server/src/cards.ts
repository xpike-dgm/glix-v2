/**
 * Kartların sunucu tarafı akışı (docs/KURALLAR.md "0. Maç düzeyi kuralları: Kartlar"). Kurallar `@glix/engine`
 * içindeki saf `cards/` modülündedir; burası yalnız maçın aşamalarına bağlar: kart seçimi aşaması, anlatımda oynama,
 * oyun sonu hesabı, kayıt ve oyuncuya özel görünüm. Her durum değişikliği bir `CardEvent` olarak kaydedilir.
 */
import {
  applyCardEvent,
  CARD_PHASE_EVERY,
  CARDS_DONE_GRACE_MS,
  CARDS_MS,
  type CardEvent,
  CardRecorder,
  type CardsMine,
  type CardsPublic,
  cardsResolveInput,
  createCardsState,
  enabledCards,
  GAMES,
  type GameResult,
  isRejected,
  mineCards,
  type PlayContext,
  publicCards,
} from "@glix/engine";
import type { Match } from "./match.js";
import type { Room, Runtime } from "./runtime.js";
import { isConnected } from "./runtime.js";

const RECENT_CARD_LOGS = 20;

/** Maça katılan, hâlâ odada olan oyuncular (katılımcı sırasıyla). */
function presentIds(room: Room, match: Match): string[] {
  return match.participants.filter((id) => {
    const p = room.players.get(id);
    return p !== undefined && !p.spectator;
  });
}

/** Maç başlarken: kartlar açıksa durum ve kayıt kurulur (tohum maç başına bir kez çekilir). */
export function startCards(rt: Runtime, room: Room, match: Match): void {
  if (enabledCards(room.cardSettings).length === 0) return;
  const seed = rt.randomInt(2 ** 32);
  match.cards = createCardsState(seed, match.startParticipants, room.cardSettings);
  match.cardRec = new CardRecorder(seed, match.startParticipants, room.cardSettings);
}

/** Olayı uygular; kabul edilirse durumu günceller ve kayda ekler. */
export function cardEvent(
  rt: Runtime,
  match: Match,
  ev: CardEvent,
): { ok: true } | { ok: false; reason: string } {
  if (!match.cards) return { ok: false, reason: "no_cards" };
  const next = applyCardEvent(match.cards, ev);
  if (isRejected(next)) return { ok: false, reason: next.rejected };
  match.cards = next;
  match.cardRec?.record(rt.clock.now(), ev);
  return { ok: true };
}

/** Oyunu Seç ile seçilebilen oyunlar: açık, bu maçta oynanmamış, oyuncu sayısına uyan, havuzdaki (ya da zaten listedeki). */
function selectableGames(rt: Runtime, room: Room, match: Match): string[] {
  const n = Math.max(
    1,
    presentIds(room, match).filter((id) => {
      const p = room.players.get(id);
      return p !== undefined && isConnected(p);
    }).length,
  );
  const played = new Set(match.games.slice(0, match.index + 1).map((g) => g.id));
  const listed = new Set(match.games.slice(match.index + 1).map((g) => g.id));
  return rt.catalog
    .filter(
      (g) =>
        GAMES[g.id] !== undefined &&
        !played.has(g.id) &&
        (g.randomPool !== false || listed.has(g.id)) &&
        g.minPlayers <= n &&
        n <= g.maxPlayers,
    )
    .map((g) => g.id);
}

/** Oynama / kesinleştirme bağlamı: sunucunun o anki gerçekleri. */
export function playContext(rt: Runtime, room: Room, match: Match): PlayContext {
  return {
    participants: [...match.participants],
    present: presentIds(room, match),
    remaining: match.games.slice(match.index + 1).map((g) => g.id),
    selectable: selectableGames(rt, room, match),
  };
}

/** Anlatım bitti: oynanan kartlar kesinleşir; Veto / Oyunu Seç maç listesini değiştirir. */
export function commitCards(rt: Runtime, room: Room, match: Match): void {
  if (!match.cards) return;
  const ctx = playContext(rt, room, match);
  const r = cardEvent(rt, match, { k: "commit", ctx });
  if (!r.ok) return;
  const remaining = match.cards.remaining;
  if (!remaining || remaining.join() === ctx.remaining.join()) return;
  const games = [...match.games.slice(0, match.index + 1)];
  for (const id of remaining) {
    const g = GAMES[id];
    if (g) games.push(g);
  }
  match.games = games;
  room.gameIds = games.map((g) => g.id);
}

/** Oyun bitti: kartların etkisi hesaplanır; dönen sonucun `awards`ı nihai genel skor puanlarıdır. */
export function resolveGameCards(rt: Runtime, room: Room, match: Match, result: GameResult): GameResult {
  const cards = match.cards;
  if (!cards) return result;
  const ev: CardEvent = {
    k: "resolve",
    participants: [...match.participants],
    present: presentIds(room, match),
    miniScores: { ...result.miniScores },
    awards: { ...result.awards },
    gameIndex: match.index,
  };
  // Kayıt: hesabın girdileri oyun kaydına yazılır (replayWithCards birebir yeniden üretir).
  match.recorder?.setCards(cardsResolveInput(cards, ev));
  if (!cardEvent(rt, match, ev).ok || !match.cards?.resolved) return result;
  return { ...result, awards: match.cards.resolved.awards };
}

/** Bu oyundan sonra kart seçimi gelir mi (K1.1). */
export function cardPhaseDue(room: Room, match: Match): boolean {
  const played = match.index + 1;
  return (
    match.cards !== null &&
    played % CARD_PHASE_EVERY === 0 &&
    played < match.games.length &&
    presentIds(room, match).length > 0
  );
}

/** Kart seçimi aşamasını açar. */
export function openCardPhase(rt: Runtime, room: Room, match: Match): void {
  const now = rt.clock.now();
  const present = presentIds(room, match);
  const scores: Record<string, number> = {};
  for (const id of present) scores[id] = room.players.get(id)?.score ?? 0;
  cardEvent(rt, match, { k: "open", scores, present });
  match.readyIds = new Set();
  match.phaseStartedAt = now;
  match.phaseEndsAt = now + CARDS_MS;
  room.phase = "cards";
}

/**
 * Kart seçimi sürerken her tick: bağlı herkes bitirdiyse kalan süre kısalır. Süre dolduysa aşama kapanır ve true döner
 * (çağıran sıradaki oyuna geçer).
 */
export function stepCardPhase(rt: Runtime, room: Room, match: Match): "wait" | "dirty" | "done" {
  const now = rt.clock.now();
  const picking = match.cards?.picking;
  let changed: "wait" | "dirty" = "wait";
  if (picking && match.phaseEndsAt !== null) {
    const live = presentIds(room, match).filter((id) => {
      const p = room.players.get(id);
      return p !== undefined && isConnected(p);
    });
    const allDone = live.length > 0 && live.every((id) => picking[id]?.done !== false);
    if (allDone && match.phaseEndsAt > now + CARDS_DONE_GRACE_MS) {
      match.phaseEndsAt = now + CARDS_DONE_GRACE_MS;
      changed = "dirty";
    }
  }
  if (match.phaseEndsAt !== null && now >= match.phaseEndsAt) {
    if (match.cards?.picking) cardEvent(rt, match, { k: "close" });
    return "done";
  }
  return changed;
}

/** Maç kartlarının kaydını son-N listesine ekler (bir kez). */
export function archiveCardLog(rt: Runtime, match: Match): void {
  if (!match.cardRec || match.cardLogArchived) return;
  match.cardLogArchived = true;
  rt.recentCardLogs.push(match.cardRec.log);
  if (rt.recentCardLogs.length > RECENT_CARD_LOGS)
    rt.recentCardLogs.splice(0, rt.recentCardLogs.length - RECENT_CARD_LOGS);
}

/** Herkese açık kart bilgisi (kartlar kapalıysa null). */
export function cardsPublicOf(room: Room, match: Match): CardsPublic | null {
  return match.cards ? publicCards(match.cards, room.phase === "results") : null;
}

/** Yalnız bu oyuncunun kart bilgisi; izleyici ve katılımcı olmayan için null. */
export function cardsMineOf(
  rt: Runtime,
  room: Room,
  match: Match,
  playerId: string | null,
): CardsMine | null {
  if (!match.cards || playerId === null) return null;
  const p = room.players.get(playerId);
  if (!p || p.spectator) return null;
  const name = (id: string) => ({ id, name: GAMES[id]?.name ?? id });
  const choices =
    room.phase === "briefing"
      ? (() => {
          const ctx = playContext(rt, room, match);
          return {
            veto: ctx.remaining.length >= 2 ? ctx.remaining.map(name) : [],
            pick: ctx.remaining.length >= 1 ? ctx.selectable.map(name) : [],
          };
        })()
      : { veto: [], pick: [] };
  return mineCards(match.cards, playerId, choices);
}
