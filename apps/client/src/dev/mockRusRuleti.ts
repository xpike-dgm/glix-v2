/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez). Rus Ruleti ekranları gerçek motorla çalışır
 * (`&n=2..8` oyuncu sayısı, varsayılan 5):
 *   ?mock=rus-briefing        anlatım
 *   ?mock=rus-hold            silah sende; az önce sana sıkan kilitli (RR-M1); masaya dokun, ATEŞ ET
 *   ?mock=rus-wait            silah başkasında ("Mert'in elinde · %26"); botlar oynar
 *   ?mock=rus-spin            tambur dönüyor (RR-U5)
 *   ?mock=rus-safe            boş atış sonucu ("Klik!", RR-U7)
 *   ?mock=rus-boom            patlama, başkası elendi (RR-U6)
 *   ?mock=rus-boom-me         patlama, sen elendin ("Seni Mert vurdu")
 *   ?mock=rus-lastword        sen elendin; son sözün: silahı kime veriyorsun? (RR-M3)
 *   ?mock=rus-lastword-wait   başkası son sözünü söylüyor
 *   ?mock=rus-out             elendin; bağlamlı tahmin satırı ve karne (RR-U13)
 *   ?mock=rus-predicted       elendin; tahmin verildi
 *   ?mock=rus-offline         silah bağlantısı kopan birinde ("bağlı değil · 6 sn", RR-M4 / RR-U15)
 *   ?mock=rus-spectator       katılımcı değilsin
 *   ?mock=rus-over            oyun içi son açılış (RR-U8)
 *   ?mock=rus-reveal          genel sonuç şeridi (Reveal)
 *   ?mock=rus-kahin           genel sonuçta "Kâhin" rozeti
 * TV: `?mock=tv-rus-<evre>` aynı durumu sahne görünümünde açar.
 */
import {
  type ClientMessage,
  createRng,
  type GameInfo,
  isRejected,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
  type RusRuletiAction,
  type RusRuletiState,
  rusRuleti,
} from "@glix/engine";
import { mockAck, useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: rusRuleti.id,
  name: rusRuleti.name,
  minPlayers: rusRuleti.minPlayers,
  maxPlayers: rusRuleti.maxPlayers,
  orientation: "portrait",
};
/** Durağan önizlemeler için evrenin "dondurulduğu" süre. */
const FREEZE = 600_000;

export function startRusRuletiMock(kind: string, params: URLSearchParams): void {
  startRusRuletiMockAs(kind, params, false);
}

