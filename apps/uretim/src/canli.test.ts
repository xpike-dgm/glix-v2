/**
 * Canlı güncelleme (`/api/olaylar`, Server-Sent Events): iki istemci (biri karar verir, öteki olayla haberdar olur),
 * yeniden bağlanma, yetkisiz bağlantı reddi, oturum bitince akışın kapanması, Caddy için başlıklar.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CANLI_TUT_MS, eylemdenOlay } from "./olaylar.js";
import { b64, gorsel, type Ortam, ortamKur } from "./test/ortam.js";

let o: Ortam;
beforeEach(async () => {
  o = await ortamKur();
});
afterEach(async () => {
  await o.kapat();
});

interface Akis {
  durum: number;
  basliklar: Headers;
  /** Belirtilen olay gelene kadar bekler (en çok 5 sn). */
  bekle(f: (olay: { event: string; data: string }) => boolean): Promise<{ event: string; data: string }>;
  ham(): string;
  kapat(): void;
}

async function akisAc(cerez: string | null): Promise<Akis> {
  const ac = new AbortController();
  const r = await fetch(`${o.url}/api/olaylar`, {
    headers: { Accept: "text/event-stream", ...(cerez ? { Cookie: cerez } : {}) },
    signal: ac.signal,
  });
  let tampon = "";
  let hepsi = "";
  const olaylar: { event: string; data: string }[] = [];
  const bekleyenler: {
    f: (x: { event: string; data: string }) => boolean;
    coz: (x: { event: string; data: string }) => void;
  }[] = [];
  const isle = (): void => {
    let i = tampon.indexOf("\n\n");
    while (i >= 0) {
      const blok = tampon.slice(0, i);
      tampon = tampon.slice(i + 2);
      const event = /^event: (.+)$/m.exec(blok)?.[1];
      const data = /^data: (.+)$/m.exec(blok)?.[1];
      if (event && data !== undefined) {
        const x = { event, data };
        olaylar.push(x);
        for (const b of [...bekleyenler])
          if (b.f(x)) {
            bekleyenler.splice(bekleyenler.indexOf(b), 1);
            b.coz(x);
          }
      }
      i = tampon.indexOf("\n\n");
    }
  };
  if (r.body && r.status === 200) {
    const okuyucu = r.body.getReader();
    const dec = new TextDecoder();
    void (async () => {
      try {
        for (;;) {
          const { done, value } = await okuyucu.read();
          if (done) break;
          const t = dec.decode(value, { stream: true });
          tampon += t;
          hepsi += t;
          isle();
        }
      } catch {
        // kapandı
      }
    })();
  }
  return {
    durum: r.status,
    basliklar: r.headers,
    ham: () => hepsi,
    bekle: (f) =>
      new Promise((coz, red) => {
        const var_ = olaylar.find(f);
        if (var_) return coz(var_);
        const z = setTimeout(() => red(new Error("olay gelmedi")), 5000);
        bekleyenler.push({
          f,
          coz: (x) => {
            clearTimeout(z);
            coz(x);
          },
        });
      }),
    kapat: () => ac.abort(),
  };
}

const olayMi =
  (tur: string, alan?: string) =>
  (x: { event: string; data: string }): boolean => {
    if (x.event !== "degisti") return false;
    const d = JSON.parse(x.data) as { tur: string; alan: string | null };
    return d.tur === tur && (alan === undefined || d.alan === alan);
  };

