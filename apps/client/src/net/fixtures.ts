import type { MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";

export function player(id: string, avatar = 0, extra: Partial<PlayerInfo> = {}): PlayerInfo {
  return { id, nickname: id.toUpperCase(), avatar, connected: true, score: 0, ...extra };
}

export function matchSnap(extra: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    round: 0,
    total: 2,
    gameId: "butona-bas",
    gameName: "Butona Bas",
    briefing: { goal: "g", steps: ["a"] },
    orientation: "portrait",
    participants: ["a", "b"],
    readyIds: [],
    phaseStartedAt: 0,
    phaseEndsAt: null,
    publicView: null,
    view: null,
    result: null,
    ...extra,
  };
}

export function snapshot(phase: RoomPhase = "lobby", extra: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    rev: 1,
    serverNow: 1000,
    code: "KX7QP",
    hostId: "a",
    selfId: "a",
    phase,
    players: [player("a"), player("b", 1)],
    gameIds: ["butona-bas"],
    selection: { mode: "manual" },
    catalog: [
      { id: "butona-bas", name: "Butona Bas", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
    ],
    match: phase === "lobby" || phase === "final" ? null : matchSnap(),
    ...extra,
  };
}
