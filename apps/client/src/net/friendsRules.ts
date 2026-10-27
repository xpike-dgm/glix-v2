import { type FriendStatus, isFriendStatus } from "@glix/engine";

/** Arkadaşlar ekranının verisi ve saf yardımcıları (sunucu yanıtı doğrulanır; ağdan gelen hiçbir şeye güvenilmez). */

export interface Friend {
  username: string;
  since: number;
  status: FriendStatus;
  /** Odasına şimdi girilebilir (oda kodu istemciye hiç gelmez; katılma sunucuda çözülür). */
  joinable: boolean;
  /** Seninle aynı odada. */
  withYou: boolean;
}

export interface Pending {
  username: string;
  at: number;
}

export interface FriendsData {
  friends: Friend[];
  incoming: Pending[];
  outgoing: Pending[];
  blocked: string[];
}

export const EMPTY_FRIENDS: FriendsData = { friends: [], incoming: [], outgoing: [], blocked: [] };

/** Sunucu sınırlarının (200 arkadaş, 50 giden) üstündeki yanıt kırpılır. */
const MAX_ROWS = 300;
const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function name(v: unknown): string | null {
  return typeof v === "string" && USERNAME.test(v) ? v : null;
}

function time(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

function rows(v: unknown): unknown[] {
  return Array.isArray(v) ? v.slice(0, MAX_ROWS) : [];
}

function parseFriend(v: unknown): Friend | null {
  if (!isRecord(v)) return null;
  const username = name(v.username);
  const since = time(v.since);
  if (username === null || since === null || !isFriendStatus(v.status)) return null;
  return {
    username,
    since,
    status: v.status,
    joinable: v.joinable === true,
    withYou: v.withYou === true,
  };
}

function parsePending(v: unknown): Pending | null {
  if (!isRecord(v)) return null;
  const username = name(v.username);
  const at = time(v.at);
  return username === null || at === null ? null : { username, at };
}

/** `GET /api/friends` yanıtını doğrular; geçersizse null. */
export function parseFriends(data: unknown): FriendsData | null {
  if (!isRecord(data) || data.ok !== true) return null;
  const keep = <T>(list: (T | null)[]): T[] => list.filter((x): x is T => x !== null);
  return {
    friends: sortFriends(keep(rows(data.friends).map(parseFriend))),
    incoming: keep(rows(data.incoming).map(parsePending)),
    outgoing: keep(rows(data.outgoing).map(parsePending)),
    blocked: rows(data.blocked).flatMap((b) => {
      const n = isRecord(b) ? name(b.username) : null;
      return n === null ? [] : [n];
    }),
  };
}

const STATUS_ORDER: Record<FriendStatus, number> = { lobby: 0, playing: 1, online: 2, offline: 3 };

/** Çevrimiçi olanlar üstte (lobide, oyunda, çevrimiçi), sonra çevrimdışı; aynı grupta ada göre. */
export function sortFriends(list: readonly Friend[]): Friend[] {
  return [...list].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.username.toLowerCase().localeCompare(b.username.toLowerCase(), "tr"),
  );
}

/** Durum yazısı: renge ek olarak her zaman metinle de söylenir (renk körlüğü). */
export function statusText(status: FriendStatus): string {
  switch (status) {
    case "lobby":
      return "Lobide";
    case "playing":
      return "Oyunda";
    case "online":
      return "Çevrimiçi";
    case "offline":
      return "Çevrimdışı";
  }
}

/** Durum noktasının şekli (renkten bağımsız ayırt etmek için). */
export type StatusShape = "ring" | "dot" | "square" | "triangle";
export function statusShape(status: FriendStatus): StatusShape {
  switch (status) {
    case "lobby":
      return "square";
    case "playing":
      return "triangle";
    case "online":
      return "dot";
    case "offline":
      return "ring";
  }
}

/** "Katıl" gösterilir mi: arkadaş lobide ya da (izleyiciye açık) maçta ve oda dolu değil. */
export function canJoinFriend(f: Friend): boolean {
  return f.joinable && (f.status === "lobby" || f.status === "playing");
}

/** Lobide davet listesi: çevrimiçi ve seninle aynı odada olmayan arkadaşlar. */
export function inviteCandidates(list: readonly Friend[]): Friend[] {
  return list.filter((f) => f.status !== "offline" && !f.withYou);
}

/** Gelen istek rozeti: yalnız sayı; 0 ise gizlenir, 10 üstü "9+". */
export function badgeText(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

/** Bir arkadaşın durumunu yerinde günceller; listede yoksa değişmez. Yeni dizi döner. */
export function withStatus(data: FriendsData, username: string, status: FriendStatus): FriendsData {
  const lc = username.toLowerCase();
  if (!data.friends.some((f) => f.username.toLowerCase() === lc)) return data;
  return {
    ...data,
    friends: sortFriends(
      data.friends.map((f) =>
        f.username.toLowerCase() === lc
          ? {
              ...f,
              status,
              // Çevrimdışı ya da lobi/maç dışına çıkan arkadaşa katılınamaz; kesin değer sonraki okumada gelir.
              joinable: status === "lobby" || status === "playing" ? f.joinable : false,
              withYou: status === "offline" || status === "online" ? false : f.withYou,
            }
          : f,
      ),
    ),
  };
}

// ---- Davet kartı ------------------------------------------------------------------------------------------

export interface FriendInvite {
  from: string;
  roomCode: string;
  /** Sunucu saatiyle ms. */
  expiresAt: number;
}

/** Aynı anda en çok bu kadar bekleyen davet tutulur. */
export const MAX_INVITES = 5;

const CODE = /^[A-Z0-9]{5}$/;

/** `invite` mesajındaki alanları doğrular; geçersizse null. */
export function parseInvite(v: unknown): FriendInvite | null {
  if (!isRecord(v)) return null;
  const from = name(v.from);
  const code = typeof v.roomCode === "string" && CODE.test(v.roomCode) ? v.roomCode : null;
  const expiresAt = time(v.expiresAt);
  return from === null || code === null || expiresAt === null ? null : { from, roomCode: code, expiresAt };
}

/** Aynı kişiden aynı oda için yeni davet eskisinin yerini alır; en yeni başta, sayı sınırlı. */
export function addInvite(list: readonly FriendInvite[], inv: FriendInvite): FriendInvite[] {
  const rest = list.filter((i) => !(i.from === inv.from && i.roomCode === inv.roomCode));
  return [inv, ...rest].slice(0, MAX_INVITES);
}

/** Süresi dolmamış davetler (`now` sunucu saati). */
export function liveInvites(list: readonly FriendInvite[], now: number): FriendInvite[] {
  return list.filter((i) => i.expiresAt > now);
}

/** Katılmak şu anki odadan ayrılmayı gerektirir mi (başka bir odadasın). */
export function leavesCurrentRoom(currentCode: string | null, inv: FriendInvite): boolean {
  return currentCode !== null && currentCode !== inv.roomCode;
}

/** Kalan süre: "9 dk" / "1 dk" / "1 dk'dan az". */
export function remainingText(expiresAt: number, now: number): string {
  const ms = expiresAt - now;
  if (ms <= 0) return "Süresi doldu";
  const min = Math.ceil(ms / 60_000);
  return min <= 1 ? "1 dk'dan az kaldı" : `${min} dk kaldı`;
}

/** Kullanıcı adı alanı: boşlukları kırpar, `@` önekini atar; geçersizse null. */
export function cleanUsername(input: string): string | null {
  const trimmed = input.trim().replace(/^@/, "");
  return USERNAME.test(trimmed) ? trimmed : null;
}
