/**
 * Yalnız geliştirme önizlemesi: Kara Borsa'nın her aşaması.
 *   ?mock=kara-briefing
 *   ?mock=kara-bid | kara-bid-sent | kara-bid-pass | kara-bid-broke | kara-bid-spectator | kara-bid-final | kara-bid-first
 *   ?mock=kara-reveal | kara-reveal-me | kara-reveal-cursed | kara-reveal-none | kara-reveal-tie | kara-reveal-even
 *   ?mock=kara-reveal-final (son tur; `&yorum=1` mezatçı yorumu, `&kar=0` kimse kâr etmedi) | kara-results
 * `&n=8` oyuncu sayısı; `&t=ms` açılışın neresinde (varsayılan bitmiş hâl); `&left=ms` teklifte kalan süre.
 * TV: `?mock=tv-kara-…` aynı evreleri büyük ekranda açar. Teklif yerelde işlenir.
 */
import {
  BORSA_REVEAL_MS,
  BORSA_ROUNDS,
  BORSA_START_COINS,
  type BorsaHintPair,
  type BorsaPublicView,
  type BorsaRoundResult,
  type BorsaView,
  GAMES,
  type GameInfo,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşegül"];
const SELF = "p0";
const GAME_ID = "kara-borsa";
const CATALOG: GameInfo[] = [
  { id: GAME_ID, name: "Kara Borsa", minPlayers: 3, maxPlayers: 8, orientation: "portrait" },
];

/** Önceki turlar: kazık, lanet, kelepir, kimse almadı. */
function pastRounds(ids: string[], kar: boolean): BorsaRoundResult[] {
  const at = (i: number) => ids[i % ids.length] as string;
  const bids = (m: Record<number, number>) =>
    Object.fromEntries(ids.map((id, i) => [id, m[i] ?? 0])) as Record<string, number>;
  return [
    { value: 37, winner: at(2), price: 44, bids: bids({ 0: 12, 2: 44, 3: 30 }) },
    { value: -20, winner: at(1), price: 18, bids: bids({ 1: 18, 2: 9 }) },
    kar
      ? { value: 52, winner: at(0), price: 30, bids: bids({ 0: 30, 1: 25, 4: 12 }) }
      : { value: 20, winner: at(0), price: 30, bids: bids({ 0: 30, 1: 25 }) },
    { value: 12, winner: null, price: 0, bids: bids({}) },
  ];
}

export function startBorsaMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(i === n - 1 && n > 5),
    score: i === 1 ? 3 : i,
    spectator: false,
  }));
  const spectator = kind.includes("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const now = Date.now();
  const source = GAMES[GAME_ID]?.briefing;
  const briefing = { goal: source?.goal ?? "", steps: [...(source?.steps ?? [])] };
  const isReveal = kind.startsWith("kara-reveal") || kind === "kara-results";
  const finalRound = kind === "kara-reveal-final" || kind === "kara-bid-final" || kind === "kara-results";
  const first = kind === "kara-bid-first";
  const kar = params.get("kar") !== "0";
  const round = first ? 0 : finalRound ? BORSA_ROUNDS - 1 : 2;
  const past = pastRounds(participants, kar).slice(0, round);
  const tParam = params.get("t");
  const elapsed = tParam !== null && Number.isFinite(Number(tParam)) ? Number(tParam) : BORSA_REVEAL_MS - 400;
  const leftParam = Number(params.get("left"));
  const left = Number.isFinite(leftParam) && leftParam > 0 ? leftParam : 12_000;

  let phase: RoomPhase = "playing";
  let phaseEndsAt: number | null = null;
  let phaseStartedAt = now - 5_000;
  if (kind === "kara-briefing") {
    phase = "briefing";
    phaseEndsAt = now + 40_000;
    phaseStartedAt = now;
  }
  if (kind === "kara-results") {
    phase = "results";
    phaseStartedAt = now;
    phaseEndsAt = now + 60_000;
  }
  const broke = kind === "kara-bid-broke";
  let myBid: number | null = kind === "kara-bid-sent" ? 35 : kind === "kara-bid-pass" ? 0 : null;

  const current = (): BorsaRoundResult => {
    const bids = Object.fromEntries(participants.map((id) => [id, 0])) as Record<string, number>;
    const set = (i: number, v: number) => {
      const id = participants[i];
      if (id !== undefined) bids[id] = v;
    };
    if (kind === "kara-reveal-none") return { value: 41, winner: null, price: 0, bids };
    if (kind === "kara-reveal-final" || kind === "kara-results") {
      [22, 61, 0, 48, 15, 0, 30, 9].forEach((v, i) => {
        set(i, v);
      });
      const w = participants[1] as string;
      return { value: kar ? 104 : 40, winner: w, price: 61, bids };
    }
    [12, 0, 30, 18, 0, 25, 0, 9].forEach((v, i) => {
      set(i, v);
    });
    const me = kind === "kara-reveal-me";
    const winnerIdx = me ? 0 : 2;
    const price = kind === "kara-reveal-tie" ? 30 : me ? 41 : 44;
    set(winnerIdx, price);
    // Eşitlik: Zeynep de 30 verdi ama Mert önce verdi.
    if (kind === "kara-reveal-tie") set(3, 30);
    const winner = participants[winnerIdx] as string;
    const value = kind === "kara-reveal-cursed" ? -20 : kind === "kara-reveal-even" ? 44 : me ? 58 : 37;
    return { value, winner, price, bids };
  };
  const history = (): BorsaRoundResult[] => (isReveal ? [...past, current()] : past);
  const wallet = () => {
    const coins: Record<string, number> = {};
    const boxes: Record<string, number> = {};
    for (const id of participants) {
      coins[id] = BORSA_START_COINS;
      boxes[id] = 0;
    }
    for (const h of history()) {
      if (h.winner === null) continue;
      coins[h.winner] = (coins[h.winner] ?? 0) - h.price;
      boxes[h.winner] = (boxes[h.winner] ?? 0) + h.value;
    }
    if (broke) coins[SELF] = 0;
    return { coins, boxes };
  };
  const hint: BorsaHintPair =
    kind === "kara-bid-final"
      ? { main: { kind: "gt", n: 70 }, extra: { kind: "even" } }
      : kind === "kara-bid-sent"
        ? { main: { kind: "between", lo: 20, hi: 38 }, extra: { kind: "notMultiple", n: 3 } }
        : { main: { kind: "gt", n: 30 }, extra: { kind: "odd" } };

  const publicView = (): BorsaPublicView => {
    const { coins, boxes } = wallet();
    const h = history();
    return {
      phase: isReveal ? "reveal" : "bid",
      round,
      rounds: BORSA_ROUNDS,
      startedAt: now - 60_000,
      stageStartedAt: isReveal ? now - elapsed : now - (20_000 - left),
      stageEndsAt: isReveal ? now - elapsed + BORSA_REVEAL_MS : now + left,
      players: participants,
      coins,
      boxes,
      bidIds: isReveal
        ? []
        : participants.filter((id, i) => i % 2 === 1 || (myBid !== null && id === SELF) || coins[id] === 0),
      history: h,
      reveal: isReveal ? (h[h.length - 1] ?? null) : null,
    };
  };
  const view = (): BorsaView => ({
    hint: spectator || isReveal ? null : hint,
    myBid: spectator ? null : myBid,
  });
  const comment =
    params.get("yorum") === "1"
      ? "Elif son kutuya 61 jeton bayıldı ama sandıktan altın çıktı; Mert ise lanetli kutuyla hâlâ barışamadı."
      : undefined;
  const publish = (): void => {
    const pv = publicView();
    const finalReveal = kind === "kara-reveal-final";
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
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
      catalog: CATALOG,
      match: {
        round: 0,
        total: 3,
        gameId: GAME_ID,
        gameName: "Kara Borsa",
        briefing,
        orientation: "portrait",
        participants,
        readyIds: ["p1", "p2"],
        continueIds: [],
        phaseStartedAt,
        phaseEndsAt,
        publicView: phase === "briefing" ? null : pv,
        view: phase === "briefing" ? null : view(),
        ...(finalReveal
          ? {
              reveal: {
                startedAt: pv.stageStartedAt,
                endsAt: pv.stageStartedAt + 60_000,
                continueIds: ["p1"],
              },
            }
          : {}),
        ...(comment !== undefined && finalReveal ? { comment } : {}),
        result:
          phase === "results"
            ? {
                miniScores: Object.fromEntries(
                  participants.map((id) => [
                    id,
                    (pv.coins[id] ?? 0) + (pv.boxes[id] ?? 0) - BORSA_START_COINS,
                  ]),
                ),
                awards: Object.fromEntries(participants.map((id, i) => [id, i === 1 ? 2 : i === 0 ? 1 : 0])),
              }
            : null,
      } satisfies MatchSnapshot,
    };
    applySnapshot(snapshot);
  };
  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    const a = msg.payload as { kind?: string; amount?: number };
    if (a.kind === "bid" && typeof a.amount === "number" && myBid === null) {
      myBid = a.amount;
      publish();
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
}
