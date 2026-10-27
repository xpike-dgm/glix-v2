/** localStorage her yerde kapalı olabilir; hepsi sessizce düşer. */
export const KEYS = {
  token: "glix.token",
  nickname: "glix.nick",
  muted: "glix.muted",
  /** Efekt düzeyi (eskiden tek "ses düzeyi"; mevcut değer efektlere taşındı). */
  volume: "glix.volume",
  /** Müzik düzeyi; yoksa efekt düzeyinin %60'ı. */
  musicVolume: "glix.musicVolume",
  installHint: "glix.installHint",
  /** İlk maç sonuna kadar oynandı: kurulum ipucu bundan sonra çıkar. */
  firstMatch: "glix.firstMatch",
  sessizdeCal: "glix.sessizdeCal",
  avatar: "glix.avatar",
  haptics: "glix.haptics",
  motion: "glix.motion",
  textSize: "glix.textSize",
  colorBlind: "glix.colorBlind",
  dataSaver: "glix.dataSaver",
  telemetry: "glix.telemetry",
  wifiOnly: "glix.wifiOnly",
  /** İçerik paketi: tamamlanan sürüm; "off" = kullanıcı önbelleği temizledi, kendiliğinden indirme yok. */
  packState: "glix.packState",
} as const;

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

/** Cihazın son seçtiği karakter (0–7); yoksa ya da bozuksa undefined. */
export function readAvatarChoice(): number | undefined {
  const raw = readStored(KEYS.avatar);
  if (raw === null || !/^[0-7]$/.test(raw)) return undefined;
  return Number(raw);
}
