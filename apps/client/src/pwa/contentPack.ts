/**
 * İçerik paketi: uygulamanın tüm görsellerini (≈16 MB) önceden `glix-art` önbelleğine indirir.
 *
 * Tutarlılık: dosyalar önbelleğe düz adresiyle (`/assets/...`, sorgusuz) yazılır; bileşenlerin istediği adres de
 * budur ve hizmet çalışanının CacheFirst yolu aynı önbelleği okur. Bu yüzden ön indirilen kayıtlar çalışma
 * anında birebir bulunur. Sürüm, önbelleğin içindeki küçük bir dizinde (yol → özet) tutulur; dizin aynı
 * önbellekte durur, önbellek silinince birlikte gider. Bu modül ağa/önbelleğe yalnız enjekte edilen
 * `PackStore` ve `fetchFile` üzerinden dokunur; böylece sahte nesnelerle sınanır.
 */

export interface PackFile {
  path: string;
  size: number;
  hash: string;
}

export interface PackManifest {
  version: string;
  files: PackFile[];
}

/** yol → önbellekteki kaydın özeti */
export type PackIndex = Record<string, string>;

export interface PackDiff {
  /** Bildirimde var, önbellekte yok. */
  missing: PackFile[];
  /** Önbellekte var ama özeti yok ya da farklı. */
  changed: PackFile[];
  /** Önbellekte var, bildirimde yok. */
  stale: string[];
  /** Güncel olanlar. */
  current: PackFile[];
}

export interface PackProgress {
  files: number;
  totalFiles: number;
  bytes: number;
  totalBytes: number;
}

export interface PackResult {
  /** Bu çalıştırmada ağdan indirilen dosya sayısı. */
  downloaded: number;
  failed: number;
  removed: number;
  /** Bildirimdeki her dosya güncel. */
  complete: boolean;
  aborted: boolean;
}

/** Önbellek erişimi (Cache API'nin bu modülün ihtiyacı kadar kısmı). */
export interface PackStore {
  /** Dizin kaydı dışındaki tüm kayıtların yolları. */
  keys(): Promise<string[]>;
  put(path: string, res: Response): Promise<void>;
  delete(path: string): Promise<void>;
  readIndex(): Promise<PackIndex>;
  writeIndex(index: PackIndex): Promise<void>;
  /** Son görülen bildirim (yol → özet); hiç yazılmadıysa null. Havuz kullanmayan kullanıcılar için de tutulur. */
  readSeen(): Promise<PackIndex | null>;
  writeSeen(seen: PackIndex): Promise<void>;
}

export interface RunOptions {
  concurrency: number;
  signal?: AbortSignal | undefined;
  onProgress?: ((p: PackProgress) => void) | undefined;
  fetchFile: (path: string, signal: AbortSignal | undefined) => Promise<Response>;
  /** Hatalı dosyayı yeniden denemeden önce bekleme (sınamada kısaltılır). */
  retryDelayMs?: number;
}

export const PACK_CACHE = "glix-art";
export const MANIFEST_URL = "/asset-manifest.json";
const INDEX_PATH = "/__pack/index.json";
const SEEN_PATH = "/__pack/seen.json";
const ATTEMPTS = 2;
const INDEX_FLUSH_EVERY = 10;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Ağdan gelen bildirimi doğrular; bozuksa ya da boşsa null (boş bildirimle her şey "eski" sayılıp silinirdi). */
export function parseManifest(raw: unknown): PackManifest | null {
  if (!isRecord(raw) || typeof raw.version !== "string" || !Array.isArray(raw.files)) return null;
  const files: PackFile[] = [];
  const seen = new Set<string>();
  for (const f of raw.files) {
    if (!isRecord(f)) return null;
    const { path, size, hash } = f;
    if (typeof path !== "string" || !/^\/assets\/[\w./-]+$/.test(path) || path.includes("..")) return null;
    if (typeof size !== "number" || !Number.isFinite(size) || size < 0) return null;
    if (typeof hash !== "string" || hash === "" || seen.has(path)) return null;
    seen.add(path);
    files.push({ path, size, hash });
  }
  return files.length === 0 ? null : { version: raw.version, files };
}

export function diffPack(manifest: PackManifest, index: PackIndex, cached: ReadonlySet<string>): PackDiff {
  const missing: PackFile[] = [];
  const changed: PackFile[] = [];
  const current: PackFile[] = [];
  const wanted = new Set<string>();
  for (const f of manifest.files) {
    wanted.add(f.path);
    if (!cached.has(f.path)) missing.push(f);
    else if (index[f.path] !== f.hash) changed.push(f);
    else current.push(f);
  }
  const stale = [...cached].filter((p) => !wanted.has(p));
  return { missing, changed, stale, current };
}

