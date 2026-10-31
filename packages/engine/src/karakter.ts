/**
 * Kürsü dansı ve giysi katmanı doğrulayıcıları (MG-5). Oyun ve Üretim Merkezi aynı kodla denetler: dans dosyası
 * (`public/assets/karakter/dans/<ad>.json`, biçim `glix-dance-3`) iskeletin (`rig.json`) kemiklerini mi kullanıyor,
 * süresi sınırda mı, döngüsü düzgün mü; giysi katmanı (`rig.json` → `wardrobe.<ad>`) doğru yuvada mı, kostüm
 * kapladığı yuvaları doğru bildiriyor mu.
 *
 * `rig` her iki işlevde `rig.json` dosyasının ham içeriğidir (biçim `glix-parts-1`).
 */
import { type CosmeticItem, coveredSlots, GIYSI_SIRASI, slotOfBone } from "./cosmetics.js";

/** Dans süresi sınırları (sn) ve dosya boyu sınırı (JSON karakteri). */
export const DANCE_SECONDS_MIN = 1;
export const DANCE_SECONDS_MAX = 10;
export const DANCE_JSON_MAX = 40_000;
/** Kök dikey kaymasının en büyük mutlak değeri (rig pikseli) ve açıların en büyük mutlak değeri (derece). */
export const DANCE_ROOT_MAX_PX = 300;
export const DANCE_ANGLE_MAX = 720;
/** Döngüde son kareden ilk kareye bu dereceden büyük sıçrama uyarı verir (hata değil). */
export const DANCE_LOOP_GAP_WARN = 45;
/** Giysi katmanında en çok parça ve parça görselinin en büyük kenarı (piksel). */
export const WARDROBE_PIECES_MAX = 16;
export const WARDROBE_PIECE_MAX_PX = 1024;

