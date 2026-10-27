/**
 * Moderasyon çalışma zamanı (U16 A4): yasaklı kelime listesi, oyuncu bildirimi ("Bildir") ve yönetici atma engeli.
 * Yasaklı kelimeler ve bildirimler veritabanındadır (accountStore); atma engeli ve bildirim sınırları bellektedir.
 */
import {
  type AdminBannedWord,
  BANNED_WORDS_MAX,
  cleanBannedWord,
  matchesBanned,
  REPORT_PER_HOUR,
  type ReportEvidence,
  type ReportReason,
} from "@glix/engine";
import type { AccountStore } from "./accountStore.js";
import type { Clock } from "./clock.js";
import { log } from "./log.js";
import type { Connection, Player, Room } from "./runtime.js";

// ---- Yasaklı kelimeler ------------------------------------------------------------------------------------------

export interface BannedWords {
  /** Ad bir yasaklı kelimeye takılıyor mu. */
  matches(text: string): boolean;
  list(): AdminBannedWord[];
  /** Kelimeyi ekler; geçersizse `invalid`, normalleşmiş hâli varsa `exists`, 500 doluysa `full`. */
  add(raw: unknown, now: number): "ok" | "invalid" | "exists" | "full";
  /** Listede yazıldığı biçimle (ya da normalleşmiş hâliyle) siler. */
  remove(raw: unknown): boolean;
}

export const noBannedWords: BannedWords = {
  matches: () => false,
  list: () => [],
  add: () => "invalid",
  remove: () => false,
};

/** Veritabanındaki listeyi bellekte tutar (her katılımda sorgu olmasın); değişince yeniden okunur. */
export function createBannedWords(accounts: AccountStore): BannedWords {
  let folded: string[] = [];
  let rows = accounts.bannedWordsList();
  const refresh = (): void => {
    rows = accounts.bannedWordsList();
    folded = rows.map((r) => r.folded);
  };
  refresh();
  return {
    matches: (text) => matchesBanned(text, folded),
    list: () => rows.map((r) => ({ word: r.word, addedAt: r.addedAt })),
    add(raw, now) {
      const clean = cleanBannedWord(raw);
      if (!clean) return "invalid";
      const done = accounts.bannedWordAdd(clean.word, clean.folded, now, BANNED_WORDS_MAX);
      if (done === "ok") refresh();
      return done;
    },
    remove(raw) {
      const clean = cleanBannedWord(raw);
      if (!clean) return false;
      const removed = accounts.bannedWordRemove(clean.folded);
      if (removed) refresh();
      return removed;
    },
  };
}

// ---- Odadan atılanlar ---------------------------------------------------------------------------------------------

/** Yönetici bir oyuncuyu odadan atınca o odaya bu süre girmesi engellenir. */
export const ROOM_KICK_BLOCK_MS = 10 * 60 * 1000;

/** Atılan kişinin kimliği: hesaplıysa hesap, misafirse (bağlantısı biliniyorsa) IP. */
export interface KickKey {
  accountId: number | null;
  ip: string | null;
}

export function kickKeyOf(player: Player): KickKey {
  return { accountId: player.accountId, ip: player.conn?.ip ?? null };
}

/** Oda kodu -> engellenenler ve bitiş anları (bellekte; oda kapanınca silinir). */
export class RoomKicks {
  private readonly byRoom = new Map<string, { key: KickKey; until: number }[]>();

  constructor(private readonly clock: Clock) {}

  block(roomCode: string, key: KickKey): void {
    if (key.accountId === null && key.ip === null) return;
    const list = this.live(roomCode);
    list.push({ key, until: this.clock.now() + ROOM_KICK_BLOCK_MS });
    this.byRoom.set(roomCode, list);
  }

  /** Bu bağlantı o odaya giremez mi. */
  isBlocked(roomCode: string, conn: Pick<Connection, "account" | "ip">): boolean {
    for (const e of this.live(roomCode)) {
      if (e.key.accountId !== null) {
        if (conn.account?.id === e.key.accountId) return true;
      } else if (conn.account === null && e.key.ip !== null && e.key.ip === conn.ip) return true;
    }
    return false;
  }

