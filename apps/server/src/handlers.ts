import {
  APP_VERSION,
  type ClientMessage,
  type ErrorCode,
  GAMES,
  MAX_PLAYERS,
  PROTOCOL_VERSION,
  REACTION_MIN_GAP_MS,
} from "@glix/engine";
import {
  applyAction,
  beginMatch,
  clearMatch,
  currentGame,
  markReady,
  pickRandomGames,
  recordPresence,
  requiredPlayers,
  stepMatch,
} from "./match.js";
import { errorMessage } from "./messages.js";
import {
  addPlayer,
  clearHostGrace,
  createRoom,
  isAvatarFree,
  isNicknameTaken,
  markDisconnected,
  removePlayer,
  setHost,
} from "./rooms.js";
import { type Connection, isConnected, type Room, type Runtime } from "./runtime.js";

/** Bir oyuncunun takma adını en sık bu aralıkla değiştirebilir. */
export const RENAME_MIN_GAP_MS = 1000;

/** Bir soketten bu kadar başarısız oda kodu denemesinden sonra bağlantı kapatılır. */
export const MAX_FAILED_JOINS = 10;

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
      if (rt.draining) {
        fail(conn, "draining");
        return;
      }
      if (!rt.ipLimiter.takeCreate(conn.ip)) {
        fail(conn, "rate_limited");
        return;
      }
      if (rt.rooms.size >= rt.maxRooms) {
        fail(conn, "server_busy");
        return;
      }
      const room = createRoom(rt);
      addPlayer(rt, room, msg.nickname, conn, msg.avatar);
      sendSession(conn);
      rt.broadcaster.markDirty(room);
      return;
    }
    case "joinRoom": {
      if (conn.player) {
        fail(conn, "already_in_room");
        return;
      }
      if (rt.draining) {
        fail(conn, "draining");
        return;
      }
      // Kod tahminine karşı: IP başına başarısız katılma kovası boşsa aramadan reddedilir.
      if (!rt.ipLimiter.canTryJoin(conn.ip)) {
        fail(conn, "rate_limited");
        return;
      }
      const room = rt.rooms.get(msg.code);
      if (!room) {
        rt.ipLimiter.recordFailedJoin(conn.ip);
        conn.failedJoins += 1;
        fail(conn, "room_not_found");
        if (conn.failedJoins >= MAX_FAILED_JOINS) conn.close(1008, "Çok sayıda hatalı oda kodu");
        return;
      }
      // Karar: room_full ve match_in_progress, room_not_found'dan ayrı kalır. Bunlar kodun doğru olduğunu
      // ele verir, ama 5 karakterli kod uzayı (32^5) + yukarıdaki soket/IP sınırları tahmini pratikte
      // imkânsız kılar; arkadaşına "oda dolu" ile "oda yok" ayrımını göstermek kullanıcı deneyimi için daha değerli.
      // Maç sürerken: "Kapalı" ise reddedilir, "İzleyici" ise izleyici olarak girer.
      const spectator = room.phase !== "lobby";
      if (spectator && room.joinPolicy === "kapali") {
        fail(conn, "match_in_progress");
        return;
      }
      // İzleyici de bir yer tutar: oyuncular + izleyiciler en fazla MAX_PLAYERS.
      if (room.players.size >= MAX_PLAYERS) {
        fail(conn, "room_full");
        return;
      }
      addPlayer(rt, room, msg.nickname, conn, msg.avatar, spectator);
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
      if (!old) recordPresence(rt, player.room, player.id, true);
      conn.player = player;
      conn.lastSent = null;
      if (old && old !== conn) {
        old.player = null;
        old.close(4001, "Başka bir cihazdan bağlanıldı");
      }
      sendSession(conn);
      rt.broadcaster.markDirty(player.room);
      return;
    }
    case "resync": {
      if (!conn.player) {
        fail(conn, "not_in_room");
        return;
      }
      rt.broadcaster.resync(conn.player.room, conn.player);
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
    case "chooseAvatar": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      if (room.phase !== "lobby") {
        fail(conn, "wrong_phase", "Karakter oyun başlayınca değiştirilemez.");
        return;
      }
      const me = conn.player;
      if (me.avatar === msg.avatar) return;
      if (!isAvatarFree(room, msg.avatar, me)) {
        const owner = [...room.players.values()].find((p) => p.avatar === msg.avatar);
        fail(conn, "avatar_taken", `Bu karakteri ${owner?.nickname ?? "başkası"} aldı.`);
        return;
      }
      me.avatar = msg.avatar;
      rt.broadcaster.markDirty(room);
      return;
    }
    case "rename": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      if (room.phase !== "lobby") {
        fail(conn, "wrong_phase", "Takma ad oyun başlayınca değiştirilemez.");
        return;
      }
      const me = conn.player;
      if (me.nickname === msg.nickname) return;
      const now = rt.clock.now();
      if (now - me.lastRenameAt < RENAME_MIN_GAP_MS) {
        fail(conn, "rate_limited");
        return;
      }
      if (isNicknameTaken(room, msg.nickname, me)) {
        fail(conn, "nickname_taken");
        return;
      }
      me.lastRenameAt = now;
      me.nickname = msg.nickname;
      rt.broadcaster.markDirty(room);
      return;
    }
    case "react": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      // Geçici olay: yanlış aşama ya da çok sık gönderim sessizce atılır (hata göstermeden).
      if (room.phase !== "lobby") return;
      const me = conn.player;
      const now = rt.clock.now();
      if (now - me.lastReactAt < REACTION_MIN_GAP_MS) return;
      me.lastReactAt = now;
      const event = { type: "reaction", playerId: me.id, emoji: msg.emoji } as const;
      for (const p of room.players.values()) p.conn?.send(event);
      return;
    }
    case "setReady": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      if (room.phase !== "lobby") {
        fail(conn, "wrong_phase");
        return;
      }
      const me = conn.player;
      // Host hazır işareti taşımaz (maçı o başlatır); sessizce yok sayılır.
      if (me.id === room.hostId || me.lobbyReady === msg.ready) return;
      me.lobbyReady = msg.ready;
      rt.broadcaster.markDirty(room);
      return;
    }
    case "transferHost": {
      const room = requireHost(conn);
      if (!room) return;
      if (room.phase !== "lobby") {
        fail(conn, "wrong_phase");
        return;
      }
      const target = room.players.get(msg.playerId);
      if (!target || target.id === conn.player?.id || !isConnected(target)) {
        fail(conn, "not_in_room", "Bu oyuncu odada değil.");
        return;
      }
      setHost(room, target);
      rt.broadcaster.markDirty(room);
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
      room.selection = { mode: "manual" };
      rt.broadcaster.markDirty(room);
      return;
    }
    case "setRandom": {
      const room = requireHost(conn);
      if (!room) return;
      if (room.phase !== "lobby") {
        fail(conn, "wrong_phase");
        return;
      }
      room.selection = { mode: "random", count: Math.min(msg.count, rt.catalog.length) };
      room.gameIds = [];
      rt.broadcaster.markDirty(room);
      return;
    }
    case "setTone": {
      const room = requireHost(conn);
      if (!room) return;
      if (room.phase !== "lobby") {
        fail(conn, "wrong_phase");
        return;
      }
      if (room.tone === msg.tone) return;
      room.tone = msg.tone;
      rt.broadcaster.markDirty(room);
      return;
    }
    case "setJoinPolicy": {
      const room = requireHost(conn);
      if (!room) return;
      if (room.phase !== "lobby") {
        fail(conn, "wrong_phase");
        return;
      }
      if (room.joinPolicy === msg.policy) return;
      room.joinPolicy = msg.policy;
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
      if (room.selection.mode === "random") {
        const connectedCount = [...room.players.values()].filter(isConnected).length;
        const picked = pickRandomGames(rt, connectedCount, room.selection.count);
        if (picked.length === 0) {
          fail(conn, "not_enough_players", "Bu oyuncu sayısıyla oynanabilecek oyun yok.");
          return;
        }
        room.gameIds = picked;
        beginMatch(rt, room);
        rt.broadcaster.markDirty(room);
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
    case "feedback": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      const match = room.match;
      if (room.phase !== "final" || !match) {
        fail(conn, "wrong_phase");
        return;
      }
      // İzleyici maça katılmadı; geri bildirim veremez (sessizce yok sayılır).
      if (conn.player.spectator) return;
      // Maç başına oyuncu başına bir kez; sonrakiler sessizce yok sayılır.
      if (match.feedbackBy.has(conn.player.id)) return;
      match.feedbackBy.add(conn.player.id);
      rt.stats.feedback(match.statsId, rt.clock.now(), msg.rating, msg.text ?? null);
      return;
    }
    case "perf": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      const match = room.match;
      // Sessizce yok sayılır: yanlış aşama, başka oyunun adı, katılımcı olmayan ya da ikinci gönderim.
      if (room.phase !== "results" || !match || currentGame(match).id !== msg.gameId) return;
      if (!match.participants.includes(conn.player.id) || match.perfBy.has(conn.player.id)) return;
      match.perfBy.add(conn.player.id);
      rt.stats.perf(match.statsId, msg.gameId, rt.clock.now(), msg);
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
