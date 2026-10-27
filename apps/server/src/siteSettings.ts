/**
 * Site ayarları (U16 A3): oyun anahtarları, duyuru ve bakım kipi. Ayarlar `server_settings` tablosunda kalıcıdır;
 * açılışta okunup çalışma zamanına (`Runtime.catalog`, `maintenance`, `announcement`) uygulanır. Her değişiklik önce
 * yazılır, yazma başarılıysa uygulanır (yazma hatası fırlatır; çalışma zamanı eski haliyle kalır).
 */
import {
  type AdminGameSwitch,
  type Announcement,
  type AnnouncementKind,
  isAnnouncementKind,
  type ServerMessage,
  type SiteNotice,
} from "@glix/engine";
import type { AccountStore } from "./accountStore.js";
import {
  ENGINE_CATALOG,
  effectiveCatalog,
  engineInPool,
  type GameOverride,
  type GameOverrides,
  pruneClosedGames,
} from "./gameSwitches.js";
import { log } from "./log.js";
import type { Runtime } from "./runtime.js";

const KEY_GAMES = "games";
const KEY_ANNOUNCEMENT = "announcement";
const KEY_ANNOUNCEMENT_SEQ = "announcement_seq";
const KEY_MAINTENANCE = "maintenance";

/** Herkese gösterilecek durum: süresi dolmuş duyuru çıkarılır. */
export function siteNoticeOf(rt: Runtime): SiteNotice {
  const a = rt.announcement;
  const live = a !== null && (a.endsAt === null || a.endsAt > rt.clock.now()) ? a : null;
  return { announcement: live, maintenance: rt.maintenance };
}

export interface GamePatch {
  open?: boolean;
  random?: boolean;
}

export interface SiteSettings {
  /** Yayındaki (süresi dolmamış) duyuru. */
  announcement(): Announcement | null;
  maintenance(): boolean;
  /** Yönetici panelinin oyun listesi (kapalı olanlar dahil, motor sırasıyla). */
  games(): AdminGameSwitch[];
  /** Oyun anahtarını değiştirir; bilinmeyen oyunda "unknown". */
  setGame(id: string, patch: GamePatch, now: number): "ok" | "unknown";
  /** Duyuru yayınlar (öncekinin yerine); kimliği yeni olur. */
  setAnnouncement(text: string, kind: AnnouncementKind, endsAt: number | null, now: number): Announcement;
  /** Duyuruyu kaldırır; yayında olan yoksa false. */
  clearAnnouncement(): boolean;
  setMaintenance(on: boolean, now: number): void;
  /** Sunucu turunda çağrılır: süresi dolan duyuruyu herkesten kaldırır. */
  tick(now: number): void;
}

function parseOverrides(raw: string | null): Record<string, GameOverride> {
  if (raw === null) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return {};
    const out: Record<string, GameOverride> = {};
    for (const [id, v] of Object.entries(data)) {
      if (!ENGINE_CATALOG.some((g) => g.id === id) || typeof v !== "object" || v === null) continue;
      const o: GameOverride = {};
      const rec = v as { open?: unknown; random?: unknown };
      if (rec.open === false) o.open = false;
      if (typeof rec.random === "boolean") o.random = rec.random;
      if (o.open === false || o.random !== undefined) out[id] = o;
    }
    return out;
  } catch {
    return {};
  }
}

function parseAnnouncement(raw: string | null): Announcement | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as Partial<Announcement> | null;
    if (!v || typeof v.id !== "number" || typeof v.text !== "string" || !isAnnouncementKind(v.kind))
      return null;
    const endsAt = typeof v.endsAt === "number" ? v.endsAt : null;
    return { id: v.id, text: v.text, kind: v.kind, endsAt };
  } catch {
    return null;
  }
}

/**
 * @param broadcast Tüm açık bağlantılara mesaj yollar (duyuru/bakım canlı güncellemesi).
 */