/** `tv`: sahne (TV) görünümü için izleyici kipinde, aynı motor durumu. */
export function startRusRuletiMockAs(kind: string, params: URLSearchParams, tv: boolean): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const stage = kind.replace(/^rus-?/, "") || "wait";
  const spectating = tv || stage === "spectator";
  const offlineId = stage === "offline" || params.get("off") === "1" ? "p2" : null;
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: `p${i}` !== offlineId,
    score: 0,
    spectator: false,
  }));
  const ids = players.map((p) => p.id);
  const participants = ids.filter((id) => !(spectating && id === SELF));
  const connected = () => players.filter((p) => p.connected && participants.includes(p.id)).map((p) => p.id);
  const briefing = stage === "briefing";
  const reveal = stage === "reveal" || stage === "kahin";
  let seed = 11;
  const ctx = (now = Date.now()) => ({ now, rng: createRng(seed++), connected: connected() });

  const now0 = Date.now();
  let t = now0 - 60_000;
  let s: RusRuletiState = rusRuleti.setup(participants, {
    now: t,
    rng: createRng(3),
    connected: participants,
  });
  const at = (id: string): string => (participants.includes(id) ? id : (participants[1] ?? id));
  /** Zorlanmış atış: `boom` sonucu ve gösterilecek risk. */
  const fire = (who: string, target: string, boom: boolean, risk: number, when = t + 1_000): void => {
    t = Math.max(when, s.openAt);
    const forced: RusRuletiState = { ...s, holder: who, risk: boom ? 100 : 0, openAt: Math.min(s.openAt, t) };
    const r = rusRuleti.reduce(
      forced,
      who,
      { kind: "shoot", target },
      { ...ctx(t), connected: participants },
    );
    if (isRejected(r)) return;
    const last = r.last ? { ...r.last, risk } : null;
    s = {
      ...r,
      last,
      history: last ? [...r.history.slice(0, -1), last] : r.history,
      risk: boom ? 16 : Math.min(76, risk + 10),
    };
  };
  const pass = (from: string, to: string): void => {
    if (!s.lastWord) return;
    t = s.lastWord.opensAt + 600;
    const r = rusRuleti.reduce(s, from, { kind: "pass", to }, { ...ctx(t), connected: participants });
    if (!isRejected(r)) s = r;
  };
  /** Son atışı "şimdi"ye taşır (sonuç, dönüş ve son söz ekranları sabit dursun). */
  const freezeLast = (offsetMs: number): void => {
    const l = s.last;
    if (!l) return;
    const shift = now0 + offsetMs - l.at;
    const last = { ...l, at: l.at + shift };
    s = {
      ...s,
      last,
      history: [...s.history.slice(0, -1), last],
      openAt: s.openAt + shift + FREEZE,
      deadline: s.deadline + shift + FREEZE,
      lastWord: s.lastWord
        ? { ...s.lastWord, opensAt: s.lastWord.opensAt + shift, endsAt: s.lastWord.endsAt + shift }
        : null,
    };
  };

  const a = at("p1");
  const b = at("p2");
  const c = at("p3");
  const d = at(n > 4 ? "p4" : "p1");
  // Ortak geçmiş: c → a (boş), a → a (kendine, boş), a → b (BAM; b son sözle d'ye verir).
  if (!briefing) {
    fire(c, a, false, 16);
    fire(a, a, false, 26);
    if (n > 2 && stage !== "hold" && stage !== "safe" && stage !== "spin" && stage !== "offline") {
      fire(a, b, true, 36);
      pass(b, d);
    }
  }
  const me = spectating ? c : SELF;
  switch (stage) {
    case "hold":
      fire(a, SELF, false, 36);
      s = { ...s, deadline: now0 + 11_000, openAt: now0 - 4_000 };
      break;
    case "wait":
    case "spectator":
      fire(d, c, false, 16);
      s = { ...s, deadline: now0 + 12_000, openAt: now0 - 3_000 };
      break;
    case "offline":
      fire(a, b, false, 36);
      s = { ...s, offline: [b], deadline: now0 + 4_000, openAt: now0 - 2_000 };
      break;
    case "spin":
      fire(a, me, false, 36);
      freezeLast(-300);
      s = { ...s, last: s.last ? { ...s.last, at: now0 + FREEZE } : null };
      s = { ...s, history: s.last ? [...s.history.slice(0, -1), s.last] : s.history };
      break;
    case "safe":
      fire(a, me === SELF ? c : a, false, 36);
      freezeLast(-1_300);
      break;
    case "boom":
      fire(d, c, true, 46);
      freezeLast(-1_300);
      break;
    case "boom-me":
      fire(d, SELF, true, 46);
      freezeLast(-1_300);
      break;
    case "lastword":
      fire(d, SELF, true, 26);
      freezeLast(-4_000);
      break;
    case "lastword-wait":
      fire(d, c, true, 26);
      freezeLast(-4_000);
      break;
    case "out":
    case "predict":
    case "predicted":
      fire(d, SELF, true, 26);
      pass(SELF, c);
      fire(c, a, false, 16);
      s = { ...s, made: { [SELF]: 1 }, hits: { [SELF]: 1 }, deadline: now0 + 12_000, openAt: now0 - 3_000 };
      if (stage === "predicted") s = { ...s, predictions: { [SELF]: true } };
      break;
    case "over":
    case "reveal":
    case "kahin": {
      // Yarı eşiğine kadar patlat (sen hayatta kal).
      for (let i = 0; i < 8 && !s.over; i++) {
        const victim = s.alive.find((x) => x !== SELF && x !== s.holder) ?? s.alive.find((x) => x !== SELF);
        if (!victim) break;
        const shooter = s.alive.includes(SELF) && i % 2 === 0 ? SELF : s.holder;
        fire(shooter, victim, true, 36 + i * 10);
        if (s.lastWord) pass(s.lastWord.from, SELF);
      }
      if (stage === "kahin") s = { ...s, correct: { [b]: 1 }, yes: { [b]: 1 } };
      if (stage === "over") freezeLast(-3_600);
      break;
    }
  }

  let rev = 1;
  const phase: RoomPhase = briefing ? "briefing" : reveal ? "results" : "playing";
  function publish(): void {
    const now = Date.now();
    s = rusRuleti.tick(s, ctx(now));
    const cx = ctx(now);
    const result = s.over ? rusRuleti.result(s) : null;
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: rusRuleti.briefing.goal, steps: [...rusRuleti.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds: briefing ? ["p1", "p2"] : [],
      continueIds: [],
      phaseStartedAt: s.startedAt,
      phaseEndsAt: briefing ? now + 40_000 : reveal ? now + 60_000 : null,
      publicView: briefing ? null : rusRuleti.publicView(s, cx),
      view: briefing ? null : rusRuleti.view(s, spectating ? null : SELF, cx),
      result: reveal && result ? { miniScores: result.miniScores, awards: result.awards } : null,
      ...(s.over && s.last && !reveal
        ? { reveal: { startedAt: s.last.at, endsAt: s.last.at + 60_000, continueIds: ["p1"] } }
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

  /** Botlar: silah onlardaysa birkaç saniyede bir rastgele (yasak olmayan) birine sıkar; son sözde silahı verir. */
  const bots = (): void => {
    const now = Date.now();
    if (!s.over) {
      const lw = s.lastWord;
      if (lw && lw.from !== SELF && now >= lw.opensAt && now < lw.endsAt - FREEZE / 2) {
        const to = s.alive[Math.floor(Math.random() * s.alive.length)];
        if (to) step(lw.from, { kind: "pass", to }, now);
      } else if (!lw && s.holder !== SELF && now >= s.openAt && s.openAt < now0 + FREEZE / 2) {
        const pool = s.alive.filter((x) => x !== s.holder && x !== noReturn());
        const target = Math.random() < 0.2 ? s.holder : pool[Math.floor(Math.random() * pool.length)];
        if (target) step(s.holder, { kind: "shoot", target }, now);
      }
    }
    setTimeout(bots, 2_500 + Math.random() * 1_500);
  };
  const noReturn = (): string | null => rusRuleti.publicView(s, ctx()).noReturn;
  const step = (who: string, action: RusRuletiAction, when: number): void => {
    const r = rusRuleti.reduce(s, who, action, { ...ctx(when), connected: participants });
    if (isRejected(r)) return;
    s = r;
    publish();
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg: ClientMessage) => {
    if (msg.type !== "action") return;
    const action = rusRuleti.parseAction(msg.payload);
    if (!action) {
      mockAck(msg.seq, { ok: false, reason: "bad_action" });
      return;
    }
    const r = rusRuleti.reduce(s, SELF, action, { ...ctx(), connected: participants });
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
  setInterval(publish, 500);
  if (stage === "wait" || stage === "spectator" || stage === "out" || stage === "hold")
    setTimeout(bots, 3_000);
}
