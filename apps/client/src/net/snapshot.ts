import type { RoomSnapshot } from "@glix/engine";

/** Aynı odada eski (düşük `rev`) snapshot yok sayılır; başka odaya geçince her snapshot kabul edilir. */
export function shouldAccept(current: RoomSnapshot | null, incoming: RoomSnapshot): boolean {
  if (!current) return true;
  if (current.code !== incoming.code) return true;
  return incoming.rev > current.rev;
}
