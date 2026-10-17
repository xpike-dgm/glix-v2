import { ROOM_CODE_LENGTH } from "@glix/engine";

/** Oda kodu girdisini düzeltir: büyük harf, yalnız A–Z/0–9, en çok 5; yapıştırılan bağlantıdan `oda=` alınır. */
export function normalizeCode(input: string): string {
  const fromLink = /[?&]oda=([A-Za-z0-9]+)/i.exec(input);
  const raw = fromLink?.[1] ?? input;
  return raw
    .replace(/İ/g, "I")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}

export function isCompleteCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH;
}

export function inviteLink(origin: string, code: string): string {
  return `${origin}/?oda=${code}`;
}
