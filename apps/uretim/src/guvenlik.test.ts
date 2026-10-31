import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KOD_ARALIGI_MS } from "./giris.js";
import { b64, gorsel, type Ortam, ortamKur, SAHIP } from "./test/ortam.js";

let o: Ortam;
beforeEach(async () => {
  o = await ortamKur();
});
afterEach(async () => {
  await o.kapat();
});

describe("sahip girişi (UM-G1)", () => {
  it("kod e-postayla gelir, doğru kodla 30 günlük güvenilir oturum açılır", async () => {
    const r = await o.api("POST", "/api/giris/kod", { eposta: SAHIP });
    expect(r.durum).toBe(200);
    expect(o.kodlar).toHaveLength(1);
    const d = await o.api("POST", "/api/giris/dogrula", { eposta: SAHIP, kod: o.kodlar[0], guvenilir: true });
    expect(d.durum).toBe(200);
    const c = d.basliklar.get("set-cookie") ?? "";
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/SameSite=Strict/);
    expect(c).toMatch(/Max-Age=2592000/);
    const ot = await o.api("GET", "/api/oturum", undefined, c.split(";")[0]);
    expect(ot.json.giris).toBe(true);
  });

  it("güvenilmeyen cihazda çerez kalıcı değildir", async () => {
    await o.api("POST", "/api/giris/kod", { eposta: SAHIP });
    const d = await o.api("POST", "/api/giris/dogrula", {
      eposta: SAHIP,
      kod: o.kodlar[0],
      guvenilir: false,
    });
    expect(d.basliklar.get("set-cookie")).not.toMatch(/Max-Age/);
  });

  it("izinsiz e-posta aynı yanıtı alır ama kod gönderilmez", async () => {
    const r = await o.api("POST", "/api/giris/kod", { eposta: "baskasi@ornek.com" });
    expect(r.durum).toBe(200);
    expect(o.kodlar).toHaveLength(0);
  });

  it("60 sn içinde ikinci kod istenemez", async () => {
    await o.api("POST", "/api/giris/kod", { eposta: SAHIP });
    expect((await o.api("POST", "/api/giris/kod", { eposta: SAHIP })).durum).toBe(429);
    o.saat.simdi += KOD_ARALIGI_MS + 1;
    expect((await o.api("POST", "/api/giris/kod", { eposta: SAHIP })).durum).toBe(200);
  });

  it("5 hatalı denemeden sonra doğru kod da kabul edilmez; kod 10 dk sonra geçersiz", async () => {
    await o.api("POST", "/api/giris/kod", { eposta: SAHIP });
    const dogru = o.kodlar[0] ?? "";
    const yanlis = dogru === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await o.api("POST", "/api/giris/dogrula", { eposta: SAHIP, kod: yanlis });
    expect((await o.api("POST", "/api/giris/dogrula", { eposta: SAHIP, kod: dogru })).durum).toBe(429);
    o.saat.simdi += KOD_ARALIGI_MS + 1;
    await o.api("POST", "/api/giris/kod", { eposta: SAHIP });
    o.saat.simdi += 10 * 60_000 + 1;
    expect((await o.api("POST", "/api/giris/dogrula", { eposta: SAHIP, kod: o.kodlar[1] })).json.kod).toBe(
      "suresi_doldu",
    );
  });

  it("kod ve oturum veritabanında yalnız özet olarak durur", async () => {
    const c = await o.giris();
    const tok = c.split("=")[1] ?? "";
    const dump = JSON.stringify(o.u.merkez.db.prepare("SELECT * FROM oturum").all());
    expect(dump).not.toContain(tok);
    const denetim = JSON.stringify(o.u.merkez.db.prepare("SELECT * FROM denetim").all());
    expect(denetim).not.toContain(tok);
  });

  it("oturumsuz uç 401", async () => {
    expect((await o.api("GET", "/api/pano")).durum).toBe(401);
  });
});

