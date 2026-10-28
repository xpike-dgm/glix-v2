/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez; App.tsx `import.meta.env.DEV` ile korur).
 * Kule Ustası'nın evreleri (`&n=8` oyuncu sayısı):
 *   ?mock=kule-briefing   anlatım
 *   ?mock=kule-turn       sıra sende: blok kayıyor, dokunup bırak
 *   ?mock=kule-watching   başkası bırakıyor
 *   ?mock=kule-perfect    Kusursuz! (sıra arası)
 *   ?mock=kule-miss       ıska: kule yıkıldı, oyuncu çıktı
 *   ?mock=kule-out        sen çıktın, izliyorsun
 *   ?mock=kule-reveal     sonuç ekranı
 * Blok neredeyse durur (hız çarpanı 1/1000, sıra çok önce başlamış sayılır): ekran görüntüsü kararlı kalır.
 */
import type {
  GameInfo,
  KuleBlock,
  KulePublicView,
  KuleView,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
} from "@glix/engine";
import { kuleUstasi } from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
/** Hız çarpanı 1/1000 iken 700 000 ms ≈ 315 birim: blok pistin ortasına yakın durur. */
const STILL_MS = 700_000;

const CATALOG: GameInfo[] = [
  {
    id: "kule-ustasi",
    name: kuleUstasi.name,
    minPlayers: 2,
    maxPlayers: 8,
    orientation: "portrait",
    randomPool: false,
  },
];

const TOWER: KuleBlock[] = [
  { left: 300, width: 400, perfect: false },
  { left: 310, width: 380, perfect: false },
  { left: 310, width: 380, perfect: true },
  { left: 330, width: 340, perfect: false },
  { left: 345, width: 310, perfect: false },
  { left: 345, width: 310, perfect: true },
  { left: 360, width: 280, perfect: false },
];

export function startKuleMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const now = Date.now();
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
    spectator: false,
  }));
  const participants = players.map((p) => p.id);
  const order = ["p1", SELF, ...participants.filter((id) => id !== "p1" && id !== SELF)];
  const top = TOWER[TOWER.length - 1] as KuleBlock;

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let phaseStartedAt = now - 14_000;
  let result: MatchSnapshot["result"] = null;

  const scores: Record<string, number> = {};
  order.forEach((id) => {
    scores[id] = 1;
  });
  const perfects: Record<string, number> = {};
  order.forEach((id, i) => {
    perfects[id] = i === 2 ? 2 : 0;
  });
  scores[order[2] as string] = 2;

  const base: KulePublicView = {
    order,
    eliminated: [],
    scores,
    perfects,
    active: SELF,
    turn: 9,
    turnStart: now - STILL_MS,
    deadline: now + 5_000,
    speed: 1,
    blockWidth: top.width,
    tower: TOWER,
    floors: TOWER.length - 1,
    need: Math.ceil(n / 2),
    startedAt: now - 40_000,
    endsAt: now + 50_000,
    timeUp: false,
    last: {
      turn: 8,
      player: "p1",
      kind: "ok",
      at: now - 8_000,
      auto: false,
      dropLeft: 350,
      dropWidth: 310,
      cutLeft: 345,
      cutWidth: 5,
    },
  };
  const priv: KuleView = { isOut: false, myTurn: false, turnsAway: 1 };
  let pub: KulePublicView = base;
  let mine: KuleView = priv;

  switch (kind) {
    case "kule-briefing":
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = now + 40_000;
      phaseStartedAt = now;
      break;
    case "kule-turn":
      mine = { isOut: false, myTurn: true, turnsAway: 0 };
      break;
    case "kule-watching":
      pub = { ...base, active: "p1" };
      mine = { isOut: false, myTurn: false, turnsAway: 1 };
      break;
    case "kule-perfect":
      pub = {
        ...base,
        active: "p1",
        turn: 9,
        turnStart: now + 60_000,
        deadline: now + 66_000,
        last: {
          turn: 8,
          player: SELF,
          kind: "perfect",
          at: now - 300,
          auto: false,
          dropLeft: 362,
          dropWidth: 280,
          cutLeft: 362,
          cutWidth: 0,
        },
      };
      mine = { isOut: false, myTurn: false, turnsAway: 1 };
      break;
    case "kule-miss": {
      const out = "p2";
      pub = {
        ...base,
        active: SELF,
        eliminated: [out],
        scores: { ...scores, [out]: -1 },
        turnStart: now + 60_000,
        deadline: now + 66_000,
        tower: [TOWER[0] as KuleBlock],
        floors: 0,
        blockWidth: (TOWER[0] as KuleBlock).width,
        last: {
          turn: 8,
          player: out,
          kind: "miss",
          at: now - 400,
          auto: false,
          dropLeft: 40,
          dropWidth: top.width,
          cutLeft: 40,
          cutWidth: top.width,
          fallen: TOWER,
        },
      };
      mine = { isOut: false, myTurn: true, turnsAway: 0 };
      break;
    }
    case "kule-out":
      pub = { ...base, active: "p1", eliminated: [SELF], scores: { ...scores, [SELF]: -1 } };
      mine = { isOut: true, myTurn: false, turnsAway: null };
      break;
    case "kule-reveal": {
      phase = "results";
      phaseStartedAt = now;
      phaseEndsAt = now + 7000;
      const mini: Record<string, number> = {};
      players.forEach((p, i) => {
        mini[p.id] = [-1, 2, 1, 1, -1, 1, -1, 1][i] ?? 0;
      });
      result = { miniScores: mini, awards: { ...mini } };
      break;
    }
    default:
      break;
  }

  const match: MatchSnapshot = {
    round: 0,
    total: 3,
    gameId: kuleUstasi.id,
    gameName: kuleUstasi.name,
    briefing: { goal: kuleUstasi.briefing.goal, steps: [...kuleUstasi.briefing.steps] },
    orientation: "portrait",
    participants,
    readyIds,
    continueIds: [],
    phaseStartedAt,
    phaseEndsAt,
    publicView: phase === "playing" ? pub : null,
    view: phase === "playing" ? mine : null,
    result,
  };
  const snapshot: RoomSnapshot = {
    rev: 2,
    serverNow: now,
    code: "KX7QP",
    hostId: SELF,
    selfId: SELF,
    phase,
    players,
    gameIds: [kuleUstasi.id],
    selection: { mode: "manual" },
    joinPolicy: "izleyici",
    lobbyReady: [],
    stageCount: 0,
    catalog: CATALOG,
    match,
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender(() => {});
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot);
}
