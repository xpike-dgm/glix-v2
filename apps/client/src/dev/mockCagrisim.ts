/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez). Çağrışım Ağı ekranları (üç kelimelik seri):
 *   ?mock=cagrisim                 cevap aşaması (`&r=1` ikinci kelime; yazabilirsin, gönderince kilitlenir)
 *   ?mock=cagrisim-urgent          son 4 sn: kırmızı halka, büyük saniye, boş alan uyarısı
 *   ?mock=cagrisim-locked          cevabın kilitlenmiş, yörüngede düğümler
 *   ?mock=cagrisim-spectator       izleyici: "Sen de dene (sayılmaz)"
 *   ?mock=cagrisim-briefing        anlatım ekranı
 *   ?mock=cagrisim-mini            kelimeler arası 4 sn'lik mini açılış (`&n=8`)
 *   ?mock=cagrisim-final           büyük açılış (`&at=ms` açılışın kaçıncı ms'si; varsayılan: liste)
 *   ?mock=cagrisim-final-single    büyük açılış: son kelimede tek kaldın
 *   ?mock=cagrisim-final-silent    büyük açılış: son kelimede yazmadın (biri bağlantı koptu)
 *   ortak: `&stamp=heart` herkes aynı ağ (TEK YÜREK), `&stamp=sheep` biri hariç herkes (KARA KOYUN), `&yorum=1` spiker
 *   TV: ?mock=tv-cagrisim-answer / tv-cagrisim-mini / tv-cagrisim-final
 */
import {
  CAGRISIM_ANSWER_MS,
  CAGRISIM_FINAL_MS,
  CAGRISIM_MINI_MS,
  type CagrisimAgiPublicView,
  type CagrisimAgiView,
  type CagrisimPhase,
  type CagrisimReveal,
  type CagrisimRoundResult,
  cagrisimAwards,
  type GameInfo,
  groupAnswers,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşegül"];
const SELF = "p0";
const WORDS = ["KAR", "DENİZ", "VADİ"];
const CATALOG: GameInfo[] = [
  { id: "cagrisim-agi", name: "Çağrışım Ağı", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
];
const BRIEFING = {
  goal: "Arkadaşlarınla aynı şeyi düşün!",
  steps: [
    "Ortadaki kelimeyi gör",
    "Çoğunluk ne yazar? Tek bir cevap yaz",
    "Aynısını yazanlarla ağ kur: üç kelime, puanlar toplanır",
  ],
};

/** Kelime başına örnek cevaplar (oyuncu sırasıyla); gerçek gruplama kurallarıyla açılır. */
function sampleAnswers(ids: string[], round: number, mode: string, stamp: string): Record<string, string> {
  const sets = [
    ["kış", "beyaz", "Kış", "kardan adam", "beyaz", "kış", "soğuk", "kayak"],
    ["mavi", "dalgalar", "Mavi", "dalga", "mavi", "kumsal", "kumsak", "tatil"],
    ["yeşil", "dağ", "yeşil", "nehir", "dağlar", "ova", "yeşil", "kartal"],
  ];
  const set = sets[round] ?? sets[0] ?? [];
  const out: Record<string, string> = {};
  ids.forEach((id, i) => {
    let text = set[i % set.length] as string;
    if (stamp === "heart") text = i % 2 === 0 ? "Mavi" : "mavi";
    if (stamp === "sheep") text = i === 1 ? "ördek" : "mavi";
    if (round === 2 && mode === "single" && id === SELF) text = "uzaylı";
    if (round === 2 && mode === "silent" && (id === SELF || id === ids[ids.length - 1])) return;
    out[id] = text;
  });
  return out;
}

export function startCagrisimMock(kind: string, params: URLSearchParams): void {
  const tv = kind.startsWith("tv-");
  const base = kind.replace(/^tv-/, "").replace(/-spectator$/, "");
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || (base.includes("final") ? 7 : 6)));
  const silentMode = base.includes("silent");
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(silentMode && i === n - 1),
    score: [6, 4, 3, 7, 2, 5, 1, 0][i] ?? 0,
    spectator: false,
  }));
  const watching = kind.includes("spectator") || tv;
  const participants = players.map((p) => p.id).filter((id) => !(watching && id === SELF));
  const stamp = params.get("stamp") ?? "";
  const mode = base.includes("single") ? "single" : silentMode ? "silent" : "";
  const now = Date.now();
  const timers: ReturnType<typeof setTimeout>[] = [];

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let round = Math.min(2, Math.max(0, Number(params.get("r")) || 0));
  let gamePhase: CagrisimPhase = "answer";
  let roundStartedAt = now - 8_000;
  let answeredIds: string[] = participants.filter((id) => id === "p1" || id === "p3");
  let myAnswer: string | null = null;

  if (base === "cagrisim-briefing") {
    phase = "briefing";
    readyIds = ["p1"];
    phaseEndsAt = now + 40_000;
  } else if (base === "cagrisim-urgent") {
    roundStartedAt = now - CAGRISIM_ANSWER_MS + 4_200;
  } else if (base === "cagrisim-locked") {
    myAnswer = "mavi";
    answeredIds = participants.filter((id) => id !== "p4");
  } else if (base === "cagrisim-mini") {
    gamePhase = "mini";
    round = 1;
    roundStartedAt = now - CAGRISIM_ANSWER_MS - 1_200;
  } else if (base.startsWith("cagrisim-final")) {
    gamePhase = "final";
    round = 2;
    roundStartedAt = now - CAGRISIM_ANSWER_MS - Number(params.get("at") ?? 7_000);
  }
  const startedAt = roundStartedAt - round * (CAGRISIM_ANSWER_MS + CAGRISIM_MINI_MS);

  const results = (): CagrisimRoundResult[] => {
    const count = gamePhase === "answer" ? round : round + 1;
    return Array.from({ length: count }, (_, r) => ({
      word: WORDS[r] ?? "KAR",
      reveal: groupAnswers(participants, sampleAnswers(participants, r, mode, r === count - 1 ? stamp : "")),
    }));
  };
  const totals = (list: CagrisimRoundResult[]): Record<string, number> => {
    const t: Record<string, number> = Object.fromEntries(participants.map((id) => [id, 0]));
    for (const { reveal } of list)
      for (const g of reveal.groups) for (const id of g.members) t[id] = (t[id] ?? 0) + g.points;
    return t;
  };

  const publicView = (): CagrisimAgiPublicView => {
    const list = results();
    const t = totals(list);
    const answerEndsAt = roundStartedAt + CAGRISIM_ANSWER_MS;
    const current: CagrisimReveal | undefined = list[round]?.reveal;
    return {
      startedAt,
      round,
      rounds: 3,
      roundStartedAt,
      answerEndsAt,
      revealEndsAt: answerEndsAt + (round === 2 ? CAGRISIM_FINAL_MS : CAGRISIM_MINI_MS),
      endsAt: answerEndsAt + (2 - round) * (CAGRISIM_ANSWER_MS + CAGRISIM_MINI_MS) + CAGRISIM_FINAL_MS,
      word: WORDS[round] ?? "KAR",
      phase: gamePhase,
      answeredIds: current ? participants.filter((id) => !current.silent.includes(id)) : answeredIds,
      results: list,
      totals: t,
      awards: gamePhase === "final" ? cagrisimAwards(t) : null,
    };
  };
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
    continueIds: [],
    phaseStartedAt: startedAt,
    phaseEndsAt,
    publicView: phase === "playing" ? publicView() : null,
    view: phase === "playing" ? view() : null,
    result: null,
    ...(params.get("yorum") === "1" && gamePhase === "final"
      ? { comment: "KAR deyince herkes kışa koştu, Elif ise ördeği düşündü; kara koyun ama çok sevimli." }
      : {}),
    ...(gamePhase === "final"
      ? {
          reveal: {
            startedAt: roundStartedAt + CAGRISIM_ANSWER_MS,
            endsAt: roundStartedAt + CAGRISIM_ANSWER_MS + 60_000,
            continueIds: ["p2"],
          },
        }
      : {}),
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
      selection: { mode: "manual" },
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
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
    if (msg.type !== "action" || gamePhase !== "answer" || myAnswer !== null) return;
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

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
}
