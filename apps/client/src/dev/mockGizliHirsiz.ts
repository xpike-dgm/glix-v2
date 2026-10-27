/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez). Gizli Hırsız ekranları:
 *   ?mock=gizli-briefing        anlatım
 *   ?mock=gizli-idle            ÇAL bekliyor
 *   ?mock=gizli-pressed         bastın (parmak izi)
 *   ?mock=gizli-spectator       izleyici
 *   ?mock=gizli-reveal-solo     tek hırsız (+1)
 *   ?mock=gizli-reveal-multi    birden çok hırsız (−1)
 *   ?mock=gizli-reveal-none     kimse basmadı
 * `&n=8` oyuncu sayısını değiştirir.
 */
import type {
  GameInfo,
  GizliHirsizPublicView,
  GizliHirsizReveal,
  GizliHirsizView,
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
  id: "gizli-hirsiz",
  name: "Gizli Hırsız",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
};
const BRIEFING = {
  goal: "Kasayı yalnız bir kişi soyabilir!",
  steps: [
    "Doğru anı bekle, ÇAL'a yalnız bir kez bas",
    "Kimin bastığı süre bitene kadar belli olmaz",
    "Tek hırsız +1 alır, birden çok hırsız −1 alır",
  ],
};

export function startGizliHirsizMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
  }));
  const spectating = kind === "gizli-spectator";
  const participants = players.map((p) => p.id).filter((id) => !(spectating && id === SELF));
  const now = Date.now();
  const briefing = kind === "gizli-briefing";
  const results = kind.startsWith("gizli-reveal");
  const phase: RoomPhase = briefing ? "briefing" : results ? "results" : "playing";
  const startedAt = results ? now - 30_500 : now - 11_000;

  let pressed = kind === "gizli-pressed";
  const thieves =
    kind === "gizli-reveal-solo"
      ? ["p2"]
      : kind === "gizli-reveal-multi"
        ? ["p1", SELF, "p3"].filter((id) => participants.includes(id))
        : [];
  const outcome: GizliHirsizReveal["outcome"] =
    thieves.length === 1 ? "solo" : thieves.length > 1 ? "multi" : "none";
  const delta = outcome === "solo" ? 1 : -1;
  const scores = Object.fromEntries(participants.map((id) => [id, thieves.includes(id) ? delta : 0]));

  const publish = (): void => {
    const publicView: GizliHirsizPublicView = {
      startedAt,
      endsAt: startedAt + 30_000,
      finished: results,
      reveal: results ? { thieves, outcome, scores } : null,
    };
    const view: GizliHirsizView = { pressed: !spectating && pressed };
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: GAME.id,
      gameName: GAME.name,
      briefing: BRIEFING,
      orientation: "portrait",
      participants,
      readyIds: briefing ? ["p1", "p2"] : [],
      phaseStartedAt: startedAt,
      phaseEndsAt: briefing ? now + 40_000 : results ? now + 60_000 : null,
      publicView: briefing ? null : publicView,
      view: briefing ? null : view,
      result: results ? { miniScores: scores, awards: scores } : null,
    };
    const snapshot: RoomSnapshot = {
      rev: Math.floor(Date.now() / 1000) + 1,
      serverNow: Date.now(),
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
      phase,
      players,
      gameIds: [GAME.id],
      selection: { mode: "manual" },
      tone: "arkadas",
      lobbyReady: [],
      catalog: [GAME],
      match,
    };
    applySnapshot(snapshot);
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    if ((msg.payload as { kind?: unknown }).kind === "steal") {
      pressed = true;
      publish();
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
}
