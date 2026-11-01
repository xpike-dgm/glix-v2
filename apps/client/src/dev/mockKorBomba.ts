/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez). Kör Bomba ekranları gerçek motorla çalışır:
 *   ?mock=kor-bomba-briefing   anlatım
 *   ?mock=kor-bomba-holder     bomba sende ("BOMBA SENDE — birine dokun"); koltuğa dokununca pas gider
 *   ?mock=kor-bomba-lock       bomba az önce geldi: "Fitil tutuşuyor…" (BM-M1)
 *   ?mock=kor-bomba-watch      bomba başkasında; süre yalnız basılı tutunca görünür (BM-U1); botlar pas verir
 *   ?mock=kor-bomba-urgent     son saniyeler (bakınca kırmızı, titrer)
 *   ?mock=kor-bomba-predict    "PATLAR!" bahis düğmesi (BM-U4)
 *   ?mock=kor-bomba-predicted  bahis verildi ("Bahsin: Mert'in eli")
 *   ?mock=kor-bomba-bildi      patlama: bahsin tuttu, "… bildi!"
 *   ?mock=kor-bomba-bilemedin  pas oldu, bahsin yandı
 *   ?mock=kor-bomba-blast      patlama anı (başkasında)
 *   ?mock=kor-bomba-boom-me    patlama anı (sende): "BOMBA SENDE PATLADI · −1"
 *   ?mock=kor-bomba-trip       bombanın yolculuğu (BM-U6)
 *   ?mock=kor-bomba-offline    taşıyıcı koptu bandı (BM-U12)
 *   ?mock=kor-bomba-spectator  izleyici: "Kimde patlar?" (BM-U10)
 * `&n=8` oyuncu sayısını değiştirir.
 */
