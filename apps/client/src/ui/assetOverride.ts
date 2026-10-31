/**
 * Önizleme sayfasının (`onizleme.html`, UM-U4) taslak dosyaları: oyundaki yol -> `data:`/`blob:` adresi. Yalnız
 * bellekte tutulur; hizmet çalışanına ve önbelleğe yazılmaz. Oyunun kendi sayfalarında tablo hep boştur ve
 * `assetUrl` yolu olduğu gibi döner.
 */

const overrides = new Map<string, string>();

/** `apps/client/public/assets/...`, `public/assets/...` ya da `/assets/...` -> `/assets/...`; geçersizse null. */
export function normalizeGamePath(raw: string): string | null {
  let p = raw.trim();
  if (p.startsWith("apps/client/public/")) p = p.slice("apps/client/public".length);
  else if (p.startsWith("public/")) p = p.slice("public".length);
  else if (p.startsWith("assets/")) p = `/${p}`;
  if (!/^\/assets\/[a-z0-9_-]+(?:\/[a-z0-9_.-]+)+$/.test(p) || p.includes("..")) return null;
  return p;
}

/** Taslak adresi kabul edilir mi: yalnız `data:image|audio|application/json` ve `blob:`. */
export function isDraftUrl(url: string): boolean {
  if (url.length > 8_000_000) return false;
  return (
    /^data:(?:image\/(?:webp|png|jpeg)|audio\/(?:ogg|mpeg|wav)|application\/json)[;,]/.test(url) ||
    /^blob:https?:\/\//.test(url)
  );
}

/** Tabloyu değiştirir (`null` temizler). */
export function setAssetOverrides(entries: ReadonlyMap<string, string> | null): void {
  overrides.clear();
  if (entries) for (const [k, v] of entries) overrides.set(k, v);
}

/** Oyun yolunun (`/assets/...`) gösterilecek adresi: taslak varsa onun adresi, yoksa yolun kendisi. */
export function assetUrl(path: string): string {
  return overrides.get(path) ?? path;
}

/** Taslak var mı (önizlemede karakter takımının yeniden kurulması gerekip gerekmediği için). */
export function hasOverrideUnder(prefix: string): boolean {
  for (const k of overrides.keys()) if (k.startsWith(prefix)) return true;
  return false;
}