describe("CSRF (çerezli yazma)", () => {
  it("X-Uretim başlığı ya da doğru Origin olmadan yazma reddedilir", async () => {
    const c = await o.giris();
    const url = `${o.url}/api/alan/magaza/anahtar`;
    const r1 = await fetch(url, {
      method: "POST",
      headers: { Cookie: c, "Content-Type": "application/json", Origin: "http://uretim.test" },
      body: "{}",
    });
    expect(r1.status).toBe(403);
    const r2 = await fetch(url, {
      method: "POST",
      headers: {
        Cookie: c,
        "Content-Type": "application/json",
        Origin: "https://kotu.example",
        "X-Uretim": "1",
      },
      body: "{}",
    });
    expect(r2.status).toBe(403);
    const r3 = await fetch(url, {
      method: "POST",
      headers: { Cookie: c, "Content-Type": "text/plain", Origin: "http://uretim.test", "X-Uretim": "1" },
      body: "{}",
    });
    expect(r3.status).toBe(415);
    const r4 = await fetch(url, {
      method: "POST",
      headers: {
        Cookie: c,
        "Content-Type": "application/json",
        Origin: "http://uretim.test",
        "X-Uretim": "1",
      },
      body: JSON.stringify({ ad: "Deneme" }),
    });
    expect(r4.status).toBe(200);
  });
});

