import { MAX_NICKNAME_LENGTH, normalizeNickname } from "@glix/engine";

/**
 * Hesap formu denetimleri (sunucudaki kurallarla aynı: apps/server/src/auth.ts).
 * Dönen metin kullanıcıya gösterilir; null = geçerli.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function usernameError(value: string): string | null {
  if (value.length < USERNAME_MIN || value.length > USERNAME_MAX || !USERNAME_PATTERN.test(value))
    return `Kullanıcı adı ${USERNAME_MIN}-${USERNAME_MAX} karakter olmalı; yalnız harf, rakam ve alt çizgi.`;
  return null;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function emailError(value: string): string | null {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? null : "Geçerli bir e-posta adresi yaz.";
}

export function passwordError(value: string): string | null {
  return value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX
    ? null
    : `Şifre ${PASSWORD_MIN}-${PASSWORD_MAX} karakter olmalı.`;
}

export interface RegisterForm {
  username: string;
  email: string;
  password: string;
}

/** İlk hatalı alanın metni; hepsi geçerliyse null. */
export function registerError(form: RegisterForm): string | null {
  return usernameError(form.username) ?? emailError(form.email) ?? passwordError(form.password);
}

export interface LoginForm {
  login: string;
  password: string;
}

export function loginError(form: LoginForm): string | null {
  if (form.login.trim().length < 3) return "Kullanıcı adını ya da e-postanı yaz.";
  if (form.password.length === 0) return "Şifreni yaz.";
  return null;
}

/**
 * Protokol her katılma/oda kurma mesajında geçerli bir takma ad ister. Hesaplı bağlantıda sunucu bunu yok sayıp
 * kullanıcı adını koyar; yine de gönderilen değer denetimden geçmeli (kullanıcı adı 20 karakter olabilir, "___" harf
 * içermediği için geçersizdir). Geçersizse sabit bir ad döner.
 */
export function wireNickname(name: string): string {
  const cut = Array.from(name).slice(0, MAX_NICKNAME_LENGTH).join("");
  return normalizeNickname(cut) ?? "Oyuncu";
}

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/** Türkiye saatiyle (UTC+3, yaz saati yok) "3 Kasım 2026 14:05"; sunucudaki hata metniyle aynı biçim. */
export function turkishDateTime(ms: number): string {
  const d = new Date(ms + 3 * 3600 * 1000);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Kullanıcı adı değişikliği hâlâ kapalıysa açılacağı an, değilse null. */
export function usernameLockedUntil(availableAt: number | null, now: number): number | null {
  return availableAt !== null && availableAt > now ? availableAt : null;
}

/** Kullanıcı adı penceresindeki bilgi satırı. */
export function usernameNote(availableAt: number | null, now: number): string {
  const until = usernameLockedUntil(availableAt, now);
  return until === null
    ? "Kullanıcı adını 7 günde bir değiştirebilirsin."
    : `Kullanıcı adını ${turkishDateTime(until)} tarihinde tekrar değiştirebilirsin.`;
}

/** Sunucu yanıtındaki `availableAt` ya da `usernameAvailableAt` değeri: geçerli bir zaman damgası ya da null. */
export function parseAvailableAt(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}
