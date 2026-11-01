/**
 * Entegrasyon paketi (UM-İ7, sözleşme bölüm 5): onaylananlar `<aktarim>/<YYYYMMDD-HHMM>/` altına, oyunun deposundaki
 * yollarla birebir aynı düzende yazılır. Görsel → WebP (kalite 82, alfa < 24 → 0); ses → OGG Opus tek kanal,
 * -16 LUFS (efekt) / -20 LUFS (müzik); SVG temizlenmiş. Katalog değişiklikleri `<katalog>.json.yama` olarak gelir.
 * Paket önce geçici klasöre yazılır, bitince tek adımda yerine taşınır (yarım paket kalmaz).
 */
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { islem, json } from "./db.js";
import { DUSUK_ALFA } from "./kontrol/gorsel.js";
import { ffmpegVar, opusYaz, sesSuresiSiniri, webpYaz } from "./medya.js";
import { IsHatasi, type Merkez } from "./merkez.js";
import { type AlanId, alanTanimi, isAlanId } from "./ortak/alanlar.js";
import type { Degisiklik, OgeDosyasi, PaketKaydi, TeslimTuru } from "./ortak/tipler.js";
import { pngAc } from "./png.js";
import { svgTemizle } from "./svg.js";

const KATALOG_YAMASI: Partial<Record<AlanId, string>> = {
  magaza: "packages/engine/src/katalog/magaza.json.yama",
  rozet: "packages/engine/src/katalog/rozetler.json.yama",
  kartlar: "packages/engine/src/katalog/kartlar.json.yama",
  ikon: "packages/engine/src/katalog/ikonlar.json.yama",
  efekt: "packages/engine/src/katalog/efektler.json.yama",
  ses: "packages/engine/src/katalog/sesler.json.yama",
  muzik: "packages/engine/src/katalog/muzik.json.yama",
};

export interface Yama {
  ekle: unknown[];
  degistir: { id: string | null; eski: Record<string, unknown>; yeni: Record<string, unknown> }[];
  satistanKaldir: string[];
}

