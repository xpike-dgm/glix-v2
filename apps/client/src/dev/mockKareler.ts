/**
 * Yalnız geliştirme önizlemesi: Gizli Kareler ekranları gerçek motorla çalışır (`&n=2..8` oyuncu sayısı, varsayılan 5).
 *   ?mock=kareler-briefing            anlatım (ızgara boyutu oyuncu sayısından)
 *   ?mock=kareler-choosing            1. aşama seçimi; kareler çalışır (`&chosen=0` ile seçimsiz başlar)
 *   ?mock=kareler-locked              1. aşama: sen "Tamam" dedin, diğerleri bekleniyor
 *   ?mock=kareler-urgent              1. aşama son 5 sn, henüz seçmedin (GK-U10)
 *   ?mock=kareler-spectator           katılımcı değilsin (1. aşama)
 *   ?mock=kareler-reveal              1. aşama sonucu (`&t=` açılış başından ms, varsayılan 3500)
 *   ?mock=kareler-reveal-all          1. aşama: herkes aynı karede, oyun biter
 *   ?mock=kareler-reveal-walkover     1. aşama: tek canlı kaldı, hayaletler kopuk → rakipsiz +1
 *   ?mock=kareler-offline             1. aşama sonucu: seçmeyen biri kopuk (GK-U15)
 *   ?mock=kareler-band                "2. AŞAMA" bandı (GK-U5)
 *   ?mock=kareler-choosing2           2. aşama: yarışıyorsun, pusulan var (GK-M1)
 *   ?mock=kareler-ghost               2. aşama: hayaletsin (GK-M2 / GK-U13)
 *   ?mock=kareler-choosing2-spectator 2. aşama izleyici
 *   ?mock=kareler-final               son sonuç: çakıştın (`&t=`, varsayılan 7800: pusulalar)
 *   ?mock=kareler-final-bonus         son sonuç: ödül karesini tek başına buldun
 *   ?mock=kareler-final-bonus-clash   son sonuç: ödülde çakıştınız
 *   ?mock=kareler-final-bonus-haunted son sonuç: hayalet ödülü kapattı
 *   ?mock=kareler-final-bonus-miss    son sonuç: kimse bulamadı
 *   ?mock=kareler-summary             son sonuç: özet tablosu (GK-U9)
 * TV: `?mock=tv-kareler-<evre>` aynı durumu sahne görünümünde açar (izleyici kipinde).
 */
import {
  type ClientMessage,
  createRng,
  type GameInfo,
  gizliKareler,
  isRejected,
  KARELER_BETWEEN_MS,
  KARELER_STAGE_MS,
  type KarelerState,
  kareCells,
  kareSize,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
} from "@glix/engine";
import { mockAck, useMockSender } from "../net/client.js";
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

const S1 = KARELER_STAGE_MS;
const S2S = S1 + KARELER_BETWEEN_MS;
const S2E = S2S + KARELER_STAGE_MS;

/** Oyuncu sırasına göre 1. aşama seçimleri: p0 tek, p1+p2 çakışır, p3 tek, kalanlar dağınık; p7 seçmez. */
const STAGE1 = [4, 0, 0, 8, 2, 13, 6, null];
const STAGE1_GHOST = [0, 0, 5, 8, 2, 13, 6, null];
const STAGE1_ALL = [5, 5, 5, 5, 5, 5, 5, 5];
const STAGE1_WALKOVER = [4, 0, 0, 0, 0, 0, 0, 0];

export function startKarelerMock(kind: string, params: URLSearchParams): void {
  startKarelerMockAs(kind, params, false);
}

