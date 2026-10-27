import { haptics } from "../settings/settings.js";
import { reducedMotion } from "./motion.js";

type Pattern = number | readonly number[];

/** Azaltılmış harekette titreşimler yarıya iner (en az 6 ms); aralar aynı kalır. */
export function shapePattern(pattern: Pattern, reduced: boolean): number[] {
  const list = typeof pattern === "number" ? [pattern] : [...pattern];
  if (!reduced) return list;
  return list.map((ms, i) => (i % 2 === 0 ? Math.max(6, Math.round(ms / 2)) : ms));
}

export type HapticPath = "vibrate" | "ios-switch" | "none";

export interface PathInput {
  /** Ayarlar > Titreşim. */
  enabled: boolean;
  /** `navigator.vibrate` var (Android/Chromium). */
  hasVibrate: boolean;
  /** iOS 18+ Safari anahtar (switch) yolu kullanılabilir. */
  iosSwitch: boolean;
}

/** Hangi yoldan titreşilir: önce gerçek `vibrate`, yoksa iOS anahtar dokunuşu, yoksa hiç. */
export function pickHapticPath({ enabled, hasVibrate, iosSwitch }: PathInput): HapticPath {
  if (!enabled) return "none";
  if (hasVibrate) return "vibrate";
  return iosSwitch ? "ios-switch" : "none";
}

/** iPhone ve tarayıcı `<input switch>` görünümünü tanıyor (Safari 17.4+; sistem titreşimi iOS 18+). iPad'de titreşim motoru yok. */
export function iosSwitchSupported(userAgent: string, switchStyleSupported: boolean): boolean {
  return /iPhone|iPod/.test(userAgent) && switchStyleSupported;
}

/**
 * Anahtar yolu yalnız kullanıcının kendi dokunuşunun içinde çalışır; sunucudan gelen olaylarda
 * (etkin dokunuş yokken) denenmez. `userActivation` bilinmiyorsa (eski Safari) izin verilir.
 */
export function mayUseSwitch(isActive: boolean | undefined): boolean {
  return isActive !== false;
}

function hasVibrateApi(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

let switchSupport: boolean | undefined;
function iosSwitchAvailable(): boolean {
  if (switchSupport !== undefined) return switchSupport;
  try {
    switchSupport =
      typeof navigator !== "undefined" &&
      iosSwitchSupported(navigator.userAgent, CSS.supports("appearance", "switch"));
  } catch {
    switchSupport = false;
  }
  return switchSupport;
}

/** Bu cihazda hiçbir titreşim yolu yok: arayüz sarsıntı/parlamayı biraz güçlendirir (`data-haptics="none"`). */
export function hapticsUnavailable(): boolean {
  return (
    pickHapticPath({ enabled: true, hasVibrate: hasVibrateApi(), iosSwitch: iosSwitchAvailable() }) === "none"
  );
}

/** Kökteki `data-haptics` işaretini kurar; CSS `--shake-gain` buna bakar. Açılışta bir kez çağrılır. */
export function applyHapticsCompensation(
  root: HTMLElement | null = typeof document === "undefined" ? null : document.documentElement,
): void {
  if (!root) return;
  if (hapticsUnavailable()) root.dataset.haptics = "none";
  else delete root.dataset.haptics;
}

let switchLabel: HTMLLabelElement | null = null;
function iosTick(): void {
  if (!document.body) return;
  if (!switchLabel?.isConnected) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.append(input);
    document.body.append(label);
    switchLabel = label;
  }
  switchLabel.click();
}

function vibrate(pattern: Pattern): void {
  if (!haptics()) return;
  if (!haptics()) return;
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    // Tarayıcı kullanıcı dokunmadan titreşimi engeller (konsola uyarı yazar).
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate(shapePattern(pattern, reducedMotion()));
  } catch {
    // desteklenmiyor
  }
}

/** Ses olaylarıyla aynı adlar; her biri `sound.ts`'teki karşılığının titreşim eşleniği. */
/**
 * Kullanıcının kendi dokunuşunun doğrudan sonucu olan önemli anlar (bomba, tetik, eleme) için:
 * `vibrate` yoksa iOS anahtar dokunuşunu dener. Yalnız dokunma işleyicisinin içinden çağrılır;
 * sunucu olaylarında `hapticTap`/`hapticSolo` gibi sade sürümler kullanılır.
 */
export function hapticPress(pattern: Pattern = 10): void {
  const path = pickHapticPath({
    enabled: haptics(),
    hasVibrate: hasVibrateApi(),
    iosSwitch: iosSwitchAvailable(),
  });
  if (path === "vibrate") vibrate(pattern);
  else if (path === "ios-switch") {
    try {
      if (mayUseSwitch(navigator.userActivation?.isActive)) iosTick();
    } catch {
      // desteklenmiyor
    }
  }
}

export const hapticTap = (): void => vibrate(10);
export const hapticReady = (): void => vibrate([12, 30, 24]);
export const hapticTick = (): void => vibrate(6);
export const hapticGo = (): void => vibrate(32);
export const hapticMatch = (): void => vibrate([14, 40, 14]);
export const hapticSolo = (): void => vibrate(45);
export const hapticResult = (): void => vibrate([10, 50, 10, 50, 22]);
export const hapticFinal = (): void => vibrate([20, 60, 20, 60, 20, 60, 70]);
export const hapticError = (): void => vibrate([30, 60, 30]);
