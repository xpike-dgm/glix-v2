/**
 * İçerik havuzları (U16 A4): oyunların seçtiği kelime/soru listeleri. Havuzun yerleşik hâli kodda durur
 * (`games/<oyun>/pool.ts`); yönetici paneli yerleşik girdileri kapatabilir, yeni girdi ekleyebilir. Sunucu etkin havuzu
 * maç başlarken `GameContext.content` ile verir; oyun yalnız `setup` içinde okur ve seçtiğini durumuna yazar, bu yüzden
 * süren maç sonradan yapılan değişiklikten etkilenmez. Etkin havuz `GameLog.content`'e de yazılır: `replay` aynı havuzu kurar.
 */

/** Havuz kimliği -> etkin girdiler (yalnız yöneticinin değiştirdiği havuzlar bulunur; yoksa oyun yerleşik havuzu kullanır). */
export type ContentSet = Readonly<Record<string, readonly unknown[]>>;

/** Yönetici formundaki bir alan. */
export interface PoolField {
  key: string;
  label: string;
  /** Örnek/ipucu metni (arayüz). */
  hint: string;
  min: number;
  max: number;
  /** Uzun metin alanı (çok satırlı kutu). */
  long?: boolean;
}

export type FieldValues = Readonly<Record<string, string>>;

export type PoolParse<E> = { ok: true; entry: E } | { ok: false; error: string };

/** Bir içerik havuzunun tanımı: kimlik, ait olduğu oyun, alan şeması, doğrulama ve yerleşik girdiler. */
export interface ContentPool<E> {
  /** Kalıcı kimlik, örn. `sozluk-blofu/kelimeler`; veritabanında ve kayıtta bu yazılır. */
  id: string;
  gameId: string;
  /** Panelde gösterilen ad (Türkçe). */
  label: string;
  /** Girdinin ne olduğu ve nasıl yazılacağı (Türkçe, tek cümle). */
  hint: string;
  fields: readonly PoolField[];
  /**
   * Etkin havuz bundan küçükse oyun yerleşik havuzu kullanır (sunucu da ayarı uygulamaz, panel uyarır).
   * Oyunun kurulum için teknik ihtiyacının (`needed`) altına inmez.
   */
  min: number;
  /** Bir maçın havuzdan gerçekten çektiği girdi sayısı (en kötü durum). */
  needed: number;
  builtin: readonly E[];
  /** Ham alan değerlerini temizler ve doğrular; sorun varsa Türkçe hata. */
  fromFields(values: FieldValues): PoolParse<E>;
  toFields(entry: E): Record<string, string>;
  /** `ctx.content` / veritabanından gelen ham veriyi alan değerlerine açar; biçim bozuksa null. */
  unpack(raw: unknown): Record<string, string> | null;
  /** Tekrar denetimi anahtarı (büyük/küçük harf ve aksan duyarsız). */
  key(entry: E): string;
}

/** Havuz tanımı kurucusu: ortak `parseEntry`yi türetir. */
export function parseEntry<E>(pool: ContentPool<E>, raw: unknown): E | null {
  const values = pool.unpack(raw);
  if (values === null) return null;
  const parsed = pool.fromFields(values);
  return parsed.ok ? parsed.entry : null;
}

/**
 * Oyunun kurulumda kullanacağı etkin havuz. `content` yoksa ya da bu havuz için girdi yoksa yerleşik havuz döner
 * (varsayılan davranış değişmez). Verilen girdiler yeniden doğrulanır; geçerli sayı `min`'in altındaysa yine yerleşik havuz.
 */
export function poolEntries<E>(pool: ContentPool<E>, content: ContentSet | undefined): readonly E[] {
  const raw = content?.[pool.id];
  if (raw === undefined) return pool.builtin;
  const out: E[] = [];
  for (const item of raw) {
    const entry = parseEntry(pool, item);
    if (entry !== null) out.push(entry);
  }
  return out.length >= pool.min ? out : pool.builtin;
}

// ---- Alan temizliği ---------------------------------------------------------------------------------------------

// Görünmez/biçim karakterleri: denetim, sıfır genişlikli, yön işaretleri, vekil, özel kullanım, atanmamış ve boş görünen doldurucular.
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}ᅟᅠㅤﾠ⠀᠎]|͏/gu;
const MARK_STACK = /\p{M}{3,}/u;
const LETTERS_ONLY = /^\p{L}+$/u;

/** Unicode karakter (kod noktası) sayısı. */
export function textLength(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

/** Tekrar denetimi için: aksan/nokta işareti atılır, ı→i, küçük harf, noktalama atılır, boşluklar teke iner. */
export function dedupeKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[ıI]/g, "i")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Serbest metin alanı: NFC, boşluklar teke iner, görünmez karakter ve `<` `>` reddedilir, uzunluk sınırları. */
export function cleanLine(raw: unknown, label: string, min: number, max: number): PoolParse<string> {
  if (typeof raw !== "string") return { ok: false, error: `${label} yazılmalı.` };
  if (raw.length > 4 * max + 64) return { ok: false, error: `${label} en çok ${max} karakter olabilir.` };
  const text = raw.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (text === "") return { ok: false, error: `${label} boş olamaz.` };
  if (INVISIBLE.test(text) || MARK_STACK.test(text) || /[<>]/.test(text))
    return { ok: false, error: `${label} geçersiz karakter içeriyor.` };
  const n = textLength(text);
  if (n < min) return { ok: false, error: `${label} en az ${min} karakter olmalı.` };
  if (n > max) return { ok: false, error: `${label} en çok ${max} karakter olabilir (${n}).` };
  return { ok: true, entry: text };
}

/** Tek kelime alanı: yalnız harf (boşluk, rakam, işaret yok); `upper` büyük, değilse küçük harfe çevirir (tr-TR). */
export function cleanWord(
  raw: unknown,
  label: string,
  min: number,
  max: number,
  upper: boolean,
): PoolParse<string> {
  const line = cleanLine(raw, label, min, max);
  if (!line.ok) return line;
  if (!LETTERS_ONLY.test(line.entry))
    return { ok: false, error: `${label} tek kelime olmalı ve yalnız harf içermeli.` };
  return {
    ok: true,
    entry: upper ? line.entry.toLocaleUpperCase("tr-TR") : line.entry.toLocaleLowerCase("tr-TR"),
  };
}

/** Ham veri `{ alan: metin }` biçiminde bir nesneyse alan değerlerini döner. */
export function unpackFields(raw: unknown, keys: readonly string[]): Record<string, string> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = rec[k];
    if (typeof v !== "string") return null;
    out[k] = v;
  }
  return out;
}
