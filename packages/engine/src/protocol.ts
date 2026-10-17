export const PROTOCOL_VERSION = 1;
export const APP_VERSION = "0.0.1";

export const MAX_MESSAGE_LENGTH = 4096;

export type ClientMessage = { type: "hello"; clientVersion: string } | { type: "ping"; t: number };

export type ServerMessage =
  | { type: "welcome"; protocolVersion: number; serverVersion: string }
  | { type: "pong"; t: number; serverTime: number }
  | { type: "error"; code: string; message: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasOnlyKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(obj).every((k) => keys.includes(k));
}

/** Ağdan gelen ham metni doğrular; geçersizse null döner. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE_LENGTH) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  switch (data.type) {
    case "hello": {
      if (!hasOnlyKeys(data, ["type", "clientVersion"])) return null;
      const v = data.clientVersion;
      if (typeof v !== "string" || v.length === 0 || v.length > 64) return null;
      return { type: "hello", clientVersion: v };
    }
    case "ping": {
      if (!hasOnlyKeys(data, ["type", "t"])) return null;
      const t = data.t;
      if (typeof t !== "number" || !Number.isFinite(t)) return null;
      return { type: "ping", t };
    }
    default:
      return null;
  }
}
