import { describe, expect, it } from "vitest";
import { parseErrors, parseLive, parseState, parseStats, tryParse } from "./parse.js";

const live = {
  rooms: 1,
  players: 2,
  activeMatches: 0,
  stages: 0,
  sockets: { total: 2, guests: 1, accounts: 1 },
  memory: { rssMb: 100, heapUsedMb: 20, heapTotalMb: 40 },
  cpuPercent: 3.5,
  eventLoopLagMsP95: 1.2,
  tickMsP95: 0.4,
  bytesOutPerSec: 1000,
  uptimeSec: 60,
  startedAt: 1,
  version: "0.1.0",
  revision: "abc",
  draining: false,
  roomList: [
    {
      code: "ABCDE",
      phase: "lobby",
      players: 2,
      connected: 2,
      spectators: 0,
      stages: 0,
      gameId: null,
      ageSec: 5,
    },
  ],
};

const stats = {
  enabled: true,
  windowDays: 90,
  daily: [{ day: "2026-10-27", matches: 1, players: 3 }],
  weekly: [{ weekStart: "2026-10-21", matches: 1, players: 3 }],
  playerCounts: [{ players: 3, matches: 1 }],
  games: [
    {
      gameId: "butona-bas",
      plays: 2,
      avgDurationSec: 30,
      abandonRate: 0.5,
      failed: 0,
      ratingAvg: null,
      ratingCount: 0,
    },
  ],
  feedback: { count: 0, avg: null, byRating: [0, 0, 0, 0, 0], latest: [] },
  selection: [{ mode: "random", matches: 1, avgGameCount: 5 }],
  gameCounts: [{ count: 5, matches: 1 }],
  accounts: {
    total: 1,
    verified: 0,
    google: 0,
    password: 1,
    friendships: 0,
    badgesAwarded: 0,
    newPerDay: [],
  },
};

const errors = {
  enabled: true,
  groups: [
    {
      message: "m",
      frame: "f",
      count: 1,
      firstSeen: 1,
      lastSeen: 2,
      platforms: { ios: 1, android: 0, diger: 0 },
      browsers: ["safari"],
      versions: ["0.1.0"],
    },
  ],
  perDay: [{ day: "2026-10-27", count: 1 }],
  perf: [],
  failures: [{ gameId: "x", fn: "tick", message: "m", at: 1 }],
};

describe("yönetici yanıt doğrulaması", () => {
  it("geçerli yanıtlar kabul edilir", () => {
    expect(parseLive(live).roomList[0]?.code).toBe("ABCDE");
    expect(parseStats(stats).games[0]?.gameId).toBe("butona-bas");
    expect(parseErrors(errors).groups[0]?.platforms.ios).toBe(1);
  });
  it("eksik, yanlış tipli ya da dizi olmayan alan reddedilir", () => {
    expect(tryParse(parseLive, { ...live, rooms: "1" })).toBeNull();
    expect(tryParse(parseLive, { ...live, sockets: null })).toBeNull();
    expect(tryParse(parseLive, { ...live, roomList: {} })).toBeNull();
    expect(tryParse(parseLive, null)).toBeNull();
    expect(tryParse(parseStats, { ...stats, feedback: { ...stats.feedback, byRating: [1, 2] } })).toBeNull();
    expect(tryParse(parseErrors, { ...errors, groups: [{ message: "m" }] })).toBeNull();
    expect(tryParse(parseLive, { ...live, cpuPercent: Number.NaN })).toBeNull();
  });
  it("durum yanıtı", () => {
    expect(parseState({ state: "ready" })).toBe("ready");
    expect(parseState({ state: "need_otp" })).toBe("need_otp");
    expect(parseState({ state: "x" })).toBeNull();
    expect(parseState(null)).toBeNull();
  });
});
