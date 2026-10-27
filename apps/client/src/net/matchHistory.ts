import { type RoomSnapshot, summarizeRound } from "@glix/engine";
import { createSignal } from "solid-js";
import type { RoundRecord } from "../screens/titles.js";

const [rounds, setRounds] = createSignal<RoundRecord[]>([]);
let roomCode = "";

/** Bu maçta biten turlar (final unvanları için). */
export const matchRounds = rounds;

/**
 * Odaya zaten herkese açık giden tur sonuçlarını (`results`/`final` aşamasındaki `result.awards`) maç boyunca biriktirir.
 * Lobiye dönünce ya da oda değişince silinir; aynı tur iki kez eklenmez.
 */
export function collectRounds(snap: RoomSnapshot | null): void {
  if (!snap || snap.phase === "lobby") {
    if (rounds().length > 0 || roomCode !== "") {
      roomCode = "";
      setRounds([]);
    }
    return;
  }
  if (snap.code !== roomCode) {
    if (roomCode !== "") setRounds([]);
    roomCode = snap.code;
  }
  const m = snap.match;
  if (!m?.result || (snap.phase !== "results" && snap.phase !== "final")) return;
  const summary = summarizeRound(m.gameId, m.result, snap.players, m.publicView) ?? undefined;
  const rec: RoundRecord = { round: m.round, gameId: m.gameId, awards: { ...m.result.awards }, summary };
  setRounds((cur) => (cur.some((r) => r.round === rec.round) ? cur : [...cur, rec]));
}

/** Yalnız geliştirme önizlemesi ve testler için. */
export function seedRounds(list: RoundRecord[]): void {
  setRounds(list);
}
