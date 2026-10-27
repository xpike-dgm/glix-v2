/**
 * Site duyurusu ve bakım bildirimi (U16 A3). Sunucu üretir (`welcome` ve `siteNotice` mesajları), istemci gösterir;
 * metin doğrulaması hem yönetici ucunda hem panelde aynıdır (docs/PROTOKOL.md "Duyuru ve bakım").
 */

/** Duyuru türü: bilgi (nötr) ya da uyarı (dikkat çekici). */
export const ANNOUNCEMENT_KINDS = ["bilgi", "uyari"] as const;
export type AnnouncementKind = (typeof ANNOUNCEMENT_KINDS)[number];

export function isAnnouncementKind(value: unknown): value is AnnouncementKind {
  return typeof value === "string" && (ANNOUNCEMENT_KINDS as readonly string[]).includes(value);
}

/** Duyuru metni en çok bu kadar karakter. */
export const ANNOUNCEMENT_MAX = 140;
/** Duyuru bitiş zamanı en çok bu kadar ileride olabilir (30 gün). */
export const ANNOUNCEMENT_MAX_AHEAD_MS = 30 * 24 * 3600 * 1000;

/** Herkese bildirim: başlık ve gövde sınırları. */
export const BROADCAST_TITLE_MAX = 40;
export const BROADCAST_BODY_MAX = 120;

/** Yayındaki duyuru. `id` her yeni duyuruda artar; istemci kapatılan duyuruyu bu kimlikle hatırlar. */
export interface Announcement {
  id: number;
  text: string;
  kind: AnnouncementKind;
  /** Bitiş anı (sunucu saatiyle ms); süresizse null. */
  endsAt: number | null;
}

/** Herkese gösterilen site durumu: duyuru ve bakım kipi. */
export interface SiteNotice {
  announcement: Announcement | null;
  /** Bakım kipi: yeni oda kurulamaz, yeni maç başlamaz; süren maçlar biter. */
  maintenance: boolean;
}

/** Görünmez/yön değiştiren biçim karakterleri, satır/paragraf ayırıcı, özel kullanım, yetim vekil. */
const FORBIDDEN = /[\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cs}]/u;
const CONTROL = /\p{Cc}/u;

/**
 * Düz metin temizleyici: kırpar, iç boşlukları tek boşluğa indirir; denetim/biçim karakteri ve `<` `>` içeren (HTML
 * olabilecek) ya da sınırı aşan/boş metin için null döner. Sınır karakter (kod noktası) sayısıdır.
 */
export function cleanPlainText(value: unknown, max: number): string | null {
  if (typeof value !== "string" || value.length > max * 4) return null;
  if (CONTROL.test(value) || FORBIDDEN.test(value) || /[<>]/.test(value)) return null;
  const clean = value.replace(/\s+/gu, " ").trim();
  const length = Array.from(clean).length;
  return length >= 1 && length <= max ? clean : null;
}

/** Duyuru metni (1-140 karakter, düz metin). */
export const cleanAnnouncementText = (value: unknown): string | null =>
  cleanPlainText(value, ANNOUNCEMENT_MAX);

/**
 * Bildirimde açılacak site içi yol: "/" ile başlar, "//" ile başlamaz, boşluk/denetim/ters bölü yok, en çok 100
 * karakter. Boş/yok = ana sayfa. Geçersizse null.
 */
export function cleanSitePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]{0,99}$/.test(value)) return null;
  return value;
}
