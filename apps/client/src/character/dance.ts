/**
 * Dans verisi ve örnekleme (saf). Biçim `glix-dance-3` (`tools/karakter-deneme/dansPaketle.mjs`): yalnız oynayan
 * kemikler, açılar 0,1 derece, kök dikey kayması 0,1 piksel, kare başına bir satır. Ağdan gelen veri doğrulanır.
 */

export interface DanceClip {
  fps: number;
  frames: number;
  loop: boolean;
  /** Oynayan kemiklerin adları; `angles` kare başına bu sırayla derece. */
  bones: readonly string[];
  /** frames x bones.length, derece. */
  angles: Float32Array;
  /** Kök dikey kayması (rig pikseli, aşağı pozitif), kare başına. */
  rootY: Float32Array;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const BONE = /^[a-z_]{1,24}$/;

/** Dosya içeriğini doğrular; bozuksa null. Boyut sınırları kötü niyetli büyük dosyaya karşıdır. */
export function parseDance(raw: unknown): DanceClip | null {
  if (!isRec(raw) || raw.format !== "glix-dance-3") return null;
  const { fps, bones, y, a } = raw;
  if (typeof fps !== "number" || !(fps >= 1 && fps <= 60)) return null;
  if (!Array.isArray(bones) || bones.length < 1 || bones.length > 32) return null;
  if (!bones.every((b) => typeof b === "string" && BONE.test(b))) return null;
  if (!Array.isArray(y) || y.length < 2 || y.length > 4000) return null;
  if (!Array.isArray(a) || a.length !== y.length * bones.length) return null;
  const ok = (arr: unknown[]) => arr.every((v) => typeof v === "number" && Number.isFinite(v));
  if (!ok(y) || !ok(a)) return null;
  return {
    fps,
    frames: y.length,
    loop: raw.loop !== false,
    bones: bones as string[],
    angles: Float32Array.from(a as number[], (v) => v / 10),
    rootY: Float32Array.from(y as number[], (v) => v / 10),
  };
}

/** Klip süresi (sn). */
export const clipSeconds = (c: DanceClip): number => c.frames / c.fps;

/** Açı farkı (-180, 180] aralığına sarılır: 350° ile 10° arası 20° fark. */
export const wrapDelta = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;

/**
 * `t` saniyedeki duruş: `out[i]` = i. kemiğin açısı (derece), dönüş değeri kök kayması. Döngüde son kare ilkine
 * harmanlanır; döngü değilse son karede kalır. Açılar arası fark en kısa yoldan alınır (360 sarması).
 */
export function sampleDance(clip: DanceClip, t: number, out: Float32Array): number {
  const n = clip.frames;
  const k = clip.bones.length;
  let ft = t * clip.fps;
  if (clip.loop) ft = ((ft % n) + n) % n;
  else ft = Math.min(Math.max(ft, 0), n - 1);
  const i = Math.floor(ft);
  const f = ft - i;
  const j = clip.loop ? (i + 1) % n : Math.min(i + 1, n - 1);
  for (let b = 0; b < k; b++) {
    const p = clip.angles[i * k + b] ?? 0;
    const q = clip.angles[j * k + b] ?? 0;
    out[b] = p + wrapDelta(q - p) * f;
  }
  const y0 = clip.rootY[i] ?? 0;
  return y0 + ((clip.rootY[j] ?? 0) - y0) * f;
}

/** Yerel açı dizisine (iskelet sırası) yerleştirme eşlemesi: klip kemiği -> iskelet dizini (-1: iskelette yok). */
export function mapBones(clip: DanceClip, index: ReadonlyMap<string, number>): Int16Array {
  return Int16Array.from(clip.bones, (b) => index.get(b) ?? -1);
}

/**
 * Durağan afiş için dansın en karakteristik karesi: ortalama duruştan en çok ayrılan kare (kollar en açık,
 * en dinamik an). Saniye cinsinden döner (`sampleDance` zamanı).
 */
export function posterTime(clip: DanceClip): number {
  const k = clip.bones.length;
  const mean = new Float32Array(k);
  for (let f = 0; f < clip.frames; f++)
    for (let b = 0; b < k; b++) mean[b] = (mean[b] ?? 0) + (clip.angles[f * k + b] ?? 0);
  for (let b = 0; b < k; b++) mean[b] = (mean[b] ?? 0) / clip.frames;
  let best = 0;
  let bestScore = -1;
  for (let f = 0; f < clip.frames; f++) {
    let score = 0;
    for (let b = 0; b < k; b++) score += Math.abs(wrapDelta((clip.angles[f * k + b] ?? 0) - (mean[b] ?? 0)));
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best / clip.fps;
}
