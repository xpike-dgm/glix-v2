/**
 * Görsel kuralı (sözleşme bölüm 10): kural istemde/talimatta/iş taslağında/is_oku'da sabit; teslim üretim yöntemini
 * bildirir ("kod" reddedilir, eksikse uyarı); "kodla çizilmiş olabilir" belirtisi gerçek görsellerde susar;
 * referans klasörleri eşitlenir.
 */
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type CliOrtami, calistirKomut } from "./cli/uretim.js";
import { openDb } from "./db.js";
import { type AiFetch, donusturucuKur, istemUret } from "./istekYaz.js";
import { kodCizimiBelirtisi } from "./kontrol/gorsel.js";
import { ffmpegVar, gorselAc } from "./medya.js";
import { ALANLAR } from "./ortak/alanlar.js";
import {
  GORSEL_ALANLARI,
  GORSEL_KURALI_BASLIGI,
  GORSEL_KURALI_KISA,
  REFERANS_KLASORLERI,
} from "./ortak/gorselKurali.js";
import { pngYaz, type Rgba } from "./png.js";
import { b64, gorsel, type Ortam, ortamKur } from "./test/ortam.js";

const FFMPEG = await ffmpegVar();
const KOK = resolve(import.meta.dirname, "../../..");
const VARLIK = join(KOK, "apps/client/public/assets");

let o: Ortam | null = null;
afterEach(async () => {
  await o?.kapat();
  o = null;
});

/** Kodla çizilmiş çerçeve (Python/PIL'in yaptığı gibi): düz renkli sekizgen halkalar, kenar yumuşatmalı. */
function kodlaCerceve(w = 512): Rgba {
  const d = new Uint8Array(w * w * 4);
  const renkler = [
    [255, 60, 200],
    [60, 220, 255],
    [255, 220, 60],
  ] as const;
  const ss = 3;
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      let r0 = 0;
      let g0 = 0;
      let b0 = 0;
      let n = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss - w / 2;
          const py = y + (sy + 0.5) / ss - w / 2;
          const r = Math.max(Math.abs(px), Math.abs(py), (Math.abs(px) + Math.abs(py)) / 1.3);
          const c =
            r > w * 0.42 && r < w * 0.48
              ? renkler[0]
              : r > w * 0.36 && r < w * 0.4
                ? renkler[1]
                : r > w * 0.33 && r < w * 0.35
                  ? renkler[2]
                  : null;
          if (c) {
            r0 += c[0];
            g0 += c[1];
            b0 += c[2];
            n += 1;
          }
        }
      const i = (y * w + x) * 4;
      if (n) {
        d[i] = Math.round(r0 / n);
        d[i + 1] = Math.round(g0 / n);
        d[i + 2] = Math.round(b0 / n);
        d[i + 3] = Math.round((255 * n) / (ss * ss));
      }
    }
  return { w, h: w, data: d };
}

