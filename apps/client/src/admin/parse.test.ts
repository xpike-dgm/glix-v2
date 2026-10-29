import { describe, expect, it } from "vitest";
import {
  parseAccounts,
  parseAuditPage,
  parseBannedAccounts,
  parseBannedWords,
  parseContent,
  parseDetail,
  parseEconomy,
  parseErrors,
  parseGameList,
  parseLive,
  parseMaintenance,
  parsePushStatus,
  parseReportDetail,
  parseReportPage,
  parseRoomPlayers,
  parseSearch,
  parseState,
  parseStats,
  tryParse,
} from "./parse.js";

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

const zero = { ok: 0, failed: 0 };
const accountsReply = {
  total: 3,
  verified: 2,
  methods: { google: 1, password: 1, both: 1 },
  active7: 1,
  active30: 2,
  suspended: 0,
  newPerDay: [{ day: "2026-10-27", count: 1 }],
  mail: {
    enabled: true,
    days: [{ day: "2026-10-27", verify: { ok: 2, failed: 1 }, reset: zero, admin: zero }],
    totals: { verify: { ok: 2, failed: 1 }, reset: zero, admin: zero },
  },
};
const detailReply = {
  id: 2,
  username: "Ali",
  email: "ali@test.local",
  createdAt: 1,
  verified: true,
  google: false,
  password: true,
  usernameChangedAt: null,
  lastSeen: 5,
  sessions: 1,
  matches: 2,
  wins: 1,
  games: 4,
  badges: 1,
  friends: 0,
  glix: { balance: 40, ledger: [{ at: 7, amount: 40, reason: "mac", ref: "yer:1" }] },
  cosmetics: {
    owned: [{ itemId: "unvan-sansli", acquiredAt: 9, pricePaid: 0 }],
    equipped: { unvan: "unvan-sansli" },
  },
  protected: false,
  suspension: null,
};

describe("hesap yanıtları", () => {
  it("geçerli yanıtlar kabul edilir", () => {
    expect(parseAccounts(accountsReply).mail.totals.verify.failed).toBe(1);
    expect(parseDetail(detailReply).email).toBe("ali@test.local");
    expect(parseDetail(detailReply).glix.balance).toBe(40);
    expect(parseDetail(detailReply).cosmetics.equipped).toEqual({ unvan: "unvan-sansli" });
    expect(tryParse(parseDetail, { ...detailReply, cosmetics: undefined })).toBeNull();
    expect(parseDetail(detailReply).glix.ledger[0]?.reason).toBe("mac");
    expect(
      parseDetail({ ...detailReply, suspension: { since: 1, until: null, reason: "x" } }).suspension,
    ).toEqual({ since: 1, until: null, reason: "x" });
    expect(
      parseSearch({
        results: [
          {
            id: 2,
            username: "Ali",
            createdAt: 1,
            verified: false,
            google: false,
            password: true,
            lastSeen: null,
            matches: 0,
            suspended: false,
          },
        ],
        limit: 20,
      }).results[0]?.username,
    ).toBe("Ali");
    expect(
      parseAuditPage({
        entries: [{ id: 3, actorId: 1, action: "account_view", targetId: null, detail: "", at: 9 }],
        nextBefore: 3,
      }).nextBefore,
    ).toBe(3);
  });
  it("eksik ya da yanlış tipli alan reddedilir", () => {
    expect(tryParse(parseAccounts, { ...accountsReply, methods: null })).toBeNull();
    expect(
      tryParse(parseAccounts, { ...accountsReply, mail: { ...accountsReply.mail, days: [{ day: "x" }] } }),
    ).toBeNull();
    expect(tryParse(parseDetail, { ...detailReply, email: 5 })).toBeNull();
    expect(tryParse(parseDetail, { ...detailReply, glix: undefined })).toBeNull();
    expect(
      tryParse(parseDetail, {
        ...detailReply,
        glix: { balance: 1, ledger: [{ at: 1, amount: 1, reason: "x", ref: null }] },
      }),
    ).toBeNull();
    expect(tryParse(parseDetail, { ...detailReply, suspension: { since: 1 } })).toBeNull();
    expect(tryParse(parseSearch, { results: [{ id: "2" }], limit: 20 })).toBeNull();
    expect(tryParse(parseSearch, { results: {}, limit: 20 })).toBeNull();
    expect(tryParse(parseAuditPage, { entries: [], nextBefore: "3" })).toBeNull();
    expect(tryParse(parseAuditPage, null)).toBeNull();
  });
});