export const packBytes = (files: readonly PackFile[]): number => files.reduce((n, f) => n + f.size, 0);

/** Bildirim ve önbellek durumundan, indirilecek iş var mı ve ne kadar. */
export function pendingWork(diff: PackDiff): { files: number; bytes: number } {
  const todo = [...diff.missing, ...diff.changed];
  return { files: todo.length, bytes: packBytes(todo) };
}

/** Görsel (ya da karakter iskeleti/dansı: JSON) yanıtı mı? SPA geri dönüşü HTML ile 200 döner; onu saklamayız. */
export function isArtResponse(res: Response): boolean {
  const type = res.headers.get("content-type") ?? "";
  return res.ok && (type.startsWith("image/") || type.startsWith("application/json"));
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === "AbortError";

/** Kayıt yoksa/ bozuksa boş dizin. */
export function parseIndex(raw: unknown): PackIndex {
  const out: PackIndex = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") out[k] = v;
  return out;
}

/**
 * Bildirimdeki eksik/değişen dosyaları indirir, listeden düşenleri siler. Kesilirse (iptal, ağ, kapanma)
 * bir sonraki çalıştırma kaldığı yerden sürer: yazılan her dosya dizine işlenir, işlenmemiş olan "değişmiş" sayılıp
 * yenilenir.
 */
export async function runPack(
  manifest: PackManifest,
  store: PackStore,
  opts: RunOptions,
): Promise<PackResult> {
  const index = await store.readIndex();
  const diff = diffPack(manifest, index, new Set(await store.keys()));
  const totalBytes = packBytes(manifest.files);
  let doneFiles = diff.current.length;
  let doneBytes = packBytes(diff.current);
  const report = (): void =>
    opts.onProgress?.({
      files: doneFiles,
      totalFiles: manifest.files.length,
      bytes: doneBytes,
      totalBytes,
    });

  for (const path of diff.stale) {
    await store.delete(path);
    delete index[path];
  }
  for (const key of Object.keys(index)) if (!manifest.files.some((f) => f.path === key)) delete index[key];
  report();

  // Değişen dosyanın eski kaydı önce silinir: hizmet çalışanının CacheFirst yolu yoksa eskisini döndürürdü.
  for (const f of diff.changed) {
    await store.delete(f.path);
    delete index[f.path];
  }
  if (diff.stale.length > 0 || diff.changed.length > 0) await store.writeIndex(index);

  const queue = [...diff.missing, ...diff.changed];
  let next = 0;
  let downloaded = 0;
  let failed = 0;
  let aborted = false;
  let sinceFlush = 0;
  let flushing: Promise<void> = Promise.resolve();
  const flush = (): void => {
    sinceFlush = 0;
    const snapshot = { ...index };
    flushing = flushing.then(() => store.writeIndex(snapshot)).catch(() => undefined);
  };

  const download = async (f: PackFile): Promise<boolean> => {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      if (opts.signal?.aborted) return false;
      try {
        const res = await opts.fetchFile(f.path, opts.signal);
        if (!isArtResponse(res)) throw new Error("beklenmeyen yanıt");
        await store.put(f.path, res);
        return true;
      } catch (e) {
        if (isAbort(e) || opts.signal?.aborted) {
          aborted = true;
          return false;
        }
        if (attempt < ATTEMPTS) await sleep(opts.retryDelayMs ?? 400);
      }
    }
    return false;
  };

  const worker = async (): Promise<void> => {
    while (!opts.signal?.aborted) {
      const f = queue[next++];
      if (!f) return;
      if (await download(f)) {
        index[f.path] = f.hash;
        downloaded++;
        doneFiles++;
        doneBytes += f.size;
        if (++sinceFlush >= INDEX_FLUSH_EVERY) flush();
        report();
      } else if (!aborted) failed++;
    }
  };

  const n = Math.max(1, Math.min(opts.concurrency, queue.length || 1));
  await Promise.all(Array.from({ length: n }, worker));
  if (opts.signal?.aborted) aborted = true;
  flush();
  await flushing;

  return {
    downloaded,
    failed,
    removed: diff.stale.length,
    complete: !aborted && failed === 0 && doneFiles === manifest.files.length,
    aborted,
  };
}

