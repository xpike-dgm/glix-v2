/**
 * Google ile girişten dönüşte adres çubuğundaki kısa işaretler (`#google-hata=<kod>` ve
 * `#google-yeni=<belirteç>&u=<öneri>`). Kodlar sunucudaki `apps/server/src/auth.ts` ile aynıdır;
 * oyuncuya yalnız Türkçe metin gösterilir.
 */
import { turkishDateTime } from "./accountRules.js";

const ERROR_TEXT: Record<string, string> = {
  kapali: "Google ile giriş şu an kullanılamıyor.",
  cok_deneme: "Çok fazla deneme yaptın, biraz bekleyip tekrar dene.",
  gecersiz: "Giriş yarım kaldı, tekrar dene.",
  iptal: "Google ile giriş iptal edildi.",
  dogrulanamadi: "Google ile giriş yapılamadı, biraz sonra tekrar dene.",
  eposta_dogrulanmamis: "Google hesabındaki e-posta doğrulanmamış. Başka bir Google hesabı dene.",
  eposta_kayitli:
    "Bu e-posta ile zaten bir hesap var. Önce şifrenle giriş yap, sonra Ayarlar'dan Google hesabını bağla.",
  baska_hesap: "Bu Google hesabı başka bir hesaba bağlı.",
  zaten_bagli: "Bu hesaba zaten bir Google hesabı bağlı.",
  askida: "Hesabın askıya alındı.",
};

/** Askıdaki hesap: bitiş anı (ms) adreste varsa tarihli metin; geçersiz/yoksa süresiz metni. Sebep adreste taşınmaz. */
export function suspendedText(untilParam: string | null): string {
  const ms = untilParam !== null && /^\d{1,15}$/.test(untilParam) ? Number(untilParam) : NaN;
  return Number.isSafeInteger(ms) && ms > 0
    ? `Hesabın ${turkishDateTime(ms)} tarihine kadar askıya alındı.`
    : (ERROR_TEXT.askida ?? "");
}

export function googleErrorText(code: string): string {
  return ERROR_TEXT[code] ?? ERROR_TEXT.dogrulanamadi ?? "";
}

export type GoogleReturn =
  | { kind: "hata"; text: string }
  | { kind: "yeni"; token: string; suggestion: string };

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const NAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

/** Adres parçasını çözer; Google ile ilgili değilse ya da bozuksa null. */
export function parseGoogleReturn(hash: string): GoogleReturn | null {
  const q = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const err = q.get("google-hata");
  if (err === "askida") return { kind: "hata", text: suspendedText(q.get("bitis")) };
  if (err !== null) return { kind: "hata", text: googleErrorText(err) };
  const token = q.get("google-yeni");
  if (token === null || !TOKEN_PATTERN.test(token)) return null;
  const hint = q.get("u") ?? "";
  return { kind: "yeni", token, suggestion: NAME_PATTERN.test(hint) ? hint : "" };
}
