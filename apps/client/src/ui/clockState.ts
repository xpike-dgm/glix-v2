/** Süre bileşeninin saf hesabı: pencere (başlangıç/bitiş) ve şimdiki zamandan çubuğun durumu. */

/** Son bu kadar ms kala çubuk kalınlaşır, kızarır, sayı görünür. */
export const URGENT_MS = 5000;

export interface ClockWindow {
  startedAt: number;
  endsAt: number;
  /** Son saniyelerde kırmızı/sayı/tik olsun (yalnız karar süreleri için). */
  urgency: boolean;
}

export type ClockTone = "normal" | "urgent";

export interface ClockView {
  /** Kalan oran 0..1. */
  fraction: number;
  tone: ClockTone;
  /** Urgent iken görünen tam saniye (yukarı yuvarlı); aksi halde null. */
  secs: number | null;
}

export function clockView(win: ClockWindow | null, now: number): ClockView {
  if (!win) return { fraction: 0, tone: "normal", secs: null };
  const total = Math.max(1, win.endsAt - win.startedAt);
  const leftMs = win.endsAt - now;
  const fraction = Math.min(1, Math.max(0, leftMs / total));
  const urgent = win.urgency && leftMs > 0 && leftMs <= URGENT_MS;
  return {
    fraction,
    tone: urgent ? "urgent" : "normal",
    secs: urgent ? Math.max(1, Math.ceil(leftMs / 1000)) : null,
  };
}

/** Doğal geri sayımda bir karede çubuğun azalacağı en büyük oran; daha büyük fark sıçramadır. */
const NATURAL_GAP = 0.012;
/** Erken bitişte çubuğun hedefe yaklaşma zaman sabiti (ms). */
const CLOSE_TAU_MS = 150;

/**
 * Gösterilen oranı hedefe taşır. Doğal geri sayımda doğrudan hedeftir; hedef birden düştüyse
 * (pencere erken bitti) yumuşakça kapanır; hedef yükseldiyse (yeni pencere) hemen oturur.
 * Azaltılmış harekette de çubuk yumuşak kapanır (renk ve boyut değişir, titreme yok).
 */
export function stepFraction(shown: number, target: number, dtMs: number): number {
  if (target >= shown) return target;
  const gap = shown - target;
  if (gap <= NATURAL_GAP) return target;
  const k = 1 - Math.exp(-Math.max(0, dtMs) / CLOSE_TAU_MS);
  const next = shown - gap * k;
  return next - target < 0.002 ? target : next;
}

/** Pencere öncekinden erkene alındı mı (erken bitiş)? */
export function movedEarlier(prev: ClockWindow | null, next: ClockWindow | null, now: number): boolean {
  if (!prev || !next) return false;
  return next.endsAt < prev.endsAt && prev.endsAt > now;
}

/** Tik yalnız urgent iken ve saniye değiştiğinde çalar. */
export function shouldTick(prevSecs: number | null, view: ClockView): boolean {
  return view.secs !== null && view.secs !== prevSecs;
}

/** Gerilim yatağı bu kadar ms kala başlar. */
export const TENSION_MS = 10_000;

/**
 * Gerilim müziği yoğunluğu 0..1 (0: kapalı). Yalnız karar süreleri (`urgency`) ve süresi görünen oyunlar için;
 * pencere yok, bitti ya da 10 sn'den uzaksa 0. `visible` false ise (saati gizli oyun) her zaman 0: gerilim
 * ritmi kalan süreyi ele vereceğinden süresi gizli oyunlarda asla çalmaz.
 */
export function tensionLevel(win: ClockWindow | null, now: number, visible: boolean): number {
  if (!visible || !win || !win.urgency) return 0;
  const left = win.endsAt - now;
  if (left <= 0 || left > TENSION_MS) return 0;
  return Math.min(1, Math.max(0.05, 1 - left / TENSION_MS));
}
