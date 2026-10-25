/**
 * Yalnız geliştirme önizlemesi: Sözlük Blöfü ekranları (`&n=3..8` oyuncu sayısı).
 *   ?mock=sozluk-briefing          anlatım
 *   ?mock=sozluk-write             sahte tanım yazma (gerçeğin aynısı: "gerçek anlam" yazınca dostça ret)
 *   ?mock=sozluk-write-locked      yazma: tanımın gönderildi, diğerleri bekleniyor
 *   ?mock=sozluk-pick              kartlardan seçme; dokununca seçilir (`&chosen=1` seçili başlar)
 *   ?mock=sozluk-pick-locked       seçme: sen "Tamam" dedin
 *   ?mock=sozluk-reveal            kartlar açıldı (`&me=none` hiç puan almadın)
 *   ?mock=sozluk-spectator-write | -pick | -reveal   katılımcı değilsin
 */
import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import {
  SOZLUK_PICK_MS,
  SOZLUK_REVEAL_MS,
  SOZLUK_WRITE_MS,
  type SozlukCard,
  type SozlukPublicView,
  type SozlukReveal,
  type SozlukView,
  sozlukBlofu,
} from "@glix/engine";
import { mockAck, useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: sozlukBlofu.id,
  name: sozlukBlofu.name,
  minPlayers: sozlukBlofu.minPlayers,
  maxPlayers: sozlukBlofu.maxPlayers,
  orientation: "portrait",
};
const WORD = "ŞAKUL";
const REAL = "duvarın dikliğini ölçmek için kullanılan, ucunda ağırlık bulunan ip";
const BLUFFS = [
  "eski zamanlarda köylerde kullanılan kil testi",
  "denizcilerin fırtınada taktığı kalın yün atkı",
  "yüksek dağlarda yaşayan, boynuzlu yabani keçi",
  "kumaş boyamak için kullanılan koyu mavi bitki",
  "kapı ve pencere kasalarının çevresine çakılan çıta",
  "ağır yükleri kaldırmaya yarayan makara düzeneği",
  "çok uzun, akıcı ve tatlı konuşan kimse; sözü uzatıp dolaştıran kişi",
];

