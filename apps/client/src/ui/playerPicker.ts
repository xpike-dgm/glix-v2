import { hapticTap } from "../fx/haptics.js";
import { tap, unlockAudio } from "../fx/sound.js";
import { type AckLike, createOptimistic, toAck } from "./optimistic.js";

/** Izgara sütun sayısı. Alçak (yatay telefon) ekranda daha geniş, dik ekranda en çok 3 sütun. */
export function pickerColumns(count: number, short = false): number {
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return short ? 4 : 3;
}

interface PendingPickOptions {
  /** Sunucunun onayladığı seçim. */
  server: () => string | null | undefined;
  /** Seçimi sunucuya gönderir; yanıt (`sendActionAck`) dönerse reddedilmede seçim geri alınır. */
  send: (id: string) => AckLike;
  /** true iken seçim yapılamaz (süre doldu, izleyici). */
  closed: () => boolean;
  /** Sunucu onaylamazsa yerel seçimin geri alınma süresi (ms). */
  timeoutMs?: number;
}

/**
 * Oyuncu seçici için iyimser seçim: dokununca anında gösterilir (`createOptimistic`), sunucu onaylayınca
 * yerel değer düşer; reddedilirse ya da onay gelmezse eski haline döner. Ses ve titreşim burada verilir.
 */
export function createPendingPick(opts: PendingPickOptions) {
  const [value, setValue] = createOptimistic<string | null>(() => opts.server() ?? null, {
    ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
  });
  const pick = (id: string): void => {
    if (opts.closed()) return;
    unlockAudio();
    tap();
    hapticTap();
    if (value() === id) return;
    setValue(id, () => toAck(opts.send(id)));
  };
  return { value, pick };
}
