import {
  APP_VERSION,
  type ClientMessage,
  CONTINUE_MIN_GAP_MS,
  type ErrorCode,
  GAMES,
  MAX_PLAYERS,
  MAX_STAGES,
  PROTOCOL_VERSION,
  REACTION_MIN_GAP_MS,
} from "@glix/engine";
import { cardEvent, playContext } from "./cards.js";
import { openIds } from "./gameSwitches.js";
import {
  applyAction,
  beginMatch,
  clearMatch,
  currentGame,
  markContinue,
  markReady,
  pickRandomGames,
  recordPresence,
  requiredPlayers,
  stepMatch,
} from "./match.js";
import { errorMessage } from "./messages.js";
import { notifyPlayers } from "./push.js";
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
import { siteNoticeOf } from "./siteSettings.js";
import { isAllowedPushEndpoint } from "./webpush.js";

/** Bir oyuncunun takma adını en sık bu aralıkla değiştirebilir. */
export const RENAME_MIN_GAP_MS = 1000;

/** Yasaklı kelimeye takılan ad için oyuncuya gösterilen metin. */
export const NAME_BANNED_TEXT = "Bu ad kullanılamaz.";

/** Bir soketten bu kadar başarısız oda kodu denemesinden sonra bağlantı kapatılır. */
export const MAX_FAILED_JOINS = 10;

function fail(conn: Connection, code: ErrorCode, text?: string): void {
  conn.send(errorMessage(code, text));
}

