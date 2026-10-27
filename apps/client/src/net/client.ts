import {
  APP_VERSION,
  type ClientMessage,
  type ContentTone,
  type JoinPolicy,
  type LobbyEmoji,
  type RoomSnapshot,
} from "@glix/engine";
import { noteServerRestart } from "../pwa/pwa.js";
import { CLIENT_PROTOCOL_VERSION, isProtocolMismatch } from "../pwa/updatePolicy.js";
import { notifyOn } from "../settings/settings.js";
import { installPerfObservers, perf, trackPerf } from "../telemetry/perf.js";
import { resolveWsUrl } from "../wsUrl.js";
import { receiveBadges } from "./badges.js";
import { offsetFromPong } from "./clock.js";
import {
  dropInvitesFor,
  loadFriends,
  onFriendRequest,
  onFriendStatus,
  onFriendsChanged,
  receiveInvite,
} from "./friends.js";
import { parseServerMessage } from "./parse.js";
import { emitReaction } from "./reactions.js";
import { decideOnReturn, PROBE_TIMEOUT_MS, reconnectNotice } from "./resume.js";
import { KEYS, readAvatarChoice, readStored, removeStored, writeStored } from "./storage.js";
import {
  addClockSample,
  applyPatchMessage,
  applySnapshot,
  clearRoom,
  goHome,
  setState,
  state,
  syncReconnected,
  toast,
} from "./store.js";

const BACKOFF_MS = [500, 1000, 2000, 4000, 5000];
const PING_EVERY_MS = 5000;
const SILENCE_LIMIT_MS = 13_000;

/** Bu hata kodlarında sunucunun Türkçe mesajı oyuncuya gösterilir. */
const SHOWN_ERRORS = new Set([
  "nickname_invalid",
  "room_full",
  "match_in_progress",
  "already_in_room",
  "not_enough_players",
  "invalid_games",
  "avatar_taken",
  "nickname_taken",
  "draining",
  "server_busy",
  "game_failed",
  "stage_full",
  "friend_not_found",
  "invite_failed",
]);

/** Sunucu güncelleme için yeniden başladı (WebSocket kapanış kodu 1012). */
const SERVICE_RESTART = 1012;
/** Sunucu odaya girmeyen boştaki bağlantıyı kapattı (WebSocket kapanış kodu 4000). */
const IDLE_CLOSE = 4000;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let attempt = 0;
let stopped = true;
let lastHeard = 0;
let seq = 0;
let pending: ClientMessage | null = null;
let restartedByServer = false;
let hiddenAt: number | null = null;
let probeTimer: ReturnType<typeof setTimeout> | undefined;
/** Maç sırasında yeniden bağlanıldı: ilk taze oda görünümü gelince "Tekrar bağlandın" gösterilir. */
let announceReturn = false;
/** İlk `welcome`deki sunucu sürümü; sonraki bağlanmada değiştiyse deploy olmuştur. */
let knownServerVersion: string | null = null;
/** Sahne (TV) kipi: oturum anahtarı kullanılmaz; her bağlanışta `joinStage` ile odaya girilir. */
let stageCode: string | null = null;
let mockSender: ((msg: ClientMessage) => void) | null = null;
/** Oturum (odaya giriş ya da yeniden bağlanma) kabul edilince çağrılır; bildirim aboneliğini yeniden bağlar. */
let sessionHook: (() => void) | null = null;
/** Son arkadaş daveti gönderme anı; davet hız sınırı hatasının yalnız kullanıcıya bağlı olanı gösterilir. */
let lastInviteAt = Number.NEGATIVE_INFINITY;

export function setSessionHook(fn: () => void): void {
  sessionHook = fn;
}

/** Geliştirme önizlemesi: mesajlar sahte sunucuya gider. */
export function useMockSender(fn: (msg: ClientMessage) => void): void {
  mockSender = fn;
}

