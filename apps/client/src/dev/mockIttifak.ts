/**
 * Yalnız geliştirme önizlemesi: İttifak ekranları (`&n=3..8` oyuncu sayısı).
 *   ?mock=ittifak-briefing        anlatım
 *   ?mock=ittifak-talk            sözlü pazarlık (ortada geri sayım)
 *   ?mock=ittifak-vote            gizli oylama; dokununca oy verilir (`&chosen=1` seçili başlar)
 *   ?mock=ittifak-talk-locked     pazarlık: sen "Oylamaya geçelim" dedin, diğerleri bekleniyor
 *   ?mock=ittifak-vote-locked     oylama: sen "Tamam" dedin (oy seçili), diğerleri bekleniyor
 *   ?mock=ittifak-reveal          oy akışı ve alınan oylar
 *   ?mock=ittifak-talk            ... `&promised=1,2` söz işaretleri başlangıçta konmuş; portreye dokununca söz konur/kalkar
 *   ?mock=ittifak-reveal          ... sözler açılır (tutuldu ✓ / bozuldu ✗); `&promises=many` herkes 2 söz vermiş
 *   ?mock=ittifak-reveal-zero     sen hiç oy almadın
 *   ?mock=ittifak-spectator-talk | -vote | -reveal   katılımcı değilsin
 */
import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import {
  ITTIFAK_DURATION_MS,
  ITTIFAK_MAX_PROMISES,
  ITTIFAK_REVEAL_MS,
  ITTIFAK_TALK_MS,
  ITTIFAK_VOTE_MS,
  type IttifakPublicView,
  type IttifakView,
  ittifak,
  ittifakReveal,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: ittifak.id,
  name: ittifak.name,
  minPlayers: ittifak.minPlayers,
  maxPlayers: ittifak.maxPlayers,
  orientation: "portrait",
};

export function startIttifakMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
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
  const now = Date.now();
  const stage = kind.includes("reveal") ? "reveal" : kind.includes("vote") ? "vote" : "talk";
  const startedAt =
    stage === "reveal"
      ? now - ITTIFAK_TALK_MS - ITTIFAK_VOTE_MS - 300
      : stage === "vote"
        ? now - ITTIFAK_TALK_MS - 4_000
        : now - 12_000;
  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  const chosenParam = params.get("chosen");
  let myVote: string | null =
    stage === "vote" && (chosenParam !== null || kind.includes("locked"))
      ? `p${Number(chosenParam ?? 1)}`
      : null;
  let myLocked = kind.includes("locked");
  let myPromises: string[] = (params.get("promised") ?? "")
    .split(",")
    .filter((s) => s !== "")
    .map((s) => `p${Number(s)}`)
    .filter((id) => participants.includes(id) && id !== SELF)
    .slice(0, ITTIFAK_MAX_PROMISES);
  /** Açılışta gösterilen sözler: sen p1'e (tutuldu) ve p2'ye (bozuldu); `many`: herkes 2 kişiye. */
  const promisesMock = (): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    if (params.get("promises") === "many") {
      participants.forEach((id, i) => {
        const a = participants[(i + 1) % participants.length] as string;
        const b = participants[(i + 2) % participants.length] as string;
        out[id] = [a, b].filter((x) => x !== id);
      });
      return out;
    }
    out[SELF] = participants.filter((id) => id !== SELF).slice(0, 2);
    if (participants.includes("p1") && participants.includes("p3")) out.p1 = ["p0", "p3"];
    return out;
  };
  const readyIds2 = (): string[] => {
    if (stage === "reveal") return [];
    if (myLocked || spectator) {
      const others = participants.filter((id) => id !== SELF).slice(0, spectator ? 2 : Math.floor(n / 2) - 1);
      return spectator ? others : [SELF, ...others];
    }
    return [];
  };
  let rev = 1;

  const votes = (): Record<string, string> => {
    // p1 ve p2 sana (p0) oy verir; kalanlar p1'e. Sıfır vakasında kimse p0'a oy vermez.
    const zero = kind.includes("zero");
    const out: Record<string, string> = {};
    participants.forEach((id, i) => {
      if (id === "p1") out[id] = zero ? "p2" : "p0";
      else if (id === "p2") out[id] = zero ? "p1" : "p0";
      else if (id === "p0") out[id] = "p1";
      else out[id] = i % 2 === 0 ? "p1" : zero ? "p2" : "p3";
    });
    for (const id of participants) if (out[id] === id) out[id] = "p1" === id ? "p2" : "p1";
    return out;
  };

  const build = (): { pub: IttifakPublicView; priv: IttifakView } => ({
    pub: {
      players: participants,
      phase: stage,
      startedAt,
      talkEndsAt: startedAt + ITTIFAK_TALK_MS,
      voteEndsAt: startedAt + ITTIFAK_TALK_MS + ITTIFAK_VOTE_MS,
      finishAt: startedAt + ITTIFAK_DURATION_MS,
      ready: readyIds2(),
      reveal: stage === "reveal" ? ittifakReveal(participants, votes(), promisesMock()) : null,
    },
    priv: {
      myVote: spectator ? null : stage === "reveal" ? (votes()[SELF] ?? null) : myVote,
      myPromises: spectator ? [] : stage === "reveal" ? (promisesMock()[SELF] ?? []) : myPromises,
      locked: !spectator && stage !== "reveal" && myLocked,
    },
  });
  void ITTIFAK_REVEAL_MS;

  const snapshot = (): RoomSnapshot => {
    if (kind === "ittifak-briefing") {
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
      briefing: { goal: ittifak.briefing.goal, steps: [...ittifak.briefing.steps] },
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
    const payload = msg.payload as { kind?: string; target?: string; on?: boolean } | null;
    if (payload?.kind === "promise" && typeof payload.target === "string" && stage === "talk") {
      const target = payload.target;
      if (payload.on === true) {
        if (myPromises.length >= ITTIFAK_MAX_PROMISES || myPromises.includes(target)) return;
        myPromises = [...myPromises, target];
      } else myPromises = myPromises.filter((id) => id !== target);
      applySnapshot(snapshot());
      return;
    }
    if (payload?.kind === "skip" || (payload?.kind === "lock" && myVote !== null)) {
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
