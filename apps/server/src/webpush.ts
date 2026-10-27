import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  hkdfSync,
  randomBytes,
  sign as signData,
} from "node:crypto";

/**
 * Web Push, harici paket olmadan: VAPID (RFC 8292, ES256 JWT) ve ileti şifreleme (RFC 8291, aes128gcm / RFC 8188).
 * Yalnız `node:crypto` ve Node'un genel `fetch`i kullanılır.
 */

export interface VapidConfig {
  /** 65 baytlık sıkıştırılmamış P-256 genel anahtarı, base64url. */
  publicKey: string;
  /** 32 baytlık P-256 özel anahtarı, base64url. */
  privateKey: string;
  /** `mailto:` ya da `https://` adresi. */
  subject: string;
}

/** Tarayıcının verdiği abonelik (sunucuda yalnız bellekte tutulur). */
export interface PushTarget {
  endpoint: string;
  /** İstemci genel anahtarı (65 bayt), base64url. */
  p256dh: string;
  /** Kimlik doğrulama sırrı (16 bayt), base64url. */
  auth: string;
}

export type PushResult = "ok" | "gone" | "error";

/** Sunucunun bildirim göndermek için kullandığı arayüz; testlerde sahtesi verilir. */
export interface PushGateway {
  /** Yapılandırma geçerli ve gönderim açık mı. */
  readonly enabled: boolean;
  /** VAPID genel anahtarı (istemciye `welcome` ile bildirilir); kapalıysa null. */
  readonly publicKey: string | null;
  send(target: PushTarget, payload: string): Promise<PushResult>;
}

export const disabledPush: PushGateway = {
  enabled: false,
  publicKey: null,
  send: () => Promise.resolve("error"),
};

/** Bildirimin push servisinde bekleme süresi (sn) ve aciliyeti. */
export const PUSH_TTL_SECONDS = 60;
const SEND_TIMEOUT_MS = 5_000;
/** Aynı anda en çok bu kadar giden istek; fazlası atılır (bildirim ikincil, sunucuyu yormamalı). */
const MAX_IN_FLIGHT = 64;
/** VAPID belirteci 12 saat geçerli (RFC 8292: en çok 24 saat) ve 1 saat önbelleğe alınır. */
const JWT_LIFETIME_S = 12 * 3600;
const JWT_REUSE_MS = 3600_000;
/** Şifreli kayıt boyutu (RFC 8188 `rs`); tek kayıt kullanılır. */
const RECORD_SIZE = 4096;
/** Tek kayıtta düz metin üst sınırı: kayıt − GCM etiketi (16) − ayırıcı bayt (1). */
export const MAX_PLAINTEXT_BYTES = RECORD_SIZE - 16 - 1;

export const b64u = (buf: Uint8Array): string => Buffer.from(buf).toString("base64url");
export const fromB64u = (text: string): Buffer => Buffer.from(text, "base64url");

/** Sunucunun bildirim gönderdiği push servisleri. İstemciden gelen uç noktaya keyfi istek (SSRF) atılmasın diye. */
const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
] as const;

/** Uç nokta https, varsayılan portta ve bilinen bir push servisinde mi. */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "")
    return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_PUSH_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

// ---------------------------------------------------------------- VAPID

/** Genel anahtar (65 bayt) ve özel anahtar (32 bayt) biçimini ve eşleşmesini denetler; geçersizse hata fırlatır. */
export function validateVapid(config: VapidConfig): void {
  const pub = fromB64u(config.publicKey);
  const priv = fromB64u(config.privateKey);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error("VAPID genel anahtarı geçersiz");
  if (priv.length !== 32) throw new Error("VAPID özel anahtarı geçersiz");
  if (!/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(config.subject))
    throw new Error("VAPID konusu mailto: ya da https:// olmalı");
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(priv);
  if (!ecdh.getPublicKey().equals(pub)) throw new Error("VAPID anahtar çifti eşleşmiyor");
}

function jsonB64u(value: object): string {
  return b64u(Buffer.from(JSON.stringify(value)));
}

/** ES256 imzalı VAPID JWT'si (`aud` = push servisinin kökeni). İmza ham r||s (64 bayt). */
export function createVapidJwt(config: VapidConfig, audience: string, nowSeconds: number): string {
  const pub = fromB64u(config.publicKey);
  const key = createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      d: config.privateKey,
      x: b64u(pub.subarray(1, 33)),
      y: b64u(pub.subarray(33, 65)),
    },
  });
  const head = jsonB64u({ typ: "JWT", alg: "ES256" });
  const body = jsonB64u({ aud: audience, exp: nowSeconds + JWT_LIFETIME_S, sub: config.subject });
  const input = `${head}.${body}`;
  const signature = signData("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" });
  return `${input}.${b64u(signature)}`;
}

