/**
 * Sınırlı önbellek (en az kullanılan çıkar): uzun partide anahtar sayısı (giysi birleşimleri, afiş istekleri)
 * sınırsız büyümesin. `get` kaydı en yeni yapar; sınır aşılınca en eski kayıt silinir ve `onEvict` çağrılır.
 */
export class Lru<K, V> {
  private readonly map = new Map<K, V>();

  constructor(
    private readonly max: number,
    private readonly onEvict?: (key: K, value: V) => void,
  ) {}

  get size(): number {
    return this.map.size;
  }

  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: K, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.max) {
      const oldest = this.map.entries().next();
      if (oldest.done) break;
      this.map.delete(oldest.value[0]);
      this.onEvict?.(oldest.value[0], oldest.value[1]);
    }
  }

  delete(key: K): void {
    this.map.delete(key);
  }
}