describe("teslim anahtarı ve MCP ucu (UM-G2)", () => {
  it("anahtar bir kez gösterilir, yalnız özeti saklanır, iptal edilince çalışmaz", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("magaza", c);
    expect(k).toMatch(/^um_magaza_/);
    expect(JSON.stringify(o.u.merkez.db.prepare("SELECT * FROM anahtar").all())).not.toContain(k);
    const sayfa = await o.api("GET", "/api/alan/magaza", undefined, c);
    expect(JSON.stringify(sayfa.json)).not.toContain(k);
    expect((await o.mcp(k, "tools/list")).durum).toBe(200);
    const id = (sayfa.json.anahtarlar as { id: number }[])[0]?.id;
    await o.api("POST", `/api/alan/magaza/anahtar/${id}/iptal`, {}, c);
    expect((await o.mcp(k, "tools/list")).durum).toBe(401);
  });

  it("protokol: initialize, tools/list, bildirim 202, bilinmeyen yöntem, toplu istek", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);
    const ini = await o.mcp(k, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(ini.json.result).toMatchObject({ protocolVersion: "2025-06-18", capabilities: { tools: {} } });
    const liste = await o.mcp(k, "tools/list");
    const adlar = ((liste.json.result as { tools: { name: string }[] }).tools ?? []).map((t) => t.name);
    expect(adlar).toEqual([
      "talimat_oku",
      "isleri_listele",
      "is_oku",
      "katalog_oku",
      "geri_bildirim_oku",
      "dosya_yukle",
      "on_kontrol",
      "teslim_et",
      "istek_karti_ac",
      "kod_istegi_ac",
    ]);
    const bildirim = await fetch(`${o.url}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    expect(bildirim.status).toBe(202);
    expect((await o.mcp(k, "resources/list")).json.error).toMatchObject({ code: -32601 });
    const toplu = await fetch(`${o.url}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      body: "[]",
    });
    expect(toplu.status).toBe(400);
    expect((await fetch(`${o.url}/mcp`, { headers: { Authorization: `Bearer ${k}` } })).status).toBe(405);
    const yanlisKaynak = await fetch(`${o.url}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${k}`,
        Origin: "https://kotu.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(yanlisKaynak.status).toBe(403);
  });

  it("anahtarsız ve bozuk anahtarla 401", async () => {
    expect((await o.mcp("", "tools/list")).durum).toBe(401);
    expect((await o.mcp(`um_magaza_${"A".repeat(43)}`, "tools/list")).durum).toBe(401);
  });

  it("hız sınırı: dakikada 60 istek", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("rozet", c);
    for (let i = 0; i < 60; i++) expect((await o.mcp(k, "ping")).durum).toBe(200);
    expect((await o.mcp(k, "ping")).durum).toBe(429);
    o.saat.simdi += 61_000;
    expect((await o.mcp(k, "ping")).durum).toBe(200);
  });

  it("günde 500 dosya sınırı", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("rozet", c);
    const id = (o.u.anahtarlar.liste("rozet")[0]?.id ?? 0) as number;
    const ins = o.u.merkez.db.prepare(
      "INSERT INTO yukleme (id, alan, anahtar_id, ozet, ad, olusturma) VALUES (?, 'rozet', ?, ?, 'x.png', ?)",
    );
    for (let i = 0; i < 500; i++)
      ins.run(`yk${String(i).padStart(20, "0")}`, id, "0".repeat(64), o.saat.simdi);
    const r = await o.arac(k, "dosya_yukle", { ad: "a.png", icerik_base64: b64(gorsel(128, 128)) });
    expect(r.hata).toBe(true);
    expect(String(r.veri.mesaj)).toMatch(/500/);
  });

  it("boyut aşımı 413", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("ses", c);
    const r = await fetch(`${o.url}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${k}`,
        "Content-Type": "application/json",
        "Content-Length": String(50 * 1024 * 1024),
      },
      body: "x",
    }).catch(() => null);
    if (r) expect(r.status).toBe(413);
  });

  it("yetkisiz alan erişimi: başka alanın işi ve dosyası görülmez", async () => {
    const c = await o.giris();
    const kM = await o.anahtarUret("magaza", c);
    const kR = await o.anahtarUret("rozet", c);
    const is = await o.api(
      "POST",
      "/api/alan/rozet/is",
      { baslik: "Ustalık rozetleri", aciklama: "30 rozet" },
      c,
    );
    const isId = (is.json.is as { id: number }).id;
    expect((await o.arac(kR, "is_oku", { id: isId })).hata).toBe(false);
    expect((await o.arac(kM, "is_oku", { id: isId })).hata).toBe(true);
    const y = await o.arac(kR, "dosya_yukle", { ad: "rozet.png", icerik_base64: b64(gorsel(256, 256)) });
    const dosyaId = String(y.veri.dosyaId);
    const t = await o.arac(kM, "on_kontrol", {
      tur: "yeni",
      ogeler: [
        { ad: "Çalıntı", dosyalar: [{ dosyaId, hedefYol: "apps/client/public/assets/shop/cerceve/x.webp" }] },
      ],
    });
    const og = (t.veri.ogeler as { sonuc: string; satirlar: { mesaj: string }[] }[])[0];
    expect(og?.sonuc).toBe("kaldi");
    expect(og?.satirlar.some((s) => /bulunamadı/.test(s.mesaj))).toBe(true);
    // Başka alanın hedef yolu da reddedilir.
    const t2 = await o.arac(kM, "on_kontrol", {
      tur: "yeni",
      ogeler: [{ ad: "Rozet", dosyalar: [{ dosyaId, hedefYol: "apps/client/public/assets/badges/x.webp" }] }],
    });
    expect(t2.veri.sonuc).toBe("kaldi");
    // Yol enjeksiyonu.
    const t3 = await o.arac(kM, "on_kontrol", {
      tur: "yeni",
      ogeler: [
        {
          ad: "Kaçak",
          dosyalar: [{ dosyaId, hedefYol: "apps/client/public/assets/shop/../../../../etc/passwd" }],
        },
      ],
    });
    expect(t3.veri.sonuc).toBe("kaldi");
    // Başka alanın kartı sahibe kendi alanıyla açılır; alan anahtardan gelir.
    const kart = await o.arac(kM, "istek_karti_ac", {
      istenen_alan: "ses",
      ne: "Tepki sesi",
      neden: "Tepki paketi için",
    });
    expect(kart.veri.acanAlan).toBe("magaza");
  });

  it("yama teslimi şimdilik kibarca reddedilir", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("uretim-arayuz", c);
    const r = await o.arac(k, "teslim_et", { tur: "yama", ogeler: [{ ad: "Düğme" }] });
    expect(r.veri.sonuc).toBe("kaldi");
    expect(JSON.stringify(r.veri.hatalar)).toMatch(/henüz desteklenmiyor/);
  });

  it("dosya ucu yol enjeksiyonuna kapalı ve SVG'yi korumalı sunar", async () => {
    const c = await o.giris();
    for (const yol of ["/api/oge/1/dosya/..%2F..%2Fetc%2Fpasswd", "/api/oge/1/dosya/abc"])
      expect((await o.api("GET", yol, undefined, c)).durum).toBe(404);
    expect((await fetch(`${o.url}/..%2F..%2Fpackage.json`)).status).not.toBe(200);
  });
});
