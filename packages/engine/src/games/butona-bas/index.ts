import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { rankAwards } from "../scoring.js";
import {
  BUTONA_BAS_AT_MAX_AGE_MS,
  BUTONA_BAS_COOLDOWN_MS,
  BUTONA_BAS_CROWD_POINTS,
  BUTONA_BAS_DURATION_MS,
  BUTONA_BAS_GAP_MS,
  BUTONA_BAS_ROUND_MS,
  BUTONA_BAS_ROUNDS,
  type ButonaBasAction,
  type ButonaBasCrowd,
  type ButonaBasFinal,
  type ButonaBasPhase,
  type ButonaBasPublicView,
  type ButonaBasView,
  type ButonaBasWindowResult,
  butonaBasCrowdNeed,
  butonaBasRoundOffset,
  butonaBasWindowMs,
} from "./types.js";

export * from "./types.js";

const MAX_RECENT = 8;

/** Sayılan, henüz puanlanmamış bir basış. */
interface Press {
  id: string;
  /** Dokunma anı (BB-M4; sunucu saati, ms). */
  at: number;
  /** Varış sırası (aynı `at`'te eşitlik bozucu). */
  seq: number;
  /** Basış geldiği anda bağlı katılımcı sayısı (BB-M2 eşiği; pencereyi açan basışınki geçerlidir). */
  base: number;
}

export interface ButonaBasState {
  players: string[];
  startedAt: number;
  endsAt: number;
  /** Puanlanmamış basışlar (dokunma anına göre pencerelere `settle` ayırır). */
  presses: Press[];
  seq: number;
  /** BB-M1: oyuncunun sayılan son basışının dokunma anı. */
  lastAt: Record<string, number>;
  /** Mini oyun puanları (turlar boyunca toplam). */
  scores: Record<string, number>;
  /** Tur tur puan (oyuncu -> 3 elemanlı dizi). */
  roundScores: Record<string, number[]>;
  /** Turda puanlanmış pencere sayısı (pencere sırası için). */
  windowCount: number[];
  /** BB-U7: ikili anahtarı ("a|b", oyuncu sırasıyla) -> ortak pencere sayısı. */
  pairs: Record<string, number>;
  /** BB-U7: oyuncu -> tek kaldığı pencere sayısı. */
  solos: Record<string, number>;
  /** Puanlanmış, en az bir basışı olan son pencereler (en yenisi sonda). */
  recent: ButonaBasWindowResult[];
  /**
   * Evre sayacı (0: 1. tur, 1: ara, 2: 2. tur, 3: ara, 4: 3. tur, 5: bitti). Görünümler `ctx.now`'dan türetilir;
   * sayaç yalnız "durum değişti" sinyalidir (sunucu yalnız durum değişince yayın yapar).
   */
  stage: number;
}

/** `now` anında oynanan tur (0 tabanlı); aradaysa ya da oyun dışındaysa null. */
function roundAt(state: ButonaBasState, now: number): number | null {
  const t = now - state.startedAt;
  if (t < 0 || now >= state.endsAt) return null;
  const round = Math.floor(t / (BUTONA_BAS_ROUND_MS + BUTONA_BAS_GAP_MS));
  if (round >= BUTONA_BAS_ROUNDS) return null;
  return t - butonaBasRoundOffset(round) < BUTONA_BAS_ROUND_MS ? round : null;
}

const roundStart = (state: ButonaBasState, round: number): number =>
  state.startedAt + butonaBasRoundOffset(round);
const roundEnd = (state: ButonaBasState, round: number): number =>
  roundStart(state, round) + BUTONA_BAS_ROUND_MS;

/**
 * BB-M4: istemcinin bildirdiği dokunma anı `[turStart, now]` içinde ve `now`'dan en çok 250 ms eskiyse geçerlidir;
 * yoksa (bildirilmemiş, çok eski, turdan önce ya da gelecekten) sunucunun aldığı an `now` kullanılır.
 */
export function butonaBasPressTime(at: number | undefined, turnStart: number, now: number): number {
  if (at === undefined) return now;
  return at >= turnStart && at <= now && now - at <= BUTONA_BAS_AT_MAX_AGE_MS ? at : now;
}