describe("kural metni her yerde ve çıkarılamaz", () => {
  it("kopyalanan istemde (MCP ve SSH) görsel alanlarında öne konur; ses alanında yok", () => {
    for (const a of GORSEL_ALANLARI)
      for (const b of ["mcp", "ssh"] as const) {
        const satirlar = istemUret(a, b, []).split("\n");
        expect(satirlar[1]).toMatch(/^ÖNEMLİ — GÖRSEL KURALI/);
        expect(satirlar[1]).toMatch(/imagegen/);
        expect(satirlar[1]).toMatch(/Python\/PIL, SVG, canvas/);
        expect(satirlar[1]).toMatch(/görsel teslim etme/);
        expect(satirlar[1]).toMatch(/referans/);
      }
    expect(istemUret("ses", "mcp", [])).not.toMatch(/GÖRSEL KURALI/);
  });

  it("iş taslağı: model kuralı yazmasa da, kalıp kullanılsa da kod ekler", async () => {
    const db = openDb(":memory:");
    const sahte: AiFetch = async () => ({
      status: 200,
      json: async () => ({
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              baslik: "Dört çerçeve",
              aciklama: "İki tanesi animasyonlu.",
              ozet: "4 çerçeve",
              kisitlar: Array.from({ length: 10 }, (_, i) => `kısıt ${i}`),
              kabul: [],
            }),
          },
        ],
      }),
    });
    const girdi = {
      metin: "4 çerçeve, 2 si animasyonlu",
      alan: "magaza" as const,
      baglanti: "ssh" as const,
      fikirTuru: false,
      sonTarih: null,
    };
    for (const d of [donusturucuKur(db, "anahtar", { fetch: sahte }), donusturucuKur(db, null)]) {
      const r = await d.taslak(girdi, Date.now());
      expect(r.taslak.aciklama.startsWith(`## ${GORSEL_KURALI_BASLIGI}`)).toBe(true);
      expect(r.taslak.kisitlar[0]).toBe(GORSEL_KURALI_KISA);
      expect(r.taslak.kisitlar.length).toBeLessThanOrEqual(10);
      expect(r.taslak.aciklama.length).toBeLessThanOrEqual(2000);
    }
    const ses = await donusturucuKur(db, null).taslak({ ...girdi, alan: "ses" }, Date.now());
    expect(ses.taslak.aciklama).not.toMatch(/GÖRSEL KURALI/);
  });

  it("talimat (sahip kuralı silse de) ve is_oku kuralı içerir", async () => {
    o = await ortamKur();
    const c = await o.giris();
    await o.api("POST", "/api/alan/magaza/talimat", { metin: "# Mağaza\nYalnız çerçeve yap." }, c);
    const k = await o.anahtarUret("magaza", c);
    const t = await o.arac(k, "talimat_oku");
    const metin = String(t.veri.metin);
    expect(metin.indexOf(GORSEL_KURALI_BASLIGI)).toBeGreaterThan(0);
    expect(metin.indexOf(GORSEL_KURALI_BASLIGI)).toBeLessThan(metin.indexOf("Yalnız çerçeve"));
    const is = await o.api(
      "POST",
      "/api/alan/magaza/is",
      { baslik: "Dört çerçeve", aciklama: "x", adet: 4 },
      c,
    );
    const id = (is.json.is as { id: number }).id;
    const oku = await o.arac(k, "is_oku", { id });
    expect((oku.veri.gorselKurali as string[]).join(" ")).toMatch(/kodla görsel çizme/);
  });
});

