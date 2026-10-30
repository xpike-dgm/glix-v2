import type {
  Announcement,
  CardLog,
  CardSettings,
  Cosmetics,
  GameInfo,
  GameLog,
  JoinPolicy,
  RoomPhase,
  RoomSnapshot,
  ServerMessage,
} from "@glix/engine";
import type { AccountStatsRecorder } from "./accountStats.js";
import type { AiCommenter } from "./aiComment.js";
import type { Broadcaster } from "./broadcast.js";
import type { Cancel, Clock } from "./clock.js";
import type { ContentStore } from "./contentStore.js";
import type { Match } from "./match.js";
import type { Metrics } from "./metrics.js";
import type { BannedWords, ReportDesk, RoomKicks } from "./moderation.js";
import type { IpLimiter } from "./ratelimit.js";
import type { Social } from "./social.js";
import type { StatsStore } from "./statsStore.js";
import type { PushGateway, PushTarget } from "./webpush.js";

/** Bir WebSocket bağlantısının sunucudaki temsili. Oda/oyuncu bağı oturum açılınca dolar. */
export interface Connection {
  send(msg: ServerMessage): void;
  /** Önceden kodlanmış JSON metnini gönderir (yayın yolu: boyut karşılaştırması zaten kodlar). */
  sendRaw(text: string): void;
  /**
   * Bu bağlantıya en son gönderilen tam snapshot; sonraki `patch` bunun üzerinden hesaplanır.
   * null ise sıradaki yayın tam `room` olur (giriş, resume, resync).
   */
  lastSent: RoomSnapshot | null;
  /** `lastSent`'in dayandığı ortak oda sürümü (broadcast.ts); hızlı yama yolu yalnız güncel sürümde çalışır. */
  sentVer: number;
  /** Bu bağlantıya son hesaplanan tam `room` metninin uzunluğu; yama bunun çok altındaysa tam metin yeniden kodlanmaz. */
  fullLenHint?: number;
  close(code: number, reason: string): void;
  player: Player | null;
  /** Sahne (TV) olarak bağlandığı oda; oyuncu değildir (`player` null kalır). */
  stage: Room | null;
  /** Çözümlenmiş istemci IP'si (oran sınırları için). */
  ip: string;
  /** Yükseltme anında çerezden çözülen hesap; yalnız sunucuda kalır, hiçbir mesajda yayınlanmaz. */
  account: AccountRef | null;
  /** Hesabı çözen oturum çerezinin özeti; oturum iptal edilince bu bağlantı misafire döner. */
  sessionHash?: string | null;
  /** Bu bağlantıdaki başarısız (`room_not_found`) katılma sayısı. */
  failedJoins: number;
}

/** Bağlantıya bağlı hesap (e-posta taşımaz). */
export interface AccountRef {
  id: number;
  username: string;
}

export interface Player {
  id: string;
  /** Hesaplı oyuncunun hesap kimliği; misafirde null. Yalnız sunucuda, yayına girmez. */
  accountId: number | null;
  /** Hesaplı oyuncunun kullanıcı adı; misafirde null. Anlık görüntüde herkese açık `PlayerInfo.username` olur (e-posta yok). */
  username: string | null;
  /** Kuşandığı görünüm (hesaplıda, katalog kimlikleriyle); anlık görüntüde herkese açık `PlayerInfo.cosmetics`. */
  cosmetics: Cosmetics | undefined;
  nickname: string;
  avatar: number;
  token: string;
  score: number;
  /** Maç sürerken girdi: yalnız izler (maça katılmaz, puan almaz). Lobiye dönünce false olur. */
  spectator: boolean;
  /** Katılım sırası; "en eski" host seçimi için. */
  joinOrder: number;
  conn: Connection | null;
  room: Room;
  graceCancel: Cancel | null;
  /** Lobide "Hazırım" dedi (host olmayan oyuncu). Maç başlayınca ve lobiye dönünce sıfırlanır. */
  lobbyReady: boolean;
  /** Son emoji tepkisinin sunucu saati (ms); hız sınırı için. */
  lastReactAt: number;
  /** Son `continue` mesajının sunucu saati (ms); hız sınırı için. */
  lastContinueAt: number;
  /** Son takma ad değişikliğinin sunucu saati (ms); hız sınırı için. */
  lastRenameAt: number;
  /** İstemci sayfasını gizledi (yalnız bildirim açıkken bildirir). Yeniden bağlanınca sıfırlanır. */
  hidden: boolean;
  /** Web bildirimi aboneliği; yalnız bellekte, oyuncuyla birlikte (ayrılınca, atılınca, oda kapanınca) yok olur. */
  push: PushTarget | null;
  /** Son bildirimin sunucu saati (ms); 20 sn sınırı için. */
  lastPushAt: number;
}

