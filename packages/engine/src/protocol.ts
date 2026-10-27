import { type ContentTone, type GameResult, isContentTone } from "./game.js";

export const PROTOCOL_VERSION = 2;
export const APP_VERSION = "0.1.0";

export const MAX_MESSAGE_LENGTH = 4096;
export const ROOM_CODE_LENGTH = 5;
export const MAX_PLAYERS = 8;
/** Bir odaya aynı anda bağlanabilecek sahne (TV) sayısı; oyuncu sayısına girmez. */
export const MAX_STAGES = 2;
/** Seçilebilir karakter sayısı (avatar 0..AVATAR_COUNT-1); odadaki en çok oyuncu sayısıyla aynıdır. */
export const AVATAR_COUNT = MAX_PLAYERS;
export const MAX_NICKNAME_LENGTH = 16;
/** El ile seçimde en çok oyun (katalogdan büyük olmalı; `setRandom` sınırıyla aynı). */
export const MAX_SELECTED_GAMES = 64;

/** Lobide gönderilebilen sabit emoji kümesi (sunucu bu listeyle doğrular). */
export const LOBBY_EMOJIS = ["👋", "😂", "🔥", "😱", "👏", "❤️"] as const;
export type LobbyEmoji = (typeof LOBBY_EMOJIS)[number];
/** `continue` mesajları arasındaki en kısa süre (aynı oyuncu); daha sıkı gelen `rate_limited` alır. */
export const CONTINUE_MIN_GAP_MS = 300;
/** Bağlı herkes "Devam" deyince sonuç aşamasının bitmesine kalan süre (ms). */
export const CONTINUE_GRACE_MS = 1_000;

/** Aynı oyuncunun iki emoji arasındaki en kısa süre; fazlası sessizce atılır. */
export const REACTION_MIN_GAP_MS = 700;

export function isLobbyEmoji(value: unknown): value is LobbyEmoji {
  return typeof value === "string" && (LOBBY_EMOJIS as readonly string[]).includes(value);
}

/** Maç sürerken odaya katılım: "izleyici" (varsayılan) izleyici olarak girer, "kapali" kimseyi almaz. */
export const JOIN_POLICIES = ["izleyici", "kapali"] as const;
export type JoinPolicy = (typeof JOIN_POLICIES)[number];
export const DEFAULT_JOIN_POLICY: JoinPolicy = "izleyici";

export function isJoinPolicy(value: unknown): value is JoinPolicy {
  return typeof value === "string" && (JOIN_POLICIES as readonly string[]).includes(value);
}

/** Web bildirimi aboneliği sınırları (docs/PROTOKOL.md "Web bildirimleri"). */
export const PUSH_ENDPOINT_MAX = 500;
/** `p256dh` (65 baytlık sıkıştırılmamış P-256 noktası) ve `auth` (16 bayt) base64url uzunlukları (dolgusuz). */
export const PUSH_P256DH_LENGTH = 87;
export const PUSH_AUTH_LENGTH = 22;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

