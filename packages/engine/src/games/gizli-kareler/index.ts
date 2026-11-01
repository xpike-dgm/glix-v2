import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  KARELER_BAND_MS,
  KARELER_BETWEEN_MS,
  KARELER_BONUS_POINTS,
  KARELER_FINAL_MS,
  KARELER_LOCK_GRACE_MS,
  KARELER_STAGE_MS,
  type KareBonus,
  type KareHint,
  type KarelerAction,
  type KarelerPublicView,
  type KarelerView,
  type KareReveal,
  type KareReveal2,
  type KareStatus,
  kareCells,
  kareHintsFor,
  kareSize,
} from "./types.js";

export * from "./types.js";

export interface KarelerState {
  players: string[];
  size: number;
  /**
   * Gizli ödül karesi (2. aşamada +2): kurulumda tohumlu rastgelelikle seçilir. Yalnız sunucu durumunda yaşar;
   * 2. aşamanın sonucu açılana kadar hiçbir görünümde yer almaz.
   */
  bonusCell: number;
  /**
   * Pusula dağıtımının tohumu (GK-M1): kurulumda çekilir; ödül karesine uyan ipuçları bununla karıştırılıp yarışanlara
   * sırayla verilir. Yalnız sunucu durumunda yaşar.
   */
  compassSeed: number;
  /**
   * Şu an bağlı katılımcılar (kurulumda ve her bağlantı değişiminde `onPresence` ile yazılır). Yalnız 1. aşama
   * kapanırken bağlı hayalet var mı sorusu için (GK-M2, rakipsiz bitiş) okunur.
   */
  online: string[];
  /**
   * 1. aşama kapandığı anda bağlı bir hayalet var mıydı: aşama kapanınca ilk tick / eylem / bağlantı değişiminde
   * dondurulur; o ana kadar `online`dan türetilir (ikisi aynı sonucu verir). Sonradan kopan ya da dönen değiştiremez.
   */
  ghostLive: boolean | null;
  startedAt: number;
  /** 1. aşamanın en geç seçim bitişi. */
  stage1EndsAt: number;
  /** Herkes kilitlediyse 1. aşamanın erken bitişi (reduce'ta yazılır). */
  end1At: number | null;
  /** 2. aşama için aynı. */
  end2At: number | null;
  /** "Tamam" diyenler (aşama başına). */
  locked1: string[];
  locked2: string[];
  /** Yalnız seçim gönderenler; son seçim geçerlidir. */
  choices1: Record<string, number>;
  /** 2. aşama seçimleri: yarışanlar (1. aşamada tek kalanlar) ve hayaletler (GK-M2). */
  choices2: Record<string, number>;
  /**
   * Son tick'te görülen aşama. Görünümler `ctx.now`'dan türetilir; bu alan yalnız sunucunun
   * "durum değişti" sinyalini almasını sağlar (aksi halde aşama geçişleri yayınlanmaz). Sonuca etkisi yoktur.
   */
  seen: KarelerPhase;
}

/** 0 = 1. aşama seçimi, 1 = 1. aşama sonucu, 2 = 2. aşama seçimi, 3 = son sonuç, 4 = bitti. */
export type KarelerPhase = 0 | 1 | 2 | 3 | 4;

/** Bir aşamanın puanlaması: tek kalan +1, çakışan elenir, seçmeyen pasif. */
export function kareSettle(
  participants: readonly string[],
  choices: Readonly<Record<string, number>>,
): KareReveal {
  const per = new Map<number, number>();
  for (const id of participants) {
    const c = choices[id];
    if (c !== undefined) per.set(c, (per.get(c) ?? 0) + 1);
  }
  const out: KareReveal = { choices: {}, status: {} };
  for (const id of participants) {
    const c = choices[id];
    out.choices[id] = c ?? null;
    const status: KareStatus = c === undefined ? "passive" : (per.get(c) ?? 0) === 1 ? "solo" : "clash";
    out.status[id] = status;
  }
  return out;
}

/**
 * 2. aşamanın puanlaması (GK-M2): yarışanlar kendi aralarında 1. aşama gibi; tek kalan yarışanın karesinde bir hayalet
 * varsa "hayalete çarptı" (`haunted`): puan ve ödül yok. Hayaletler arası aynı kare önemsizdir; hayalet puan almaz.
 */
export function kareSettle2(
  racers: readonly string[],
  ghosts: readonly string[],
  choices: Readonly<Record<string, number>>,
  compass: Readonly<Record<string, KareHint>> = {},
): KareReveal2 {
  const base = kareSettle(racers, choices);
  const haunted = new Set<number>();
  const ghostChoices: Record<string, number | null> = {};
  for (const id of ghosts) {
    const c = choices[id];
    ghostChoices[id] = c ?? null;
    if (c !== undefined) haunted.add(c);
  }
  const status: Record<string, KareStatus> = {};
  for (const id of racers) {
    const s = base.status[id] ?? "passive";
    const c = choices[id];
    status[id] = s === "solo" && c !== undefined && haunted.has(c) ? "haunted" : s;
  }
  return { choices: base.choices, status, ghosts: ghostChoices, compass: { ...compass } };
}