export interface Room {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  /** Bağlı sahne (TV) bağlantıları; oyuncu sayılmaz, listede görünmez, en çok MAX_STAGES. */
  stages: Set<Connection>;
  phase: RoomPhase;
  /** Manuel modda seçili oyunlar; rastgele modda lobide boş, maçta seçilenler. */
  gameIds: string[];
  selection: RoomSnapshot["selection"];
  /** İçerik tonu; maç başında oyunların `setup`ına verilir. */
  /** Maç sürerken gelen kişiye ne olur (yalnız lobide değişir). */
  joinPolicy: JoinPolicy;
  match: Match | null;
  /** Kartlar ayarı (docs/KURALLAR.md K8); odada kalır, yalnız lobide değişir. */
  cardSettings: CardSettings;
  rev: number;
  nextJoinOrder: number;
  lastFlushAt: number;
  flushCancel: Cancel | null;
  /** Oyunun/geri sayımın tam zamanlı uyandırması (tick'ten bağımsız); en çok bir tane. */
  wakeCancel: Cancel | null;
  wakeAt: number | null;
  deleteCancel: Cancel | null;
  /** Host koptuğunda devir öncesi bekleme zamanlayıcısı. */
  hostGraceCancel: Cancel | null;
  /** Odanın kurulduğu sunucu saati (ms); yönetici panelinde oda yaşı için. */
  createdAt: number;
  /**
   * Son biten oyunda herkese açık gösterilmiş metinler (oyuncu kimliği -> metinler); yalnız sunucuda, "Bildir" kanıtı
   * için (bkz. packages/engine/src/moderation/evidence.ts). Yayına girmez.
   */
  evidence: { gameId: string; texts: Record<string, string[]> } | null;
}

export interface Runtime {
  clock: Clock;
  rooms: Map<string, Room>;
  /** SIGTERM sonrası: yeni oda kurulmaz/katılınmaz, mevcut maçlar sürer. */
  draining: boolean;
  /** Aynı anda en çok oda sayısı. */
  maxRooms: number;
  ipLimiter: IpLimiter;
  metrics: Metrics;
  /** Anonim istatistik deposu (devre dışıysa hiçbir şey yapmaz). */
  stats: StatsStore;
  /** Hesaplı oyuncuların maç/oyun sonuçlarını yazar (testlerde değiştirilebilir; varsayılan hiçbir şey yapmaz). */
  accountStats: AccountStatsRecorder;
  /** Web bildirimi göndericisi (VAPID yoksa kapalı). */
  push: PushGateway;
  /** Arkadaş sistemi (durum, davet); sunucu kurulurken bağlanır, testlerde varsayılan hiçbir şey yapmaz. */
  social: Social;
  /** Son biten/çöken oyunların kayıtları (en yeni sonda, en çok RECENT_LOGS). */
  recentLogs: GameLog[];
  /** Son biten maçların kart kayıtları (en yeni sonda, en çok RECENT_LOGS). */
  recentCardLogs: CardLog[];
  /** Oturum belirteci -> oyuncu. */
  tokens: Map<string, Player>;
  /** Etkin maçı olan odalar (tick yalnız bunlar için çalışır). */
  active: Set<Room>;
  broadcaster: Broadcaster;
  /** Etkin katalog: yönetici anahtarlarıyla süzülmüş (kapalı oyunlar yok, `randomPool` etkin değer). Bkz. gameSwitches.ts. */
  catalog: GameInfo[];
  /** Bakım kipi: yeni oda kurulamaz, yeni maç başlamaz (süren maçlar biter). */
  maintenance: boolean;
  /** Günlük görevler anahtarı (varsayılan kapalı): kapalıyken ilerleme, ödül ve arayüz yoktur. */
  gunlukGorevler: boolean;
  /** Yayındaki duyuru (süresi dolmuş olabilir; `siteNoticeOf` süzer). */
  announcement: Announcement | null;
  /** Yönetici yasaklı kelime listesi (ad denetimi); testlerde varsayılan hiçbir şeyi engellemez. */
  bannedWords: BannedWords;
  /** İçerik havuzu değişiklikleri (A4); yeni maçların `setup` bağlamına verilir. Testlerde varsayılan hiçbir şeyi değiştirmez. */
  content: ContentStore;
  /** Oyuncu bildirimi kabulü; sunucu kurulurken bağlanır. */
  reports: ReportDesk;
  /** Yönetici atmasından sonra odaya girme engeli (10 dk). */
  roomKicks: RoomKicks;
  /** Yeni odanın varsayılan oyun seçimi; null ise rastgele 5. */
  defaultGameIds: string[] | null;
  /** 0..max-1 arası rastgele tamsayı (testlerde değiştirilebilir; varsayılan crypto). */
  randomInt: (max: number) => number;
  /** Oyun sonu yorumu (aiComment.ts); anahtar yoksa ve testlerde varsayılan kapalı. */
  aiComment: AiCommenter;
}

export function isConnected(player: Player): boolean {
  return player.conn !== null;
}
