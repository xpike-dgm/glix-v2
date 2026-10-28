/**
 * Yalnız geliştirme önizlemesi: `?mock=lobby|briefing|countdown|playing|results|final` (ayrıca home, join,
 * notfound, reconnect). Sunucu olmadan sahte RoomSnapshot üretir. `&n=8` oyuncu sayısını değiştirir.
 * Üretim derlemesinde App.tsx'teki `import.meta.env.DEV` koruması nedeniyle pakete girmez.
 */
import type {
  ClientMessage,
  GameInfo,
  JoinPolicy,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
} from "@glix/engine";
import {
  BUTONA_BAS_DURATION_MS,
  type ButonaBasPublicView,
  type ButonaBasView,
  type ButonaBasWindowResult,
} from "@glix/engine";
import { roundClockAt } from "../games/butona-bas/view.js";
import { setExportBusy, setGooglePending } from "../net/account.js";
import { useMockSender } from "../net/client.js";
import { freezeFriends } from "../net/friends.js";
import { parseFriends } from "../net/friendsRules.js";
import { freezeProfile } from "../net/profile.js";
import { parseProfile } from "../net/profileRules.js";
import { emitReaction } from "../net/reactions.js";
import { markReportDone } from "../net/report.js";
import { REPORT_THANKS } from "../net/reportRules.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";

