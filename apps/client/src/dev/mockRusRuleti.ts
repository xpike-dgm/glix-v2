/**
 * Yalnız geliştirme önizlemesi: Rus Ruleti ekranları (`&n=2..8` oyuncu sayısı).
 *   ?mock=rus-briefing      anlatım
 *   ?mock=rus-hold          silah sende, karar zamanı
 *   ?mock=rus-wait          silah başkasında
 *   ?mock=rus-safe          boş atış sonucu
 *   ?mock=rus-boom          patlama, başkası elendi
 *   ?mock=rus-boom-me       patlama, sen elendin
 *   ?mock=rus-out           elendin, izliyorsun
 *   ?mock=rus-spectator     katılımcı değilsin
 *   ?mock=rus-reveal        oyun bitti, sonuç
 */
import type {
  GameInfo,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
  RusRuletiPublicView,
  RusRuletiView,
} from "@glix/engine";
import { rusRuleti } from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: rusRuleti.id,
  name: rusRuleti.name,
  minPlayers: rusRuleti.minPlayers,
  maxPlayers: rusRuleti.maxPlayers,
  orientation: "portrait",
};

export function startRusRuletiMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(params.get("off") === "1" && i === 2),
    score: 0,
  }));
  const ids = players.map((p) => p.id);
  const spectator = kind === "rus-spectator";
  const participants = ids.filter((id) => !(spectator && id === SELF));
  const now = Date.now();
  const briefing = kind === "rus-briefing";
  const reveal = kind === "rus-reveal";
  const phase: RoomPhase = briefing ? "briefing" : reveal ? "results" : "playing";
  const startedAt = now - 30_000;

  let eliminated: string[] = [];
  let holder = SELF;
  let risk = 36;
  let last: RusRuletiPublicView["last"] = null;
  let open = false;
  let over = false;
  if (kind === "rus-hold") {
    last = { seq: 3, shooter: "p1", target: SELF, auto: false, exploded: false, risk: 26, at: now - 6_000 };
  } else if (kind === "rus-wait") {
    holder = "p2";
    last = { seq: 3, shooter: "p1", target: "p2", auto: false, exploded: false, risk: 26, at: now - 6_000 };
  } else if (kind === "rus-safe") {
    holder = "p3";
    last = { seq: 3, shooter: SELF, target: "p3", auto: false, exploded: false, risk: 36, at: now };
    open = true;
    risk = 46;
  } else if (kind === "rus-boom") {
    eliminated = ["p1"];
    holder = "p2";
    risk = 16;
    last = { seq: 4, shooter: "p2", target: "p1", auto: false, exploded: true, risk: 46, at: now };
    open = true;
  } else if (kind === "rus-boom-me") {
    eliminated = [SELF];
    holder = "p2";
    risk = 16;
    last = { seq: 4, shooter: "p2", target: SELF, auto: true, exploded: true, risk: 46, at: now };
    open = true;
  } else if (kind === "rus-out") {
    eliminated = [SELF];
    holder = "p2";
    risk = 16;
    last = { seq: 4, shooter: "p1", target: SELF, auto: false, exploded: true, risk: 46, at: now - 9_000 };
  } else if (kind === "rus-spectator") {
    eliminated = ["p1"];
    holder = "p2";
    risk = 16;
    last = { seq: 4, shooter: "p3", target: "p1", auto: false, exploded: true, risk: 46, at: now - 9_000 };
  } else if (reveal) {
    over = true;
    eliminated = ids.slice(1, Math.ceil(n / 2) + 1).filter((id) => id !== SELF);
    eliminated = ids.filter((id) => id !== SELF).slice(0, Math.ceil(n / 2));
    last = {
      seq: 7,
      shooter: SELF,
      target: eliminated[eliminated.length - 1] ?? "p1",
      auto: false,
      exploded: true,
      risk: 56,
      at: now - 3_000,
    };
  }
  const alive = ids.filter((id) => !eliminated.includes(id));
  if (!alive.includes(holder)) holder = alive[0] ?? SELF;

  const publish = (): void => {
    const pub: RusRuletiPublicView = {
      startedAt,
      players: ids,
      alive,
      eliminated,
      holder,
      risk,
      shots: last?.seq ?? 0,
      last,
      openAt: open ? now + 600_000 : now - 4_000,
      deadline: over ? null : now + (open ? 618_000 : 11_000),
      over,
      result: over ? { survivors: alive, eliminated } : null,
    };
    const role: RusRuletiView["role"] = spectator ? "spectator" : alive.includes(SELF) ? "alive" : "out";
    const scores = Object.fromEntries(participants.map((id) => [id, alive.includes(id) ? 1 : 0]));
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: rusRuleti.briefing.goal, steps: [...rusRuleti.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds: briefing ? ["p1", "p2"] : [],
      phaseStartedAt: startedAt,
      phaseEndsAt: briefing ? now + 40_000 : reveal ? now + 60_000 : null,
      publicView: briefing ? null : pub,
      view: briefing ? null : { role },
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
      catalog: [INFO],
      match,
    };
    applySnapshot(snapshot);
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    const p = msg.payload as { kind?: string; target?: string } | null;
    if (p?.kind !== "shoot" || holder !== SELF || typeof p.target !== "string") return;
    last = {
      seq: (last?.seq ?? 0) + 1,
      shooter: SELF,
      target: p.target,
      auto: false,
      exploded: false,
      risk,
      at: Date.now(),
    };
    holder = p.target;
    risk += 10;
    open = true;
    publish();
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
}
