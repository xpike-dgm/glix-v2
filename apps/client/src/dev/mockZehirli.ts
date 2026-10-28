/**
 * Yalnız geliştirme önizlemesi: Zehirli Kadeh ekranları (`&n=2..8` oyuncu sayısı).
 *   ?mock=zehirli-briefing    anlatım
 *   ?mock=zehirli-play        takas hakkın duruyor
 *   ?mock=zehirli-used        takasını yaptın, geçmiş görünüyor
 *   ?mock=zehirli-spectator   katılımcı değilsin
 *   ?mock=zehirli-reveal      sonuç (sen temiz kadehli); `&poison=1` sen zehirli
 */
import type {
  GameInfo,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
  ZehirliKadehPublicView,
} from "@glix/engine";
import { zehirliKadeh, zehirliKadehPoisonCount } from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: zehirliKadeh.id,
  name: zehirliKadeh.name,
  minPlayers: zehirliKadeh.minPlayers,
  maxPlayers: zehirliKadeh.maxPlayers,
  orientation: "portrait",
};

export function startZehirliMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
    spectator: false,
  }));
  const ids = players.map((p) => p.id);
  const spectator = kind === "zehirli-spectator";
  const participants = ids.filter((id) => !(spectator && id === SELF));
  let now = Date.now();
  const briefing = kind === "zehirli-briefing";
  const reveal = kind === "zehirli-reveal";
  const phase: RoomPhase = briefing ? "briefing" : reveal ? "results" : "playing";
  let startedAt = now - 7_000;

  const holdings: Record<string, number> = Object.fromEntries(ids.map((id, i) => [id, i]));
  let swaps: ZehirliKadehPublicView["swaps"] = [];
  let swapped: string[] = [];
  const swap = (from: string, to: string, at: number): void => {
    const a = holdings[from] as number;
    holdings[from] = holdings[to] as number;
    holdings[to] = a;
    swaps = [...swaps, { seq: swaps.length + 1, from, to, at }];
    swapped = [...swapped, from];
  };
  if (kind === "zehirli-used" || kind === "zehirli-spectator" || reveal) {
    swap(SELF === ids[0] && !spectator ? SELF : "p1", "p2", now - 4_000);
    if (n > 3) swap("p3", "p1", now - 2_000);
  }
  const poisonedCups =
    params.get("poison") === "1"
      ? ids.slice(0, zehirliKadehPoisonCount(n)).map((_, i) => i)
      : ids.map((_, i) => i).slice(n - zehirliKadehPoisonCount(n));

  const publish = (): void => {
    const endsAt = startedAt + 20_000 + swaps.length * 5_000;
    const poisoned = ids.filter((id) => poisonedCups.includes(holdings[id] as number));
    const pub: ZehirliKadehPublicView = {
      startedAt: reveal ? now - 40_000 : startedAt,
      endsAt: reveal ? now - 10_000 : endsAt + 8_000,
      players: ids,
      holdings,
      swapped,
      swaps,
      poisonCount: poisonedCups.length,
      ended: reveal,
      result: reveal ? { clean: ids.filter((id) => !poisoned.includes(id)), poisoned, poisonedCups } : null,
    };
    const scores = Object.fromEntries(participants.map((id) => [id, poisoned.includes(id) ? 0 : 1]));
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: zehirliKadeh.briefing.goal, steps: [...zehirliKadeh.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds: briefing ? ["p1", "p2"] : [],
      continueIds: [],
      phaseStartedAt: startedAt,
      phaseEndsAt: briefing ? now + 40_000 : reveal ? now + 60_000 : null,
      publicView: briefing ? null : pub,
      view: briefing ? null : { role: spectator ? "spectator" : "player" },
      result: reveal ? { miniScores: scores, awards: scores } : null,
    };
    const snapshot: RoomSnapshot = {
      rev: Math.floor(Date.now() / 1000) + 1,
      serverNow: Date.now(),
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
      phase,
      players,
      gameIds: [INFO.id],
      selection: { mode: "manual" },
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
      catalog: [INFO],
      match,
    };
    applySnapshot(snapshot);
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    const p = msg.payload as { kind?: string; target?: string } | null;
    if (p?.kind !== "swap" || typeof p.target !== "string" || swapped.includes(SELF)) return;
    swap(SELF, p.target, Date.now());
    publish();
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
  // Süre ekranı sabit kalsın: önizleme açık kaldığı sürece zaman damgaları tazelenir.
  if (!reveal && !briefing) {
    setInterval(() => {
      now = Date.now();
      startedAt = now - 7_000;
      publish();
    }, 3_000);
  }
}