/** Turdaki basışlardan kurulan ilk pencere: açılış (ilk dokunuş), kapanış, puanlanma anı ve içindekiler. */
interface Window {
  round: number;
  members: Press[];
  closesAt: number;
  settlesAt: number;
}

/**
 * BB-M3 kayan pencere: turun puanlanmamış basışları dokunma anına göre sıralanır; ilk basış bir pencere açar,
 * pencere süresi içinde dokunulan herkes ona girer. Pencere kapanıştan 250 ms sonra (BB-M4) ya da en geç tur bitince
 * puanlanır (tur bittikten sonra o tura basış gelemez). Sıra varışa değil dokunma anına bağlıdır; böylece geç ulaşan
 * ama erken dokunulmuş basış pencereyi öne çeker ve sonuç tick takviminden bağımsızdır.
 */
function firstWindow(state: ButonaBasState, presses: readonly Press[]): Window | null {
  let first: Press | null = null;
  let round = -1;
  for (const p of presses) {
    if (first === null || p.at < first.at || (p.at === first.at && p.seq < first.seq)) first = p;
  }
  if (first === null) return null;
  for (let r = 0; r < BUTONA_BAS_ROUNDS; r++) if (first.at >= roundStart(state, r)) round = r;
  const end = roundEnd(state, Math.max(0, round));
  const closesAt = Math.min(first.at + butonaBasWindowMs(round), end);
  const members = presses.filter((p) => p.at < closesAt).sort((a, b) => a.at - b.at || a.seq - b.seq);
  return {
    round: Math.max(0, round),
    members,
    closesAt,
    settlesAt: Math.min(closesAt + BUTONA_BAS_AT_MAX_AGE_MS, end),
  };
}

const pairKey = (state: ButonaBasState, a: string, b: string): string =>
  state.players.indexOf(a) <= state.players.indexOf(b) ? `${a}|${b}` : `${b}|${a}`;

/** Puanlanma anı gelmiş (<= `now`) pencereleri puanlar. Değişiklik yoksa aynı nesneyi döner. */
function settle(state: ButonaBasState, now: number): ButonaBasState {
  let w = firstWindow(state, state.presses);
  if (w === null || w.settlesAt > now) return state;
  let presses = state.presses;
  const scores = { ...state.scores };
  const roundScores: Record<string, number[]> = {};
  for (const [id, list] of Object.entries(state.roundScores)) roundScores[id] = [...list];
  const windowCount = [...state.windowCount];
  const pairs = { ...state.pairs };
  const solos = { ...state.solos };
  let recent = state.recent;
  while (w !== null && w.settlesAt <= now) {
    const taken = new Set(w.members);
    presses = presses.filter((p) => !taken.has(p));
    const pressers: string[] = [];
    for (const p of w.members) if (!pressers.includes(p.id)) pressers.push(p.id);
    const opener = w.members[0];
    const need = butonaBasCrowdNeed(opener?.base ?? 0);
    const outcome: ButonaBasWindowResult["outcome"] = pressers.length >= 2 ? "match" : "solo";
    const crowd: ButonaBasCrowd | null =
      outcome === "match" && need !== null && pressers.length >= need
        ? pressers.length >= (opener?.base ?? 0)
          ? "full"
          : "crowd"
        : null;
    const points = outcome === "solo" ? -1 : crowd !== null ? BUTONA_BAS_CROWD_POINTS : 1;
    for (const id of pressers) {
      scores[id] = (scores[id] ?? 0) + points;
      const rs = roundScores[id] ?? [0, 0, 0];
      rs[w.round] = (rs[w.round] ?? 0) + points;
      roundScores[id] = rs;
    }
    if (outcome === "solo") {
      const id = pressers[0] as string;
      solos[id] = (solos[id] ?? 0) + 1;
    } else {
      for (let i = 0; i < pressers.length; i++) {
        for (let j = i + 1; j < pressers.length; j++) {
          const key = pairKey(state, pressers[i] as string, pressers[j] as string);
          pairs[key] = (pairs[key] ?? 0) + 1;
        }
      }
    }
    const index = windowCount[w.round] ?? 0;
    windowCount[w.round] = index + 1;
    recent = [
      ...recent,
      { round: w.round, index, pressers, outcome, points, crowd, settledAt: w.settlesAt },
    ].slice(-MAX_RECENT);
    w = firstWindow(state, presses);
  }
  return { ...state, presses, scores, roundScores, windowCount, pairs, solos, recent };
}

