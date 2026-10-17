/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez; App.tsx `import.meta.env.DEV` ile korur).
 * Zaman Bombası Hafızası'nın her evresi (`&n=8` oyuncu sayısı):
 *   ?mock=zaman-briefing     anlatım
 *   ?mock=zaman-playback     dizi oynatılıyor (ikinci ışık yanık), sıra sende gelecek
 *   ?mock=zaman-mine         sıra sende: tuşlar açık, geri sayım, iki doğru basış
 *   ?mock=zaman-other        başkası basıyor
 *   ?mock=zaman-ok           doğru cevap sonrası kısa ara
 *   ?mock=zaman-fail         yanlış basış: panel çatlak, oyuncu elendi
 *   ?mock=zaman-timeout      süre doldu
 *   ?mock=zaman-eliminated   sen elendin, izliyorsun
 *   ?mock=zaman-spectator    katılımcı değilsin
 *   ?mock=zaman-results      sonuç ekranı
 * Süreler çok yavaş (adım başına 60 sn) tutulur: ekran görüntüsü kararlı kalır.
 */
import type {
  GameInfo,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
  ZamanBombasiColor,
  ZamanBombasiPublicView,
  ZamanBombasiView,
} from "@glix/engine";
import { zamanBombasiHafizasi } from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const SLOW = 60_000;

const CATALOG: GameInfo[] = [
  {
    id: "zaman-bombasi-hafizasi",
    name: zamanBombasiHafizasi.name,
    minPlayers: 2,
    maxPlayers: 8,
    orientation: "portrait",
  },
];

export function startZamanBombasiMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const now = Date.now();
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
  }));
  const spectator = kind === "zaman-spectator";
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  // Sıra: p1, p0 (sen), sonra diğerleri.
  const order = ["p1", SELF, ...players.map((p) => p.id).filter((id) => id !== "p1" && id !== SELF)].filter(
    (id) => participants.includes(id),
  );
  const seq: ZamanBombasiColor[] = ["yesil", "mavi", "sari", "kirmizi"];
  const need = Math.ceil(n / 2);

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let phaseStartedAt = now - 14_000;
  let result: MatchSnapshot["result"] = null;

  const scores: Record<string, number> = {};
  order.forEach((id, i) => {
    scores[id] = [1, 2, 0, 1, 3, 1, 0, 2][i] ?? 0;
  });

  const base: ZamanBombasiPublicView = {
    order,
    eliminated: [],
    scores,
    active: "p1",
    length: 4,
    phase: "input",
    turn: 5,
    turnStart: now - 4000 - 4 * 600,
    inputStart: now - 4000,
    deadline: now + 8000,
    stepMs: 600,
    playbackIndex: -1,
    sequence: null,
    pressed: [],
    need,
    last: { turn: 4, player: "p2", kind: "ok", at: now - 15_000 },
  };
  const priv: ZamanBombasiView = { isOut: false, myTurn: false, turnsAway: 1 };
  let pub: ZamanBombasiPublicView = base;
  let mine: ZamanBombasiView = priv;

  switch (kind) {
    case "zaman-briefing":
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = now + 40_000;
      phaseStartedAt = now;
      break;
    case "zaman-playback":
      pub = {
        ...base,
        active: SELF,
        phase: "playback",
        stepMs: SLOW,
        turnStart: now - SLOW - 10_000,
        inputStart: now - SLOW - 10_000 + 4 * SLOW,
        deadline: now - SLOW - 10_000 + 4 * SLOW + 12_000,
        playbackIndex: 1,
        sequence: seq,
      };
      mine = { isOut: false, myTurn: true, turnsAway: 0 };
      break;
    case "zaman-mine":
      pub = { ...base, active: SELF, pressed: ["yesil", "mavi"] };
      mine = { isOut: false, myTurn: true, turnsAway: 0 };
      break;
    case "zaman-other":
      pub = { ...base, active: "p1", pressed: ["yesil"] };
      mine = { isOut: false, myTurn: false, turnsAway: 1 };
      break;
    case "zaman-ok":
      pub = {
        ...base,
        active: SELF,
        phase: "pause",
        length: 5,
        turnStart: now + SLOW,
        inputStart: now + SLOW + 5 * 600,
        deadline: now + SLOW + 5 * 600 + 15_000,
        sequence: [...seq, "yesil"],
        last: { turn: 4, player: "p1", kind: "ok", at: now - 300 },
      };
      mine = { isOut: false, myTurn: true, turnsAway: 0 };
      break;
    case "zaman-fail":
    case "zaman-timeout": {
      const out = kind === "zaman-fail" ? "p2" : "p3";
      pub = {
        ...base,
        active: SELF,
        eliminated: [out],
        scores: { ...scores, [out]: -1 },
        phase: "pause",
        length: 2,
        turnStart: now + SLOW,
        inputStart: now + SLOW + 2 * 600,
        deadline: now + SLOW + 2 * 600 + 6000,
        sequence: ["sari", "yesil"],
        last:
          kind === "zaman-fail"
            ? { turn: 4, player: out, kind: "fail", at: now - 400, color: "mavi", expected: "sari" }
            : { turn: 4, player: out, kind: "timeout", at: now - 400 },
      };
      mine = { isOut: false, myTurn: true, turnsAway: 0 };
      break;
    }
    case "zaman-eliminated":
      pub = { ...base, eliminated: [SELF], scores: { ...scores, [SELF]: -1 }, pressed: ["yesil", "mavi"] };
      mine = { isOut: true, myTurn: false, turnsAway: null };
      break;
    case "zaman-spectator":
      pub = { ...base, pressed: ["yesil", "mavi"] };
      mine = { isOut: false, myTurn: false, turnsAway: null };
      break;
    case "zaman-results": {
      phase = "results";
      phaseStartedAt = now;
      phaseEndsAt = now + 7000;
      const mini: Record<string, number> = {};
      players.forEach((p, i) => {
        mini[p.id] = [4, 3, 3, 1, 0, -1, -1, 2][i] ?? 0;
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
    gameId: zamanBombasiHafizasi.id,
    gameName: zamanBombasiHafizasi.name,
    briefing: {
      goal: zamanBombasiHafizasi.briefing.goal,
      steps: [...zamanBombasiHafizasi.briefing.steps],
    },
    orientation: "portrait",
    participants,
    readyIds,
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
    gameIds: [zamanBombasiHafizasi.id],
    catalog: CATALOG,
    match,
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender(() => {});
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot);
}
