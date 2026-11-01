import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  KOR_KRONOMETRE_AT_MAX_AGE_MS,
  KOR_KRONOMETRE_BULLSEYE_BONUS,
  KOR_KRONOMETRE_BULLSEYE_MS,
  KOR_KRONOMETRE_GAP_MS,
  KOR_KRONOMETRE_HANDS,
  KOR_KRONOMETRE_LOCK_GRACE_MS,
  KOR_KRONOMETRE_REVEAL_MS,
  KOR_KRONOMETRE_TARGET_MAX_S,
  KOR_KRONOMETRE_TARGET_MIN_S,
  type KorKronometreAction,
  type KorKronometreEntry,
  type KorKronometreFinal,
  type KorKronometreHand,
  type KorKronometrePhase,
  type KorKronometrePublicView,
  type KorKronometreReveal,
  type KorKronometreStanding,
  type KorKronometreView,
  korKronometreDurationMs,
  korKronometreReadyMs,
} from "./types.js";

export * from "./types.js";

/** Bir elin durumu. Zamanlar sunucu saatidir (ms). */
export interface KorKronometreHandState {
  targetMs: number;
  startAt: number;
  goAt: number;
  /** Basışın kapanışı; herkes bastıysa öne çekilir (basış anı + 1 sn) ve sonraki eller kayar. */
  endsAt: number;
  /** Yalnız basanlar: oyuncu → basış anı ("BAŞLA!"dan ms). */
  presses: Record<string, number>;
}

export interface KorKronometreState {
  players: string[];
  startedAt: number;
  /** Üç elin takvimi ve basışları; gelecek ellerin hedefi görünümlere girmez. */
  hands: KorKronometreHandState[];
  /** Son açılışın bitişi (oyunun bitişi). */
  revealEndsAt: number;
  /**
   * Evre sayacı (el i için 3i: hazır ol, 3i+1: sayma, 3i+2: el arası / son açılış). Görünümler `ctx.now`'dan türetilir;
   * sayaç yalnız "durum değişti" sinyalidir (sunucu yalnız durum değişince yayın yapar).
   */
  stage: number;
}

/**
 * Bir elin satırları: derece (1, 1, 3 …) ve el puanı (derece 1 → 2, derece 2 → 1; tam isabette +1). Yalnız basanlar
 * sıralanır (yakından uzağa); basmayanlar sıralamaya girmez, puan almaz ve listenin sonunda katılım sırasıyla yer alır.
 */
export function korKronometreHandEntries(
  players: readonly string[],
  hand: Pick<KorKronometreHandState, "targetMs" | "presses">,
): KorKronometreEntry[] {
  const pressed: { playerId: string; order: number; ms: number; distance: number }[] = [];
  const missed: KorKronometreEntry[] = [];
  players.forEach((playerId, order) => {
    const ms = hand.presses[playerId];
    if (ms === undefined) {
      missed.push({
        playerId,
        ms: null,
        pressed: false,
        distance: null,
        rank: null,
        bullseye: false,
        points: 0,
      });
    } else {
      pressed.push({ playerId, order, ms, distance: Math.abs(ms - hand.targetMs) });
    }
  });
  pressed.sort((a, b) => a.distance - b.distance || a.order - b.order);
  const ranked = pressed.map((r): KorKronometreEntry => {
    const rank = pressed.findIndex((x) => x.distance === r.distance) + 1;
    const bullseye = r.distance <= KOR_KRONOMETRE_BULLSEYE_MS;
    return {
      playerId: r.playerId,
      ms: r.ms,
      pressed: true,
      distance: r.distance,
      rank,
      bullseye,
      points: (rank === 1 ? 2 : rank === 2 ? 1 : 0) + (bullseye ? KOR_KRONOMETRE_BULLSEYE_BONUS : 0),
    };
  });
  return [...ranked, ...missed];
}

/** Bütün ellerin satırları (el sırasıyla). */
export function korKronometreEntries(state: KorKronometreState): KorKronometreEntry[][] {
  return state.hands.map((h) => korKronometreHandEntries(state.players, h));
}

