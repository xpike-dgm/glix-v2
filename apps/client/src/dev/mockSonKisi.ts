/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez): Son Kişi ekranları. Görünümler gerçek motordan (setup + sahte
 * kaçışlar) üretilir; saat, istenen anın "şimdi" olacağı şekilde kaydırılır. `&n=2..8` oyuncu sayısı.
 *   ?mock=sonkisi-briefing      anlatım
 *   ?mock=sonkisi-idle          1. alarm, sakin (KAÇ'a basınca kaçarsın)
 *   ?mock=sonkisi-tense         2. alarm, gerilim 2, üç kişi kaçmış (yalnız sayı görünür)
 *   ?mock=sonkisi-last2         içeride iki kişi kaldı, biri sensin (SON İKİ)
 *   ?mock=sonkisi-last1         içeride yalnız sen kaldın (SON KİŞİ)
 *   ?mock=sonkisi-escaped       sen kaçtın (kendi süren), gerilim 2
 *   ?mock=sonkisi-spectator     izleyici
 *   ?mock=sonkisi-gap           1. alarmdan sonra tur arası (`&yakalan=1`: sen yakalandın)
 *   ?mock=sonkisi-reveal        son açılış (üçüncü alarm; zaman çizelgesi ve sıralama)
 *   ?mock=sonkisi-reveal-none   son açılış, kimse kaçmadı
 *   ?mock=sonkisi-results       genel sonuç ekranı (üstte tek satır)
 *   ?mock=tv-sonkisi-…          büyük ekran (izleyici kipinde StageView)
 */
import {
  createRng,
  type GameInfo,
  isRejected,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
  type SonKisiState,
  sonKisi,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: sonKisi.id,
  name: sonKisi.name,
  minPlayers: sonKisi.minPlayers,
  maxPlayers: sonKisi.maxPlayers,
  orientation: "portrait",
};

/** Tur başına kaçışlar (oyuncu sırası → turun başından ms); alarmdan sonrakiler motorca reddedilir. */
type Plan = Record<string, number>[];

function plan(kind: string, ids: string[], params: URLSearchParams): Plan {
  const at = (i: number, base: number) => base + i * 1_150;
  const all = (skip: (id: string) => boolean, base = 2_000): Record<string, number> =>
    Object.fromEntries(ids.filter((id) => !skip(id)).map((id, i) => [id, at(i, base)]));
  if (kind === "reveal-none" || kind === "results-none") return [{}, {}, {}];
  const caughtMe = params.get("yakalan") === "1";
  return [
    all((id) => (caughtMe && id === SELF) || id === ids[ids.length - 1]),
    all((id) => id === ids[1], 1_500),
    all((id) => id === ids[2], 3_000),
  ];
}

function build(base: number, seed: number, ids: string[], p: Plan, before: number): SonKisiState {
  let s = sonKisi.setup(ids, { now: base, rng: createRng(seed), connected: ids });
  for (let i = 0; i < s.rounds.length; i++) {
    const entries = Object.entries(p[i] ?? {}).sort((a, b) => a[1] - b[1]);
    for (const [id, ms] of entries) {
      const r = s.rounds[i];
      if (!r) continue;
      const t = r.startAt + ms;
      if (t >= before || t >= r.endsAt) continue;
      const out = sonKisi.reduce(s, id, { kind: "escape" }, { now: t, rng: createRng(1), connected: ids });
      if (!isRejected(out)) s = out;
    }
  }
  return s;
}

export function startSonKisiMock(mock: string, params: URLSearchParams, tv = false): void {
  const kind = mock.replace(/^sonkisi-/, "");
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: kind.startsWith("results") ? ([3, 2, 0, 1, 0, 2, 1, 0][i] ?? 0) : 0,
    spectator: false,
  }));
  const spectator = tv || kind === "spectator";
  const ids = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const seed = Number(params.get("tohum")) || 11;
  const p = plan(kind, ids, params);
  const others = ids.filter((id) => id !== SELF);

  // Oynanan anın planı: hangi tur, turun başından kaç ms, o ana kadar kimler kaçmış.
  const live = (round: number, ms: number, out: string[]) => {
    p[round] = Object.fromEntries(out.map((id, i) => [id, 600 + i * 400]));
    return { round, ms };
  };
  const probe = build(0, seed, ids, p, Number.POSITIVE_INFINITY);
  const r = (i: number) => probe.rounds[i] as SonKisiState["rounds"][number];
  let m = 0;
  if (kind === "idle" || kind === "briefing") {
    const x = live(0, 300, []);
    m = r(x.round).startAt + x.ms;
  } else if (
    kind === "tense" ||
    kind === "spectator" ||
    (tv && !["gap", "reveal", "reveal-none"].includes(kind))
  ) {
    const x = live(1, 0, others.slice(0, Math.min(3, others.length - 1)));
    const rr = build(0, seed, ids, p, Number.POSITIVE_INFINITY).rounds[1];
    m = (rr?.thresholds[1] ?? 0) + 200 + x.ms;
  } else if (kind === "last2" || kind === "last1") {
    const keep = kind === "last2" ? 1 : 0;
    live(0, 0, others.slice(0, others.length - keep));
    m = r(0).startAt + 600 + others.length * 400 + 300;
  } else if (kind === "escaped") {
    live(0, 0, [SELF, ...others.slice(0, 1)]);
    const rr = build(0, seed, ids, p, Number.POSITIVE_INFINITY).rounds[0];
    m = (rr?.thresholds[1] ?? 0) + 100;
  } else if (kind === "gap") {
    m = r(0).endsAt + 50;
  } else {
    m = r(2).endsAt + 400;
  }
  const base = Date.now() - m;
  const state = build(base, seed, ids, p, Number.POSITIVE_INFINITY);
  let escapedSelf = false;
  let rev = 1;

  const snapshot = (): RoomSnapshot => {
    const now = Date.now();
    const ctx = { now, rng: createRng(1), connected: ids };
    const pub = sonKisi.publicView(state, ctx);
    const priv = sonKisi.view(state, spectator ? null : SELF, ctx);
    const results = kind.startsWith("results");
    const phase: RoomPhase = kind === "briefing" ? "briefing" : results ? "results" : "playing";
    const res = sonKisi.result(state);
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: sonKisi.briefing.goal, steps: [...sonKisi.briefing.steps] },
      orientation: "portrait",
      participants: ids,
      readyIds: kind === "briefing" ? ids.slice(1, 3) : [],
      continueIds: [],
      phaseStartedAt: state.startedAt,
      phaseEndsAt: kind === "briefing" ? now + 40_000 : results ? now + 60_000 : null,
      publicView: kind === "briefing" ? null : pub,
      view:
        kind === "briefing"
          ? null
          : escapedSelf && !priv.escaped
            ? { escaped: true, myMs: now - (state.rounds[pub.round]?.startAt ?? now) }
            : priv,
      result: results ? res : null,
    };
    return {
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
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    if ((msg.payload as { kind?: unknown } | null)?.kind === "escape" && !escapedSelf) {
      escapedSelf = true;
      applySnapshot(snapshot());
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
  // Evre ve gerilim geçişlerinde görünüm yenilensin.
  let last = sonKisi.tick(state, { now: Date.now(), rng: createRng(1), connected: ids }).stage;
  setInterval(() => {
    const s = sonKisi.tick(state, { now: Date.now(), rng: createRng(1), connected: ids }).stage;
    if (s !== last) {
      last = s;
      applySnapshot(snapshot());
    }
  }, 100);
}