function rawSend(msg: ClientMessage): boolean {
  if (mockSender) {
    mockSender(msg);
    return true;
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

function sendPing(): void {
  rawSend({ type: "ping", t: Date.now() });
}

function startPings(): void {
  clearInterval(pingTimer);
  sendPing();
  setTimeout(sendPing, 250);
  setTimeout(sendPing, 600);
  pingTimer = setInterval(() => {
    if (Date.now() - lastHeard > SILENCE_LIMIT_MS) {
      ws?.close();
      return;
    }
    sendPing();
  }, PING_EVERY_MS);
}

function flushPending(): void {
  if (pending && rawSend(pending)) pending = null;
}

function onMessage(raw: string): void {
  lastHeard = Date.now();
  const msg = parseServerMessage(raw);
  if (!msg) return;
  switch (msg.type) {
    case "welcome": {
      const redeployed =
        restartedByServer || (knownServerVersion !== null && knownServerVersion !== msg.serverVersion);
      knownServerVersion = msg.serverVersion;
      setState({ serverProtocol: msg.protocolVersion, pushKey: msg.pushKey ?? null });
      if (isProtocolMismatch(msg.protocolVersion, CLIENT_PROTOCOL_VERSION)) {
        // Sunucu başka bir protokol konuşuyor: oda kurma/katılma/devam yok; "Güncelleme gerekli" ekranı çıkar.
        blockForUpdate();
        noteServerRestart();
        break;
      }
      if (redeployed) noteServerRestart();
      attempt = 0;
      announceReturn = state.everOpen && reconnectNotice(state.snapshot) !== null;
      if (state.everOpen) perf.reconnect();
      syncReconnected();
      setState({ conn: "open", everOpen: true, failedAttempts: 0 });
      startPings();
      if (state.tv) {
        // TV hiçbir zaman oyuncu oturumunu sürdürmez (aynı tarayıcıdaki oyuncu belirtecine dokunmaz).
        restartedByServer = false;
        pending = null;
        if (stageCode) rawSend({ type: "joinStage", code: stageCode });
        break;
      }
      if (state.account) {
        // Hesaplı bağlantı: arkadaş listesi (rozet) tazelenir, bildirim aboneliği hesaba bağlanır.
        void loadFriends();
        sessionHook?.();
      }
      const token = readStored(KEYS.token);
      if (token) rawSend({ type: "resume", token });
      else {
        restartedByServer = false;
        flushPending();
      }
      break;
    }
    case "pong":
      addClockSample(offsetFromPong(msg.t, Date.now(), msg.serverTime));
      perf.addRtt(Date.now() - msg.t);
      break;
    case "session":
      restartedByServer = false;
      writeStored(KEYS.token, msg.token);
      if (state.snapshot && state.snapshot.code !== msg.roomCode) setState("snapshot", null);
      setState({
        session: { token: msg.token, playerId: msg.playerId, roomCode: msg.roomCode },
        busy: false,
      });
      dropInvitesFor(msg.roomCode);
      sessionHook?.();
      reportVisibility();
      break;
    case "stage":
      restartedByServer = false;
      setState({ stage: { roomCode: msg.roomCode }, busy: false, notFoundCode: null });
      break;
    case "room":
      applySnapshot(msg.snapshot);
      if (state.snapshot) trackPerf(state.snapshot, rawSend);
      setState({ busy: false, notFoundCode: null });
      pending = null;
      if (announceReturn) {
        announceReturn = false;
        const notice = reconnectNotice(state.snapshot);
        if (notice) toast(notice);
      }
      break;
    case "patch":
      if (applyPatchMessage(msg)) rawSend({ type: "resync" });
      else if (state.snapshot) trackPerf(state.snapshot, rawSend);
      break;
    case "actionAck":
      perf.actionAcked(msg.seq);
      settleAck(msg.seq, msg.reason === undefined ? { ok: msg.ok } : { ok: msg.ok, reason: msg.reason });
      break;
    case "left":
      announceReturn = false;
      if (state.tv) {
        stageCode = null;
        clearRoom();
        if (msg.reason === "closed") toast("Oda kapandı");
        break;
      }
      removeStored(KEYS.token);
      clearRoom();
      goHome();
      if (msg.reason === "kicked") toast("Ev sahibi seni odadan çıkardı", "error");
      else if (msg.reason === "closed") toast("Oda kapandı");
      break;
    case "reaction":
      emitReaction(msg.playerId, msg.emoji);
      break;
    case "friendStatus":
      onFriendStatus(msg.username, msg.status);
      break;
    case "friendRequest":
      onFriendRequest(msg.username);
      break;
    case "friendsChanged":
      onFriendsChanged();
      break;
    case "badgesEarned":
      void receiveBadges(msg.ids);
      break;
    case "invite":
      receiveInvite({ from: msg.from, roomCode: msg.roomCode, expiresAt: msg.expiresAt });
      break;
    case "inviteSent":
      toast("Davet gönderildi", "success");
      break;
    case "error":
      handleError(msg.code, msg.message);
      break;
  }
}

/** Uyumsuz sürüm: bağlantıyı bırakır, bekleyen isteği atar, yeniden bağlanmayı durdurur. */
function blockForUpdate(): void {
  stopped = true;
  pending = null;
  clearTimeout(reconnectTimer);
  clearTimeout(probeTimer);
  clearInterval(pingTimer);
  const old = ws;
  ws = null;
  setState({ conn: "open", busy: false });
  try {
    old?.close();
  } catch {
    // zaten kapalı
  }
}

function handleError(code: string, message: string): void {
  if (state.tv && (code === "room_not_found" || code === "stage_full")) {
    // TV: kod yanlış ya da oda kapanmış; kod giriş ekranına dönülür.
    stageCode = null;
    pending = null;
    clearRoom();
    setState({ notFoundCode: code === "room_not_found" ? state.joinCode || "?" : null, busy: false });
    if (code === "stage_full") toast(message, "error");
    return;
  }
  if (code === "resume_failed") {
    announceReturn = false;
    removeStored(KEYS.token);
    clearRoom();
    goHome();
    if (restartedByServer) toast("Oyun güncellendi, yeni oda kurabilirsin.");
    else toast("Bu oda artık yok. Yeni bir oda kurabilirsin.");
    restartedByServer = false;
    flushPending();
    return;
  }
  pending = null;
  setState("busy", false);
  if (code === "room_not_found") {
    setState({ notFoundCode: state.joinCode || "?", joinShake: state.joinShake + 1 });
    return;
  }
  if (code === "login_required") {
    // Oturum bu arada düşmüş olabilir: hesap bilgisi temizlenir, giriş ekranı açılır.
    setState({ account: null, nav: "login" });
    toast(message, "error");
    return;
  }
  if (code === "rate_limited" && Date.now() - lastInviteAt < 3000) {
    toast("Bu arkadaşını biraz önce çağırdın, birazdan tekrar dene.", "error");
    return;
  }
  if (SHOWN_ERRORS.has(code)) toast(message, "error");
}

function open(): void {
  if (stopped) return;
  clearTimeout(reconnectTimer);
  setState("conn", "connecting");
  const url = resolveWsUrl(window.location, import.meta.env.VITE_WS_URL, import.meta.env.DEV);
  let sock: WebSocket;
  try {
    sock = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }
  ws = sock;
  lastHeard = Date.now();
  sock.onopen = () => rawSend({ type: "hello", clientVersion: APP_VERSION });
  sock.onmessage = (ev) => onMessage(String(ev.data));
  sock.onclose = (ev) => {
    if (ws !== sock) return;
    if (ev.code === SERVICE_RESTART) restartedByServer = true;
    clearInterval(pingTimer);
    ws = null;
    if (stopped) return;
    if (ev.code === IDLE_CLOSE) {
      // Menüde beklerken: uyarı gösterme, ilk eylemde ya da sekme öne gelince yeniden bağlan.
      clearTimeout(reconnectTimer);
      setState({ conn: "idle" });
      return;
    }
    setState({ conn: "closed", failedAttempts: state.failedAttempts + 1 });
    scheduleReconnect();
  };
  sock.onerror = () => sock.close();
}

function scheduleReconnect(): void {
  const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 5000;
  attempt += 1;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(open, delay);
}

/** Soketi bırakıp backoff beklemeden hemen yeniden bağlanır (eski soketin kapanışı yok sayılır). */
function reconnectNow(): void {
  clearTimeout(probeTimer);
  clearTimeout(reconnectTimer);
  clearInterval(pingTimer);
  const old = ws;
  ws = null;
  if (old) {
    old.onclose = null;
    old.onmessage = null;
    old.onerror = null;
    try {
      old.close();
    } catch {
      // zaten kapalı
    }
  }
  attempt = 0;
  open();
}

/** Giriş/çıkış sonrası: yeni çerezin WS yükseltmesinde okunması için soketi hemen yeniler. */
export function reconnectForAccount(): void {
  if (stopped || state.tv) return;
  reconnectNow();
}

/** Sekme öne geldi ya da bfcache'ten döndü: soketi denetle, gerekirse beklemeden yeniden bağlan. */
function onReturn(restored: boolean): void {
  if (stopped) return;
  const hiddenMs = hiddenAt === null ? 0 : Date.now() - hiddenAt;
  hiddenAt = null;
  const action = decideOnReturn({ readyState: ws ? ws.readyState : null, hiddenMs, restored });
  if (action === "reconnect") {
    reconnectNow();
  } else if (action === "ping") {
    sendPing();
  } else if (action === "probe") {
    // Soket "açık" görünse de ölü olabilir: ping at, kısa sürede ses çıkmazsa at ve yeniden bağlan.
    const since = Date.now();
    const sock = ws;
    sendPing();
    clearTimeout(probeTimer);
    probeTimer = setTimeout(() => {
      if (ws === sock && lastHeard < since) reconnectNow();
    }, PROBE_TIMEOUT_MS);
  }
}

/** Sayfa durumunu sunucuya bildirir; yalnız oyuncu bildirimi açmışsa ve odadaysa (başka veri gitmez). */
function reportVisibility(): void {
  if (!state.session || state.tv || !notifyOn()) return;
  rawSend({ type: "visibility", hidden: document.visibilityState === "hidden" });
}

function onVisibility(): void {
  reportVisibility();
  if (document.visibilityState === "hidden") {
    hiddenAt = Date.now();
    return;
  }
  onReturn(false);
}

function onPageShow(ev: PageTransitionEvent): void {
  if (ev.persisted) onReturn(true);
}

function onOnline(): void {
  if (stopped || (ws && ws.readyState !== WebSocket.CLOSED)) return;
  attempt = 0;
  open();
}

/** Bağlantıyı başlatır; durdurma işlevi döner. */
export function startNet(): () => void {
  stopped = false;
  attempt = 0;
  installPerfObservers();
  open();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("online", onOnline);
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("online", onOnline);
    clearTimeout(reconnectTimer);
    clearTimeout(probeTimer);
    clearInterval(pingTimer);
    ws?.close();
    ws = null;
  };
}

/** Bağlantı hazırsa gönderir; değilse açılınca gönderilmek üzere bekletir. */
function intent(msg: ClientMessage): void {
  if (isProtocolMismatch(state.serverProtocol, CLIENT_PROTOCOL_VERSION)) return;
  setState("busy", true);
  pending = msg;
  if (state.conn === "idle" && !ws) {
    attempt = 0;
    open();
    return;
  }
  flushPending();
}

export function createRoom(nickname: string): void {
  setState("notFoundCode", null);
  const avatar = readAvatarChoice();
  intent(avatar === undefined ? { type: "createRoom", nickname } : { type: "createRoom", nickname, avatar });
}

export function joinRoom(code: string, nickname: string): void {
  setState({ notFoundCode: null, joinCode: code });
  const avatar = readAvatarChoice();
  intent(
    avatar === undefined
      ? { type: "joinRoom", code, nickname }
      : { type: "joinRoom", code, nickname, avatar },
  );
}

/** Arkadaşın şu anki odasına katıl: oda kodu sunucuda çözülür, istemci hiç görmez. */
export function joinFriend(username: string, nickname: string): void {
  setState("notFoundCode", null);
  const avatar = readAvatarChoice();
  intent(
    avatar === undefined
      ? { type: "joinFriend", username, nickname }
      : { type: "joinFriend", username, nickname, avatar },
  );
}

/** Lobideyken arkadaşı odaya çağırır. */
export function inviteFriend(username: string): boolean {
  lastInviteAt = Date.now();
  return rawSend({ type: "inviteFriend", username });
}

/** Bu cihazı büyük ekran (sahne) yapar: `/tv` sayfası açılınca bir kez çağrılır. */
export function enterTvMode(): void {
  setState("tv", true);
}

/** Sahne olarak odaya bağlanır (koltuk tutmaz). Bağlantı koparsa aynı kodla yeniden girilir. */
export function joinStage(code: string): void {
  setState({ notFoundCode: null, joinCode: code });
  stageCode = code;
  intent({ type: "joinStage", code });
}

/** Sahneden çıkar; kod giriş ekranına dönülür. */
export function leaveStage(): void {
  rawSend({ type: "leaveRoom" });
  stageCode = null;
  clearRoom();
  setState({ joinCode: "", notFoundCode: null });
}

export function leaveRoom(): void {
  rawSend({ type: "leaveRoom" });
  removeStored(KEYS.token);
  clearRoom();
  goHome();
}

export const sendPushSubscribe = (sub: { endpoint: string; p256dh: string; auth: string }): boolean =>
  rawSend({ type: "pushSubscribe", ...sub });
export const sendPushUnsubscribe = (): boolean => rawSend({ type: "pushUnsubscribe" });
export const kick = (playerId: string): boolean => rawSend({ type: "kick", playerId });
export const setRandom = (count: number): boolean => rawSend({ type: "setRandom", count });
export const setJoinPolicy = (policy: JoinPolicy): boolean => rawSend({ type: "setJoinPolicy", policy });
export const setTone = (tone: ContentTone): boolean => rawSend({ type: "setTone", tone });
export const setGames = (gameIds: string[]): boolean => rawSend({ type: "setGames", gameIds });
/**
 * Lobide karakter seç. Seçim cihazda hatırlanır. Yanıt sunucu görünümüyle gelir; çakışmada sunucu
 * `avatar_taken` hatası yollar (oyuncuya Türkçe uyarı gösterilir) ve iyimser değer geri alınır.
 */
export function chooseAvatar(avatar: number): Promise<ActionAck> {
  writeStored(KEYS.avatar, String(avatar));
  return Promise.resolve(
    rawSend({ type: "chooseAvatar", avatar }) ? { ok: true } : { ok: false, reason: "offline" },
  );
}
export const transferHost = (playerId: string): boolean => rawSend({ type: "transferHost", playerId });
export const setLobbyReady = (ready: boolean): boolean => rawSend({ type: "setReady", ready });
export const sendReaction = (emoji: LobbyEmoji): boolean => rawSend({ type: "react", emoji });
export const renameSelf = (nickname: string): boolean => rawSend({ type: "rename", nickname });
export const startMatch = (): boolean => rawSend({ type: "startMatch" });
export const sendReady = (): boolean => rawSend({ type: "ready" });
export const sendContinue = (): boolean => rawSend({ type: "continue" });
export const returnToLobby = (): boolean => rawSend({ type: "returnToLobby" });
export const sendFeedback = (rating: number, text: string): boolean => {
  const clean = text.trim();
  const base = { type: "feedback", rating } as { type: "feedback"; rating: 1 | 2 | 3 | 4 | 5; text?: string };
  if (clean) base.text = clean;
  return rawSend(base);
};
export const sendAction = (payload: unknown): boolean => {
  const id = ++seq;
  const sent = rawSend({ type: "action", seq: id, payload });
  if (sent && !mockSender) perf.actionSent(id);
  return sent;
};

/** Sunucunun bir eyleme verdiği yanıt: reddedildiyse nedeni (kısa kod) de gelir. */
export interface ActionAck {
  ok: boolean;
  reason?: string;
}
const ACK_TIMEOUT_MS = 4000;
const ackWaiters = new Map<number, (ack: ActionAck) => void>();

function settleAck(ackSeq: number, ack: ActionAck): void {
  const waiter = ackWaiters.get(ackSeq);
  if (!waiter) return;
  ackWaiters.delete(ackSeq);
  waiter(ack);
}

/**
 * Eylemi gönderir ve sunucunun yanıtını bekler (ör. metin girişinde reddedilme nedenini göstermek için).
 * Gönderilemezse `offline`, yanıt gelmezse `timeout` nedeniyle `ok: false` döner.
 */
export function sendActionAck(payload: unknown): Promise<ActionAck> {
  const id = seq + 1;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ackWaiters.delete(id);
      resolve({ ok: false, reason: "timeout" });
    }, ACK_TIMEOUT_MS);
    ackWaiters.set(id, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
    if (!sendAction(payload)) {
      clearTimeout(timer);
      ackWaiters.delete(id);
      resolve({ ok: false, reason: "offline" });
    }
  });
}

/** Yalnız geliştirme önizlemesi: sahte gönderici bir eyleme yanıt verir. */
export const mockAck = (ackSeq: number, ack: ActionAck): void => settleAck(ackSeq, ack);

export type { RoomSnapshot };
