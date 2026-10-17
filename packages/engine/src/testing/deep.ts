/** Test yardımcıları: derin dondurma, kopyalama ve eşitlik (yalnız düz veri için). */

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/** Nesneyi ve içindekileri dondurur; sonradan değiştirmeye çalışan kod (katı kipte) hata alır. */
export function deepFreeze<T>(value: T): T {
  if (!isObject(value) || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  return value;
}

export function deepClone<T>(value: T): T {
  if (!isObject(value)) return value;
  if (Array.isArray(value)) return value.map((v) => deepClone(v)) as T;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    Object.defineProperty(out, key, {
      value: deepClone((value as Record<string, unknown>)[key]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out as T;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!isObject(a) || !isObject(b)) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) =>
      Object.hasOwn(b, k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}