export function klasorAdi(now: number, saatDilimi: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: saatDilimi,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(now))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}`;
}

/** Paket içindeki güvenli yol: yalnız `kok` altında. */
export function paketYolu(kok: string, hedefYol: string): string {
  if (!/^[a-z0-9][a-z0-9._/-]*$/.test(hedefYol) || hedefYol.includes(".."))
    throw new Error("hedef yol geçersiz");
  const p = resolve(kok, hedefYol);
  if (!p.startsWith(resolve(kok) + sep)) throw new Error("hedef yol dışarı taşıyor");
  return p;
}

interface OgeSatiriPaket {
  id: number;
  teslim_id: number;
  alan: string;
  tur: string;
  ad: string;
  dosyalar: string;
  satirlar: string;
  degisiklikler: string;
  kaldirilacaklar: string;
  onayli_satirlar: string | null;
}

export async function paketOlustur(
  m: Merkez,
  aktarimDir: string,
  saatDilimi: string,
  kim: string,
  now: number,
): Promise<PaketKaydi> {
  const adaylar = (
    m.db
      .prepare(
        "SELECT id, teslim_id, alan, tur, ad, dosyalar, satirlar, degisiklikler, kaldirilacaklar, onayli_satirlar FROM oge WHERE durum = 'havuzda' ORDER BY alan, id",
      )
      .all() as unknown as OgeSatiriPaket[]
  ).filter(
    (o) =>
      isAlanId(o.alan) &&
      m.paketeGirer({
        alan: o.alan,
        dosyalar: json<unknown[]>(o.dosyalar, []),
        satirlar: json<unknown[]>(o.satirlar, []),
      }),
  );
  if (!adaylar.length) throw new IsHatasi(409, "Pakete alınacak onaylanmış öğe yok.");
  const dosyaVar = adaylar.some((o) =>
    json<OgeDosyasi[]>(o.dosyalar, []).some((d) => d.tur === "png" || d.tur === "wav" || d.tur === "ogg"),
  );
  if (dosyaVar && !(await ffmpegVar()))
    throw new IsHatasi(503, "Görsel ve ses dönüştürme aracı kurulu değil; paket hazırlanamadı.");

  await mkdir(aktarimDir, { recursive: true });
  let ad = klasorAdi(now, saatDilimi);
  const mevcut = new Set(await readdir(aktarimDir));
  for (let i = 2; mevcut.has(ad); i++) ad = `${klasorAdi(now, saatDilimi)}-${i}`;
  const gecici = join(aktarimDir, `.${ad}.gecici`);
  const dosyalarKok = join(gecici, "dosyalar");
  await rm(gecici, { recursive: true, force: true });
  await mkdir(dosyalarKok, { recursive: true });
  const yamalar = new Map<string, Yama>();
  const ozetOgeler: unknown[] = [];
  /** İçerik havuzu satırları (havuz -> ekle/kapat); paketin kökünde `icerik.json`. */
  const icerik = new Map<string, { ekle: Record<string, string>[]; kapat: string[] }>();
  try {
    for (const o of adaylar) {
      const alan = o.alan as AlanId;
      const hedefYollar: string[] = [];
      for (const d of json<OgeDosyasi[]>(o.dosyalar, [])) {
        if (!d.hedefYol) continue;
        const veri = await m.depo.oku(d.ozet);
        let cikti: Buffer;
        if (d.tur === "png") {
          const img = pngAc(veri);
          for (let i = 3; i < img.data.length; i += 4) if ((img.data[i] ?? 0) < DUSUK_ALFA) img.data[i] = 0;
          cikti = await webpYaz(img, 82);
        } else if (d.tur === "wav" || d.tur === "ogg")
          cikti = await opusYaz(veri, d.tur, alan === "muzik" ? -20 : -16, sesSuresiSiniri(alan));
        else if (d.tur === "svg") cikti = Buffer.from(svgTemizle(veri.toString("utf8")).temiz, "utf8");
        else cikti = veri;
        const yol = paketYolu(dosyalarKok, d.hedefYol);
        await mkdir(dirname(yol), { recursive: true });
        await writeFile(yol, cikti);
        hedefYollar.push(d.hedefYol);
      }
      const tum = json<unknown[]>(o.satirlar, []);
      const secili = json<number[] | null>(o.onayli_satirlar, null);
      const satirlar = secili ? tum.filter((_, i) => secili.includes(i)) : tum;
      const yamaYolu = KATALOG_YAMASI[alan];
      if (yamaYolu) {
        const y = yamalar.get(yamaYolu) ?? { ekle: [], degistir: [], satistanKaldir: [] };
        const tur = o.tur as TeslimTuru;
        if (tur === "yeni") y.ekle.push(...satirlar);
        for (const d of json<Degisiklik[]>(o.degisiklikler, [])) y.degistir.push(d);
        if (tur === "kaldirma-onerisi") y.satistanKaldir.push(...json<string[]>(o.kaldirilacaklar, []));
        if (y.ekle.length || y.degistir.length || y.satistanKaldir.length) {
          yamalar.set(yamaYolu, y);
          if (!hedefYollar.includes(yamaYolu)) hedefYollar.push(yamaYolu);
        }
      }
      const havuzSatirlari: Record<string, unknown[]> = {};
      if (alan === "icerik")
        for (const s of satirlar) {
          if (!s || typeof s !== "object") continue;
          const r = s as { havuz?: unknown; alanlar?: unknown; anahtar?: unknown };
          if (typeof r.havuz !== "string") continue;
          const h = icerik.get(r.havuz) ?? { ekle: [], kapat: [] };
          if (o.tur === "kaldirma-onerisi") {
            if (typeof r.anahtar === "string") h.kapat.push(r.anahtar);
          } else if (r.alanlar && typeof r.alanlar === "object")
            h.ekle.push(r.alanlar as Record<string, string>);
          icerik.set(r.havuz, h);
          havuzSatirlari[r.havuz] = [...(havuzSatirlari[r.havuz] ?? []), s];
        }
      ozetOgeler.push({
        alan,
        alanAdi: alanTanimi(alan).ad,
        teslimId: o.teslim_id,
        ogeId: o.id,
        tur: o.tur,
        ad: o.ad,
        hedefYollar,
        katalogSatirlari: satirlar,
        ...(alan === "icerik" ? { havuzSatirlari } : {}),
      });
    }
    for (const [yol, y] of yamalar) {
      const p = paketYolu(dosyalarKok, yol);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, `${JSON.stringify(y, null, 2)}\n`);
    }
    if (icerik.size > 0)
      await writeFile(
        join(gecici, "icerik.json"),
        `${JSON.stringify(
          { havuzlar: [...icerik].map(([havuz, h]) => ({ havuz, ekle: h.ekle, kapat: h.kapat })) },
          null,
          2,
        )}\n`,
      );
    await writeFile(
      join(gecici, "ozet.json"),
      `${JSON.stringify({ olusturma: new Date(now).toISOString(), ogeler: ozetOgeler }, null, 2)}\n`,
    );
    await rename(gecici, join(aktarimDir, ad));
  } catch (err) {
    await rm(gecici, { recursive: true, force: true });
    if (err instanceof IsHatasi) throw err;
    throw new IsHatasi(
      500,
      "Paket hazırlanırken bir dosya dönüştürülemedi; ayrıntı için öğeleri tek tek kontrol et.",
    );
  }
  const id = islem(m.db, () => {
    const pid = Number(
      m.db
        .prepare(
          "INSERT INTO paket (klasor, olusturma, oge_sayisi, revizyon, durum) VALUES (?, ?, ?, NULL, 'hazir')",
        )
        .run(ad, now, adaylar.length).lastInsertRowid,
    );
    for (const o of adaylar)
      m.db
        .prepare("UPDATE oge SET durum = 'pakette', paket_id = ?, guncelleme = ? WHERE id = ?")
        .run(pid, now, o.id);
    return pid;
  });
  m.denetim.yaz(now, kim, "paket", ad, `${adaylar.length} öğe`);
  return { id, klasor: ad, olusturma: now, ogeSayisi: adaylar.length, revizyon: null, durum: "hazir" };
}

export function paketler(m: Merkez): PaketKaydi[] {
  return (
    m.db.prepare("SELECT * FROM paket ORDER BY id DESC LIMIT 100").all() as Record<string, unknown>[]
  ).map((r) => ({
    id: Number(r.id),
    klasor: String(r.klasor),
    olusturma: Number(r.olusturma),
    ogeSayisi: Number(r.oge_sayisi),
    revizyon: r.revizyon === null ? null : String(r.revizyon),
    durum: r.durum as PaketKaydi["durum"],
  }));
}

/** Yönetici paketi koda ekleyince: hangi revizyonda (UM-İ1 "oyuna eklendi"). */
export function paketOyunaEklendi(m: Merkez, id: number, revizyon: string, kim: string, now: number): void {
  if (!/^[0-9a-f]{7,40}$/i.test(revizyon)) throw new IsHatasi(400, "Sürüm kimliği 7–40 haneli olmalı.");
  const p = m.db.prepare("SELECT durum FROM paket WHERE id = ?").get(id) as { durum: string } | undefined;
  if (!p) throw new IsHatasi(404, "Paket bulunamadı.");
  if (p.durum !== "hazir") throw new IsHatasi(409, "Bu paket zaten işaretlenmiş.");
  islem(m.db, () => {
    m.db
      .prepare("UPDATE paket SET durum = 'oyuna_eklendi', revizyon = ? WHERE id = ?")
      .run(revizyon.toLowerCase(), id);
    m.db
      .prepare(
        "UPDATE oge SET durum = 'oyuna_eklendi', guncelleme = ? WHERE paket_id = ? AND durum = 'pakette'",
      )
      .run(now, id);
  });
  m.denetim.yaz(now, kim, "paket_oyuna_eklendi", String(id), revizyon);
}

/** Ana koda eklenen paket test ortamına çıktı (kabul havuzunda "test'te"; öğeler "ana kodda" kalır). */
export function paketTesteCikti(m: Merkez, id: number, kim: string, now: number): void {
  const p = m.db.prepare("SELECT durum FROM paket WHERE id = ?").get(id) as { durum: string } | undefined;
  if (!p) throw new IsHatasi(404, "Paket bulunamadı.");
  if (p.durum !== "oyuna_eklendi") throw new IsHatasi(409, "Paket önce ana koda eklenmiş olmalı.");
  m.db.prepare("UPDATE paket SET durum = 'testte' WHERE id = ?").run(id);
  m.denetim.yaz(now, kim, "paket_oyuna_eklendi", String(id), "test ortamına çıktı");
}

/** Canlıdaki sürüm paketin revizyonunu içeriyorsa öğeler "canlıda" olur. İşaretlenen paket sayısı. */
export async function canliKontrol(m: Merkez, now: number): Promise<number> {
  if (!m.oyun.acik) return 0;
  const bekleyen = paketler(m).filter(
    (p) => (p.durum === "oyuna_eklendi" || p.durum === "testte") && p.revizyon,
  );
  if (!bekleyen.length) return 0;
  let canli: string | null;
  try {
    canli = (await m.oyun.saglik()).revision;
  } catch {
    return 0;
  }
  if (!canli) return 0;
  let n = 0;
  for (const p of bekleyen) {
    if (!p.revizyon || !(await m.katalog.ayna.iceriyor(p.revizyon, canli))) continue;
    islem(m.db, () => {
      m.db.prepare("UPDATE paket SET durum = 'canlida' WHERE id = ?").run(p.id);
      m.db
        .prepare(
          "UPDATE oge SET durum = 'canlida', guncelleme = ? WHERE paket_id = ? AND durum = 'oyuna_eklendi'",
        )
        .run(now, p.id);
    });
    n += 1;
  }
  return n;
}
