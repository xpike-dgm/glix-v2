import {
  type CardsMine,
  type CardsPublic,
  DEFAULT_JOIN_POLICY,
  type ErrorCode,
  GAME_COMMENT_MAX,
  type GameInfo,
  type GameResult,
  isFriendStatus,
  isReactionId,
  JOIN_POLICIES,
  type LeftReason,
  type MatchReveal,
  type MatchSnapshot,
  type PlayerInfo,
  parseCardSettings,
  parseCardsMine,
  parseCardsPublic,
  parseCosmetics,
  type RoomPhase,
  type RoomSnapshot,
  type ServerMessage,
} from "@glix/engine";
import { parseBadgeIds } from "./badgeRules.js";
import { parseInvite } from "./friendsRules.js";
import { parseGlixEarned } from "./glixRules.js";
import { parseQuestsDone } from "./questRules.js";
import { parseSiteNotice } from "./siteRules.js";

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

const PHASES: readonly RoomPhase[] = [
  "lobby",
  "briefing",
  "countdown",
  "playing",
  "results",
  "cards",
  "final",
];
const ERROR_CODES: readonly ErrorCode[] = [
  "invalid_message",
  "rate_limited",
  "nickname_invalid",
  "room_not_found",
  "room_full",
  "match_in_progress",
  "resume_failed",
  "not_host",
  "not_in_room",
  "already_in_room",
  "invalid_games",
  "avatar_taken",
  "nickname_taken",
  "account_name",
  "not_enough_players",
  "wrong_phase",
  "not_participant",
  "card_invalid",
  "game_failed",
  "draining",
  "server_busy",
  "stage_full",
  "stage_readonly",
  "login_required",
  "invite_failed",
  "friend_not_found",
  "maintenance",
  "report_limit",
  "report_duplicate",
  "room_blocked",
];
const LEFT: readonly LeftReason[] = ["left", "kicked", "closed", "adminClosed", "removed"];

