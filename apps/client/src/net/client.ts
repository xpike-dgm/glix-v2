import { APP_VERSION, type ClientMessage, type RoomSnapshot } from "@glix/engine";
import { resolveWsUrl } from "../wsUrl.js";
import { offsetFromPong } from "./clock.js";
import { parseServerMessage } from "./parse.js";
import { KEYS, readStored, removeStored, writeStored } from "./storage.js";
import { addClockSample, applySnapshot, clearRoom, goHome, setState, state, toast } from "./store.js";

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
]);

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let attempt = 0;
let stopped = true;
let lastHeard = 0;
let seq = 0;
let pending: ClientMessage | null = null;
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
      setState({ conn: "open", everOpen: true, failedAttempts: 0 });
      startPings();
      const token = readStored(KEYS.token);
      if (token) rawSend({ type: "resume", token });
      else flushPending();
      break;
    }
    case "pong":
      addClockSample(offsetFromPong(msg.t, Date.now(), msg.serverTime));
      break;
    case "session":
      writeStored(KEYS.token, msg.token);
      if (state.snapshot && state.snapshot.code !== msg.roomCode) setState("snapshot", null);
      setState({
        session: { token: msg.token, playerId: msg.playerId, roomCode: msg.roomCode },
        busy: false,
      });
      break;
    case "room":
      applySnapshot(msg.snapshot);
      setState({ busy: false, notFoundCode: null });
      pending = null;
      break;
    case "actionAck":
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
    toast("Bu oda artık yok. Yeni bir oda kurabilirsin.");
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
  sock.onclose = () => {
    if (ws !== sock) return;
    clearInterval(pingTimer);
    ws = null;
    if (stopped) return;
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

/** Bağlantıyı başlatır; durdurma işlevi döner. */
export function startNet(): () => void {
  stopped = false;
  attempt = 0;
  open();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisible);
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
export const setGames = (gameIds: string[]): boolean => rawSend({ type: "setGames", gameIds });
export const startMatch = (): boolean => rawSend({ type: "startMatch" });
export const sendReady = (): boolean => rawSend({ type: "ready" });
export const returnToLobby = (): boolean => rawSend({ type: "returnToLobby" });
export const sendAction = (payload: unknown): boolean => rawSend({ type: "action", seq: ++seq, payload });

export type { RoomSnapshot };