// ---------------------------------------------------------------- RFC 8291

export interface EncryptOptions {
  /** İstemci genel anahtarı (65 bayt). */
  uaPublic: Buffer;
  /** İstemci kimlik doğrulama sırrı (16 bayt). */
  authSecret: Buffer;
  /** Yalnız test (RFC 8291 örneği) için: 16 baytlık tuz ve sunucunun geçici özel anahtarı. */
  salt?: Buffer;
  asPrivate?: Buffer;
}

export interface EncryptedPush {
  /** Tüm gövde: başlık (tuz, rs, anahtar kimliği = sunucu genel anahtarı) + şifreli kayıt. */
  body: Buffer;
  /** Ara değerler (RFC 8291 ek A ile karşılaştırmak için). */
  parts: { salt: Buffer; asPublic: Buffer; ecdhSecret: Buffer; ikm: Buffer; cek: Buffer; nonce: Buffer };
}

const text = (s: string): Buffer => Buffer.from(s, "utf8");

/** RFC 8291 §3.4 + RFC 8188: aes128gcm, tek kayıt. */
export function encryptPayload(plaintext: Buffer, opts: EncryptOptions): EncryptedPush {
  if (plaintext.length > MAX_PLAINTEXT_BYTES) throw new Error("bildirim yükü çok büyük");
  if (opts.uaPublic.length !== 65 || opts.authSecret.length !== 16)
    throw new Error("abonelik anahtarları geçersiz");
  const ecdh = createECDH("prime256v1");
  if (opts.asPrivate) ecdh.setPrivateKey(opts.asPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const salt = opts.salt ?? randomBytes(16);
  const ecdhSecret = ecdh.computeSecret(opts.uaPublic);

  // WebPush: info || 0x00 || ua_public || as_public ; IKM = HKDF(auth_secret, ecdh_secret, key_info, 32)
  const keyInfo = Buffer.concat([text("WebPush: info\0"), opts.uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", ecdhSecret, opts.authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, text("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, text("Content-Encoding: nonce\0"), 12));

  // Son (tek) kayıt: düz metin + 0x02 ayırıcı.
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const record = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return {
    body: Buffer.concat([header, asPublic, record, cipher.getAuthTag()]),
    parts: { salt, asPublic, ecdhSecret, ikm, cek, nonce },
  };
}

// ---------------------------------------------------------------- gönderim

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: Buffer;
    redirect: "manual";
    signal: AbortSignal;
  },
) => Promise<{ status: number }>;

/** Yapılandırması doğrulanmış gerçek gönderici. Geçersiz yapılandırmada fırlatır. */
export function createWebPush(
  config: VapidConfig,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  nowMs: () => number = Date.now,
): PushGateway {
  validateVapid(config);
  const jwtCache = new Map<string, { token: string; madeAt: number }>();
  let inFlight = 0;

  const authorization = (endpoint: string): string => {
    const audience = new URL(endpoint).origin;
    const now = nowMs();
    let hit = jwtCache.get(audience);
    if (!hit || now - hit.madeAt > JWT_REUSE_MS) {
      hit = { token: createVapidJwt(config, audience, Math.floor(now / 1000)), madeAt: now };
      jwtCache.set(audience, hit);
    }
    return `vapid t=${hit.token}, k=${config.publicKey}`;
  };

  return {
    enabled: true,
    publicKey: config.publicKey,
    async send(target, payload) {
      if (inFlight >= MAX_IN_FLIGHT || !isAllowedPushEndpoint(target.endpoint)) return "error";
      inFlight += 1;
      try {
        const { body } = encryptPayload(Buffer.from(payload, "utf8"), {
          uaPublic: fromB64u(target.p256dh),
          authSecret: fromB64u(target.auth),
        });
        const res = await fetchImpl(target.endpoint, {
          method: "POST",
          headers: {
            Authorization: authorization(target.endpoint),
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            TTL: String(PUSH_TTL_SECONDS),
            Urgency: "high",
          },
          body,
          redirect: "manual",
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        if (res.status >= 200 && res.status < 300) return "ok";
        // 404/410: abonelik artık yok; yeniden denenmez.
        return res.status === 404 || res.status === 410 ? "gone" : "error";
      } catch {
        // Geçersiz anahtar, ağ hatası ya da zaman aşımı: bildirim ikincildir, sessizce vazgeçilir.
        return "error";
      } finally {
        inFlight -= 1;
      }
    },
  };
}
