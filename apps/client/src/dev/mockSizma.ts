/**
 * Yalnız geliştirme önizlemesi: Sızma ekranları (`&n=3..8` oyuncu sayısı).
 *   ?mock=sizma-briefing          anlatım
 *   ?mock=sizma-clue              ipucu aşaması (söyleme sırası, Oylamaya geç)
 *   ?mock=sizma-clue-locked       ipucu: sen "Oylamaya geç" dedin, diğerleri bekleniyor
 *   ?mock=sizma-vote              gizli oylama; dokununca oy verilir (`&chosen=1` seçili başlar)
 *   ?mock=sizma-vote-locked       oylama: sen "Tamam" dedin
 *   ?mock=sizma-reveal            sızma yakalandı (`&me=odd` sızma sensin)
 *   ?mock=sizma-reveal-escaped    sızma kurtuldu (`&me=odd` sızma sensin)
 *   ?mock=sizma-spectator-clue | -vote | -reveal   katılımcı değilsin
 */
import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import {
  SIZMA_CLUE_CAP_MS,
  SIZMA_VOTE_MS,
  type SizmaPublicView,
  type SizmaReveal,
  type SizmaView,
  sizma,
  sizmaOutcome,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: sizma.id,
  name: sizma.name,
  minPlayers: sizma.minPlayers,
  maxPlayers: sizma.maxPlayers,
  orientation: "portrait",
};

export function startSizmaMock(kind: string, params: URLSearchParams): void {
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
  const stage = kind.includes("reveal") ? "reveal" : kind.includes("vote") ? "vote" : "clue";
  const escaped = kind.includes("escaped");
  const meOdd = params.get("me") === "odd";
  const infiltrator = meOdd && !spectator ? SELF : "p2";
  const clueEndsAt = stage === "clue" ? now + SIZMA_CLUE_CAP_MS - 40_000 : now - 9_000;
  const startedAt = clueEndsAt - SIZMA_CLUE_CAP_MS + (stage === "clue" ? 0 : 200_000);
  const voteEndsAt = stage === "reveal" ? now - 300 : clueEndsAt + SIZMA_VOTE_MS;
  const finishAt = voteEndsAt + 8_000;

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  const chosenParam = params.get("chosen");
  let myVote: string | null =
    stage === "vote" && (chosenParam !== null || kind.includes("locked"))
      ? `p${Number(chosenParam ?? 1)}`
      : null;
  let myLocked = kind.includes("locked");

  const readyList = (): string[] => {
    if (stage === "reveal") return [];
    if (myLocked || spectator) {
      const others = participants.filter((id) => id !== SELF).slice(0, spectator ? 2 : Math.floor(n / 2) - 1);
      return spectator ? others : [SELF, ...others];
    }
    return [];
  };

  const votes = (): Record<string, string> => {
    const out: Record<string, string> = {};
    participants.forEach((id, i) => {
      if (escaped) out[id] = i % 2 === 0 ? "p1" : "p3";
      else out[id] = id === infiltrator ? "p1" : infiltrator;
    });
    // Sızmayı yakalayan oylarda bir iki kişi başkasını seçsin.
    if (!escaped && participants.length > 4) out[participants[1] as string] = "p3";
    return out;
  };

  const reveal = (): SizmaReveal => {
    const v = votes();
    const o = sizmaOutcome(participants, infiltrator, v);
    return {
      infiltrator,
      commonWord: "ÇAY",
      infiltratorWord: "KAHVE",
      votes: v,
      tally: o.tally,
      caught: o.caught,
      scores: o.scores,
    };
  };

  const order = (): string[] => [...participants].reverse();

  const build = (): { pub: SizmaPublicView; priv: SizmaView } => ({
    pub: {
      players: participants,
      phase: stage,
      order: order(),
      startedAt,
      clueEndsAt,
      voteEndsAt,
      finishAt,
      ready: readyList(),
      reveal: stage === "reveal" ? reveal() : null,
    },
    priv: {
      word: spectator ? null : SELF === infiltrator ? "KAHVE" : "ÇAY",
      myVote: spectator ? null : stage === "reveal" ? (votes()[SELF] ?? null) : myVote,
      locked: !spectator && stage !== "reveal" && myLocked,
    },
  });

  let rev = 1;
  const snapshot = (): RoomSnapshot => {
    if (kind === "sizma-briefing") {
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
      briefing: { goal: sizma.briefing.goal, steps: [...sizma.briefing.steps] },
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
      catalog: [INFO],
      match,
    };
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    const payload = msg.payload as { kind?: string; target?: string } | null;
    if (payload?.kind === "skip" || (payload?.kind === "lock" && (stage === "clue" || myVote !== null))) {
      myLocked = true;
      applySnapshot(snapshot());
      return;
    }
    if (payload?.kind === "vote" && typeof payload.target === "string" && !myLocked) {
      myVote = payload.target;
      applySnapshot(snapshot());
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
