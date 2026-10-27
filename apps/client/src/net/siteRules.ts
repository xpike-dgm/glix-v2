/**
 * Site duyurusu ve bakım bildirimi (U16 A3): ağdan gelen durumu doğrulama, kapatılan duyuruyu hatırlama ve gösterim
 * kararı. Saf işlevler; testleri siteRules.test.ts.
 */
import { ANNOUNCEMENT_MAX, type Announcement, isAnnouncementKind, type SiteNotice } from "@glix/engine";

export const EMPTY_SITE: SiteNotice = { announcement: null, maintenance: false };

/** Metin kod noktası sayısı (sunucu 140 ile sınırlar; istemci biraz pay bırakır). */
const TEXT_CAP = ANNOUNCEMENT_MAX * 2;

function parseAnnouncement(v: unknown): Announcement | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const { id, text, kind, endsAt } = v as Record<string, unknown>;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 0) return null;
  if (typeof text !== "string" || text.length === 0 || Array.from(text).length > TEXT_CAP) return null;
  if (!isAnnouncementKind(kind)) return null;
  if (endsAt !== null && (typeof endsAt !== "number" || !Number.isFinite(endsAt))) return null;
  return { id, text, kind, endsAt: endsAt === null ? null : endsAt };
}

/** `welcome.site` ya da `siteNotice.site`; geçersizse null. Duyuru bozuksa yalnız duyuru düşer, bakım bayrağı korunur. */
export function parseSiteNotice(v: unknown): SiteNotice | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const { announcement, maintenance } = v as Record<string, unknown>;
  if (typeof maintenance !== "boolean") return null;
  return {
    announcement:
      announcement === null || announcement === undefined ? null : parseAnnouncement(announcement),
    maintenance,
  };
}

/**
 * Şimdi gösterilecek duyuru: süresi dolmamış ve kullanıcı bu kimliği kapatmamış olmalı.
 * `now` sunucu saatiyle ms (istemci saat farkı düzeltilmiş).
 */
export function shownAnnouncement(
  site: SiteNotice,
  now: number,
  dismissedId: number | null,
): Announcement | null {
  const a = site.announcement;
  if (a === null) return null;
  if (a.endsAt !== null && a.endsAt <= now) return null;
  return a.id === dismissedId ? null : a;
}

/** Kaydedilmiş "kapatılan duyuru kimliği" metnini okur; bozuksa null. */
export function parseDismissed(raw: string | null): number | null {
  if (raw === null || !/^\d{1,15}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}