export function startKarelerMockAs(kind: string, params: URLSearchParams, tv: boolean): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const stage = kind.replace(/^kareler-?/, "") || "choosing";
  const spectating = tv || stage.endsWith("spectator");
  const offlineId = stage === "offline" ? `p${n - 1}` : null;
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: `p${i}` !== offlineId,
    score: 0,
    spectator: false,
  }));
  const participants = players.map((p) => p.id).filter((id) => !(spectating && id === SELF));
  const cells = kareCells(kareSize(participants.length));
  const cell = (c: number): number => c % cells;
  const t = Number(params.get("t"));
  const at: Record<string, number> = {
    choosing: 8_000,
    locked: 9_000,
    urgent: S1 - 3_500,
    spectator: 8_000,
    reveal: S1 + (t || 3_500),
    "reveal-all": S1 + (t || 3_500),
    "reveal-walkover": S1 + (t || 3_500),
    offline: S1 + (t || 3_500),
    band: S2S - 600,
    choosing2: S2S + 6_000,
    ghost: S2S + 6_000,
    "choosing2-spectator": S2S + 6_000,
    summary: S2E + 9_500,
  };
  const elapsed = at[stage] ?? (stage.startsWith("final") ? S2E + (t || 7_800) : 8_000);
  const now0 = Date.now();
  const startedAt = stage === "briefing" ? now0 : now0 - elapsed;
  const connectedNow = () => participants.filter((id) => players.find((p) => p.id === id)?.connected);
  const ctx = (now: number, connected: readonly string[] = participants) => ({
    now,
    rng: createRng(5),
    connected,
  });

  let s: KarelerState = gizliKareler.setup(participants, ctx(startedAt));
  const bonusByStage: Record<string, number> = {
    "final-bonus": 9,
    "final-bonus-clash": 9,
    "final-bonus-haunted": 9,
    "final-bonus-miss": 14,
    final: 12,
    summary: 9,
  };
  const bonusParam = params.get("bonus");
  if (bonusParam !== null && Number.isInteger(Number(bonusParam)))
    s = { ...s, bonusCell: cell(Number(bonusParam)) };
  else if (bonusByStage[stage] !== undefined) s = { ...s, bonusCell: cell(bonusByStage[stage] ?? 0) };

  const act = (id: string, a: { kind: "pick"; cell: number } | { kind: "lock" }, ms: number): void => {
    if (!participants.includes(id)) return;
    const r = gizliKareler.reduce(s, id, a, ctx(startedAt + ms));
    if (!isRejected(r)) s = r;
  };
  const pick = (id: string, c: number, ms: number): void => act(id, { kind: "pick", cell: cell(c) }, ms);

  if (stage !== "briefing") {
    const source =
      stage === "reveal-all"
        ? STAGE1_ALL
        : stage === "reveal-walkover"
          ? STAGE1_WALKOVER
          : stage === "ghost"
            ? STAGE1_GHOST
            : STAGE1;
    const selfChoice = params.get("chosen") === "0" || stage === "urgent" ? null : source[0];
    participants.forEach((id, i) => {
      const k = Number(id.slice(1));
      const c = id === SELF ? selfChoice : source[k];
      if (c !== null && c !== undefined && (elapsed > 2_000 + i * 300 || id === SELF)) {
        pick(id, c, Math.min(elapsed - 100, 2_000 + i * 300));
      }
    });
    if (stage === "locked") {
      act(SELF, { kind: "lock" }, 8_500);
      act("p1", { kind: "lock" }, 8_500);
    }
    if (stage === "urgent") for (const id of participants.slice(1, 3)) act(id, { kind: "lock" }, 15_000);
    if (stage === "spectator") act("p1", { kind: "lock" }, 7_000);
    if (stage === "reveal-walkover") {
      // Hayaletler 1. aşama kapanmadan koptu: rakipsiz bitiş.
      const fn = gizliKareler.onPresence;
      if (fn) s = fn(s, ctx(startedAt + S1 - 500, [SELF]));
    }
  }

  if (elapsed >= S2S) {
    const two: Record<string, Record<string, number>> = {
      final: { p0: 7, p3: 7, p4: 1, p1: 1 },
      "final-bonus": { p0: 9, p3: 7, p4: 1, p1: 1 },
      "final-bonus-clash": { p0: 9, p3: 9, p4: 1 },
      "final-bonus-haunted": { p0: 9, p2: 9, p3: 7, p4: 1 },
      "final-bonus-miss": { p0: 3, p3: 7, p4: 1, p1: 10 },
      summary: { p0: 9, p3: 7, p4: 1, p1: 1, p6: 15 },
      choosing2: { p0: 10 },
      ghost: { p0: 7 },
    };
    for (const [id, c] of Object.entries(two[stage] ?? {})) pick(id, c, S2S + 1_000);
    if (stage === "choosing2" || stage === "ghost") act("p3", { kind: "pick", cell: cell(5) }, S2S + 1_500);
    if (stage === "choosing2" || stage === "ghost") act("p3", { kind: "lock" }, S2S + 2_000);
  }

  let rev = 1;
  const briefing = stage === "briefing";
  const phase: RoomPhase = briefing ? "briefing" : "playing";
  function publish(): void {
    const now = Date.now();
    const cx = ctx(now, connectedNow());
    s = gizliKareler.tick(s, cx);
    const revealAt = gizliKareler.revealAt?.(s, cx) ?? null;
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: gizliKareler.briefing.goal, steps: [...gizliKareler.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds: briefing ? participants.slice(1, 3) : [],
      continueIds: [],
      phaseStartedAt: startedAt,
      phaseEndsAt: briefing ? now0 + 40_000 : null,
      publicView: briefing ? null : gizliKareler.publicView(s, cx),
      view: briefing ? null : gizliKareler.view(s, spectating ? null : SELF, cx),
      result: null,
      ...(revealAt !== null && now >= revealAt && !briefing
        ? { reveal: { startedAt: revealAt, endsAt: revealAt + 60_000, continueIds: [] } }
        : {}),
    };
    const snapshot: RoomSnapshot = {
      rev: ++rev,
      serverNow: now,
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
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
    applySnapshot(snapshot);
  }

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg: ClientMessage) => {
    if (msg.type !== "action") return;
    const action = gizliKareler.parseAction(msg.payload);
    if (!action) {
      mockAck(msg.seq, { ok: false, reason: "bad_action" });
      return;
    }
    const r = gizliKareler.reduce(s, SELF, action, ctx(Date.now(), connectedNow()));
    if (isRejected(r)) {
      mockAck(msg.seq, { ok: false, reason: r.rejected });
      return;
    }
    s = r;
    mockAck(msg.seq, { ok: true });
    publish();
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
  setInterval(publish, 400);
}