export function startSozlukMock(kind: string, params: URLSearchParams): void {
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
  const stage = kind.includes("reveal") ? "reveal" : kind.includes("pick") ? "pick" : "write";
  const startedAt =
    stage === "write"
      ? now - 8_000
      : now - SOZLUK_WRITE_MS - (stage === "pick" ? 6_000 : 300 + SOZLUK_PICK_MS);
  const writeEndsAt = startedAt + SOZLUK_WRITE_MS;
  const pickEndsAt = writeEndsAt + SOZLUK_PICK_MS;
  const finishAt = pickEndsAt + SOZLUK_REVEAL_MS;

  // Kartlar: her yazan (sen dahil, izleyici değilsen) bir sahte tanım yazmış; sıra karışık.
  const writers = participants.slice(0, Math.max(1, participants.length - (n >= 5 ? 1 : 0)));
  const authors: Record<string, string> = {};
  const cards: SozlukCard[] = [];
  const order: (string | null)[] = [];
  writers.forEach((id, i) => {
    order.push(id);
    if (i === 1) order.push(null); // gerçek kart araya
  });
  if (!order.includes(null)) order.push(null);
  let bluffNo = 0;
  order.forEach((who, i) => {
    const id = `k${i + 1}`;
    if (who === null) cards.push({ id, text: REAL });
    else {
      cards.push({ id, text: BLUFFS[bluffNo++ % BLUFFS.length] as string });
      authors[id] = who;
    }
  });
  const realCard = cards.find((c) => c.text === REAL)?.id ?? "k1";
  const myCard = Object.entries(authors).find(([, a]) => a === SELF)?.[0] ?? null;
  const cardOfAuthor = (a: string): string | undefined =>
    Object.entries(authors).find(([, x]) => x === a)?.[0];

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  const chosenParam = params.get("chosen");
  const pickable = cards.filter((c) => c.id !== myCard);
  let myPick: string | null =
    stage === "pick" && (chosenParam !== null || kind.includes("locked"))
      ? (pickable[Number(chosenParam ?? 1) % pickable.length]?.id ?? null)
      : null;
  let myLocked = kind.includes("locked");
  let myBluff: string | null = kind === "sozluk-write-locked" ? "bir tür eski kayık" : null;

  const readyList = (): string[] => {
    if (stage === "reveal") return [];
    if (stage === "write") {
      const others = participants.filter((id) => id !== SELF).slice(0, spectator ? 2 : Math.floor(n / 2));
      return myBluff !== null && !spectator ? [SELF, ...others] : spectator ? others : [];
    }
    if (myLocked || spectator) {
      const others = participants.filter((id) => id !== SELF).slice(0, spectator ? 2 : Math.floor(n / 2) - 1);
      return spectator ? others : [SELF, ...others];
    }
    return [];
  };

  const picks = (): Record<string, string> => {
    const out: Record<string, string> = {};
    const noneForMe = params.get("me") === "none";
    participants.forEach((id, i) => {
      const options = cards.filter((c) => authors[c.id] !== id);
      let target = options[i % options.length] as SozlukCard;
      // Sana (p0) birkaç oy: p1 gerçeği, p2 ve p3 senin kartını seçsin.
      if (!noneForMe && myCard !== null && (id === "p2" || id === "p3")) target = { id: myCard, text: "" };
      if (id === "p1") target = { id: realCard, text: "" };
      if (id === SELF) target = { id: realCard, text: "" };
      if (noneForMe && target.id === myCard) target = { id: realCard, text: "" };
      out[id] = target.id;
    });
    return out;
  };

  const reveal = (): SozlukReveal => {
    const p = picks();
    const scores: Record<string, number> = {};
    for (const id of participants) scores[id] = 0;
    for (const [pid, card] of Object.entries(p)) {
      if (card === realCard) scores[pid] = (scores[pid] ?? 0) + 1;
      else {
        const owner = authors[card];
        if (owner) scores[owner] = (scores[owner] ?? 0) + 1;
      }
    }
    return { realCard, authors, picks: p, scores };
  };
  void cardOfAuthor;

  const build = (): { pub: SozlukPublicView; priv: SozlukView } => ({
    pub: {
      players: participants,
      phase: stage,
      word: WORD,
      startedAt,
      writeEndsAt,
      pickEndsAt,
      finishAt,
      ready: readyList(),
      cards: stage === "write" ? null : cards,
      reveal: stage === "reveal" ? reveal() : null,
    },
    priv: {
      myBluff: spectator ? null : stage === "write" ? myBluff : myCard === null ? null : "(senin tanımın)",
      myCard: spectator || stage === "write" ? null : myCard,
      myPick: spectator ? null : stage === "reveal" ? (picks()[SELF] ?? null) : myPick,
      locked: !spectator && stage !== "reveal" && (stage === "write" ? myBluff !== null : myLocked),
    },
  });

  let rev = 1;
  const snapshot = (): RoomSnapshot => {
    if (kind === "sozluk-briefing") {
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
      briefing: { goal: sozlukBlofu.briefing.goal, steps: [...sozlukBlofu.briefing.steps] },
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
    const payload = msg.payload as { kind?: string; text?: string; card?: string } | null;
    if (payload?.kind === "bluff" && typeof payload.text === "string") {
      const same =
        payload.text
          .trim()
          .toLocaleLowerCase("tr-TR")
          .replace(/[.\s]+$/u, "") === REAL;
      const key = payload.text.trim().toLocaleLowerCase("tr-TR");
      if (key === "gerçek anlam" || same) {
        mockAck(msg.seq, { ok: false, reason: "same_as_real" });
        return;
      }
      myBluff = payload.text.replace(/\s+/gu, " ").trim();
      mockAck(msg.seq, { ok: true });
      applySnapshot(snapshot());
      return;
    }
    if (payload?.kind === "lock" && myPick !== null) {
      myLocked = true;
      applySnapshot(snapshot());
      return;
    }
    if (
      payload?.kind === "pick" &&
      typeof payload.card === "string" &&
      !myLocked &&
      payload.card !== myCard
    ) {
      myPick = payload.card;
      applySnapshot(snapshot());
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
