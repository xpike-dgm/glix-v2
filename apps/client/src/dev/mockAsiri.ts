/**
 * Yalnız geliştirme önizlemesi: Aşırı Yükleme ekranları (`&n=2..8` oyuncu sayısı).
 *   ?mock=asiri-yukleme-briefing     anlatım
 *   ?mock=asiri-yukleme-playing      tıklama sahnesi (dokununca kıvılcım)
 *   ?mock=asiri-yukleme-danger       bar 100'de: kenarlar kırmızı
 *   ?mock=asiri-yukleme-reveal-boom  sonuç, patlama (`&me=1` patlayan sensin)
 *   ?mock=asiri-yukleme-reveal-safe  sonuç, patlama yok
 *   ?mock=asiri-yukleme-spectator    katılımcı değilsin
 */
import {
  type AsiriYuklemePublicView,
  type AsiriYuklemeView,
  asiriYukleme,
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
    const clicks: Record<string, number> = {};
    const base = [34, 27, 19, 12, 9, 6, 4, 2];
    participants.forEach((id, i) => {
      clicks[id] = base[i] ?? 1;
    });
    // Patlayan: `&me=1` ise sen, değilse listedeki ikinci oyuncu.
    const exploder = boom ? (params.get("me") === "1" ? SELF : (participants[1] ?? null)) : null;
    if (exploder) clicks[exploder] = (clicks[exploder] ?? 0) + 1;
    const total = Object.values(clicks).reduce((a, b) => a + b, 0);
    return {
      total: boom ? 101 : total,
      exploder,
      clicks,
      points: asiriYuklemePoints(participants, clicks, exploder),
    };
  };

  const snapshot = (): RoomSnapshot => {
    if (kind === "asiri-yukleme-briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = now + 40_000;
    }
    const pub: AsiriYuklemePublicView = {
      startedAt,
      danger: kind.endsWith("danger") || revealed,
      reveal: revealed ? buildReveal() : null,
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
      tone: "arkadas",
      joinPolicy: "izleyici",
      lobbyReady: [],
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
}
