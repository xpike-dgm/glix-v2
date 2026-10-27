import { log } from "./log.js";

/**
 * İşlemsel e-posta: Resend HTTPS API'si (SMTP ve harici paket yok). Adres, belirteç ve anahtar günlüğe yazılmaz.
 * `GLIX_RESEND_API_KEY` + `GLIX_MAIL_FROM` (+ bağlantılar için `GLIX_PUBLIC_URL`) yoksa e-posta kapalıdır.
 */
export interface MailConfig {
  apiKey: string;
  /** Gönderen, örn. `GLIX <noreply@dgmcraft.online>`. */
  from: string;
  /** Bağlantıların kökü (origin), örn. `https://glix.dgmcraft.online`. */
  publicUrl: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Sunucunun e-posta göndermek için kullandığı arayüz; true = servis kabul etti. Hiç fırlatmaz. */
export interface Mailer {
  send(message: MailMessage): Promise<boolean>;
}

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    redirect: "manual";
    signal: AbortSignal;
  },
) => Promise<{ status: number }>;

export const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

export function createMailer(
  config: MailConfig,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Mailer {
  return {
    async send(message) {
      try {
        const res = await fetchImpl(RESEND_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: config.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
          }),
          redirect: "manual",
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        if (res.status >= 200 && res.status < 300) return true;
        log.warn("mail_failed", { status: res.status });
        return false;
      } catch {
        // Hata metni adres ya da anahtar içerebilir: yalnız genel kayıt.
        log.warn("mail_failed");
        return false;
      }
    },
  };
}

/** Hesap deposu dışı durum: sunucunun e-posta hizmeti (gönderici + bağlantı kökü + hız sınırı). */
export interface MailService {
  mailer: Mailer;
  publicUrl: string;
  throttle: MailThrottle;
}

const DAY_MS = 24 * 3600 * 1000;
const MAX_KEYS = 5000;

/** Anahtar başına en az `gapMs` arayla ve günde en çok `perDay` izin verir (bellekte). */
export class MailThrottle {
  private readonly hits = new Map<string, number[]>();

  /** İzin varsa kaydeder ve true döner. */
  allow(key: string, now: number, gapMs: number, perDay: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < DAY_MS);
    const last = recent.at(-1);
    if (recent.length >= perDay || (last !== undefined && now - last < gapMs)) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > MAX_KEYS) this.prune(now);
    return true;
  }

  private prune(now: number): void {
    for (const [key, times] of this.hits) if ((times.at(-1) ?? 0) + DAY_MS <= now) this.hits.delete(key);
    while (this.hits.size > MAX_KEYS) {
      const oldest = this.hits.keys().next();
      if (oldest.done) break;
      this.hits.delete(oldest.value);
    }
  }
}

// ---- İçerik -----------------------------------------------------------------------------------------------

const IGNORE = "Bu isteği sen yapmadıysan bu e-postayı yok say.";

function page(heading: string, lead: string, button: string, link: string, note: string): string {
  const style = "font-family:Arial,Helvetica,sans-serif;";
  return `<!doctype html><html lang="tr"><body style="margin:0;padding:24px;background:#111318;${style}">
<div style="max-width:480px;margin:0 auto;padding:28px;background:#1a1d24;border-radius:14px;color:#e8eaf0;${style}">
<h1 style="margin:0 0 16px;font-size:22px;color:#ffffff;">${heading}</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;">${lead}</p>
<p style="margin:0 0 24px;"><a href="${link}" style="display:inline-block;padding:14px 24px;background:#33d6e8;color:#0b0d12;font-weight:bold;font-size:16px;text-decoration:none;border-radius:10px;">${button}</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#a4a9b6;">Buton çalışmazsa bu adresi tarayıcına yapıştır:<br><span style="word-break:break-all;">${link}</span></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#a4a9b6;">${note} ${IGNORE}</p>
</div></body></html>`;
}

export function verifyMessage(to: string, link: string): MailMessage {
  return {
    to,
    subject: "GLIX — E-postanı doğrula",
    text: `GLIX hesabının e-postasını doğrulamak için bu bağlantıyı aç:\n${link}\n\nBağlantı 24 saat geçerli.\n${IGNORE}`,
    html: page(
      "E-postanı doğrula",
      "GLIX hesabının e-postasını doğrulamak için aşağıdaki düğmeye dokun.",
      "E-postamı doğrula",
      link,
      "Bağlantı 24 saat geçerli.",
    ),
  };
}

export function resetMessage(to: string, link: string): MailMessage {
  return {
    to,
    subject: "GLIX — Şifre sıfırlama",
    text: `GLIX hesabın için yeni bir şifre belirlemek üzere bu bağlantıyı aç:\n${link}\n\nBağlantı 1 saat geçerli.\n${IGNORE}`,
    html: page(
      "Şifre sıfırlama",
      "GLIX hesabın için yeni bir şifre belirlemek üzere aşağıdaki düğmeye dokun.",
      "Yeni şifre belirle",
      link,
      "Bağlantı 1 saat geçerli.",
    ),
  };
}

/** Yönetici paneli giriş kodu. Kod yalnız bu e-postada ve kısa süre geçerlidir; günlüğe yazılmaz. */
export function adminCodeMessage(to: string, code: string, minutes: number): MailMessage {
  const style = "font-family:Arial,Helvetica,sans-serif;";
  return {
    to,
    subject: "GLIX — Yönetici giriş kodu",
    text: `GLIX yönetici paneli giriş kodun: ${code}\n\nKod ${minutes} dakika geçerli ve bir kez kullanılır.\n${IGNORE}`,
    html: `<!doctype html><html lang="tr"><body style="margin:0;padding:24px;background:#111318;${style}">
<div style="max-width:480px;margin:0 auto;padding:28px;background:#1a1d24;border-radius:14px;color:#e8eaf0;${style}">
<h1 style="margin:0 0 16px;font-size:22px;color:#ffffff;">Yönetici giriş kodu</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;">GLIX yönetici paneline girmek için bu kodu yaz:</p>
<p style="margin:0 0 24px;font-size:34px;letter-spacing:8px;font-weight:bold;color:#33d6e8;">${code}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#a4a9b6;">Kod ${minutes} dakika geçerli ve bir kez kullanılır. ${IGNORE}</p>
</div></body></html>`,
  };
}