describe("teslim bildirimi: uretimYontemi", () => {
  const teslim = (dosyaId: string, ek: Record<string, unknown>) => ({
    tur: "yeni",
    ...ek,
    ogeler: [{ ad: "Usta", dosyalar: [{ dosyaId, hedefYol: "apps/client/public/assets/badges/usta.webp" }] }],
  });

  it('"kod" reddedilir, eksikse uyarı, "gorsel-model" geçer; geçersiz değer hata', async () => {
    o = await ortamKur();
    const c = await o.giris();
    const k = await o.anahtarUret("rozet", c);
    const y = await o.arac(k, "dosya_yukle", { ad: "usta.png", icerik_base64: b64(gorsel(256, 256)) });
    const id = String(y.veri.dosyaId);
    const sonuc = async (ek: Record<string, unknown>) => {
      if (!o) throw new Error("ortam yok");
      const r = await o.arac(k, "on_kontrol", teslim(id, ek));
      return (
        r.veri.ogeler as { sonuc: string; satirlar: { kod: string; sonuc: string; mesaj: string }[] }[]
      )[0];
    };
    const kod = await sonuc({ uretimYontemi: "kod" });
    expect(kod?.sonuc).toBe("kaldi");
    expect(kod?.satirlar.find((s) => s.kod === "uretim-yontemi")?.mesaj).toMatch(/kodla .* kabul edilmez/);
    expect((await sonuc({}))?.satirlar.find((s) => s.kod === "uretim-yontemi")?.sonuc).toBe("uyari");
    // Geçen satırlar yanıtta gösterilmeyebilir: uyarı/kaldı olmaması yeter.
    expect(
      (await sonuc({ uretimYontemi: "gorsel-model" }))?.satirlar.find((s) => s.kod === "uretim-yontemi")
        ?.sonuc ?? "gecti",
    ).toBe("gecti");
    const gecersiz = await o.arac(k, "on_kontrol", teslim(id, { uretimYontemi: "elle-cizdim" }));
    expect(gecersiz.veri.sonuc).toBe("kaldi");
    expect(JSON.stringify(gecersiz.veri.hatalar)).toMatch(/uretimYontemi/);
  });

  it("SSH komut aracı: teslim-et <paket> gorsel-model bildirimi ekler; geçersiz değer reddedilir", async () => {
    const gelen = mkdtempSync(join(tmpdir(), "gelen-"));
    try {
      mkdirSync(join(gelen, "p1"));
      writeFileSync(join(gelen, "p1/teslim.json"), JSON.stringify({ tur: "yeni", ogeler: [{ ad: "X" }] }));
      const gonderilen: Record<string, unknown>[] = [];
      const ortam: CliOrtami = {
        url: "http://yerel/mcp",
        anahtar: "um_rozet_x",
        gelen,
        stdin: () => Buffer.alloc(0),
        fetchImpl: (async (_u: string, init: { body: string }) => {
          const j = JSON.parse(init.body) as { id: number; params: { arguments: Record<string, unknown> } };
          gonderilen.push(j.params.arguments);
          return new Response(
            JSON.stringify({ jsonrpc: "2.0", id: j.id, result: { content: [], structuredContent: {} } }),
          );
        }) as unknown as typeof fetch,
      };
      await calistirKomut(ortam, "on-kontrol p1 gorsel-model");
      expect(gonderilen.at(-1)?.uretimYontemi).toBe("gorsel-model");
      await expect(calistirKomut(ortam, "on-kontrol p1 elle")).rejects.toThrow(/gorsel-model/);
    } finally {
      rmSync(gelen, { recursive: true, force: true });
    }
  });
});

describe('"kodla çizilmiş olabilir" belirtisi (yalnız uyarı)', () => {
  it("kodla çizilmiş çerçeve şüpheli; aynı çerçeve ön kontrolde uyarı alır (reddedilmez)", async () => {
    const img = kodlaCerceve();
    const png = pngYaz(img);
    const k = kodCizimiBelirtisi(img, png.length);
    expect(k?.supheli).toBe(true);
    o = await ortamKur();
    const c = await o.giris();
    const a = await o.anahtarUret("magaza", c);
    const y = await o.arac(a, "dosya_yukle", { ad: "kod.png", icerik_base64: png.toString("base64") });
    const r = await o.arac(a, "on_kontrol", {
      tur: "yeni",
      uretimYontemi: "gorsel-model",
      ogeler: [
        {
          ad: "Kod",
          dosyalar: [
            { dosyaId: y.veri.dosyaId, hedefYol: "apps/client/public/assets/shop/cerceve/kod.webp" },
          ],
        },
      ],
    });
    const satirlar = (r.veri.ogeler as { satirlar: { kod: string; sonuc: string }[] }[])[0]?.satirlar ?? [];
    expect(satirlar.find((s) => s.kod === "kod-cizimi")?.sonuc).toBe("uyari");
  });

  it.skipIf(!FFMPEG)(
    "oyundaki gerçek görsellerin hiçbirinde yanlış alarm yok",
    async () => {
      const dosyalar: string[] = [];
      const gez = (d: string): void => {
        for (const a of readdirSync(d)) {
          const p = join(d, a);
          if (statSync(p).isDirectory()) gez(p);
          else if ([".png", ".webp"].includes(extname(p))) dosyalar.push(p);
        }
      };
      for (const k of new Set(Object.values(REFERANS_KLASORLERI).flat()))
        if (existsSync(join(VARLIK, k))) gez(join(VARLIK, k));
      expect(dosyalar.length).toBeGreaterThan(300);
      const yanlis: string[] = [];
      for (const p of dosyalar) {
        const img = await gorselAc(readFileSync(p), p.endsWith(".png") ? "png" : "webp");
        if (kodCizimiBelirtisi(img, pngYaz(img).length)?.supheli) yanlis.push(p);
      }
      expect(yanlis).toEqual([]);
    },
    300_000,
  );
});

