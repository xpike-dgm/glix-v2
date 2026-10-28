import { GAMES } from "@glix/engine";
import type { AccountStore, BadgeStats } from "./accountStore.js";

/** Rozetin değerlendirildiği maçın bağlamı (maç satırı yazıldıktan sonra). */
export interface MatchContext {
  endedAt: number;
  /** Maçtaki sıralanan oyuncu sayısı. */
  players: number;
  place: number;
  won: boolean;
}

export interface BadgeDef {
  /** Kalıcı kimlik (veritabanına yazılır); asla yeniden adlandırılmaz. */
  id: string;
  name: string;
  description: string;
  /** Gizli rozet: kazanılana kadar adı ve açıklaması gösterilmez. */
  secret: boolean;
  /** Rozet ilk kazanıldığında verilen Glix (günlük maç sınırına sayılmaz): kademeye göre 25 / 50 / 100. */
  glix: number;
  /** `stats` maç satırı yazıldıktan sonraki toplamlardır; rozet kazanıldıysa true. */
  check(stats: BadgeStats, ctx: MatchContext, pool: readonly string[]): boolean;
}

/** Türkiye 2016'dan beri yıl boyu UTC+3 kullanır (yaz saati yok); sabit kaydırma yeterlidir. */
export const ISTANBUL_OFFSET_MS = 3 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** İstanbul saatiyle günün saati (0-23). */
export function istanbulHour(ms: number): number {
  return Math.floor(((((ms + ISTANBUL_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS) / 3600_000);
}

/** İstanbul takvim gününün 00:00'ı (UTC ms). Günlük Glix sınırı bu güne göre sayılır. */
export function istanbulDayStart(ms: number): number {
  const local = ms + ISTANBUL_OFFSET_MS;
  return Math.floor(local / DAY_MS) * DAY_MS - ISTANBUL_OFFSET_MS;
}

/** İstanbul'da o haftanın pazartesi 00:00'ı (UTC ms). Hafta pazartesi başlar. */
export function istanbulWeekStart(ms: number): number {
  const local = ms + ISTANBUL_OFFSET_MS;
  const day = Math.floor(local / DAY_MS);
  // 1970-01-01 perşembe: pazartesiden bu yana geçen gün = (gün + 3) mod 7.
  const sinceMonday = (((day + 3) % 7) + 7) % 7;
  return (day - sinceMonday) * DAY_MS - ISTANBUL_OFFSET_MS;
}

/** Rastgele havuzdaki oyunların kimlikleri ("Hepsi bir arada" için). */
export function randomPoolIds(): string[] {
  return Object.values(GAMES)
    .filter((g) => g.randomPool !== false)
    .map((g) => g.id);
}

const atLeast =
  (field: "matches" | "wins", n: number): BadgeDef["check"] =>
  (stats) =>
    stats[field] >= n;

export const BADGES: readonly BadgeDef[] = [
  {
    id: "ilk-mac",
    name: "İlk Adım",
    description: "İlk maçını bitir.",
    secret: false,
    glix: 25,
    check: atLeast("matches", 1),
  },
  {
    id: "on-mac",
    name: "Alışıyorum",
    description: "10 maç oyna.",
    secret: false,
    glix: 50,
    check: atLeast("matches", 10),
  },
  {
    id: "elli-mac",
    name: "Müdavim",
    description: "50 maç oyna.",
    secret: false,
    glix: 100,
    check: atLeast("matches", 50),
  },
  {
    id: "yuz-mac",
    name: "Efsane Oyuncu",
    description: "100 maç oyna.",
    secret: false,
    glix: 100,
    check: atLeast("matches", 100),
  },
  {
    id: "ilk-galibiyet",
    name: "İlk Zafer",
    description: "Bir maçı birinci bitir.",
    secret: false,
    glix: 25,
    check: atLeast("wins", 1),
  },
  {
    id: "on-galibiyet",
    name: "Kazanmayı Biliyor",
    description: "10 maç kazan.",
    secret: false,
    glix: 50,
    check: atLeast("wins", 10),
  },
  {
    id: "yirmibes-galibiyet",
    name: "Şampiyon",
    description: "25 maç kazan.",
    secret: false,
    glix: 100,
    check: atLeast("wins", 25),
  },
  {
    id: "cok-yonlu",
    name: "Çok Yönlü",
    description: "10 farklı oyunda birinci ol.",
    secret: false,
    glix: 50,
    check: (stats) => stats.winGames >= 10,
  },
  {
    id: "kalabalik-sampiyonu",
    name: "Kalabalığın Şampiyonu",
    description: "8 kişilik bir maçı kazan.",
    secret: false,
    glix: 50,
    check: (_stats, ctx) => ctx.won && ctx.players >= 8,
  },
  {
    id: "can-dost",
    name: "Can Dost",
    description: "Aynı arkadaşınla 10 maç oyna.",
    secret: false,
    glix: 50,
    check: (stats) => stats.friendCoplayMax >= 10,
  },
  {
    id: "seri",
    name: "Seri Galip",
    description: "Üst üste 3 maç kazan.",
    secret: false,
    glix: 50,
    check: (stats) => stats.lastWon.length >= 3 && stats.lastWon.slice(0, 3).every((w) => w),
  },
  {
    id: "kahin-on",
    name: "Büyük Kâhin",
    description: "Rus Ruleti'nde 10 farklı oyunda Kâhin ol.",
    secret: false,
    glix: 50,
    check: (stats) => stats.kahinGames >= 10,
  },
  {
    id: "kule-ustasi",
    name: "Kule Ustası",
    description: "Kule Ustası'nda tek oyunda 3 kusursuz bırakış yap.",
    secret: false,
    glix: 50,
    check: (stats) => stats.maxPerfects >= 3,
  },
  {
    id: "gece-kusu",
    name: "Gece Kuşu",
    description: "Gece 02:00 ile 05:00 arasında bir maç bitir.",
    secret: true,
    glix: 100,
    check: (_stats, ctx) => {
      const h = istanbulHour(ctx.endedAt);
      return h >= 2 && h < 5;
    },
  },
  {
    id: "hepsi-bir-arada",
    name: "Hepsi Bir Arada",
    description: "Rastgele havuzdaki her oyunu en az bir kez oyna.",
    secret: true,
    glix: 100,
    check: (stats, _ctx, pool) => pool.length > 0 && pool.every((id) => stats.playedGames.includes(id)),
  },
];

const BY_ID = new Map(BADGES.map((b) => [b.id, b]));

export function badgeById(id: string): BadgeDef | undefined {
  return BY_ID.get(id);
}

/** Kazanılmamış rozetlerden bu maçla kazanılanların kimlikleri (saf; depoya yazmaz). */
export function earnedNow(
  stats: BadgeStats,
  ctx: MatchContext,
  already: ReadonlySet<string>,
  pool: readonly string[] = randomPoolIds(),
): string[] {
  return BADGES.filter((b) => !already.has(b.id) && b.check(stats, ctx, pool)).map((b) => b.id);
}

/**
 * Maç satırı yazıldıktan sonra hesabın rozetlerini değerlendirir, yenilerini kaydeder ve kimliklerini döner.
 * Aynı rozet ikinci kez verilmez (kayıt tek satırlık birincil anahtara bağlıdır).
 */
export function awardAfterMatch(
  store: AccountStore,
  accountId: number,
  ctx: MatchContext,
  pool: readonly string[] = randomPoolIds(),
): string[] {
  const already = new Set(store.earnedBadges(accountId).map((b) => b.badgeId));
  const fresh = earnedNow(store.badgeStats(accountId), ctx, already, pool);
  return fresh.length === 0 ? [] : store.awardBadges(accountId, fresh, ctx.endedAt);
}

/** Profilde gösterilecek rozet listesi. Kazanılmamış gizli rozetin adı/açıklaması/kimliği sızmaz. */
export interface BadgeView {
  id: string;
  name: string;
  description: string;
  secret: boolean;
  earned: boolean;
  earnedAt: number | null;
}

/** Kendi profilin: tüm rozetler. Arkadaş profili (`onlyEarned`): yalnız kazanılanlar. */
export function badgeViews(
  earned: readonly { badgeId: string; earnedAt: number }[],
  onlyEarned: boolean,
): BadgeView[] {
  const at = new Map(earned.map((e) => [e.badgeId, e.earnedAt]));
  const out: BadgeView[] = [];
  let hidden = 0;
  for (const b of BADGES) {
    const when = at.get(b.id);
    if (when !== undefined) {
      out.push({
        id: b.id,
        name: b.name,
        description: b.description,
        secret: b.secret,
        earned: true,
        earnedAt: when,
      });
    } else if (!onlyEarned) {
      if (b.secret) {
        hidden += 1;
        out.push({
          id: `gizli-${hidden}`,
          name: "???",
          description: "Gizli rozet",
          secret: true,
          earned: false,
          earnedAt: null,
        });
      } else {
        out.push({
          id: b.id,
          name: b.name,
          description: b.description,
          secret: false,
          earned: false,
          earnedAt: null,
        });
      }
    }
  }
  return out;
}