/** Gerçek önbellek (`glix-art`) üzerinden `PackStore`. Dizin aynı önbellekte özel bir kayıttır. */
export function cacheStore(name: string = PACK_CACHE): PackStore {
  const open = (): Promise<Cache> => caches.open(name);
  return {
    async keys() {
      const cache = await open();
      return (await cache.keys())
        .map((r) => new URL(r.url).pathname)
        .filter((p) => p !== INDEX_PATH && p !== SEEN_PATH);
    },
    async put(path, res) {
      await (await open()).put(path, res);
    },
    async delete(path) {
      await (await open()).delete(path);
    },
    async readIndex() {
      try {
        const hit = await (await open()).match(INDEX_PATH);
        return hit ? parseIndex(await hit.json()) : {};
      } catch {
        return {};
      }
    },
    async writeIndex(index) {
      await (await open()).put(
        INDEX_PATH,
        new Response(JSON.stringify(index), { headers: { "content-type": "application/json" } }),
      );
    },
    async readSeen() {
      try {
        const hit = await (await open()).match(SEEN_PATH);
        return hit ? parseIndex(await hit.json()) : null;
      } catch {
        return null;
      }
    },
    async writeSeen(seen) {
      await (await open()).put(
        SEEN_PATH,
        new Response(JSON.stringify(seen), { headers: { "content-type": "application/json" } }),
      );
    },
  };
}

/**
 * Önceki bildirimde görülüp artık özeti değişen ya da listeden düşen yollar. Önbellekte eski görsel kalmasın diye
 * silinir (indirme yok; bir sonraki kullanımda çalışma anı taze getirir).
 */
export function pruneDiff(manifest: PackManifest, seen: PackIndex): string[] {
  const now = new Map(manifest.files.map((f) => [f.path, f.hash]));
  return Object.entries(seen)
    .filter(([path, hash]) => now.get(path) !== hash)
    .map(([path]) => path);
}

/**
 * Havuz kullanmayan kullanıcıda da eski görsel kalmasın: son görülen bildirimle karşılaştırır, değişen/düşen
 * kayıtları siler, yeni bildirimi "son görülen" yazar. İlk çalıştırmada (kayıt yok) havuz dizini varsa o,
 * yoksa hiçbir şey silinmez: mevcut kayıtlar bir kez güvenilir sayılır. Silinen yollar döner.
 */
export async function pruneChanged(manifest: PackManifest, store: PackStore): Promise<string[]> {
  const index = await store.readIndex();
  const seen = (await store.readSeen()) ?? (Object.keys(index).length > 0 ? index : null);
  const dropped = seen ? pruneDiff(manifest, seen) : [];
  for (const path of dropped) {
    await store.delete(path);
    delete index[path];
  }
  if (dropped.length > 0) await store.writeIndex(index);
  await store.writeSeen(Object.fromEntries(manifest.files.map((f) => [f.path, f.hash])));
  return dropped;
}

/** Bildirimi ağdan okur (her zaman taze); çevrimdışı ya da bozuksa null. */
export async function loadManifest(fetchImpl: typeof fetch = fetch): Promise<PackManifest | null> {
  try {
    const res = await fetchImpl(MANIFEST_URL, { cache: "no-store" });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return null;
    return parseManifest(await res.json());
  } catch {
    return null;
  }
}

/** Gerçek ağ isteği: HTTP önbelleğini atlar; arka planda düşük öncelikli. */
export function networkFetch(lowPriority: boolean) {
  return (path: string, signal: AbortSignal | undefined): Promise<Response> => {
    const init: RequestInit & { priority?: "low" | "auto" } = {
      cache: "reload",
      priority: lowPriority ? "low" : "auto",
    };
    if (signal) init.signal = signal;
    return fetch(path, init);
  };
}

/** Önbellekte bildirime göre yapılacak iş (ağ yok; yalnız okuma). */
export async function pendingFor(manifest: PackManifest, store: PackStore = cacheStore()) {
  const diff = diffPack(manifest, await store.readIndex(), new Set(await store.keys()));
  return { diff, ...pendingWork(diff) };
}

let persistAsked = false;
/** Tarayıcıdan kalıcı depolama ister (bir kez). Başarısız ya da desteklenmiyorsa sessizce geçer. */
export async function requestPersistence(): Promise<void> {
  if (persistAsked) return;
  persistAsked = true;
  try {
    const s = typeof navigator === "undefined" ? undefined : navigator.storage;
    if (s?.persist && !(await s.persisted?.())) await s.persist();
  } catch {
    // önemsiz
  }
}
