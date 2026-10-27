/**
 * Yalnız geliştirme önizlemesi: Kontrol Paneli Kaosu ekranları (`&n=2..8` oyuncu sayısı).
 *   ?mock=kontrol-briefing       anlatım
 *   ?mock=kontrol-play           oyun: kablo seç, KES (`&clue=3` üç koşullu ipucu)
 *   ?mock=kontrol-cut            kesim yapıldı, diğerleri bekleniyor
 *   ?mock=kontrol-reveal         sonuç; kendi kesimin doğru (`kontrol-reveal-wrong`: yanlış)
 *   ?mock=kontrol-spectator-play | -reveal   katılımcı değilsin
 */
import type {
  Clue,
  GameInfo,
  KontrolPublicView,
  KontrolReveal,
  KontrolView,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
  WireColor,
} from "@glix/engine";
import { KONTROL_DURATION_MS, KONTROL_PLAY_MS, kontrolPaneliKaosu, wirePermutations } from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: kontrolPaneliKaosu.id,
  name: kontrolPaneliKaosu.name,
  minPlayers: kontrolPaneliKaosu.minPlayers,
  maxPlayers: kontrolPaneliKaosu.maxPlayers,
  orientation: "portrait",
};

export function startKontrolMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
    spectator: false,
  }));
  const spectator = kind.includes("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const stage = kind.includes("reveal") ? "reveal" : "play";
  const now = Date.now();
  const startedAt = now - (stage === "reveal" ? KONTROL_PLAY_MS + 300 : 14_000);
  const endsAt = startedAt + KONTROL_PLAY_MS;

  const perms = wirePermutations();
  const panels: Record<string, WireColor[]> = {};
  participants.forEach((id, i) => {
    panels[id] = perms[(i * 7 + 3) % perms.length] as WireColor[];
  });
  const carrierOf = (id: string): string =>
    participants[(participants.indexOf(id) + participants.length - 1) % participants.length] as string;
  const answers: Record<string, WireColor> = {};
  participants.forEach((id, i) => {
    answers[id] = (["blue", "red", "yellow", "green"] as const)[i % 4] as WireColor;
  });
  const clueFor = (carrier: string): Clue => {
    const target = participants[(participants.indexOf(carrier) + 1) % participants.length] as string;
    const panel = panels[target] as WireColor[];
    const positions = params.get("clue") === "3" ? [1, 3, 4] : [1, 3];
    return {
      conditions: positions.map((position) => ({ position, color: panel[position - 1] as WireColor })),
      cut: answers[target] as WireColor,
    };
  };

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let myCut: WireColor | null = kind.includes("cut") ? ((panels[SELF] as WireColor[])[1] as WireColor) : null;
  const wrong = kind.includes("wrong");
  let rev = 1;

  const done = (): string[] => {
    if (stage === "reveal") return participants;
    const others = participants
      .filter((id) => id !== SELF)
      .slice(0, spectator ? 2 : Math.max(1, Math.floor(n / 2) - 1));
    return spectator ? others : myCut ? [SELF, ...others] : others;
  };

  const reveal = (): KontrolReveal => {
    const rows: KontrolReveal["rows"] = {};
    const scores: Record<string, number> = {};
    for (const id of participants) scores[id] = 0;
    participants.forEach((id, i) => {
      const correct = id === SELF ? !wrong : i % 2 === 1;
      const answer = answers[id] as WireColor;
      const other = (["blue", "green", "red", "yellow"] as const).find((c) => c !== answer) as WireColor;
      const cut = id !== SELF && i % 4 === 3 ? null : correct ? answer : other;
      rows[id] = {
        panel: panels[id] as WireColor[],
        cut,
        correct: cut !== null && correct,
        carrier: carrierOf(id),
        clue: clueFor(carrierOf(id)),
      };
      if (rows[id]?.correct) {
        scores[id] = (scores[id] ?? 0) + 1;
        scores[carrierOf(id)] = (scores[carrierOf(id)] ?? 0) + 1;
      }
    });
    return { rows, scores };
  };

  const build = (): { pub: KontrolPublicView; priv: KontrolView } => ({
    pub: {
      players: participants,
      stage,
      startedAt,
      endsAt,
      finishAt: startedAt + KONTROL_DURATION_MS,
      done: done(),
      reveal: stage === "reveal" ? reveal() : null,
    },
    priv: spectator
      ? { panel: [], clue: null, myCut: null }
      : { panel: panels[SELF] as WireColor[], clue: clueFor(SELF), myCut },
  });

  const snapshot = (): RoomSnapshot => {
    if (kind === "kontrol-briefing") {
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
      briefing: { goal: kontrolPaneliKaosu.briefing.goal, steps: [...kontrolPaneliKaosu.briefing.steps] },
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
    const p = msg.payload as { kind?: string; color?: WireColor } | null;
    if (p?.kind !== "cut" || myCut !== null || !p.color) return;
    myCut = p.color;
    applySnapshot(snapshot());
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