export interface KarakterCheck {
  ok: boolean;
  errors: string[];
  /** Hata sayılmayan ama bakılması iyi olan durumlar (ör. döngüde sıçrama). */
  warnings: string[];
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const pair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(finite);
const DANCE_KEYS = new Set(["format", "fps", "loop", "bones", "y", "a"]);
const PIECE_KEYS = new Set([
  "file",
  "size",
  "pivot",
  "parent",
  "bone",
  "position",
  "rotation",
  "drawAfter",
  "sourceOrigin",
  "layer",
]);
const PIECE_FILE = /^giysi\/[a-z0-9_]+\.webp$/;

/** İskeletin kemik adları; iskelet geçersizse null. */
export function rigBones(rig: unknown): Set<string> | null {
  if (!isRec(rig) || rig.format !== "glix-parts-1" || !isRec(rig.parts)) return null;
  const names = Object.keys(rig.parts);
  return names.length > 0 ? new Set(names) : null;
}

const wrap = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;

/** Dans dosyasını iskelete göre doğrular. */
export function validateDance(json: unknown, rig: unknown): KarakterCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const bonesOfRig = rigBones(rig);
  if (!bonesOfRig) return { ok: false, errors: ["iskelet (rig.json) geçersiz"], warnings };
  if (!isRec(json)) return { ok: false, errors: ["dans dosyası bir nesne olmalı"], warnings };
  for (const k of Object.keys(json)) if (!DANCE_KEYS.has(k)) errors.push(`bilinmeyen alan: ${k}`);
  if (json.format !== "glix-dance-3") errors.push('format: "glix-dance-3" olmalı');
  const { fps, bones, y, a, loop } = json;
  if (!finite(fps) || fps < 1 || fps > 60) errors.push("fps: 1-60 arası olmalı");
  if (loop !== undefined && typeof loop !== "boolean") errors.push("loop: true ya da false olmalı");
  if (!Array.isArray(bones) || bones.length < 1 || bones.length > 32) {
    errors.push("bones: 1-32 kemiklik liste olmalı");
    return { ok: false, errors, warnings };
  }
  const seen = new Set<string>();
  for (const b of bones) {
    if (typeof b !== "string") errors.push("bones: kemik adları metin olmalı");
    else if (!bonesOfRig.has(b)) errors.push(`bones: "${b}" iskelette yok`);
    else if (seen.has(b)) errors.push(`bones: "${b}" iki kez yazılmış`);
    else seen.add(b);
  }
  if (!Array.isArray(y) || y.length < 2 || y.length > 4000) {
    errors.push("y: 2-4000 karelik liste olmalı");
    return { ok: false, errors, warnings };
  }
  if (!Array.isArray(a) || a.length !== y.length * bones.length) {
    errors.push("a: kare sayısı x kemik sayısı kadar açı olmalı");
    return { ok: false, errors, warnings };
  }
  if (!y.every(finite) || !a.every(finite)) {
    errors.push("y ve a yalnız sayı içermeli");
    return { ok: false, errors, warnings };
  }
  const ys = y as number[];
  const as = a as number[];
  if (ys.some((v) => Math.abs(v / 10) > DANCE_ROOT_MAX_PX))
    errors.push(`y: kök kayması en çok ${DANCE_ROOT_MAX_PX} piksel`);
  if (as.some((v) => Math.abs(v / 10) > DANCE_ANGLE_MAX))
    errors.push(`a: açılar en çok ${DANCE_ANGLE_MAX} derece`);
  if (finite(fps) && fps > 0) {
    const seconds = ys.length / fps;
    if (seconds < DANCE_SECONDS_MIN || seconds > DANCE_SECONDS_MAX)
      errors.push(
        `süre ${seconds.toFixed(2)} sn: ${DANCE_SECONDS_MIN}-${DANCE_SECONDS_MAX} sn arası olmalı (kare sayısı / fps)`,
      );
  }
  if (JSON.stringify(json).length > DANCE_JSON_MAX)
    errors.push(`dosya çok büyük (en çok ${DANCE_JSON_MAX} karakter)`);
  if (loop !== false && errors.length === 0) {
    const k = bones.length;
    const n = ys.length;
    let gap = 0;
    for (let b = 0; b < k; b++)
      gap = Math.max(gap, Math.abs(wrap(((as[b] ?? 0) - (as[(n - 1) * k + b] ?? 0)) / 10)));
    if (gap > DANCE_LOOP_GAP_WARN)
      warnings.push(
        `döngü: son kareden ilk kareye ${gap.toFixed(0)} derecelik sıçrama var (dönüş sert görünebilir)`,
      );
  }
  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Giysi katmanını (`rig.json` içindeki `wardrobe.<ad>` değeri: `{ slot, pieces }`) iskelete göre doğrular. `item`
 * verilirse ürünle uyumu da denetlenir: tür = yuva, kostümde `covers` parçaların kemiklerinden türeyen yuvalarla aynı.
 */
export function validateWardrobeLayer(json: unknown, rig: unknown, item?: CosmeticItem): KarakterCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const bonesOfRig = rigBones(rig);
  if (!bonesOfRig) return { ok: false, errors: ["iskelet (rig.json) geçersiz"], warnings };
  if (!isRec(json))
    return { ok: false, errors: ["giysi katmanı bir nesne olmalı: { slot, pieces }"], warnings };
  for (const k of Object.keys(json))
    if (k !== "slot" && k !== "pieces" && k !== "visible") errors.push(`bilinmeyen alan: ${k}`);
  const slot = GIYSI_SIRASI.find((s) => s === json.slot);
  if (slot === undefined) errors.push(`slot: şunlardan biri olmalı: ${GIYSI_SIRASI.join(", ")}`);
  if (json.visible !== undefined && typeof json.visible !== "boolean")
    errors.push("visible: true ya da false");
  const pieces = json.pieces;
  if (!Array.isArray(pieces) || pieces.length < 1 || pieces.length > WARDROBE_PIECES_MAX) {
    errors.push(`pieces: 1-${WARDROBE_PIECES_MAX} parçalık liste olmalı`);
    return { ok: false, errors, warnings };
  }
  const bones: string[] = [];
  pieces.forEach((p: unknown, i: number) => {
    const at = `pieces[${i}]`;
    if (!isRec(p)) {
      errors.push(`${at}: nesne olmalı`);
      return;
    }
    for (const k of Object.keys(p)) if (!PIECE_KEYS.has(k)) errors.push(`${at}: bilinmeyen alan ${k}`);
    if (typeof p.file !== "string" || !PIECE_FILE.test(p.file))
      errors.push(`${at}.file: giysi/<ad>.webp olmalı`);
    if (!pair(p.size) || p.size.some((v) => v <= 0 || v > WARDROBE_PIECE_MAX_PX))
      errors.push(`${at}.size: [genişlik, yükseklik], 1-${WARDROBE_PIECE_MAX_PX} piksel`);
    if (!pair(p.sourceOrigin)) errors.push(`${at}.sourceOrigin: [x, y] olmalı`);
    if (p.pivot !== undefined && !pair(p.pivot)) errors.push(`${at}.pivot: [x, y] olmalı`);
    if (p.position !== undefined && !pair(p.position)) errors.push(`${at}.position: [x, y] olmalı`);
    if (p.rotation !== undefined && !finite(p.rotation)) errors.push(`${at}.rotation: sayı olmalı`);
    if (typeof p.bone !== "string" || !bonesOfRig.has(p.bone))
      errors.push(`${at}.bone: iskelette olmayan kemik`);
    else bones.push(p.bone);
    if (p.parent !== undefined && (typeof p.parent !== "string" || !bonesOfRig.has(p.parent)))
      errors.push(`${at}.parent: iskelette olmayan kemik`);
    if (p.drawAfter !== undefined && (typeof p.drawAfter !== "string" || !bonesOfRig.has(p.drawAfter)))
      errors.push(`${at}.drawAfter: iskelette olmayan kemik`);
    if (p.layer !== undefined && p.layer !== "on" && p.layer !== "arka")
      errors.push(`${at}.layer: "on" ya da "arka"`);
  });
  // Yuva denetimi: şapka/üst/alt/ayakkabı katmanının en az bir parçası o yuvanın kemiğinde olmalı (bot gibi giysiler
  // komşu kemiğe taşabilir). Aksesuar her kemikte olabilir; kostümün yuvaları kemiklerinden türer.
  if (slot !== undefined && slot !== "aksesuar" && slot !== "kostum" && bones.length > 0) {
    if (!bones.some((b) => slotOfBone(b) === slot))
      errors.push(
        `slot: "${slot}" yuvasının kemiğinde hiç parça yok (kemikler: ${[...new Set(bones)].join(", ")})`,
      );
  }
  if (slot === "kostum" && bones.length > 0 && coveredSlots(bones).length === 0)
    errors.push("kostüm hiçbir giysi yuvasını kaplamıyor");
  if (item !== undefined && slot !== undefined) {
    if (item.type !== slot) errors.push(`ürün türü (${item.type}) katmanın yuvasıyla (${slot}) aynı olmalı`);
    if (slot === "kostum") {
      const want = coveredSlots(bones).sort();
      const got = [...(item.covers ?? [])].sort();
      if (want.join(",") !== got.join(","))
        errors.push(
          `covers: parçaların kapladığı yuvalar ${want.join(", ")}; üründe ${got.join(", ") || "yok"}`,
        );
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}
