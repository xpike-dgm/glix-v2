/**
 * Yalnız geliştirme önizlemesi: `?mock=lobby|briefing|countdown|playing|results|final` (ayrıca home, join,
 * notfound, reconnect). Sunucu olmadan sahte RoomSnapshot üretir. `&n=8` oyuncu sayısını değiştirir.
 * Üretim derlemesinde App.tsx'teki `import.meta.env.DEV` koruması nedeniyle pakete girmez.
 */
import type {
  ClientMessage,
  ContentTone,
  GameInfo,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
} from "@glix/engine";
import {
  BUTONA_BAS_DURATION_MS,
  type ButonaBasPublicView,
  type ButonaBasView,
  type ButonaBasWindowResult,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { emitReaction } from "../net/reactions.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";

const CATALOG: GameInfo[] = [
  { id: "butona-bas", name: "Butona Bas", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  { id: "hafiza", name: "Hafıza Kapışması", minPlayers: 3, maxPlayers: 8, orientation: "portrait" },
  { id: "kor-bomba", name: "Kör Bomba", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  { id: "cagrisim-agi", name: "Çağrışım Ağı", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  { id: "capraz-ates", name: "Çapraz Ateş", minPlayers: 3, maxPlayers: 8, orientation: "landscape" },
  { id: "karalama-defteri", name: "Karalama Defteri", minPlayers: 3, maxPlayers: 8, orientation: "portrait" },
];

export function startMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(1, Number(params.get("n")) || 5));
  let players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(kind === "lobby" && i === 3),
    score: 0,
  }));
  let rev = 1;
  // Varsayılan oda rastgele 5; `&sel=manual` el ile modda açar.
  let selection: RoomSnapshot["selection"] =
    params.get("sel") === "manual" ? { mode: "manual" } : { mode: "random", count: 5 };
  let tone: ContentTone = "arkadas";
  let gameIds = selection.mode === "manual" ? ["butona-bas"] : [];
  let phase: RoomPhase = "lobby";
  let readyIds: string[] = [];
  const hostId = params.get("guest") === "1" ? "p1" : SELF;
  // `&ready=K`: host dışındaki ilk K oyuncu lobide "Hazırım" demiş olur.
  let lobbyReady: string[] = players
    .filter((p) => p.id !== hostId && p.connected)
    .slice(0, Math.max(0, Number(params.get("ready")) || 0))
    .map((p) => p.id);
  let phaseStartedAt = Date.now();
  let phaseEndsAt: number | null = null;
  let result: MatchSnapshot["result"] = null;
  let publicView: unknown = null;
  let view: unknown = null;
  let playStart = Date.now();
  let windows: ButonaBasWindowResult[] = [];
  let windowIndex = 0;
  let mini: Record<string, number> = {};
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number): void => {
    timers.push(setTimeout(fn, ms));
  };

  setState({ conn: "open", everOpen: true, nickname: params.has("nonick") ? "" : "Cihad" });

  const match = (): MatchSnapshot | null =>
    phase === "lobby"
      ? null
      : {
          round: 0,
          total: 3,
          gameId: "butona-bas",
          gameName: "Butona Bas",
          briefing: {
            goal: "Aynı anda büyük kırmızı butona basarak eşleşme yakala.",
            steps: [
              "Büyük kırmızı butonu hazırla.",
              "Aynı kısa zamanda arkadaşlarınla bas.",
              "Grup basışı puan verir, tek basış geri teper.",
            ],
          },
          orientation: "portrait",
          participants: players.map((p) => p.id),
          readyIds,
          phaseStartedAt,
          phaseEndsAt,
          publicView,
          view,
          result,
        };

  const publish = (): void => {
    const snapshot: RoomSnapshot = {
      rev: ++rev,
      serverNow: Date.now(),
      code: "KX7QP",
      hostId,
      selfId: SELF,
      phase,
      players,
      gameIds,
      selection,
      tone,
      lobbyReady: phase === "lobby" ? lobbyReady : [],
      catalog: CATALOG,
      match: match(),
    };
    applySnapshot(snapshot);
  };

  const buildPublicView = (): ButonaBasPublicView => ({
    startedAt: playStart,
    endsAt: playStart + BUTONA_BAS_DURATION_MS,
    windowMs: 300,
    scores: { ...mini },
    recent: windows.slice(-8),
  });
  const buildView = (): ButonaBasView => ({ myScore: mini[SELF] ?? 0, pressedThisWindow: false });

  const addWindow = (pressers: string[]): void => {
    const outcome: "match" | "solo" = pressers.length >= 2 ? "match" : "solo";
    windows = [...windows, { index: windowIndex++, pressers, outcome }].slice(-8);
    for (const id of pressers) mini[id] = (mini[id] ?? 0) + (outcome === "match" ? 1 : -1);
    publicView = buildPublicView();
    view = buildView();
    publish();
  };

  const botWindow = (): void => {
    if (phase !== "playing") return;
    const bots = players.filter((p) => p.id !== SELF).map((p) => p.id);
    const k = Math.random() < 0.7 ? 2 + Math.floor(Math.random() * 2) : 1;
    const picked = [...bots].sort(() => Math.random() - 0.5).slice(0, Math.min(k, bots.length));
    addWindow(picked);
    later(botWindow, 800 + Math.random() * 700);
  };

  const toPlaying = (): void => {
    phase = "playing";
    playStart = Date.now() - 14_000;
    phaseStartedAt = playStart;
    phaseEndsAt = null;
    mini = { p0: 4, p1: 5, p2: 3, p3: 1, p4: 0 };
    windows = [];
    windowIndex = 0;
    publicView = buildPublicView();
    view = buildView();
    publish();
    later(botWindow, 400);
  };
  const toCountdown = (): void => {
    phase = "countdown";
    phaseStartedAt = Date.now();
    phaseEndsAt = phaseStartedAt + 3000;
    publish();
    later(() => {
      if (phase !== "countdown") return;
      if (kind === "countdown") toCountdown();
      else toPlaying();
    }, 3000);
  };
  const toResults = (): void => {
    phase = "results";
    phaseStartedAt = Date.now();
    phaseEndsAt = phaseStartedAt + 7000;
    const scores = [9, 6, 6, 2, -1, 0, 3, 4];
    mini = Object.fromEntries(players.map((p, i) => [p.id, scores[i] ?? 0]));
    result = {
      miniScores: mini,
      awards: Object.fromEntries(players.map((p, i) => [p.id, i === 0 ? 2 : i === 1 ? 1 : i === 4 ? -1 : 0])),
    };
    publish();
    if (kind === "results") later(toResults, 7000);
  };
  const toFinal = (): void => {
    phase = "final";
    const totals = [5, 4, 4, 2, -1, 0, 3, 2];
    players = players.map((p, i) => ({ ...p, score: totals[i] ?? 0 }));
    publish();
  };
  const toBriefing = (): void => {
    phase = "briefing";
    readyIds = ["p1", "p2"];
    phaseStartedAt = Date.now();
    phaseEndsAt = phaseStartedAt + 40_000;
    publish();
  };

  useMockSender((msg: ClientMessage) => {
    switch (msg.type) {
      case "setGames":
        gameIds = msg.gameIds;
        selection = { mode: "manual" };
        publish();
        break;
      case "setTone":
        tone = msg.tone;
        publish();
        break;
      case "setRandom":
        selection = { mode: "random", count: Math.min(msg.count, CATALOG.length) };
        gameIds = [];
        publish();
        break;
      case "chooseAvatar": {
        const taken = players.find((p) => p.avatar === msg.avatar && p.id !== SELF);
        if (taken) break;
        players = players.map((p) => (p.id === SELF ? { ...p, avatar: msg.avatar } : p));
        publish();
        break;
      }
      case "setReady":
        lobbyReady = msg.ready ? [...new Set([...lobbyReady, SELF])] : lobbyReady.filter((id) => id !== SELF);
        publish();
        break;
      case "rename":
        players = players.map((p) => (p.id === SELF ? { ...p, nickname: msg.nickname } : p));
        publish();
        break;
      case "react":
        emitReaction(SELF, msg.emoji);
        break;
      case "kick":
        players = players.filter((p) => p.id !== msg.playerId);
        publish();
        break;
      case "startMatch":
        toBriefing();
        break;
      case "ready":
        readyIds = [...new Set([...readyIds, SELF, ...players.map((p) => p.id)])];
        publish();
        later(toCountdown, 700);
        break;
      case "action": {
        const bots = players.filter((p) => p.id !== SELF);
        const mate = bots[Math.floor(Math.random() * bots.length)];
        later(() => addWindow(Math.random() < 0.65 && mate ? [SELF, mate.id] : [SELF]), 260);
        break;
      }
      case "returnToLobby":
        phase = "lobby";
        players = players.map((p) => ({ ...p, score: 0 }));
        publish();
        break;
      default:
        break;
    }
  });

  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  switch (kind) {
    case "home":
      if (params.get("off") === "1") setState({ conn: "closed", failedAttempts: 2 });
      break;
    case "join":
      setState({ nav: "join", joinCode: "KX7" });
      break;
    case "settings":
      setState({ nav: "settings" });
      break;
    case "notfound":
      setState({ notFoundCode: "ABCDE" });
      break;
    case "reconnect":
      publish();
      setState("conn", "closed");
      break;
    case "briefing":
      toBriefing();
      break;
    case "countdown":
      toCountdown();
      break;
    case "playing":
      toPlaying();
      break;
    case "results":
      toResults();
      break;
    case "final":
      toFinal();
      break;
    default:
      publish();
  }
  // `&emoji=1`: lobide birkaç oyuncudan emoji uçar (ekran denetimi için).
  if (kind === "lobby" && params.get("emoji") === "1") {
    const picks = ["😂", "🔥", "👏", "😱"] as const;
    later(() => {
      players.slice(0, 4).forEach((p, i) => {
        const emoji = picks[i % picks.length];
        if (emoji) emitReaction(p.id, emoji);
      });
    }, 250);
  }
  if (kind === "home" || kind === "join" || kind === "settings" || kind === "notfound")
    setState("session", null);
}
