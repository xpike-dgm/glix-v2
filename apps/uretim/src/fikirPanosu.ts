/**
 * Fikir panosu ve kabul havuzu (Üretim Merkezi 2, aşama 1) — sunucu tarafı okuma işlevleri.
 * Fikrin aşaması kayıtlardan türetilir (ortak/fikir.ts `fikirAsamasi`): karar, uygulama işi ve uygulayan öğenin
 * durumu değiştikçe kendiliğinden ilerler.
 */
import { json } from "./db.js";
import type { Merkez } from "./merkez.js";
import { IsHatasi } from "./merkez.js";
import type { AlanId } from "./ortak/alanlar.js";
import { type FikirAlanlari, type FikirKarti, fikirAsamasi, type UygulanacakFikir } from "./ortak/fikir.js";
import type { OgeAyrinti, OgeDosyasi } from "./ortak/tipler.js";

interface FikirSatiri {
  id: number;
  alan: string;
  ad: string;
  aciklama: string;
  gerekce: string;
  durum: string;
  fikir: string | null;
  dosyalar: string;
  olusturma: number;
}

export function fikirPanosu(m: Merkez, alan: AlanId | null): FikirKarti[] {
  const satirlar = (alan
    ? m.db
        .prepare(
          "SELECT id, alan, ad, aciklama, gerekce, durum, fikir, dosyalar, olusturma FROM oge WHERE tur = 'fikir' AND alan = ? AND durum NOT IN ('kaldi','arsiv') ORDER BY id DESC LIMIT 500",
        )
        .all(alan)
    : m.db
        .prepare(
          "SELECT id, alan, ad, aciklama, gerekce, durum, fikir, dosyalar, olusturma FROM oge WHERE tur = 'fikir' AND durum NOT IN ('kaldi','arsiv') ORDER BY id DESC LIMIT 500",
        )
        .all()) as unknown as FikirSatiri[];
  const isSorgu = m.db.prepare(
    "SELECT f.is_id AS id FROM is_fikir f JOIN isler i ON i.id = f.is_id WHERE f.fikir_id = ? AND i.durum != 'iptal' ORDER BY f.is_id",
  );
  const uygSorgu = m.db.prepare(
    "SELECT id, durum FROM oge WHERE fikir_id = ? AND durum NOT IN ('kaldi','arsiv') ORDER BY id DESC LIMIT 1",
  );
  const notSorgu = m.db.prepare(
    "SELECT metin FROM notlar WHERE oge_id = ? AND tur = 'yorum' ORDER BY id DESC",
  );
  return satirlar.map((r) => {
    const f = json<FikirAlanlari | null>(r.fikir, null);
    const isler = (isSorgu.all(r.id) as { id: number }[]).map((x) => x.id);
    const u = uygSorgu.get(r.id) as { id: number; durum: string } | undefined;
    const onizleme = json<OgeDosyasi[]>(r.dosyalar, []).find((d) => d.tur === "png")?.ozet ?? null;
    return {
      id: r.id,
      alan: r.alan,
      baslik: r.ad,
      aciklama: r.aciklama,
      gerekce: r.gerekce,
      ...(f ?? {}),
      yapili: f !== null,
      asama: fikirAsamasi(r.durum, isler.length > 0, u?.durum ?? null),
      olusturma: r.olusturma,
      notlar: (notSorgu.all(r.id) as { metin: string }[]).map((n) => n.metin),
      isler,
      uygulamaOge: u?.id ?? null,
      onizleme,
    };
  });
}

/** İş isterken seçilen fikirler: bu alanda ve onaylı olmalı. */
export function secilenFikirler(m: Merkez, alan: AlanId, idler: number[]): UygulanacakFikir[] {
  const out: UygulanacakFikir[] = [];
  for (const id of [...new Set(idler)]) {
    const r = m.db
      .prepare("SELECT id, alan, ad, aciklama, durum, fikir, tur FROM oge WHERE id = ?")
      .get(id) as
      | {
          id: number;
          alan: string;
          ad: string;
          aciklama: string;
          durum: string;
          fikir: string | null;
          tur: string;
        }
      | undefined;
    if (!r || r.alan !== alan || r.tur !== "fikir" || r.durum !== "onaylandi")
      throw new IsHatasi(400, `Fikir #${id} bu alanda onaylı bir fikir değil.`);
    const f = json<FikirAlanlari | null>(r.fikir, null);
    const not = (
      m.db.prepare("SELECT metin FROM notlar WHERE oge_id = ? AND tur = 'yorum' ORDER BY id").all(id) as {
        metin: string;
      }[]
    )
      .map((n) => n.metin)
      .join(" · ");
    out.push({
      fikirId: r.id,
      baslik: r.ad,
      ozet: f?.ozet ?? r.aciklama.slice(0, 300),
      kategori: f?.kategori ?? "",
      etki: f?.etki ?? "",
      zahmet: f?.zahmet ?? "",
      not: not.slice(0, 600),
    });
  }
  return out;
}

/** Kabul havuzunun basamakları: kabulde → yöneticide → ana kodda → test'te → canlıda. */
export const KABUL_BASAMAKLARI = ["kabulde", "yoneticide", "ana_kodda", "testte", "canlida"] as const;
export type KabulBasamagi = (typeof KABUL_BASAMAKLARI)[number];

const BASAMAK_KOSULU: Record<KabulBasamagi, string> = {
  kabulde: "o.durum = 'havuzda'",
  yoneticide: "o.durum = 'pakette'",
  ana_kodda: "o.durum = 'oyuna_eklendi' AND COALESCE(p.durum, '') != 'testte'",
  testte: "o.durum = 'oyuna_eklendi' AND p.durum = 'testte'",
  canlida: "o.durum = 'canlida'",
};

export interface KabulHavuzu {
  /** Basamak → öğeler (en son güncellenen üstte; basamak başına en son 50). */
  basamaklar: Record<KabulBasamagi, OgeAyrinti[]>;
  sayilar: Record<KabulBasamagi, number>;
  /** Kabuldekilerden yöneticiye gidecek olanların sayısı. */
  paketlenecek: number;
  /** Tek tıkla oyuna aktarılabilen kabuldeki öğeler (içerik havuzu, moderasyon). */
  tekTikIdler: number[];
}

export function kabulHavuzu(m: Merkez): KabulHavuzu {
  const basamaklar = {} as KabulHavuzu["basamaklar"];
  const sayilar = {} as KabulHavuzu["sayilar"];
  for (const b of KABUL_BASAMAKLARI) {
    const kosul = `${BASAMAK_KOSULU[b]} AND o.tur NOT IN ('fikir','rapor')`;
    sayilar[b] = Number(
      (
        m.db
          .prepare(`SELECT COUNT(*) AS n FROM oge o LEFT JOIN paket p ON p.id = o.paket_id WHERE ${kosul}`)
          .get() as {
          n: number;
        }
      ).n,
    );
    basamaklar[b] = (
      m.db
        .prepare(
          `SELECT o.id FROM oge o LEFT JOIN paket p ON p.id = o.paket_id WHERE ${kosul} ORDER BY o.guncelleme DESC LIMIT 50`,
        )
        .all() as { id: number }[]
    )
      .map((x) => m.oge(x.id))
      .filter((x): x is OgeAyrinti => x !== null);
  }
  const tekTikIdler = basamaklar.kabulde.filter((o) => m.tekTikMi(o)).map((o) => o.id);
  const disarida = basamaklar.kabulde.filter((o) => !m.paketeGirer(o)).length;
  return { basamaklar, sayilar, paketlenecek: sayilar.kabulde - disarida, tekTikIdler };
}
