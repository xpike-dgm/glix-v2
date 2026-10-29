// `ui-check.mjs --degisen` yardımcısı: değişen dosyaları ekran-adı süzgeçlerine çevirir.
// Süzgeç biçimi: "ad" -> ad ya da "ad-..." ile başlayan ekranlar; "=ad" -> yalnız tam bu ad.
import { execFileSync } from "node:child_process";

/**
 * Tek tablo: oyun kimliği (klasör adı) -> ekran önekleri, dev önizleme dosyası ve duman denetimi için
 * oyunun ilk oynanış ekranı. Önekler `scripts/ui-check.mjs` içindeki SCREENS adlarından türetilmiştir
 * (ör. kara-borsa -> `kb-`, karalama-defteri -> `kd-`, bozuk-telefon -> `bt-`, rus-ruleti -> `rus-`).
 * Yeni oyun eklenince buraya da bir satır eklenir; eksik kalırsa oyun klasörü "bilinmeyen" sayılıp duman
 * kümesine düşer (güvenli taraf).
 */
export const GAMES = {
  "acgozluluk-limiti": { prefixes: ["acgozluluk"], mock: "mockAcgozluluk", smoke: "acgozluluk-choosing-5" },
  "asiri-yukleme": { prefixes: ["asiri"], mock: "mockAsiri", smoke: "asiri-playing" },
  "bozuk-telefon": { prefixes: ["bt"], mock: "mockBozuk", smoke: "bt-write" },
  "butona-bas": { prefixes: ["playing", "spectator-playing", "countdown"], mock: null, smoke: "playing" },
  "cagrisim-agi": { prefixes: ["cagrisim"], mock: "mockCagrisim", smoke: "cagrisim-answer" },
  "capraz-ates": { prefixes: ["capraz"], mock: "mockCapraz", smoke: "capraz-pick" },
  "cizgiyi-gecme": { prefixes: ["cizgi"], mock: "mockCizgi", smoke: "cizgi-choosing-5" },
  "gizli-alisveris": { prefixes: ["alisveris"], mock: "mockAlisveris", smoke: "alisveris-shop-3" },
  "gizli-hirsiz": { prefixes: ["gizli"], mock: "mockGizliHirsiz", smoke: "gizli-idle" },
  "gizli-kareler": { prefixes: ["kareler"], mock: "mockKareler", smoke: "kareler-choosing-3" },
  ittifak: { prefixes: ["ittifak"], mock: "mockIttifak", smoke: "ittifak-talk-5" },
  "kara-borsa": { prefixes: ["kb"], mock: "mockBorsa", smoke: "kb-bid-5" },
  "karalama-defteri": { prefixes: ["kd"], mock: "mockKaralama", smoke: "kd-draw" },
  kendim: { prefixes: ["kendim"], mock: "mockKendim", smoke: "kendim-write" },
  "kontrol-paneli-kaosu": { prefixes: ["kontrol"], mock: "mockKontrol", smoke: "kontrol-play-4" },
  "kor-bomba": { prefixes: ["kor-bomba"], mock: "mockKorBomba", smoke: "kor-bomba-holder" },
  "kor-kronometre": { prefixes: ["kronometre"], mock: "mockKronometre", smoke: "kronometre-counting" },
  "kule-ustasi": { prefixes: ["kule"], mock: "mockKule", smoke: "kule-turn" },
  "laf-sokma": { prefixes: ["laf"], mock: "mockLaf", smoke: "laf-write-5" },
  "ortak-nokta": { prefixes: ["ortak-nokta"], mock: "mockTaslak", smoke: "ortak-nokta-choosing-5" },
  "ortalamanin-yarisi": { prefixes: ["ortalama"], mock: "mockOrtalama", smoke: "ortalama-choosing-3" },
  "sessiz-sira": { prefixes: ["sessiz-sira"], mock: "mockTaslak", smoke: "sessiz-sira-play-5" },
  "tek-ve-kucuk": { prefixes: ["tek-ve-kucuk"], mock: "mockTaslak", smoke: "tek-ve-kucuk-choosing-5" },
  "rus-ruleti": { prefixes: ["rus"], mock: "mockRusRuleti", smoke: "rus-hold-5" },
  "rusvet-darbe": { prefixes: ["rusvet"], mock: "mockRusvet", smoke: "rusvet-vote-5" },
  sizma: { prefixes: ["sizma"], mock: "mockSizma", smoke: "sizma-clue-3" },
  "son-kisi": { prefixes: ["sonkisi"], mock: "mockSonKisi", smoke: "sonkisi-idle" },
  "sozluk-blofu": { prefixes: ["sozluk"], mock: "mockSozluk", smoke: "sozluk-write-5" },
  "yatay-masa": { prefixes: ["landscape"], mock: "mockShell", smoke: "landscape" },
  "yazi-yaz": { prefixes: ["yazi"], mock: "mockYazi", smoke: "yazi-write-innocent" },
  "zaman-bombasi-hafizasi": { prefixes: ["zaman"], mock: "mockZamanBombasi", smoke: "zaman-playback" },
  "zehirli-kadeh": { prefixes: ["zehirli"], mock: "mockZehirli", smoke: "zehirli-play-5" },
};

