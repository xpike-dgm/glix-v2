/**
 * Taslak (SB-U11): yazdığın sahte tanım cihazda (sekme oturumunda) geçici saklanır; sayfa yenilenir ya da bağlantı kısa
 * koparsa alan aynı yazıyla geri gelir. Yalnız o oyunun yazma aşaması boyunca tutulur; gönderince ve oyun bitince
 * silinir. Sunucuya gitmez. Depolama kapalıysa sessizce hiçbir şey yapmaz.
 */
const PREFIX = "glix.sozluk.taslak:";

/** Taslak anahtarı: aynı oyun (başlangıç anı + kelime) dışında hiçbir taslak geri gelmez. */
export const draftKey = (startedAt: number, word: string): string => `${PREFIX}${startedAt}:${word}`;

function store(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function readDraft(key: string): string {
  try {
    return store()?.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function writeDraft(key: string, text: string): void {
  const s = store();
  if (!s) return;
  try {
    // Başka oyunların taslakları bırakılmaz: tek taslak tutulur.
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX) && k !== key) s.removeItem(k);
    }
    if (text === "") s.removeItem(key);
    else s.setItem(key, text.slice(0, 400));
  } catch {
    // depolama dolu ya da kapalı
  }
}

/** Bütün Sözlük Blöfü taslaklarını siler (gönderince, oyun bitince). */
export function clearDrafts(): void {
  const s = store();
  if (!s) return;
  try {
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) s.removeItem(k);
    }
  } catch {
    // yok say
  }
}
