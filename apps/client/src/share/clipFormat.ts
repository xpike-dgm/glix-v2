/**
 * Dans klibi biçimi seçimi (saf mantık). Tarayıcıdaki `MediaRecorder` hangi kapsayıcıyı yazabiliyorsa o seçilir:
 * MP4 (H.264) her yerde paylaşılır (iOS, Instagram, WhatsApp), bu yüzden önce o denenir; olmazsa WebM.
 * Hiçbiri yoksa ya da hareket azaltma açıksa klip yerine podyumun durağan görseli (PNG) üretilir.
 */
export interface ClipFormat {
  /** `MediaRecorder` için tam tür (codec dahil). */
  mime: string;
  ext: "mp4" | "webm";
}

export const CLIP_FORMATS: readonly ClipFormat[] = [
  { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
  { mime: "video/mp4;codecs=avc1", ext: "mp4" },
  { mime: "video/mp4", ext: "mp4" },
  { mime: "video/webm;codecs=vp9", ext: "webm" },
  { mime: "video/webm;codecs=vp8", ext: "webm" },
  { mime: "video/webm", ext: "webm" },
];

export function pickClipFormat(isTypeSupported: ((mime: string) => boolean) | undefined): ClipFormat | null {
  if (typeof isTypeSupported !== "function") return null;
  for (const f of CLIP_FORMATS) {
    try {
      if (isTypeSupported(f.mime)) return f;
    } catch {
      // desteği sorgulanamayan tür yok sayılır
    }
  }
  return null;
}

export type PosterReason = "reduced-motion" | "no-recorder" | "no-capture";

export type ClipPlan = { kind: "video"; format: ClipFormat } | { kind: "poster"; reason: PosterReason };

export interface ClipEnv {
  reducedMotion: boolean;
  /** `canvas.captureStream` var mı. */
  canCapture: boolean;
  /** `MediaRecorder.isTypeSupported`; MediaRecorder yoksa undefined. */
  isTypeSupported: ((mime: string) => boolean) | undefined;
}

export function planClip(env: ClipEnv): ClipPlan {
  if (env.reducedMotion) return { kind: "poster", reason: "reduced-motion" };
  if (!env.canCapture) return { kind: "poster", reason: "no-capture" };
  const format = pickClipFormat(env.isTypeSupported);
  return format ? { kind: "video", format } : { kind: "poster", reason: "no-recorder" };
}

/** Tarayıcıdaki gerçek ortam. */
export function browserClipEnv(reducedMotion: boolean): ClipEnv {
  const rec = typeof MediaRecorder === "undefined" ? undefined : MediaRecorder;
  let canCapture = false;
  try {
    canCapture =
      typeof document !== "undefined" && typeof document.createElement("canvas").captureStream === "function";
  } catch {
    canCapture = false;
  }
  return {
    reducedMotion,
    canCapture,
    isTypeSupported:
      rec && typeof rec.isTypeSupported === "function" ? (m) => rec.isTypeSupported(m) : undefined,
  };
}

/** Kaydedicinin bildirdiği türden (`video/webm;codecs=vp9`) dosya türü ve uzantı. */
export function containerOf(recorderMime: string, fallback: ClipFormat): ClipFormat {
  const base = recorderMime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "video/mp4") return { mime: "video/mp4", ext: "mp4" };
  if (base === "video/webm") return { mime: "video/webm", ext: "webm" };
  return { mime: fallback.mime.split(";")[0] ?? fallback.mime, ext: fallback.ext };
}

/** Çözünürlüğe göre hedef bit hızı (sn başına): ~720p için 3 Mb. */
export const bitrateFor = (w: number, h: number): number =>
  Math.max(1_200_000, Math.min(4_000_000, Math.round((w * h * 30 * 0.11) / 1000) * 1000));