const HTTPS_URL = /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:[/?#][^\s]*)?$/;

/** Bildirim uç noktası: en çok 500 karakter, https, kimlik bilgisi yok. Konak denetimi sunucuda ayrıca yapılır. */
export function isPushEndpoint(value: unknown): value is string {
  return typeof value === "string" && value.length <= PUSH_ENDPOINT_MAX && HTTPS_URL.test(value);
}

function isBase64urlOfLength(value: unknown, length: number): value is string {
  return typeof value === "string" && value.length === length && BASE64URL.test(value);
}

/** Kullanıcı adı: 3–20 karakter, harf/rakam/alt çizgi (sunucudaki hesap kuralıyla aynı). */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

/** Arkadaşın durumu: yalnız arkadaşlar görür, sunucu bağlantılardan türetir. */
export const FRIEND_STATUSES = ["offline", "online", "lobby", "playing"] as const;
export type FriendStatus = (typeof FRIEND_STATUSES)[number];

export function isFriendStatus(value: unknown): value is FriendStatus {
  return typeof value === "string" && (FRIEND_STATUSES as readonly string[]).includes(value);
}

/** Davet bu süre (ms) sonra geçersizdir. */
export const INVITE_TTL_MS = 10 * 60 * 1000;

// Akış ayrıntıları: docs/PROTOKOL.md

export type ClientMessage =
  | { type: "hello"; clientVersion: string }
  | { type: "ping"; t: number }
  /** `avatar`: cihazın hatırladığı karakter; boşsa verilir, doluysa otomatik atanan kalır. */
  | { type: "createRoom"; nickname: string; avatar?: number }
  | { type: "joinRoom"; code: string; nickname: string; avatar?: number }
  /**
   * Sahne (TV) olarak odaya bağlan: koltuk tutmaz, oyuncu listesine girmez, yalnız izler. Oyuncu kimliği almaz;
   * `publicView` ve `view(durum, null)` görür. `leaveRoom` / `ping` / `hello` / `resync` dışında bir şey gönderemez.
   */
  | { type: "joinStage"; code: string }
  /** Lobide karakter değiştir (yalnız lobi; odada benzersiz, ilk gelen alır). */
  | { type: "chooseAvatar"; avatar: number }
  /** Lobide takma ad değiştir (yalnız lobi; odada benzersiz). */
  | { type: "rename"; nickname: string }
  /** Lobide emoji tepkisi (sabit küme, yalnız lobi, oyuncu başına 700 ms'de bir). Sunucu herkese `reaction` yollar. */
  | { type: "react"; emoji: LobbyEmoji }
  /** Lobide "Hazırım" işareti (host dışı oyuncular; yalnız lobi). Başlamak için şart değildir. */
  | { type: "setReady"; ready: boolean }
  | { type: "resume"; token: string }
  | { type: "leaveRoom" }
  | { type: "kick"; playerId: string }
  /** Ev sahipliğini devret (yalnız host, yalnız lobi; hedef odada ve bağlı olmalı). */
  | { type: "transferHost"; playerId: string }
  | { type: "setGames"; gameIds: string[] }
  /** Rastgele mod: maç başında uygun oyunlar arasından `count` tanesi seçilir (1..katalog). */
  | { type: "setRandom"; count: number }
  /** İçerik tonu (yalnız host, yalnız lobi). Oyunlar içerik havuzunu buna göre seçer. */
  | { type: "setTone"; tone: ContentTone }
  /** Maç sürerken katılım ayarı (yalnız host, yalnız lobi). */
  | { type: "setJoinPolicy"; policy: JoinPolicy }
  | { type: "startMatch" }
  | { type: "ready" }
  /** `results` aşamasında "Devam": bağlı tüm oyuncular basınca sonuç ekranı 1 sn sonra biter. */
  | { type: "continue" }
  | { type: "action"; seq: number; payload: unknown }
  | { type: "returnToLobby" }
  /** İstemci elindeki snapshot'a yama uygulayamadığında tam snapshot ister. */
  | { type: "resync" }
  /** Sayfa gizlendi/göründü (yalnız bildirim açıkken gönderilir). Sunucu yalnız gizli oyunculara bildirim yollar. */
  | { type: "visibility"; hidden: boolean }
  /** Web bildirimi aboneliğini bu oyuncunun oturumuna bağlar (oda ömrü boyunca bellekte). `p256dh` 65, `auth` 16 bayt (base64url). */
  | { type: "pushSubscribe"; endpoint: string; p256dh: string; auth: string }
  /** Bildirim aboneliğini siler. */
  | { type: "pushUnsubscribe" }
  /** Lobideki hesaplı oyuncu, kabul edilmiş bir arkadaşını odaya çağırır (`invite` olarak ulaşır ya da web bildirimi gider). */
  | { type: "inviteFriend"; username: string }
  /** Arkadaşın şu anki odasına katıl (kod sunucuda çözülür, hiçbir yerde görünmez); yalnız hesaplı ve odasız bağlantı. */
  | { type: "joinFriend"; username: string; nickname: string; avatar?: number }
  /** Maç sonu geri bildirimi: yalnız `final` aşamasında, maç başına oyuncu başına bir kez. */
  | { type: "feedback"; rating: 1 | 2 | 3 | 4 | 5; text?: string }
  /** Anonim oyun başı performans özeti: yalnız `results` aşamasında, oyun başına oyuncu başına bir kez. */
  | ({ type: "perf"; gameId: string } & PerfSample & Partial<PerfMeta>);

/** Bir oyun boyunca istemcide ölçülen gecikme özeti (ms ya da adet; hepsi küçük, negatif olmayan tam sayı). */
export interface PerfSample {
  rttMs: number;
  ackP50: number;
  ackP95: number;
  ackN: number;
  slowTaps: number;
  tapP95: number;
  longTasks: number;
  longTaskMs: number;
}

/** Kaba platform grubu (UA'dan); cihaz modeli ya da sürüm tutulmaz. */
export const PERF_PLATFORMS = ["ios", "android", "diger"] as const;
export type PerfPlatform = (typeof PERF_PLATFORMS)[number];

/** `perf` mesajının isteğe bağlı alanları (eski istemciler göndermez): platform grubu, kopma ve sayfa yenileme sayısı. */
export interface PerfMeta {
  platform: PerfPlatform;
  reconnects: number;
  reloads: number;
}
export const PERF_META_LIMITS = { reconnects: 1_000, reloads: 1_000 } as const;

/** `perf` alanlarının üst sınırları; aşan mesaj geçersizdir. */
export const PERF_LIMITS: Readonly<Record<keyof PerfSample, number>> = {
  rttMs: 60_000,
  ackP50: 60_000,
  ackP95: 60_000,
  ackN: 10_000,
  slowTaps: 10_000,
  tapP95: 60_000,
  longTasks: 10_000,
  longTaskMs: 600_000,
};
export const PERF_KEYS = Object.keys(PERF_LIMITS) as (keyof PerfSample)[];

export const MAX_FEEDBACK_TEXT = 300;

/**
 * JSON Merge Patch (RFC 7386): nesne alanları birleşir, `null` alanı siler,
 * diziler ve ilkel değerler bütün olarak değişir.
 */
export type MergePatch = { [key: string]: unknown };

export type ErrorCode =
  | "invalid_message"
  | "rate_limited"
  | "nickname_invalid"
  | "room_not_found"
  | "room_full"
  | "match_in_progress"
  | "resume_failed"
  | "not_host"
  | "not_in_room"
  | "already_in_room"
  | "invalid_games"
  | "avatar_taken"
  | "nickname_taken"
  | "not_enough_players"
  | "wrong_phase"
  | "not_participant"
  | "game_failed"
  | "draining"
  | "server_busy"
  | "stage_full"
  | "stage_readonly"
  | "login_required"
  | "invite_failed"
  | "friend_not_found";

export type RoomPhase = "lobby" | "briefing" | "countdown" | "playing" | "results" | "final";

export interface PlayerInfo {
  id: string;
  nickname: string;
  /** 0–7, odaya girişte atanır ve odada benzersizdir; avatar rengi/simgesi. */
  avatar: number;
  connected: boolean;
  /** Genel skor. */
  score: number;
  /** Maç sürerken odaya girdi: yalnız izler, puan almaz; maç bitip lobiye dönünce oyuncu olur. */
  spectator: boolean;
}

export interface GameInfo {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  orientation: "portrait" | "landscape";
  /** `false`: rastgele seçime girmez, yalnız elle seçilir. Yoksa havuzdadır. */
  randomPool?: false;
}

export interface MatchSnapshot {
  /** 0 tabanlı oyun sırası ve toplam oyun sayısı. */
  round: number;
  total: number;
  gameId: string;
  gameName: string;
  briefing: { goal: string; steps: string[] };
  orientation: "portrait" | "landscape";
  /** Bu oyunun katılımcıları (maç başında bağlı olanlar). */
  participants: string[];
  /** briefing aşamasında hazır olanlar. */
  readyIds: string[];
  /** results aşamasında "Devam" diyenler (yalnız kimler; herkese açık). */
  continueIds: string[];
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  /** Oyunun herkese açık görünümü (playing/results); odadaki herkes için aynı. */
  publicView: unknown;
  /** Oyunun bu oyuncuya özel görünümü (playing/results); izleyicide izleyici görünümü. */
  view: unknown;
  /** results ve final aşamasında dolu. */
  result: GameResult | null;
}

export interface RoomSnapshot {
  /** Her değişimde artar; istemci eski snapshot'ı yok sayar. */
  rev: number;
  serverNow: number;
  code: string;
  hostId: string;
  selfId: string;
  phase: RoomPhase;
  players: PlayerInfo[];
  /** Host'un seçtiği oyunlar (sıralı). Rastgele modda lobide boştur; maç başında seçilenler gelir. */
  gameIds: string[];
  /** Oyun seçim modu. Yeni oda: rastgele 5. */
  selection: { mode: "manual" } | { mode: "random"; count: number };
  /** Odanın içerik tonu; yeni oda: arkadaş. */
  tone: ContentTone;
  /** Maç sürerken gelenlere ne olur; yeni oda: izleyici. */
  joinPolicy: JoinPolicy;
  /** Odaya bağlı sahne (TV) sayısı; telefonlar "TV'de oynanıyor" rozetini buna göre gösterir. */
  stageCount: number;
  /** Lobide "Hazırım" diyen (host olmayan) oyuncuların kimlikleri; lobi dışında boştur. */
  lobbyReady: string[];
  /** Sunucudaki tüm oyunlar (Oyunlar bölümü için). */
  catalog: GameInfo[];
  match: MatchSnapshot | null;
}

export type LeftReason = "left" | "kicked" | "closed";

export type ServerMessage =
  /** `pushKey`: sunucu web bildirimi gönderebiliyorsa VAPID genel anahtarı (base64url); yoksa alan hiç gelmez. */
  | { type: "welcome"; protocolVersion: number; serverVersion: string; pushKey?: string }
  | { type: "pong"; t: number; serverTime: number }
  | { type: "session"; token: string; playerId: string; roomCode: string }
  /** Sahne bağlantısı kabul edildi (belirteç ve oyuncu kimliği yoktur; yeniden bağlanınca yeniden `joinStage`). */
  | { type: "stage"; roomCode: string }
  | { type: "room"; snapshot: RoomSnapshot }
  /** `baseRev` istemcinin son snapshot'ı ile aynıysa uygulanır; değilse istemci `resync` gönderir. */
  | { type: "patch"; baseRev: number; rev: number; patch: MergePatch }
  | { type: "actionAck"; seq: number; ok: boolean; reason?: string }
  | { type: "left"; reason: LeftReason }
  /** Geçici olay (oda durumunda saklanmaz): lobide `playerId` bir emoji gönderdi. */
  | { type: "reaction"; playerId: string; emoji: LobbyEmoji }
  /** Bir arkadaşının durumu değişti (yalnız kabul edilmiş arkadaşlara gider). */
  | { type: "friendStatus"; username: string; status: FriendStatus }
  /** Sana arkadaşlık isteği geldi. */
  | { type: "friendRequest"; username: string }
  /** Arkadaş listen ya da isteklerin değişti; liste HTTP'den yeniden okunur. */
  | { type: "friendsChanged" }
  /** Bir arkadaşın seni odaya çağırıyor; `expiresAt` sunucu saatiyle ms. */
  | { type: "invite"; from: string; roomCode: string; expiresAt: number }
  /** Gönderdiğin davet arkadaşına ulaştırıldı. */
  | { type: "inviteSent"; username: string }
  /**
   * Maç sonunda yeni rozet(ler) kazandın (yalnız hesaplı oyuncunun canlı bağlantılarına). Eski istemciler bilinmeyen
   * mesajı yok sayar; bu yüzden protokol sürümü artmadı.
   */
  | { type: "badgesEarned"; ids: string[] }
  | { type: "error"; code: ErrorCode; message: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasExactKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(obj);
  return own.length === keys.length && keys.every((k) => own.includes(k));
}

const CONTROL_CHARS = /\p{Cc}/u;
/** Görünmez/yön değiştiren biçim karakterleri (RLO, sıfır genişlik, ZWJ), satır/paragraf ayırıcı, özel kullanım, yetim vekil. */
const FORBIDDEN_CHARS = /[\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cs}]/u;
/** Zalgo benzeri yığılmayı önler: en çok 2 ardışık birleştirici işaret. */
const MARK_STACK = /\p{M}{3,}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const WHITESPACE_RUN = /\s+/gu;
const CODE_PATTERN = /^[A-Z0-9]{5}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Herkes hazır mı: host dışındaki bağlı oyuncuların hepsi hazır ve en az bir kişi var.
 * Başlamak için hazır olmak gerekmez; yalnız Başlat düğmesinin parlamasına bakar.
 */
