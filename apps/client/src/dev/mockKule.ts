/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez; App.tsx `import.meta.env.DEV` ile korur).
 * Kule Ustası'nın evreleri (`&n=8` oyuncu sayısı):
 *   ?mock=kule-briefing   anlatım
 *   ?mock=kule-turn       sıra sende: blok kayıyor, dokunup bırak
 *   ?mock=kule-watching   başkası bırakıyor
 *   ?mock=kule-perfect    Kusursuz! (sıra arası)
 *   ?mock=kule-miss       ıska: kule yıkıldı, oyuncu çıktı
 *   ?mock=kule-out        sen çıktın, izliyorsun
 *   ?mock=kule-warn       "SIRA SENDE!" uyarısı (vinç yeni bloğu indiriyor; sıra `&fx=ms` sonra başlar)
 *   ?mock=kule-urgent     sıranın son 2 saniyesi: kırmızı halka, titreyen blok
 *   ?mock=kule-cut        taşan parça kesilip dönerek düşüyor ("−40")
 *   ?mock=kule-record     rekor çizgisi geçildi, "Yeni rekor!"; hız ×2,5 (kırmızı)
 *   ?mock=kule-end        oyun bitti: şeritte +2 / +1 / 0 (`&sonuc=1`: altta "Devam et")
 *   ?mock=kule-reveal     genel sonuç ekranı
 *   TV: `?mock=tv-kule-turn`, `tv-kule-perfect`, `tv-kule-miss`, `tv-kule-end` … (aynı adlar, `tv-` önekiyle).
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

export function startKuleMock(rawKind: string, params: URLSearchParams): void {
  const kind = rawKind.startsWith("tv-") ? rawKind.slice(3) : rawKind;
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
  /** Gösterilen sonucun sunucu anı: `&fx=ms` ile ileri alınır (ekran görüntüsünde efektin ortası yakalansın). */
  const fxAt = now + (Number(params.get("fx")) || 700);

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let phaseStartedAt = now - 14_000;
  let result: MatchSnapshot["result"] = null;

  const usta: Record<string, number> = {};
  const perfects: Record<string, number> = {};
  order.forEach((id, i) => {
    perfects[id] = i === 2 ? 2 : i === 0 ? 1 : 0;
    usta[id] = [3, 1, 5, 2, 0, 1, 2, 0][i] ?? 0;
  });

  const base: KulePublicView = {
    order,
    eliminated: [],
    usta,
    perfects,
    awards: null,
    record: 4,
    streak: 0,
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
    case "kule-warn":
      pub = { ...base, turnStart: fxAt, deadline: fxAt + 6_000 };
      mine = { isOut: false, myTurn: true, turnsAway: 0 };
      break;
    case "kule-urgent":
      // Sıra 4,5 sn önce başladı; hız, blok pistin ortasına yakın dursun diye seçildi.
      pub = { ...base, turnStart: now - 4_500, deadline: now + 1_500, speed: 148 };
      mine = { isOut: false, myTurn: true, turnsAway: 0 };
      break;
    case "kule-cut":
      pub = {
        ...base,
        active: "p1",
        turnStart: now + 60_000,
        deadline: now + 66_000,
        last: {
          turn: 8,
          player: SELF,
          kind: "ok",
          at: fxAt,
          auto: false,
          dropLeft: 400,
          dropWidth: 320,
          cutLeft: 680,
          cutWidth: 40,
        },
      };
      mine = { isOut: false, myTurn: false, turnsAway: 1 };
      break;
    case "kule-record": {
      const tall: KuleBlock[] = [...TOWER];
      for (let i = 0; i < 12; i++)
        tall.push({ left: 360 + (i % 3) * 4, width: 270 - i * 6, perfect: i % 4 === 1 });
      const t = tall[tall.length - 1] as KuleBlock;
      pub = {
        ...base,
        active: "p1",
        tower: tall,
        floors: tall.length - 1,
        record: tall.length - 2,
        blockWidth: t.width,
        speed: 2_500,
        streak: 3,
        turnStart: now + 60_000,
        deadline: now + 66_000,
        last: {
          turn: 8,
          player: SELF,
          kind: "perfect",
          at: fxAt,
          auto: false,
          dropLeft: t.left + 3,
          dropWidth: t.width,
          cutLeft: t.left,
          cutWidth: 0,
        },
      };
      mine = { isOut: false, myTurn: false, turnsAway: 1 };
      break;
    }
    case "kule-end": {
      const out = [order[1], order[3]].filter((id): id is string => id !== undefined);
      const end: Record<string, number> = {};
      for (const id of order) end[id] = (usta[id] ?? 0) + (out.includes(id) ? 0 : 3);
      const ranked = [...new Set(Object.values(end))].sort((a, b) => b - a);
      const awards: Record<string, number> = {};
      for (const id of order) awards[id] = end[id] === ranked[0] ? 2 : end[id] === ranked[1] ? 1 : 0;
      pub = {
        ...base,
        active: null,
        timeUp: true,
        eliminated: out,
        usta: end,
        awards,
        endsAt: now - 500,
        startedAt: now - 90_500,
      };
      mine = { isOut: false, myTurn: false, turnsAway: null };
      break;
    }
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
          at: fxAt,
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
        turnStart: now + 60_000,
        deadline: now + 66_000,
        tower: [TOWER[0] as KuleBlock],
        floors: 0,
        blockWidth: (TOWER[0] as KuleBlock).width,
        last: {
          turn: 8,
          player: out,
          kind: "miss",
          at: fxAt,
          auto: false,
          dropLeft: 40,
          dropWidth: top.width,
          cutLeft: 40,
          cutWidth: top.width,
          fallen: TOWER,
        },
        record: TOWER.length - 1,
      };
      mine = { isOut: false, myTurn: true, turnsAway: 0 };
      break;
    }
    case "kule-out":
      pub = { ...base, active: "p1", eliminated: [SELF] };
      mine = { isOut: true, myTurn: false, turnsAway: null };
      break;
    case "kule-reveal": {
      phase = "results";
      phaseStartedAt = now;
      phaseEndsAt = now + 7000;
      const mini: Record<string, number> = {};
      players.forEach((p, i) => {
        mini[p.id] = [6, 9, 4, 0, 2, 7, 1, 3][i] ?? 0;
      });
      const ranked = [...new Set(Object.values(mini).filter((x) => x > 0))].sort((a, b) => b - a);
      const awards: Record<string, number> = {};
      for (const [id, x] of Object.entries(mini)) awards[id] = x === ranked[0] ? 2 : x === ranked[1] ? 1 : 0;
      result = { miniScores: mini, awards };
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
