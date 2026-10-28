/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez; App.tsx `import.meta.env.DEV` ile korur).
 * Kart sistemi ekranlarını sahte verilerle açar: `?mock=kart-<durum>` (TV için `mock=tv-kart-<durum>`; `&n=8` oyuncu sayısı).
 *   kart-secim | kart-secim-4 | kart-secim-kor | kart-secim-secti | kart-secim-degistir | kart-secim-sessiz
 *   kart-secim-kotu | kart-secim-izleyici | kart-secim-kotu-kart | kart-secim-kumarbaz | kart-secim-uzun
 *   kart-anlatim | kart-anlatim-oynadi | kart-anlatim-bos
 *   kart-geri-sayim | kart-sonuc | kart-sonuc-bos
 */
import type {
  CardId,
  CardLine,
  CardsMine,
  CardsPublic,
  GameInfo,
  MatchSnapshot,
  PlayerInfo,
  PublicPlay,
  RoomPhase,
  RoomSnapshot,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";

const CATALOG: GameInfo[] = [
  { id: "butona-bas", name: "Butona Bas", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  { id: "kor-bomba", name: "Kör Bomba", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  { id: "cagrisim-agi", name: "Çağrışım Ağı", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  { id: "kule-ustasi", name: "Kule Ustası", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  { id: "son-kisi", name: "Son Kişi", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  { id: "zehirli-kadeh", name: "Zehirli Kadeh", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
];

const BRIEFING = {
  goal: "Aynı anda büyük kırmızı butona basarak eşleşme yakala.",
  steps: [
    "Büyük kırmızı butonu hazırla.",
    "Aynı kısa zamanda arkadaşlarınla bas.",
    "Grup basışı puan verir, tek basış geri teper.",
  ],
};

const SCORES = [6, 5, 4, 3, 2, 1, 1, 0];

export function startKartMock(rawKind: string, params: URLSearchParams): void {
  const kind = rawKind.startsWith("tv-") ? rawKind.slice(3) : rawKind;
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const spectator = kind === "kart-secim-izleyici";
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: SCORES[i] ?? 0,
    spectator: spectator && i === 0,
  }));
  const participants = players.filter((p) => !p.spectator).map((p) => p.id);
  const now = Date.now();
  const others = participants.filter((id) => id !== SELF);

  let phase: RoomPhase = "cards";
  let phaseStartedAt = now - 3_000;
  let phaseEndsAt: number | null = now + 12_000;
  let publicCards: CardsPublic = {
    phase: { done: others.slice(0, 2), silenced: [] },
    hands: Object.fromEntries(participants.map((id) => [id, id === SELF ? 2 : id === "p2" ? 1 : 0])),
    announce: [],
    plays: [],
    lines: [],
  };
  let mine: CardsMine | null = {
    hand: [],
    gameOptions: { veto: [], pick: [] },
    pick: {
      options: ["takviye", "celme", "cift-puan"],
      blind: false,
      taken: [],
      total: 1,
      got: [],
      held: null,
      silenced: false,
      done: false,
    },
    staged: null,
    played: null,
  };
  let result: MatchSnapshot["result"] = null;
  const pickState = (patch: Partial<NonNullable<CardsMine["pick"]>>): CardsMine["pick"] => ({
    ...(mine?.pick as NonNullable<CardsMine["pick"]>),
    ...patch,
  });
  const gamesLeft = CATALOG.slice(1, 4).map((g) => ({ id: g.id, name: g.name }));

  switch (kind) {
    case "kart-secim":
      break;
    case "kart-secim-4":
      mine = {
        ...(mine as CardsMine),
        hand: ["kalkan"],
        pick: pickState({ options: ["takviye", "talihsizlik", "cift-puan", "ters-kose"] }),
      };
      break;
    case "kart-secim-kor":
      mine = { ...(mine as CardsMine), pick: pickState({ blind: true, options: [null, null, null] }) };
      break;
    case "kart-secim-secti":
      mine = {
        ...(mine as CardsMine),
        hand: ["koruma"],
        pick: pickState({ taken: [1], got: ["koruma"], done: true, options: ["takviye", null, "cift-puan"] }),
      };
      publicCards = { ...publicCards, phase: { done: [SELF, ...others.slice(0, 2)], silenced: [] } };
      break;
    case "kart-secim-degistir":
      mine = {
        ...(mine as CardsMine),
        hand: ["kalkan", "ayna"],
        pick: pickState({
          taken: [1],
          got: ["celme"],
          held: "celme",
          options: ["takviye", null, "cift-puan"],
        }),
      };
      break;
    case "kart-secim-sessiz":
      mine = {
        ...(mine as CardsMine),
        hand: ["kalkan"],
        pick: pickState({ silenced: true, done: true, options: [], total: 0 }),
      };
      publicCards = { ...publicCards, phase: { done: [SELF, ...others.slice(0, 1)], silenced: [SELF] } };
      break;
    case "kart-secim-kotu":
      mine = {
        ...(mine as CardsMine),
        hand: ["kalkan"],
        pick: pickState({
          taken: [0],
          got: ["lanetli-hediye"],
          done: true,
          options: [null, "celme", "cift-puan"],
        }),
      };
      break;
    case "kart-secim-kotu-kart":
      mine = {
        ...(mine as CardsMine),
        hand: ["kalkan"],
        pick: pickState({ options: ["takviye", "talihsizlik", "cift-puan"] }),
      };
      break;
    case "kart-secim-kumarbaz":
      mine = {
        ...(mine as CardsMine),
        pick: pickState({ total: 2, taken: [1], got: ["celme"], options: ["takviye", null, "ters-kose"] }),
      };
      break;
    case "kart-secim-uzun":
      mine = {
        ...(mine as CardsMine),
        pick: pickState({ options: ["oyunu-sec", "kendine-guven", "lanetli-hediye"] }),
      };
      break;
    case "kart-secim-izleyici":
      mine = null;
      break;
    case "kart-anlatim":
    case "kart-anlatim-oynadi":
    case "kart-anlatim-bos": {
      phase = "briefing";
      phaseStartedAt = now - 8_000;
      phaseEndsAt = now + 32_000;
      publicCards = {
        phase: null,
        hands: publicCards.hands,
        announce: [
          { playerId: "p2", cardId: "talihsizlik" },
          { playerId: "p3", cardId: "kor-secim" },
        ],
        plays: [],
        lines: [],
      };
      const hand: CardId[] = kind === "kart-anlatim-bos" ? [] : ["celme", "veto"];
      mine = {
        hand: kind === "kart-anlatim-oynadi" ? ["veto"] : hand,
        gameOptions: { veto: gamesLeft, pick: CATALOG.slice(0, 4).map((g) => ({ id: g.id, name: g.name })) },
        pick: null,
        staged: kind === "kart-anlatim-oynadi" ? { playerId: SELF, cardId: "celme", target: "p1" } : null,
        played: null,
      };
      break;
    }
    case "kart-geri-sayim": {
      phase = "countdown";
      phaseStartedAt = now - 500;
      phaseEndsAt = now + 2_500;
      const plays: PublicPlay[] = [
        { playerId: "p1", cardId: "celme", target: SELF },
        { playerId: "p2", cardId: "cift-puan" },
        { playerId: "p3", cardId: "veto", gameId: "kor-bomba" },
      ].slice(0, Math.max(1, Math.min(3, n - 1))) as PublicPlay[];
      publicCards = { ...publicCards, phase: null, plays };
      mine = {
        hand: ["koruma"],
        gameOptions: { veto: [], pick: [] },
        pick: null,
        staged: null,
        played: { playerId: SELF, cardId: "ayna" },
      };
      break;
    }
    case "kart-sonuc":
    case "kart-sonuc-bos": {
      phase = "results";
      phaseStartedAt = now - 2_000;
      phaseEndsAt = now + 5_000;
      const lines: CardLine[] =
        kind === "kart-sonuc-bos"
          ? []
          : ([
              { cardId: "cift-puan", owner: "p1", subject: "p1", before: 2, after: 4 },
              { cardId: "celme", owner: "p2", subject: SELF, before: 1, after: 0 },
              { cardId: "koruma", owner: "p3", subject: "p3", before: 1, after: 1, note: "korundu" },
              { cardId: "talihsizlik", owner: "p4", subject: "p4", before: 1, after: 0 },
              { cardId: "ayna", owner: "p1", subject: "p2", before: 1, after: 0, note: "yansidi" },
            ].slice(0, kind === "kart-sonuc" ? 5 : 0) as CardLine[]);
      publicCards = { ...publicCards, phase: null, lines };
      mine = { hand: [], gameOptions: { veto: [], pick: [] }, pick: null, staged: null, played: null };
      const miniScores = Object.fromEntries(
        participants.map((id, i) => [id, (participants.length - i) * 10]),
      );
      const awards = Object.fromEntries(participants.map((id, i) => [id, Math.max(0, 3 - i)]));
      result = { miniScores, awards };
      break;
    }
    default:
      break;
  }
  // Sonuç ekranında puanlar ödülden önceki toplamla tutarlı olsun
  const match: MatchSnapshot = {
    round: 2,
    total: 6,
    gameId: "butona-bas",
    gameName: "Butona Bas",
    briefing: BRIEFING,
    orientation: "portrait",
    participants,
    readyIds: phase === "briefing" ? others.slice(0, 2) : [],
    continueIds: [],
    phaseStartedAt,
    phaseEndsAt,
    publicView: null,
    view: null,
    result,
    cards: publicCards,
    mine,
  };
  const snapshot: RoomSnapshot = {
    rev: 2,
    serverNow: now,
    code: "KX7QP",
    hostId: SELF,
    selfId: SELF,
    phase,
    players,
    gameIds: CATALOG.map((g) => g.id),
    selection: { mode: "manual" },
    joinPolicy: "izleyici",
    cardSettings: { enabled: true, off: [] },
    lobbyReady: [],
    stageCount: 0,
    catalog: CATALOG,
    match,
  };
  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender(() => {});
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot);
}
