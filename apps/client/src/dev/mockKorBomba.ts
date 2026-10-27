/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez). Kör Bomba ekranları:
 *   ?mock=kor-bomba-briefing   anlatım
 *   ?mock=kor-bomba-holder     bomba sende (siyah çekirdek, PAS VER); koltuğa dokununca pas gider
 *   ?mock=kor-bomba-watch      bomba başkasında (gerçek kalan süre); botlar kendi aralarında pas verir
 *   ?mock=kor-bomba-urgent     son saniyeler
 *   ?mock=kor-bomba-blast      patlama anı
 *   ?mock=kor-bomba-spectator  izleyici
 * `&n=8` oyuncu sayısını değiştirir.
 */
import type {
  ClientMessage,
  GameInfo,
  KorBombaPublicView,
  KorBombaView,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const GAME: GameInfo = {
  id: "kor-bomba",
  name: "Kör Bomba",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "landscape",
};
const BRIEFING = {
  goal: "Bomba sende patlamasın!",
  steps: [
    "Bomba rastgele birinde başlar",
    "Taşıyan süreyi görmez; kandır ya da ikna et",
    "Pas ver, süreyi uzat; patlayan −1 alır",
  ],
};

export function startKorBombaMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 6));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(kind === "kor-bomba-holder" && i === 3 && n > 4),
    score: 0,
    spectator: false,
  }));
  const spectating = kind === "kor-bomba-spectator";
  const participants = players.map((p) => p.id).filter((id) => !(spectating && id === SELF));
  const startedAt = Date.now() - 6_000;
  const briefing = kind === "kor-bomba-briefing";

  let rev = 1;
  let holder = kind === "kor-bomba-holder" ? SELF : "p2";
  if (spectating) holder = "p1";
  let explodeAt = Date.now() + (kind === "kor-bomba-urgent" ? 3_400 : 11_800);
  let exploded = kind === "kor-bomba-blast";
  if (exploded) {
    holder = "p1";
    explodeAt = Date.now() - 400;
  }
  let passes = 2;
  let lastPass: KorBombaPublicView["lastPass"] = { seq: 2, from: "p4", to: holder };
  let lastBonusMs: number | null = null;
  const timers: ReturnType<typeof setTimeout>[] = [];

  const publicView = (): KorBombaPublicView => ({
    startedAt,
    holder,
    passes,
    lastPass,
    exploded,
    explodedAt: exploded ? explodeAt : null,
  });
  const view = (): KorBombaView => {
    if (spectating) return { role: "spectator" };
    if (holder === SELF && !exploded) return { role: "holder" };
    return { role: "watcher", explodeAt, lastBonusMs };
  };

  const phase: RoomPhase = briefing ? "briefing" : "playing";
  const publish = (): void => {
    const now = Date.now();
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: GAME.id,
      gameName: GAME.name,
      briefing: BRIEFING,
      orientation: "landscape",
      participants,
      readyIds: briefing ? ["p1", "p2"] : [],
      phaseStartedAt: startedAt,
      phaseEndsAt: briefing ? now + 40_000 : null,
      publicView: publicView(),
      view: view(),
      result: null,
    };
    const snapshot: RoomSnapshot = {
      rev: ++rev,
      serverNow: now,
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
      phase,
      players,
      gameIds: [GAME.id],
      selection: { mode: "manual" },
      tone: "arkadas",
      joinPolicy: "izleyici",
      lobbyReady: [],
      catalog: [GAME],
      match,
    };
    applySnapshot(snapshot);
  };

  const doPass = (from: string, to: string): void => {
    if (exploded || from !== holder || from === to) return;
    const bonus = 1_000 + Math.floor(Math.random() * 3_001);
    holder = to;
    explodeAt += bonus;
    lastBonusMs = bonus;
    passes += 1;
    lastPass = { seq: passes, from, to };
    publish();
  };
  const botPass = (): void => {
    if (exploded) return;
    if (holder !== SELF) {
      const targets = players.filter((p) => p.id !== holder && p.connected).map((p) => p.id);
      const to = targets[Math.floor(Math.random() * targets.length)];
      if (to && Math.random() < 0.6) doPass(holder, to);
    }
    timers.push(setTimeout(botPass, 2_200 + Math.random() * 1_500));
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg: ClientMessage) => {
    if (msg.type !== "action") return;
    const p = msg.payload as { kind?: unknown; to?: unknown };
    if (p.kind === "pass" && typeof p.to === "string") doPass(SELF, p.to);
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
  if (kind === "kor-bomba-watch" || kind === "kor-bomba-holder") {
    timers.push(setTimeout(botPass, 3_000));
  }
  // Bomba bir kez daha patlasın diye: süre dolunca patlamayı yayınla.
  const arm = (): void => {
    if (exploded) return;
    if (Date.now() >= explodeAt) {
      exploded = true;
      publish();
      return;
    }
    timers.push(setTimeout(arm, 100));
  };
  arm();
}