function sendWelcome(rt: Runtime, conn: Connection): void {
  conn.send({
    type: "welcome",
    protocolVersion: PROTOCOL_VERSION,
    serverVersion: APP_VERSION,
    ...(rt.push.publicKey ? { pushKey: rt.push.publicKey } : {}),
    site: siteNoticeOf(rt),
  });
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

/** Sahne (TV) bağlantısının gönderebildikleri: bağlantı, ping, ayrılma ve tam görüntü isteği. Gerisi reddedilir. */
function handleStageMessage(rt: Runtime, conn: Connection, room: Room, msg: ClientMessage): void {
  switch (msg.type) {
    case "hello":
      sendWelcome(rt, conn);
      return;
    case "ping":
      conn.send({ type: "pong", t: msg.t, serverTime: rt.clock.now() });
      return;
    case "resync":
      rt.broadcaster.resyncStage(room, conn);
      return;
    case "leaveRoom":
      room.stages.delete(conn);
      conn.stage = null;
      conn.lastSent = null;
      conn.send({ type: "left", reason: "left" });
      rt.broadcaster.markDirty(room);
      return;
    case "action":
      conn.send({ type: "actionAck", seq: msg.seq, ok: false, reason: "not_participant" });
      return;
    default:
      fail(conn, "stage_readonly");
  }
}

/**
 * Oyundaki ad: hesaplı bağlantıda istemcinin yolladığı takma ad yok sayılır, kullanıcı adı kullanılır
 * (tek ad kuralı; istemci yalnız protokolün geçerlilik denetiminden geçsin diye bir ad yollar).
 */
function gameName(conn: Connection, wanted: string): string {
  return conn.account?.username ?? wanted;
}

/**
 * Odaya oyuncu (maç sürüyorsa izleyici) olarak girer: `joinRoom` ve `joinFriend` ortak yolu.
 * Karar: room_full ve match_in_progress, room_not_found'dan ayrı kalır. Bunlar kodun doğru olduğunu
 * ele verir, ama 5 karakterli kod uzayı (32^5) + soket/IP sınırları tahmini pratikte imkânsız kılar;
 * arkadaşına "oda dolu" ile "oda yok" ayrımını göstermek kullanıcı deneyimi için daha değerli.
 * Maç sürerken: "Kapalı" ise reddedilir, "İzleyici" ise izleyici olarak girer.
 */
function enterRoom(
  rt: Runtime,
  conn: Connection,
  room: Room,
  nickname: string,
  avatar: number | undefined,
): void {
  // Yönetici bu odadan çıkardıysa 10 dakika girilemez; ad denetimi misafir takma adına uygulanır (hesapta kullanıcı adı).
  if (rt.roomKicks.isBlocked(room.code, conn)) {
    fail(conn, "room_blocked");
    return;
  }
  if (!conn.account && rt.bannedWords.matches(nickname)) {
    fail(conn, "nickname_invalid", NAME_BANNED_TEXT);
    return;
  }
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
  addPlayer(rt, room, gameName(conn, nickname), conn, avatar, spectator);
  sendSession(conn);
  rt.broadcaster.markDirty(room);
}

export function handleMessage(rt: Runtime, conn: Connection, msg: ClientMessage): void {
  if (conn.stage) {
    handleStageMessage(rt, conn, conn.stage, msg);
    return;
  }
  switch (msg.type) {
    case "hello":
      sendWelcome(rt, conn);
      return;
    case "ping":
      conn.send({ type: "pong", t: msg.t, serverTime: rt.clock.now() });
      return;
    case "createRoom": {
      if (conn.player) {
        fail(conn, "already_in_room");
        return;
      }
      // Misafir yalnız kodla katılır; oda kurmak hesap ister (docs/HESAP.md).
      if (!conn.account) {
        fail(conn, "login_required");
        return;
      }
      if (rt.draining) {
        fail(conn, "draining");
        return;
      }
      if (rt.maintenance) {
        fail(conn, "maintenance");
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
      addPlayer(rt, room, gameName(conn, msg.nickname), conn, msg.avatar);
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
      enterRoom(rt, conn, room, msg.nickname, msg.avatar);
      return;
    }
    case "joinFriend": {
      if (conn.player) {
        fail(conn, "already_in_room");
        return;
      }
      if (rt.draining) {
        fail(conn, "draining");
        return;
      }
      if (!rt.ipLimiter.canTryJoin(conn.ip)) {
        fail(conn, "rate_limited");
        return;
      }
      // Oda kodu burada çözülür ve istemciye hiç gitmez. Arkadaş değil, odada değil, katılıma kapalı: hepsi aynı hata.
      const room = conn.account ? rt.social.friendRoom(conn.account.id, msg.username) : null;
      if (!room) {
        rt.ipLimiter.recordFailedJoin(conn.ip);
        fail(conn, "friend_not_found");
        return;
      }
      enterRoom(rt, conn, room, msg.nickname, msg.avatar);
      return;
    }
    case "inviteFriend": {
      const outcome = rt.social.invite(conn, msg.username);
      if (outcome === "ok") conn.send({ type: "inviteSent", username: msg.username });
      else if (outcome === "login_required" || outcome === "not_in_room" || outcome === "wrong_phase")
        fail(conn, outcome);
      else if (outcome === "rate_limited")
        fail(conn, "rate_limited", "Bu arkadaşını biraz önce çağırdın, birazdan tekrar dene.");
      else fail(conn, "invite_failed");
      return;
    }
    case "joinStage": {
      if (conn.player) {
        fail(conn, "already_in_room");
        return;
      }
      if (rt.draining) {
        fail(conn, "draining");
        return;
      }
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
      // Sahne koltuk tutmaz ve 8 sınırına girmez; kendi üst sınırı vardır.
      if (room.stages.size >= MAX_STAGES) {
        fail(conn, "stage_full");
        return;
      }
      room.stages.add(conn);
      conn.stage = room;
      conn.lastSent = null;
      conn.send({ type: "stage", roomCode: room.code });
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
      // Yeni bağlantı: istemci sayfa durumunu oturum kabulünden sonra yeniden bildirir.
      player.hidden = false;
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
    case "visibility": {
      // Odasız bağlantıda sessizce yok sayılır.
      if (conn.player) conn.player.hidden = msg.hidden;
      return;
    }
    case "pushSubscribe": {
      if (!rt.push.enabled) return;
      if (!isAllowedPushEndpoint(msg.endpoint)) {
        fail(conn, "invalid_message");
        return;
      }
      const target = { endpoint: msg.endpoint, p256dh: msg.p256dh, auth: msg.auth };
      // Hesaplıysa abonelik hesaba da bağlanır: arkadaş daveti, bağlantısı olmayan hesaba bildirim olarak gider.
      if (conn.account) rt.social.setPush(conn.account.id, target);
      if (conn.player) conn.player.push = target;
      return;
    }
    case "pushUnsubscribe": {
      if (conn.account) rt.social.setPush(conn.account.id, null);
      if (conn.player) conn.player.push = null;
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
      // Hesaplı oyuncunun adı kullanıcı adıdır; odada ayrı takma ad yoktur.
      if (conn.account) {
        fail(conn, "account_name");
        return;
      }
      if (me.nickname === msg.nickname) return;
      if (rt.bannedWords.matches(msg.nickname)) {
        fail(conn, "nickname_invalid", NAME_BANNED_TEXT);
        return;
      }
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
      // Yalnız lobi, sonuç ve final: oyun sırasında (blöf oyunlarında) gizli işaret taşıyabilir.
      if (room.phase !== "lobby" && room.phase !== "results" && room.phase !== "final") return;
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
      const open = openIds(rt);
      if (!msg.gameIds.every((id) => open.has(id))) {
        fail(conn, "invalid_games", "Seçtiğin oyunlardan biri şu an kapalı.");
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
    case "setTone":
      // Eski istemci uyumu: ton özelliği kaldırıldı; mesaj sessizce yok sayılır (hata ve yayın yok).
      return;
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
    case "setCards": {
      const room = requireHost(conn);
      if (!room) return;
      if (room.phase !== "lobby") {
        fail(conn, "wrong_phase");
        return;
      }
      room.cardSettings = { enabled: msg.enabled, off: [...msg.off] };
      rt.broadcaster.markDirty(room);
      return;
    }
    case "pickCard":
    case "discardCard": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      const match = room.match;
      if (room.phase !== "cards" || !match?.cards) {
        fail(conn, "wrong_phase");
        return;
      }
      const me = conn.player.id;
      if (!match.cards.players.includes(me) || conn.player.spectator) {
        fail(conn, "not_participant");
        return;
      }
      const outcome = cardEvent(
        rt,
        match,
        msg.type === "pickCard"
          ? { k: "pick", p: me, i: msg.index }
          : { k: "discard", p: me, drop: msg.index === null ? "new" : msg.index },
      );
      if (!outcome.ok) {
        fail(conn, "card_invalid");
        return;
      }
      stepMatch(rt, room);
      rt.broadcaster.markDirty(room);
      return;
    }
    case "playCard":
    case "unplayCard": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      const match = room.match;
      if (room.phase !== "briefing" || !match?.cards) {
        fail(conn, "wrong_phase");
        return;
      }
      const me = conn.player.id;
      if (!match.participants.includes(me) || conn.player.spectator) {
        fail(conn, "not_participant");
        return;
      }
      const outcome = cardEvent(
        rt,
        match,
        msg.type === "unplayCard"
          ? { k: "unplay", p: me }
          : {
              k: "play",
              p: me,
              card: msg.card,
              ...(msg.target !== undefined ? { target: msg.target } : {}),
              ...(msg.gameId !== undefined ? { gameId: msg.gameId } : {}),
              ctx: playContext(rt, room, match),
            },
      );
      if (!outcome.ok) {
        fail(conn, "card_invalid");
        return;
      }
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
      if (rt.maintenance) {
        fail(conn, "maintenance");
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
        notifyMatchStart(rt, room);
        rt.broadcaster.markDirty(room);
        return;
      }
      const open = openIds(rt);
      if (room.gameIds.length === 0 || !room.gameIds.every((id) => open.has(id))) {
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
      notifyMatchStart(rt, room);
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
    case "continue": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      if (room.phase !== "results" || !room.match) {
        fail(conn, "wrong_phase");
        return;
      }
      const now = rt.clock.now();
      if (now - conn.player.lastContinueAt < CONTINUE_MIN_GAP_MS) {
        fail(conn, "rate_limited");
        return;
      }
      conn.player.lastContinueAt = now;
      // İzleyici ve katılımcı olmayan sessizce yok sayılır (sayıma girmez, hata yok).
      if (!markContinue(room, conn.player.id)) return;
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
    case "report": {
      const room = requireRoom(conn);
      if (!room || !conn.player) return;
      const me = conn.player;
      const target = room.players.get(msg.playerId);
      if (!target || target === me) {
        fail(conn, "not_in_room", "Bu oyuncu odada değil.");
        return;
      }
      const outcome = rt.reports.submit({
        conn,
        reporter: me,
        room,
        target,
        reason: msg.reason,
        note: msg.note ?? "",
      });
      if (outcome === "ok") conn.send({ type: "reportAck" });
      else if (outcome === "limit") fail(conn, "report_limit");
      else if (outcome === "duplicate") fail(conn, "report_duplicate");
      else fail(conn, "server_busy", "Bildirim şu an gönderilemedi, birazdan tekrar dene.");
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
      notifyPlayers(rt, room, "rematch", room.players.keys());
      rt.broadcaster.markDirty(room);
      return;
    }
  }
}

/** Maç başladı: katılımcılardan arka plandakilere "Oyun başlıyor!" gider. */
function notifyMatchStart(rt: Runtime, room: Room): void {
  if (room.match) notifyPlayers(rt, room, "start", room.match.startParticipants);
}

/** Soket kapandı. */
export function handleClose(rt: Runtime, conn: Connection): void {
  if (conn.stage) {
    const room = conn.stage;
    conn.stage = null;
    if (room.stages.delete(conn)) rt.broadcaster.markDirty(room);
    return;
  }
  const player = conn.player;
  conn.player = null;
  if (player && player.conn === conn) markDisconnected(rt, player);
}
