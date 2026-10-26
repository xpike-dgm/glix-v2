import { describe, expect, it } from "vitest";
import {
  diffPack,
  isArtResponse,
  type PackFile,
  type PackIndex,
  type PackManifest,
  type PackProgress,
  type PackStore,
  parseManifest,
  pendingWork,
  pruneChanged,
  pruneDiff,
  runPack,
} from "./contentPack.js";

const file = (name: string, size: number, hash = `h-${name}`): PackFile => ({
  path: `/assets/worlds/${name}.webp`,
  size,
  hash,
});
const manifestOf = (...files: PackFile[]): PackManifest => ({ version: "v1", files });

function fakeStore(initial: Record<string, string> = {}, index: PackIndex = { ...initial }) {
  const cache = new Map(Object.keys(initial).map((p) => [p, "eski"]));
  let saved: PackIndex = { ...index };
  let seen: PackIndex | null = null;
  const log: string[] = [];
  const store: PackStore = {
    keys: async () => [...cache.keys()],
    put: async (path, res) => {
      log.push(`put ${path}`);
      cache.set(path, await res.text());
    },
    delete: async (path) => {
      log.push(`delete ${path}`);
      cache.delete(path);
    },
    readIndex: async () => ({ ...saved }),
    writeIndex: async (i) => {
      saved = { ...i };
    },
    readSeen: async () => (seen ? { ...seen } : null),
    writeSeen: async (s) => {
      seen = { ...s };
    },
  };
  return {
    store,
    cache,
    log,
    index: () => saved,
    seen: () => seen,
    setSeen: (s: PackIndex | null) => {
      seen = s;
    },
  };
}

const image = (body = "x"): Response => new Response(body, { headers: { "content-type": "image/webp" } });

describe("diffPack", () => {
  it("eksik, değişen, eski ve güncel dosyaları ayırır", () => {
    const a = file("a", 10);
    const b = file("b", 20);
    const c = file("c", 30);
    const d = file("d", 40);
    const diff = diffPack(
      manifestOf(a, b, c, d),
      { [a.path]: a.hash, [b.path]: "eski-ozet", "/assets/worlds/gitti.webp": "x" },
      new Set([a.path, b.path, "/assets/worlds/gitti.webp"]),
    );
    expect(diff.current).toEqual([a]);
    expect(diff.changed).toEqual([b]);
    expect(diff.missing).toEqual([c, d]);
    expect(diff.stale).toEqual(["/assets/worlds/gitti.webp"]);
  });
  it("özeti dizinde olmayan ama önbellekte duran kayıt değişmiş sayılır", () => {
    const a = file("a", 10);
    expect(diffPack(manifestOf(a), {}, new Set([a.path])).changed).toEqual([a]);
  });
  it("dizinde olup önbellekte olmayan dosya eksiktir", () => {
    const a = file("a", 10);
    expect(diffPack(manifestOf(a), { [a.path]: a.hash }, new Set()).missing).toEqual([a]);
  });
  it("bekleyen iş yalnız eksik + değişeni sayar", () => {
    const a = file("a", 10);
    const b = file("b", 20);
    const diff = diffPack(manifestOf(a, b), { [a.path]: a.hash }, new Set([a.path]));
    expect(pendingWork(diff)).toEqual({ files: 1, bytes: 20 });
  });
});

describe("parseManifest", () => {
  const ok = { version: "v", files: [{ path: "/assets/cards/a.webp", size: 5, hash: "h" }] };
  it("geçerli bildirimi kabul eder", () => {
    expect(parseManifest(ok)?.files).toHaveLength(1);
  });
  it("bozuk, boş, yinelenen ya da dışarı kaçan yolu reddeder", () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({ version: "v", files: [] })).toBeNull();
    expect(parseManifest({ version: 1, files: ok.files })).toBeNull();
    expect(parseManifest({ version: "v", files: [{ ...ok.files[0], path: "/etc/passwd" }] })).toBeNull();
    expect(parseManifest({ version: "v", files: [{ ...ok.files[0], path: "/assets/../x" }] })).toBeNull();
    expect(parseManifest({ version: "v", files: [{ ...ok.files[0], size: -1 }] })).toBeNull();
    expect(parseManifest({ version: "v", files: [ok.files[0], ok.files[0]] })).toBeNull();
  });
});

describe("isArtResponse", () => {
  it("yalnız başarılı görsel yanıtı", () => {
    expect(isArtResponse(image())).toBe(true);
    expect(isArtResponse(new Response("<html>", { headers: { "content-type": "text/html" } }))).toBe(false);
    expect(isArtResponse(new Response("x", { status: 404, headers: { "content-type": "image/webp" } }))).toBe(
      false,
    );
  });
});