describe("A3 yanıt doğrulaması", () => {
  const game = {
    id: "kule-ustasi",
    name: "Kule Ustası",
    minPlayers: 2,
    maxPlayers: 8,
    open: true,
    randomPool: true,
    engineRandomPool: true,
    overridden: false,
  };
  const content = {
    games: [game],
    announcement: { id: 3, text: "Merhaba", kind: "bilgi", endsAt: null },
  };
  const maintenance = {
    on: false,
    activeMatches: 2,
    rooms: 3,
    players: 9,
    draining: false,
    backup: { usedToday: 1, limit: 3, nextAt: null },
    releases: [
      {
        id: 2,
        revision: "abc1234",
        version: "0.1.0",
        startedAt: 5,
        endedAt: null,
        durationSec: 10,
        state: "running",
      },
      { id: 1, revision: "dev", version: "0.1.0", startedAt: 1, endedAt: 4, durationSec: 3, state: "clean" },
    ],
  };
  const push = {
    enabled: true,
    subscribers: 4,
    nextAllowedAt: null,
    last: { at: 9, title: "Selam", total: 4, sent: 3, failed: 1, removed: 0, finished: true },
  };

  it("geçerli yanıtlar çözülür", () => {
    expect(parseContent(content).games[0]?.name).toBe("Kule Ustası");
    expect(parseContent({ ...content, announcement: null }).announcement).toBeNull();
    expect(parseGameList({ ok: true, games: [game] })).toHaveLength(1);
    expect(parseMaintenance(maintenance).releases.map((r) => r.state)).toEqual(["running", "clean"]);
    expect(parsePushStatus(push).last?.sent).toBe(3);
    expect(parsePushStatus({ ...push, last: null }).last).toBeNull();
  });

  it("bozuk alanlar reddedilir", () => {
    expect(tryParse(parseContent, { ...content, games: [{ ...game, open: "evet" }] })).toBeNull();
    expect(
      tryParse(parseContent, { ...content, announcement: { id: 1, text: "x", kind: "hata", endsAt: null } }),
    ).toBeNull();
    expect(tryParse(parseContent, null)).toBeNull();
    expect(tryParse(parseMaintenance, { ...maintenance, backup: null })).toBeNull();
    expect(
      tryParse(parseMaintenance, {
        ...maintenance,
        releases: [{ ...maintenance.releases[0], state: "bilinmez" }],
      }),
    ).toBeNull();
    expect(tryParse(parseMaintenance, { ...maintenance, on: 1 })).toBeNull();
    expect(tryParse(parsePushStatus, { ...push, last: { at: 1 } })).toBeNull();
    expect(tryParse(parsePushStatus, { ...push, subscribers: "4" })).toBeNull();
    expect(tryParse(parseGameList, { games: "x" })).toBeNull();
  });
});

