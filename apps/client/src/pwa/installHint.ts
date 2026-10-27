export type InstallHint = "prompt" | "ios" | null;

export interface HintInput {
  /** Uygulama zaten ana ekrandan (bağımsız pencerede) açık. */
  standalone: boolean;
  /** Oyuncu ipucunu daha önce kapattı. */
  dismissed: boolean;
  /** Chromium `beforeinstallprompt` olayını verdi. */
  canPrompt: boolean;
  /** iOS Safari (kurulu değil). */
  iosSafari: boolean;
  /** Oyuncu en az bir maçı sonuna kadar oynadı (ilk ziyarette ipucu çıkmaz). */
  firstMatchDone: boolean;
}

/** Hangi kurulum ipucu gösterilir: Chromium için "Yükle" düğmesi, iOS Safari için tek satırlık yönerge. */
export function pickInstallHint({
  standalone,
  dismissed,
  canPrompt,
  iosSafari,
  firstMatchDone,
}: HintInput): InstallHint {
  if (standalone || dismissed || !firstMatchDone) return null;
  if (canPrompt) return "prompt";
  if (iosSafari) return "ios";
  return null;
}

interface UaInput {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}

/** iPhone/iPad Safari (iPadOS 13+ kendini Macintosh diye tanıtır; dokunmatik olması ayırır). Diğer iOS tarayıcıları hariç. */
export function isIosSafari({ userAgent, platform, maxTouchPoints }: UaInput): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  if (!ios) return false;
  return /Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent);
}