import {
  type ClientMessage,
  createRng,
  type GameInfo,
  isRejected,
  KOR_BOMBA_LOCK_MS,
  type KorBombaState,
  korBomba,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
} from "@glix/engine";
import { mockAck, useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const GAME: GameInfo = {
  id: "kor-bomba",
  name: "Kör Bomba",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "landscape",
};

export function startKorBombaMock(kind: string, params: URLSearchParams): void {
  startKorBombaMockAs(kind, params, false);
}

/** `tv`: sahne (TV) görünümü için izleyici kipinde, aynı motor durumu. */
export function startKorBombaMockAs(kind: string, params: URLSearchParams, tv: boolean): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 6));
  const stage = kind.replace(/^kor-bomba-?/, "") || "watch";
  const spectating = tv || stage === "spectator";
  const offlineId = stage === "offline" ? "p2" : stage === "holder" && n > 4 ? "p3" : null;
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: `p${i}` !== offlineId,
    score: 0,
    spectator: false,
  }));
  const participants = players.map((p) => p.id).filter((id) => !(spectating && id === SELF));
  const connected = () => players.filter((p) => p.connected && participants.includes(p.id)).map((p) => p.id);
  const briefing = stage === "briefing";
  let seed = 7;
  const ctx = (now = Date.now()) => ({ now, rng: createRng(seed++), connected: connected() });

  const t0 = Date.now() - 22_000;
  let s: KorBombaState = korBomba.setup(participants, {
    now: t0,
    rng: createRng(3),
    connected: participants,
  });
  const step = (who: string, action: Parameters<typeof korBomba.reduce>[2], at: number): boolean => {
    const r = korBomba.reduce(s, who, action, { now: at, rng: createRng(seed++), connected: participants });
    if (isRejected(r)) return false;
    s = r;
    return true;
  };
  // Geçmiş: p4 → p1 → p2 (zincir dolu görünsün).
  s = { ...s, holder: "p4", explodeAt: t0 + 19_000, fuseMs: 19_000 };
  step("p4", { kind: "pass", to: "p1" }, t0 + 4_000);
  step("p1", { kind: "pass", to: "p2" }, t0 + 11_000);
  const now0 = Date.now();
  /** Patlama anını kaydırırken fitil hesabı tutarlı kalsın (başlangıç fitili buna göre). */
  const setExplode = (at: number): void => {
    const bonuses = s.log.reduce((sum, p) => sum + p.bonusMs, 0);
    s = { ...s, explodeAt: at, fuseMs: at - s.startedAt - bonuses };
  };
  const holderNow = stage === "holder" || stage === "lock" || stage === "boom-me" ? SELF : "p2";
  if (holderNow === SELF)
    step("p2", { kind: "pass", to: SELF }, stage === "lock" ? now0 - 200 : now0 - 1_900);
  const fuseLeft = stage === "urgent" ? 3_600 : stage === "bildi" || stage === "bilemedin" ? 4_200 : 11_800;
  setExplode(now0 + fuseLeft);
  if (stage === "predicted" || stage === "bildi" || stage === "bilemedin") {
    step(SELF, { kind: "bet", turn: s.passes }, now0 - 100);
    if (stage === "bildi") step("p3", { kind: "bet", turn: s.passes }, now0 - 90);
    if (stage === "bildi") step("p5", { kind: "bet", turn: s.passes }, now0 - 80);
  }
  if (stage === "blast" || stage === "boom-me" || stage === "trip") {
    setExplode(now0 - (stage === "trip" ? 2_600 : 300));
    s = korBomba.tick(s, ctx(now0));
  }
  if (stage === "bilemedin") {
    // p2 pası verir: bahis yanar.
    later(() => {
      step("p2", { kind: "pass", to: "p4" }, Math.max(Date.now(), s.heldSince + KOR_BOMBA_LOCK_MS));
      publish();
    }, 1_600);
  }

  let rev = 1;
  const phase: RoomPhase = briefing ? "briefing" : "playing";
  function publish(): void {
    const now = Date.now();
    s = korBomba.tick(s, ctx(now));
    const c = ctx(now);
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: GAME.id,
      gameName: GAME.name,
      briefing: { goal: korBomba.briefing.goal, steps: [...korBomba.briefing.steps] },
      orientation: "landscape",
      participants,
      readyIds: briefing ? ["p1", "p2"] : [],
      continueIds: [],
      phaseStartedAt: s.startedAt,
      phaseEndsAt: briefing ? now + 40_000 : null,
      publicView: korBomba.publicView(s, c),
      view: korBomba.view(s, spectating ? null : SELF, c),
      result: null,
      ...(s.exploded
        ? { reveal: { startedAt: s.explodeAt, endsAt: s.explodeAt + 60_000, continueIds: ["p1"] } }
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
      gameIds: [GAME.id],
      selection: { mode: "manual" },
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
      catalog: [GAME],
      match,
    };
    applySnapshot(snapshot);
  }
  function later(fn: () => void, ms: number): void {
    setTimeout(fn, ms);
  }

  const botPass = (): void => {
    if (s.exploded) return;
    if (s.holder !== SELF) {
      const targets = connected().filter((id) => id !== s.holder && id !== s.lastPass?.from);
      const to = targets[Math.floor(Math.random() * targets.length)];
      if (to && Math.random() < 0.6 && step(s.holder, { kind: "pass", to }, Date.now())) publish();
    }
    later(botPass, 2_400 + Math.random() * 1_500);
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg: ClientMessage) => {
    if (msg.type !== "action") return;
    const r = korBomba.reduce(s, SELF, msg.payload as Parameters<typeof korBomba.reduce>[2], ctx());
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
  if (stage === "watch" || stage === "holder" || stage === "spectator") later(botPass, 3_000);
  // Patlama anını yayınla (sunucunun tam zamanlı uyandırması gibi).
  const arm = (): void => {
    if (s.exploded) return;
    if (Date.now() >= s.explodeAt) {
      publish();
      return;
    }
    later(arm, 50);
  };
  arm();
  // Yolculuk ekranı zamanla açılır; ekran saati ilerledikçe yeniden çizilir.
  setInterval(() => {
    if (s.exploded) publish();
  }, 500);
}
