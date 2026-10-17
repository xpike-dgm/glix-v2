import type { PlayerInfo, RoomSnapshot } from "@glix/engine";
import { createStore, reconcile } from "solid-js/store";
import { median, pushSample } from "./clock.js";
import { shouldAccept } from "./snapshot.js";
import { KEYS, readStored, writeStored } from "./storage.js";

export type ConnStatus = "connecting" | "open" | "closed";
export type Nav = "home" | "join";
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

export function applySnapshot(snapshot: RoomSnapshot): boolean {
  if (!shouldAccept(state.snapshot, snapshot)) return false;
  setState("snapshot", reconcile(snapshot, { key: "id" }));
  return true;
}

let toastId = 0;
export function toast(text: string, kind: ToastKind = "info"): void {
  const id = ++toastId;
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
  setState({ session: null, snapshot: null, busy: false });
}

export const selfPlayer = (): PlayerInfo | undefined => {
  const s = state.snapshot;
  return s?.players.find((p) => p.id === s.selfId);
};
export const isHost = (): boolean => !!state.snapshot && state.snapshot.hostId === state.snapshot.selfId;
export const playerById = (id: string): PlayerInfo | undefined =>
  state.snapshot?.players.find((p) => p.id === id);