describe("referans klasörleri (okunur/referans/)", () => {
  const BETIK = resolve(KOK, "deploy/uretim/ssh/referans.sh");

  it("referanslar.txt koddaki eşlemeyle aynı; her görsel alanın referansı var", () => {
    const satirlar = readFileSync(resolve(KOK, "deploy/uretim/ssh/referanslar.txt"), "utf8")
      .trim()
      .split("\n");
    const dosya = Object.fromEntries(satirlar.map((s) => [s.split(" ")[0], s.split(" ").slice(1)]));
    expect(dosya).toEqual(REFERANS_KLASORLERI);
    for (const a of GORSEL_ALANLARI) expect(REFERANS_KLASORLERI[a]?.length).toBeGreaterThan(0);
    for (const a of GORSEL_ALANLARI) expect(ALANLAR.some((x) => x.id === a)).toBe(true);
  });

  it("referans.sh yalnız düz görsel/JSON dosyalarını kopyalar, bağ izlemez, eskileri temizler", () => {
    const d = mkdtempSync(join(tmpdir(), "referans-"));
    try {
      const kaynak = join(d, "assets");
      mkdirSync(join(kaynak, "shop/cerceve"), { recursive: true });
      mkdirSync(join(kaynak, "karakter"), { recursive: true });
      writeFileSync(join(kaynak, "shop/cerceve/galaksi.webp"), "webp");
      writeFileSync(join(kaynak, "karakter/rig.json"), "{}");
      writeFileSync(join(kaynak, "shop/notlar.txt"), "gizli");
      writeFileSync(join(d, "sir"), "sır");
      symlinkSync(join(d, "sir"), join(kaynak, "shop/cerceve/bag.webp"));
      mkdirSync(join(d, "ssh/magaza/okunur"), { recursive: true });
      writeFileSync(join(d, "ssh/magaza/okunur/talimat.md"), "talimat");
      const calistir = () =>
        execFileSync("bash", [BETIK], {
          env: {
            PATH: process.env.PATH ?? "",
            URETIM_REFERANS_KAYNAK: kaynak,
            URETIM_SSH_KOK: join(d, "ssh"),
            URETIM_REFERANS_LISTE: resolve(KOK, "deploy/uretim/ssh/referanslar.txt"),
          },
        });
      calistir();
      const ref = join(d, "ssh/magaza/okunur/referans");
      expect(readFileSync(join(ref, "shop/cerceve/galaksi.webp"), "utf8")).toBe("webp");
      expect(existsSync(join(ref, "karakter/rig.json"))).toBe(true);
      expect(existsSync(join(ref, "shop/notlar.txt"))).toBe(false);
      expect(existsSync(join(ref, "shop/cerceve/bag.webp"))).toBe(false);
      expect(statSync(join(ref, "shop/cerceve/galaksi.webp")).mode & 0o777).toBe(0o644);
      expect(statSync(ref).mode & 0o022).toBe(0);
      // Sitenin yazdığı dosyalara dokunulmaz; kaynaktan silinen referanstan da silinir.
      expect(readFileSync(join(d, "ssh/magaza/okunur/talimat.md"), "utf8")).toBe("talimat");
      rmSync(join(kaynak, "karakter/rig.json"));
      calistir();
      expect(existsSync(join(ref, "karakter/rig.json"))).toBe(false);
      expect(readdirSync(join(d, "ssh/magaza/okunur")).sort()).toEqual(["referans", "talimat.md"]);
      chmodSync(d, 0o700);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});
