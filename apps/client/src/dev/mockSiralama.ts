/**
 * Yalnız geliştirme önizlemesi: arkadaş sıralaması, rozetli profil ve final'de "Yeni rozet!" kartı.
 * `?mock=siralama` (`&v=bos|yukleniyor|hata|sifir`, `&p=all`, `&m=score|matches`), `rozet-profil`
 * (`&v=arkadas|bos`), `rozet-final` (`&n=4`, `&k=2` iki rozet). Ekran açılmadan önce veri sabitlenir (ağdan okumasın).
 */

import { type BadgeInfo, parseBadges } from "../net/badgeRules.js";
import { showBadges } from "../net/badges.js";
import { freezeLeaderboard } from "../net/leaderboard.js";
import type { GameLeader, LeaderRow, Metric, Period } from "../net/leaderboardRules.js";
import { freezeProfile } from "../net/profile.js";
import { parseProfile } from "../net/profileRules.js";
import { setState } from "../net/store.js";
import { startMock } from "./mock.js";

const ACCOUNT = { username: "cihad_01", email: "cihad@example.com" };

function rows(v: string | null, metric: Metric): LeaderRow[] {
  if (v === "bos") return [{ username: "cihad_01", value: 0, rank: 1, you: true }];
  const zero = v === "sifir";
  const base: [string, number, number][] =
    metric === "wins"
      ? [
          ["mert_34", 7, 1],
          ["cihad_01", 5, 2],
          ["elif_k", 5, 2],
          ["zeynep", 2, 4],
          ["cok_uzun_kullanici_1", 1, 5],
          ["kaan_07", 0, 6],
        ]
      : metric === "score"
        ? [
            ["elif_k", 64, 1],
            ["mert_34", 58, 2],
            ["cihad_01", 31, 3],
            ["zeynep", -4, 4],
            ["cok_uzun_kullanici_1", -9, 5],
            ["kaan_07", -9, 5],
          ]
        : [
            ["mert_34", 21, 1],
            ["cihad_01", 14, 2],
            ["elif_k", 12, 3],
            ["zeynep", 12, 3],
            ["cok_uzun_kullanici_1", 3, 5],
            ["kaan_07", 1, 6],
          ];
  return base.map(([username, value, rank]) =>
    zero
      ? { username, value: 0, rank: 1, you: username === "cihad_01" }
      : { username, value, rank, you: username === "cihad_01" },
  );
}

const GAMES: GameLeader[] = [
  { gameId: "butona-bas", name: "Butona Bas", leader: { username: "mert_34", wins: 9 }, you: { wins: 4 } },
  { gameId: "kor-bomba", name: "Kör Bomba", leader: { username: "cihad_01", wins: 5 }, you: { wins: 5 } },
  {
    gameId: "cagrisim-agi",
    name: "Çağrışım Ağı",
    leader: { username: "cok_uzun_kullanici_1", wins: 3 },
    you: { wins: 0 },
  },
];

const ALL_BADGES = [
  { id: "ilk-mac", name: "İlk Adım", description: "İlk maçını bitir.", secret: false },
  { id: "on-mac", name: "Alışıyorum", description: "10 maç oyna.", secret: false },
  { id: "elli-mac", name: "Müdavim", description: "50 maç oyna.", secret: false },
  { id: "yuz-mac", name: "Efsane Oyuncu", description: "100 maç oyna.", secret: false },
  { id: "ilk-galibiyet", name: "İlk Zafer", description: "Bir maçı birinci bitir.", secret: false },
  { id: "on-galibiyet", name: "Kazanmayı Biliyor", description: "10 maç kazan.", secret: false },
  { id: "yirmibes-galibiyet", name: "Şampiyon", description: "25 maç kazan.", secret: false },
  { id: "cok-yonlu", name: "Çok Yönlü", description: "10 farklı oyunda birinci ol.", secret: false },
  {
    id: "kalabalik-sampiyonu",
    name: "Kalabalığın Şampiyonu",
    description: "8 kişilik bir maçı kazan.",
    secret: false,
  },
  { id: "can-dost", name: "Can Dost", description: "Aynı arkadaşınla 10 maç oyna.", secret: false },
  { id: "seri", name: "Seri Galip", description: "Üst üste 3 maç kazan.", secret: false },
  {
    id: "gece-kusu",
    name: "Gece Kuşu",
    description: "Gece 02:00 ile 05:00 arasında bir maç bitir.",
    secret: true,
  },
  {
    id: "hepsi-bir-arada",
    name: "Hepsi Bir Arada",
    description: "Rastgele havuzdaki her oyunu en az bir kez oyna.",
    secret: true,
  },
];
const EARNED = new Set(["ilk-mac", "on-mac", "ilk-galibiyet", "seri", "gece-kusu"]);

