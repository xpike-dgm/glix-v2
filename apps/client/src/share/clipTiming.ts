/**
 * Dans klibinin zamanlaması (saf mantık). Klip süresi duvar saatine bağlıdır, kare sayısına değil: kare düşse de
 * klip uzamaz, dans doğru anda kalır (kaydedici kareleri gerçek zamanla damgalar).
 */
export const CLIP_SECONDS = 5;
export const CLIP_FPS = 30;
/** Başta ve sonda siyahtan açılma / kararma süresi (sn). */
export const CLIP_FADE = 0.4;
/** Zafer kutlaması bu andan sonra patlar (sn). */
export const CELEBRATION_AT = 0.35;

/** Başlangıçtan geçen milisaniyeden klip zamanı (sn); 0..CLIP_SECONDS arasına sıkıştırılır. */
export const clipTime = (elapsedMs: number): number =>
  Math.min(CLIP_SECONDS, Math.max(0, (Number.isFinite(elapsedMs) ? elapsedMs : 0) / 1000));

export const clipDone = (elapsedMs: number): boolean => elapsedMs / 1000 >= CLIP_SECONDS;

/** 0..1 ilerleme (arayüzdeki çubuk). */
export const clipProgress = (t: number): number => Math.min(1, Math.max(0, t / CLIP_SECONDS));

/** Açılma ve kararma için 0..1 görünürlük. */
export function clipFade(t: number): number {
  const a = Math.min(1, Math.max(0, t / CLIP_FADE));
  const b = Math.min(1, Math.max(0, (CLIP_SECONDS - t) / CLIP_FADE));
  return Math.min(a, b);
}

/**
 * Önceki ve şimdiki klip zamanı arasındaki ilerleme (sn). Çizilen kare sayısından bağımsız: toplam her zaman
 * son zamandır. Geri giden saat sıfır sayılır.
 */
export const stepSeconds = (prevT: number, nowT: number): number => Math.max(0, nowT - prevT);

/** Kayıt sırasında kaç kare beklenir (kayıt boyutu/ilerleme tahmini için). */
export const expectedFrames = (): number => CLIP_SECONDS * CLIP_FPS;