/** Oyuncu → ellerin toplam puanı (yalnız `hands` içindeki eller). */
function totalsOf(
  players: readonly string[],
  reveals: readonly KorKronometreEntry[][],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of players) totals[id] = 0;
  for (const entries of reveals)
    for (const e of entries) totals[e.playerId] = (totals[e.playerId] ?? 0) + e.points;
  return totals;
}

/**
 * KR-M3 oyun sonu sıralaması ve genel skor: toplam el puanı büyük olan önde; eşitse daha çok elde basan; o da eşitse
 * bastığı ellerdeki ortalama uzaklığı küçük olan; o da eşitse aynı derece. Genel skor: birinci grup +2, sonraki grup +1
 * (birincide eşitlikte hepsi +2, sonraki +1); bütün katılımcılar eşit ve toplam > 0 ise herkes +1. Toplamı 0 olan ödül
 * almaz.
 */
export function korKronometreStandings(
  players: readonly string[],
  reveals: readonly KorKronometreEntry[][],
): KorKronometreStanding[] {
  const rows = players.map((playerId, order) => {
    const handPoints = reveals.map((entries) => {
      const e = entries.find((x) => x.playerId === playerId);
      return e?.pressed ? e.points : null;
    });
    const distances = reveals
      .map((entries) => entries.find((x) => x.playerId === playerId)?.distance ?? null)
      .filter((d): d is number => d !== null);
    const total = handPoints.reduce<number>((a, p) => a + (p ?? 0), 0);
    return {
      playerId,
      order,
      total,
      handPoints,
      pressedHands: distances.length,
      avgDistance: distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : null,
    };
  });
  type Row = (typeof rows)[number];
  /** Hiç basmayanın ortalama uzaklığı yoktur: basanların gerisinde, kendi aralarında eşit sayılır. */
  const avgCmp = (a: number | null, b: number | null): number =>
    a === null ? (b === null ? 0 : 1) : b === null ? -1 : a - b;
  const cmp = (a: Row, b: Row): number =>
    b.total - a.total || b.pressedHands - a.pressedHands || avgCmp(a.avgDistance, b.avgDistance);
  const sorted = [...rows].sort((a, b) => cmp(a, b) || a.order - b.order);
  // Eşitlik grupları (aynı anahtar = aynı derece).
  const groupOf: number[] = [];
  let group = 0;
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && cmp(prev, r) !== 0) group++;
    groupOf.push(group);
  });
  const allEqual = group === 0;
  return sorted.map((r, i): KorKronometreStanding => {
    const g = groupOf[i] ?? 0;
    const rank = sorted.findIndex((x) => cmp(x, r) === 0) + 1;
    const award = r.total <= 0 ? 0 : allEqual ? 1 : g === 0 ? 2 : g === 1 ? 1 : 0;
    return {
      playerId: r.playerId,
      total: r.total,
      handPoints: r.handPoints,
      pressedHands: r.pressedHands,
      avgDistance: r.avgDistance,
      rank,
      award,
    };
  });
}

/** El `from`dan sonraki ellerin takvimini, önceki elin kapanışına göre yeniden kurar. */
function reflow(hands: readonly KorKronometreHandState[], from: number): KorKronometreHandState[] {
  const out = hands.map((h) => ({ ...h }));
  for (let i = from + 1; i < out.length; i++) {
    const prev = out[i - 1] as KorKronometreHandState;
    const h = out[i] as KorKronometreHandState;
    h.startAt = prev.endsAt + KOR_KRONOMETRE_GAP_MS;
    h.goAt = h.startAt + korKronometreReadyMs(i);
    h.endsAt = h.goAt + korKronometreDurationMs(h.targetMs);
  }
  return out;
}

const lastHand = (state: KorKronometreState): KorKronometreHandState =>
  state.hands[state.hands.length - 1] as KorKronometreHandState;

/** `now` anındaki el ve evre. */
export function korKronometrePhaseAt(
  state: Pick<KorKronometreState, "hands">,
  now: number,
): { hand: number; phase: KorKronometrePhase } {
  for (let i = 0; i < state.hands.length; i++) {
    const h = state.hands[i] as KorKronometreHandState;
    if (now < h.startAt) return i === 0 ? { hand: 0, phase: "ready" } : { hand: i - 1, phase: "gap" };
    if (now < h.goAt) return { hand: i, phase: "ready" };
    if (now < h.endsAt) return { hand: i, phase: "count" };
  }
  return { hand: state.hands.length - 1, phase: "over" };
}

