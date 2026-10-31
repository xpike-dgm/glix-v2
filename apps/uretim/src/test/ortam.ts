/**
 * Test ortamı: geçici klasörler, sahte e-posta, sözleşmeye (SOZLESME.md bölüm 3) uyan sahte oyun sunucusu ve
 * küçük bir MCP istemcisi. Gerçek HTTP ve gerçek SQLite kullanılır.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { girisSayaciniSifirla } from "../api.js";
import { readConfig, type UretimConfig } from "../config.js";
import type { Postaci } from "../giris.js";
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

export interface Ortam {
  u: Uretim;
  url: string;
  config: UretimConfig;
  dir: string;
  kodlar: string[];
  oyun: SahteOyun;
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
  kapat(): Promise<void>;
}

export async function ortamKur(ek: { ssh?: boolean; oyun?: boolean } = {}): Promise<Ortam> {
  girisSayaciniSifirla();
  const dir = mkdtempSync(join(tmpdir(), "uretim-test-"));
  const oyun = await sahteOyun();
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
    oyunUrl: ek.oyun === false ? null : oyun.url,
    oyunToken: ek.oyun === false ? null : TOKEN,
    webDir: join(dir, "web"),
    yedekDir: join(dir, "yedek"),
  };
  const u = uretimKur(config, {
    postaci,
    now: () => saat.simdi,
    sshYetkiDir: ek.ssh ? join(dir, "ssh-yetki") : null,
    sshKok: ek.ssh ? join(dir, "ssh") : null,
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
    async kapat() {
      await u.kapat();
      await oyun.kapat();
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
