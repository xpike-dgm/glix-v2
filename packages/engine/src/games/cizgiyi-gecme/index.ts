import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { rankAwards } from "../scoring.js";
import {
  CIZGI_CHOOSE_MS,
  CIZGI_LOCK_GRACE_MS,
  CIZGI_MAX,
  CIZGI_MIN,
  CIZGI_RADAR_MIN_PLAYERS,
  CIZGI_RADAR_MS,
  CIZGI_REVEAL_MS,
  CIZGI_ROUND_REVEAL_MS,
  CIZGI_ROUNDS,
  type CizgiAction,
  type CizgiPublicView,
  type CizgiRadar,
  type CizgiReveal,
  type CizgiStatus,
  type CizgiView,
  cizgiZone,
  cizgiZoneWidth,
} from "./types.js";

export * from "./types.js";

/** Bir turun durumu. Erken bitişte `endsAt`/`revealEndsAt` öne çekilir ve sonraki tur aynı kadar kayar. */
export interface CizgiRoundState {
  startAt: number;
  endsAt: number;
  revealEndsAt: number;
  /** Yalnız seçim gönderenler; son seçim geçerlidir. Seçmeyen o turda pasiftir. */
  choices: Record<string, number>;
  /** Seçimini kilitleyenler (kilit sırasıyla). */
  locked: string[];
  /** Radar fotoğrafı (CZ-M3); çekilmediyse null. */
  radar: CizgiRadar | null;
  /** Bu tur radar artık çekilmez (2 kişi ya da herkes radardan önce kilitledi). */
  radarOff: boolean;
}

export interface CizgiState {
  players: string[];
  startedAt: number;
  rounds: CizgiRoundState[];
  /**
   * Süresi dolmuş tur sayısı, ekrandaki tur ve radarı çekilmiş tur sayısı. Görünümler `ctx.now`'dan türetilir; bunlar
   * yalnız sunucunun "durum değişti" sinyalini almasını sağlar (aksi halde açılış, tur geçişi ve radar yayınlanmaz).
   */
  revealed: number;
  shown: number;
}

/**
 * Saf tur puanlaması (motor ve istemcinin "ne olurdu?" hesabı): aynı bölgede ≥ 2 kişi olanların hepsi pasif (0, ceza
 * yok); seçmeyen pasif. Tek kalanlar arasında en yüksek sayı +2, ikinci +1. Tek kalanlar farklı bölgelerde olduğundan
 * sayıları da farklıdır; eşitlik oluşamaz.
 */
export function cizgiScore(
  players: readonly string[],
  picks: Readonly<Record<string, number | null | undefined>>,
  width: number,
): CizgiReveal {
  const choices: Record<string, number | null> = {};
  const status: Record<string, CizgiStatus> = {};
  const points: Record<string, number> = {};
  const perZone = new Map<number, number>();
  for (const id of players) {
    const v = picks[id];
    choices[id] = v ?? null;
    if (v !== undefined && v !== null) {
      const z = cizgiZone(v, width);
      perZone.set(z, (perZone.get(z) ?? 0) + 1);
    }
  }
  const alone: string[] = [];
  for (const id of players) {
    const v = picks[id];
    points[id] = 0;
    if (v === undefined || v === null) status[id] = "none";
    else if ((perZone.get(cizgiZone(v, width)) ?? 0) >= 2) status[id] = "crashed";
    else {
      status[id] = "safe";
      alone.push(id);
    }
  }
  alone.sort((a, b) => (picks[b] ?? 0) - (picks[a] ?? 0));
  const [first, second] = alone;
  if (first !== undefined) {
    status[first] = "first";
    points[first] = 2;
  }
  if (second !== undefined) {
    status[second] = "second";
    points[second] = 1;
  }
  return { zoneWidth: width, choices, status, points };
}

/** Bir turun açılmış sonucu. */
export function cizgiSettle(state: CizgiState, roundIndex: number): CizgiReveal {
  const round = state.rounds[roundIndex];
  return cizgiScore(state.players, round?.choices ?? {}, cizgiZoneWidth(state.players.length));
}

/** Kalabalık radarı: o ana kadar gönderilmiş seçimlerde 2+ pin bulunan platformlar (kim olduğu yok). */
export function cizgiRadarZones(choices: Readonly<Record<string, number>>, width: number): number[] {
  const count = new Map<number, number>();
  for (const v of Object.values(choices))
    count.set(cizgiZone(v, width), (count.get(cizgiZone(v, width)) ?? 0) + 1);
  return [...count.entries()]
    .filter(([, c]) => c >= 2)
    .map(([z]) => z)
    .sort((a, b) => a - b);
}

/** Tur puanı toplamı: ilk `count` turun puanları. */
function totalsOf(state: CizgiState, count: number): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of state.players) totals[id] = 0;
  for (let r = 0; r < Math.min(count, state.rounds.length); r++) {
    const { points } = cizgiSettle(state, r);
    for (const id of state.players) totals[id] = (totals[id] ?? 0) + (points[id] ?? 0);
  }
  return totals;
}