const soloIds = (r: KareReveal): string[] =>
  Object.entries(r.status)
    .filter(([, s]) => s === "solo")
    .map(([id]) => id);

/** Oyunun aşamalarının tümünün (1. aşama bittikten sonra) türetilmiş planı. */
interface Plan {
  stage1: KareReveal;
  survivors: string[];
  walkover: string | null;
  /** 2. aşamada hayalet olanlar (1. aşamada tek kalamayanlar). */
  ghosts: string[];
  stage2: { startsAt: number; endsAt: number; players: string[]; ghosts: string[] } | null;
  stage2Reveal: KareReveal2 | null;
  /** Yarışanların pusulaları (2. aşama oynanıyorsa). */
  compass: Record<string, KareHint>;
  /** Ödül karesinin sonucu (2. aşama oynandıysa); aşama sonucu açılana kadar görünümlere girmez. */
  bonus: KareBonus | null;
  finishesAt: number;
  points: Record<string, number>;
}

/**
 * Ödül karesinde tek başına kalan: yalnız 2. aşama seçimlerine bakılır; birden çok yarışan bastıysa ya da karede bir
 * hayalet varsa (GK-M2) kimse.
 */
export function kareBonusWinner(
  participants: readonly string[],
  choices: Readonly<Record<string, number>>,
  bonusCell: number,
  ghosts: readonly string[] = [],
): string | null {
  if (ghosts.some((id) => choices[id] === bonusCell)) return null;
  const on = participants.filter((id) => choices[id] === bonusCell);
  return on.length === 1 ? (on[0] ?? null) : null;
}

/** Pusulalar (GK-M1): ödül karesine uyan ipuçları tohumla karıştırılır, yarışanlara sırayla (gerekirse yeniden) verilir. */
export function kareCompass(
  racers: readonly string[],
  bonusCell: number,
  size: number,
  seed: number,
): Record<string, KareHint> {
  const pool = createRng(seed).shuffle(kareHintsFor(bonusCell, size));
  const out: Record<string, KareHint> = {};
  if (pool.length === 0) return out;
  racers.forEach((id, i) => {
    const h = pool[i % pool.length];
    if (h) out[id] = h;
  });
  return out;
}

/** 1. aşama kapanırken bağlı bir hayalet var mı (dondurulmuşsa o değer). */
function ghostLiveOf(state: KarelerState, ghosts: readonly string[]): boolean {
  return state.ghostLive ?? ghosts.some((id) => state.online.includes(id));
}

/** 1. aşama kapandıysa `ghostLive`ı dondurur (aynı nesne, değişiklik yoksa). */
function freeze(state: KarelerState, now: number): KarelerState {
  if (state.ghostLive !== null || now < stage1End(state)) return state;
  const stage1 = kareSettle(state.players, state.choices1);
  const ghosts = state.players.filter((id) => stage1.status[id] !== "solo");
  return { ...state, ghostLive: ghostLiveOf(state, ghosts) };
}

/** 1. aşamanın gerçek seçim bitişi. */
const stage1End = (state: KarelerState): number => state.end1At ?? state.stage1EndsAt;

function plan(state: KarelerState): Plan {
  const s1End = stage1End(state);
  const stage1 = kareSettle(state.players, state.choices1);
  const survivors = soloIds(stage1);
  const ghosts = state.players.filter((id) => stage1.status[id] !== "solo");
  const points: Record<string, number> = {};
  for (const id of state.players) points[id] = stage1.status[id] === "solo" ? 1 : 0;
  // Tek kişi kaldıysa ve bağlı bir hayalet varsa 2. aşama oynanır (GK-M2); yoksa rakipsiz +1.
  const plays = survivors.length >= 2 || (survivors.length === 1 && ghostLiveOf(state, ghosts));
  if (!plays) {
    // Kimse kalmadı: oyun biter. Tek kişi kaldıysa ikinci aşamada rakipsiz sayılır ve +1 alır.
    const walkover = survivors[0] ?? null;
    if (walkover !== null) points[walkover] = (points[walkover] ?? 0) + 1;
    return {
      stage1,
      survivors,
      ghosts,
      walkover,
      stage2: null,
      stage2Reveal: null,
      compass: {},
      bonus: null,
      finishesAt: s1End + KARELER_FINAL_MS,
      points,
    };
  }
  const startsAt = s1End + KARELER_BETWEEN_MS;
  const endsAt = state.end2At ?? startsAt + KARELER_STAGE_MS;
  const compass = kareCompass(survivors, state.bonusCell, state.size, state.compassSeed);
  const stage2Reveal = kareSettle2(survivors, ghosts, state.choices2, compass);
  for (const id of soloIds(stage2Reveal)) points[id] = (points[id] ?? 0) + 1;
  const winner = kareBonusWinner(survivors, state.choices2, state.bonusCell, ghosts);
  if (winner !== null) points[winner] = (points[winner] ?? 0) + KARELER_BONUS_POINTS;
  return {
    stage1,
    survivors,
    ghosts,
    walkover: null,
    stage2: { startsAt, endsAt, players: survivors, ghosts },
    stage2Reveal,
    compass,
    bonus: { cell: state.bonusCell, winner },
    finishesAt: endsAt + KARELER_FINAL_MS,
    points,
  };
}

