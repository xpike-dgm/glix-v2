/**
 * Yalnız geliştirme önizlemesi: Kendim ekranları (`&n=3..8` oyuncu sayısı).
 *   ?mock=kendim-briefing        anlatım
 *   ?mock=kendim-write           yazma; yazınca Tamam açılır
 *   ?mock=kendim-write-locked    Tamam denildi
 *   ?mock=kendim-match           eşleştirme (karta dokun, kişiyi seç); `&paired=2` kaç kartın eşi başlangıçta var
 *   ?mock=kendim-match-locked    eşleştirme kilitli
 *   ?mock=kendim-reveal          sonuç (`kendim-reveal-negative`: eksi puan)
 *   ?mock=kendim-spectator-write | -match | -reveal   katılımcı değilsin
 */
import type {
  GameInfo,
  KendimPublicView,
  KendimReveal,
  KendimView,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
} from "@glix/engine";
import { KENDIM_DURATION_MS, KENDIM_MATCH_MS, KENDIM_WRITE_MS, kendim } from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const WORDS = ["ÇAY", "GÜNEŞ", "KARAKTERLİ", "SAKİN", "FIRTINA", "KEDİ", "ÇİKOLATA", "NEŞE"];
const SELF = "p0";
const INFO: GameInfo = {
  id: kendim.id,
  name: kendim.name,
  minPlayers: kendim.minPlayers,
  maxPlayers: kendim.maxPlayers,
  orientation: "portrait",
};

export function startKendimMock(kind: string, params: URLSearchParams): void {
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
  const stage = kind.includes("reveal") ? "reveal" : kind.includes("match") ? "match" : "write";
  const now = Date.now();
  const offset = {
    write: 9_000,
    match: KENDIM_WRITE_MS + 9_000,
    reveal: KENDIM_WRITE_MS + KENDIM_MATCH_MS + 300,
  };
  const startedAt = now - offset[stage];
  const writeEndsAt = startedAt + KENDIM_WRITE_MS;
  const matchEndsAt = writeEndsAt + KENDIM_MATCH_MS;

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let locked = kind.includes("locked");
  let text: string | null = kind.includes("write-locked") ? "BEN" : null;
  const wordOf = (id: string): string => WORDS[Number(id.slice(1)) % WORDS.length] as string;
  // Kart numaraları karışık: sahipler p3,p1,p4,p2,... gibi.
  const order = participants
    .filter((id) => id !== "x")
    .slice()
    .sort((a, b) => ((Number(a.slice(1)) * 5 + 3) % 11) - ((Number(b.slice(1)) * 5 + 3) % 11));
  const cards = order.map((owner, id) => ({ id, owner, text: wordOf(owner) }));
  const myCards = cards.filter((c) => c.owner !== SELF).map(({ id, text: t }) => ({ id, text: t }));
  const pairedParam = Number(params.get("paired") ?? (kind.includes("locked") ? 2 : 0));
  const myPairs: Record<string, string> = {};
  for (const c of cards.filter((x) => x.owner !== SELF).slice(0, pairedParam)) {
    const wrong = c.owner === "p1" ? "p2" : "p1";
    myPairs[String(c.id)] = Object.keys(myPairs).length === 1 ? wrong : c.owner;
  }
  let rev = 1;

  const readyList = (): string[] => {
    if (stage === "reveal") return [];
    if (locked || spectator) {
      const others = participants
        .filter((id) => id !== SELF)
        .slice(0, spectator ? 2 : Math.max(1, Math.floor(n / 2) - 1));
      return spectator ? others : [SELF, ...others];
    }
    return [];
  };

  const reveal = (): KendimReveal => {
    const negative = kind.includes("negative");
    const pairs: KendimReveal["pairs"] = {};
    const scores: Record<string, number> = {};
    for (const id of participants) pairs[id] = [];
    for (const c of cards) {
      if (c.owner === SELF) continue;
      const ok = !negative && c.id % 2 === 0;
      const target = ok ? c.owner : c.owner === "p1" ? "p2" : "p1";
      pairs[SELF]?.push({ card: c.id, target, ok });
    }
    cards.forEach((c, i) => {
      if (c.owner === SELF) return;
      const other = participants[(i + 2) % participants.length] as string;
      if (other !== c.owner && other !== SELF && c.id % 3 === 0)
        pairs[other]?.push({ card: c.id, target: c.owner, ok: true });
    });
    for (const id of participants) {
      scores[id] = (pairs[id] ?? []).reduce((s, p) => s + (p.ok ? 1 : -1), 0);
    }
    const revCards = cards.map((c) => {
      const finders = participants.filter((id) => (pairs[id] ?? []).some((p) => p.card === c.id && p.ok));
      const bonus = finders.length === 1 && (pairs[c.owner]?.length ?? 0) > 0;
      if (bonus) scores[c.owner] = (scores[c.owner] ?? 0) + 1;
      return { id: c.id, text: c.text, owner: c.owner, finders, bonus };
    });
    const top = Math.max(...participants.map((id) => scores[id] ?? 0));
    return {
      cards: revCards,
      pairs,
      scores,
      winners: top > 0 ? participants.filter((id) => scores[id] === top) : [],
    };
  };

  const build = (): { pub: KendimPublicView; priv: KendimView } => ({
    pub: {
      players: participants,
      stage,
      startedAt,
      writeEndsAt,
      matchEndsAt,
      finishAt: startedAt + KENDIM_DURATION_MS,
      ready: readyList(),
      owners: stage === "write" ? [] : participants,
      reveal: stage === "reveal" ? reveal() : null,
    },
    priv: spectator
      ? { myText: null, locked: false, cards: [], myPairs: {} }
      : {
          myText: stage === "write" ? text : null,
          locked: stage !== "reveal" && locked,
          cards: stage === "write" ? [] : myCards,
          myPairs: stage === "match" ? myPairs : {},
        },
  });

  const snapshot = (): RoomSnapshot => {
    if (kind === "kendim-briefing") {
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
      briefing: { goal: kendim.briefing.goal, steps: [...kendim.briefing.steps] },
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
      joinPolicy: "izleyici",
      lobbyReady: [],
      catalog: [INFO],
      match,
    };
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    const p = msg.payload as { kind?: string; card?: number; target?: string | null; text?: string } | null;
    if (!p || locked) return;
    if (p.kind === "write" && typeof p.text === "string") text = p.text;
    else if (p.kind === "lock" && (stage === "match" || text !== null)) locked = true;
    else if (p.kind === "match" && typeof p.card === "number") {
      if (p.target === null || p.target === undefined) delete myPairs[String(p.card)];
      else {
        for (const [k, v] of Object.entries(myPairs)) if (v === p.target) delete myPairs[k];
        myPairs[String(p.card)] = p.target;
      }
    } else return;
    applySnapshot(snapshot());
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
