/**
 * Yalnız geliştirme önizlemesi: Çizgiyi Geçme ekranları (`&n=2..8` oyuncu sayısı).
 *   ?mock=cizgi-briefing          anlatım
 *   ?mock=cizgi-choosing          seçim; sayı seçici çalışır (`&chosen=0` ile seçimsiz başlar)
 *   ?mock=cizgi-locked            pinin kilitli, diğerleri bekleniyor
 *   ?mock=cizgi-reveal            sonuç: çarpışma, +2 ve +1 (`&n=` ile oyuncu sayısı)
 *   ?mock=cizgi-reveal-crowd      sonuç: herkes aynı platformda (kimse puan almaz)
 *   ?mock=cizgi-reveal-passive    sonuç: seçmeyenler pasif
 *   ?mock=cizgi-spectator         katılımcı değilsin
 */
import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import {
  CIZGI_CHOOSE_MS,
  CIZGI_DURATION_MS,
  type CizgiPublicView,
  type CizgiView,
  cizgiSettle,
  cizgiyiGecme,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: cizgiyiGecme.id,
  name: cizgiyiGecme.name,
  minPlayers: cizgiyiGecme.minPlayers,
  maxPlayers: cizgiyiGecme.maxPlayers,
  orientation: "portrait",
};
// p0 (sen) 72 ile tek kalır; p1 ve p2 aynı bölgede çarpışır; p3 ikinci.
const SPREAD: (number | null)[] = [72, 95, 91, 38, 12, 100, 15, null];
const CROWD: (number | null)[] = [42, 45, 41, 48, 40, 44, 47, 43];

export function startCizgiMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
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
  const now = Date.now();
  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let myChoice: number | null = params.get("chosen") === "0" ? null : 50;
  let locked = kind === "cizgi-locked";
  let rev = 1;
  const revealed = kind.startsWith("cizgi-reveal");
  const startedAt = revealed ? now - CIZGI_CHOOSE_MS - 300 : now - 8_000;

  const reveal = () => {
    const values = kind.includes("crowd") ? CROWD : SPREAD;
    const choices: Record<string, number> = {};
    participants.forEach((id, i) => {
      const v = kind.includes("passive") && i >= 3 ? null : values[i];
      if (v !== null && v !== undefined) choices[id] = v;
    });
    return cizgiSettle({
      players: participants,
      startedAt,
      endsAt: startedAt + CIZGI_CHOOSE_MS,
      revealEndsAt: startedAt + CIZGI_DURATION_MS,
      choices,
      locked: [],
      revealed: true,
    });
  };

  const build = (): { pub: CizgiPublicView; priv: CizgiView } => ({
    pub: {
      startedAt,
      endsAt: startedAt + CIZGI_CHOOSE_MS,
      revealEndsAt: startedAt + CIZGI_DURATION_MS,
      reveal: revealed ? reveal() : null,
      lockedIds: [
        ...(locked && !spectator ? [SELF] : []),
        ...participants.filter((id, i) => id !== SELF && i % 2 === 1 && (locked || spectator)),
      ],
    },
    priv: { myChoice: spectator ? null : myChoice, locked: !spectator && locked },
  });

  const snapshot = (): RoomSnapshot => {
    if (kind === "cizgi-briefing") {
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
      briefing: { goal: cizgiyiGecme.briefing.goal, steps: [...cizgiyiGecme.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
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
