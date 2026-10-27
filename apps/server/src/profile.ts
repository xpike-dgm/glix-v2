import type { IncomingMessage, ServerResponse } from "node:http";
import type { AccountStore, ProfileData } from "./accountStore.js";
import { accountFromCookie, USERNAME_PATTERN } from "./auth.js";
import { log } from "./log.js";
import { SECURITY_HEADERS } from "./static.js";

export const PROFILE_PATH = "/api/profile";

export interface ProfileEnv {
  accounts: AccountStore;
  now: number;
  /** Oyun kimliğinden görünen ad (katalogdaki ad); bilinmeyen oyun için null. */
  gameName: (id: string) => string | null;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(body));
}

/** Yanıt gövdesi; oyun adı eklenir. Silinmiş/bilinmeyen oyun için ad "Eski oyun" olur. */
export function profileBody(
  data: ProfileData,
  gameName: ProfileEnv["gameName"],
  full: boolean,
): Record<string, unknown> {
  const name = (id: string): string => gameName(id) ?? "Eski oyun";
  return {
    ok: true,
    username: data.username,
    createdAt: data.createdAt,
    totals: data.totals,
    favoriteGame: data.favoriteGame ? { ...data.favoriteGame, name: name(data.favoriteGame.id) } : null,
    perGame: data.perGame.map((g) => ({ ...g, name: name(g.gameId) })),
    ...(full ? { recent: data.recent, coPlayers: data.coPlayers } : {}),
  };
}

type Outcome =
  | { status: 200; body: Record<string, unknown> }
  | { status: 401 | 404 | 405 | 500; code: string; message: string };

const NOT_FOUND: Outcome = { status: 404, code: "not_found", message: "Böyle bir oyuncu yok." };

function resolve(req: IncomingMessage, env: ProfileEnv): Outcome {
  if (req.method !== "GET")
    return { status: 405, code: "method_not_allowed", message: "Bu istek desteklenmiyor." };
  const account = accountFromCookie(env.accounts, req.headers.cookie, env.now);
  if (!account) return { status: 401, code: "login_required", message: "Önce giriş yap." };
  const path = (req.url ?? "").split("?")[0] ?? "";
  const rest = path.slice(PROFILE_PATH.length);
  let full = true;
  if (rest !== "" && rest !== "/") {
    let name: string;
    try {
      name = decodeURIComponent(rest.slice(1));
    } catch {
      return NOT_FOUND;
    }
    const found = USERNAME_PATTERN.test(name) ? env.accounts.findByUsername(name) : null;
    // Kendi profiline bakmak serbest; başkasınınki arkadaşlık gelene dek bulunmamış sayılır (varlığı sızmaz).
    if (!found || found.id !== account.id) return NOT_FOUND;
    full = false;
  }
  const data = env.accounts.profile(account.id, full);
  return data ? { status: 200, body: profileBody(data, env.gameName, full) } : NOT_FOUND;
}

/**
 * `GET /api/profile` (oturumdaki hesabın tam profili) ve `GET /api/profile/<kullanıcı>` (toplamlar, favori oyun,
 * oyun başına sonuçlar). Başkasının profili şimdilik 404: arkadaşlık (H7) gelince arkadaşlara açılacak.
 */
export function handleProfile(req: IncomingMessage, res: ServerResponse, env: ProfileEnv): void {
  let out: Outcome;
  try {
    out = resolve(req, env);
  } catch (err) {
    log.error("accounts_error", { op: "profile", error: String(err) });
    out = { status: 500, code: "server_error", message: "Bir sorun oluştu, biraz sonra tekrar dene." };
  }
  if (out.status === 200) send(res, 200, out.body);
  else send(res, out.status, { ok: false, code: out.code, message: out.message });
}
