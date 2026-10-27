/**
 * Yalnız geliştirme önizlemesi: Açgözlülük Limiti ekranları (`&n=3..8` oyuncu sayısı).
 *   ?mock=acgozluluk-briefing        anlatım
 *   ?mock=acgozluluk-choosing        seçim; sayıya dokununca seçim değişir (`&chosen=0` ile seçimsiz başlar)
 *   ?mock=acgozluluk-locked         seçimin kilitli, diğerleri bekleniyor (`&n=`)
 *   ?mock=acgozluluk-reveal-ok       seçimler açıldı, limit altında (altın ışık)
 *   ?mock=acgozluluk-reveal-over     seçimler açıldı, limit aşıldı (kırmızı çatlak)
 *   ?mock=acgozluluk-spectator       katılımcı değilsin
 */
import {
  ACGOZLULUK_CHOOSE_MS,
  ACGOZLULUK_DURATION_MS,
  type AcgozlulukPublicView,
  type AcgozlulukView,
  acgozlulukLimit,
  acgozlulukLimiti,
  type GameInfo,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: acgozlulukLimiti.id,
  name: acgozlulukLimiti.name,
  minPlayers: acgozlulukLimiti.minPlayers,
  maxPlayers: acgozlulukLimiti.maxPlayers,
  orientation: "portrait",
};

export function startAcgozlulukMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
    spectator: false,
  }));
  const spectator = kind.endsWith("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const limit = acgozlulukLimit(participants.length);
  const count = participants.length;
  const now = Date.now();

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  // `&open=1`: aşama şimdi başladı (açılış sahnesi oynar).
  let startedAt = params.has("open") ? now - 100 : now - 8_000;
  let myChoice: number | null = params.get("chosen") === "0" ? null : Math.min(count, 2);
  let locked = kind === "acgozluluk-locked";
  let rev = 1;

  // Sahte seçimler: limit altı ya da üstü.
  const reveal = (over: boolean) => {
    const choices: Record<string, number> = {};
    const base = over ? count : Math.max(1, Math.floor(limit / count) - 1);
    participants.forEach((id, i) => {
      choices[id] = Math.max(0, Math.min(count, id === SELF ? Math.min(count, 2) : base - (i % 2)));
    });
    if (over) for (const id of participants) choices[id] = Math.max(choices[id] ?? 0, count - 1);
    const total = Object.values(choices).reduce((a, b) => a + b, 0);
    return { choices, total, over: total > limit };
  };

  const build = (): { pub: AcgozlulukPublicView; priv: AcgozlulukView } => {
    const revealed = kind.startsWith("acgozluluk-reveal");
    if (revealed) startedAt = now - ACGOZLULUK_CHOOSE_MS - 400;
    return {
      pub: {
        startedAt,
        endsAt: startedAt + ACGOZLULUK_CHOOSE_MS,
        revealEndsAt: startedAt + ACGOZLULUK_DURATION_MS,
        limit,
        maxChoice: count,
        reveal: revealed ? reveal(kind.endsWith("over")) : null,
        lockedIds: spectator
          ? participants.slice(0, Math.ceil(count / 2))
          : [...(locked ? [SELF] : []), ...participants.slice(1, Math.max(1, Math.ceil(count / 2) - 1))],
      },
      priv: { myChoice: spectator ? null : myChoice, locked: !spectator && locked },
    };
  };

  const snapshot = (): RoomSnapshot => {
    if (kind === "acgozluluk-briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = now + 40_000;
    }
    const { pub, priv } = build();
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: acgozlulukLimiti.briefing.goal, steps: [...acgozlulukLimiti.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      continueIds: [],
      phaseStartedAt: startedAt,
      phaseEndsAt,
      publicView: pub,
      view: priv,
      result: null,
    };
    return {
      rev: ++rev,
      serverNow: Date.now(),
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
      phase,
      players,
      gameIds: [INFO.id],
      selection: { mode: "manual" },
      tone: "arkadas",
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
      catalog: [INFO],
      match,
    };
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    const payload = msg.payload as { kind?: string; value?: number } | null;
    if (payload?.kind === "lock" && myChoice !== null) {
      locked = true;
      applySnapshot(snapshot());
    }
    if (payload?.kind === "choose" && typeof payload.value === "number" && !locked) {
      myChoice = payload.value;
      applySnapshot(snapshot());
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