export function allReady(snap: Pick<RoomSnapshot, "players" | "hostId" | "lobbyReady">): boolean {
  const others = snap.players.filter((p) => p.connected && !p.spectator && p.id !== snap.hostId);
  return others.length > 0 && others.every((p) => snap.lobbyReady.includes(p.id));
}

/** Takma adı temizler (kırp, iç boşlukları tek boşluğa indir). Geçersizse null. */
export function normalizeNickname(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 256 || CONTROL_CHARS.test(value)) return null;
  if (FORBIDDEN_CHARS.test(value)) return null;
  const clean = value.replace(WHITESPACE_RUN, " ").trim();
  if (MARK_STACK.test(clean) || !LETTER_OR_DIGIT.test(clean)) return null;
  const length = Array.from(clean).length;
  if (length < 1 || length > MAX_NICKNAME_LENGTH) return null;
  return clean;
}

/** Karakter sırası: 0..AVATAR_COUNT-1 tam sayı; değilse null. */
function parseAvatar(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= AVATAR_COUNT)
    return null;
  return value;
}

/** Anahtarlar `required` + isteğe bağlı `avatar` olmalıdır. */
function hasKeysWithOptionalAvatar(obj: Record<string, unknown>, required: readonly string[]): boolean {
  const own = Object.keys(obj);
  return required.every((k) => own.includes(k)) && own.every((k) => required.includes(k) || k === "avatar");
}

function parseCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length !== ROOM_CODE_LENGTH) return null;
  const code = value.toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** Geri bildirim metnini temizler: denetim karakterleri atılır, kırpılır. Çok uzunsa ya da metin değilse null. */
export function sanitizeFeedbackText(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_FEEDBACK_TEXT * 4) return null;
  const clean = value
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return Array.from(clean).length > MAX_FEEDBACK_TEXT ? null : clean;
}

/** Ağdan gelen ham metni doğrular; geçersizse null döner. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE_LENGTH) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  switch (data.type) {
    case "hello": {
      if (!hasExactKeys(data, ["type", "clientVersion"])) return null;
      const v = data.clientVersion;
      if (typeof v !== "string" || v.length === 0 || v.length > 64) return null;
      return { type: "hello", clientVersion: v };
    }
    case "ping": {
      if (!hasExactKeys(data, ["type", "t"])) return null;
      const t = data.t;
      if (typeof t !== "number" || !Number.isFinite(t)) return null;
      return { type: "ping", t };
    }
    case "createRoom": {
      if (!hasKeysWithOptionalAvatar(data, ["type", "nickname"])) return null;
      const nickname = normalizeNickname(data.nickname);
      if (nickname === null) return null;
      if (!Object.hasOwn(data, "avatar")) return { type: "createRoom", nickname };
      const avatar = parseAvatar(data.avatar);
      return avatar === null ? null : { type: "createRoom", nickname, avatar };
    }
    case "joinRoom": {
      if (!hasKeysWithOptionalAvatar(data, ["type", "code", "nickname"])) return null;
      const code = parseCode(data.code);
      const nickname = normalizeNickname(data.nickname);
      if (code === null || nickname === null) return null;
      if (!Object.hasOwn(data, "avatar")) return { type: "joinRoom", code, nickname };
      const avatar = parseAvatar(data.avatar);
      return avatar === null ? null : { type: "joinRoom", code, nickname, avatar };
    }
    case "joinStage": {
      if (!hasExactKeys(data, ["type", "code"])) return null;
      const code = parseCode(data.code);
      return code === null ? null : { type: "joinStage", code };
    }
    case "chooseAvatar": {
      if (!hasExactKeys(data, ["type", "avatar"])) return null;
      const avatar = parseAvatar(data.avatar);
      return avatar === null ? null : { type: "chooseAvatar", avatar };
    }
    case "rename": {
      if (!hasExactKeys(data, ["type", "nickname"])) return null;
      const nickname = normalizeNickname(data.nickname);
      return nickname === null ? null : { type: "rename", nickname };
    }
    case "react": {
      if (!hasExactKeys(data, ["type", "emoji"])) return null;
      return isLobbyEmoji(data.emoji) ? { type: "react", emoji: data.emoji } : null;
    }
    case "setReady": {
      if (!hasExactKeys(data, ["type", "ready"])) return null;
      return typeof data.ready === "boolean" ? { type: "setReady", ready: data.ready } : null;
    }
    case "transferHost": {
      if (!hasExactKeys(data, ["type", "playerId"])) return null;
      const id = data.playerId;
      if (typeof id !== "string" || id.length === 0 || id.length > 64) return null;
      return { type: "transferHost", playerId: id };
    }
    case "resume": {
      if (!hasExactKeys(data, ["type", "token"])) return null;
      const token = data.token;
      if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
      return { type: "resume", token };
    }
    case "kick": {
      if (!hasExactKeys(data, ["type", "playerId"])) return null;
      const id = data.playerId;
      if (typeof id !== "string" || id.length === 0 || id.length > 64) return null;
      return { type: "kick", playerId: id };
    }
    case "setGames": {
      if (!hasExactKeys(data, ["type", "gameIds"])) return null;
      const ids = data.gameIds;
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_SELECTED_GAMES) return null;
      const out: string[] = [];
      for (const id of ids) {
        if (typeof id !== "string" || id.length === 0 || id.length > 64 || out.includes(id)) return null;
        out.push(id);
      }
      return { type: "setGames", gameIds: out };
    }
    case "setRandom": {
      if (!hasExactKeys(data, ["type", "count"])) return null;
      const count = data.count;
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1 || count > 64) return null;
      return { type: "setRandom", count };
    }
    case "setJoinPolicy": {
      if (!hasExactKeys(data, ["type", "policy"])) return null;
      return isJoinPolicy(data.policy) ? { type: "setJoinPolicy", policy: data.policy } : null;
    }
    case "setTone": {
      if (!hasExactKeys(data, ["type", "tone"])) return null;
      return isContentTone(data.tone) ? { type: "setTone", tone: data.tone } : null;
    }
    case "action": {
      if (!hasExactKeys(data, ["type", "seq", "payload"])) return null;
      const seq = data.seq;
      if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) return null;
      return { type: "action", seq, payload: data.payload };
    }
    case "feedback": {
      const keys = Object.keys(data);
      if (!keys.every((k) => k === "type" || k === "rating" || k === "text")) return null;
      const rating = data.rating;
      if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) return null;
      if (!Object.hasOwn(data, "text")) return { type: "feedback", rating: rating as 1 | 2 | 3 | 4 | 5 };
      const text = sanitizeFeedbackText(data.text);
      if (text === null) return null;
      const r = rating as 1 | 2 | 3 | 4 | 5;
      return text === "" ? { type: "feedback", rating: r } : { type: "feedback", rating: r, text };
    }
    case "perf": {
      const allowed = ["type", "gameId", ...PERF_KEYS, "platform", "reconnects", "reloads"];
      const own = Object.keys(data);
      if (
        !own.every((k) => allowed.includes(k)) ||
        !["type", "gameId", ...PERF_KEYS].every((k) => own.includes(k))
      )
        return null;
      const gameId = data.gameId;
      if (typeof gameId !== "string" || gameId.length === 0 || gameId.length > 64) return null;
      const sample = {} as PerfSample;
      for (const key of PERF_KEYS) {
        const v = data[key];
        if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0 || v > PERF_LIMITS[key]) return null;
        sample[key] = v;
      }
      const meta: Partial<PerfMeta> = {};
      if (Object.hasOwn(data, "platform")) {
        const pl = data.platform;
        if (!PERF_PLATFORMS.some((x) => x === pl)) return null;
        meta.platform = pl as PerfPlatform;
      }
      for (const key of ["reconnects", "reloads"] as const) {
        if (!Object.hasOwn(data, key)) continue;
        const v = data[key];
        if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0 || v > PERF_META_LIMITS[key])
          return null;
        meta[key] = v;
      }
      return { type: "perf", gameId, ...sample, ...meta };
    }
    case "visibility": {
      if (!hasExactKeys(data, ["type", "hidden"])) return null;
      return typeof data.hidden === "boolean" ? { type: "visibility", hidden: data.hidden } : null;
    }
    case "pushSubscribe": {
      if (!hasExactKeys(data, ["type", "endpoint", "p256dh", "auth"])) return null;
      const { endpoint, p256dh, auth } = data;
      if (!isPushEndpoint(endpoint)) return null;
      if (!isBase64urlOfLength(p256dh, PUSH_P256DH_LENGTH) || !isBase64urlOfLength(auth, PUSH_AUTH_LENGTH))
        return null;
      return { type: "pushSubscribe", endpoint, p256dh, auth };
    }
    case "inviteFriend": {
      if (!hasExactKeys(data, ["type", "username"])) return null;
      const username = data.username;
      return typeof username === "string" && USERNAME_PATTERN.test(username)
        ? { type: "inviteFriend", username }
        : null;
    }
    case "joinFriend": {
      if (!hasKeysWithOptionalAvatar(data, ["type", "username", "nickname"])) return null;
      const username = data.username;
      const nickname = normalizeNickname(data.nickname);
      if (typeof username !== "string" || !USERNAME_PATTERN.test(username) || nickname === null) return null;
      if (!Object.hasOwn(data, "avatar")) return { type: "joinFriend", username, nickname };
      const avatar = parseAvatar(data.avatar);
      return avatar === null ? null : { type: "joinFriend", username, nickname, avatar };
    }
    case "pushUnsubscribe":
    case "leaveRoom":
    case "resync":
    case "startMatch":
    case "ready":
    case "continue":
    case "returnToLobby": {
      if (!hasExactKeys(data, ["type"])) return null;
      return { type: data.type };
    }
    default:
      return null;
  }
}