/** Gösterilecek tur ve evre: oynanıyorsa o tur, aradaysa yaklaşan tur, bittiyse son tur. */
function phaseAt(
  state: ButonaBasState,
  now: number,
): { round: number; phase: ButonaBasPhase; phaseEndsAt: number } {
  if (now >= state.endsAt) return { round: BUTONA_BAS_ROUNDS - 1, phase: "over", phaseEndsAt: state.endsAt };
  const t = Math.max(0, now - state.startedAt);
  const round = Math.min(BUTONA_BAS_ROUNDS - 1, Math.floor(t / (BUTONA_BAS_ROUND_MS + BUTONA_BAS_GAP_MS)));
  const end = roundEnd(state, round);
  if (now < end) return { round, phase: "play", phaseEndsAt: end };
  // Ara: yaklaşan tur.
  return { round: round + 1, phase: "gap", phaseEndsAt: roundStart(state, round + 1) };
}

/** Evre numarası (bkz. `ButonaBasState.stage`). */
function stageAt(state: ButonaBasState, now: number): number {
  const { round, phase } = phaseAt(state, now);
  if (phase === "over") return 2 * BUTONA_BAS_ROUNDS - 1;
  return phase === "gap" ? 2 * round - 1 : 2 * round;
}

function finalOf(state: ButonaBasState): ButonaBasFinal {
  const pairs = Object.entries(state.pairs)
    .map(([key, count]) => {
      const [a = "", b = ""] = key.split("|");
      return { a, b, count };
    })
    .filter((p) => p.count > 0)
    .sort(
      (x, y) =>
        y.count - x.count ||
        state.players.indexOf(x.a) - state.players.indexOf(y.a) ||
        state.players.indexOf(x.b) - state.players.indexOf(y.b),
    );
  return { pairs, solos: { ...state.solos } };
}

/**
 * Butona Bas aktarımı: 3 turun mini toplamına göre sıralama ödülü, oyun sonunda bir kez (tek lider +2, sıradaki +1;
 * lider eşitse liderler +1). BB-M5: yalnız toplamı 0'dan büyük olanlar ödül alır; herkes ≤ 0 ise ödül yok.
 */
