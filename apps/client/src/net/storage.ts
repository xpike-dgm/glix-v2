/** localStorage her yerde kapalı olabilir; hepsi sessizce düşer. */
export const KEYS = { token: "glix.token", nickname: "glix.nick", muted: "glix.muted" } as const;

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // yok sayılır
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // yok sayılır
  }
}
