import type {
  ContentTone,
  GameInfo,
  GameLog,
  JoinPolicy,
  RoomPhase,
  RoomSnapshot,
  ServerMessage,
} from "@glix/engine";
import type { Broadcaster } from "./broadcast.js";
import type { Cancel, Clock } from "./clock.js";
import type { Match } from "./match.js";
import type { Metrics } from "./metrics.js";
import type { IpLimiter } from "./ratelimit.js";
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
  close(code: number, reason: string): void;
  player: Player | null;
  /** Sahne (TV) olarak bağlandığı oda; oyuncu değildir (`player` null kalır). */
  stage: Room | null;
  /** Çözümlenmiş istemci IP'si (oran sınırları için). */
  ip: string;
  /** Bu bağlantıdaki başarısız (`room_not_found`) katılma sayısı. */
  failedJoins: number;
}

export interface Player {
  id: string;
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
  tone: ContentTone;
  /** Maç sürerken gelen kişiye ne olur (yalnız lobide değişir). */
  joinPolicy: JoinPolicy;
  match: Match | null;
  rev: number;
  nextJoinOrder: number;
  lastFlushAt: number;
  flushCancel: Cancel | null;
  deleteCancel: Cancel | null;
  /** Host koptuğunda devir öncesi bekleme zamanlayıcısı. */
  hostGraceCancel: Cancel | null;
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
  /** Web bildirimi göndericisi (VAPID yoksa kapalı). */
  push: PushGateway;
  /** Son biten/çöken oyunların kayıtları (en yeni sonda, en çok RECENT_LOGS). */
  recentLogs: GameLog[];
  /** Oturum belirteci -> oyuncu. */
  tokens: Map<string, Player>;
  /** Etkin maçı olan odalar (tick yalnız bunlar için çalışır). */
  active: Set<Room>;
  broadcaster: Broadcaster;
  catalog: GameInfo[];
  /** Yeni odanın varsayılan oyun seçimi; null ise rastgele 5. */
  defaultGameIds: string[] | null;
  /** 0..max-1 arası rastgele tamsayı (testlerde değiştirilebilir; varsayılan crypto). */
  randomInt: (max: number) => number;
}

export function isConnected(player: Player): boolean {
  return player.conn !== null;
}
