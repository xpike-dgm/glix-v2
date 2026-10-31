import { LAF_EMPTY_REVEAL_MS, LAF_FINAL_REVEAL_MS, LAF_REVEAL_MS, type LafCardResult } from "@glix/engine";

/**
 * Düello açılışının zaman çizelgesi (ms, açılış evresinin başından; sunucu saati). Tamamı açılış süresine (7 sn)
 * sığar; cevapsız düelloda kısa açılışa (2,5 sn) sığan kısmı oynar. Tek sabit: süreler yalnız buradan değişir.
 */
export const LAF_REVEAL_PLAN = {
  /** Kartlar dönerek yazarı açar (üst kart, alt kart). */
  flipAt: [250, 550] as const,
  /** Oy veren avatarlar bu andan sonra tek tek uçar. */
  votesAt: 1_200,
  /** Bir oyun uçuşu en çok bu kadar sürer; çok oyda aralık kısalır. */
  voteStepMs: 520,
  /** Oyların hepsi bu pencereye sığar. */
  votesSpanMs: 2_600,
  /** Son oydan sonra karar (kazanan spotu, Laf Ustası / Berabere). */
  verdictGapMs: 350,
  /** Kararın ardından damga ("LAF USTASI!" / "Berabere!"). */
  stampGapMs: 200,
  /** Damga ekranda bu kadar kalır. */
  stampMs: 1_500,
} as const;

/**
 * Final açılışının zaman çizelgesi: kartlar en az oydan en çoğa tek tek açılır, son kart "GECENİN EN KOMİĞİ"
 * tacıyla büyür. Tamamı final açılış süresine (12 sn) rahatça sığar.
 */
export const LAF_FINAL_PLAN = {
  /** İlk kartın açılışı. */
  firstAt: 700,
  /** İki kart arası en çok. */
  stepMs: 1_100,
  /** Bütün kartların açılışı bu pencereye sığar. */
  spanMs: 6_600,
  /** Son karttan sonra taç. */
  crownGapMs: 900,
} as const;

/** Bir düello açılışındaki oy uçuşu: hangi kartın hangi oyu, ne zaman. */
export interface VoteFlight {
  card: string;
  voter: string;
  /** Kartın kaçıncı oyu (1'den). */
  nth: number;
  at: number;
}

export interface DuelPlan {
  flights: VoteFlight[];
  verdictAt: number;
  stampAt: number;
  doneAt: number;
}

/**
 * Düello açılışı planı. Oylar katılım sırasıyla (iki kart karışık) uçar; bu sıra açılışta zaten herkese açık
 * olan bilgiden türetilir, gizli bir şey eklemez.
 */
export function duelPlan(cards: readonly LafCardResult[], order: readonly string[]): DuelPlan {
  const p = LAF_REVEAL_PLAN;
  const rank = (id: string): number => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  const all = cards.flatMap((c) => c.voters.map((voter, i) => ({ card: c.id, voter, nth: i + 1 })));
  all.sort((x, y) => rank(x.voter) - rank(y.voter));
  const step = all.length > 0 ? Math.min(p.voteStepMs, p.votesSpanMs / all.length) : 0;
  const flights = all.map((f, i) => ({ ...f, at: Math.round(p.votesAt + i * step) }));
  const empty = cards.every((c) => c.text === null);
  // Cevapsız düelloda kısa açılış: karar kartlar döndükten hemen sonra.
  const verdictAt = empty
    ? Math.min(LAF_EMPTY_REVEAL_MS - 600, (p.flipAt[1] ?? 0) + 600)
    : Math.round(p.votesAt + Math.max(1, all.length) * step + p.verdictGapMs);
  const stampAt = verdictAt + p.stampGapMs;
  return { flights, verdictAt, stampAt, doneAt: Math.min(LAF_REVEAL_MS, stampAt + p.stampMs) };
}

export interface FinalPlan {
  /** Açılış sırası (en az oydan en çoğa) ve her kartın açılış anı. */
  opens: { card: string; at: number }[];
  crownAt: number;
  /** Taç alan kart(lar): en çok oyu (en az 1) alanlar. */
  crowned: string[];
}

/** Final açılışı planı: en az oydan en çoğa; eşitte kart sırası (ekranda alttan üste doğru). */
export function finalPlan(cards: readonly LafCardResult[]): FinalPlan {
  const p = LAF_FINAL_PLAN;
  const order = cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.points - b.c.points || b.i - a.i)
    .map((x) => x.c.id);
  const step = order.length > 1 ? Math.min(p.stepMs, p.spanMs / order.length) : 0;
  const opens = order.map((card, i) => ({ card, at: Math.round(p.firstAt + i * step) }));
  const last = opens[opens.length - 1]?.at ?? p.firstAt;
  const top = Math.max(0, ...cards.map((c) => c.points));
  const crowned = top > 0 ? cards.filter((c) => c.points === top).map((c) => c.id) : [];
  return { opens, crownAt: Math.min(LAF_FINAL_REVEAL_MS - 2_000, last + p.crownGapMs), crowned };
}

export type DuelVerdict = "master" | "win" | "tie" | "none" | "empty";

/** Düellonun sonucu: Laf Ustası, tek kazanan, berabere, hiç oy yok ya da iki taraf da cevapsız. */
export function duelVerdict(cards: readonly LafCardResult[]): DuelVerdict {
  if (cards.every((c) => c.text === null)) return "empty";
  if (cards.some((c) => c.master)) return "master";
  const votes = cards.map((c) => c.voters.length);
  const top = Math.max(0, ...votes);
  if (top === 0) return "none";
  return votes.filter((v) => v === top).length > 1 ? "tie" : "win";
}