export function butonaBasAwards(scores: Record<string, number>): Record<string, number> {
  return rankAwards(scores, { positiveOnly: true });
}

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const butonaBas: GameDefinition<ButonaBasState, ButonaBasAction, ButonaBasView, ButonaBasPublicView> =
  {
    id: "butona-bas",
    name: "Butona Bas",
    minPlayers: 2,
    maxPlayers: 8,
    orientation: "portrait",
    briefing: {
      goal: "Arkadaşlarınla aynı anda bas!",
      steps: [
        "Birlikte bas: aynı anda basanlar +1, tek kalan −1",
        "Bastıktan sonra buton 1 sn dolar; yüksek sesle '3, 2, 1, BAS!' deyin",
        "3 tur: pencere her turda daralır (300, 200, 120 ms)",
      ],
    },

    parseAction(raw: unknown): ButonaBasAction | null {
      if (!isRec(raw) || raw.kind !== "press") return null;
      const keys = Object.keys(raw);
      if (keys.length === 1) return { kind: "press" };
      if (keys.length !== 2 || !keys.includes("at")) return null;
      const at = raw.at;
      if (typeof at !== "number" || !Number.isFinite(at) || at < 0) return null;
      return { kind: "press", at };
    },

    setup(players: readonly string[], ctx: GameContext): ButonaBasState {
      const scores: Record<string, number> = {};
      const roundScores: Record<string, number[]> = {};
      for (const id of players) {
        scores[id] = 0;
        roundScores[id] = Array.from({ length: BUTONA_BAS_ROUNDS }, () => 0);
      }
      return {
        players: [...players],
        startedAt: ctx.now,
        endsAt: ctx.now + BUTONA_BAS_DURATION_MS,
        presses: [],
        seq: 0,
        lastAt: {},
        scores,
        roundScores,
        windowCount: Array.from({ length: BUTONA_BAS_ROUNDS }, () => 0),
        pairs: {},
        solos: {},
        recent: [],
        stage: 0,
      };
    },

    reduce(state, playerId, action, ctx): ButonaBasState | Rejected {
      if (!state.players.includes(playerId)) return { rejected: "not_participant" };
      if (ctx.now >= state.endsAt) return { rejected: "ended" };
      if (ctx.now < state.startedAt) return { rejected: "not_started" };
      const round = roundAt(state, ctx.now);
      if (round === null) return { rejected: "between_rounds" };
      const at = butonaBasPressTime(action.at, roundStart(state, round), ctx.now);
      // BB-M1: dolum bitmeden gelen basış sessizce yok sayılır (ceza yok). Aynı pencerede tekrar basış da budur.
      const last = state.lastAt[playerId];
      if (last !== undefined && at - last < BUTONA_BAS_COOLDOWN_MS) return state;
      const base = ctx.connected.filter((id) => state.players.includes(id)).length;
      const press: Press = { id: playerId, at, seq: state.seq, base: Math.max(1, base) };
      return {
        ...state,
        presses: [...state.presses, press],
        seq: state.seq + 1,
        lastAt: { ...state.lastAt, [playerId]: at },
      };
    },

    tick(state, ctx): ButonaBasState {
      const settled = settle(state, ctx.now);
      const stage = stageAt(state, ctx.now);
      return stage === settled.stage ? settled : { ...settled, stage };
    },

    nextWake(state, ctx): number | null {
      const candidates = [state.endsAt, phaseAt(state, ctx.now).phaseEndsAt];
      const w = firstWindow(state, state.presses);
      if (w !== null) candidates.push(w.settlesAt);
      let best: number | null = null;
      for (const at of candidates) if (at > ctx.now && (best === null || at < best)) best = at;
      return best;
    },

    publicView(state, ctx): ButonaBasPublicView {
      const { round, phase, phaseEndsAt } = phaseAt(state, ctx.now);
      const s = phase === "over" ? settle(state, Number.POSITIVE_INFINITY) : state;
      const roundScores: Record<string, number[]> = {};
      for (const [id, list] of Object.entries(s.roundScores)) roundScores[id] = [...list];
      return {
        startedAt: s.startedAt,
        endsAt: s.endsAt,
        round: round + 1,
        rounds: BUTONA_BAS_ROUNDS,
        phase,
        windowMs: butonaBasWindowMs(round),
        phaseEndsAt,
        scores: { ...s.scores },
        roundScores,
        recent: s.recent.map((w) => ({ ...w, pressers: [...w.pressers] })),
        final: phase === "over" ? finalOf(s) : null,
      };
    },

    view(state, playerId, ctx): ButonaBasView {
      if (playerId === null) return { myScore: null, pressedThisWindow: false, readyAt: null };
      const round = roundAt(state, ctx.now);
      const w = round === null ? 0 : butonaBasWindowMs(round);
      const last = state.lastAt[playerId];
      const readyAt = last === undefined ? null : last + BUTONA_BAS_COOLDOWN_MS;
      return {
        myScore: state.scores[playerId] ?? 0,
        pressedThisWindow:
          round !== null && state.presses.some((p) => p.id === playerId && p.at + w > ctx.now),
        readyAt: readyAt !== null && readyAt > ctx.now ? readyAt : null,
      };
    },

    /** Sonuç ekranı son turun bittiği an başlar. */
    revealAt(state): number | null {
      return state.endsAt;
    },

    isFinished(state, ctx): boolean {
      return ctx.now >= state.endsAt;
    },

    secrets() {
      return [];
    },

    result(state) {
      const settled = settle(state, Number.POSITIVE_INFINITY);
      return { miniScores: { ...settled.scores }, awards: butonaBasAwards(settled.scores) };
    },
  };