/**
 * Genel skor (CZ-M1), oyun sonunda bir kez: tur puanı toplamına göre ortak sıralama kuralı (`rankAwards`, yalnız
 * toplamı 0'dan büyükler): tek lider +2, sonraki toplamı paylaşanların hepsi +1; liderler eşitse hepsi +1. Eksi yok.
 */
export function cizgiAwards(totals: Record<string, number>): Record<string, number> {
  const awards = rankAwards(totals, { positiveOnly: true });
  const out: Record<string, number> = {};
  for (const id of Object.keys(totals)) out[id] = awards[id] ?? 0;
  return out;
}

/** `now` anında gösterilecek tur: açılışı bitmemiş ilk tur, yoksa son tur. */
function currentRound(state: CizgiState, now: number): number {
  const i = state.rounds.findIndex((r) => now < r.revealEndsAt);
  return i === -1 ? state.rounds.length - 1 : i;
}

function gameEndsAt(state: CizgiState): number {
  return state.rounds[state.rounds.length - 1]?.revealEndsAt ?? state.startedAt;
}

function revealLength(round: number): number {
  return round === CIZGI_ROUNDS - 1 ? CIZGI_REVEAL_MS : CIZGI_ROUND_REVEAL_MS;
}

/**
 * Zamana bağlı ilerleme (saf): radar anı gelmiş turlarda o anki gönderilmiş seçimlerin fotoğrafını çeker. Her eylemden,
 * tick'ten ve görünümden önce çağrılır; böylece fotoğraf radar anındaki seçimleri taşır (sonraki seçimler girmez).
 */
function catchUp(state: CizgiState, now: number): CizgiState {
  let rounds: CizgiRoundState[] | null = null;
  const width = cizgiZoneWidth(state.players.length);
  state.rounds.forEach((r, i) => {
    if (r.radar !== null || r.radarOff) return;
    const at = r.startAt + CIZGI_RADAR_MS;
    if (now < at || at >= r.endsAt) return;
    rounds = rounds ?? [...state.rounds];
    rounds[i] = { ...r, radar: { at, zones: cizgiRadarZones(r.choices, width) } };
  });
  return rounds === null ? state : { ...state, rounds };
}

