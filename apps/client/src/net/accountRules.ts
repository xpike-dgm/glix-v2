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
