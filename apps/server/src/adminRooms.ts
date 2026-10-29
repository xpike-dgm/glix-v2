/**
 * Yönetici oda işlemleri (U16 A4): bir odanın oyuncu listesi, odayı kapatma, oyuncu atma.
 * Görünen adlar yalnız `players` ile (tek oda açma, işlem kaydına `room_view` yazılır) döner.
 */
import type { AdminRoomPlayers } from "@glix/engine";
import { kickKeyOf } from "./moderation.js";
import { deleteRoom, removePlayer } from "./rooms.js";
import type { Runtime } from "./runtime.js";

export type KickResult = "ok" | "no_room" | "no_player";

export interface AdminRoomOps {
  /** Odanın oyuncuları (görünen adlarla); oda yoksa null. */
  players(code: string): AdminRoomPlayers | null;
  /** Herkese "Oda yönetici tarafından kapatıldı." gider; süren maç hesap istatistiği yazmadan yarıda kalır. */
  close(code: string): boolean;
  /** Oyuncuyu çıkarır ("Odadan çıkarıldın."), o odaya 10 dakika girmesini engeller. */
  kick(code: string, playerId: string): KickResult;
  /** Oyuncunun hesap kimliği; oda/oyuncu yoksa ya da misafirse null (yönetici hesabı koruması için). */
  accountIdOf(code: string, playerId: string): number | null;
  /** Oda hâlâ açık mı ve oyuncu içinde mi (bildirim ayrıntısı için). */
  hasPlayer(code: string, playerId: string): boolean;
}

export function createAdminRoomOps(rt: Runtime): AdminRoomOps {
  return {
    players(code) {
      const room = rt.rooms.get(code);
      if (!room) return null;
      return {
        code: room.code,
        phase: room.phase,
        players: [...room.players.values()]
          .sort((a, b) => a.joinOrder - b.joinOrder)
          .map((p) => ({
            id: p.id,
            nickname: p.nickname,
            connected: p.conn !== null,
            spectator: p.spectator,
            host: p.id === room.hostId,
            account: p.accountId !== null,
          })),
      };
    },
    close(code) {
      const room = rt.rooms.get(code);
      if (!room) return false;
      deleteRoom(rt, room, "adminClosed");
      return true;
    },
    kick(code, playerId) {
      const room = rt.rooms.get(code);
      if (!room) return "no_room";
      const player = room.players.get(playerId);
      if (!player) return "no_player";
      const conn = player.conn;
      rt.roomKicks.block(room.code, kickKeyOf(player));
      removePlayer(rt, room, player);
      conn?.send({ type: "left", reason: "removed" });
      return "ok";
    },
    accountIdOf(code, playerId) {
      return rt.rooms.get(code)?.players.get(playerId)?.accountId ?? null;
    },
    hasPlayer(code, playerId) {
      return rt.rooms.get(code)?.players.has(playerId) ?? false;
    },
  };
}
