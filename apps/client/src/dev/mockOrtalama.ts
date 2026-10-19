/**
 * Yalnız geliştirme önizlemesi: Ortalamaya En Yakın ekranları (`&n=3..8` oyuncu sayısı).
 *   ?mock=ortalama-briefing          anlatım
 *   ?mock=ortalama-choosing          seçim; sayı seçici çalışır (`&chosen=0` ile seçimsiz başlar)
 *   ?mock=ortalama-locked            sayın kilitli, diğerleri bekleniyor
 *   ?mock=ortalama-reveal            sonuç: en yakın +2, ikinci +1 (`&me=2` ile hangi oyuncu "sen" olur)
 *   ?mock=ortalama-reveal-tie        sonuç: en yakınlar eşit, herkes +1
 *   ?mock=ortalama-reveal-late       sonuç animasyonu bitmeye yakın (geç açılan ekran)
 *   ?mock=ortalama-spectator         katılımcı değilsin
 */

import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import {
  ORTALAMA_CHOOSE_MS,
  ORTALAMA_DURATION_MS,
  type OrtalamaPublicView,
  type OrtalamaView,
  ortalamaninYarisi,
  ortalamaSettle,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: ortalamaninYarisi.id,
  name: ortalamaninYarisi.name,
  minPlayers: ortalamaninYarisi.minPlayers,
  maxPlayers: ortalamaninYarisi.maxPlayers,
  orientation: "portrait",
};
const SPREAD = [22, 31, 64, 18, 47, 9, 80, 35];
const TIED = [40, 40, 40, 40, 40, 40, 40, 40];

export function startOrtalamaMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
  }));
  const spectator = kind.endsWith("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const now = Date.now();
  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let myChoice: number | null = params.get("chosen") === "0" ? null : 30;
  let locked = kind === "ortalama-locked";
  let rev = 1;
  const revealed = kind.startsWith("ortalama-reveal");
  const late = kind.endsWith("late");
  const startedAt = revealed ? now - ORTALAMA_CHOOSE_MS - (late ? 4_500 : 300) : now - 6_000;

  const reveal = () => {
    const values = kind.includes("tie") ? TIED : SPREAD;
    const choices: Record<string, number> = {};
    participants.forEach((id, i) => {
      choices[id] = values[i] ?? 50;
    });
    return ortalamaSettle({
      players: participants,
      startedAt,
      endsAt: startedAt + ORTALAMA_CHOOSE_MS,
      revealEndsAt: startedAt + ORTALAMA_DURATION_MS,
      choices,
      locked: [],
      fallback: {},
      revealed: true,
    });
  };

  const build = (): { pub: OrtalamaPublicView; priv: OrtalamaView } => ({
    pub: {
      startedAt,
      endsAt: startedAt + ORTALAMA_CHOOSE_MS,
      revealEndsAt: startedAt + ORTALAMA_DURATION_MS,
      reveal: revealed ? reveal() : null,
      lockedIds: [
        ...(locked && !spectator ? [SELF] : []),
        ...participants.filter((id, i) => id !== SELF && i % 2 === 1 && (locked || spectator)),
      ],
    },
    priv: { myChoice: spectator ? null : myChoice, locked: !spectator && locked },
  });

  const snapshot = (): RoomSnapshot => {
    if (kind === "ortalama-briefing") {
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
      briefing: { goal: ortalamaninYarisi.briefing.goal, steps: [...ortalamaninYarisi.briefing.steps] },
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