const CATALOG: GameInfo[] = [
  { id: "butona-bas", name: "Butona Bas", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  { id: "hafiza", name: "Hafıza Kapışması", minPlayers: 3, maxPlayers: 8, orientation: "portrait" },
  { id: "kor-bomba", name: "Kör Bomba", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  { id: "cagrisim-agi", name: "Çağrışım Ağı", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
  { id: "capraz-ates", name: "Çapraz Ateş", minPlayers: 3, maxPlayers: 8, orientation: "landscape" },
  { id: "karalama-defteri", name: "Karalama Defteri", minPlayers: 3, maxPlayers: 8, orientation: "portrait" },
];

/** Profil ekranı önizlemesi: dolu ya da yeni (boş) hesap. */
function mockProfile(empty: boolean): {
  kind: "ready";
  profile: NonNullable<ReturnType<typeof parseProfile>>;
} {
  const day = 24 * 3600 * 1000;
  const now = Date.now();
  const games = empty
    ? []
    : [
        { gameId: "butona-bas", name: "Butona Bas", plays: 14, wins: 6, bestMini: 9 },
        { gameId: "kor-bomba", name: "Kör Bomba", plays: 9, wins: 2, bestMini: 4 },
        { gameId: "cagrisim-agi", name: "Çağrışım Ağı", plays: 5, wins: 1, bestMini: -2 },
      ];
  const raw = {
    ok: true,
    username: "cihad_01",
    createdAt: now - 40 * day,
    totals: empty
      ? { matches: 0, wins: 0, winRate: 0, games: 0, gameWins: 0 }
      : { matches: 12, wins: 5, winRate: 0.417, games: 28, gameWins: 9 },
    favoriteGame: empty ? null : { id: "butona-bas", name: "Butona Bas", plays: 14 },
    perGame: games,
    recent: empty
      ? []
      : [
          { endedAt: now - 2 * 3600 * 1000, players: 5, place: 1, score: 11 },
          { endedAt: now - day, players: 4, place: 3, score: 4 },
          { endedAt: now - 3 * day, players: 8, place: 2, score: -1 },
          { endedAt: now - 20 * day, players: 3, place: 1, score: 7 },
        ],
    coPlayers: empty
      ? []
      : [
          { username: "elif_k", matches: 9 },
          { username: "mert_34", matches: 6 },
          { username: "zeynep", matches: 2 },
        ],
  };
  const profile = parseProfile(raw);
  if (!profile) throw new Error("örnek profil geçersiz");
  return { kind: "ready", profile };
}

export function startMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(1, Number(params.get("n")) || 5));
  let players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(kind === "lobby" && i === 3),
    score: 0,
    spectator: false,
  }));
  // `&watch=K`: son K kişi maçı izleyen (sıralanmayan); `&afterwatch=1`: kendin izleyici olarak final'den lobiye dönersin.
  const watchCount = Math.min(n - 1, Math.max(0, Number(params.get("watch")) || 0));
  players = players.map((p, i) => ({ ...p, spectator: i >= n - watchCount && watchCount > 0 }));
  if (params.get("afterwatch") === "1") players = players.map((p) => ({ ...p, spectator: p.id === "p0" }));
  let joinPolicy: JoinPolicy = params.get("join") === "kapali" ? "kapali" : "izleyici";
  let rev = 1;
  // Varsayılan oda rastgele 5; `&sel=manual` el ile modda açar.
  let selection: RoomSnapshot["selection"] =
    params.get("sel") === "manual" ? { mode: "manual" } : { mode: "random", count: 5 };
  // `&pick=N` (manuel mod): ilk N oyun seçili gelir (lobi "Bu gece" şeridi denetimi).
  const pick = Math.max(1, Math.min(CATALOG.length, Number(params.get("pick") ?? 1) || 1));
  let gameIds =
    selection.mode === "manual" ? (pick > 1 ? CATALOG.slice(0, pick).map((g) => g.id) : ["butona-bas"]) : [];
  let phase: RoomPhase = "lobby";
  let readyIds: string[] = [];
  let continueIds: string[] = [];
  const hostId = params.get("guest") === "1" ? "p1" : SELF;
  // `&ready=K`: host dışındaki ilk K oyuncu lobide "Hazırım" demiş olur.
  let lobbyReady: string[] = players
    .filter((p) => p.id !== hostId && p.connected)
    .slice(0, Math.max(0, Number(params.get("ready")) || 0))
    .map((p) => p.id);
  let phaseStartedAt = Date.now();
  let phaseEndsAt: number | null = null;
  let result: MatchSnapshot["result"] = null;
  let publicView: unknown = null;
  let view: unknown = null;
  let playStart = Date.now();
  let windows: ButonaBasWindowResult[] = [];
  let windowIndex = 0;
  let mini: Record<string, number> = {};
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number): void => {
    timers.push(setTimeout(fn, ms));
  };

  setState({ conn: "open", everOpen: true, nickname: params.has("nonick") ? "" : "Cihad" });

  const match = (): MatchSnapshot | null =>
    phase === "lobby"
      ? null
      : {
          round: 0,
          total: 3,
          gameId: "butona-bas",
          gameName: "Butona Bas",
          briefing: {
            goal: "Aynı anda büyük kırmızı butona basarak eşleşme yakala.",
            steps: [
              "Büyük kırmızı butonu hazırla.",
              "Aynı kısa zamanda arkadaşlarınla bas.",
              "Grup basışı puan verir, tek basış geri teper.",
            ],
          },
          orientation: "portrait",
          participants: players.filter((p) => !p.spectator).map((p) => p.id),
          readyIds,
          continueIds,
          phaseStartedAt,
          phaseEndsAt,
          publicView,
          view,
          result,
        };

  const publish = (): void => {
    const snapshot: RoomSnapshot = {
      rev: ++rev,
      serverNow: Date.now(),
      code: "KX7QP",
      hostId,
      selfId: SELF,
      phase,
      players,
      gameIds,
      selection,
      joinPolicy,
      stageCount: 0,
      lobbyReady: phase === "lobby" ? lobbyReady : [],
      catalog: CATALOG,
      match: match(),
    };
    applySnapshot(snapshot);
  };

  // `&tur=2|3`: o turun ortasında başlar; `&ara=1`: 1. tur sonrası "Pencere daralıyor" arası (hep aynı karede kalır).
  const turParam = Number(params.get("tur")) || 1;
  const frozenGap = params.get("ara") === "1";
  const buildPublicView = (): ButonaBasPublicView => {
    const endsAt = playStart + BUTONA_BAS_DURATION_MS;
    const c = roundClockAt(playStart, endsAt, Date.now());
    return {
      startedAt: playStart,
      endsAt,
      round: c.round + 1,
      rounds: 3,
      phase: c.phase,
      windowMs: c.windowMs,
      phaseEndsAt: c.phaseEndsAt,
      scores: { ...mini },
      recent: windows.slice(-8),
    };
  };
  const buildView = (): ButonaBasView => ({ myScore: mini[SELF] ?? 0, pressedThisWindow: false });

  const addWindow = (pressers: string[]): void => {
    const outcome: "match" | "solo" = pressers.length >= 2 ? "match" : "solo";
    windows = [...windows, { round: 0, index: windowIndex++, pressers, outcome }].slice(-8);
    for (const id of pressers) mini[id] = (mini[id] ?? 0) + (outcome === "match" ? 1 : -1);
    publicView = buildPublicView();
    view = buildView();
    publish();
  };

  const botWindow = (): void => {
    if (phase !== "playing") return;
    const bots = players.filter((p) => p.id !== SELF).map((p) => p.id);
    const k = Math.random() < 0.7 ? 2 + Math.floor(Math.random() * 2) : 1;
    const picked = [...bots].sort(() => Math.random() - 0.5).slice(0, Math.min(k, bots.length));
    addWindow(picked);
    later(botWindow, 800 + Math.random() * 700);
  };

  const toPlaying = (): void => {
    phase = "playing";
    // Varsayılan: 1. turun 5. saniyesi; `&tur=2|3` ilgili turun 5. saniyesi; `&ara=1` aranın başı.
    const into = frozenGap ? 16_000 : (Math.min(3, Math.max(1, turParam)) - 1) * 18_000 + 5_000;
    playStart = Date.now() - into;
    phaseStartedAt = playStart;
    phaseEndsAt = null;
    mini = { p0: 4, p1: 5, p2: 3, p3: 1, p4: 0 };
    windows = [];
    windowIndex = 0;
    publicView = buildPublicView();
    view = buildView();
    publish();
    later(botWindow, 400);
    if (frozenGap) {
      // Denetim sırasında ara ekranı kaybolmasın: başlangıç anı her 250 ms'de aranın başına çekilir.
      const hold = (): void => {
        if (phase !== "playing") return;
        playStart = Date.now() - 16_000;
        phaseStartedAt = playStart;
        publicView = buildPublicView();
        publish();
        later(hold, 250);
      };
      later(hold, 250);
    }
  };
  const toCountdown = (): void => {
    phase = "countdown";
    phaseStartedAt = Date.now();
    phaseEndsAt = phaseStartedAt + 3000;
    publish();
    later(() => {
      if (phase !== "countdown") return;
      if (kind === "countdown") toCountdown();
      else toPlaying();
    }, 3000);
  };
  const toResults = (): void => {
    phase = "results";
    phaseStartedAt = Date.now();
    phaseEndsAt = phaseStartedAt + 7000;
    const scores = [9, 6, 6, 2, -1, 0, 3, 4];
    const playing = players.filter((p) => !p.spectator);
    mini = Object.fromEntries(playing.map((p, i) => [p.id, scores[i] ?? 0]));
    if (gameIds.length === 0) gameIds = ["butona-bas", "kor-bomba", "cagrisim-agi"];
    // Genel puanlar bu turun ödüllerini içerir; önceki sıralama bunlardan geri çıkarılır (sıra değişimi görünsün).
    const prev = [1, 5, 4, 3, 2, 0, 3, 2];
    const awardOf = (i: number): number => (i === 0 ? 2 : i === 1 ? 1 : i === 4 ? -1 : 0);
    players = players.map((p, i) => (p.spectator ? p : { ...p, score: (prev[i] ?? 0) + awardOf(i) }));
    // `&devam=1`: sen ve çoğu oyuncu Devam demiş.
    continueIds = params.get("devam") === "1" ? [SELF, ...playing.slice(1, -2).map((p) => p.id)] : [];
    result = {
      miniScores: mini,
      awards: Object.fromEntries(playing.map((p, i) => [p.id, awardOf(i)])),
    };
    publish();
    if (kind === "results") later(toResults, 7000);
  };
  const toFinal = (): void => {
    phase = "final";
    const totals = [5, 4, 4, 2, -1, 0, 3, 2];
    players = players.map((p, i) => ({ ...p, score: p.spectator ? 0 : (totals[i] ?? 0) }));
    // Final unvanları için tur geçmişi (herkese açık ödüller).
    void import("../net/matchHistory.js").then((m) =>
      m.seedRounds([
        {
          round: 0,
          gameId: "butona-bas",
          awards: { p0: 2, p1: 1 },
          summary: "Elif 10,00 sn hedefine 0,03 sn kala bastı",
        },
        {
          round: 1,
          gameId: "sozluk-blofu",
          awards: { p2: 2, p3: 1, p4: -1 },
          summary: "Can'ın uydurma tanımına 3 kişi kandı",
        },
        { round: 2, gameId: "kor-bomba", awards: { p0: 2, p2: 1, p4: -1 } },
        {
          round: 3,
          gameId: "cagrisim-agi",
          awards: { p1: 2, p0: 1 },
          summary: "Deniz ve Elif aynı kelimede buluştu",
        },
      ]),
    );
    // `&gallery=N`: maç sonu galerisine N çizim koyar (ekran denetimi).
    const gal = Number(params.get("gallery") ?? 0);
    if (gal > 0)
      void import("./mockKaralama.js").then(async (k) => {
        const g = await import("../ui/matchGallery.js");
        g.seedGallery(
          Array.from({ length: gal }, (_, i) => ({
            key: `dev:${i}`,
            game: i % 3 === 2 ? ("bozuk" as const) : ("karalama" as const),
            playerId: players[i % players.length]?.id ?? "p0",
            strokes: k.sketch(i),
            version: String(i),
          })),
        );
      });
    publish();
    // Maç bitti, ev sahibi lobiye aldı: izleyici artık normal oyuncu.
    if (params.get("afterwatch") === "1")
      later(() => {
        phase = "lobby";
        players = players.map((p) => ({ ...p, score: 0, spectator: false }));
        publish();
      }, 500);
  };
  const toBriefing = (): void => {
    phase = "briefing";
    readyIds = ["p1", "p2"];
    phaseStartedAt = Date.now();
    phaseEndsAt = phaseStartedAt + 40_000;
    publish();
  };

  useMockSender((msg: ClientMessage) => {
    switch (msg.type) {
      case "setGames":
        gameIds = msg.gameIds;
        selection = { mode: "manual" };
        publish();
        break;
      case "setTone":
        break;
      case "setJoinPolicy":
        joinPolicy = msg.policy;
        publish();
        break;
      case "setRandom":
        selection = { mode: "random", count: Math.min(msg.count, CATALOG.length) };
        gameIds = [];
        publish();
        break;
      case "chooseAvatar": {
        const taken = players.find((p) => p.avatar === msg.avatar && p.id !== SELF);
        if (taken) break;
        players = players.map((p) => (p.id === SELF ? { ...p, avatar: msg.avatar } : p));
        publish();
        break;
      }
      case "setReady":
        lobbyReady = msg.ready ? [...new Set([...lobbyReady, SELF])] : lobbyReady.filter((id) => id !== SELF);
        publish();
        break;
      case "rename":
        players = players.map((p) => (p.id === SELF ? { ...p, nickname: msg.nickname } : p));
        publish();
        break;
      case "react":
        emitReaction(SELF, msg.emoji);
        break;
      case "report":
        // Önizleme: sunucu gibi kabul eder.
        later(() => markReportDone(REPORT_THANKS), 250);
        break;
      case "kick":
        players = players.filter((p) => p.id !== msg.playerId);
        publish();
        break;
      case "startMatch":
        toBriefing();
        break;
      case "ready":
        readyIds = [...new Set([...readyIds, SELF, ...players.map((p) => p.id)])];
        publish();
        later(toCountdown, 700);
        break;
      case "action": {
        const bots = players.filter((p) => p.id !== SELF);
        const mate = bots[Math.floor(Math.random() * bots.length)];
        later(() => addWindow(Math.random() < 0.65 && mate ? [SELF, mate.id] : [SELF]), 260);
        break;
      }
      case "continue":
        continueIds = [...new Set([...continueIds, SELF])];
        publish();
        break;
      case "returnToLobby":
        phase = "lobby";
        players = players.map((p) => ({ ...p, score: 0 }));
        publish();
        break;
      default:
        break;
    }
  });

  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  // `&acct=1`: giriş yapmış hesap (finalde misafir daveti görünmez).
  if (kind === "final" && params.get("acct") === "1")
    setState("account", { username: "cihad_01", email: "cihad@example.com" });
  // `&badge=N`: N bekleyen arkadaşlık isteği (ana sayfada ad rozeti, Profil'de Arkadaşlar satırı).
  const badge = Number(params.get("badge") ?? 0);
  if (Number.isInteger(badge) && badge > 0) {
    const incoming = Array.from({ length: badge }, (_, i) => ({
      username: `istek_${i + 1}`,
      at: Date.now(),
    }));
    const parsed = parseFriends({ ok: true, friends: [], incoming, outgoing: [], blocked: [] });
    if (parsed) freezeFriends(parsed, "ready");
  }
  // `&duyuru=bilgi|uyari|uzun`: yönetici duyurusu; `&bakim=1`: bakım kipi bandı (ana sayfa ve lobi).
  const duyuru = params.get("duyuru");
  if (duyuru === "bilgi" || duyuru === "uyari" || duyuru === "uzun")
    setState("site", {
      announcement: {
        id: 7,
        kind: duyuru === "bilgi" ? "bilgi" : "uyari",
        text:
          duyuru === "uzun"
            ? "Bu akşam 23.00'te kısa bir güncelleme yapacağız. Sürmekte olan oyunlar bitince yeniden başlatılır, odan kapanmaz; kod ile tekrar katılabilirsin."
            : duyuru === "bilgi"
              ? "Yeni oyun geldi: Kule Ustası artık rastgele seçimde!"
              : "Bu akşam 23.00'te kısa bir güncelleme olacak.",
        endsAt: null,
      },
      maintenance: params.get("bakim") === "1",
    });
  else if (params.get("bakim") === "1") setState("site", { announcement: null, maintenance: true });
  // `&cool=1`: kullanıcı adı yakın zamanda değişmiş (3 gün sonra tekrar değiştirilebilir).
  if (params.get("cool") === "1") setState("usernameAvailableAt", Date.now() + 3 * 24 * 3600 * 1000);
  // `&google=1`: Google ile giriş açık (düğmeler görünür).
  if (params.get("google") === "1") setState("google", { enabled: true, linked: false });
  // `&mail=1`: e-posta açık (Şifremi unuttum görünür); `&verified=1`: e-posta doğrulanmış; `&pw=0`: şifresiz hesap.
  if (params.get("mail") === "1")
    setState("mail", {
      enabled: true,
      verified: params.get("verified") === "1",
      hasPassword: params.get("pw") !== "0",
    });
  // `&exp=busy`: "Verimi indir" sürüyor (düğme kilitli, "Hazırlanıyor…").
  if (params.get("exp") === "busy") setExportBusy(true);
  switch (kind) {
    case "home":
      // `&acct=1`: giriş yapmış kullanıcı (Oda kur + çıkış); varsayılan misafir.
      if (params.get("acct") === "1")
        setState("account", { username: "cihad_01", email: "cihad@example.com" });
      if (params.get("off") === "1") setState({ conn: "closed", failedAttempts: 2 });
      break;
    case "join":
      setState({ nav: "join", joinCode: "KX7" });
      break;
    case "settings": {
      // `&page=oyuncu|cihaz|bildirim|hesap|hakkinda`: o kategorinin ayrıntı sayfası; varsayılan ana liste.
      const page = params.get("page");
      const pages = ["oyuncu", "cihaz", "bildirim", "hesap", "hakkinda"] as const;
      const open = pages.find((x) => x === page);
      setState({ nav: "settings", settingsPage: open ?? "main" });
      // `&acct=1`: giriş yapmış hesap; `&google=1`: sunucuda Google açık (bağlı değil) — Ayarlar'da bağla satırı.
      if (params.get("acct") === "1")
        setState("account", { username: "cihad_01", email: "cihad@example.com" });
      break;
    }
    case "profil": {
      // `&v=bos|yukleniyor|hata`; varsayılan dolu profil. Ekran açılmadan önce sabitlenir (ağdan okumasın).
      const v = params.get("v");
      if (v === "yukleniyor") freezeProfile({ kind: "loading" });
      else if (v === "hata")
        freezeProfile({ kind: "error", message: "Profil şu an yüklenemedi. Biraz sonra tekrar dene." });
      else freezeProfile(mockProfile(v === "bos"));
      setState({ nav: "profile", account: { username: "cihad_01", email: "cihad@example.com" } });
      break;
    }
    case "login":
    case "register":
    case "aydinlatma":
      setState({ nav: kind });
      break;
    case "unuttum":
      setState({ nav: "unuttum" });
      break;
    case "yeni-sifre":
      setState({ nav: "yeniSifre" });
      break;
    case "google-ad":
      setGooglePending({ token: "A".repeat(43), suggestion: "kisi_adi" });
      setState({ nav: "googleAd" });
      break;
    case "notfound":
      setState({ notFoundCode: "ABCDE" });
      break;
    case "reconnect":
      publish();
      setState("conn", "closed");
      break;
    case "briefing":
      toBriefing();
      break;
    case "countdown":
      toCountdown();
      break;
    case "playing":
      toPlaying();
      break;
    case "results":
      toResults();
      break;
    case "final":
      toFinal();
      break;
    default:
      publish();
  }
  // `&emoji=1`: lobide, sonuç ve finalde birkaç oyuncudan emoji uçar (ekran denetimi için).
  if ((kind === "lobby" || kind === "results" || kind === "final") && params.get("emoji") === "1") {
    const picks = ["😂", "🔥", "👏", "😱"] as const;
    const burst = (): void => {
      players.slice(0, 4).forEach((p, i) => {
        const emoji = picks[i % picks.length];
        if (emoji) emitReaction(p.id, emoji);
      });
    };
    // Ekran görüntüsü uçuşun ortasına denk gelsin diye tekrarlanır.
    for (let k = 0; k < 8; k++) later(burst, 250 + k * 700);
  }
  if (
    kind === "home" ||
    kind === "join" ||
    kind === "settings" ||
    kind === "profil" ||
    kind === "notfound" ||
    kind === "login" ||
    kind === "register" ||
    kind === "aydinlatma" ||
    kind === "unuttum" ||
    kind === "yeni-sifre" ||
    kind === "google-ad"
  )
    setState("session", null);
}
