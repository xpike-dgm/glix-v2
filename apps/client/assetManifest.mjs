// Derleme zamanı varlık bildirimi: `public/assets` altındaki her görselin yolu, boyutu ve içerik özeti.
// Özet sürümdür: dosya değişince özeti değişir, istemci yalnız onu yeniden indirir. Yalnız node:crypto/fs kullanır.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

/** Çalışma anı `glix-art` önbelleğine giren görsel yolları (hizmet çalışanı yolu ve indirme listesi aynı kuraldan). */
export const ART_PATTERN = /^\/assets\/(avatars\/moods|mascot|badges|props|worlds|cards|briefing|fx)\//;

const IMAGE = /\.(webp|png|jpe?g|svg|avif)$/i;

/** İçerik özeti: sha256'nın ilk 16 onaltılık hanesi. */
export const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex").slice(0, 16);

function walk(dir, rel, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = posix.join(rel, entry.name);
    if (entry.isDirectory()) walk(join(dir, entry.name), next, out);
    else if (entry.isFile() && IMAGE.test(entry.name)) out.push(next);
  }
}

/**
 * @param {string} publicDir `public` klasörü
 * @param {readonly string[]} [exclude] kabuğa (precache) girdiği için indirilmeyecek yollar ("/assets/...")
 * @returns {{ version: string, files: { path: string, size: number, hash: string }[] }}
 */
export function buildAssetManifest(publicDir, exclude = []) {
  const rels = [];
  walk(join(publicDir, "assets"), "/assets", rels);
  const skip = new Set(exclude);
  const files = rels
    .filter((p) => ART_PATTERN.test(p) && !skip.has(p))
    .sort()
    .map((path) => {
      const bytes = readFileSync(join(publicDir, path));
      return { path, size: bytes.length, hash: hashBytes(bytes) };
    });
  const version = hashBytes(files.map((f) => `${f.path}:${f.hash}`).join("\n")).slice(0, 12);
  return { version, files };
}

/** Kabuk görselinin (precache) revizyonu: içerik özeti. */
export const fileRevision = (publicDir, path) => hashBytes(readFileSync(join(publicDir, path)));