describe("runPack", () => {
  const a = file("a", 100);
  const b = file("b", 200);
  const c = file("c", 300);

  it("boş önbellekte hepsini indirir, ilerlemeyi bayt ve dosya olarak bildirir", async () => {
    const fx = fakeStore();
    const seen: PackProgress[] = [];
    const result = await runPack(manifestOf(a, b, c), fx.store, {
      concurrency: 2,
      fetchFile: async () => image(),
      onProgress: (p) => seen.push(p),
    });
    expect(result).toMatchObject({ downloaded: 3, failed: 0, removed: 0, complete: true, aborted: false });
    expect(seen[0]).toEqual({ files: 0, totalFiles: 3, bytes: 0, totalBytes: 600 });
    expect(seen.at(-1)).toEqual({ files: 3, totalFiles: 3, bytes: 600, totalBytes: 600 });
    // ilerleme hiç geriye gitmez
    for (let i = 1; i < seen.length; i++)
      expect(seen[i]?.bytes).toBeGreaterThanOrEqual(seen[i - 1]?.bytes ?? 0);
    expect(fx.index()).toEqual({ [a.path]: a.hash, [b.path]: b.hash, [c.path]: c.hash });
  });

  it("ikinci çalıştırma hiçbir şey indirmez", async () => {
    const fx = fakeStore();
    const m = manifestOf(a, b, c);
    await runPack(m, fx.store, { concurrency: 3, fetchFile: async () => image() });
    let calls = 0;
    const again = await runPack(m, fx.store, {
      concurrency: 3,
      fetchFile: async () => {
        calls++;
        return image();
      },
    });
    expect(calls).toBe(0);
    expect(again).toMatchObject({ downloaded: 0, complete: true });
  });

  it("başlangıçta güncel olanlar ilerlemeye baştan eklenir", async () => {
    const fx = fakeStore({ [a.path]: a.hash });
    const seen: PackProgress[] = [];
    await runPack(manifestOf(a, b), fx.store, {
      concurrency: 2,
      fetchFile: async () => image(),
      onProgress: (p) => seen.push(p),
    });
    expect(seen[0]).toEqual({ files: 1, totalFiles: 2, bytes: 100, totalBytes: 300 });
  });

  it("tek özet değişince yalnız o dosya iner; eskisi önce silinir", async () => {
    const fx = fakeStore();
    await runPack(manifestOf(a, b, c), fx.store, { concurrency: 3, fetchFile: async () => image() });
    fx.log.length = 0;
    const fetched: string[] = [];
    const changedB = { ...b, hash: "yeni" };
    const r = await runPack(manifestOf(a, changedB, c), fx.store, {
      concurrency: 3,
      fetchFile: async (p) => {
        fetched.push(p);
        return image("yeni içerik");
      },
    });
    expect(fetched).toEqual([b.path]);
    expect(r.downloaded).toBe(1);
    expect(fx.log).toEqual([`delete ${b.path}`, `put ${b.path}`]);
    expect(fx.cache.get(b.path)).toBe("yeni içerik");
    expect(fx.index()[b.path]).toBe("yeni");
  });

  it("listeden düşen kayıtları siler, dizinden de çıkarır", async () => {
    const gone = "/assets/worlds/gitti.webp";
    const fx = fakeStore({ [a.path]: a.hash, [gone]: "x" });
    const r = await runPack(manifestOf(a), fx.store, { concurrency: 2, fetchFile: async () => image() });
    expect(r.removed).toBe(1);
    expect(fx.cache.has(gone)).toBe(false);
    expect(fx.index()[gone]).toBeUndefined();
    expect(fx.cache.has(a.path)).toBe(true);
  });

  it("kesilince kaldığı yerden sürer: ikinci çalıştırma yalnız kalanı indirir", async () => {
    const fx = fakeStore();
    const m = manifestOf(a, b, c);
    const abort = new AbortController();
    let n = 0;
    const first = await runPack(m, fx.store, {
      concurrency: 1,
      signal: abort.signal,
      fetchFile: async () => {
        if (++n === 2) abort.abort();
        return image();
      },
    });
    expect(first.aborted).toBe(true);
    expect(first.complete).toBe(false);
    expect(first.downloaded).toBeLessThan(3);
    const fetched: string[] = [];
    const second = await runPack(m, fx.store, {
      concurrency: 1,
      fetchFile: async (p) => {
        fetched.push(p);
        return image();
      },
    });
    expect(fetched.length).toBe(3 - first.downloaded);
    expect(second.complete).toBe(true);
    expect(first.downloaded + second.downloaded).toBe(3);
  });

  it("iptal edilmiş fetch hata sayılmaz", async () => {
    const fx = fakeStore();
    const abort = new AbortController();
    const r = await runPack(manifestOf(a, b), fx.store, {
      concurrency: 2,
      signal: abort.signal,
      fetchFile: async () => {
        abort.abort();
        throw new DOMException("iptal", "AbortError");
      },
    });
    expect(r).toMatchObject({ aborted: true, failed: 0, complete: false });
  });

  it("hatalı dosyayı bir kez daha dener; yine olmazsa başarısız sayar ve diğerlerine devam eder", async () => {
    const fx = fakeStore();
    const tries = new Map<string, number>();
    const r = await runPack(manifestOf(a, b), fx.store, {
      concurrency: 2,
      retryDelayMs: 0,
      fetchFile: async (p) => {
        tries.set(p, (tries.get(p) ?? 0) + 1);
        if (p === a.path) throw new Error("ağ");
        return image();
      },
    });
    expect(tries.get(a.path)).toBe(2);
    expect(r).toMatchObject({ downloaded: 1, failed: 1, complete: false });
    expect(fx.cache.has(a.path)).toBe(false);
    expect(fx.index()[a.path]).toBeUndefined();
    expect(fx.index()[b.path]).toBe(b.hash);
  });

  it("görsel olmayan yanıtı (SPA geri dönüşü) saklamaz", async () => {
    const fx = fakeStore();
    const r = await runPack(manifestOf(a), fx.store, {
      concurrency: 1,
      retryDelayMs: 0,
      fetchFile: async () => new Response("<html>", { headers: { "content-type": "text/html" } }),
    });
    expect(r.failed).toBe(1);
    expect(fx.cache.size).toBe(0);
  });

  it("eşzamanlılık sınırını aşmaz", async () => {
    const fx = fakeStore();
    const files = Array.from({ length: 12 }, (_, i) => file(`f${i}`, 10));
    let active = 0;
    let peak = 0;
    await runPack(manifestOf(...files), fx.store, {
      concurrency: 4,
      fetchFile: async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return image();
      },
    });
    expect(peak).toBe(4);
  });
});

