/**
 * Yalnız geliştirme önizlemesi: Ortalamaya En Yakın ekranları (`&n=3..8` oyuncu sayısı).
 *   ?mock=ortalama-briefing          anlatım
 *   ?mock=ortalama-choosing          seçim; sayı seçici çalışır (`&chosen=0` ile seçimsiz başlar)
 *   ?mock=ortalama-locked            sayın kilitli, diğerleri bekleniyor
 *   ?mock=ortalama-reveal            sonuç: en yakın +2, ikinci +1 (`&me=2` ile hangi oyuncu "sen" olur)
 *   ?mock=ortalama-reveal-tie        sonuç: en yakınlar eşit, herkes +1
 *   ?mock=ortalama-reveal-late       sonuç animasyonu bitmeye yakın (geç açılan ekran)
 *   ?mock=ortalama-spectator         katılımcı değilsin
 *   ?mock=ortalama-choosing&tur=2    2. tur seçimi: ⅔ çarpanı, önceki turun ortalaması ve hedefi görünür (`tur=3`: ¾)
 *   ?mock=ortalama-reveal&tur=2      2. turun sonucu (ara tur; toplam puan görünür)
 *   ?mock=ortalama-reveal&tur=3      son tur sonucu: genel skora eklenen puan (3 turun toplamından)
 */

import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import {
  createRng,
  ORTALAMA_CHOOSE_MS,
  ORTALAMA_REVEAL_MS,
  ORTALAMA_ROUND_REVEAL_MS,
  ORTALAMA_ROUNDS,
  type OrtalamaPublicView,
  type OrtalamaState,
  type OrtalamaView,
  ortalamaninYarisi,
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
    spectator: false,
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
  // `&tur=1|2|3`: gösterilen tur. Turun başlangıcı tur sürelerinden (10 sn seçim + 5 sn sonuç; son turda 7 sn) türetilir.
  const roundNo = Math.min(3, Math.max(1, Number(params.get("tur")) || 1));
  const roundIdx = roundNo - 1;
  const roundStart = (r: number): number => r * (ORTALAMA_CHOOSE_MS + ORTALAMA_ROUND_REVEAL_MS);
  const roundEnd = (r: number): number => roundStart(r) + ORTALAMA_CHOOSE_MS;
  const roundRevealEnd = (r: number): number =>
    roundEnd(r) + (r === ORTALAMA_ROUNDS - 1 ? ORTALAMA_REVEAL_MS : ORTALAMA_ROUND_REVEAL_MS);
  // Oyunun başlangıcı: gösterilen turun seçim bitişinden geriye sayılır.
  const sinceEnd = revealed ? (late ? 4_500 : 300) : -(ORTALAMA_CHOOSE_MS - 6_000);
  const startedAt = now - roundEnd(roundIdx) - sinceEnd;

  // Tur başına örnek seçimler: sonuçlar farklı olsun ve toplamda sıralama görünsün.
  const ROUND_VALUES = [
    kind.includes("tie") ? TIED : SPREAD,
    [60, 12, 48, 70, 25, 33, 90, 41],
    [18, 52, 30, 44, 8, 66, 27, 59],
  ];

  const stateFor = (r: number): OrtalamaState => {
    const rounds = Array.from({ length: ORTALAMA_ROUNDS }, (_, k) => ({
      startAt: startedAt + roundStart(k),
      endsAt: startedAt + roundEnd(k),
      revealEndsAt: startedAt + roundRevealEnd(k),
      choices: {} as Record<string, number>,
      locked: [] as string[],
      fallback: {} as Record<string, number>,
    }));
    for (let k = 0; k <= r; k++) {
      const v = ROUND_VALUES[k] ?? SPREAD;
      const c: Record<string, number> = {};
      participants.forEach((id, i) => {
        c[id] = v[i] ?? 50;
      });
      const slot = rounds[k];
      if (slot) slot.choices = c;
    }
    return { players: participants, startedAt, rounds, revealed: r + 1, shown: r };
  };

  const build = (): { pub: OrtalamaPublicView; priv: OrtalamaView } => {
    const st = stateFor(roundIdx);
    const ctxNow = revealed ? startedAt + roundEnd(roundIdx) + 1 : startedAt + roundStart(roundIdx) + 1;
    const pub = ortalamaninYarisi.publicView(st, { now: ctxNow, rng: createRng(1), connected: [] });
    return {
      pub: {
        ...pub,
        lockedIds: [
          ...(locked && !spectator ? [SELF] : []),
          ...participants.filter((id, i) => id !== SELF && i % 2 === 1 && (locked || spectator)),
        ],
      },
      priv: { myChoice: spectator ? null : myChoice, locked: !spectator && locked },
    };
  };

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
