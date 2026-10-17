/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez). Çağrışım Ağı ekranları:
 *   ?mock=cagrisim                   cevap aşaması (yazabilirsin; gönderince kilitlenir, süre bitince açılır)
 *   ?mock=cagrisim-locked            cevabın kilitlenmiş
 *   ?mock=cagrisim-spectator         katılımcı değilsin
 *   ?mock=cagrisim-briefing          anlatım ekranı
 *   ?mock=cagrisim-reveal            açılış: sen bir ağdasın (`&n=8` oyuncu sayısı)
 *   ?mock=cagrisim-reveal-single     açılış: tek kaldın
 *   ?mock=cagrisim-reveal-silent     açılış: yazmadın
 *   ?mock=cagrisim-reveal-spectator  açılış: izleyici
 */
import type {
  CagrisimAgiPublicView,
  CagrisimAgiView,
  CagrisimReveal,
  GameInfo,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const WORD = "DENİZ";
const CATALOG: GameInfo[] = [
  { id: "cagrisim-agi", name: "Çağrışım Ağı", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
];
const BRIEFING = {
  goal: "Arkadaşlarınla aynı şeyi düşün!",
  steps: [
    "Ortadaki kelimeyi oku",
    "Aklına gelen tek çağrışımı yaz",
    "Aynısını yazanlar ağ kurar: kaç kişiyseniz o kadar puan",
  ],
};

/** Oyuncu sırasına göre sabit örnek açılış; eksik oyuncular elenir, tek kalan üye teke düşer. */
function sampleReveal(ids: string[], mode: string): CagrisimReveal {
  const plan: { text: string; members: string[] }[] =
    mode === "single"
      ? [
          { text: "mavi", members: ["p3", "p4"] },
          { text: "tatil", members: ["p1", "p2"] },
        ]
      : mode === "silent"
        ? [
            { text: "mavi", members: ["p1", "p2", "p3"] },
            { text: "tatil", members: ["p4", "p5"] },
          ]
        : [
            { text: "mavi", members: ["p0", "p2", "p4"] },
            { text: "tatil", members: ["p1", "p3"] },
          ];
  const loneText = ["ördek", "bilgisayar", "Anadolu"];
  const groups: CagrisimReveal["groups"] = [];
  const used = new Set<string>();
  for (const g of plan) {
    const members = g.members.filter((id) => ids.includes(id));
    for (const id of members) used.add(id);
    if (members.length >= 2) groups.push({ text: g.text, members, points: members.length });
    else for (const id of members) used.delete(id);
  }
  const singles: CagrisimReveal["singles"] = [];
  const silent: string[] = [];
  const silentId = mode === "silent" ? SELF : ids[ids.length - 1];
  for (const id of ids) {
    if (used.has(id)) continue;
    if (id === silentId && ids.length > 4) silent.push(id);
    else singles.push({ playerId: id, text: loneText[singles.length % loneText.length] as string });
  }
  groups.sort((a, b) => b.members.length - a.members.length);
  return { groups, singles, silent };
}

export function startCagrisimMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || (kind.includes("reveal") ? 7 : 5)));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
  }));
  const watching = kind.includes("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(watching && id === SELF));
  const now = Date.now();
  const timers: ReturnType<typeof setTimeout>[] = [];

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let startedAt = now - 8_000;
  let answeredIds: string[] = participants.filter((id) => id === "p1" || id === "p3");
  let myAnswer: string | null = null;
  let reveal: CagrisimReveal | null = null;
  let revealed = false;

  if (kind === "cagrisim-briefing") {
    phase = "briefing";
    readyIds = ["p1"];
    phaseEndsAt = now + 40_000;
  } else if (kind === "cagrisim-locked") {
    myAnswer = "mavi";
    answeredIds = participants.filter((id) => id !== "p4");
  } else if (kind.startsWith("cagrisim-reveal")) {
    startedAt = now - 31_000;
    revealed = true;
    reveal = sampleReveal(
      participants,
      kind.includes("single") ? "single" : kind.includes("silent") ? "silent" : "",
    );
    answeredIds = participants.filter((id) => !reveal?.silent.includes(id));
  }

  const publicView = (): CagrisimAgiPublicView => ({
    startedAt,
    answerEndsAt: startedAt + 30_000,
    endsAt: startedAt + 36_000,
    word: WORD,
    phase: revealed ? "reveal" : "answer",
    answeredIds,
    reveal: revealed ? reveal : null,
  });
  const view = (): CagrisimAgiView => ({ myAnswer: watching ? null : myAnswer });

  const match = (): MatchSnapshot => ({
    round: 0,
    total: 3,
    gameId: "cagrisim-agi",
    gameName: "Çağrışım Ağı",
    briefing: BRIEFING,
    orientation: "portrait",
    participants,
    readyIds,
    phaseStartedAt: startedAt,
    phaseEndsAt,
    publicView: phase === "playing" ? publicView() : null,
    view: phase === "playing" ? view() : null,
    result: null,
  });
  let rev = 1;
  const publish = (): void => {
    const snapshot: RoomSnapshot = {
      rev: ++rev,
      serverNow: Date.now(),
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
      phase,
      players,
      gameIds: ["cagrisim-agi"],
      catalog: CATALOG,
      match: match(),
    };
    applySnapshot(snapshot);
  };

  useMockSender((msg) => {
    if (msg.type === "ready") {
      readyIds = [...participants];
      publish();
    }
    if (msg.type !== "action" || revealed || myAnswer !== null) return;
    const payload = msg.payload as { text?: unknown };
    if (typeof payload?.text !== "string") return;
    myAnswer = payload.text;
    answeredIds = [...new Set([...answeredIds, SELF])];
    publish();
    timers.push(
      setTimeout(() => {
        answeredIds = [...participants];
        publish();
      }, 1200),
    );
  });

  // Cevap aşaması süre dolunca örnek açılışa geçer (yalnız geliştirmede, tek akış denemesi için).
  if (!revealed && kind !== "cagrisim-briefing") {
    timers.push(
      setTimeout(
        () => {
          revealed = true;
          const mine = myAnswer?.trim().toLocaleLowerCase("tr");
          reveal = sampleReveal(participants, mine === undefined ? "silent" : "");
          publish();
        },
        Math.max(1_000, startedAt + 30_000 - Date.now()),
      ),
    );
  }

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
}
