import { APP_VERSION, type ClientMessage, type RoomSnapshot } from "@glix/engine";
import { installPerfObservers, perf, trackPerf } from "../telemetry/perf.js";
import { resolveWsUrl } from "../wsUrl.js";
import { offsetFromPong } from "./clock.js";
import { parseServerMessage } from "./parse.js";
import { KEYS, readStored, removeStored, writeStored } from "./storage.js";
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
  "draining",
  "server_busy",
  "game_failed",
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
let mockSender: ((msg: ClientMessage) => void) | null = null;

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
      attempt = 0;
      syncReconnected();
      setState({ conn: "open", everOpen: true, failedAttempts: 0 });
      startPings();
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
      break;
    case "room":
      applySnapshot(msg.snapshot);
      if (state.snapshot) trackPerf(state.snapshot, rawSend);
      setState({ busy: false, notFoundCode: null });
      pending = null;
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
      removeStored(KEYS.token);
      clearRoom();
      goHome();
      if (msg.reason === "kicked") toast("Odadan çıkarıldın", "error");
      else if (msg.reason === "closed") toast("Oda kapandı");
      break;
    case "error":
      handleError(msg.code, msg.message);
      break;
  }
}

function handleError(code: string, message: string): void {
  if (code === "resume_failed") {
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

function onVisible(): void {
  if (document.visibilityState !== "visible" || stopped) return;
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    attempt = 0;
    open();
  } else if (ws.readyState === WebSocket.OPEN) {
    sendPing();
  }
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
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onOnline);
    clearTimeout(reconnectTimer);
    clearInterval(pingTimer);
    ws?.close();
    ws = null;
  };
}

/** Bağlantı hazırsa gönderir; değilse açılınca gönderilmek üzere bekletir. */
function intent(msg: ClientMessage): void {
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
  intent({ type: "createRoom", nickname });
}

export function joinRoom(code: string, nickname: string): void {
  setState({ notFoundCode: null, joinCode: code });
  intent({ type: "joinRoom", code, nickname });
}

export function leaveRoom(): void {
  rawSend({ type: "leaveRoom" });
  removeStored(KEYS.token);
  clearRoom();
  goHome();
}

export const kick = (playerId: string): boolean => rawSend({ type: "kick", playerId });
export const setRandom = (count: number): boolean => rawSend({ type: "setRandom", count });
export const setGames = (gameIds: string[]): boolean => rawSend({ type: "setGames", gameIds });
export const startMatch = (): boolean => rawSend({ type: "startMatch" });
export const sendReady = (): boolean => rawSend({ type: "ready" });
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
