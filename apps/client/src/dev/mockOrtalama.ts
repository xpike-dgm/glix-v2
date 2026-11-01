/**
 * Yalnız geliştirme önizlemesi: Ortalamaya En Yakın ekranları (`&n=3..8` oyuncu sayısı). Durum gerçek motorla
 * (`ortalamaninYarisi.publicView`) üretilir; sayılar örnek.
 *   ?mock=ortalama-briefing          anlatım
 *   ?mock=ortalama-card              tur kartı (OY-U3; `&tur=2` ⅔)
 *   ?mock=ortalama-choosing          seçim; sayı yolu çalışır (`&chosen=0` ile seçimsiz başlar)
 *   ?mock=ortalama-last              son 3 saniye, seçim yok (OY-U4)
 *   ?mock=ortalama-locked            sayın mühürlü, diğerleri bekleniyor
 *   ?mock=ortalama-reveal            sonuç (`&me=2` ile hangi oyuncu "sen" olur; `&t=1500` açılışın kaçıncı ms'si)
 *   ?mock=ortalama-reveal-tie        sonuç: en yakınlar eşit (+1)
 *   ?mock=ortalama-reveal-burn       sonuç: üç kişi aynı sayıda, YANDI (OY-M1)
 *   ?mock=ortalama-reveal-random     sonuç: biri seçmedi, 🎲 rastgele (OY-M2)
 *   ?mock=ortalama-reveal-late       sonuç animasyonu bitmiş (geç açılan ekran)
 *   ?mock=ortalama-spectator         katılımcı değilsin (`&tur=2` ile önceki turlar ve tablo)
 *   ?mock=ortalama-off               bir oyuncunun bağlantısı kopuk (OY-U14)
 *   ?mock=ortalama-choosing&tur=2    2. tur seçimi: ⅔; önceki turun çizgileri ve kapsüllerde geçen tur
 *   ?mock=ortalama-reveal&tur=2      2. turun sonucu (ara tur; son 1 sn'de özet: `&t=4300`)
 *   ?mock=ortalama-reveal&tur=3      son tur: `&t=6000` ile üç turun tablosu
 */

import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import {
  createRng,
  ORTALAMA_CHOOSE_MS,
  ORTALAMA_INTRO_MS,
  ORTALAMA_REVEAL_MS,
  ORTALAMA_ROUND_REVEAL_MS,
  ORTALAMA_ROUNDS,
  type OrtalamaPublicView,
  type OrtalamaRoundState,
  type OrtalamaState,
  type OrtalamaView,
  ortalamaninYarisi,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: ortalamaninYarisi.id,
  name: ortalamaninYarisi.name,
  minPlayers: ortalamaninYarisi.minPlayers,
  maxPlayers: ortalamaninYarisi.maxPlayers,
  orientation: "portrait",
};
const SPREAD = [22, 31, 64, 18, 47, 9, 80, 35];
const TIED = [20, 40, 20, 70, 55, 90, 64, 81];
const BURN = [12, 30, 30, 30, 47, 9, 80, 35];

