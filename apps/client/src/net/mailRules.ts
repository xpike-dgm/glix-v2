/**
 * E-postadan dönüşte adres çubuğundaki kısa işaretler: `#eposta=dogrulandi|gecersiz` (doğrulama bağlantısı
 * sunucuda işlenir ve buraya yönlendirir) ve `#sifre-sifirla=<belirteç>` (şifre sıfırlama bağlantısı).
 * Kodlar sunucudaki `apps/server/src/auth.ts` ile aynıdır; oyuncuya yalnız Türkçe metin gösterilir.
 */
export type MailReturn =
  | { kind: "dogrulama"; ok: boolean; text: string }
  | { kind: "sifirla"; token: string };

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const VERIFIED_TEXT = "E-postan doğrulandı.";
export const VERIFY_INVALID_TEXT =
  "Bağlantı geçersiz ya da süresi dolmuş. Ayarlar'dan yenisini isteyebilirsin.";

/** Adres parçasını çözer; e-postayla ilgili değilse ya da bozuksa null. */
export function parseMailReturn(hash: string): MailReturn | null {
  const q = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const verify = q.get("eposta");
  if (verify === "dogrulandi") return { kind: "dogrulama", ok: true, text: VERIFIED_TEXT };
  if (verify !== null) return { kind: "dogrulama", ok: false, text: VERIFY_INVALID_TEXT };
  const token = q.get("sifre-sifirla");
  if (token !== null && TOKEN_PATTERN.test(token)) return { kind: "sifirla", token };
  return null;
}