function stageAt(state: KorKronometreState, now: number): number {
  const { hand, phase } = korKronometrePhaseAt(state, now);
  return 3 * hand + (phase === "ready" ? 0 : phase === "count" ? 1 : 2);
}

/**
 * KR-M1: istemcinin bildirdiği dokunma anı. Bildirilmemişse ya da sunucunun aldığı andan 400 ms'den eskiyse sunucu anı
 * `now`; gelecekten geliyorsa `now`a çekilir; "BAŞLA!"dan önceyse geçersizdir (null: basış reddedilir).
 */
export function korKronometrePressTime(at: number | undefined, goAt: number, now: number): number | null {
  if (at === undefined) return now;
  if (at < goAt) return null;
  if (at > now) return now;
  return now - at <= KOR_KRONOMETRE_AT_MAX_AGE_MS ? at : now;
}

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const korKronometre: GameDefinition<
  KorKronometreState,
  KorKronometreAction,
  KorKronometreView,
  KorKronometrePublicView
> = {
  id: "kor-kronometre",
  name: "Kör Kronometre",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "İçinden say, hedef saniyede bas!",
    steps: [
      "Sayaç görünmez; hedef yazılı (7–13 sn)",
      "'BAŞLA!' ile içinden say, tek kez bas",
      "3 el: her elde en yakın 2, ikinci 1 puan",
    ],
  },

  parseAction(raw: unknown): KorKronometreAction | null {
    if (!isRec(raw) || raw.kind !== "press") return null;
    const keys = Object.keys(raw);
    if (keys.length === 1) return { kind: "press" };
    if (keys.length !== 2 || !keys.includes("at")) return null;
    const at = raw.at;
    if (typeof at !== "number" || !Number.isFinite(at) || at < 0) return null;
    return { kind: "press", at };
  },

  setup(players: readonly string[], ctx: GameContext): KorKronometreState {
    // Hedefler: 7–13 sn arası tam saniye, eller arasında tekrarsız; tohumlu RNG'den (tekrar oynatmada aynı sonuç).
    const pool: number[] = [];
    for (let s = KOR_KRONOMETRE_TARGET_MIN_S; s <= KOR_KRONOMETRE_TARGET_MAX_S; s++) pool.push(s * 1_000);
    const hands: KorKronometreHandState[] = [];
    for (let i = 0; i < KOR_KRONOMETRE_HANDS; i++) {
      const [targetMs] = pool.splice(ctx.rng.int(pool.length), 1);
      const startAt = i === 0 ? ctx.now : 0;
      const goAt = startAt + korKronometreReadyMs(i);
      hands.push({
        targetMs: targetMs ?? 10_000,
        startAt,
        goAt,
        endsAt: goAt + korKronometreDurationMs(targetMs ?? 10_000),
        presses: {},
      });
    }
    const scheduled = reflow(hands, 0);
    const last = scheduled[scheduled.length - 1] as KorKronometreHandState;
    return {
      players: [...players],
      startedAt: ctx.now,
      hands: scheduled,
      revealEndsAt: last.endsAt + KOR_KRONOMETRE_REVEAL_MS,
      stage: 0,
    };
  },

  reduce(state, playerId, action, ctx): KorKronometreState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    // Süre sunucu saatiyle ölçülür; son elin bitiş anında ve sonrasında gelen basış geçersizdir.
    if (ctx.now >= lastHand(state).endsAt) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    const { hand: i, phase } = korKronometrePhaseAt(state, ctx.now);
    // "Hazır ol" sırasında basış hak yakmaz; el arası ve el kapanışından sonra gelen basış sayılmaz.
    if (phase === "ready") return { rejected: "not_started" };
    if (phase !== "count") return { rejected: "between_hands" };
    const hand = state.hands[i] as KorKronometreHandState;
    if (hand.presses[playerId] !== undefined) return { rejected: "already_pressed" };
    const t = korKronometrePressTime(action.at, hand.goAt, ctx.now);
    if (t === null) return { rejected: "too_early" };
    const presses = { ...hand.presses, [playerId]: t - hand.goAt };
    let hands = state.hands.map((h, k) => (k === i ? { ...h, presses } : h));
    // Herkes bastıysa el kesindir: bütün katılımcılar (bağlantıdan bağımsız) basınca 1 sn sonra kapanır.
    if (state.players.every((id) => presses[id] !== undefined)) {
      const endsAt = Math.min(hand.endsAt, ctx.now + KOR_KRONOMETRE_LOCK_GRACE_MS);
      hands = reflow(
        hands.map((h, k) => (k === i ? { ...h, endsAt } : h)),
        i,
      );
    }
    const last = hands[hands.length - 1] as KorKronometreHandState;
    return { ...state, hands, revealEndsAt: last.endsAt + KOR_KRONOMETRE_REVEAL_MS };
  },

  tick(state, ctx): KorKronometreState {
    const stage = stageAt(state, ctx.now);
    return stage === state.stage ? state : { ...state, stage };
  },

  nextWake(state, ctx): number | null {
    let best: number | null = null;
    for (const h of state.hands) {
      for (const at of [h.startAt, h.goAt, h.endsAt]) {
        if (at > ctx.now && (best === null || at < best)) best = at;
      }
    }
    if (state.revealEndsAt > ctx.now && (best === null || state.revealEndsAt < best))
      best = state.revealEndsAt;
    return best;
  },

  publicView(state, ctx): KorKronometrePublicView {
    const { hand, phase } = korKronometrePhaseAt(state, ctx.now);
    // El arasında sıradaki elin hedefi de gösterilir (geçişte "11 → 8"); daha sonraki eller yoktur.
    const upTo = phase === "gap" ? hand + 1 : hand;
    const played: KorKronometreHand[] = [];
    const reveals: KorKronometreEntry[][] = [];
    state.hands.forEach((h, index) => {
      if (index > upTo) return;
      // Bir el kapanmadan kimin bastığı ve ne zaman bastığı yoktur.
      const reveal: KorKronometreReveal | null =
        ctx.now >= h.endsAt ? { entries: korKronometreHandEntries(state.players, h) } : null;
      if (reveal) reveals.push(reveal.entries);
      played.push({
        index,
        targetMs: h.targetMs,
        startAt: h.startAt,
        goAt: h.goAt,
        endsAt: h.endsAt,
        reveal,
      });
    });
    const lastShown = upTo >= state.hands.length - 1;
    const final: KorKronometreFinal | null =
      phase === "over" ? { standings: korKronometreStandings(state.players, reveals) } : null;
    return {
      startedAt: state.startedAt,
      hands: state.hands.length,
      hand,
      phase,
      played,
      totals: totalsOf(state.players, reveals),
      endsAt: lastShown ? lastHand(state).endsAt : null,
      revealEndsAt: lastShown ? state.revealEndsAt : null,
      final,
    };
  },

  view(state, playerId, ctx): KorKronometreView {
    if (playerId === null) return { pressed: false };
    const { hand } = korKronometrePhaseAt(state, ctx.now);
    return { pressed: state.hands[hand]?.presses[playerId] !== undefined };
  },

  /** Son açılış son elin kapandığı an başlar. */
  revealAt(state): number | null {
    return lastHand(state).endsAt;
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.revealEndsAt;
  },

  /**
   * Basış anları 0–21 000 arası, çoğu kez kısa sayılardır; alt dizgi sızıntı denetimi bunları koruyamaz.
   * Gizlilik yapısal olarak sağlanır: `publicView` bir el kapanmadan o elin basışlarını taşımaz, `view` yalnız
   * "bastın mı" der (bkz. kor-kronometre.test.ts, "gizlilik").
   */
  secrets() {
    return [];
  },

  result(state) {
    const reveals = korKronometreEntries(state);
    const standings = korKronometreStandings(state.players, reveals);
    const miniScores: Record<string, number> = {};
    const awards: Record<string, number> = {};
    for (const id of state.players) {
      const s = standings.find((x) => x.playerId === id);
      miniScores[id] = s?.total ?? 0;
      awards[id] = s?.award ?? 0;
    }
    return { miniScores, awards };
  },
};
