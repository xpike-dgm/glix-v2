/**
 * Günlük görevler (saf kurallar). Her hesaba İstanbul günü başına 3 görev verilir (kolay, orta, zor birer tane);
 * seçim hesap kimliği + gün numarasından tohumlanır, yani herkes için tekrarlanabilir ve depolama gerektirmez.
 * İlerleme, sunucunun zaten kaydettiği maç/oyun/rozet satırlarından hesaplanır (`QuestFacts`); oyun kuralına dokunmaz.
 * Özellik sunucuda `gunlukGorevler` ayarıyla açılır (varsayılan KAPALI). Ayrıntı: `docs/HESAP.md`.
 */
import { createRng } from "./rng.js";

/**
 * SAHİP ONAYI BEKLİYOR: görev ödülleri (Glix) yer tutucudur. Tek yer burasıdır; onaylanınca yalnız bu tablo değişir.
 * Ödül defterde `gorev` nedeniyle yazılır ve günlük maç sınırına (300) SAYILMAZ.
 */
export const QUEST_REWARD_BY_TIER = { kolay: 30, orta: 50, zor: 80 } as const;

export type QuestTier = keyof typeof QUEST_REWARD_BY_TIER;

/** Bugünün olgularından (QuestFacts) hangi sayaç ilerlemeyi verir. */
export type QuestSource = keyof QuestFacts;

/** Sunucunun İstanbul günü içinde kayıtlı satırlardan çıkardığı sayaçlar (hepsi tamsayı, >= 0). */
export interface QuestFacts {
  /** Biten maç sayısı. */
  matches: number;
  /** İlk 3'te biten maç sayısı. */
  top3Matches: number;
  /** Bir maçtaki en yüksek genel puan. */
  bestScore: number;
  /** Biten mini oyun sayısı. */
  gamesFinished: number;
  /** Farklı oyun sayısı. */
  distinctGames: number;
  /** Mini oyunda 1. olunan oyun sayısı. */
  gameWins: number;
  /** Arkadaşla oynanan maç var mı (0/1). */
  friendMatches: number;
  /** Kazanılan rozet sayısı. */
  badges: number;
  /** Gün içinde art arda ilk 3'e girilen en uzun maç dizisi. */
  top3Streak: number;
}

export const EMPTY_QUEST_FACTS: QuestFacts = {
  matches: 0,
  top3Matches: 0,
  bestScore: 0,
  gamesFinished: 0,
  distinctGames: 0,
  gameWins: 0,
  friendMatches: 0,
  badges: 0,
  top3Streak: 0,
};

export interface QuestDef {
  /** Kalıcı kimlik (veritabanına yazılır); asla yeniden adlandırılmaz. */
  id: string;
  text: string;
  tier: QuestTier;
  target: number;
  source: QuestSource;
}

export const QUEST_POOL: readonly QuestDef[] = [
  { id: "mac-3", text: "3 maç bitir", tier: "kolay", target: 3, source: "matches" },
  { id: "puan-10", text: "Bir maçta 10+ puan topla", tier: "kolay", target: 10, source: "bestScore" },
  { id: "oyun-5", text: "5 mini oyun bitir", tier: "kolay", target: 5, source: "gamesFinished" },
  { id: "ilk3", text: "Bir maçta ilk 3'e gir", tier: "orta", target: 1, source: "top3Matches" },
  { id: "arkadas", text: "Bir arkadaşınla maç oyna", tier: "orta", target: 1, source: "friendMatches" },
  { id: "farkli-3", text: "3 farklı oyun oyna", tier: "orta", target: 3, source: "distinctGames" },
  { id: "birinci", text: "Bir oyunda 1. ol", tier: "zor", target: 1, source: "gameWins" },
  { id: "farkli-5", text: "5 farklı oyun oyna", tier: "zor", target: 5, source: "distinctGames" },
  { id: "rozet", text: "Bir rozet kazan", tier: "zor", target: 1, source: "badges" },
  { id: "ust-uste", text: "Art arda 2 maçta ilk 3'e gir", tier: "zor", target: 2, source: "top3Streak" },
];

const TIERS: readonly QuestTier[] = ["kolay", "orta", "zor"];

export function questReward(def: QuestDef): number {
  return QUEST_REWARD_BY_TIER[def.tier];
}

export function questById(id: string): QuestDef | undefined {
  return QUEST_POOL.find((q) => q.id === id);
}

/** `dayNumber`: İstanbul gün numarası (`istanbulDayNumber`). Aynı girdi her zaman aynı üç görevi verir. */
export function dailyQuests(accountId: number, dayNumber: number): QuestDef[] {
  const rng = createRng(
    Math.imul(accountId | 0, 0x9e3779b1) ^ Math.imul(dayNumber | 0, 0x85ebca6b) ^ 0x51ed27,
  );
  return TIERS.map((tier) => {
    const options = QUEST_POOL.filter((q) => q.tier === tier);
    return options[rng.int(options.length)] as QuestDef;
  });
}

/** Görevin ilerlemesi, hedefe kırpılmış. */
export function questProgress(def: QuestDef, facts: QuestFacts): number {
  return Math.max(0, Math.min(def.target, Math.floor(facts[def.source])));
}

export function questDone(def: QuestDef, facts: QuestFacts): boolean {
  return questProgress(def, facts) >= def.target;
}

/** Sıralı maç yerlerinden art arda ilk 3'e girilen en uzun dizi. */
export function top3Streak(placesInOrder: readonly number[]): number {
  let best = 0;
  let run = 0;
  for (const p of placesInOrder) {
    run = p <= 3 ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/** `GET /api/quests` gövdesindeki görev satırı. */
export interface QuestView {
  id: string;
  text: string;
  target: number;
  progress: number;
  reward: number;
  done: boolean;
}

/** `questDone` WS mesajı: tamamlanan görevler ve yeni bakiye. */
export interface QuestCompleted {
  id: string;
  text: string;
  reward: number;
}
