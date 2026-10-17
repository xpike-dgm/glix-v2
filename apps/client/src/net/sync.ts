import { applyMerge, type MergePatch, type RoomSnapshot } from "@glix/engine";
import { parseSnapshot } from "./parse.js";
import { shouldAccept } from "./snapshot.js";

/** İstemcinin oda senkron durumu: elindeki snapshot ve tam snapshot bekleyip beklemediği. */
export interface SyncState {
  snapshot: RoomSnapshot | null;
  /** `resync` gönderildi; tam `room` gelene kadar yamalar atılır ve yeniden resync istenmez. */
  awaitingFull: boolean;
}

export interface SyncStep {
  state: SyncState;
  /** Arayüze yazılacak yeni snapshot (değişmediyse null). */
  accepted: RoomSnapshot | null;
  /** Sunucuya `resync` gönderilmeli. */
  sendResync: boolean;
}

export const initialSync: SyncState = { snapshot: null, awaitingFull: false };

/** Tam `room` mesajı. Resync beklerken rev'e bakılmadan kabul edilir. */
export function onRoom(state: SyncState, incoming: RoomSnapshot): SyncStep {
  if (!state.awaitingFull && !shouldAccept(state.snapshot, incoming)) {
    return { state, accepted: null, sendResync: false };
  }
  return { state: { snapshot: incoming, awaitingFull: false }, accepted: incoming, sendResync: false };
}

/**
 * `patch` mesajı: yalnız `baseRev` elimizdeki rev'e eşitse uygulanır. Aksi halde (ya da yama sonucu
 * geçersizse) atılır ve bir kez `resync` istenir; tam snapshot gelene kadar sonraki yamalar sessizce atılır.
 */
export function onPatch(
  state: SyncState,
  msg: { baseRev: number; rev: number; patch: MergePatch },
): SyncStep {
  if (state.awaitingFull) return { state, accepted: null, sendResync: false };
  const current = state.snapshot;
  const drop = (): SyncStep => ({
    state: { snapshot: current, awaitingFull: true },
    accepted: null,
    sendResync: true,
  });
  if (!current || current.rev !== msg.baseRev) return drop();
  // Yamalanmış sonuç da ağdan gelen veri sayılır: tam snapshot gibi doğrulanır.
  const next = parseSnapshot(applyMerge(current, msg.patch));
  if (!next || next.rev !== msg.rev) return drop();
  return { state: { snapshot: next, awaitingFull: false }, accepted: next, sendResync: false };
}

/** Yeni soket açıldı: sunucu bu bağlantıya ilk olarak tam `room` yollar. */
export function onReconnect(state: SyncState): SyncState {
  return { ...state, awaitingFull: false };
}
