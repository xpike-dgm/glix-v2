/**
 * Veritabanı yedeği (U16 A3): hesap ve istatistik veritabanlarının tutarlı kopyaları (`VACUUM INTO`, çalışırken güvenli)
 * geçici bir klasöre alınır ve tek bir tar olarak akıtılır; akış bitince (ya da kopunca) geçici klasör silinir.
 * İki veritabanı aynı dosyaysa (üretimde öyle) tek kopya alınır. Kopya e-posta adresleri içerir.
 */
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Readable } from "node:stream";
import type { AccountStore } from "./accountStore.js";
import type { StatsStore } from "./statsStore.js";
import { type TarEntry, tarSize, tarStream } from "./tarArchive.js";

/** Günlük yedek sınırı (tüm yöneticiler toplamı, son 24 saat). */
export const BACKUP_PER_DAY = 3;
/** Yedek için yönetici girişi (kod) en çok bu kadar eski olabilir; yoksa kod yeniden girilir. */
export const BACKUP_FRESH_MS = 30 * 60 * 1000;

export interface Backup {
  /** Arşivdeki dosya adları. */
  files: string[];
  size: number;
  stream: Readable;
  /** Geçici klasörü siler; birden çok çağrılabilir. */
  cleanup(): Promise<void>;
}

export interface BackupService {
  /** Kopyaları alır. Biri sürerken ikincisi başlamaz (null). Hata fırlatırsa geçici klasör zaten silinmiştir. */
  create(now: number): Promise<Backup | null>;
}

const inMemory = (p: string | null): boolean => p === null || p === "" || p === ":memory:";

export function createBackupService(
  accounts: AccountStore,
  stats: StatsStore,
  tmpBase: string = tmpdir(),
): BackupService {
  let busy = false;
  return {
    async create(now) {
      if (busy) return null;
      busy = true;
      let dir: string | null = null;
      const cleanup = async (): Promise<void> => {
        const d = dir;
        dir = null;
        try {
          if (d) await rm(d, { recursive: true, force: true });
        } finally {
          busy = false;
        }
      };
      try {
        dir = await mkdtemp(join(tmpBase, "glix-yedek-"));
        // Aynı dosya iki kez kopyalanmaz (üretimde hesap ve istatistik tek dosyada).
        const same =
          !inMemory(accounts.path) &&
          !inMemory(stats.path) &&
          resolve(accounts.path) === resolve(stats.path ?? "");
        const jobs: { name: string; snapshot: (dest: string) => void }[] = [];
        if (same || !stats.enabled) jobs.push({ name: "glix.db", snapshot: (d) => accounts.snapshotTo(d) });
        else {
          jobs.push({ name: "glix-hesap.db", snapshot: (d) => accounts.snapshotTo(d) });
          jobs.push({ name: "glix-istatistik.db", snapshot: (d) => stats.snapshotTo(d) });
        }
        const entries: TarEntry[] = [];
        for (const job of jobs) {
          const path = join(dir, job.name);
          job.snapshot(path);
          const info = await stat(path);
          entries.push({ name: job.name, path, size: info.size, mtimeSec: Math.floor(now / 1000) });
        }
        const stream = tarStream(entries);
        // Akış ne şekilde biterse bitsin (tamam, hata, bağlantı koptu) kopyalar silinir.
        stream.once("close", () => void cleanup().catch(() => undefined));
        return { files: entries.map((e) => e.name), size: tarSize(entries), stream, cleanup };
      } catch (err) {
        await cleanup();
        throw err;
      }
    },
  };
}