export function createSiteSettings(
  rt: Runtime,
  accounts: AccountStore,
  broadcast: (msg: ServerMessage) => void,
): SiteSettings {
  let overrides: GameOverrides = parseOverrides(accounts.settingGet(KEY_GAMES));
  rt.catalog = effectiveCatalog(overrides);
  rt.maintenance = accounts.settingGet(KEY_MAINTENANCE) === "1";
  rt.announcement = parseAnnouncement(accounts.settingGet(KEY_ANNOUNCEMENT));

  const pushNotice = (): void => broadcast({ type: "siteNotice", site: siteNoticeOf(rt) });

  /** Katalog değişti: kapalı oyunlar lobi seçimlerinden düşer, açık lobiler yeni kataloğu görür. */
  function catalogChanged(): void {
    rt.catalog = effectiveCatalog(overrides);
    for (const room of rt.rooms.values()) {
      if (room.phase !== "lobby") continue;
      if (pruneClosedGames(rt, room).length === 0) rt.broadcaster.markDirty(room);
    }
  }

  return {
    announcement: () => siteNoticeOf(rt).announcement,
    maintenance: () => rt.maintenance,
    games() {
      return ENGINE_CATALOG.map((g) => {
        const o = overrides[g.id];
        const engine = engineInPool(g);
        return {
          id: g.id,
          name: g.name,
          minPlayers: g.minPlayers,
          maxPlayers: g.maxPlayers,
          open: o?.open !== false,
          randomPool: o?.random ?? engine,
          engineRandomPool: engine,
          overridden: o !== undefined,
        };
      });
    },
    setGame(id, patch, now) {
      const base = ENGINE_CATALOG.find((g) => g.id === id);
      if (!base) return "unknown";
      const cur = overrides[id] ?? {};
      const next: GameOverride = {};
      const open = patch.open ?? cur.open !== false;
      if (!open) next.open = false;
      // Motor varsayılanıyla aynı değer saklanmaz: ayar "yok" sayılır.
      const random = patch.random ?? cur.random;
      if (random !== undefined && random !== engineInPool(base)) next.random = random;
      const merged: Record<string, GameOverride> = { ...overrides };
      if (next.open === false || next.random !== undefined) merged[id] = next;
      else delete merged[id];
      if (Object.keys(merged).length === 0) accounts.settingDelete(KEY_GAMES);
      else accounts.settingSet(KEY_GAMES, JSON.stringify(merged), now);
      overrides = merged;
      catalogChanged();
      return "ok";
    },
    setAnnouncement(text, kind, endsAt, now) {
      const prev = Number(accounts.settingGet(KEY_ANNOUNCEMENT_SEQ) ?? "0");
      const id = (Number.isSafeInteger(prev) ? prev : 0) + 1;
      const announcement: Announcement = { id, text, kind, endsAt };
      accounts.settingSet(KEY_ANNOUNCEMENT_SEQ, String(id), now);
      accounts.settingSet(KEY_ANNOUNCEMENT, JSON.stringify(announcement), now);
      rt.announcement = announcement;
      pushNotice();
      return announcement;
    },
    clearAnnouncement() {
      const had = siteNoticeOf(rt).announcement !== null;
      accounts.settingDelete(KEY_ANNOUNCEMENT);
      rt.announcement = null;
      if (had) pushNotice();
      return had;
    },
    setMaintenance(on, now) {
      if (on) accounts.settingSet(KEY_MAINTENANCE, "1", now);
      else accounts.settingDelete(KEY_MAINTENANCE);
      if (rt.maintenance === on) return;
      rt.maintenance = on;
      pushNotice();
    },
    tick(now) {
      const a = rt.announcement;
      if (a === null || a.endsAt === null || a.endsAt > now) return;
      rt.announcement = null;
      try {
        accounts.settingDelete(KEY_ANNOUNCEMENT);
      } catch (err) {
        log.error("accounts_error", { op: "announcement_expire", error: String(err) });
      }
      pushNotice();
    },
  };
}
