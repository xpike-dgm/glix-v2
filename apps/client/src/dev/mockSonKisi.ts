/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez). Son Kişi ekranları:
 *   ?mock=sonkisi-briefing      anlatım
 *   ?mock=sonkisi-idle          KAÇ bekliyor (sakin)
 *   ?mock=sonkisi-tense         gerilim 2, iki kişi kaçmış
 *   ?mock=sonkisi-escaped       sen kaçtın, gerilim 3
 *   ?mock=sonkisi-spectator     izleyici
 *   ?mock=sonkisi-reveal        tek son kaçan (+1), kaçmayan var
 *   ?mock=sonkisi-reveal-tie    eşit zaman: iki son kaçan
 *   ?mock=sonkisi-reveal-none   kimse kaçmadı
 * `&n=8` oyuncu sayısını değiştirir.
 */
import type {
  GameInfo,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
  SonKisiPublicView,
  SonKisiResult,
  SonKisiTension,
  SonKisiView,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const GAME: GameInfo = {
  id: "son-kisi",
  name: "Son Kişi",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
};
const BRIEFING = {
  goal: "Alarm çalmadan kaç, ama herkesten geç!",
  steps: [
    "Bitiş zamanı gizli; alarmı bekle",
    "İstediğin anda bir kez KAÇ'a bas",
    "Son kaçan +1 alır, hiç kaçmayan −1 alır",
  ],
};

export function startSonKisiMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
  }));
  const spectating = kind === "sonkisi-spectator";
  const participants = players.map((p) => p.id).filter((id) => !(spectating && id === SELF));
  const now = Date.now();
  const briefing = kind === "sonkisi-briefing";
  const results = kind.startsWith("sonkisi-reveal");
  const phase: RoomPhase = briefing ? "briefing" : results ? "results" : "playing";
  const startedAt = results ? now - 16_000 : now - 8_000;
  const pick = (...ids: string[]) => ids.filter((id) => participants.includes(id));

  let escaped: string[] = [];
  let tension: SonKisiTension = 0;
  if (kind === "sonkisi-tense") {
    escaped = pick("p1", "p3");
    tension = 2;
  } else if (kind === "sonkisi-escaped") {
    escaped = pick("p2", SELF);
    tension = 3;
  } else if (kind === "sonkisi-spectator") {
    escaped = pick("p2");
    tension = 1;
  }
  let selfEscaped = escaped.includes(SELF);

  const result = (): SonKisiResult => {
    if (kind === "sonkisi-reveal-none") {
      return {
        escapes: [],
        last: [],
        missed: [...participants],
        scores: Object.fromEntries(participants.map((id) => [id, -1])),
      };
    }
    const tie = kind === "sonkisi-reveal-tie";
    const ordered = pick("p2", SELF, "p1", "p3");
    const lastIds = tie ? ordered.slice(-2) : ordered.slice(-1);
    const escapes = ordered.map((id, i) => ({
      id,
      ms: lastIds.includes(id) ? 14_300 : 3_000 + i * 2_600,
    }));
    const missed = participants.filter((id) => !ordered.includes(id));
    const scores = Object.fromEntries(
      participants.map((id) => [id, missed.includes(id) ? -1 : lastIds.includes(id) ? 1 : 0]),
    );
    return { escapes, last: lastIds, missed, scores };
  };

  const publish = (): void => {
    const res = results ? result() : null;
    const publicView: SonKisiPublicView = {
      startedAt,
      escaped: res ? res.escapes.map((e) => e.id) : escaped,
      tension: results ? 3 : tension,
      finished: results,
      result: res,
    };
    const view: SonKisiView = { escaped: !spectating && selfEscaped };
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
      result: res ? { miniScores: res.scores, awards: res.scores } : null,
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
    if ((msg.payload as { kind?: unknown }).kind === "escape" && !selfEscaped) {
      selfEscaped = true;
      escaped = [...escaped, SELF];
      publish();
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
}