function badgeList(own: boolean, empty: boolean): BadgeInfo[] {
  let hidden = 0;
  const raw = ALL_BADGES.flatMap((b) => {
    const earned = !empty && EARNED.has(b.id);
    if (earned) return [{ ...b, earned: true }];
    if (!own) return [];
    if (b.secret) {
      hidden += 1;
      return [
        { id: `gizli-${hidden}`, name: "???", description: "Gizli rozet", secret: true, earned: false },
      ];
    }
    return [{ ...b, earned: false }];
  });
  return parseBadges(raw);
}

function profileWith(own: boolean, empty: boolean): NonNullable<ReturnType<typeof parseProfile>> {
  const day = 24 * 3600 * 1000;
  const now = Date.now();
  const raw = {
    ok: true,
    username: own ? "cihad_01" : "mert_34",
    createdAt: now - 40 * day,
    totals: empty
      ? { matches: 0, wins: 0, winRate: 0, games: 0, gameWins: 0 }
      : { matches: 12, wins: 5, winRate: 0.417, games: 28, gameWins: 9 },
    favoriteGame: empty ? null : { id: "butona-bas", name: "Butona Bas", plays: 14 },
    perGame: empty ? [] : [{ gameId: "butona-bas", name: "Butona Bas", plays: 14, wins: 6, bestMini: 9 }],
    recent: empty ? [] : [{ endedAt: now - 2 * 3600 * 1000, players: 5, place: 1, score: 11 }],
    coPlayers: empty ? [] : [{ username: "elif_k", matches: 9 }],
    badges: badgeList(own, empty),
  };
  const profile = parseProfile(raw);
  if (!profile) throw new Error("örnek profil geçersiz");
  return profile;
}

export function startSiralamaMock(kind: string, params: URLSearchParams): void {
  const v = params.get("v");
  if (kind === "siralama") {
    const period: Period = params.get("p") === "all" ? "all" : "week";
    const m = params.get("m");
    const metric: Metric = m === "score" || m === "matches" ? m : "wins";
    if (v === "yukleniyor") freezeLeaderboard({ rows: [], games: [], load: "loading" }, { period, metric });
    else if (v === "hata") freezeLeaderboard({ rows: [], games: [], load: "error" }, { period, metric });
    else
      freezeLeaderboard(
        { rows: rows(v, metric), games: v === "bos" || v === "sifir" ? [] : GAMES },
        { period, metric },
      );
    setState({ account: ACCOUNT, nav: "leaderboard", session: null });
    return;
  }
  if (kind === "rozet-profil") {
    freezeProfile({ kind: "ready", profile: profileWith(v !== "arkadas", v === "bos") });
    setState({ account: ACCOUNT, nav: "profile", session: null });
    return;
  }
  // rozet-final: yeni rozet kartı final'in üstünde.
  startMock("final", params);
  setState("account", ACCOUNT);
  const two = params.get("k") === "2";
  const fresh = badgeList(true, false).filter((b) =>
    (two ? ["on-mac", "gece-kusu"] : ["on-mac"]).includes(b.id),
  );
  showBadges(fresh);
}
