/**
 * Gece yedeği (UM-A5): veritabanının tutarlı kopyası (`VACUUM INTO`) ve onaylanan öğelerin dosyaları
 * `<yedek>/<YYYY-AA-GG>/` altına alınır; son 14 gün tutulur. Hem sunucu içinden (her gece) hem komut satırından
 * (`node dist/yedek.js`) çalışır.
 */
import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Db } from "./db.js";
import { json } from "./db.js";
import type { Depo } from "./depo.js";
import type { OgeDosyasi } from "./ortak/tipler.js";

export const YEDEK_GUN = 14;

export async function yedekAl(
  db: Db,
  depo: Depo,
  kok: string,
  tarih: string,
): Promise<{ klasor: string; dosya: number }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) throw new Error("tarih geçersiz");
  const klasor = join(kok, tarih);
  await rm(klasor, { recursive: true, force: true });
  await mkdir(join(klasor, "depo"), { recursive: true });
  db.prepare("VACUUM INTO ?").run(join(klasor, "uretim.db"));
  const ozetler = new Set<string>();
  const r = db
    .prepare("SELECT dosyalar FROM oge WHERE durum IN ('havuzda','pakette','oyuna_eklendi','canlida')")
    .all() as { dosyalar: string }[];
  for (const o of r) for (const d of json<OgeDosyasi[]>(o.dosyalar, [])) ozetler.add(d.ozet);
  let n = 0;
  for (const oz of ozetler) {
    try {
      await copyFile(depo.yol(oz), join(klasor, "depo", oz));
      n += 1;
    } catch {
      // Silinmiş dosya: yedekte yer almaz.
    }
  }
  await eskiYedekleriSil(kok, tarih);
  return { klasor, dosya: n };
}

export async function eskiYedekleriSil(kok: string, bugun: string): Promise<void> {
  const sinir = Date.parse(bugun) - (YEDEK_GUN - 1) * 24 * 3600 * 1000;
  for (const ad of await readdir(kok).catch(() => [] as string[])) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ad) || Date.parse(ad) >= sinir) continue;
    const p = join(kok, ad);
    if ((await stat(p)).isDirectory()) await rm(p, { recursive: true, force: true });
  }
}
