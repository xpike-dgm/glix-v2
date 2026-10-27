/**
 * Yalnız geliştirme önizlemesi: Gizli Kareler ekranları (`&n=2..8` oyuncu sayısı).
 *   ?mock=kareler-briefing          anlatım
 *   ?mock=kareler-choosing          1. aşama seçimi; kareler çalışır (`&chosen=0` ile seçimsiz başlar)
 *   ?mock=kareler-locked            1. aşama: sen "Tamam" dedin, diğerleri bekleniyor
 *   ?mock=kareler-reveal            1. aşama sonucu: çakışma + tek kalanlar, 2. aşama sürüyor
 *   ?mock=kareler-reveal-all        1. aşama: herkes aynı karede, oyun biter
 *   ?mock=kareler-reveal-walkover   1. aşama: tek canlı kaldı, rakipsiz +1
 *   ?mock=kareler-choosing2         2. aşama seçimi (hayattasın)
 *   ?mock=kareler-choosing2-out     2. aşama: elendin, izliyorsun
 *   ?mock=kareler-final             2. aşama sonucu (son sonuç; çakıştın)
 *   ?mock=kareler-final-win         2. aşama sonucu (tek kaldın, toplam +2)
 *   ?mock=kareler-final-bonus       2. aşama sonucu: ödül karesini tek başına buldun (+2 ek), parlayan kare
 *   ?mock=kareler-final-bonus-clash 2. aşama sonucu: ödül karesinde çakıştınız, ödül yok
 *   ?mock=kareler-final-bonus-other 2. aşama sonucu: ödül karesini başkası buldu
 *   ?mock=kareler-final-bonus-miss  2. aşama sonucu: ödül karesine kimse basmadı (`&bonus=N` kareyi değiştirir)
 *   ?mock=kareler-spectator         katılımcı değilsin (1. aşama)
 */
import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import {
  createRng,
  gizliKareler,
  KARELER_BETWEEN_MS,
  KARELER_STAGE_MS,
  type KarelerState,
  kareCells,
  kareSize,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: gizliKareler.id,
  name: gizliKareler.name,
  minPlayers: gizliKareler.minPlayers,
  maxPlayers: gizliKareler.maxPlayers,
  orientation: "portrait",
};

/** Oyuncu sırasına göre 1. aşama seçimleri: p0 tek kalır, p1+p2 çakışır, p3 tek, kalan hücreler dağınık. */
const STAGE1 = [4, 0, 0, 8, 2, 13, 6, null];
const STAGE1_ALL = [5, 5, 5, 5, 5, 5, 5, 5];
const STAGE1_WALKOVER = [4, 0, 0, 0, 0, 0, 0, 0];
/** 2. aşama (hayatta kalanlar). */
const STAGE2: Record<string, number> = { p0: 7, p3: 7, p4: 1, p5: 12, p6: 3 };
/** Kendin tek kalırsın. */
const STAGE2_WIN: Record<string, number> = { p0: 7, p3: 8, p4: 8, p5: 12, p6: 3 };

export function startKarelerMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
    spectator: false,
  }));
  const spectator = kind.endsWith("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const now = Date.now();
  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let myChoice: number | null = params.get("chosen") === "0" ? null : 4;
  let rev = 1;

  const S1 = KARELER_STAGE_MS;
  const S2 = S1 + KARELER_BETWEEN_MS;
  // Mock saati: görünümün hesaplandığı an, oyun başlangıcından kaç ms sonra.
  let elapsed = 8_000;
  let source = STAGE1;
  if (kind.startsWith("kareler-reveal")) elapsed = S1 + 300;
  if (kind === "kareler-reveal-all") source = STAGE1_ALL;
  if (kind === "kareler-reveal-walkover") source = STAGE1_WALKOVER;
  if (kind === "kareler-choosing2" || kind === "kareler-choosing2-out") elapsed = S2 + 7_000;
  if (kind.startsWith("kareler-final")) elapsed = S2 + KARELER_STAGE_MS + 300;
  const startedAt = now - elapsed;

  const choices1: Record<string, number> = {};
  participants.forEach((id, i) => {
    const c = source[i];
    if (c !== null && c !== undefined) choices1[id] = c;
  });
  const choices2: Record<string, number> = {};
  if (kind.startsWith("kareler-final")) {
    for (const [id, c] of Object.entries(
      kind === "kareler-final-win" || kind === "kareler-final-bonus" ? STAGE2_WIN : STAGE2,
    ))
      choices2[id] = c;
  }
  // Seçim ekranlarında yalnız kendi seçimin vardır; sunucu gibi davran.
  if ((kind === "kareler-choosing" || kind === "kareler-locked") && myChoice !== null)
    choices1[SELF] = myChoice;

  // "Tamam" diyenler (mock): kilitli ekranda sen ve birkaç kişi.
  let myLocked = kind === "kareler-locked";
  const lockedIds = (): string[] => {
    if (kind === "kareler-locked")
      return participants.slice(0, Math.max(1, Math.ceil(participants.length / 2)));
    if (spectator) return participants.slice(1, 3);
    return myLocked ? [SELF] : [];
  };
  const state = (): KarelerState => {
    if (kind === "kareler-choosing" || kind === "kareler-locked" || spectator) {
      const own = { ...choices1 };
      delete own[SELF];
      if (!spectator && myChoice !== null) own[SELF] = myChoice;
      return base(own, {});
    }
    return base(choices1, choices2);
  };
  /** Ödül karesi (mock): senaryoya göre; ızgaraya sığacak biçimde kısaltılır. */
  const bonusCell = (): number => {
    const cells = kareCells(kareSize(participants.length));
    const given = Number(params.get("bonus"));
    const byKind: Record<string, number> = {
      "kareler-final-bonus": 7,
      "kareler-final-bonus-clash": 7,
      "kareler-final-bonus-other": 12,
      "kareler-final-bonus-miss": 14,
    };
    const cell = params.get("bonus") !== null && Number.isInteger(given) ? given : (byKind[kind] ?? 12);
    return ((cell % cells) + cells) % cells;
  };
  const base = (c1: Record<string, number>, c2: Record<string, number>): KarelerState => ({
    players: participants,
    size: kareSize(participants.length),
    bonusCell: bonusCell(),
    startedAt,
    stage1EndsAt: startedAt + S1,
    end1At: null,
    end2At: null,
    locked1: lockedIds(),
    locked2: [],
    choices1: c1,
    choices2: c2,
    seen: 0,
  });

  const ctx = () => ({ now: Date.now(), rng: createRng(1), connected: participants });
  const snapshot = (): RoomSnapshot => {
    if (kind === "kareler-briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = now + 40_000;
    }
    const st = state();
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: gizliKareler.briefing.goal, steps: [...gizliKareler.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      continueIds: [],
      phaseStartedAt: startedAt,
      phaseEndsAt,
      publicView: gizliKareler.publicView(st, ctx()),
      view: gizliKareler.view(st, spectator ? null : SELF, ctx()),
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
    const payload = msg.payload as { kind?: string; cell?: number } | null;
    if (payload?.kind === "lock" && myChoice !== null) {
      myLocked = true;
      applySnapshot(snapshot());
      return;
    }
    if (payload?.kind === "pick" && !myLocked && typeof payload.cell === "number") {
      myChoice = payload.cell;
      applySnapshot(snapshot());
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
