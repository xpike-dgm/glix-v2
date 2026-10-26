import type { PlayerInfo, RoomSnapshot } from "@glix/engine";
import { createStore, reconcile, unwrap } from "solid-js/store";
import { hapticError } from "../fx/haptics.js";
import { fail } from "../fx/sound.js";
import { median, pushSample } from "./clock.js";
import { KEYS, readStored, writeStored } from "./storage.js";
import { initialSync, onPatch, onReconnect, onRoom, type SyncState, type SyncStep } from "./sync.js";

/** `idle`: sunucu odasız boştaki bağlantıyı kapattı; ilk eylemde sessizce yeniden açılır. */
export type ConnStatus = "connecting" | "open" | "closed" | "idle";
export type Nav = "home" | "join" | "settings";
export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

export interface Session {
  token: string;
  playerId: string;
  roomCode: string;
}

interface AppState {
  conn: ConnStatus;
  everOpen: boolean;
  failedAttempts: number;
  session: Session | null;
  snapshot: RoomSnapshot | null;
  clockSamples: number[];
  clockOffset: number;
  toasts: Toast[];
  nav: Nav;
  joinCode: string;
  nickname: string;
  /** Oda kodu bulunamadığında dolu. */
  notFoundCode: string | null;
  /** Oda kur/katıl isteği sonucu bekleniyor. */
  busy: boolean;
  /** Katıl ekranındaki kutuları titretmek için artan sayaç. */
  joinShake: number;
}

export const [state, setState] = createStore<AppState>({
  conn: "connecting",
  everOpen: false,
  failedAttempts: 0,
  session: null,
  snapshot: null,
  clockSamples: [],
  clockOffset: 0,
  toasts: [],
  nav: "home",
  joinCode: "",
  nickname: readStored(KEYS.nickname) ?? "",
  notFoundCode: null,
  busy: false,
  joinShake: 0,
});

/** Sunucu saati (ms), ping/pong ölçümünün medyanıyla. */
export function serverNow(): number {
  return Date.now() + state.clockOffset;
}

export function addClockSample(offset: number): void {
  const samples = pushSample(state.clockSamples, offset);
  setState({ clockSamples: samples, clockOffset: median(samples) });
}

let sync: SyncState = initialSync;

function commit(step: SyncStep): SyncStep {
  sync = step.state;
  if (step.accepted) setState("snapshot", reconcile(step.accepted, { key: "id" }));
  return step;
}

/** Elimizdeki snapshot ile senkron durumunu hizalar (oda temizlenince ya da dışarıdan yazılınca). */
function currentSync(): SyncState {
  const raw = state.snapshot ? unwrap(state.snapshot) : null;
  if (sync.snapshot !== raw) sync = { snapshot: raw, awaitingFull: sync.awaitingFull };
  return sync;
}

/** Tam `room` mesajı. Kabul edildiyse true. */
export function applySnapshot(snapshot: RoomSnapshot): boolean {
  return commit(onRoom(currentSync(), snapshot)).accepted !== null;
}

/** `patch` mesajı. Dönen değer true ise çağıran sunucuya `resync` göndermelidir. */
export function applyPatchMessage(msg: Parameters<typeof onPatch>[1]): boolean {
  return commit(onPatch(currentSync(), msg)).sendResync;
}

/** Yeni soket açıldı. */
export function syncReconnected(): void {
  sync = onReconnect(currentSync());
}

let toastId = 0;
export function toast(text: string, kind: ToastKind = "info"): void {
  const id = ++toastId;
  if (kind === "error") {
    fail();
    hapticError();
  }
  setState("toasts", (t) => [...t.slice(-2), { id, text, kind }]);
  setTimeout(() => setState("toasts", (t) => t.filter((x) => x.id !== id)), 2500);
}

export function setNickname(name: string): void {
  const clean = name.trim().slice(0, 16);
  setState("nickname", clean);
  writeStored(KEYS.nickname, clean);
}

export function goHome(): void {
  setState({ nav: "home", joinCode: "", notFoundCode: null, busy: false });
}

export function clearRoom(): void {
  sync = initialSync;
  setState({ session: null, snapshot: null, busy: false });
}

export const selfPlayer = (): PlayerInfo | undefined => {
  const s = state.snapshot;
  return s?.players.find((p) => p.id === s.selfId);
};
export const isHost = (): boolean => !!state.snapshot && state.snapshot.hostId === state.snapshot.selfId;
export const playerById = (id: string): PlayerInfo | undefined =>
  state.snapshot?.players.find((p) => p.id === id);
