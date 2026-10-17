import type { MergePatch } from "./protocol.js";

/*
 * JSON Merge Patch (RFC 7386) üretimi ve uygulaması. Sunucu ile istemci aynı kodu kullanır.
 *
 * NULL KARARI: RFC 7386'da yamadaki `null` "alanı sil" demektir; "değeri null yap" diye bir ifade yoktur.
 * Oysa RoomSnapshot `match`, `phaseEndsAt`, `result`, `view` alanlarında anlamlı `null` taşır
 * ("yok" ile "null" ayrı şeylerdir ve istemci doğrulaması `null` bekler).
 * Bu yüzden `diffMerge` yalnız doğru uygulanabilecek yamalar üretir:
 *   - Bir alan sonraki değerde `null` ise ve öncekinde `null` değilse (ör. match: {...} -> null,
 *     phaseEndsAt: 5 -> null), ya da yama değeri olarak yazılacak yeni bir nesnenin içinde `null` varsa,
 *     yama ifade edilemez: `diffMerge` `null` döner ve çağıran TAM snapshot (`room`) gönderir.
 *   - Önceden de `null` olan alan değişmemiş sayılır, yamaya girmez (en sık durum).
 *   - Diziler RFC'ye göre bütün olarak değişir ve içeriğine bakılmaz; dizi içindeki `null`'lar korunur.
 * Bu durumlar yalnız evre geçişlerinde oluşur (oyun başı/sonu); oyun içi yayınlar küçük yama olarak gider.
 * Yani `applyMerge(prev, diffMerge(prev, next))` her zaman `next`'e eşittir; ifade edilemiyorsa yama yoktur.
 * Ayrıca `undefined` değerli alan "yok" sayılır; `__proto__` anahtarı güvenlik için ifade edilemez sayılır.
 */

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function has(obj: Rec, key: string): boolean {
  return Object.hasOwn(obj, key) && obj[key] !== undefined;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isRec(a) && isRec(b)) {
    const ak = Object.keys(a).filter((k) => a[k] !== undefined);
    const bk = Object.keys(b).filter((k) => b[k] !== undefined);
    return ak.length === bk.length && ak.every((k) => has(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

/** Yama değeri olarak yazılacak nesnede (diziler hariç) `null` ya da `__proto__` var mı. */
function unsafeInPatchValue(v: unknown): boolean {
  if (v === null) return true;
  if (!isRec(v)) return false;
  for (const key of Object.keys(v)) {
    if (key === "__proto__") return true;
    if (v[key] !== undefined && unsafeInPatchValue(v[key])) return true;
  }
  return false;
}

function diffObjects(prev: Rec, next: Rec): MergePatch | null {
  const patch: MergePatch = {};
  for (const key of Object.keys(prev)) {
    if (key === "__proto__") return null;
    if (has(prev, key) && !has(next, key)) patch[key] = null;
  }
  for (const key of Object.keys(next)) {
    if (key === "__proto__") return null;
    const n = next[key];
    if (n === undefined) continue;
    const p = has(prev, key) ? prev[key] : undefined;
    if (n === null) {
      if (p === null) continue;
      return null;
    }
    if (isRec(n)) {
      if (isRec(p)) {
        const sub = diffObjects(p, n);
        if (sub === null) return null;
        if (Object.keys(sub).length > 0) patch[key] = sub;
      } else {
        if (unsafeInPatchValue(n)) return null;
        patch[key] = n;
      }
      continue;
    }
    if (!deepEqual(p, n)) patch[key] = n;
  }
  return patch;
}

/**
 * `prev`'den `next`'e geçen JSON Merge Patch. Değişiklik yoksa `{}`.
 * Yama ifade edilemiyorsa (bkz. yukarıdaki NULL KARARI) ya da girdiler nesne değilse `null`:
 * çağıran tam durumu göndermelidir.
 */
export function diffMerge(prev: unknown, next: unknown): MergePatch | null {
  if (!isRec(prev) || !isRec(next)) return null;
  return diffObjects(prev, next);
}

/**
 * RFC 7386 uygulaması. Saf: `target` değiştirilmez; değişmeyen alt ağaçlar paylaşılır.
 * Yama nesne değilse sonuç yamanın kendisidir.
 */
export function applyMerge(target: unknown, patch: unknown): unknown {
  if (!isRec(patch)) return patch;
  const out: Rec = isRec(target) ? { ...target } : {};
  for (const key of Object.keys(patch)) {
    if (key === "__proto__") continue;
    const v = patch[key];
    if (v === null) delete out[key];
    else out[key] = applyMerge(out[key], v);
  }
  return out;
}
