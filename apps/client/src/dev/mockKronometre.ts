/**
 * Yalnız geliştirme önizlemesi: Kör Kronometre ekranları (`&n=2..8` oyuncu sayısı). Görünümler gerçek motordan
 * (setup + sahte basışlar) üretilir; saat, istenen anın "şimdi" olacağı şekilde kaydırılır.
 *   ?mock=kor-kronometre-briefing    anlatım (iç saat denemesi dahil)
 *   ?mock=kor-kronometre-ready       "Hazır ol" (`&el=2|3`: önceki hedeften kayan rakam)
 *   ?mock=kor-kronometre-counting    sayma (karanlık oda); BAS'a basınca kilitlenir (`&el=1..3`)
 *   ?mock=kor-kronometre-pressed     basıldı: KİLİTLENDİ, "Basışın mühürlendi."
 *   ?mock=kor-kronometre-gap         el arası kısa açılış (`&el=1|2`; 2'de eğilim satırı)
 *   ?mock=kor-kronometre-reveal      son açılış (`&at=ms` açılıştan geçen süre, varsayılan 5000; `&rank=1..8`
 *                                    kendi sıran, `&nopress=1` son ikisi basmaz, `&isabet=1` tam isabet)
 *   `&izle=1` ya da ?mock=kor-kronometre-spectator: izleyici (Sen de dene); `&tohum=N` hedefler
 *   ?mock=tv-kor-kronometre-…        büyük ekran (izleyici kipinde StageView)
 */
import {
  createRng,
  type GameInfo,
  isRejected,
  type KorKronometreState,
  korKronometre,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: korKronometre.id,
  name: korKronometre.name,
  minPlayers: korKronometre.minPlayers,
  maxPlayers: korKronometre.maxPlayers,
  orientation: "portrait",
};
/** Hedefe göre sahte farklar (yakından uzağa); her elde bir kaydırılır. */
const OFFSETS = [-150, 420, -900, 1_800, -2_600, 3_900, -5_000, 7_000];

interface Plan {
  ids: string[];
  rank: number;
  nopress: boolean;
  isabet: boolean;
}

/** El `i` için oyuncu → hedefe göre fark (basmayan yok). */
function handOffsets(plan: Plan, i: number): Record<string, number> {
  const { ids } = plan;
  const mineAt = Math.min(ids.length, Math.max(1, plan.rank)) - 1;
  const others = ids.filter((id) => id !== SELF);
  const order: string[] = [];
  for (let s = 0, o = 0; s < ids.length; s++) order.push(s === mineAt ? SELF : (others[o++] as string));
  const out: Record<string, number> = {};
  order.forEach((id, s) => {
    if (plan.nopress && s >= ids.length - 2) return;
    let off = OFFSETS[(s + (i === 1 ? 1 : 0)) % OFFSETS.length] ?? 7_000;
    if (i === 1 && s === 0) off = 260;
    if (plan.isabet && i === 2 && s === 0) off = -30;
    out[id] = off;
  });
  return out;
}

/** `base` anında kurar ve `upTo` (dahil) ellerdeki basışları, `before` anından öncekileri uygular. */
function build(base: number, seed: number, plan: Plan, upTo: number, before: number): KorKronometreState {
  let s = korKronometre.setup(plan.ids, { now: base, rng: createRng(seed), connected: plan.ids });
  for (let i = 0; i <= upTo; i++) {
    const offs = handOffsets(plan, i);
    const sorted = Object.entries(offs).sort((a, b) => a[1] - b[1]);
    for (const [id, off] of sorted) {
      const h = s.hands[i];
      if (!h) continue;
      const at = h.goAt + h.targetMs + off;
      if (at >= before || at >= h.endsAt) continue;
      const r = korKronometre.reduce(
        s,
        id,
        { kind: "press" },
        { now: at, rng: createRng(1), connected: plan.ids },
      );
      if (!isRejected(r)) s = r;
    }
  }
  return s;
}

export function startKronometreMock(kind: string, params: URLSearchParams, tv = false): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(params.get("koptu") === "1" && i === n - 1),
    score: 0,
    spectator: false,
  }));
  const spectator = tv || kind.endsWith("spectator") || params.get("izle") === "1";
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const plan: Plan = {
    ids: participants,
    rank: Number(params.get("rank")) || 1,
    nopress: params.get("nopress") === "1",
    isabet: params.get("isabet") === "1",
  };
  const seed = Number(params.get("tohum")) || 7;
  const el = Math.min(3, Math.max(1, Number(params.get("el")) || 1)) - 1;
  const stage = kind.replace(/^kor-kronometre-/, "").replace(/-spectator$/, "");

  // Probe: şimdi sayılacak oyun anını (M) bulur; sonra gerçek durum `Date.now() - M`'de kurulur.
  const moment = (s: KorKronometreState): { m: number; upTo: number; before: number } => {
    const h = s.hands[stage === "reveal" ? 2 : el] ?? s.hands[0];
    if (!h) return { m: 0, upTo: -1, before: 0 };
    switch (stage) {
      case "ready":
        return { m: h.startAt + 100, upTo: el - 1, before: Number.POSITIVE_INFINITY };
      case "counting":
      case "pressed":
      case "spectator":
        return { m: h.goAt + 1_000, upTo: el - 1, before: Number.POSITIVE_INFINITY };
      case "gap":
        return { m: h.endsAt + 300, upTo: el, before: Number.POSITIVE_INFINITY };
      case "reveal":
        return {
          m: h.endsAt + (Number(params.get("at")) || 5_000),
          upTo: 2,
          before: Number.POSITIVE_INFINITY,
        };
      default:
        return { m: 0, upTo: -1, before: 0 };
    }
  };
  let probe = build(0, seed, plan, 2, Number.POSITIVE_INFINITY);
  const first = moment(probe);
  probe = build(0, seed, plan, first.upTo, first.before);
  const { m, upTo } = moment(probe);
  const base = Date.now() - m;
  const state = build(base, seed, plan, upTo, Number.POSITIVE_INFINITY);

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let pressed = stage === "pressed";
  let rev = 1;

  const snapshot = (): RoomSnapshot => {
    const now = Date.now();
    if (stage === "briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = now + 40_000;
    }
    const ctx = { now, rng: createRng(1), connected: participants };
    const pub = korKronometre.publicView(state, ctx);
    const priv = korKronometre.view(state, spectator ? null : SELF, ctx);
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: korKronometre.briefing.goal, steps: [...korKronometre.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      continueIds: [],
      phaseStartedAt: state.startedAt,
      phaseEndsAt,
      publicView: pub,
      view: { pressed: !spectator && (pressed || priv.pressed) },
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
    if ((msg.payload as { kind?: string } | null)?.kind === "press") {
      pressed = true;
      applySnapshot(snapshot());
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
  // Evre geçişlerinde (BAŞLA!, el kapanışı) görünüm yenilensin.
  let last = korKronometre.tick(state, { now: Date.now(), rng: createRng(1), connected: participants }).stage;
  setInterval(() => {
    const s = korKronometre.tick(state, {
      now: Date.now(),
      rng: createRng(1),
      connected: participants,
    }).stage;
    if (s !== last) {
      last = s;
      applySnapshot(snapshot());
    }
  }, 100);
}