describe("canlı güncelleme akışı", () => {
  it("oturumsuz bağlantı 401; Caddy ardında tamponsuz başlıklar", async () => {
    expect((await akisAc(null)).durum).toBe(401);
    expect((await akisAc("uretim_oturum=sahte")).durum).toBe(401);
    const c = await o.giris();
    const a = await akisAc(c);
    expect(a.durum).toBe(200);
    expect(a.basliklar.get("content-type")).toMatch(/^text\/event-stream/);
    expect(a.basliklar.get("cache-control")).toMatch(/no-cache/);
    expect(a.basliklar.get("x-accel-buffering")).toBe("no");
    await a.bekle((x) => x.event === "hazir");
    expect(a.ham()).toMatch(/^retry: 5000\n/);
    a.kapat();
    expect(CANLI_TUT_MS).toBe(25_000);
  });

  it("iki istemci: telefonda karar verilince bilgisayardaki akışa olay gelir (yapay zekâ teslimi de)", async () => {
    const bilgisayar = await o.giris();
    o.saat.simdi += 61_000; // iki kod arası en az 60 sn
    const telefon = await o.giris();
    expect(bilgisayar).not.toBe(telefon);
    const a = await akisAc(bilgisayar);
    await a.bekle((x) => x.event === "hazir");
    const k = await o.anahtarUret("rozet", telefon);
    const y = await o.arac(k, "dosya_yukle", { ad: "usta.png", icerik_base64: b64(gorsel(256, 256)) });
    const t = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [
        {
          ad: "Usta",
          dosyalar: [{ dosyaId: y.veri.dosyaId, hedefYol: "apps/client/public/assets/badges/usta.webp" }],
        },
      ],
    });
    await a.bekle(olayMi("teslim", "rozet"));
    const id = (t.veri.ogeler as { ogeId: number }[])[0]?.ogeId ?? 0;
    // Pano olaydan sonra yeni bekleyeni gösterir.
    const pano1 = await o.api("GET", "/api/pano", undefined, bilgisayar);
    expect(
      (pano1.json.alanlar as { alan: string; bekleyen: number }[]).find((x) => x.alan === "rozet")?.bekleyen,
    ).toBe(1);
    // Telefonda karar → bilgisayara "karar" olayı, pano güncel.
    await o.api("POST", `/api/oge/${id}/karar`, { karar: "onay" }, telefon);
    await a.bekle(olayMi("karar", "rozet"));
    const pano2 = await o.api("GET", "/api/pano", undefined, bilgisayar);
    expect(
      (pano2.json.alanlar as { alan: string; bekleyen: number }[]).find((x) => x.alan === "rozet")?.bekleyen,
    ).toBe(0);
    // Geri alma ayrı olay türüyle.
    await o.api("POST", `/api/oge/${id}/geri-al`, {}, telefon);
    await a.bekle(olayMi("geri_al", "rozet"));
    // Olayda içerik ya da sır yok: yalnız tür, alan, sıra.
    expect(a.ham()).not.toMatch(/Usta|usta\.png|um_rozet/);
    a.kapat();
  });

  it("yeniden bağlanma: kopan akış bırakılır, yeni akış hazır olayı ve sonraki olayları alır", async () => {
    const c = await o.giris();
    const a = await akisAc(c);
    await a.bekle((x) => x.event === "hazir");
    expect(o.u.yayin.acikAkis).toBe(1);
    a.kapat();
    for (let i = 0; i < 50 && o.u.yayin.acikAkis > 0; i++) await new Promise((r) => setTimeout(r, 20));
    expect(o.u.yayin.acikAkis).toBe(0);
    const b = await akisAc(c);
    await b.bekle((x) => x.event === "hazir");
    await o.api("POST", "/api/alan/magaza/is", { baslik: "Yeni koleksiyon", aciklama: "x", adet: 2 }, c);
    await b.bekle(olayMi("is", "magaza"));
    b.kapat();
  });

  it("çıkış yapılınca akış sonraki olay ya da canlı tutmada kapanır", async () => {
    const c = await o.giris();
    const a = await akisAc(c);
    await a.bekle((x) => x.event === "hazir");
    await o.api("POST", "/api/cikis", {}, c);
    o.u.yayin.canliTut();
    expect(o.u.yayin.acikAkis).toBe(0);
    a.kapat();
  });

  it("denetim eylemleri olay türüne eşlenir; veriyi değiştirmeyenler yayılmaz", () => {
    expect(eylemdenOlay("onay")).toBe("karar");
    expect(eylemdenOlay("onay", "öğe 3 kararı geri alındı")).toBe("geri_al");
    expect(eylemdenOlay("is", "iş 4 kilidi açıldı")).toBe("kilit");
    expect(eylemdenOlay("giris")).toBeNull();
    expect(eylemdenOlay("istem_kopyalandi")).toBeNull();
  });
});
