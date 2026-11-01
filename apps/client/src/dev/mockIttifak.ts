/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez). İttifak ekranları gerçek motorla çalışır (`&n=3..8` oyuncu,
 * varsayılan 5; sen p0 "Cihad"):
 *   ?mock=ittifak-briefing        anlatım
 *   ?mock=ittifak-talk            müzakere masası (`&promised=1,2` söz mühürleri konmuş, `&urgent=1` son 10 sn,
 *                                 `&off=3` p3'ün bağlantısı yok, `&back=1` "Döndün" notu); portreye dokununca söz
 *   ?mock=ittifak-talk-locked     pazarlık: sen "Oylamaya geç" dedin
 *   ?mock=ittifak-band            "PAZARLIK BİTTİ · OYLAR GİZLİ" geçişi
 *   ?mock=ittifak-vote            gizli oylama (`&chosen=1` seçili başlar, `&urgent=1` son 5 sn, `&off=3`)
 *   ?mock=ittifak-vote-locked     oylama: oyunu mühürledin
 *   ?mock=ittifak-reveal          oylar okunuyor (`&t=` açılış başından ms, varsayılan son tablo; `&promises=many`
 *                                 herkes söz vermiş, `&random=1` iki kişi oy vermedi)
 *   ?mock=ittifak-reveal-zero     sen hiç oy almadın
 *   ?mock=ittifak-spectator-talk | -vote | -reveal   katılımcı değilsin
 * TV: `?mock=tv-ittifak-<evre>` aynı durumu sahne görünümünde açar (izleyici kipinde).
 */
import {
  type ClientMessage,
  createRng,
  type GameInfo,
  ITTIFAK_BAND_MS,
  type IttifakAction,
  type IttifakState,
  isRejected,
  ittifak,
  ittifakMaxPromises,
  ittifakRevealMs,
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
  id: ittifak.id,
  name: ittifak.name,
  minPlayers: ittifak.minPlayers,
  maxPlayers: ittifak.maxPlayers,
  orientation: "portrait",
};

export function startIttifakMock(kind: string, params: URLSearchParams): void {
  startIttifakMockAs(kind, params, false);
}

/** `onTv`: sahne (TV) görünümü için izleyici kipinde, aynı motor durumu. */
export function startIttifakMockAs(kind: string, params: URLSearchParams, onTv: boolean): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const spectating = onTv || kind.includes("spectator");
  const stage = kind.includes("reveal")
    ? "reveal"
    : kind.includes("band")
      ? "band"
      : kind.includes("vote")
        ? "vote"
        : kind.includes("briefing")
          ? "briefing"
          : "talk";
  const offId = params.get("off") !== null ? `p${Number(params.get("off"))}` : null;
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: `p${i}` !== offId,
    score: [3, 5, 2, 4, 1, 6, 0, 2][i] ?? 0,
    spectator: false,
  }));
  const P = players.map((p) => p.id).filter((id) => !(spectating && id === SELF));
  const connectedNow = () => players.filter((p) => p.connected && P.includes(p.id)).map((p) => p.id);
  const ctx = (now: number, connected: readonly string[] = P) => ({ now, rng: createRng(7), connected });
  const me = spectating ? null : SELF;

  const T0 = 1_000_000;
  let s: IttifakState = ittifak.setup(P, ctx(T0));
  const act = (who: string | null, a: IttifakAction, at: number): void => {
    if (who === null || !P.includes(who)) return;
    const r = ittifak.reduce(s, who, a, ctx(T0 + at));
    if (!isRejected(r)) s = r;
  };
  const tick = (at: number): void => {
    s = ittifak.tick(s, ctx(T0 + at));
  };
  const TALK = s.talkEndsAt - T0;
  const OPEN = TALK + ITTIFAK_BAND_MS;
  const max = ittifakMaxPromises(P.length);

  // Söz işaretleri (pazarlık başında).
  const mine = (params.get("promised") ?? "")
    .split(",")
    .filter((x) => x !== "")
    .map((x) => `p${Number(x)}`);
  for (const id of mine) act(me, { kind: "promise", target: id, on: true }, 2_000);
  const many = params.get("promises") === "many";
  if (stage === "reveal") {
    // Sen p1'e (tuttu) ve 5+ kişide p2'ye söz verdin; p1 sana söz verdi ama p3'e oy verdi; p2 sana söz verip tuttu.
    act(me, { kind: "promise", target: "p1", on: true }, 2_000);
    if (max > 1) act(me, { kind: "promise", target: "p2", on: true }, 2_100);
    act("p1", { kind: "promise", target: SELF, on: true }, 2_200);
    act("p2", { kind: "promise", target: SELF, on: true }, 2_300);
    if (many) {
      for (const [i, id] of P.entries()) {
        if (id === SELF || id === "p1" || id === "p2") continue;
        act(id, { kind: "promise", target: P[(i + 1) % P.length] as string, on: true }, 2_400);
        if (max > 1) act(id, { kind: "promise", target: P[(i + 2) % P.length] as string, on: true }, 2_500);
      }
    }
  }
  let vt = 12_000;
  if (stage === "talk" && params.get("urgent") === "1") vt = TALK - 7_400;
  if (kind.includes("talk-locked")) {
    act(me, { kind: "skip" }, 8_000);
    act("p2", { kind: "skip" }, 9_000);
  }
  if (stage === "talk" && !kind.includes("locked")) act("p3", { kind: "skip" }, 9_000);
  if (stage === "talk" && params.get("back") === "1") vt = 26_000;
  if (stage === "band") {
    tick(TALK);
    vt = TALK + 100;
  }
  if (stage === "vote") {
    tick(TALK);
    const chosen = params.get("chosen");
    if (chosen !== null || kind.includes("locked"))
      act(me, { kind: "vote", target: `p${Number(chosen ?? 1)}` }, OPEN + 1_500);
    if (kind.includes("locked")) act(me, { kind: "lock" }, OPEN + 2_000);
    act("p2", { kind: "vote", target: "p1" }, OPEN + 1_000);
    act("p2", { kind: "lock" }, OPEN + 1_200);
    vt = params.get("urgent") === "1" ? s.voteEndsAt - T0 - 3_600 : OPEN + 3_500;
  }
  if (stage === "reveal") {
    tick(TALK);
    const zero = kind.includes("zero");
    const random = params.get("random") === "1";
    const others = P.filter((id) => id !== SELF);
    for (const [i, id] of P.entries()) {
      if (random && (id === "p3" || id === "p5")) continue;
      let to: string;
      if (id === SELF) to = "p1";
      else if (id === "p1") to = zero ? "p2" : P.includes("p3") ? "p3" : SELF;
      else if (id === "p2") to = zero ? "p1" : SELF;
      else if (id === "p3") to = "p1";
      else to = others[(i * 3) % others.length] === id ? "p1" : (others[(i * 3) % others.length] as string);
      if (zero && to === SELF) to = "p1";
      act(id, { kind: "vote", target: to }, OPEN + 1_000 + i * 200);
    }
    tick(s.voteEndsAt - T0);
    const t = params.get("t");
    vt = s.voteEndsAt - T0 + (t !== null ? Number(t) : ittifakRevealMs(P.length) - 200);
  }

  // Sanal zamanı gerçek saate kaydır: şu an = sanal vt.
  const shift = Date.now() - (T0 + vt);
  const real = (x: number) => x + shift;
  const briefing = stage === "briefing";
  let rev = 1;
  function publish(): void {
    const now = Date.now();
    const cx = ctx(now - shift, connectedNow());
    s = ittifak.tick(s, cx);
    const ended = ittifak.isFinished(s, cx);
    const pub = briefing ? null : shiftTimes(ittifak.publicView(s, cx), shift);
    const revealAt = ittifak.revealAt?.(s, cx) ?? null;
    const showReveal = revealAt !== null && now - shift >= revealAt;
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: ittifak.briefing.goal, steps: [...ittifak.briefing.steps] },
      orientation: "portrait",
      participants: P,
      readyIds: briefing ? ["p1", "p2"] : [],
      continueIds: [],
      phaseStartedAt: real(s.startedAt),
      phaseEndsAt: briefing ? now + 40_000 : null,
      publicView: pub,
      view: briefing ? null : ittifak.view(s, me, cx),
      result: ended ? ittifak.result(s) : null,
      ...(showReveal && revealAt !== null
        ? { reveal: { startedAt: real(revealAt), endsAt: real(revealAt) + 60_000, continueIds: ["p1"] } }
        : {}),
    };
    const phase: RoomPhase = briefing ? "briefing" : "playing";
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
    const action = ittifak.parseAction(msg.payload);
    if (!action || me === null) {
      mockAck(msg.seq, { ok: false, reason: "bad_action" });
      return;
    }
    const r = ittifak.reduce(s, me, action, ctx(Date.now() - shift, connectedNow()));
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
  setInterval(publish, 250);
}

/** Görünümdeki mutlak zamanları gerçek saate kaydırır (sanal saatle kurulan durum). */
function shiftTimes<T>(v: T, shift: number): T {
  const keys = new Set(["startedAt", "talkEndsAt", "voteEndsAt", "finishAt"]);
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk);
    if (typeof x !== "object" || x === null) return x;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(x))
      out[k] = keys.has(k) && typeof val === "number" ? val + shift : walk(val);
    return out;
  };
  return walk(v) as T;
}
