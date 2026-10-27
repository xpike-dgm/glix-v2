/**
 * Yalnız geliştirme önizlemesi: Karalama Defteri'nin her aşaması.
 *   ?mock=karalama-briefing | karalama-draw | karalama-draw-near | karalama-draw-ink | karalama-draw-spectator
 *   ?mock=karalama-draw-locked | karalama-vote-locked (Bitti / Tamam sonrası bekleme)
 *   ?mock=karalama-vote | karalama-vote-voted | karalama-vote-spectator | karalama-results | karalama-results-escaped
 * `&n=8` oyuncu sayısını değiştirir. Çizim tahtasına gerçekten çizilebilir; oylar yerelde tutulur.
 */
import {
  GAMES,
  type GameInfo,
  type KaralamaPublicView,
  type KaralamaReveal,
  type KaralamaStroke,
  type KaralamaView,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const GAME_ID = "karalama-defteri";
const CATALOG: GameInfo[] = [
  { id: GAME_ID, name: "Karalama Defteri", minPlayers: 3, maxPlayers: 8, orientation: "portrait" },
];

type Pts = [number, number][];
const flat = (pts: Pts): number[] => pts.flatMap(([x, y]) => [Math.round(x), Math.round(y)]);
const stroke = (color: number, size: 1 | 2 | 3, pts: Pts): KaralamaStroke => [color, size, ...flat(pts)];
const arc = (cx: number, cy: number, rx: number, ry: number, from = 0, to = Math.PI * 2, n = 36): Pts =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as [number, number];
  });

/** Her oyuncuya farklı, çocuk işi gibi bir karalama. */
export function sketch(i: number): KaralamaStroke[] {
  switch (i % 8) {
    case 0:
      return [
        stroke(3, 3, arc(500, 560, 270, 260)),
        stroke(2, 2, [
          [500, 300],
          [520, 190],
          [590, 140],
        ]),
        stroke(3, 2, arc(610, 190, 70, 34, Math.PI, Math.PI * 2, 10)),
      ];
    case 1:
      return [
        stroke(4, 2, arc(500, 520, 250, 230)),
        stroke(0, 3, arc(420, 470, 24, 24, 0, 6.3, 10)),
        stroke(0, 3, arc(580, 470, 24, 24, 0, 6.3, 10)),
        stroke(1, 3, arc(500, 580, 120, 90, 0.2, Math.PI - 0.2, 14)),
      ];
    case 2:
      return [
        stroke(2, 3, [
          [200, 760],
          [200, 420],
          [500, 200],
          [800, 420],
          [800, 760],
          [200, 760],
        ]),
        stroke(5, 2, [
          [440, 760],
          [440, 570],
          [560, 570],
          [560, 760],
        ]),
      ];
    case 3:
      return [
        stroke(
          1,
          2,
          Array.from(
            { length: 30 },
            (_, k) => [120 + k * 26, 500 + Math.sin(k / 2.2) * 190] as [number, number],
          ),
        ),
        stroke(4, 1, arc(500, 220, 90, 90, 0, 6.3, 16)),
      ];
    case 4:
      return [
        stroke(3, 3, [
          [500, 140],
          [590, 400],
          [860, 400],
          [640, 560],
          [720, 830],
          [500, 670],
          [280, 830],
          [360, 560],
          [140, 400],
          [410, 400],
          [500, 140],
        ]),
      ];
    case 5:
      return [
        stroke(0, 2, arc(500, 500, 330, 330, 0, 6.3, 40)),
        stroke(5, 3, arc(500, 500, 210, 210, 0, 6.3, 30)),
        stroke(1, 3, arc(500, 500, 90, 90, 0, 6.3, 20)),
      ];
    case 6:
      return [
        stroke(4, 3, [
          [160, 700],
          [160, 340],
          [840, 340],
          [840, 700],
          [160, 700],
        ]),
        stroke(0, 2, arc(300, 780, 70, 70, 0, 6.3, 14)),
        stroke(0, 2, arc(700, 780, 70, 70, 0, 6.3, 14)),
      ];
    default:
      return [
        stroke(
          3,
          2,
          Array.from({ length: 50 }, (_, k) => {
            const a = k / 4;
            return [500 + Math.cos(a) * (20 + k * 6), 500 + Math.sin(a) * (20 + k * 6)] as [number, number];
          }),
        ),
      ];
  }
}

