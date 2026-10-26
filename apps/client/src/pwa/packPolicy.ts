import type { ScreenId } from "../screens/route.js";
import { isSafeScreen } from "./updatePolicy.js";

/** Bağlantı bilgisi (Network Information API; her tarayıcıda yok, yoksa "bilinmiyor" = kısıtlı değil). */
export interface NetworkInfo {
  cellular: boolean;
  /** Tarayıcının veri tasarrufu isteği (`saveData`). */
  saveData: boolean;
}

export function readNetwork(nav?: unknown): NetworkInfo {
  const n = nav ?? (typeof navigator === "undefined" ? undefined : navigator);
  const c = (n as { connection?: { type?: string; saveData?: boolean } } | undefined)?.connection;
  return { cellular: c?.type === "cellular", saveData: c?.saveData === true };
}

/** Ana ekrandan açıldı mı? (Android/Chromium: display-mode; iOS: navigator.standalone.) */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  try {
    return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
  } catch {
    return nav.standalone === true;
  }
}

/**
 * Açılışta ne yapılır:
 * - none: hiçbir şey.
 * - screen: tam ekran "Hazırlanıyor", hemen indirmeye başlar.
 * - ask: tam ekran, önce sorar (mobil veri ya da veri tasarrufu).
 * - background: ekran yok; kısıtlar elverdikçe güvenli ekranlarda sessiz indirir.
 */
export type LaunchPlan = "none" | "screen" | "ask" | "background";

export interface LaunchInput {
  standalone: boolean;
  /** Link/QR ile (`?oda=`) geldi. */
  guest: boolean;
  /** Paket bu cihazda daha önce hiç tamamlanmadı ve silinmedi. */
  firstTime: boolean;
  /** Kullanıcı önbelleği kendisi temizledi: sormadan indirme. */
  optedOut: boolean;
  dataSaver: boolean;
  net: NetworkInfo;
  /** Paket eksiksiz mi. */
  complete: boolean;
}

export function planLaunch(i: LaunchInput): LaunchPlan {
  if (i.complete) return "none";
  if (i.guest) return "background";
  if (!i.firstTime) return i.optedOut ? "none" : "background";
  if (!i.standalone) return "none";
  return i.dataSaver || i.net.saveData || i.net.cellular ? "ask" : "screen";
}

export interface RunGate {
  /** Kullanıcı bilerek istedi (Ayarlar, "Şimdi indir"): ağ kısıtları yok sayılır. */
  foreground: boolean;
  dataSaver: boolean;
  wifiOnly: boolean;
  /** "Wi-Fi'yi bekle" seçildi: mobil veride asla. */
  requireWifi: boolean;
  net: NetworkInfo;
  online: boolean;
  screen: ScreenId;
  /** Daha önce kopan indirme için bekleme süresi bitti mi. */
  cooledDown: boolean;
}

/** İndirme şimdi çalışabilir mi? Maç sürerken (güvenli olmayan ekran) hiçbir zaman. */
export function mayRun(g: RunGate): boolean {
  if (!g.online || !g.cooledDown || !isSafeScreen(g.screen)) return false;
  if (g.foreground) return true;
  if (g.dataSaver || g.net.saveData) return false;
  if (g.net.cellular && (g.wifiOnly || g.requireWifi)) return false;
  return true;
}

export const FOREGROUND_CONCURRENCY = 5;
export const BACKGROUND_CONCURRENCY = 3;
/** Arka plan ilk ekran yerleştikten sonra bu kadar bekler (ms). */
export const BACKGROUND_DELAY_MS = 3000;
/** Kopan indirmeden sonra yeniden denemeden önce bekleme (ms). */
export const RETRY_COOLDOWN_MS = 30_000;

/** Bayt → "3,2" (MB, Türkçe ondalık). */
export function megabytes(bytes: number): string {
  const mb = Math.max(0, bytes) / (1024 * 1024);
  return (mb >= 10 ? Math.round(mb).toString() : mb.toFixed(1)).replace(".", ",");
}

/** 0–1 arası ilerleme oranı. */
export function fraction(done: number, total: number): number {
  return total <= 0 ? 0 : Math.min(1, Math.max(0, done / total));
}
