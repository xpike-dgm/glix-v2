import { FOOTER_TEXT } from "./drawCard.js";

export type ShareOutcome = "shared" | "cancelled" | "unsupported";

interface ShareNav {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
}

export function cardFile(blob: Blob, name: string): File {
  return new File([blob], `${name}.png`, { type: "image/png" });
}

/** Bu cihazda dosyalı Web Share var mı (iOS/Android Safari-Chrome: evet; masaüstü çoğunlukla hayır). */
export function canShareFiles(nav: ShareNav | undefined, file: File): boolean {
  if (!nav || typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Dosyayı sistem paylaşım sayfasıyla paylaşır; kullanıcı vazgeçerse "cancelled". Desteklenmiyorsa "unsupported". */
export async function shareCard(nav: ShareNav | undefined, file: File): Promise<ShareOutcome> {
  if (!nav?.share || !canShareFiles(nav, file)) return "unsupported";
  try {
    await nav.share({ files: [file], title: "GLIX", text: FOOTER_TEXT });
    return "shared";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

/** Yedek: dosyayı indirir. */
export function downloadCard(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
