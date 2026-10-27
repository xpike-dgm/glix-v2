/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez; App.tsx `import.meta.env.DEV` ile korur).
 * Çapraz Ateş ekranlarını sahte verilerle açar (`&n=8` oyuncu sayısı):
 *   ?mock=capraz-briefing    anlatım
 *   ?mock=capraz-ates        hedef seçme (dokununca kilitlenir)
 *   ?mock=capraz-locked      hedef seçilmiş
 *   ?mock=capraz-tamam      hedefin kilitli, diğerleri bekleniyor
 *   ?mock=capraz-closed      süre doldu, hedefler açılıyor
 *   ?mock=capraz-reveal      hedefler açıldı: izler, çarpışma, puan etiketleri
 *   ?mock=capraz-spectator   katılımcı değilsin (hedef seçme)
 *   ?mock=capraz-spectator-reveal
 */
import type { CaprazAtesPublicView, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import { CAPRAZ_ATES_FIRE_MS, caprazAtes, caprazAtesReveal } from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";

/** Örnek hedefler: p0↔p1 karşılıklı, p2→p0, p3→p2, p4→p3, p5→p3, p7→p6 (p6 hedefsiz). */
const SAMPLE: Record<string, string> = {
  p0: "p1",
  p1: "p0",
  p2: "p0",
  p3: "p2",
  p4: "p3",
  p5: "p3",
  p7: "p6",
};

export function startCaprazMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(kind === "capraz-ates" && params.has("off") && i === 2),
    score: 0,
    spectator: false,
  }));
  const ids = players.map((p) => p.id);
  const watching = kind.startsWith("capraz-spectator");
  const participants = watching ? ids.filter((id) => id !== SELF) : ids;
  const now = Date.now();
  const revealed = kind === "capraz-reveal" || kind === "capraz-spectator-reveal";
  // `&open=1`: aşama şimdi başladı (açılış sahnesi oynar).
  const startedAt = revealed ? now - CAPRAZ_ATES_FIRE_MS - 100 : params.has("open") ? now - 100 : now - 9_000;
  const endsAt = kind === "capraz-closed" ? now - 400 : startedAt + CAPRAZ_ATES_FIRE_MS;
  // Önizlemede sonuç ekranı kendiliğinden gelmesin.
  const finishAt = startedAt + 10 * 60_000;
  const sample = Object.fromEntries(
    Object.entries(SAMPLE).filter(([from, to]) => participants.includes(from) && participants.includes(to)),
  );
  let myTarget: string | null =
    kind === "capraz-locked" || kind === "capraz-tamam" ? (n > 2 ? "p2" : "p1") : null;
  if (revealed) myTarget = sample[SELF] ?? null;
  let locked = kind === "capraz-tamam";
  let phase: RoomPhase = kind === "capraz-briefing" ? "briefing" : "playing";
  let rev = 1;
  let readyIds: string[] = [];

  const publicView = (): CaprazAtesPublicView => ({
    startedAt,
    endsAt,
    finishAt,
    reveal: revealed ? caprazAtesReveal(participants, sample) : null,
    lockedIds: [
      ...(locked && !watching ? [SELF] : []),
      ...participants.filter((id, i) => id !== SELF && i % 2 === 1 && (watching || kind === "capraz-tamam")),
    ],
  });

  const publish = (): void => {
    const info = caprazAtes;
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: info.id,
      gameName: info.name,
      briefing: { goal: info.briefing.goal, steps: [...info.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      continueIds: [],
      phaseStartedAt: startedAt,
      phaseEndsAt: phase === "briefing" ? now + 40_000 : null,
      publicView: phase === "briefing" ? null : publicView(),
      view:
        phase === "briefing" ? null : { myTarget: watching ? null : myTarget, locked: !watching && locked },
      result: null,
    };
    const snapshot: RoomSnapshot = {
      rev: ++rev,
      serverNow: Date.now(),
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
      phase,
      players,
      gameIds: [info.id],
      selection: { mode: "manual" },
      tone: "arkadas",
      joinPolicy: "izleyici",
      lobbyReady: [],
      catalog: [
        {
          id: info.id,
          name: info.name,
          minPlayers: info.minPlayers,
          maxPlayers: info.maxPlayers,
          orientation: "portrait",
        },
      ],
      match,
    };
    applySnapshot(snapshot);
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type === "ready") {
      readyIds = ids;
      publish();
    }
    if (msg.type === "action") {
      const payload = msg.payload as { kind?: unknown; target?: unknown };
      if (payload.kind === "lock" && myTarget !== null) {
        locked = true;
        publish();
      }
      if (
        payload.kind === "target" &&
        !locked &&
        typeof payload.target === "string" &&
        ids.includes(payload.target)
      ) {
        setTimeout(() => {
          myTarget = payload.target as string;
          publish();
        }, 120);
      }
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  phase = kind === "capraz-briefing" ? "briefing" : "playing";
  publish();
}