export function startOrtalamaMock(kind: string, params: URLSearchParams, tv = false): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(kind === "ortalama-off" && i === 2),
    score: 0,
    spectator: false,
  }));
  const spectator = tv || kind.endsWith("spectator");
  const me = `p${Math.min(n - 1, Math.max(0, Number(params.get("me")) || 0))}`;
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const now = Date.now();
  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let myChoice: number | null = params.get("chosen") === "0" || kind === "ortalama-last" ? null : 30;
  let locked = kind === "ortalama-locked";
  let rev = 1;
  const revealed = kind.startsWith("ortalama-reveal");
  const late = kind.endsWith("late");
  const roundNo = Math.min(3, Math.max(1, Number(params.get("tur")) || 1));
  const roundIdx = roundNo - 1;
  const len = (r: number) =>
    ORTALAMA_INTRO_MS +
    ORTALAMA_CHOOSE_MS +
    (r === ORTALAMA_ROUNDS - 1 ? ORTALAMA_REVEAL_MS : ORTALAMA_ROUND_REVEAL_MS);
  const roundStart = (r: number): number =>
    Array.from({ length: r }, (_, k) => len(k)).reduce((a, b) => a + b, 0);
  const roundEnd = (r: number): number => roundStart(r) + ORTALAMA_INTRO_MS + ORTALAMA_CHOOSE_MS;
  // Gösterilen anın, oyunun başlangıcına göre konumu.
  const tParam = Number(params.get("t"));
  const at = revealed
    ? roundEnd(roundIdx) + (late ? 9_000 : Number.isFinite(tParam) && params.has("t") ? tParam : 300)
    : kind === "ortalama-card"
      ? roundStart(roundIdx) + 200
      : kind === "ortalama-last"
        ? roundEnd(roundIdx) - 2_400
        : roundStart(roundIdx) + ORTALAMA_INTRO_MS + 4_000;
  const startedAt = now - at;

  const ROUND_VALUES = [
    kind.includes("tie") ? TIED : kind.includes("burn") ? BURN : SPREAD,
    [60, 12, 48, 70, 25, 33, 90, 41],
    [18, 52, 30, 44, 8, 66, 27, 59],
  ];

  const state = (): OrtalamaState => {
    const rounds: OrtalamaRoundState[] = Array.from({ length: ORTALAMA_ROUNDS }, (_, k) => ({
      startAt: startedAt + roundStart(k),
      chooseAt: startedAt + roundStart(k) + ORTALAMA_INTRO_MS,
      endsAt: startedAt + roundEnd(k),
      revealEndsAt: startedAt + roundStart(k) + len(k),
      choices: {},
      locked: [],
      fallback: Object.fromEntries(participants.map((id, i) => [id, (i * 37 + 74) % 101])),
    }));
    for (let k = 0; k <= roundIdx; k++) {
      const v = ROUND_VALUES[k] ?? SPREAD;
      const c: Record<string, number> = {};
      participants.forEach((id, i) => {
        // Rastgele örneği: 2. oyuncu seçmez; geçmiş turlarda da biri bir kez seçmemiş olsun.
        if ((kind.includes("random") && k === roundIdx && i === 1) || (k < roundIdx && k === 0 && i === 3))
          return;
        c[id] = v[i] ?? 50;
      });
      if (k === roundIdx && !revealed && !spectator) {
        if (myChoice === null) delete c[me];
        else c[me] = myChoice;
      }
      const slot = rounds[k];
      if (slot) slot.choices = c;
    }
    return {
      players: participants,
      startedAt,
      rounds,
      revealed: roundIdx + (revealed ? 1 : 0),
      shown: roundIdx,
    };
  };

  const build = (): { pub: OrtalamaPublicView; priv: OrtalamaView } => {
    const st = state();
    const pub = ortalamaninYarisi.publicView(st, { now: Date.now(), rng: createRng(1), connected: [] });
    const others = participants.filter((id, i) => id !== me && i % 2 === 1);
    // Önizlemede tur kartı yerinde dursun (gerçekte 0,9 sn).
    if (kind.endsWith("card")) pub.roundStartedAt = Date.now() + 600_000;
    return {
      pub: {
        ...pub,
        lockedIds: [...(locked && !spectator ? [me] : []), ...(locked || spectator ? others : [])],
      },
      priv: { myChoice: spectator ? null : myChoice, locked: !spectator && locked },
    };
  };

  const snapshot = (): RoomSnapshot => {
    if (kind === "ortalama-briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = now + 40_000;
    }
    const { pub, priv } = build();
    const lastRevealed = revealed && roundIdx === ORTALAMA_ROUNDS - 1;
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: ortalamaninYarisi.briefing.goal, steps: [...ortalamaninYarisi.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      continueIds: [],
      phaseStartedAt: startedAt,
      phaseEndsAt,
      publicView: pub,
      view: priv,
      result: null,
      ...(lastRevealed
        ? { reveal: { startedAt: startedAt + roundEnd(roundIdx), endsAt: now + 60_000, continueIds: [] } }
        : {}),
    };
    return {
      rev: ++rev,
      serverNow: Date.now(),
      code: "KX7QP",
      hostId: SELF,
      selfId: spectator ? SELF : me,
      phase,
      players,
      gameIds: [INFO.id],
      selection: { mode: "manual" },
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
    const payload = msg.payload as { kind?: string; value?: number } | null;
    if (payload?.kind === "lock" && myChoice !== null) {
      locked = true;
      applySnapshot(snapshot());
    }
    if (payload?.kind === "choose" && typeof payload.value === "number" && !locked) {
      myChoice = payload.value;
      applySnapshot(snapshot());
    }
  });
  setState("session", { token: "mock", playerId: spectator ? SELF : me, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
