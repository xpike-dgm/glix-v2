/**
 * Glix kazanç kuralları (saf). Sunucu (gerçek ödeme) ve istemci (misafire "hesap açsaydın N Glix kazanırdın")
 * aynı sayıları kullanır. Sahip kararları: `docs/YOL-HARITASI.md` U18, ayrıntı `docs/HESAP.md`.
 */

/** Tamamlanan her maç için. */
export const GLIX_MATCH = 10;
/** Sıralama eki: 1. +15, 2. +10, 3. +5; 4. ve sonrası yok. */
export const GLIX_PLACE_BONUS: Readonly<Record<number, number>> = { 1: 15, 2: 10, 3: 5 };
/** Maçlardan günlük (İstanbul günü) üst sınır; rozet ödülü sınır dışıdır. */
export const GLIX_DAILY_MATCH_CAP = 300;

export type GlixPartKind = "mac" | "sira" | "gununIlki" | "rozet";

export interface GlixPart {
  kind: GlixPartKind;
  amount: number;
  /** Yalnız `rozet` parçasında. */
  badgeId?: string;
}

/** Sıraya göre ek (eşit puanda paylaşılan sıra geçerlidir). */
export function placeBonus(place: number): number {
  return GLIX_PLACE_BONUS[place] ?? 0;
}

/** Tamamlama + sıralama eki; ikiye katlama ve sınır yok (misafir önizlemesi bunu kullanır). */
export function matchBase(place: number): number {
  return GLIX_MATCH + placeBonus(place);
}

export interface MatchAwardInput {
  place: number;
  /** Bu İstanbul gününde maçlardan zaten kazanılan Glix. */
  earnedToday: number;
  /** Bu, günün ilk sayılan maçı mı. */
  firstToday: boolean;
}

export interface MatchAward {
  parts: GlixPart[];
  total: number;
  /** Günlük sınır yüzünden bir kısım (ya da hepsi) ödenmedi. */
  capped: boolean;
}

/**
 * Maç ödülü: tamamlama, sıralama eki, günün ilk maçında ikiye katlama (`gununIlki` = ikinci kopya tutarı).
 * Toplam günlük sınırı aşarsa parçalar sırayla (mac, sira, gununIlki) kırpılır.
 */
export function matchAward(input: MatchAwardInput): MatchAward {
  const bonus = placeBonus(input.place);
  const wanted: GlixPart[] = [{ kind: "mac", amount: GLIX_MATCH }];
  if (bonus > 0) wanted.push({ kind: "sira", amount: bonus });
  if (input.firstToday) wanted.push({ kind: "gununIlki", amount: GLIX_MATCH + bonus });
  let left = Math.max(0, GLIX_DAILY_MATCH_CAP - Math.max(0, input.earnedToday));
  const parts: GlixPart[] = [];
  let capped = false;
  for (const p of wanted) {
    const amount = Math.min(p.amount, left);
    if (amount < p.amount) capped = true;
    left -= amount;
    if (amount > 0) parts.push({ kind: p.kind, amount });
  }
  return { parts, total: parts.reduce((s, p) => s + p.amount, 0), capped };
}
