/**
 * Test ortamı: geçici klasörler, sahte e-posta, sözleşmeye (SOZLESME.md bölüm 3) uyan sahte oyun sunucusu ve
 * küçük bir MCP istemcisi. Gerçek HTTP ve gerçek SQLite kullanılır.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { girisSayaciniSifirla } from "../api.js";
import { readConfig, type UretimConfig } from "../config.js";
import type { Postaci } from "../giris.js";
import type { AiFetch } from "../istekYaz.js";
import type { AlanId } from "../ortak/alanlar.js";
import { pngYaz, type Rgba } from "../png.js";
import { type Uretim, uretimKur } from "../sunucu.js";

export const SAHIP = "sahip@ornek.com";
export const TOKEN = "oyun-gizli-anahtar";

export interface SahteOyun {
  url: string;
  istekler: { yontem: string; yol: string; govde: unknown; yetki: string | undefined }[];
  revizyon: string;
  havuzlar: {
    id: string;
    gameId: string;
    label: string;
    fields: unknown[];
    kayitlar: { anahtar: string; alanlar: Record<string, string>; kaynak: string; acik: boolean }[];
  }[];
  kapat(): Promise<void>;
}

export async function sahteOyun(): Promise<SahteOyun> {
  const o: SahteOyun = {
    url: "",
    istekler: [],
    revizyon: "a".repeat(40),
    havuzlar: [
      {
        id: "sizma/ciftler",
        gameId: "sizma",
        label: "Sızma kelime çiftleri",
        fields: [],
        kayitlar: [
          { anahtar: "kahve|çay", alanlar: { a: "çay", b: "kahve" }, kaynak: "yerlesik", acik: true },
        ],
      },
    ],
    kapat: async () => undefined,
  };
  let sayac = 0;
  const server: Server = createServer((req, res) => {
    const parcalar: Buffer[] = [];
    req.on("data", (d: Buffer) => parcalar.push(d));
    req.on("end", () => {
      const yol = req.url ?? "";
      let govde: unknown = null;
      try {
        govde = parcalar.length ? JSON.parse(Buffer.concat(parcalar).toString("utf8")) : null;
      } catch {
        govde = null;
      }
      o.istekler.push({ yontem: req.method ?? "", yol, govde, yetki: req.headers.authorization });
      const j = (d: number, b: unknown): void => {
        res.writeHead(d, { "Content-Type": "application/json" });
        res.end(JSON.stringify(b));
      };
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return j(404, { ok: false });
      if (yol === "/api/uretim/havuzlar") return j(200, { havuzlar: o.havuzlar });
      if (yol === "/api/uretim/moderasyon")
        return j(200, { kaliplar: [{ kalip: "kotukelime", tur: "kufur", kaynak: "panel" }] });
      if (yol === "/api/uretim/saglik") return j(200, { ok: true, revision: o.revizyon });
      if (yol === "/api/uretim/magaza/istatistik")
        return j(200, { donem: "30g", urunler: [{ id: "neon", satis: 3, kusanan: 2, firsatSatis: 1 }] });
      const ekle = /^\/api\/uretim\/havuzlar\/([^/]+)\/ekle$/.exec(yol);
      if (ekle && req.method === "POST") {
        const n = Array.isArray((govde as { satirlar?: unknown[] })?.satirlar)
          ? (govde as { satirlar: unknown[] }).satirlar.length
          : 0;
        return j(200, { aktarimId: `ak${++sayac}`, eklenen: n, atlanan: [] });
      }
      if (/^\/api\/uretim\/havuzlar\/[^/]+\/kapat$/.test(yol))
        return j(200, { aktarimId: `ak${++sayac}`, kapatilan: 1 });
      if (yol === "/api/uretim/moderasyon/ekle")
        return j(200, { aktarimId: `ak${++sayac}`, eklenen: 1, atlanan: [] });
      if (/^\/api\/uretim\/aktarim\/[^/]+\/geri-al$/.test(yol)) return j(200, { ok: true });
      j(404, { ok: false });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  o.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  o.kapat = () => new Promise<void>((r) => server.close(() => r()));
  return o;
}

/**
 * Sahte oyun alanı (test2, sözleşme bölüm 13): havuz ekle/kapat/geri al, mağaza taslak katmanı ve katman kimliği
 * taşıyan sağlık ucu. `sifirla()` gece sıfırlamasını taklit eder (kimlik değişir, yüklenenler gider).
 */
