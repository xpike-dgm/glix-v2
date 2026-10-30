/**
 * Yalnız geliştirme önizlemesi: Aşırı Yükleme ekranları (`&n=2..8` oyuncu sayısı).
 *   ?mock=asiri-yukleme-briefing     anlatım
 *   ?mock=asiri-yukleme-playing      tıklama sahnesi (dokununca kıvılcım)
 *   ?mock=asiri-yukleme-danger       bar 100'de: kenarlar kırmızı
 *   ?mock=asiri-yukleme-reveal-boom  sonuç, patlama (`&me=1` patlayan sensin; `&multi=1` iki kişi patlar,
 *                                    100'den sonra en çok basan −2)
 *   ?mock=asiri-yukleme-reveal-safe  sonuç, patlama yok
 *   Sonuç mock'larında `&anim=1`: önce oyun sahnesi, kısa süre sonra sonuç gelir (sıralı açılış oynar).
 *   ?mock=asiri-yukleme-spectator    katılımcı değilsin
 */
import {
  type AsiriYuklemePublicView,
  type AsiriYuklemeView,
  asiriYukleme,
  asiriYuklemeExploders,
  asiriYuklemePoints,
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
  id: asiriYukleme.id,
  name: asiriYukleme.name,
  minPlayers: asiriYukleme.minPlayers,
  maxPlayers: asiriYukleme.maxPlayers,
  orientation: "portrait",
};

export function startAsiriMock(kind: string, params: URLSearchParams): void {
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
  const startedAt = now - 20_000;

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let rev = 1;

  const boom = kind.endsWith("reveal-boom");
  const safe = kind.endsWith("reveal-safe");
  const revealed = boom || safe;

  const buildReveal = () => {
    const before: Record<string, number> = {};
    const after: Record<string, number> = {};
    const base = [30, 22, 16, 11, 8, 6, 4, 3]; // 8 oyuncuda tam 100
    participants.forEach((id, i) => {
      before[id] = base[i] ?? 1;
      after[id] = 0;
    });
    // Bar doldu: 100'e kadarki tıklamalar toplamı tam 100 olsun (eksik kısım ilk oyuncuya yazılır).
    const lead = participants[0];
    const sum = Object.values(before).reduce((a, b) => a + b, 0);
    if (lead && sum < 100) before[lead] = (before[lead] ?? 0) + 100 - sum;
    // Patlayan: `&me=1` ise sen, değilse listedeki ikinci oyuncu; `&multi=1` ile sonuncu oyuncu da (en çok basan).
    if (boom) {
      const first = params.get("me") === "1" ? SELF : participants[1];
      if (first) after[first] = 1;
      const last = participants[participants.length - 1];
      if (params.get("multi") === "1" && last && last !== first) after[last] = 3;
    }
    const total = [...Object.values(before), ...Object.values(after)].reduce((a, b) => a + b, 0);
    return {
      total,
      before,
      after,
      exploders: asiriYuklemeExploders(participants, after),
      points: asiriYuklemePoints(participants, before, after),
    };
  };

  // `&anim=1`: sonuç ilk anda değil, oyun sahnesinden sonra gelir (gerçek akıştaki gibi açılış oynar).
  let showReveal = revealed && params.get("anim") !== "1";

  const snapshot = (): RoomSnapshot => {
    if (kind === "asiri-yukleme-briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = now + 40_000;
    }
    const pub: AsiriYuklemePublicView = {
      startedAt,
      danger: kind.endsWith("danger") || revealed,
      reveal: showReveal ? buildReveal() : null,
    };
    const priv: AsiriYuklemeView = { participant: !spectator };
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: asiriYukleme.briefing.goal, steps: [...asiriYukleme.briefing.steps] },
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
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
      catalog: [INFO],
      match,
    };
  };

  // Gönderilen toplu tıklama mesajları sayılır; sayfa üzerinde `window.__sent` ile okunur (denetim için).
  const sent = { messages: 0, taps: 0 };
  (window as unknown as { __sent: typeof sent }).__sent = sent;
  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    const payload = msg.payload as { kind?: string; count?: number } | null;
    if (payload?.kind === "tap") {
      sent.messages += 1;
      sent.taps += payload.count ?? 1;
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
  if (revealed && !showReveal) {
    setTimeout(() => {
      showReveal = true;
      applySnapshot(snapshot());
    }, 1_200);
  }
}