describe("pruneDiff / pruneChanged", () => {
  const a = file("a", 1);
  const b = file("b", 1);
  const c = file("c", 1);

  it("özeti değişen ve listeden düşen yolları verir; yenileri ve aynıları vermez", () => {
    const seen = { [a.path]: a.hash, [b.path]: "eski", "/assets/worlds/gitti.webp": "x" };
    expect(pruneDiff(manifestOf(a, b, c), seen).sort()).toEqual([b.path, "/assets/worlds/gitti.webp"].sort());
  });

  it("ilk çalıştırmada (kayıt ve dizin yok) hiçbir şey silmez, yalnız kaydeder", async () => {
    const fx = fakeStore({ [a.path]: "x" }, {});
    const dropped = await pruneChanged(manifestOf(a, b), fx.store);
    expect(dropped).toEqual([]);
    expect(fx.cache.has(a.path)).toBe(true);
    expect(fx.seen()).toEqual({ [a.path]: a.hash, [b.path]: b.hash });
  });

  it("değişen kaydı önbellekten ve dizinden siler, başkalarına dokunmaz, indirme yapmaz", async () => {
    const fx = fakeStore({ [a.path]: a.hash, [b.path]: b.hash });
    fx.setSeen({ [a.path]: a.hash, [b.path]: b.hash });
    const changed = { ...b, hash: "yeni" };
    const dropped = await pruneChanged(manifestOf(a, changed), fx.store);
    expect(dropped).toEqual([b.path]);
    expect(fx.cache.has(b.path)).toBe(false);
    expect(fx.cache.has(a.path)).toBe(true);
    expect(fx.index()[b.path]).toBeUndefined();
    expect(fx.log).toEqual([`delete ${b.path}`]);
    expect(fx.seen()?.[b.path]).toBe("yeni");
  });

  it("kayıt yokken havuz dizini varsa onu kullanır", async () => {
    const fx = fakeStore({ [a.path]: a.hash, [b.path]: b.hash });
    const dropped = await pruneChanged(manifestOf(a, { ...b, hash: "yeni" }), fx.store);
    expect(dropped).toEqual([b.path]);
  });

  it("listeden düşen kaydı siler; ikinci çalıştırma bir şey silmez", async () => {
    const fx = fakeStore({ [a.path]: a.hash, [c.path]: c.hash });
    fx.setSeen({ [a.path]: a.hash, [c.path]: c.hash });
    expect(await pruneChanged(manifestOf(a), fx.store)).toEqual([c.path]);
    expect(await pruneChanged(manifestOf(a), fx.store)).toEqual([]);
  });
});
