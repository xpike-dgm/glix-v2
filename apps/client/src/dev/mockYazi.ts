/**
 * Yalnız geliştirme önizlemesi: Yazı Yaz ekranları (`&n=3..8` oyuncu sayısı, `&role=writer|innocent`).
 *   ?mock=yazi-briefing         anlatım
 *   ?mock=yazi-write            yazma (yazan ve masumun ekranı aynı); yazınca Tamam açılır
 *   ?mock=yazi-write-locked     Tamam denildi, diğerleri bekleniyor
 *   ?mock=yazi-talk             sözlü tartışma
 *   ?mock=yazi-talk-locked      "Tahmine geçelim" denildi
 *   ?mock=yazi-guess            tahmin (`&chosen=1` seçili başlar)
 *   ?mock=yazi-guess-locked     tahmin kilitli
 *   ?mock=yazi-reveal           sonuç (`yazi-reveal-zero`: hiç puan yok)
 *   ?mock=yazi-spectator-write | -talk | -guess | -reveal   katılımcı değilsin
 */
import type {
  GameInfo,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
  YaziYazPublicView,
  YaziYazReveal,
  YaziYazRole,
  YaziYazStage,
  YaziYazView,
} from "@glix/engine";
import {
  YAZI_YAZ_DURATION_MS,
  YAZI_YAZ_GUESS_MS,
  YAZI_YAZ_TALK_MS,
  YAZI_YAZ_WRITE_MS,
  yaziYaz,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: yaziYaz.id,
  name: yaziYaz.name,
  minPlayers: yaziYaz.minPlayers,
  maxPlayers: yaziYaz.maxPlayers,
  orientation: "portrait",
};

export function startYaziMock(kind: string, params: URLSearchParams): void {
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
  const stage: YaziYazStage = kind.includes("reveal")
    ? "reveal"
    : kind.includes("guess")
      ? "guess"
      : kind.includes("talk")
        ? "talk"
        : "write";
  const role: YaziYazRole = params.get("role") === "writer" ? "writer" : "innocent";
  const writers = role === "writer" ? [SELF, "p1"] : ["p1", "p2"];
  const now = Date.now();
  const offset: Record<YaziYazStage, number> = {
    write: 9_000,
    talk: YAZI_YAZ_WRITE_MS + 14_000,
    guess: YAZI_YAZ_WRITE_MS + YAZI_YAZ_TALK_MS + 8_000,
    reveal: YAZI_YAZ_WRITE_MS + YAZI_YAZ_TALK_MS + YAZI_YAZ_GUESS_MS + 300,
  };
  const startedAt = now - offset[stage];
  const writeEndsAt = startedAt + YAZI_YAZ_WRITE_MS;
  const talkEndsAt = writeEndsAt + YAZI_YAZ_TALK_MS;
  const guessEndsAt = talkEndsAt + YAZI_YAZ_GUESS_MS;

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let locked = kind.includes("locked");
  const chosenParam = params.get("chosen");
  let text: string | null =
    kind.includes("locked") && stage === "write" ? (role === "writer" ? "IŞIK" : "MASUM") : null;
  let guessTarget: string | null =
    stage === "guess" && (chosenParam !== null || kind.includes("locked"))
      ? `p${Number(chosenParam ?? 1)}`
      : null;
  let guessWord = stage === "guess" && kind.includes("locked") ? "KEDİ" : "";
  let rev = 1;

  const others = participants.filter((id) => id !== SELF);
  const readyList = (): string[] => {
    if (stage === "reveal") return [];
    if (locked || spectator) {
      const some = others.slice(0, spectator ? 2 : Math.max(1, Math.floor(n / 2) - 1));
      return spectator ? some : [SELF, ...some];
    }
    return [];
  };

  const reveal = (): YaziYazReveal => {
    const zero = kind.includes("zero");
    const words: Record<string, string> = { [writers[0] as string]: "IŞIK", [writers[1] as string]: "KEDİ" };
    const guesses: YaziYazReveal["guesses"] = {};
    const scores: Record<string, number> = {};
    participants.forEach((id, i) => {
      const w1 = writers[0] as string;
      const w2 = writers[1] as string;
      let target: string | null;
      let word = "";
      if (zero && id === SELF) target = participants.find((p) => p !== SELF && !writers.includes(p)) ?? null;
      else if (id === SELF) target = id === w1 ? w2 : w1;
      else if (i % 4 === 3) target = null;
      else target = i % 2 === 0 ? w1 : id === w1 ? w2 : w2;
      if (target === id) target = id === w1 ? w2 : w1;
      if (target !== null) word = i % 3 === 0 ? (words[target] ?? "") : i % 3 === 1 ? "KÖPEK" : "";
      if (id === SELF && !zero) word = target !== null ? (words[target] ?? "") : "";
      if (id === SELF && zero) word = "ELMA";
      const personOk = target !== null && writers.includes(target) && target !== id;
      const wordOk = personOk && word !== "" && target !== null && words[target] === word;
      guesses[id] = { target, word, personOk, wordOk };
      scores[id] = (personOk ? 1 : 0) + (wordOk ? 1 : 0);
    });
    return { writers, words, guesses, scores };
  };

  const build = (): { pub: YaziYazPublicView; priv: YaziYazView } => ({
    pub: {
      players: participants,
      stage,
      startedAt,
      writeEndsAt,
      talkEndsAt,
      guessEndsAt,
      finishAt: startedAt + YAZI_YAZ_DURATION_MS,
      ready: readyList(),
      reveal: stage === "reveal" ? reveal() : null,
    },
    priv: spectator
      ? { role: null, myText: null, locked: false, myGuess: { target: null, word: "" } }
      : {
          role,
          myText: stage === "write" ? text : null,
          locked: stage !== "reveal" && locked,
          myGuess: { target: guessTarget, word: guessWord },
        },
  });

  const snapshot = (): RoomSnapshot => {
    if (kind === "yazi-briefing") {
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
      briefing: { goal: yaziYaz.briefing.goal, steps: [...yaziYaz.briefing.steps] },
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
      catalog: [INFO],
      match,
    };
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    const p = msg.payload as { kind?: string; target?: string; text?: string } | null;
    if (!p || locked) return;
    if (p.kind === "write" && typeof p.text === "string") text = p.text;
    else if (p.kind === "guessPlayer" && typeof p.target === "string") guessTarget = p.target;
    else if (p.kind === "guessWord" && typeof p.text === "string") guessWord = p.text;
    else if (
      p.kind === "skip" ||
      (p.kind === "lock" && (stage === "write" ? text !== null : guessTarget !== null))
    ) {
      locked = true;
    } else return;
    applySnapshot(snapshot());
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
