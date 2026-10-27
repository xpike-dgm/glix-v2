/**
 * Final unvanları: maç boyunca herkese açık sonuçlardan (tur başına `awards`) kurala bağlı, deterministik üretilir.
 * Rastgelelik ve gizli bilgi yoktur; aynı geçmiş her zaman aynı unvanları verir.
 *
 * Kurallar (sırayla; bir oyuncu en çok bir unvan alır, böylece unvanlar dağılır; en çok 5 unvan):
 *  1. "En çok kazanan": en çok turda o turun en yüksek puanını (en az +1) alan. Eşitlikte yoksa tek lider gerekir.
 *  2. "Son dakika ustası": son turda en yüksek puanı (en az +1) alan; ilk kural onu almışsa atlanır.
 *  3. "Blöf kralı": blöf/ikna oyunlarında (BLUFF_GAMES) toplam en çok puan toplayan (en az +2).
 *  4. "Hep puanlı": her turda puan alan (en az 3 tur) ve hiç eksiye düşmeyen.
 *  5. "Kaderin kurbanı": toplamda en çok puan kaybeden (en az −1).
 * Bir kuralda eşitlik varsa eşit olanların hepsi adaydır; aralarından oda sırasıyla ilk unvansız olan alır.
 */
export interface RoundRecord {
  round: number;
  gameId: string;
  /** Turda genel skora eklenen puanlar. */
  awards: Record<string, number>;
}

export interface Title {
  playerId: string;
  /** Ekranda görünen unvan (Türkçe). */
  label: string;
}

/** Blöf ve ikna oyunları ("Blöf kralı" için). */
export const BLUFF_GAMES: readonly string[] = [
  "sozluk-blofu",
  "sizma",
  "yazi-yaz",
  "ittifak",
  "rusvet-darbe",
];

export const MAX_TITLES = 5;

/** Her oyuncuya ilk kuralı sağlayan unvan verilir. `playerIds` oda sırasıdır (eşitlik çözümü için). */
export function deriveTitles(rounds: readonly RoundRecord[], playerIds: readonly string[]): Title[] {
  if (rounds.length === 0 || playerIds.length < 2) return [];
  const sorted = [...rounds].sort((a, b) => a.round - b.round);
  const award = (r: RoundRecord, id: string): number => r.awards[id] ?? 0;

  const wins: Record<string, number> = {};
  for (const r of sorted) {
    const top = Math.max(...playerIds.map((id) => award(r, id)));
    if (top < 1) continue;
    for (const id of playerIds) if (award(r, id) === top) wins[id] = (wins[id] ?? 0) + 1;
  }
  const last = sorted[sorted.length - 1];
  const lastTop = last ? Math.max(...playerIds.map((id) => award(last, id))) : 0;
  const lastWinners = last && lastTop >= 1 ? playerIds.filter((id) => award(last, id) === lastTop) : [];
  const bluff: Record<string, number> = {};
  for (const r of sorted) {
    if (!BLUFF_GAMES.includes(r.gameId)) continue;
    for (const id of playerIds) bluff[id] = (bluff[id] ?? 0) + award(r, id);
  }
  const steady = playerIds.filter(
    (id) => sorted.length >= 3 && sorted.every((r) => award(r, id) > 0 && r.awards[id] !== undefined),
  );
  const total: Record<string, number> = {};
  for (const id of playerIds) total[id] = sorted.reduce((n, r) => n + award(r, id), 0);

  const best = (scores: Record<string, number>, min: number, dir: 1 | -1 = 1): string[] => {
    const vals = playerIds.map((id) => (scores[id] ?? 0) * dir);
    const top = Math.max(...vals);
    if (top < min) return [];
    return playerIds.filter((id) => (scores[id] ?? 0) * dir === top);
  };

  const rules: { label: string; candidates: string[] }[] = [
    { label: "En çok kazanan", candidates: best(wins, 1) },
    { label: "Son dakika ustası", candidates: lastWinners },
    { label: "Blöf kralı", candidates: best(bluff, 2) },
    { label: "Hep puanlı", candidates: steady },
    { label: "Kaderin kurbanı", candidates: best(total, 1, -1) },
  ];
  const out: Title[] = [];
  for (const rule of rules) {
    if (out.length >= MAX_TITLES) break;
    const pick = rule.candidates.find((id) => !out.some((t) => t.playerId === id));
    if (pick !== undefined) out.push({ playerId: pick, label: rule.label });
  }
  return out;
}
