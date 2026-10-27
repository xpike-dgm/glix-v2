import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeEmail } from "./auth.js";

/** Google OAuth ayarları; `GLIX_GOOGLE_CLIENT_ID/SECRET` ve `GLIX_PUBLIC_URL` üçü de doluysa vardır. */
export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  /** Google Cloud'da tanımlı yönlendirme adresi: `<GLIX_PUBLIC_URL>/api/auth/google/callback`. */
  redirectUri: string;
}

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";
export const GOOGLE_COOKIE = "glix_oauth";
/** Başlatılan akış ve bekleyen kayıt bu süre sonra düşer. */
export const GOOGLE_FLOW_TTL_MS = 10 * 60 * 1000;
/** Bellekteki akış/bekleyen kayıt sayısı üst sınırı (en eski silinir). */
const MAX_ENTRIES = 2000;
const REF_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ISSUERS: readonly string[] = ["https://accounts.google.com", "accounts.google.com"];

/** Sunucu içi Google ayarı + yarı bitmiş akışların belleği. */
export interface GoogleAuth {
  config: GoogleConfig;
  flows: GoogleFlows;
}

interface Flow {
  state: string;
  verifier: string;
  nonce: string;
  returnTo: string;
  expires: number;
}

interface Pending {
  sub: string;
  email: string;
  expires: number;
}

function rand(): string {
  return randomBytes(32).toString("base64url");
}

export function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Süresi dolanları atar; hâlâ doluysa en eskiyi siler (Map ekleme sırasını korur). */
function makeRoom<T extends { expires: number }>(map: Map<string, T>, now: number): void {
  if (map.size < MAX_ENTRIES) return;
  for (const [key, v] of map) if (v.expires <= now) map.delete(key);
  while (map.size >= MAX_ENTRIES) {
    const oldest = map.keys().next();
    if (oldest.done) break;
    map.delete(oldest.value);
  }
}

/**
 * Bellekte tutulan kısa ömürlü durum: (1) başlatılmış yetkilendirme akışları (state, PKCE, nonce),
 * (2) Google'dan geçmiş ama kullanıcı adı seçilmemiş kayıtlar. İkisi de tek kullanımlık ve 10 dk geçerlidir.
 * Sunucu yeniden başlarsa kullanıcı Google'a baştan gider; kalıcı olması gerekmez.
 */
export class GoogleFlows {
  private readonly flows = new Map<string, Flow>();
  private readonly pending = new Map<string, Pending>();

  /** Yeni akış; çerezde taşınacak başvuru anahtarı, `state`, PKCE doğrulayıcısı ve `nonce` döner. */
  begin(now: number, returnTo: string): { ref: string; state: string; verifier: string; nonce: string } {
    makeRoom(this.flows, now);
    const ref = rand();
    const flow: Flow = {
      state: rand(),
      verifier: rand(),
      nonce: rand(),
      returnTo,
      expires: now + GOOGLE_FLOW_TTL_MS,
    };
    this.flows.set(ref, flow);
    return { ref, state: flow.state, verifier: flow.verifier, nonce: flow.nonce };
  }

  /** Akışı tek seferlik alır (alınca silinir); yok ya da süresi dolmuşsa null. */
  take(ref: string | null, now: number): Flow | null {
    if (!ref || !REF_PATTERN.test(ref)) return null;
    const flow = this.flows.get(ref);
    this.flows.delete(ref);
    return flow && flow.expires > now ? flow : null;
  }

  addPending(now: number, sub: string, email: string): string {
    makeRoom(this.pending, now);
    const token = rand();
    this.pending.set(token, { sub, email, expires: now + GOOGLE_FLOW_TTL_MS });
    return token;
  }

  peekPending(token: string, now: number): { sub: string; email: string } | null {
    const p = this.pending.get(token);
    return p && p.expires > now ? p : null;
  }

  dropPending(token: string): void {
    this.pending.delete(token);
  }

  size(): number {
    return this.flows.size + this.pending.size;
  }
}

export function createGoogleAuth(config: GoogleConfig): GoogleAuth {
  return { config, flows: new GoogleFlows() };
}

// ---- Yardımcılar -----------------------------------------------------------------------------------------

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Dönüş yolu yalnız aynı kaynaktaki yol olabilir; aksi halde "/". */
export function safeReturnTo(value: string | null): string {
  if (!value || value.length > 200 || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/api/") || value.includes("\\")) return "/";
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return "/";
  }
  return value;
}

export function authorizeUrl(
  config: GoogleConfig,
  p: { state: string; verifier: string; nonce: string },
): string {
  const q = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email",
    state: p.state,
    nonce: p.nonce,
    code_challenge: pkceChallenge(p.verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${q.toString()}`;
}

/** E-postanın yerel kısmından kullanıcı adı önerisi: yalnız harf/rakam/alt çizgi, 3-20 karakter. */
export function suggestUsername(email: string): string {
  const local = (email.split("@")[0] ?? "").replace(/[.+-]+/g, "_").replace(/[^A-Za-z0-9_]/g, "");
  const trimmed = local.replace(/^_+|_+$/g, "").slice(0, 20);
  return trimmed.length >= 3 ? trimmed : "oyuncu";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export interface GoogleIdentity {
  sub: string;
  email: string;
}

export type ExchangeFailure = "exchange" | "claims" | "unverified";

/**
 * Kimlik belirteci doğrudan Google'ın belirteç uç noktasından TLS ile geldiği için imza denetimi atlanır
 * (OIDC Core 3.1.3.7); ama yayıncı, hedef kitle, süre, nonce ve doğrulanmış e-posta denetlenir.
 */
export function checkClaims(
  payload: unknown,
  config: GoogleConfig,
  nonce: string,
  nowMs: number,
): GoogleIdentity | ExchangeFailure {
  if (!isRecord(payload)) return "claims";
  const { iss, aud, exp, sub, email, email_verified: verified } = payload;
  if (typeof iss !== "string" || !ISSUERS.includes(iss)) return "claims";
  const audOk =
    aud === config.clientId ||
    (Array.isArray(aud) && aud.includes(config.clientId) && payload.azp === config.clientId);
  if (!audOk) return "claims";
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp * 1000 <= nowMs) return "claims";
  if (typeof payload.nonce !== "string" || !sameText(payload.nonce, nonce)) return "claims";
  if (typeof sub !== "string" || sub.length === 0 || sub.length > 255) return "claims";
  const mail = normalizeEmail(email);
  if (mail === null) return "claims";
  if (verified !== true && verified !== "true") return "unverified";
  return { sub, email: mail };
}

/** Yetkilendirme kodunu belirteç uç noktasında değiştirir ve kimliği doğrular. Belirteç/sır günlüğe yazılmaz. */
export async function exchangeCode(
  config: GoogleConfig,
  code: string,
  flow: { verifier: string; nonce: string },
  nowMs: number,
): Promise<GoogleIdentity | ExchangeFailure> {
  let data: unknown;
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
        code_verifier: flow.verifier,
      }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "exchange";
    data = await res.json();
  } catch {
    return "exchange";
  }
  if (!isRecord(data) || typeof data.id_token !== "string") return "exchange";
  const parts = data.id_token.split(".");
  if (parts.length !== 3 || !parts[1]) return "claims";
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return "claims";
  }
  return checkClaims(payload, config, flow.nonce, nowMs);
}
