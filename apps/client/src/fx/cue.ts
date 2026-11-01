import { type Accessor, createEffect, createMemo, untrack } from "solid-js";

/**
 * Ses (ve titreşim) tetikleyicileri için güvence. Solid'in `on(kaynak, fn)` yardımcısı kaynağın değerini
 * karşılaştırmaz: kaynak içinde okunan herhangi bir sinyal (her karede ilerleyen saat, her durum güncellemesinde
 * yeniden üretilen görünüm) değişince `fn` yeniden çalışır; değer aynı kalsa bile. "Aşama değişince çal" diye yazılan
 * bir etki böylece her saniye aynı sesi yeniden çalar.
 *
 * `onChange`, kaynağı önce bir memo'dan geçirir (=== ile): `fn` yalnız değer gerçekten değişince çalışır.
 * `fn` izlenmez (içinde okunan sinyaller etkiyi yeniden tetiklemez).
 */
export function onChange<T>(
  source: Accessor<T>,
  fn: (value: T, prev: T | undefined) => void,
  options?: { defer?: boolean },
): void {
  const value = createMemo(source);
  let first = true;
  let prev: T | undefined;
  createEffect(() => {
    const v = value();
    const p = prev;
    prev = v;
    if (first) {
      first = false;
      if (options?.defer) return;
    }
    untrack(() => fn(v, p));
  });
}

/**
 * Olay kimliği başına tek sefer: aynı kimlikle ikinci çağrı hiçbir şey yapmaz. Ekranın ömrü boyunca geçerlidir
 * (ör. `go:${el}`, `bell:${tur}`); ağdan aynı durum tekrar gelse de, etki yeniden çalışsa da ses bir kez çalar.
 * true: `fn` bu çağrıda çalıştı.
 */
export function createOnce(): (id: string | number, fn: () => void) => boolean {
  const seen = new Set<string | number>();
  return (id, fn) => {
    if (seen.has(id)) return false;
    seen.add(id);
    fn();
    return true;
  };
}

/**
 * Evre geçişi sesi: `key` (ör. `${evre}:${el}`) her yeni değer aldığında `fn` bir kez çalışır; aynı anahtar
 * ikinci kez gelse de (yeniden bağlanma, aynı durumun tekrarı) yeniden çalışmaz. `opening`: ekran bu anahtarla
 * açıldı (geçişi görmedi); geç açılan ekranda geçmiş anın sesini çalıp çalmamaya `fn` karar verir.
 */
export function onPhaseKey(key: Accessor<string>, fn: (key: string, opening: boolean) => void): void {
  const once = createOnce();
  onChange(key, (k, prev) => {
    once(k, () => fn(k, prev === undefined));
  });
}