  clearRoom(roomCode: string): void {
    this.byRoom.delete(roomCode);
  }

  private live(roomCode: string): { key: KickKey; until: number }[] {
    const now = this.clock.now();
    const list = (this.byRoom.get(roomCode) ?? []).filter((e) => e.until > now);
    if (list.length === 0) this.byRoom.delete(roomCode);
    else this.byRoom.set(roomCode, list);
    return list;
  }
}

// ---- Oyuncu bildirimi ----------------------------------------------------------------------------------------------

export type ReportOutcome = "ok" | "limit" | "duplicate" | "failed";

export interface ReportInput {
  conn: Connection;
  reporter: Player;
  room: Room;
  target: Player;
  reason: ReportReason;
  note: string;
}

export interface ReportDesk {
  submit(input: ReportInput): ReportOutcome;
}

export const noReportDesk: ReportDesk = { submit: () => "failed" };

const HOUR_MS = 3600 * 1000;
/** Aynı (bildiren, hedef, oda) üçlüsü bu süre içinde yeniden bildirilemez (oda kodu bu sürede yeniden kullanılmaz sayılır). */
const DUPLICATE_MS = 24 * HOUR_MS;

/**
 * Bildirim kabulü: bildiren başına saatte 5 (hesaplıda hesap, misafirde bağlantı IP'si), (bildiren, hedef, oda) başına bir.
 * Misafirde "aynı bildiren" odadaki oyuncu kimliğidir (aynı IP'deki arkadaşlar birbirini engellemesin).
 * Sınırlar bellektedir; yeniden başlatmada sıfırlanır (kayıtlar veritabanında kalır).
 */
export function createReportDesk(accounts: AccountStore, clock: Clock): ReportDesk {
  const sent = new Map<string, number[]>();
  const seen = new Map<string, number>();
  let lastPrune = 0;

  const prune = (now: number): void => {
    if (now - lastPrune < HOUR_MS / 4) return;
    lastPrune = now;
    for (const [k, list] of sent) {
      const live = list.filter((t) => now - t < HOUR_MS);
      if (live.length === 0) sent.delete(k);
      else sent.set(k, live);
    }
    for (const [k, at] of seen) if (now - at >= DUPLICATE_MS) seen.delete(k);
  };

  return {
    submit({ conn, reporter, room, target, reason, note }) {
      const now = clock.now();
      prune(now);
      const rateKey = conn.account ? `a:${conn.account.id}` : `g:${conn.ip}`;
      const who = conn.account ? `a:${conn.account.id}` : `p:${reporter.id}`;
      const whom = target.accountId !== null ? `a:${target.accountId}` : `p:${target.id}`;
      const dupKey = `${who}|${whom}|${room.code}`;
      if (seen.has(dupKey)) return "duplicate";
      const recent = (sent.get(rateKey) ?? []).filter((t) => now - t < HOUR_MS);
      if (recent.length >= REPORT_PER_HOUR) return "limit";

      // Kanıt: yalnız metinle ilgili sebeplerde ve yalnız hedefin son oyunda herkese açık gösterilmiş metinleri.
      const texts = reason === "abuse" || reason === "other" ? room.evidence?.texts[target.id] : undefined;
      const evidence: ReportEvidence | null =
        room.evidence && texts && texts.length > 0
          ? { gameId: room.evidence.gameId, texts: [...texts] }
          : null;
      const gameId =
        evidence?.gameId ??
        (room.match ? (room.match.games[room.match.index]?.id ?? null) : (room.evidence?.gameId ?? null));
      try {
        accounts.reportInsert({
          reporterAccountId: conn.account?.id ?? null,
          targetAccountId: target.accountId,
          targetName: target.nickname,
          targetPlayerId: target.id,
          roomCode: room.code,
          gameId,
          reason,
          note,
          evidence,
          createdAt: now,
        });
      } catch (err) {
        log.error("accounts_error", { op: "report_insert", error: String(err) });
        return "failed";
      }
      recent.push(now);
      sent.set(rateKey, recent);
      seen.set(dupKey, now);
      return "ok";
    },
  };
}