describe("A4 moderasyon yanıtları", () => {
  const row = {
    id: 3,
    createdAt: 1000,
    status: "new",
    reason: "abuse",
    targetName: "Ali",
    targetAccountId: null,
    roomCode: "ABCDE",
    gameId: "kendim",
  };
  const counts = { new: 1, reviewed: 0, actioned: 0, rejected: 2 };

  it("bildirim sayfası", () => {
    const page = parseReportPage({ reports: [row], nextBefore: null, counts });
    expect(page.reports[0]?.targetName).toBe("Ali");
    expect(page.counts.rejected).toBe(2);
    expect(
      tryParse(parseReportPage, { reports: [{ ...row, status: "yeni" }], nextBefore: null, counts }),
    ).toBeNull();
    expect(
      tryParse(parseReportPage, { reports: [{ ...row, reason: "spam" }], nextBefore: null, counts }),
    ).toBeNull();
    expect(tryParse(parseReportPage, { reports: [], nextBefore: null, counts: { new: 1 } })).toBeNull();
    expect(tryParse(parseReportPage, { reports: [row], counts })).toBeNull();
  });

  it("bildirim ayrıntısı kanıtla ve kanıtsız", () => {
    const base = {
      ...row,
      reporterAccountId: 4,
      note: "not",
      evidence: { gameId: "kendim", texts: ["ELMA"] },
      adminNote: "",
      reviewedAt: null,
      targetPlayerId: "0123456789ab",
      inRoom: true,
      targetProtected: false,
    };
    expect(parseReportDetail(base).evidence?.texts).toEqual(["ELMA"]);
    expect(parseReportDetail({ ...base, evidence: null }).evidence).toBeNull();
    expect(tryParse(parseReportDetail, { ...base, evidence: { gameId: "k", texts: [1] } })).toBeNull();
    expect(tryParse(parseReportDetail, { ...base, inRoom: "evet" })).toBeNull();
  });

  it("yasaklı kelimeler, takılan hesaplar ve oda oyuncuları", () => {
    expect(parseBannedWords({ words: [{ word: "x", addedAt: 1 }], max: 500 }).max).toBe(500);
    expect(tryParse(parseBannedWords, { words: [{ word: 5, addedAt: 1 }], max: 500 })).toBeNull();
    expect(
      parseBannedAccounts({ accounts: [{ id: 1, username: "a" }], truncated: false }).accounts,
    ).toHaveLength(1);
    const room = {
      code: "ABCDE",
      phase: "lobby",
      players: [{ id: "ab", nickname: "Ali", connected: true, spectator: false, host: true, account: false }],
    };
    expect(parseRoomPlayers(room).players[0]?.nickname).toBe("Ali");
    expect(tryParse(parseRoomPlayers, { ...room, players: [{ id: "ab" }] })).toBeNull();
  });
});

describe("parseEconomy", () => {
  const day = {
    day: "2026-10-26",
    mac: 100,
    rozet: 25,
    gorev: 0,
    yonetici: 40,
    yoneticiEksi: 30,
    harcanan: 105,
    kazanilan: 165,
    net: 30,
    sinirdaki: 1,
  };
  const { day: _d, ...totals } = day;
  const eco = {
    days: 7,
    daily: [day],
    totals,
    circulation: { total: 1234, holders: 5 },
    dailyCap: 300,
    topItems: [
      { itemId: "unvan-sansli", name: "Şanslı", rarity: "siradan", typeName: "Lakap", count: 2, glix: 210 },
    ],
    sales: { count: 2, glix: 210 },
    byRarity: [{ id: "siradan", label: "Sıradan", count: 2, glix: 210 }],
    byType: [{ id: "unvan", label: "Lakap", count: 2, glix: 210 }],
    deals: [
      { itemId: "unvan-sansli", name: "Şanslı", rarity: "siradan", listPrice: 150, price: 105, soldToday: 2 },
    ],
    dealEndsAt: 1,
  };

  it("geçerli yanıtı olduğu gibi okur", () => {
    expect(parseEconomy(eco)).toEqual(eco);
  });

  it("eksik ya da yanlış tipli alanda hata verir", () => {
    expect(tryParse(parseEconomy, { ...eco, circulation: { total: "1", holders: 5 } })).toBeNull();
    expect(tryParse(parseEconomy, { ...eco, daily: [{ ...day, net: null }] })).toBeNull();
    expect(tryParse(parseEconomy, { ...eco, deals: [{ itemId: "x" }] })).toBeNull();
    expect(tryParse(parseEconomy, { ...eco, topItems: "yok" })).toBeNull();
    expect(tryParse(parseEconomy, null)).toBeNull();
  });
});