/** `apps/client/src/screens/<Ad>.tsx` -> ekran süzgeçleri. */
const SCREEN_FILES = {
  Lobby: ["lobby", "bildir", "kart-lobi"],
  lobbyHints: ["lobby"],
  Briefing: ["briefing", "kart-anlatim"],
  Home: ["home"],
  Settings: ["ayarlar"],
  Join: ["join"],
  NotFound: ["notfound"],
  Reconnecting: ["reconnect"],
  Cards: ["kart"],
  Countdown: ["countdown", "kart-geri-sayim"],
  Playing: ["playing", "spectator-playing"],
  Results: ["results", "bildir", "kart-sonuc"],
  Final: ["final", "bildir"],
  CountUp: ["results", "final"],
  ranking: ["results", "final"],
  NicknameSheet: ["home-nickname"],
  Friends: ["arkadas"],
  FriendInviteSheet: ["arkadas-davet"],
  InviteCard: ["arkadas-davet-karti"],
};

/** Ortak dosyalar değişince bakılan küçük, geniş kapsamlı küme (tam ad eşleşmesi). */
export const SMOKE_BASE = [
  "=home",
  "=lobby-solo",
  "=lobby-8",
  "=briefing",
  "=countdown",
  "=ayarlar",
  "=update-required",
  "=results-5",
  "=final-8",
];
export const SMOKE = [...SMOKE_BASE, ...Object.values(GAMES).map((g) => `=${g.smoke}`)];

const MOCK_FILES = Object.fromEntries(
  Object.values(GAMES)
    .filter((g) => g.mock)
    .map((g) => [g.mock, g]),
);

/** Süzgeç bir ekran adına uyar mı? */
export function matchScreen(name, filter) {
  if (filter.startsWith("=")) return name === filter.slice(1);
  return name === filter || name.startsWith(`${filter}-`);
}

const smoke = (why) => ({ filters: SMOKE, why, smoke: true });
const none = (why) => ({ filters: [], why });

