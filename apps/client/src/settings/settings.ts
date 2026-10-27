import { createSignal } from "solid-js";
import { KEYS, readStored, writeStored } from "../net/storage.js";

/**
 * Ayarların tek kaynağı. Her ayar: bir sinyal (okuyan her yer kendiliğinden güncellenir), bir okuyucu
 * (bozuk değer varsayılana düşer) ve kalıcı bir yazıcı. Ses düzeyi/sessiz `fx/sound.ts`, "Sessiz modda da çal"
 * `fx/audioSession.ts` içinde yaşar; burada yinelenmez.
 * "Renk körlüğü dostu mod": kökte `data-cb="1"`; renkle verilen her bilgiye şekil/desen/yazı ikinci ipucu olarak biner.
 */

export type MotionPref = "auto" | "reduce" | "full";
export type TextSize = "normal" | "large";

export const MOTION_CHOICES: readonly MotionPref[] = ["auto", "reduce", "full"];
export const TEXT_CHOICES: readonly TextSize[] = ["normal", "large"];

export function parseFlag(raw: string | null, fallback: boolean): boolean {
  if (raw === "1") return true;
  if (raw === "0") return false;
  return fallback;
}

export function parseChoice<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === raw) ?? fallback;
}

const [haptics, setHapticsSignal] = createSignal(parseFlag(readStored(KEYS.haptics), true));
const [motion, setMotionSignal] = createSignal<MotionPref>(
  parseChoice(readStored(KEYS.motion), MOTION_CHOICES, "auto"),
);
const [textSize, setTextSizeSignal] = createSignal<TextSize>(
  parseChoice(readStored(KEYS.textSize), TEXT_CHOICES, "normal"),
);
const [colorBlind, setColorBlindSignal] = createSignal(parseFlag(readStored(KEYS.colorBlind), false));
const [dataSaver, setDataSaverSignal] = createSignal(parseFlag(readStored(KEYS.dataSaver), false));
const [wifiOnly, setWifiOnlySignal] = createSignal(parseFlag(readStored(KEYS.wifiOnly), true));
const [telemetry, setTelemetrySignal] = createSignal(parseFlag(readStored(KEYS.telemetry), true));

export { colorBlind, dataSaver, haptics, motion, telemetry, textSize, wifiOnly };

/** Kök öğeye yazılan özellikler: CSS yalnız bunlara bakar. */
export function applyRootSettings(
  root: HTMLElement | null = typeof document === "undefined" ? null : document.documentElement,
): void {
  if (!root) return;
  if (motion() === "auto") delete root.dataset.motion;
  else root.dataset.motion = motion();
  if (textSize() === "normal") delete root.dataset.text;
  else root.dataset.text = textSize();
  if (colorBlind()) root.dataset.cb = "1";
  else delete root.dataset.cb;
}

export function setHaptics(on: boolean): void {
  setHapticsSignal(on);
  writeStored(KEYS.haptics, on ? "1" : "0");
}
export function setMotion(v: MotionPref): void {
  setMotionSignal(v);
  writeStored(KEYS.motion, v);
  applyRootSettings();
}
export function setTextSize(v: TextSize): void {
  setTextSizeSignal(v);
  writeStored(KEYS.textSize, v);
  applyRootSettings();
}
export function setColorBlind(on: boolean): void {
  setColorBlindSignal(on);
  writeStored(KEYS.colorBlind, on ? "1" : "0");
  applyRootSettings();
}
export function setDataSaver(on: boolean): void {
  setDataSaverSignal(on);
  writeStored(KEYS.dataSaver, on ? "1" : "0");
}
export function setTelemetry(on: boolean): void {
  setTelemetrySignal(on);
  writeStored(KEYS.telemetry, on ? "1" : "0");
}
export function setWifiOnly(on: boolean): void {
  setWifiOnlySignal(on);
  writeStored(KEYS.wifiOnly, on ? "1" : "0");
}
