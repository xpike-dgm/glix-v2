/**
 * Yalnız geliştirme önizlemesi: Kör Kronometre ekranları (`&n=2..8` oyuncu sayısı).
 *   ?mock=kor-kronometre-briefing    anlatım
 *   ?mock=kor-kronometre-counting    sayma; BAS'a basınca kadran donar
 *   ?mock=kor-kronometre-pressed     basıldı, diğerleri bekleniyor
 *   ?mock=kor-kronometre-reveal      sonuç (`&rank=1|2|3` kendi derecen, `&nopress=1` basmayanlar)
 *   `&target=7..13` hedef saniye (varsayılan 11)
 *   ?mock=kor-kronometre-spectator   katılımcı değilsin
 */
import {
  type GameInfo,
  KOR_KRONOMETRE_REVEAL_MS,
  type KorKronometreEntry,
  type KorKronometrePublicView,
  type KorKronometreView,
  korKronometre,
  korKronometreDurationMs,
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
  id: korKronometre.id,
  name: korKronometre.name,
  minPlayers: korKronometre.minPlayers,
  maxPlayers: korKronometre.maxPlayers,
  orientation: "portrait",
};

/** Sahte basışlar: kendi sıran `rank` ile belirlenir (1 = en yakın). */
function fakeEntries(ids: string[], rank: number, nopress: boolean, targetMs: number): KorKronometreEntry[] {
  const offsets = [-150, 420, -900, 1_800, -2_600, 3_900, -5_000, 7_000];
  const mineAt = Math.min(ids.length, Math.max(1, rank)) - 1;
  const others = ids.filter((id) => id !== SELF);
  const order: string[] = [];
  for (let s = 0, o = 0; s < ids.length; s++) order.push(s === mineAt ? SELF : (others[o++] as string));
  const rows = order.map((playerId, s) => ({ playerId, s, missed: nopress && s >= ids.length - 2 }));
  const pressedRows = rows.filter((r) => !r.missed);
  return [
    ...pressedRows.map((r, i): KorKronometreEntry => {
      const ms = targetMs + (offsets[r.s] ?? 7_000);
      return {
        playerId: r.playerId,
        ms,
        pressed: true,
        distance: Math.abs(ms - targetMs),
        rank: i + 1,
        points: i === 0 ? 2 : i === 1 ? 1 : 0,
      };
    }),
    ...rows
      .filter((r) => r.missed)
      .map(
        (r): KorKronometreEntry => ({
          playerId: r.playerId,
          ms: null,
          pressed: false,
          distance: null,
          rank: null,
          points: 0,
        }),
      ),
  ];
}

export function startKronometreMock(kind: string, params: URLSearchParams): void {
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
  let pressed = kind.endsWith("pressed");
  let rev = 1;
  const revealed = kind.endsWith("reveal") || kind.endsWith("spectator-reveal");
  const targetSeconds = Math.min(13, Math.max(7, Number(params.get("target")) || 11));
  const targetMs = targetSeconds * 1_000;
  const duration = korKronometreDurationMs(targetMs);
  const startedAt = revealed ? now - duration - 300 : now - 4_000;

  const snapshot = (): RoomSnapshot => {
    if (kind === "kor-kronometre-briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = now + 40_000;
    }
    const pub: KorKronometrePublicView = {
      startedAt,
      targetMs,
      endsAt: startedAt + duration,
      revealEndsAt: startedAt + duration + KOR_KRONOMETRE_REVEAL_MS,
      reveal: revealed
        ? {
            entries: fakeEntries(
              participants,
              Number(params.get("rank")) || 1,
              params.get("nopress") === "1",
              targetMs,
            ),
          }
        : null,
    };
    const priv: KorKronometreView = { pressed: !spectator && pressed };
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: korKronometre.briefing.goal, steps: [...korKronometre.briefing.steps] },
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
    if ((msg.payload as { kind?: string } | null)?.kind === "press") {
      pressed = true;
      applySnapshot(snapshot());
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