/** Bir dosya yolu (depo köküne göre) için { filters, why }. */
export function mapFile(path) {
  const p = path.replace(/\\/g, "/");
  const base = p.split("/").pop() ?? p;

  if (/\.test\.[cm]?[jt]sx?$/.test(base)) return none("test dosyası, arayüzü etkilemez");
  if (p.startsWith("docs/") || /\.md$/i.test(p)) return none("yalnız belge");
  if (/(^|\/)public\/assets\//.test(p)) return smoke("görsel varlık (public/assets)");
  if (/(^|\/)public\//.test(p)) return none("görsel olmayan statik dosya");
  if (p.startsWith("apps/server/") || p.startsWith("deploy/") || p.startsWith(".github/"))
    return none("sunucu/dağıtım, arayüz dışı");
  if (/^scripts\/ui-check/.test(p)) return smoke("denetim betiğinin kendisi");
  if (p.startsWith("scripts/")) return none("başka betik, ekranları etkilemez");

  let m = p.match(/^(?:apps\/client|packages\/engine)\/src\/games\/([^/]+)\/(.+)$/);
  if (m) {
    const g = GAMES[m[1]];
    return g ? { filters: g.prefixes, why: `oyun ${m[1]}` } : smoke(`bilinmeyen oyun klasörü ${m[1]}`);
  }
  if (/^packages\/engine\/src\/games\//.test(p)) return smoke("ortak oyun kodu (motor)");

  m = p.match(/^apps\/client\/src\/dev\/([^/]+)\.ts$/);
  if (m) {
    const g = MOCK_FILES[m[1]];
    if (g) return { filters: g.prefixes, why: `önizleme ${m[1]}` };
    if (m[1] === "mockHazirlaniyor") return { filters: ["hazirlaniyor"], why: "önizleme hazırlanıyor" };
    return smoke(`ortak önizleme ${m[1]}`);
  }

  m = p.match(/^apps\/client\/src\/screens\/([^/]+)\.tsx?$/);
  if (m) {
    const f = SCREEN_FILES[m[1]];
    return f ? { filters: f, why: `ekran ${m[1]}` } : smoke(`bilinmeyen ekran dosyası ${m[1]}`);
  }

  if (
    p === "apps/client/src/styles/report.css" ||
    /\/ui\/ReportSheet\.tsx$/.test(p) ||
    /\/net\/report[A-Za-z]*\.ts$/.test(p)
  )
    return { filters: ["bildir"], why: "bildir penceresi" };
  if (p === "apps/client/src/styles/settings.css") return { filters: ["ayarlar"], why: "ayarlar biçemi" };
  if (
    p === "apps/client/src/styles/cards.css" ||
    /\/ui\/(Card[A-Za-z]*|HandTray|cards)\.tsx?$/.test(p) ||
    /\/stage\/TvCards\.tsx$/.test(p) ||
    /\/dev\/mockKartlar\.ts$/.test(p)
  )
    return { filters: ["kart"], why: "kart sistemi" };
  if (/^apps\/client\/src\/(styles|ui|fx|net)\//.test(p)) return smoke("ortak arayüz (styles/ui/fx/net)");
  if (p === "apps/client/src/App.tsx") return smoke("App.tsx");
  return smoke("bilinmeyen dosya");
}

/** Değişen dosyaları bul: base...HEAD + çalışma ağacı (izlenen değişiklikler ve yeni dosyalar). */
export function changedFiles(root, base) {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const lines = (out) => out.split("\n").filter(Boolean);
  const ok = (ref) => {
    try {
      git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`);
      return true;
    } catch {
      return false;
    }
  };
  let ref = base;
  if (!ref) ref = ok("origin/main") ? "origin/main" : "main";
  if (!ok(ref)) throw new Error(`taban dal bulunamadı: ${ref}`);
  const set = new Set([
    ...lines(git("diff", "--name-only", `${ref}...HEAD`)),
    ...lines(git("diff", "--name-only", "HEAD")),
    ...lines(git("ls-files", "--others", "--exclude-standard")),
  ]);
  return { base: ref, files: [...set].sort() };
}

/** Süzgeç kümesini ve dosya başına gerekçeyi hesapla. */
export function planChanged(root, baseArg, screenNames) {
  const { base, files } = changedFiles(root, baseArg);
  const entries = files.map((file) => ({ file, ...mapFile(file) }));
  const filters = [...new Set(entries.flatMap((e) => e.filters))];
  const missing = filters.filter((f) => !screenNames.some((n) => matchScreen(n, f)));
  return { base, files, entries, filters, missing };
}
