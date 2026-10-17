import {
  APP_VERSION,
  type ClientMessage,
  type ErrorCode,
  GAMES,
  MAX_PLAYERS,
  PROTOCOL_VERSION,
} from "@glix/engine";
import { applyAction, beginMatch, clearMatch, markReady, requiredPlayers, stepMatch } from "./match.js";
import { errorMessage } from "./messages.js";
import { addPlayer, clearHostGrace, createRoom, markDisconnected, removePlayer } from "./rooms.js";
import { type Connection, isConnected, type Room, type Runtime } from "./runtime.js";

function fail(conn: Connection, code: ErrorCode, text?: string): void {
  conn.send(errorMessage(code, text));
}

function sendSession(conn: Connection): void {
  const p = conn.player;
  if (p) conn.send({ type: "session", token: p.token, playerId: p.id, roomCode: p.room.code });
}

/** Bağlantının oda ve oyuncusunu döner; yoksa hata gönderir. */
function requireRoom(conn: Connection): Room | null {
  if (!conn.player) {
    fail(conn, "not_in_room");
    return null;
  }
  return conn.player.room;
}

function requireHost(conn: Connection): Room | null {
  const room = requireRoom(conn);
  if (!room) return null;
  if (conn.player?.id !== room.hostId) {
    fail(conn, "not_host");
    return null;
  }
  return room;
}

export function handleMessage(rt: Runtime, conn: Connection, msg: ClientMessage): void {
  switch (msg.type) {
    case "hello":
      conn.send({ type: "welcome", protocolVersion: PROTOCOL_VERSION, serverVersion: APP_VERSION });
      return;
    case "ping":
      conn.send({ type: "pong", t: msg.t, serverTime: rt.clock.now() });
      return;
    case "createRoom": {
      if (conn.player) {
        fail(conn, "already_in_room");
        return;
      }
      const room = createRoom(rt);
      addPlayer(rt, room, msg.nickname, conn);
      sendSession(conn);
      rt.broadcaster.markDirty(room);
      return;
    }
    case "joinRoom": {
      if (conn.player) {
        fail(conn, "already_in_room");
        return;
      }
      const room = rt.rooms.get(msg.code);
      if (!room) {
        fail(conn, "room_not_found");
        return;
      }
      if (room.phase !== "lobby") {
        fail(conn, "match_in_progress");
        return;
      }
      if (room.players.size >= MAX_PLAYERS) {
        fail(conn, "room_full");
        return;
      }
      addPlayer(rt, room, msg.nickname, conn);
      sendSession(conn);
      rt.broadcaster.markDirty(room);
      return;
    }
    case "resume": {
      if (conn.player) {
        fail(conn, "already_in_room");
        return;
      }
      const player = rt.tokens.get(msg.token);
      if (!player || player.room.players.get(player.id) !== player) {
        fail(conn, "resume_failed");
        return;
      }
      const old = player.conn;
      if (player.graceCancel) {
        player.graceCancel();
        player.graceCancel = null;
      }
      if (player.room.hostId === player.id) clearHostGrace(player.room);
      player.conn = conn;
      conn.player = player;
      if (old && old !== conn) {
        old.player = null;
        old.close(4001, "Başka bir cihazdan bağlanıldı");
      }
      sendSession(conn);
      rt.broadcaster.markDirty(player.room);
      return;
    }
    case "leaveRoom": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      const player = conn.player;
      removePlayer(rt, room, player);
      conn.player = null;
      conn.send({ type: "left", reason: "left" });
      return;
    }
    case "kick": {
      const room = requireHost(conn);
      if (!room) return;
      if (room.phase !== "lobby") {
        fail(conn, "wrong_phase");
        return;
      }
      const target = room.players.get(msg.playerId);
      if (!target || target.id === conn.player?.id) {
        fail(conn, "not_in_room", "Bu oyuncu odada değil.");
        return;
      }
      const targetConn = target.conn;
      removePlayer(rt, room, target);
      targetConn?.send({ type: "left", reason: "kicked" });
      return;
    }
    case "setGames": {
      const room = requireHost(conn);
      if (!room) return;
      if (room.phase !== "lobby") {
        fail(conn, "wrong_phase");
        return;
      }
      if (!msg.gameIds.every((id) => Object.hasOwn(GAMES, id))) {
        fail(conn, "invalid_games");
        return;
      }
      room.gameIds = [...msg.gameIds];
      rt.broadcaster.markDirty(room);
      return;
    }
    case "startMatch": {
      const room = requireHost(conn);
      if (!room) return;
      if (room.phase !== "lobby") {
        fail(conn, "wrong_phase");
        return;
      }
      if (room.gameIds.length === 0 || !room.gameIds.every((id) => Object.hasOwn(GAMES, id))) {
        fail(conn, "invalid_games");
        return;
      }
      const need = requiredPlayers(room.gameIds);
      const connected = [...room.players.values()].filter(isConnected).length;
      if (connected < need || connected > MAX_PLAYERS) {
        fail(conn, "not_enough_players", `Başlamak için en az ${need} bağlı oyuncu gerekiyor.`);
        return;
      }
      beginMatch(rt, room);
      rt.broadcaster.markDirty(room);
      return;
    }
    case "ready": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      if (room.phase !== "briefing" || !room.match) {
        fail(conn, "wrong_phase");
        return;
      }
      if (!room.match.participants.includes(conn.player.id)) {
        fail(conn, "not_participant");
        return;
      }
      markReady(room, conn.player.id);
      stepMatch(rt, room);
      rt.broadcaster.markDirty(room);
      return;
    }
    case "action": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      const outcome = applyAction(rt, room, conn.player.id, msg.payload);
      conn.send(
        outcome.ok
          ? { type: "actionAck", seq: msg.seq, ok: true }
          : { type: "actionAck", seq: msg.seq, ok: false, reason: outcome.reason },
      );
      return;
    }
    case "returnToLobby": {
      const room = requireHost(conn);
      if (!room) return;
      if (room.phase !== "final") {
        fail(conn, "wrong_phase");
        return;
      }
      for (const p of room.players.values()) p.score = 0;
      clearMatch(rt, room);
      rt.broadcaster.markDirty(room);
      return;
    }
  }
}

/** Soket kapandı. */
export function handleClose(rt: Runtime, conn: Connection): void {
  const player = conn.player;
  conn.player = null;
  if (player && player.conn === conn) markDisconnected(rt, player);
}