export function parseNumberRecord(v: unknown): Record<string, number> | null {
  if (!isRec(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) {
    if (!isNum(n)) return null;
    out[k] = n;
  }
  return out;
}

function parsePlayer(v: unknown): PlayerInfo | null {
  if (!isRec(v)) return null;
  const cosmetics = parseCosmetics(v.cosmetics);
  const { id, nickname, avatar, connected, score } = v;
  if (!isStr(id) || !isStr(nickname) || !isNum(avatar) || !isBool(connected) || !isNum(score)) return null;
  return {
    id,
    nickname,
    avatar: Math.min(7, Math.max(0, Math.trunc(avatar))),
    connected,
    score,
    spectator: v.spectator === true,
    ...(isStr(v.username) && v.username.length > 0 && v.username.length <= 32
      ? { username: v.username }
      : {}),
    ...(cosmetics ? { cosmetics } : {}),
  };
}

function parseGameInfo(v: unknown): GameInfo | null {
  if (!isRec(v)) return null;
  const { id, name, minPlayers, maxPlayers, orientation } = v;
  if (!isStr(id) || !isStr(name) || !isNum(minPlayers) || !isNum(maxPlayers)) return null;
  if (orientation !== "portrait" && orientation !== "landscape") return null;
  return {
    id,
    name,
    minPlayers,
    maxPlayers,
    orientation,
    ...(v.randomPool === false ? { randomPool: false } : {}),
  };
}

function parseResult(v: unknown): GameResult | null {
  if (!isRec(v)) return null;
  const miniScores = parseNumberRecord(v.miniScores);
  const awards = parseNumberRecord(v.awards);
  return miniScores && awards ? { miniScores, awards } : null;
}

function parseMatch(v: unknown): MatchSnapshot | null {
  if (!isRec(v)) return null;
  const b = v.briefing;
  if (!isRec(b) || !isStr(b.goal) || !isStrArr(b.steps)) return null;
  const o = v.orientation;
  if (o !== "portrait" && o !== "landscape") return null;
  if (!isNum(v.round) || !isNum(v.total) || !isStr(v.gameId) || !isStr(v.gameName)) return null;
  if (!isStrArr(v.participants) || !isStrArr(v.readyIds) || !isNum(v.phaseStartedAt)) return null;
  const ends = v.phaseEndsAt;
  if (ends !== null && !isNum(ends)) return null;
  let result: GameResult | null = null;
  if (v.result !== null && v.result !== undefined) {
    result = parseResult(v.result);
    if (!result) return null;
  }
  let cards: CardsPublic | null = null;
  if (v.cards !== null && v.cards !== undefined) {
    cards = parseCardsPublic(v.cards);
    if (!cards) return null;
  }
  const comment = parseComment(v.comment);
  let mine: CardsMine | null = null;
  if (v.mine !== null && v.mine !== undefined) {
    mine = parseCardsMine(v.mine);
    if (!mine) return null;
  }
  return {
    round: v.round,
    total: v.total,
    gameId: v.gameId,
    gameName: v.gameName,
    briefing: { goal: b.goal, steps: b.steps.slice(0, 3) },
    orientation: o,
    participants: v.participants,
    readyIds: v.readyIds,
    continueIds: isStrArr(v.continueIds) ? v.continueIds : [],
    reveal: parseReveal(v.reveal),
    phaseStartedAt: v.phaseStartedAt,
    phaseEndsAt: ends,
    publicView: v.publicView ?? null,
    view: v.view ?? null,
    result,
    cards,
    mine,
    ...(comment !== null ? { comment } : {}),
  };
}

/** Oyun içi sonuç ekranı; yoksa ya da bozuksa null (eski sunucu alanı göndermez). */
function parseReveal(v: unknown): MatchReveal | null {
  if (!isRec(v) || !isNum(v.startedAt) || !isNum(v.endsAt) || !isStrArr(v.continueIds)) return null;
  return { startedAt: v.startedAt, endsAt: v.endsAt, continueIds: v.continueIds };
}

/** Oyun sonu yorumu: tek satır düz metin, en çok `GAME_COMMENT_MAX` karakter; aksi hâlde yok sayılır. */
export function parseComment(v: unknown): string | null {
  if (!isStr(v)) return null;
  const text = v.trim();
  if (text.length === 0 || Array.from(text).length > GAME_COMMENT_MAX || /\p{Cc}|[<>]/u.test(text))
    return null;
  return text;
}

function parseSelection(v: unknown): RoomSnapshot["selection"] | null {
  if (!isRec(v)) return null;
  if (v.mode === "manual") return { mode: "manual" };
  if (v.mode === "random" && isNum(v.count) && Number.isInteger(v.count) && v.count >= 1 && v.count <= 64)
    return { mode: "random", count: v.count };
  return null;
}

export function parseSnapshot(v: unknown): RoomSnapshot | null {
  if (!isRec(v)) return null;
  if (!isNum(v.rev) || !isNum(v.serverNow) || !isStr(v.code) || !isStr(v.hostId) || !isStr(v.selfId))
    return null;
  const phase = PHASES.find((p) => p === v.phase);
  if (!phase) return null;
  if (!Array.isArray(v.players) || !Array.isArray(v.catalog) || !isStrArr(v.gameIds)) return null;
  if (!isStrArr(v.lobbyReady)) return null;
  const players: PlayerInfo[] = [];
  for (const p of v.players) {
    const pp = parsePlayer(p);
    if (!pp) return null;
    players.push(pp);
  }
  const selection = parseSelection(v.selection);
  if (!selection) return null;
  const catalog: GameInfo[] = [];
  for (const g of v.catalog) {
    const gg = parseGameInfo(g);
    if (!gg) return null;
    catalog.push(gg);
  }
  const cardSettings = v.cardSettings === undefined ? null : parseCardSettings(v.cardSettings);
  if (v.cardSettings !== undefined && !cardSettings) return null;
  let match: MatchSnapshot | null = null;
  if (v.match !== null && v.match !== undefined) {
    match = parseMatch(v.match);
    if (!match) return null;
  }
  return {
    rev: v.rev,
    serverNow: v.serverNow,
    code: v.code,
    hostId: v.hostId,
    selfId: v.selfId,
    phase,
    players,
    gameIds: v.gameIds,
    selection,
    ...(cardSettings ? { cardSettings } : {}),
    joinPolicy: JOIN_POLICIES.find((j) => j === v.joinPolicy) ?? DEFAULT_JOIN_POLICY,
    stageCount: isNum(v.stageCount) ? Math.max(0, Math.floor(v.stageCount)) : 0,
    lobbyReady: v.lobbyReady,
    catalog,
    match,
  };
}

/** Ağdan gelen ham metni doğrular; geçersizse null döner. */
export function parseServerMessage(raw: string): ServerMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRec(data)) return null;
  switch (data.type) {
    case "welcome": {
      if (!isNum(data.protocolVersion) || !isStr(data.serverVersion)) return null;
      const site = parseSiteNotice(data.site);
      return {
        type: "welcome",
        protocolVersion: data.protocolVersion,
        serverVersion: data.serverVersion,
        ...(isStr(data.pushKey) && data.pushKey.length <= 128 ? { pushKey: data.pushKey } : {}),
        ...(site ? { site } : {}),
      };
    }
    case "siteNotice": {
      const site = parseSiteNotice(data.site);
      return site ? { type: "siteNotice", site } : null;
    }
    case "lobbyNotice":
      return isStr(data.text) && data.text.length > 0 && data.text.length <= 200
        ? { type: "lobbyNotice", text: data.text }
        : null;
    case "pong":
      return isNum(data.t) && isNum(data.serverTime)
        ? { type: "pong", t: data.t, serverTime: data.serverTime }
        : null;
    case "session":
      return isStr(data.token) && isStr(data.playerId) && isStr(data.roomCode)
        ? { type: "session", token: data.token, playerId: data.playerId, roomCode: data.roomCode }
        : null;
    case "stage":
      return isStr(data.roomCode) ? { type: "stage", roomCode: data.roomCode } : null;
    case "room": {
      const snapshot = parseSnapshot(data.snapshot);
      return snapshot ? { type: "room", snapshot } : null;
    }
    case "patch": {
      if (!isNum(data.baseRev) || !isNum(data.rev) || !isRec(data.patch)) return null;
      return { type: "patch", baseRev: data.baseRev, rev: data.rev, patch: data.patch };
    }
    case "actionAck": {
      if (!isNum(data.seq) || !isBool(data.ok)) return null;
      return isStr(data.reason)
        ? { type: "actionAck", seq: data.seq, ok: data.ok, reason: data.reason }
        : { type: "actionAck", seq: data.seq, ok: data.ok };
    }
    case "left": {
      const reason = LEFT.find((r) => r === data.reason);
      return reason ? { type: "left", reason } : null;
    }
    case "reportAck":
      return { type: "reportAck" };
    case "reaction":
      return isStr(data.playerId) && isReactionId(data.emoji)
        ? { type: "reaction", playerId: data.playerId, emoji: data.emoji }
        : null;
    case "friendStatus":
      return isStr(data.username) && data.username.length <= 20 && isFriendStatus(data.status)
        ? { type: "friendStatus", username: data.username, status: data.status }
        : null;
    case "friendRequest":
      return isStr(data.username) && data.username.length <= 20
        ? { type: "friendRequest", username: data.username }
        : null;
    case "friendsChanged":
      return { type: "friendsChanged" };
    case "invite": {
      const inv = parseInvite(data);
      return inv ? { type: "invite", ...inv } : null;
    }
    case "inviteSent":
      return isStr(data.username) && data.username.length <= 20
        ? { type: "inviteSent", username: data.username }
        : null;
    case "badgesEarned": {
      const ids = parseBadgeIds(data.ids);
      return ids ? { type: "badgesEarned", ids } : null;
    }
    case "glixEarned": {
      const g = parseGlixEarned(data);
      return g ? { type: "glixEarned", ...g } : null;
    }
    case "questsDone": {
      const q = parseQuestsDone(data);
      return q ? { type: "questsDone", ...q } : null;
    }
    case "error": {
      const code = ERROR_CODES.find((c) => c === data.code);
      return code && isStr(data.message) ? { type: "error", code, message: data.message } : null;
    }
    default:
      return null;
  }
}