export const cizgiyiGecme: GameDefinition<CizgiState, CizgiAction, CizgiView, CizgiPublicView> = {
  id: "cizgiyi-gecme",
  name: "Çizgiyi Geçme",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "En yükseğe çık ama kimseyle aynı platformda kalma!",
    steps: [
      "İki tur: gizlice 0 ile 100 arasında bir sayı seç. Platformlar oyuncu sayısına göre; 100 tek başına Zirve.",
      "Biriyle aynı platforma düşersen ikiniz de çarpışır, puan yok. Turun ortasında radar kalabalık platformları yakar.",
      "Tek kalanların en yükseği +2, ikincisi +1; tek kalıp üçüncü olan 0. İki turun toplamı kazanır.",
    ],
  },

  parseAction(raw: unknown): CizgiAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (rec.kind === "lock") return Object.keys(rec).length === 1 ? { kind: "lock" } : null;
    if (Object.keys(rec).length !== 2 || rec.kind !== "choose") return null;
    const value = rec.value;
    if (typeof value !== "number" || !Number.isInteger(value)) return null;
    if (value < CIZGI_MIN || value > CIZGI_MAX) return null;
    return { kind: "choose", value };
  },

  setup(players: readonly string[], ctx: GameContext): CizgiState {
    const rounds: CizgiRoundState[] = [];
    let at = ctx.now;
    const noRadar = players.length < CIZGI_RADAR_MIN_PLAYERS;
    for (let r = 0; r < CIZGI_ROUNDS; r++) {
      const reveal = revealLength(r);
      rounds.push({
        startAt: at,
        endsAt: at + CIZGI_CHOOSE_MS,
        revealEndsAt: at + CIZGI_CHOOSE_MS + reveal,
        choices: {},
        locked: [],
        radar: null,
        radarOff: noRadar,
      });
      at += CIZGI_CHOOSE_MS + reveal;
    }
    return { players: [...players], startedAt: ctx.now, rounds, revealed: 0, shown: 0 };
  },

  reduce(prev, playerId, action, ctx): CizgiState | Rejected {
    if (!prev.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < prev.startedAt) return { rejected: "not_started" };
    const state = catchUp(prev, ctx.now);
    const index = currentRound(state, ctx.now);
    const round = state.rounds[index];
    if (!round || ctx.now >= gameEndsAt(state)) return { rejected: "ended" };
    // Açılış sırasında (seçim süresi bitti, sonraki tur başlamadı) seçim alınmaz.
    if (ctx.now >= round.endsAt || ctx.now < round.startAt) return { rejected: "ended" };
    if (round.locked.includes(playerId)) return { rejected: "locked" };
    const put = (next: CizgiRoundState, shift = 0): CizgiState => ({
      ...state,
      rounds: state.rounds.map((r, i) =>
        i === index
          ? next
          : i > index && shift !== 0
            ? {
                ...r,
                startAt: r.startAt + shift,
                endsAt: r.endsAt + shift,
                revealEndsAt: r.revealEndsAt + shift,
              }
            : r,
      ),
    });
    if (action.kind === "lock") {
      if (round.choices[playerId] === undefined) return { rejected: "nothing_to_lock" };
      const locked = [...round.locked, playerId];
      const waiting = state.players.some((id) => ctx.connected.includes(id) && !locked.includes(id));
      if (waiting) return put({ ...round, locked });
      // Bağlı herkes kilitledi: seçim 1 sn sonra biter, sonraki tur öne çekilir. Radar henüz çıkmadıysa bu tur çıkmaz.
      const endsAt = Math.min(round.endsAt, ctx.now + CIZGI_LOCK_GRACE_MS);
      const revealEndsAt = endsAt + revealLength(index);
      const next: CizgiRoundState = {
        ...round,
        locked,
        endsAt,
        revealEndsAt,
        radarOff: round.radarOff || round.radar === null,
      };
      return put(next, revealEndsAt - round.revealEndsAt);
    }
    if (action.value < CIZGI_MIN || action.value > CIZGI_MAX) return { rejected: "out_of_range" };
    if (round.choices[playerId] === action.value) return state;
    return put({ ...round, choices: { ...round.choices, [playerId]: action.value } });
  },

  tick(prev, ctx): CizgiState {
    const state = catchUp(prev, ctx.now);
    let revealed = state.revealed;
    while (
      revealed < state.rounds.length &&
      ctx.now >= (state.rounds[revealed]?.endsAt ?? Number.POSITIVE_INFINITY)
    ) {
      revealed++;
    }
    const shown = currentRound(state, ctx.now);
    if (state === prev && revealed === state.revealed && shown === state.shown) return state;
    return { ...state, revealed, shown };
  },

  nextWake(state, ctx): number | null {
    let best: number | null = null;
    for (const r of state.rounds) {
      const radar = r.radarOff || r.radar !== null ? null : r.startAt + CIZGI_RADAR_MS;
      for (const at of [r.startAt, radar, r.endsAt, r.revealEndsAt]) {
        if (at !== null && at > ctx.now && (best === null || at < best)) best = at;
      }
    }
    return best;
  },

  publicView(raw, ctx): CizgiPublicView {
    const state = catchUp(raw, ctx.now);
    const index = currentRound(state, ctx.now);
    const round = state.rounds[index] ?? state.rounds[0];
    if (!round) throw new Error("çizgiyi geçme: tur yok");
    const open = ctx.now >= round.endsAt;
    const history: CizgiReveal[] = [];
    for (let r = 0; r < index; r++) history.push(cizgiSettle(state, r));
    const totals = totalsOf(state, open ? index + 1 : index);
    const radarAt = state.players.length < CIZGI_RADAR_MIN_PLAYERS ? null : round.startAt + CIZGI_RADAR_MS;
    return {
      startedAt: state.startedAt,
      roundStartedAt: round.startAt,
      zoneWidth: cizgiZoneWidth(state.players.length),
      endsAt: round.endsAt,
      revealEndsAt: round.revealEndsAt,
      round: index + 1,
      rounds: state.rounds.length,
      radarAt,
      radar: round.radar ? { at: round.radar.at, zones: [...round.radar.zones] } : null,
      history,
      totals,
      // Tur süresi dolmadan kimsenin seçimi ya da durumu yoktur.
      reveal: open ? cizgiSettle(state, index) : null,
      final: open && index === state.rounds.length - 1 ? cizgiAwards(totals) : null,
      lockedIds: [...round.locked],
    };
  },

  view(raw, playerId, ctx): CizgiView {
    const round = raw.rounds[currentRound(raw, ctx.now)];
    const mine = playerId === null ? undefined : round?.choices[playerId];
    return {
      myChoice: mine ?? null,
      locked: playerId !== null && (round?.locked.includes(playerId) ?? false),
    };
  },

  /** Son açılış son turun seçim süresinin bittiği an başlar. */
  revealAt(state): number | null {
    return state.rounds[state.rounds.length - 1]?.endsAt ?? null;
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= gameEndsAt(state);
  },

  /**
   * Gizli değerler 0–100 arası kısa sayılardır; alt dizgi sızıntı denetimi onları koruyamaz
   * (en az 3 karakter şartı). Gizlilik yapısal olarak sağlanır ve ayrıca test edilir
   * (cizgiyi-gecme.test.ts, "gizlilik"): radar yalnız yanan platform numaralarını taşır.
   */
  secrets() {
    return [];
  },

  result(state) {
    const totals = totalsOf(state, state.rounds.length);
    return { miniScores: { ...totals }, awards: cizgiAwards(totals) };
  },
};