export function karelerPhase(state: KarelerState, now: number): KarelerPhase {
  if (now < stage1End(state)) return 0;
  const p = plan(state);
  if (now >= p.finishesAt) return 4;
  if (!p.stage2) return 1;
  if (now < p.stage2.startsAt) return 1;
  if (now < p.stage2.endsAt) return 2;
  return 3;
}

export const gizliKareler: GameDefinition<KarelerState, KarelerAction, KarelerView, KarelerPublicView> = {
  id: "gizli-kareler",
  name: "Gizli Kareler",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Kimseyle çakışmayan karede tek başına kal!",
    steps: [
      "Gizlice bir kare seç (2–4 kişide 3×3, 5–8 kişide 4×4). Seçmezsen pasif kalırsın.",
      "Aynı kareyi seçenler elenir; tek kalanlar +1 alır ve 2. aşamaya geçer. Elenenler hayalet olur.",
      "2. aşamada tek kalan yine +1; gizli ödül karesi +2. Pusulan ödül karesini gösterir.",
    ],
  },

  parseAction(raw: unknown): KarelerAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (rec.kind === "lock") return Object.keys(rec).length === 1 ? { kind: "lock" } : null;
    if (Object.keys(rec).length !== 2 || rec.kind !== "pick") return null;
    const cell = rec.cell;
    if (typeof cell !== "number" || !Number.isInteger(cell) || cell < 0 || cell > 15) return null;
    return { kind: "pick", cell };
  },

  setup(players: readonly string[], ctx: GameContext): KarelerState {
    return {
      players: [...players],
      size: kareSize(players.length),
      bonusCell: ctx.rng.int(kareCells(kareSize(players.length))),
      compassSeed: ctx.rng.int(2 ** 31),
      online: players.filter((id) => ctx.connected.includes(id)),
      ghostLive: null,
      startedAt: ctx.now,
      stage1EndsAt: ctx.now + KARELER_STAGE_MS,
      end1At: null,
      end2At: null,
      locked1: [],
      locked2: [],
      choices1: {},
      choices2: {},
      seen: 0,
    };
  },

  reduce(prev, playerId, action, ctx): KarelerState | Rejected {
    if (!prev.players.includes(playerId)) return { rejected: "not_participant" };
    const state = freeze(prev, ctx.now);
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (action.kind === "pick" && action.cell >= kareCells(state.size)) return { rejected: "out_of_range" };
    const phase = karelerPhase(state, ctx.now);
    if (phase !== 0 && phase !== 2) return { rejected: phase === 4 ? "ended" : "closed" };
    const stage = phase === 0 ? 1 : 2;
    // 2. aşamada yarışanlar ve hayaletler (GK-M2) seçer.
    const crew2 = stage === 2 ? [...plan(state).survivors, ...plan(state).ghosts] : [];
    if (stage === 2 && !crew2.includes(playerId)) return { rejected: "eliminated" };
    const locked = stage === 1 ? state.locked1 : state.locked2;
    const choices = stage === 1 ? state.choices1 : state.choices2;
    if (locked.includes(playerId)) return { rejected: "locked" };
    // Herkes kilitlediyse aşama kapanmak üzeredir; geç gelen değişiklik kabul edilmez.
    if ((stage === 1 ? state.end1At : state.end2At) !== null) return { rejected: "closed" };
    if (action.kind === "pick") {
      if (choices[playerId] === action.cell) return state;
      return stage === 1
        ? { ...state, choices1: { ...state.choices1, [playerId]: action.cell } }
        : { ...state, choices2: { ...state.choices2, [playerId]: action.cell } };
    }
    if (choices[playerId] === undefined) return { rejected: "nothing_to_lock" };
    const nextLocked = [...locked, playerId];
    // 2. aşamada bağlı yarışanların ve bağlı hayaletlerin hepsi Tamam demeli.
    const participants = stage === 1 ? state.players : crew2;
    const active = participants.filter((id) => ctx.connected.includes(id));
    const all = active.length > 0 && active.every((id) => nextLocked.includes(id));
    const nominal =
      stage === 1 ? state.stage1EndsAt : stage1End(state) + KARELER_BETWEEN_MS + KARELER_STAGE_MS;
    const endAt = all ? Math.min(ctx.now + KARELER_LOCK_GRACE_MS, nominal) : null;
    if (stage === 1) {
      return { ...state, locked1: nextLocked, end1At: endAt };
    }
    return { ...state, locked2: nextLocked, end2At: endAt };
  },

  tick(prev, ctx): KarelerState {
    const state = freeze(prev, ctx.now);
    const phase = karelerPhase(state, ctx.now);
    return phase === state.seen ? state : { ...state, seen: phase };
  },

  /** Bağlı katılımcı listesi: yalnız 1. aşama kapanırken bağlı hayalet var mı sorusu için (önce dondurulur). */
  onPresence(prev, ctx): KarelerState {
    const state = freeze(prev, ctx.now);
    const online = state.players.filter((id) => ctx.connected.includes(id));
    const same = online.length === state.online.length && online.every((id, i) => state.online[i] === id);
    return same ? state : { ...state, online };
  },

  publicView(state, ctx): KarelerPublicView {
    const base = { size: state.size, startedAt: state.startedAt, endsAt: stage1End(state) };
    if (ctx.now < stage1End(state)) {
      return {
        ...base,
        ready: [...state.locked1],
        stage2: null,
        stage1: null,
        stage2Reveal: null,
        finishesAt: null,
        walkover: null,
        points: null,
        bonus: null,
      };
    }
    const p = plan(state);
    const stage2Open = p.stage2 !== null && ctx.now >= p.stage2.endsAt;
    // 2. aşama seçimleri aşama bitene kadar yok; puanlar yalnız açılmış sonuçları içerir.
    const points: Record<string, number> = {};
    for (const id of state.players) {
      let v = p.stage1.status[id] === "solo" ? 1 : 0;
      if (p.walkover === id) v += 1;
      if (stage2Open && p.stage2Reveal?.status[id] === "solo") v += 1;
      if (stage2Open && p.bonus?.winner === id) v += KARELER_BONUS_POINTS;
      points[id] = v;
    }
    return {
      ...base,
      stage2: p.stage2,
      stage1: p.stage1,
      stage2Reveal: stage2Open ? p.stage2Reveal : null,
      finishesAt: p.finishesAt,
      walkover: p.walkover,
      points,
      bonus: stage2Open ? p.bonus : null,
      ready: karelerPhase(state, ctx.now) === 2 ? [...state.locked2] : [],
    };
  },

  view(state, playerId, ctx): KarelerView {
    if (playerId === null) return { myChoice: null, locked: false, compass: null };
    const phase = karelerPhase(state, ctx.now);
    if (phase === 0) {
      return {
        myChoice: state.choices1[playerId] ?? null,
        locked: state.locked1.includes(playerId),
        compass: null,
      };
    }
    // Pusula yalnız yarışana ve yalnız "2. AŞAMA" bandından 2. aşamanın sonuna kadar (GK-U5).
    const p = plan(state);
    const bandAt = stage1End(state) + KARELER_BETWEEN_MS - KARELER_BAND_MS;
    const compass =
      p.stage2 !== null && ctx.now >= bandAt && ctx.now < p.stage2.endsAt
        ? (p.compass[playerId] ?? null)
        : null;
    if (phase === 2) {
      return {
        myChoice: state.choices2[playerId] ?? null,
        locked: state.locked2.includes(playerId),
        compass,
      };
    }
    return { myChoice: null, locked: false, compass };
  },

  /** Sonuç açılışı son aşamanın (ikinci aşama yoksa ilkinin) bitişiyle başlar. */
  revealAt(state, ctx): number | null {
    if (ctx.now < stage1End(state)) return null;
    const p = plan(state);
    return p.stage2 ? p.stage2.endsAt : stage1End(state);
  },

  isFinished(state, ctx): boolean {
    return karelerPhase(state, ctx.now) === 4;
  },

  /**
   * Gizli değerler 0–15 arası kısa hücre numaralarıdır; alt dizgi sızıntı denetimi onları koruyamaz
   * (en az 3 karakter şartı). Gizlilik yapısal olarak sağlanır ve ayrıca test edilir
   * (gizli-kareler.test.ts, "gizlilik").
   */
  secrets() {
    return [];
  },

  result(state) {
    const { points } = plan(state);
    return { miniScores: { ...points }, awards: { ...points } };
  },
};
