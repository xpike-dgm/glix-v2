/**
 * Yalnız geliştirme önizlemesi: Kara Borsa'nın her aşaması.
 *   ?mock=kara-briefing | kara-bid | kara-bid-broke | kara-bid-sent | kara-bid-spectator
 *   ?mock=kara-reveal | kara-reveal-me | kara-reveal-cursed | kara-reveal-none | kara-results
 * `&n=8` oyuncu sayısını değiştirir. Teklif yerelde işlenir.
 */
import {
  BORSA_ROUNDS,
  type BorsaHint,
  type BorsaPublicView,
  type BorsaRoundResult,
  type BorsaView,
  GAMES,
  type GameInfo,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const GAME_ID = "kara-borsa";
const CATALOG: GameInfo[] = [
  { id: GAME_ID, name: "Kara Borsa", minPlayers: 3, maxPlayers: 8, orientation: "portrait" },
];

export function startBorsaMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(i === n - 1 && n > 5),
    score: 0,
    spectator: false,
  }));
  const spectator = kind.includes("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const now = Date.now();
  const source = GAMES[GAME_ID]?.briefing;
  const briefing = { goal: source?.goal ?? "", steps: [...(source?.steps ?? [])] };
  const isReveal = kind.startsWith("kara-reveal") || kind === "kara-results";
  const cursed = kind === "kara-reveal-cursed";
  const none = kind === "kara-reveal-none";
  const me = kind === "kara-reveal-me";
  let phase: RoomPhase = "playing";
  let phaseEndsAt: number | null = null;
  let phaseStartedAt = now - 5_000;
  if (kind === "kara-briefing") {
    phase = "briefing";
    phaseEndsAt = now + 40_000;
    phaseStartedAt = now;
  }
  if (kind === "kara-results") {
    phase = "results";
    phaseStartedAt = now;
    phaseEndsAt = now + 60_000;
  }
  const broke = kind === "kara-bid-broke";
  let myBid: number | null = kind === "kara-bid-sent" ? 35 : null;
  const coins = Object.fromEntries(players.map((p, i) => [p.id, i === 0 ? (broke ? 0 : 85) : 100 - i * 9]));
  const boxes = Object.fromEntries(players.map((p, i) => [p.id, i === 1 ? 42 : i === 2 ? -20 : 0]));
  const hint: BorsaHint =
    kind === "kara-bid-sent" ? { kind: "between", lo: 20, hi: 38 } : { kind: "gt", n: 30 };

  const result = (): BorsaRoundResult => {
    const bids = Object.fromEntries(
      participants.map((id, i) => [
        id,
        none ? 0 : i === 0 ? (me ? 41 : 12) : ([0, 0, 30, 18, 0, 25, 0, 9][i] ?? 0),
      ]),
    );
    const winnerId = none ? null : me ? SELF : "p2";
    if (winnerId && !me) bids[winnerId] = 44;
    return {
      value: cursed ? -20 : 37,
      winner: winnerId,
      price: winnerId ? (bids[winnerId] as number) : 0,
      bids,
    };
  };
  const publicView = (): BorsaPublicView => ({
    phase: isReveal ? "reveal" : "bid",
    round: 2,
    rounds: BORSA_ROUNDS,
    startedAt: now - 60_000,
    stageStartedAt: now - 8_000,
    stageEndsAt: now + (isReveal ? 3_500 : 12_000),
    players: participants,
    coins,
    boxes,
    bidIds: participants.filter((_, i) => i % 2 === 1 || (myBid !== null && i === 0)),
    history: isReveal ? [result()] : [],
    reveal: isReveal ? result() : null,
  });
  const view = (): BorsaView => ({
    hint: spectator || isReveal ? null : hint,
    myBid: spectator ? null : myBid,
  });
  const publish = (): void => {
    const snapshot: RoomSnapshot = {
      rev: Math.floor(Date.now() / 1000),
      serverNow: Date.now(),
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
      phase,
      players,
      gameIds: [GAME_ID],
      selection: { mode: "manual" },
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
      catalog: CATALOG,
      match: {
        round: 0,
        total: 3,
        gameId: GAME_ID,
        gameName: "Kara Borsa",
        briefing,
        orientation: "portrait",
        participants,
        readyIds: ["p1", "p2"],
        continueIds: [],
        phaseStartedAt,
        phaseEndsAt,
        publicView: phase === "briefing" ? null : publicView(),
        view: phase === "briefing" ? null : view(),
        result:
          phase === "results"
            ? {
                miniScores: Object.fromEntries(
                  participants.map((id) => [id, (coins[id] ?? 0) + (boxes[id] ?? 0)]),
                ),
                awards: Object.fromEntries(participants.map((id, i) => [id, i === 1 ? 2 : i < 4 ? 1 : 0])),
              }
            : null,
      } satisfies MatchSnapshot,
    };
    applySnapshot(snapshot);
  };
  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    const a = msg.payload as { kind?: string; amount?: number };
    if (a.kind === "bid" && typeof a.amount === "number" && myBid === null) {
      myBid = a.amount;
      publish();
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
}