export function startKaralamaMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(kind.includes("vote") && i === n - 1 && n > 5),
    score: 0,
  }));
  const spectator = kind.includes("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const outsider = kind.includes("near") ? SELF : "p2";
  const now = Date.now();
  const source = GAMES[GAME_ID]?.briefing;
  const briefing = { goal: source?.goal ?? "", steps: [...(source?.steps ?? [])] };

  let phase: RoomPhase = "playing";
  let phaseEndsAt: number | null = null;
  let phaseStartedAt = now - 13_000;
  const drawEndsAt = now + 62_000;
  const voteEndsAt = now + 17_000;
  let strokes: Record<string, KaralamaStroke> = {};
  let nextKey = 0;
  let myVote: string | null = kind.includes("voted") ? "p2" : null;
  const lockedKind = kind.includes("locked");
  if (lockedKind && kind.includes("vote")) myVote = "p2";
  let drawDone = kind === "karalama-draw-locked";
  let locked = kind === "karalama-vote-locked";
  const voted = kind.includes("voted") || (lockedKind && kind.includes("vote")) ? ["p1", "p3"] : [];
  const others = (): string[] => participants.filter((id) => id !== SELF);

  const isVote = kind.includes("vote");
  const isResults = kind.includes("results");
  const escaped = kind.includes("escaped");
  const mainWord = "elma";
  const nearWord = "armut";

  if (kind === "karalama-draw-ink") {
    for (const s of sketch(0)) strokes[String(nextKey++)] = s;
  }
  if (kind === "karalama-briefing") {
    phase = "briefing";
    phaseEndsAt = now + 40_000;
    phaseStartedAt = now;
  }
  if (isResults) {
    phase = "results";
    phaseStartedAt = now;
    phaseEndsAt = now + 60_000;
  }

  const drawings = (): Record<string, KaralamaStroke[]> =>
    Object.fromEntries(participants.map((id, i) => [id, sketch(Number(id.slice(1)) + i)]));

  const reveal = (): KaralamaReveal => {
    const votes: Record<string, string> = {};
    const others = participants.filter((id) => id !== outsider);
    for (const [i, id] of others.entries()) {
      votes[id] =
        escaped && i % 2 === 1
          ? (participants.find((p) => p !== id && p !== outsider) ?? outsider)
          : outsider;
    }
    votes[outsider] = others[0] ?? SELF;
    const tally: Record<string, number> = Object.fromEntries(participants.map((id) => [id, 0]));
    for (const t of Object.values(votes)) tally[t] = (tally[t] ?? 0) + 1;
    return { outsider, mainWord, nearWord, votes, tally, caught: !escaped };
  };

  const publicView = (): KaralamaPublicView => ({
    phase: isResults ? "done" : isVote ? "vote" : "draw",
    drawEndsAt: isVote || isResults ? now - 3_000 : drawEndsAt,
    voteEndsAt: isResults ? now - 1_000 : voteEndsAt,
    players: participants,
    drawings: isVote || isResults ? drawings() : null,
    voted: voted.filter((id) => participants.includes(id)),
    drawDoneIds: [
      ...(drawDone && !spectator ? [SELF] : []),
      ...(kind.includes("draw") && (lockedKind || spectator) ? others().filter((_, i) => i % 2 === 0) : []),
    ],
    lockedIds: [
      ...(locked && !spectator ? [SELF] : []),
      ...(isVote && (lockedKind || spectator) ? others().filter((_, i) => i % 2 === 1) : []),
    ],
    reveal: isResults ? reveal() : null,
  });
  const view = (): KaralamaView => ({
    word: spectator ? null : outsider === SELF ? nearWord : mainWord,
    near: !spectator && outsider === SELF,
    strokes: isVote || isResults ? {} : { ...strokes },
    pointsLeft: 6000,
    myVote,
    drawDone: !spectator && drawDone,
    locked: !spectator && locked,
  });

  const publish = (): void => {
    const miniScores = Object.fromEntries(
      participants.map((id) => [id, escaped ? (id === outsider ? 1 : 0) : id === outsider ? 0 : 1]),
    );
    const snapshot: RoomSnapshot = {
      rev: Math.floor(Date.now() / 1000),
      serverNow: Date.now(),
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
      phase,
      players,
      gameIds: [GAME_ID],
      selection: { mode: "manual" },
      tone: "arkadas",
      lobbyReady: [],
      catalog: CATALOG,
      match: {
        round: 0,
        total: 3,
        gameId: GAME_ID,
        gameName: "Karalama Defteri",
        briefing,
        orientation: "portrait",
        participants,
        readyIds: ["p1", "p2"],
        phaseStartedAt,
        phaseEndsAt,
        publicView: phase === "briefing" ? null : publicView(),
        view: phase === "briefing" ? null : view(),
        result: isResults ? { miniScores, awards: miniScores } : null,
      } satisfies MatchSnapshot,
    };
    applySnapshot(snapshot);
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type === "ready") return;
    if (msg.type !== "action") return;
    const a = msg.payload as {
      kind?: string;
      target?: string;
      color?: string;
      size?: number;
      points?: number[];
    };
    if (a.kind === "lock") {
      if (isVote) locked = myVote !== null;
      else drawDone = Object.keys(strokes).length > 0;
    } else if (drawDone && (a.kind === "stroke" || a.kind === "undo" || a.kind === "clear")) {
      return;
    } else if (locked && a.kind === "vote") {
      return;
    } else if (a.kind === "stroke" && Array.isArray(a.points)) {
      const idx =
        a.color === "eraser"
          ? 6
          : ["beyaz", "pembe", "sari", "yesil", "mavi", "turuncu"].indexOf(a.color ?? "");
      strokes[String(nextKey++)] = [idx, a.size ?? 2, ...a.points];
    } else if (a.kind === "undo") {
      const keys = Object.keys(strokes);
      const last = keys.at(-1);
      if (last !== undefined) delete strokes[last];
    } else if (a.kind === "clear") {
      strokes = {};
    } else if (a.kind === "vote" && typeof a.target === "string") {
      myVote = a.target;
    } else return;
    publish();
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
}
