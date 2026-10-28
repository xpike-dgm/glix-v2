/**
 * Alkış: ikinci ve üçüncü için kodla yazılmış anahtar kareler (mocap yok). İki duruş arasında salınır: eller açık
 * (omuz hizası, dirsekler yanlarda) ve eller kapalı (göğüs önünde). Açılar derece, sol kol için yazılır; sağ kol
 * aynalanır (işaret değişir). Pozitif açı: saat yönü, ebeveyne göre.
 */
import type { DanceClip } from "./dance.js";

/** Bir kolun duruşu: üst kol, ön kol, el. */
interface ArmPose {
  upper: number;
  fore: number;
  hand: number;
}

const OPEN: ArmPose = { upper: 20, fore: -135, hand: -55 };
const CLOSED: ArmPose = { upper: 0, fore: -135, hand: -20 };

const BONES = [
  "torso",
  "head",
  "left_upper_arm",
  "left_forearm",
  "left_hand",
  "right_upper_arm",
  "right_forearm",
  "right_hand",
] as const;

/** Bir alkış döngüsündeki kare sayısı (15 kare/sn). */
export const CLAP_FRAMES = 8;
export const CLAP_FPS = 15;

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Alkış klibi (döngü): kare başına kapanma oranı 0 (açık) ... 1 (kapalı). */
export function clapClip(): DanceClip {
  const k = BONES.length;
  const angles = new Float32Array(CLAP_FRAMES * k);
  const rootY = new Float32Array(CLAP_FRAMES);
  for (let f = 0; f < CLAP_FRAMES; f++) {
    // f=0 kapalı (vuruş), f=CLAP_FRAMES/2 tam açık
    const p = 0.5 + 0.5 * Math.cos((2 * Math.PI * f) / CLAP_FRAMES);
    const upper = mix(OPEN.upper, CLOSED.upper, p);
    const fore = mix(OPEN.fore, CLOSED.fore, p);
    const hand = mix(OPEN.hand, CLOSED.hand, p);
    // Vuruşta hafif çökme: gövde öne eğilir.
    const dip = p * p;
    const row: Record<(typeof BONES)[number], number> = {
      torso: dip * 3,
      head: -dip * 3 + 1,
      left_upper_arm: upper,
      left_forearm: fore,
      left_hand: hand,
      right_upper_arm: -upper,
      right_forearm: -fore,
      right_hand: -hand,
    };
    BONES.forEach((b, i) => {
      angles[f * k + i] = row[b];
    });
    rootY[f] = dip * 6;
  }
  return { fps: CLAP_FPS, frames: CLAP_FRAMES, loop: true, bones: BONES, angles, rootY };
}
