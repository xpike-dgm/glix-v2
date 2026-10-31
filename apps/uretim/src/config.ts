/** Ortam değişkenleri (docs/uretim/SOZLESME.md bölüm 6 + sitenin kendi ayarları). */
import { resolve } from "node:path";

export interface UretimConfig {
  host: string;
  port: number;
  /** SQLite dosyası. */
  db: string;
  depoDir: string;
  aktarimDir: string;
  /** Oyun deposunun salt okunur aynası (boşsa katalog eşitlemesi kapalı). */
  repoDir: string | null;
  /** Oyun sunucusunun iç adresi (boşsa oyun uçları kapalı). */
  oyunUrl: string | null;
  oyunToken: string | null;
  sahipEpostalar: string[];
  resendKey: string | null;
  mailFrom: string | null;
  publicUrl: string;
  onizlemeUrl: string;
  yedekDir: string | null;
  webDir: string;
  trustProxy: boolean;
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  /** Toplam depo kotası (bayt). */
  kota: number;
  /** Saat dilimi (günlük özet ve sessiz saatler). */
  saatDilimi: string;
  /** İstek → iş dönüştürücü modelin anahtarı (UM-R1); boşsa sabit kalıp. */
  aiKey: string | null;
  aiGunluk: number;
  /** SSH istemlerinde görünen sunucu adı (sır değil). */
  sshSunucu: string;
  /** Sırların şifreli kaydı için anahtar (bölüm 9); boşsa SSH parolası ve istemde anahtar doldurma kapalı. */
  gizliAnahtar: string | null;
  /** Sunucudaki giriş kayıtları (yalnız uretim-* satırları; ssh/girisler.sh yazar). */
  sshGunluk: string | null;
}

const bos = (v: string | undefined): string | null => (v && v.trim() !== "" ? v.trim() : null);

export function readConfig(env: NodeJS.ProcessEnv = process.env): UretimConfig {
  const vapidPublic = bos(env.URETIM_VAPID_PUBLIC);
  const vapidPrivate = bos(env.URETIM_VAPID_PRIVATE);
  const vapidSubject = bos(env.URETIM_VAPID_SUBJECT);
  const port = Number(env.PORT ?? "3910");
  const kotaGb = Number(env.URETIM_KOTA_GB ?? "20");
  return {
    host: env.HOST ?? "127.0.0.1",
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 3910,
    db: env.URETIM_DB ?? resolve("uretim-veri/uretim.db"),
    depoDir: env.URETIM_DEPO_DIR ?? resolve("uretim-veri/depo"),
    aktarimDir: env.URETIM_AKTARIM_DIR ?? resolve("uretim-veri/aktarim"),
    repoDir: bos(env.URETIM_REPO_DIR),
    oyunUrl: bos(env.URETIM_OYUN_URL)?.replace(/\/+$/, "") ?? null,
    oyunToken: bos(env.GLIX_URETIM_TOKEN),
    sahipEpostalar: (env.URETIM_SAHIP_EPOSTA ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(e)),
    resendKey: bos(env.GLIX_RESEND_API_KEY),
    mailFrom: bos(env.GLIX_MAIL_FROM),
    publicUrl: (bos(env.URETIM_PUBLIC_URL) ?? "http://localhost:3910").replace(/\/+$/, ""),
    onizlemeUrl: bos(env.URETIM_ONIZLEME_URL) ?? "https://glix.dgmcraft.online/onizleme.html",
    yedekDir: bos(env.URETIM_YEDEK_DIR),
    webDir: env.URETIM_WEB_DIR ?? resolve(import.meta.dirname, "../dist/web"),
    trustProxy: env.TRUST_PROXY === "1",
    vapid:
      vapidPublic && vapidPrivate && vapidSubject
        ? { publicKey: vapidPublic, privateKey: vapidPrivate, subject: vapidSubject }
        : null,
    kota: (Number.isFinite(kotaGb) && kotaGb > 0 ? kotaGb : 20) * 1024 ** 3,
    saatDilimi: env.URETIM_SAAT_DILIMI ?? "Europe/Istanbul",
    aiKey: bos(env.URETIM_AI_KEY),
    aiGunluk: Number(env.URETIM_AI_GUNLUK ?? "") > 0 ? Number(env.URETIM_AI_GUNLUK) : 200,
    sshSunucu: bos(env.URETIM_SSH_SUNUCU) ?? "dgmcraft.online",
    gizliAnahtar: bos(env.URETIM_GIZLI_ANAHTAR),
    sshGunluk: bos(env.URETIM_SSH_GUNLUK),
  };
}