export interface SahteOyunAlani {
  url: string;
  token: string;
  katman: string;
  istekler: { yontem: string; yol: string; govde: unknown }[];
  /** aktarimId -> eklenen satırlar (geri alınmamış). */
  aktarimlar: Map<string, unknown[]>;
  taslaklar: Map<string, { urun: Record<string, unknown>; dosyalar: { yol: string; veri: string }[] }>;
  /** true iken her istek 503 (ulaşılamayan test2). */
  kapali: boolean;
  sifirla(): void;
  kapat(): Promise<void>;
}

export const TEST2_TOKEN = "test2-gizli-anahtar";

export async function sahteOyunAlani(): Promise<SahteOyunAlani> {
  let sayac = 0;
  const o: SahteOyunAlani = {
    url: "",
    token: TEST2_TOKEN,
    katman: "a1".repeat(12),
    istekler: [],
    aktarimlar: new Map(),
    taslaklar: new Map(),
    kapali: false,
    sifirla() {
      o.katman = (Number.parseInt(o.katman.slice(0, 8), 16) + 1).toString(16).padStart(8, "0").repeat(3);
      o.aktarimlar.clear();
      o.taslaklar.clear();
    },
    kapat: async () => undefined,
  };
  const server: Server = createServer((req, res) => {
    const parcalar: Buffer[] = [];
    req.on("data", (d: Buffer) => parcalar.push(d));
    req.on("end", () => {
      const yol = req.url ?? "";
      let govde: unknown = null;
      try {
        govde = parcalar.length ? JSON.parse(Buffer.concat(parcalar).toString("utf8")) : null;
      } catch {
        govde = null;
      }
      o.istekler.push({ yontem: req.method ?? "", yol, govde });
      const j = (d: number, b: unknown): void => {
        res.writeHead(d, { "Content-Type": "application/json" });
        res.end(JSON.stringify(b));
      };
      if (o.kapali) return j(503, { ok: false });
      if (req.headers.authorization !== `Bearer ${o.token}`)
        return j(401, { ok: false, code: "unauthorized" });
      if (yol === "/api/uretim/saglik")
        return j(200, {
          ok: true,
          revision: "b".repeat(40),
          ortam: "test2",
          katman: o.katman,
          taslak: o.taslaklar.size,
        });
      const ekle = /^\/api\/uretim\/havuzlar\/([^/]+)\/(ekle|kapat)$/.exec(yol);
      if (ekle && req.method === "POST") {
        const id = `ak2-${++sayac}`;
        const g = govde as { satirlar?: unknown[]; anahtarlar?: unknown[] };
        const liste = ekle[2] === "ekle" ? (g.satirlar ?? []) : (g.anahtarlar ?? []);
        o.aktarimlar.set(id, liste);
        return ekle[2] === "ekle"
          ? j(200, { aktarimId: id, eklenen: liste.length, atlanan: [] })
          : j(200, { aktarimId: id, kapatilan: liste.length });
      }
      const geri = /^\/api\/uretim\/aktarim\/([^/]+)\/geri-al$/.exec(yol);
      if (geri?.[1]) {
        if (!o.aktarimlar.has(geri[1])) return j(404, { ok: false, code: "unknown_transfer" });
        o.aktarimlar.delete(geri[1]);
        return j(200, { ok: true });
      }
      if (yol === "/api/uretim/magaza/taslak" && req.method === "POST") {
        const g = govde as { urun?: Record<string, unknown>; dosyalar?: { yol: string; veri: string }[] };
        const id = g.urun?.id;
        // Oyunun doğrulayıcısını taklit: "unvan-red" kimliği reddedilir (sitenin ön kontrolünden geçen ama oyunun
        // geçirmediği ürün).
        if (typeof id !== "string" || id === "unvan-red")
          return j(400, {
            ok: false,
            code: "invalid_item",
            message: "x",
            errors: ["asset: zaten kullanılıyor"],
          });
        o.taslaklar.set(id, { urun: g.urun ?? {}, dosyalar: g.dosyalar ?? [] });
        return j(200, { ok: true, id, katman: o.katman, degisti: true });
      }
      if (yol === "/api/uretim/magaza/taslak" && req.method === "GET")
        return j(200, { katman: o.katman, urunler: [...o.taslaklar.keys()].map((id) => ({ id })) });
      const sil = /^\/api\/uretim\/magaza\/taslak\/([^/]+)$/.exec(yol);
      if (sil?.[1] && req.method === "DELETE") {
        const silindi = o.taslaklar.delete(decodeURIComponent(sil[1]));
        return j(200, { ok: true, silindi, katman: o.katman });
      }
      j(404, { ok: false });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  o.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  o.kapat = () => new Promise<void>((r) => server.close(() => r()));
  return o;
}

export interface Ortam {
  u: Uretim;
  url: string;
  config: UretimConfig;
  dir: string;
  kodlar: string[];
  oyun: SahteOyun;
  /** Sahte oyun alanı (yalnız ortam `test2: true` ile). */
  test2: SahteOyunAlani | null;
  saat: { simdi: number };
  /** Sahip olarak giriş yapar; çerez döner. */
  giris(): Promise<string>;
  api(
    yontem: "GET" | "POST",
    yol: string,
    govde?: unknown,
    cerez?: string,
    ek?: Record<string, string>,
  ): Promise<{ durum: number; json: Record<string, unknown>; basliklar: Headers }>;
  mcp(
    anahtar: string,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<{ durum: number; json: Record<string, unknown> }>;
  arac(
    anahtar: string,
    ad: string,
    args?: Record<string, unknown>,
  ): Promise<{ hata: boolean; veri: Record<string, unknown> }>;
  anahtarUret(alan: AlanId, cerez: string): Promise<string>;
  /** SSH kanalı (ortam `ssh: true` ile): alana açık anahtar ekler; kanal anahtarı ve alanın gelen/ klasörü. */
  sshKanali(alan: AlanId, cerez: string): Promise<{ anahtar: string; gelen: string }>;
  kapat(): Promise<void>;
}

export async function ortamKur(
  ek: {
    ssh?: boolean;
    oyun?: boolean;
    gizli?: boolean;
    aiFetch?: AiFetch;
    oyunUrl?: string;
    oyunToken?: string;
    test2?: boolean;
    /** Gerçek oyun alanı (derlenmiş sunucu, `GLIX_ORTAM=test2`). */
    test2Url?: string;
    test2Token?: string;
  } = {},
): Promise<Ortam> {
  girisSayaciniSifirla();
  const dir = mkdtempSync(join(tmpdir(), "uretim-test-"));
  const oyun = await sahteOyun();
  const test2 = ek.test2 ? await sahteOyunAlani() : null;
  const kodlar: string[] = [];
  const postaci: Postaci = {
    gonder: async (_alici, _konu, metin) => {
      const m = /(\d{6})/.exec(metin);
      if (m?.[1]) kodlar.push(m[1]);
      return true;
    },
  };
  const saat = { simdi: Date.parse("2026-10-31T10:00:00Z") };
  const config: UretimConfig = {
    ...readConfig({}),
    db: join(dir, "uretim.db"),
    depoDir: join(dir, "depo"),
    aktarimDir: join(dir, "aktarim"),
    sahipEpostalar: [SAHIP],
    publicUrl: "http://uretim.test",
    oyunUrl: ek.oyun === false ? null : (ek.oyunUrl ?? oyun.url),
    oyunToken: ek.oyun === false ? null : (ek.oyunToken ?? TOKEN),
    webDir: join(dir, "web"),
    yedekDir: join(dir, "yedek"),
    gizliAnahtar: ek.gizli ? "test-gizli-anahtar-0123456789" : null,
    sshGunluk: join(dir, "girisler.log"),
    aiKey: ek.aiFetch ? "test-model-anahtari" : null,
    test2Url: ek.test2Url ?? test2?.url ?? null,
    test2Token: ek.test2Token ?? test2?.token ?? null,
    test2PublicUrl: "https://test2.ornek",
  };
  const u = uretimKur(config, {
    postaci,
    now: () => saat.simdi,
    sshYetkiDir: ek.ssh ? join(dir, "ssh-yetki") : null,
    sshKok: ek.ssh ? join(dir, "ssh") : null,
    ...(ek.aiFetch ? { aiFetch: ek.aiFetch } : {}),
  });
  await new Promise<void>((r) => u.server.listen(0, "127.0.0.1", () => r()));
  const url = `http://127.0.0.1:${(u.server.address() as AddressInfo).port}`;
  const api: Ortam["api"] = async (yontem, yol, govde, cerez, ekBaslik = {}) => {
    const r = await fetch(`${url}${yol}`, {
      method: yontem,
      headers: {
        ...(govde !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(yontem === "POST" ? { Origin: "http://uretim.test", "X-Uretim": "1" } : {}),
        ...(cerez ? { Cookie: cerez } : {}),
        ...ekBaslik,
      },
      ...(govde !== undefined ? { body: JSON.stringify(govde) } : {}),
    });
    const text = await r.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = {};
    }
    return { durum: r.status, json, basliklar: r.headers };
  };
  let rpcId = 0;
  const mcp: Ortam["mcp"] = async (anahtar, method, params) => {
    const r = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anahtar}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, ...(params ? { params } : {}) }),
    });
    const t = await r.text();
    return { durum: r.status, json: t ? (JSON.parse(t) as Record<string, unknown>) : {} };
  };
  const o: Ortam = {
    u,
    url,
    config,
    dir,
    kodlar,
    oyun,
    test2,
    saat,
    api,
    mcp,
    async arac(anahtar, ad, args = {}) {
      const r = await mcp(anahtar, "tools/call", { name: ad, arguments: args });
      const res = r.json.result as {
        isError: boolean;
        content: { text: string }[];
        structuredContent?: Record<string, unknown>;
      };
      if (res.isError) return { hata: true, veri: { mesaj: res.content[0]?.text ?? "" } };
      return { hata: false, veri: res.structuredContent ?? {} };
    },
    async giris() {
      await api("POST", "/api/giris/kod", { eposta: SAHIP });
      const kod = kodlar.at(-1) ?? "";
      const r = await api("POST", "/api/giris/dogrula", { eposta: SAHIP, kod, guvenilir: true });
      const c = r.basliklar.get("set-cookie") ?? "";
      return c.split(";")[0] ?? "";
    },
    async anahtarUret(alan, cerez) {
      const r = await api("POST", `/api/alan/${alan}/anahtar`, { ad: "Test aracı" }, cerez);
      return String(r.json.anahtar);
    },
    async sshKanali(alan, cerez) {
      await api(
        "POST",
        `/api/alan/${alan}/ssh`,
        { acik: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHk2Vn2u0pJkJm4n0yQ2kQe7mS3c4Rr0bJ7Zq3c9yR1a test" },
        cerez,
      );
      const gelen = join(dir, `ssh/${alan}/gelen`);
      mkdirSync(gelen, { recursive: true });
      mkdirSync(join(dir, `ssh/${alan}/okunur`), { recursive: true });
      return { anahtar: readFileSync(join(dir, `ssh-yetki/${alan}.anahtar`), "utf8").trim(), gelen };
    },
    async kapat() {
      await u.kapat();
      await oyun.kapat();
      await test2?.kapat();
      rmSync(dir, { recursive: true, force: true });
    },
  };
  return o;
}

/** Test görseli: kenarları şeffaf, ortası dolu daire (ya da verilen boyayıcı). */
export function gorsel(
  w: number,
  h: number,
  boya?: (x: number, y: number) => [number, number, number, number],
): Buffer {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = x - w / 2 + 0.5;
      const dy = y - h / 2 + 0.5;
      const v = boya
        ? boya(x, y)
        : Math.hypot(dx / w, dy / h) < 0.35
          ? ([40 + (x % 200), 180, 255 - (y % 100), 255] as [number, number, number, number])
          : ([0, 0, 0, 0] as [number, number, number, number]);
      data.set(v, (y * w + x) * 4);
    }
  const img: Rgba = { w, h, data };
  return pngYaz(img);
}

export const b64 = (b: Buffer): string => b.toString("base64");
