import { createEffect, createSignal, onCleanup, untrack } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { fail, tap, unlockAudio } from "../fx/sound.js";

/** Izgara sütun sayısı. Alçak (yatay telefon) ekranda daha geniş, dik ekranda en çok 3 sütun. */
export function pickerColumns(count: number, short = false): number {
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return short ? 4 : 3;
}

interface PendingPickOptions {
  /** Sunucunun onayladığı seçim. */
  server: () => string | null | undefined;
  send: (id: string) => void;
  /** true iken seçim yapılamaz (süre doldu, izleyici). */
  closed: () => boolean;
  /** Sunucu onaylamazsa yerel seçimin geri alınma süresi (ms). */
  timeoutMs?: number;
}

/**
 * Oyuncu seçici için iyimser seçim: dokununca anında gösterilir, sunucu onaylayınca yerel değer düşer;
 * onay gelmezse eski haline döner. Ses ve titreşim burada verilir.
 */
export function createPendingPick(opts: PendingPickOptions) {
  const [pending, setPending] = createSignal<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  createEffect(() => {
    const confirmed = opts.server() ?? null;
    if (untrack(pending) !== null && confirmed === untrack(pending)) setPending(null);
  });
  const value = (): string | null => pending() ?? opts.server() ?? null;
  const pick = (id: string): void => {
    if (opts.closed()) return;
    unlockAudio();
    tap();
    hapticTap();
    if (value() === id) return;
    setPending(id);
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (pending() !== null) {
        setPending(null);
        fail();
      }
    }, opts.timeoutMs ?? 1600);
    opts.send(id);
  };
  return { value, pick };
}
