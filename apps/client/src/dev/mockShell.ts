/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez; App.tsx `import.meta.env.DEV` ile korur).
 * Çerçeve ve izleyici ekranlarını `dev/mock.ts`'ten bağımsız sahte verilerle açar:
 *   ?mock=landscape            yatay yer tutucu sahne (`&n=6`, `&spectator=1`)
 *   ?mock=briefing-ready       anlatım, Hazırım basılmış, bir oyuncu bekleniyor
 *   ?mock=spectator-briefing   anlatım, katılımcı değilsin
 *   ?mock=spectator-playing    Butona Bas, katılımcı değilsin
 */
import type {
  ButonaBasPublicView,
  ButonaBasView,
  GameInfo,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";

const CATALOG: GameInfo[] = [
  { id: "butona-bas", name: "Butona Bas", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  { id: "yatay-masa", name: "Neon Masa", minPlayers: 2, maxPlayers: 8, orientation: "landscape" },
];

const BRIEFING = {
  goal: "Aynı anda büyük kırmızı butona basarak eşleşme yakala.",
  steps: [
    "Büyük kırmızı butonu hazırla.",
    "Aynı kısa zamanda arkadaşlarınla bas.",
    "Grup basışı puan verir, tek basış geri teper.",
  ],
};

export function startShellMock(kind: string, params: URLSearchParams): void {
  const fallbackN = kind === "landscape" ? 6 : 5;
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || fallbackN));
  const roster: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
    spectator: false,
  }));
  const watching = kind.startsWith("spectator") || params.has("spectator");
  const players: PlayerInfo[] = roster.map((p) => ({ ...p, spectator: watching && p.id === SELF }));
  const participants = players.map((p) => p.id).filter((id) => !(watching && id === SELF));
  const now = Date.now();

  let phase: RoomPhase = "playing";
  let game: GameInfo = CATALOG[0] as GameInfo;
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let publicView: unknown = null;
  let view: unknown = null;
  const phaseStartedAt = now - 14_000;

  const scores = Object.fromEntries(
    players
      .map((p, i) => [p.id, [4, 5, 3, 1, 0, 2, 3, 1][i] ?? 0] as const)
      .filter(([id]) => participants.includes(id)),
  );

  switch (kind) {
    case "briefing-ready":
      phase = "briefing";
      readyIds = participants.slice(0, -1);
      phaseEndsAt = now + 40_000;
      break;
    case "spectator-briefing":
      phase = "briefing";
      readyIds = ["p1"];
      phaseEndsAt = now + 40_000;
      break;
    case "spectator-playing": {
      const pub: ButonaBasPublicView = {
        startedAt: phaseStartedAt,
        endsAt: phaseStartedAt + 45_000,
        windowMs: 300,
        scores,
        recent: [
          { index: 40, pressers: ["p1", "p2"], outcome: "match" },
          { index: 41, pressers: ["p3"], outcome: "solo" },
        ],
      };
      const mine: ButonaBasView = { myScore: null, pressedThisWindow: false };
      publicView = pub;
      view = mine;
      break;
    }
    default:
      game = CATALOG[1] as GameInfo;
      publicView = { startedAt: phaseStartedAt, endsAt: phaseStartedAt + 45_000, scores };
  }

  const match: MatchSnapshot = {
    round: 0,
    total: 3,
    gameId: game.id,
    gameName: game.name,
    briefing: BRIEFING,
    orientation: game.orientation,
    participants,
    readyIds,
    phaseStartedAt,
    phaseEndsAt,
    publicView,
    view,
    result: null,
  };
  const snapshot: RoomSnapshot = {
    rev: 2,
    serverNow: now,
    code: "KX7QP",
    hostId: SELF,
    selfId: SELF,
    phase,
    players,
    gameIds: [game.id],
    selection: { mode: "manual" },
    tone: "arkadas",
    joinPolicy: "izleyici",
    lobbyReady: [],
    catalog: CATALOG,
    match,
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender(() => {});
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot);
}
