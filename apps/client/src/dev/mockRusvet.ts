/**
 * Yalnız geliştirme önizlemesi: Rüşvet ve Darbe ekranları (`&n=3..8` oyuncu sayısı).
 *   ?mock=rusvet-briefing        anlatım
 *   ?mock=rusvet-vote            başkanlık oyu (`&chosen=1` seçili başlar)
 *   ?mock=rusvet-duel            düello, sen adaysın (`&c=2..8` aday sayısı, `&open=1` işaretler açık, `&replay=1` önceki el yok sayıldı)
 *   ?mock=rusvet-duel-out        düello, aday değilsin
 *   ?mock=rusvet-give            sen başkansın, jeton dağıt (`&budget=4`)
 *   ?mock=rusvet-give-wait       başkan başkası, jeton dağıtıyor
 *   ?mock=rusvet-reveal          sonuç: oy akışı, jetonlar, puanlar (`&me=president` ile başkan sensin)
 *   ?mock=rusvet-spectator-vote | -duel | -give | -reveal   katılımcı değilsin
 */
import type {
  Allocation,
  DuelHand,
  GameInfo,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
  RusvetPublicView,
  RusvetView,
  Sign,
} from "@glix/engine";
import { RUSVET_GIVE_MS, RUSVET_SIGN_MS, RUSVET_VOTE_MS, rusvetDarbe } from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: rusvetDarbe.id,
  name: rusvetDarbe.name,
  minPlayers: rusvetDarbe.minPlayers,
  maxPlayers: rusvetDarbe.maxPlayers,
  orientation: "portrait",
};
const SIGNS: Sign[] = ["tas", "makas", "kagit", "tas", "makas", "kagit", "tas", "makas"];

export function startRusvetMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
  }));
  const spectator = kind.includes("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const now = Date.now();
  const phase = kind.includes("reveal")
    ? "reveal"
    : kind.includes("give")
      ? "give"
      : kind.includes("duel")
        ? "duel"
        : "vote";
  const selfPresident = kind === "rusvet-give" || params.get("me") === "president";
  const president = selfPresident ? SELF : "p1";
  const budget = Math.min(2 * (n - 1), Math.max(1, Number(params.get("budget")) || 3));
  const cCount = Math.min(n, Math.max(2, Number(params.get("c")) || 3));
  const candidates = participants.slice(0, cCount);
  const meOut = kind.includes("duel-out");
  const duelCandidates = meOut ? participants.slice(1, 1 + cCount) : candidates;
  const open = params.get("open") === "1";
  const replayHand = params.get("replay") === "1";

  let phaseStartedAt = now - 3_000;
  let phaseEndsAt = now + 17_000;
  if (phase === "duel") [phaseStartedAt, phaseEndsAt] = [now - 3_000, now + RUSVET_SIGN_MS - 3_000];
  if (phase === "give") [phaseStartedAt, phaseEndsAt] = [now - 4_000, now + RUSVET_GIVE_MS - 4_000];
  if (phase === "reveal") [phaseStartedAt, phaseEndsAt] = [now - 300, now + 7_700];
  if (phase === "vote") [phaseStartedAt, phaseEndsAt] = [now - 4_000, now + RUSVET_VOTE_MS - 4_000];
  if (open) [phaseStartedAt, phaseEndsAt] = [now - 400, now + 2_100];

  let phaseNow: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsMatch: number | null = null;
  let myVote: string | null =
    phase === "vote" && params.get("chosen") !== null ? `p${Number(params.get("chosen"))}` : null;
  let mySign: Sign | null = null;
  let myTokens: Allocation[] = [];
  let rev = 1;

  const signMap = (ids: string[]): Record<string, Sign> => {
    const out: Record<string, Sign> = {};
    ids.forEach((id, i) => {
      out[id] = SIGNS[i % SIGNS.length] as Sign;
    });
    return out;
  };
  const oldHand: DuelHand = {
    candidates: duelCandidates,
    signs: Object.fromEntries(duelCandidates.map((id) => [id, "tas" as Sign])),
    advance: duelCandidates,
    replay: true,
  };

  const votes = (): Record<string, string> => {
    // Başkana çoğu oy gider; her dördüncü oyuncu başka birine verir; başkan kendisi dışında birine oy verir.
    const out: Record<string, string> = {};
    const other = participants.find((id) => id !== president && id !== "p2") ?? "p0";
    participants.forEach((id, i) => {
      if (id === president) out[id] = other;
      else if (i % 4 === 3) out[id] = id === other ? president : other;
      else out[id] = president;
    });
    return out;
  };
  const counts = (): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const id of participants) out[id] = 0;
    for (const to of Object.values(votes())) out[to] = (out[to] ?? 0) + 1;
    return out;
  };
  const givenTokens = (): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const id of participants) out[id] = 0;
    const others = participants.filter((id) => id !== president);
    let left = counts()[president] ?? budget;
    for (let i = 0; left > 0 && i < others.length * 2; i++) {
      const id = others[i % others.length] as string;
      if ((out[id] ?? 0) < 2) {
        out[id] = (out[id] ?? 0) + 1;
        left--;
      }
    }
    return out;
  };

  const build = (): { pub: RusvetPublicView; priv: RusvetView } => {
    const base = { players: participants, startedAt: now - 30_000, phaseStartedAt, phaseEndsAt };
    if (phase === "vote") {
      return {
        pub: { ...base, phase, president: null, budget: null, duel: null, reveal: null },
        priv: { myVote: spectator ? null : myVote, mySign: null, myTokens: null },
      };
    }
    if (phase === "duel") {
      return {
        pub: {
          ...base,
          phase,
          president: null,
          budget: null,
          reveal: null,
          duel: {
            hand: replayHand || open ? 2 : 1,
            candidates: duelCandidates,
            signStartedAt: phaseStartedAt,
            signEndsAt: phaseEndsAt,
            revealEndsAt: phaseEndsAt + 2_500,
            signs: open ? signMap(duelCandidates) : null,
            history: replayHand ? [oldHand] : [],
          },
        },
        priv: { myVote: null, mySign: spectator || meOut ? null : mySign, myTokens: null },
      };
    }
    if (phase === "give") {
      return {
        pub: { ...base, phase, president, budget, duel: null, reveal: null },
        priv: { myVote: null, mySign: null, myTokens: selfPresident && !spectator ? myTokens : null },
      };
    }
    const tokens = givenTokens();
    const scores: Record<string, number> = { ...tokens };
    scores[president] = (scores[president] ?? 0) + 1;
    return {
      pub: {
        ...base,
        phase: "reveal",
        president,
        budget: counts()[president] ?? budget,
        duel: null,
        reveal: { votes: votes(), counts: counts(), tokens, scores, duelHands: [] },
      },
      priv: { myVote: null, mySign: null, myTokens: null },
    };
  };

  const snapshot = (): RoomSnapshot => {
    if (kind === "rusvet-briefing") {
      phaseNow = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsMatch = now + 40_000;
    }
    const { pub, priv } = build();
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: rusvetDarbe.briefing.goal, steps: [...rusvetDarbe.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      phaseStartedAt,
      phaseEndsAt: phaseEndsMatch,
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
      phase: phaseNow,
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
    const p = msg.payload as { kind?: string; target?: string; sign?: Sign; tokens?: Allocation[] } | null;
    if (p?.kind === "vote" && typeof p.target === "string") myVote = p.target;
    else if (p?.kind === "sign" && p.sign) mySign = p.sign;
    else if (p?.kind === "give" && Array.isArray(p.tokens)) myTokens = p.tokens;
    else return;
    applySnapshot(snapshot());
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
