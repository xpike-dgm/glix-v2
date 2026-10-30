/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez; App.tsx `import.meta.env.DEV` ile korur).
 * Zaman Bombası Hafızası'nın her evresi (`&n=8` oyuncu sayısı):
 *   ?mock=zaman-briefing     anlatım
 *   ?mock=zaman-playback     dizi oynatılıyor (ikinci ışık yanık), sıra sende gelecek
 *   ?mock=zaman-mine         sıra sende: tuşlar açık, geri sayım, iki doğru basış
 *   ?mock=zaman-other        başkası basıyor
 *   ?mock=zaman-ok           doğru giriş: "TEMİZ!" (seçim ekranı açılmadan önce)
 *   ?mock=zaman-pick-color   bombayı atacaksın: önce diziye renk ekle (ZB-M2)
 *   ?mock=zaman-pick-target  renk seçildi: kime atıyorsun? (ZB-M1; `&n=8` engelli oyuncu dahil)
 *   ?mock=zaman-pick-other   başkası seçiyor
 *   ?mock=zaman-restart      elenme sonrası: yeni kurbanı sen seçiyorsun
 *   ?mock=zaman-alert        bomba sana atıldı: "SIRA SENDE!" bandı ve kenar ışığı (ZB-U2)
 *   ?mock=zaman-thrown       bomba başkasına atıldı
 *   ?mock=zaman-fail         yanlış basış: panel çatlak, oyuncu elendi
 *   ?mock=zaman-timeout      süre doldu
 *   ?mock=zaman-eliminated   sen elendin, izliyorsun
 *   ?mock=zaman-spectator    katılımcı değilsin
 *   ?mock=zaman-sudden       ani ölüm evresi (son 30 sn), sıra sende
 *   ?mock=zaman-timeup       toplam süre doldu, oyun bitti
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
    score: [7, 5, 9, 3, 4, 6, 2, 8][i] ?? 0,
    spectator: false,
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

  // Oyun sırasında puan birikmez (ZB-M3): herkes 0.
  const scores: Record<string, number> = {};
  for (const id of order) scores[id] = 0;

  const base: ZamanBombasiPublicView = {
    order,
    eliminated: [],
    scores,
    active: "p1",
    pick: null,
    lastThrow: { from: "p2", to: "p1", at: now - 6000, auto: false },
    length: 4,
    phase: "input",
    turn: 5,
    turnStart: now - 4000 - 4 * 350,
    inputStart: now - 4000,
    deadline: now + 30_000,
    stepMs: 350,
    playbackIndex: -1,
    sequence: null,
    pressed: [],
    need,
    startedAt: now - 10_000,
    endsAt: now + 80_000,
    suddenDeathAt: now + 50_000,
    timeUp: false,
    last: { turn: 4, player: "p2", kind: "ok", at: now - 15_000 },
  };
  const priv: ZamanBombasiView = { isOut: false, myTurn: false, myPick: false, pickColor: null };
  const pickBase = {
    phase: "pick" as const,
    sequence: null,
    pressed: [],
    turnStart: now + SLOW,
    inputStart: now + SLOW + 5 * 350,
    deadline: now + SLOW + 5 * 350 + 6_500,
  };
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
        deadline: now - SLOW - 10_000 + 4 * SLOW + 5_500,
        playbackIndex: 1,
        sequence: seq,
      };
      mine = { ...priv, myTurn: true };
      break;
    case "zaman-mine":
      pub = { ...base, active: SELF, pressed: ["yesil", "mavi"] };
      mine = { ...priv, myTurn: true };
      break;
    case "zaman-sudden":
      pub = {
        ...base,
        active: SELF,
        length: 6,
        deadline: now + 25_000,
        pressed: ["yesil", "mavi"],
        startedAt: now - 62_000,
        endsAt: now + 28_000,
        suddenDeathAt: now - 2_000,
      };
      mine = { ...priv, myTurn: true };
      break;
    case "zaman-timeup":
      pub = {
        ...base,
        phase: "over",
        active: null,
        sequence: null,
        startedAt: now - 90_500,
        endsAt: now - 500,
        suddenDeathAt: now - 30_500,
        timeUp: true,
      };
      mine = priv;
      break;
    case "zaman-other":
      pub = { ...base, active: "p1", pressed: ["yesil"] };
      mine = priv;
      break;
    case "zaman-ok":
      // Doğru giriş anı: seçim evresi, ekran henüz açılmadı ("TEMİZ!").
      pub = {
        ...base,
        ...pickBase,
        active: SELF,
        pick: {
          by: SELF,
          kind: "throw",
          opensAt: now + SLOW,
          deadline: now + 2 * SLOW,
          colorDone: false,
          blocked: "p1",
        },
        last: { turn: 5, player: SELF, kind: "ok", at: now - 300 },
      };
      mine = { ...priv, myPick: true };
      break;
    case "zaman-pick-color":
    case "zaman-pick-target":
    case "zaman-pick-other": {
      const by = kind === "zaman-pick-other" ? "p1" : SELF;
      const colorDone = kind !== "zaman-pick-color";
      pub = {
        ...base,
        ...pickBase,
        active: by,
        pick: {
          by,
          kind: "throw",
          opensAt: now - 1000,
          deadline: now + SLOW,
          colorDone,
          blocked: by === SELF ? "p1" : "p2",
        },
        eliminated: n >= 6 ? ["p4"] : [],
        last: { turn: 5, player: by, kind: "ok", at: now - 1900 },
      };
      mine = by === SELF ? { ...priv, myPick: true, pickColor: colorDone ? "kirmizi" : null } : priv;
      break;
    }
    case "zaman-restart":
      pub = {
        ...base,
        ...pickBase,
        length: 2,
        active: SELF,
        eliminated: ["p2"],
        pick: {
          by: SELF,
          kind: "restart",
          opensAt: now - 500,
          deadline: now + SLOW,
          colorDone: true,
          blocked: null,
        },
        last: { turn: 5, player: "p2", kind: "fail", at: now - 2100, color: "mavi", expected: "sari" },
      };
      mine = { ...priv, myPick: true };
      break;
    case "zaman-alert":
    case "zaman-thrown": {
      const to = kind === "zaman-alert" ? SELF : "p2";
      pub = {
        ...base,
        active: to,
        phase: "pause",
        length: 5,
        turnStart: now + SLOW,
        inputStart: now + SLOW + 5 * 350,
        deadline: now + SLOW + 5 * 350 + 6_500,
        sequence: [...seq, "kirmizi"],
        lastThrow: { from: "p1", to, at: now - 900, auto: false },
        last: { turn: 5, player: "p1", kind: "ok", at: now - 3000 },
        turn: 6,
      };
      mine = to === SELF ? { ...priv, myTurn: true } : priv;
      break;
    }
    case "zaman-fail":
    case "zaman-timeout": {
      const out = kind === "zaman-fail" ? "p2" : "p3";
      pub = {
        ...base,
        active: SELF,
        eliminated: [out],
        phase: "pause",
        length: 2,
        turnStart: now + SLOW,
        inputStart: now + SLOW + 2 * 350,
        deadline: now + SLOW + 2 * 350 + 3_500,
        sequence: ["sari", "yesil"],
        last:
          kind === "zaman-fail"
            ? { turn: 4, player: out, kind: "fail", at: now - 400, color: "mavi", expected: "sari" }
            : { turn: 4, player: out, kind: "timeout", at: now - 400 },
        // İlk sıra gibi atanı olmayan elenme: bomba patlama gösteriminden sonra rastgele atılır.
        lastThrow: { from: null, to: SELF, at: now + SLOW / 2, auto: true },
      };
      mine = { ...priv, myTurn: true };
      break;
    }
    case "zaman-eliminated":
      pub = { ...base, eliminated: [SELF], pressed: ["yesil", "mavi"] };
      mine = { ...priv, isOut: true };
      break;
    case "zaman-spectator":
      pub = { ...base, pressed: ["yesil", "mavi"] };
      mine = priv;
      break;
    case "zaman-results": {
      phase = "results";
      phaseStartedAt = now;
      phaseEndsAt = now + 7000;
      const mini: Record<string, number> = {};
      players.forEach((p, i) => {
        // ZB-M3: hayatta kalanlar +2, elenenler 0.
        mini[p.id] = [2, 2, 0, 2, 0, 0, 2, 0][i] ?? 0;
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
    gameIds: [zamanBombasiHafizasi.id],
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
