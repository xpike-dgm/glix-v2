/**
 * Alan özel kontroller (UM-K5): takılabilir modüller. Her modül bir alana bağlanır ve satır üretir. Oyun motorunun
 * henüz eklemediği doğrulayıcılar (sözleşme bölüm 1: `validateShopItem`, `SHOP_PRICE_RANGES`, `validateEffectRecipe`,
 * `validateDance`, `validateWardrobeLayer`…) adla aranır: yoksa satır "henüz yok" diye atlanır, motor ekleyince hiçbir
 * değişiklik gerekmeden çalışır.
 */
import * as motor from "@glix/engine";
import { CARD_RARITIES, COSMETIC_TYPES, GAMES } from "@glix/engine";
import { kayit } from "../http.js";
import type { AlanId } from "../ortak/alanlar.js";
import { svgTemizle } from "../svg.js";
import { type KontrolBaglami, type Satir, satir } from "./baglam.js";

export interface AlanModulu {
  alan: AlanId;
  ad: string;
  calistir(b: KontrolBaglami): Satir[] | Promise<Satir[]>;
}

type Dogrulayici = (...args: unknown[]) => unknown;

/** Motorun dışa aktardığı bir işlev ya da değer (yoksa null). Testler sahte motor verebilir. */
export type MotorKaynagi = Readonly<Record<string, unknown>>;
let motorKaynagi: MotorKaynagi = motor as unknown as MotorKaynagi;
export function motorKaynaginiDegistir(k: MotorKaynagi | null): void {
  motorKaynagi = k ?? (motor as unknown as MotorKaynagi);
}
export const motorIslevi = (ad: string): Dogrulayici | null => {
  const f = motorKaynagi[ad];
  return typeof f === "function" ? (f as Dogrulayici) : null;
};
const motorDegeri = (ad: string): unknown => motorKaynagi[ad];

/** `{ok, errors[]}` biçimli doğrulayıcı sonucunu satırlara çevirir. */
function sonucuOku(r: unknown, kod: string, ek: { satir?: number; dosya?: string }, adi: string): Satir[] {
  if (r === true) return [satir("alan", kod, "gecti", `${adi} geçerli.`, ek)];
  if (kayit(r) && typeof r.ok === "boolean") {
    if (r.ok) return [satir("alan", kod, "gecti", `${adi} geçerli.`, ek)];
    const hatalar = Array.isArray(r.errors) ? r.errors.filter((e): e is string => typeof e === "string") : [];
    return [satir("alan", kod, "kaldi", `${adi}: ${hatalar.slice(0, 3).join("; ") || "geçersiz"}.`, ek)];
  }
  return [satir("alan", kod, "uyari", `${adi} denetlenemedi (beklenmeyen sonuç).`, ek)];
}

function guvenliCagir(
  f: Dogrulayici,
  args: unknown[],
  kod: string,
  ek: { satir?: number; dosya?: string },
  adi: string,
): Satir[] {
  try {
    return sonucuOku(f(...args), kod, ek, adi);
  } catch {
    return [satir("alan", kod, "kaldi", `${adi} doğrulanamadı.`, ek)];
  }
}

const henuzYok = (kod: string, ne: string): Satir =>
  satir(
    "alan",
    kod,
    "atlandi",
    `${ne} denetimi henüz yok (oyun tarafına eklenince kendiliğinden çalışacak).`,
  );

const NADIRLIK = ["siradan", "nadir", "efsanevi"];

function fiyatAraligi(nadirlik: string): [number, number] | null {
  const r = motorDegeri("SHOP_PRICE_RANGES");
  if (!kayit(r)) return null;
  const a = r[nadirlik];
  return Array.isArray(a) && typeof a[0] === "number" && typeof a[1] === "number" ? [a[0], a[1]] : null;
}

const magaza: AlanModulu = {
  alan: "magaza",
  ad: "Mağaza kuralları",
  calistir(b) {
    const s: Satir[] = [];
    const { urunler } = b.katalog.magazaUrunleri();
    const adlar = new Set(
      urunler.map((u) => (typeof u.name === "string" ? u.name.toLocaleLowerCase("tr-TR") : "")),
    );
    const idler = new Set(urunler.map((u) => (typeof u.id === "string" ? u.id : "")));
    const katalog = { surum: 1, urunler };
    const tekUrun = motorIslevi("validateShopItem");
    const fiyatVar = motorDegeri("SHOP_PRICE_RANGES") !== undefined;
    b.oge.satirlar.forEach((ham, i) => {
      const e = { satir: i };
      if (!kayit(ham)) {
        s.push(satir("alan", "urun", "kaldi", "Ürün satırı nesne olmalı.", e));
        return;
      }
      const ad = typeof ham.name === "string" ? ham.name : "";
      const aciklama = typeof ham.description === "string" ? ham.description : "";
      if (!ad || [...ad].length > 24)
        s.push(satir("alan", "urun-ad", "kaldi", "Ürün adı 1–24 karakter olmalı.", e));
      if ([...aciklama].length > 90)
        s.push(satir("alan", "urun-aciklama", "kaldi", "Açıklama en çok 90 karakter.", e));
      if (b.tur === "yeni" && adlar.has(ad.toLocaleLowerCase("tr-TR")))
        s.push(satir("alan", "urun-ad", "kaldi", "Bu adla bir ürün zaten var.", e));
      if (b.tur === "yeni" && typeof ham.id === "string" && idler.has(ham.id))
        s.push(satir("alan", "urun-id", "kaldi", "Bu kimlikle bir ürün zaten var.", e));
      if (typeof ham.type !== "string" || !COSMETIC_TYPES.some((t) => t.id === ham.type))
        s.push(satir("alan", "urun-tur", "kaldi", "Ürün türü geçersiz.", e));
      const nadir = typeof ham.rarity === "string" ? ham.rarity : "";
      if (!NADIRLIK.includes(nadir))
        s.push(satir("alan", "nadirlik", "kaldi", "Nadirlik sıradan, nadir ya da efsanevi olmalı.", e));
      else if (fiyatVar) {
        const r = fiyatAraligi(nadir);
        const p = ham.price;
        if (!r) s.push(satir("alan", "fiyat", "uyari", "Fiyat aralığı okunamadı.", e));
        else if (typeof p !== "number" || !Number.isInteger(p) || p < r[0] || p > r[1])
          s.push(satir("alan", "fiyat", "kaldi", `Fiyat ${r[0]}–${r[1]} Glix aralığında olmalı.`, e));
      }
      if (tekUrun) s.push(...guvenliCagir(tekUrun, [ham, katalog], "urun", e, "Ürün satırı"));
      const tarif = motorIslevi("validateEffectRecipe");
      if (ham.efekt !== undefined) {
        if (tarif) s.push(...guvenliCagir(tarif, [ham.efekt], "efekt-tarifi", e, "Efekt tarifi"));
        else s.push(henuzYok("efekt-tarifi", "Efekt tarifi"));
      }
    });
    if (b.oge.satirlar.length && !fiyatVar) s.push(henuzYok("fiyat", "Fiyat aralığı"));
    if (b.oge.satirlar.length && !tekUrun) s.push(henuzYok("urun", "Ürün satırı (oyunun kendi kuralı)"));
    // Kare sayıları: zafer 4, tepki 6; giriş zemin + ışık.
    const gruplar = new Map<string, Set<string>>();
    for (const d of b.dosyalar) {
      const m = /assets\/shop\/(zafer|tepki|giris)\/([a-z0-9-]+?)-(\d+|zemin|isik)\.webp$/.exec(
        d.hedefYol ?? "",
      );
      if (!m?.[1] || !m[2] || !m[3]) continue;
      const k = `${m[1]}/${m[2]}`;
      const g = gruplar.get(k) ?? new Set<string>();
      g.add(m[3]);
      gruplar.set(k, g);
    }
    for (const [k, parcalar] of gruplar) {
      const [tur, ad] = k.split("/");
      const beklenen =
        tur === "zafer"
          ? ["1", "2", "3", "4"]
          : tur === "tepki"
            ? ["1", "2", "3", "4", "5", "6"]
            : ["zemin", "isik"];
      const eksik = beklenen.filter((x) => !parcalar.has(x));
      const fazla = [...parcalar].filter((x) => !beklenen.includes(x));
      if (eksik.length || fazla.length)
        s.push(
          satir(
            "alan",
            "kare-sayisi",
            "kaldi",
            `${ad}: ${tur === "giris" ? "zemin ve ışık katmanı" : `${beklenen.length} kare`} gerekli${eksik.length ? `; eksik: ${eksik.join(", ")}` : ""}${fazla.length ? `; fazla: ${fazla.join(", ")}` : ""}.`,
          ),
        );
      else s.push(satir("alan", "kare-sayisi", "gecti", `${ad}: kare sayısı doğru.`));
    }
    for (const d of b.dosyalar) {
      if (d.tur !== "json" || !d.hedefYol) continue;
      const ek = { dosya: d.ad };
      let j: unknown;
      try {
        j = JSON.parse(d.veri.toString("utf8"));
      } catch {
        s.push(satir("alan", "json", "kaldi", "JSON okunamadı.", ek));
        continue;
      }
      if (d.hedefYol.includes("/karakter/dans/")) {
        const f = motorIslevi("validateDance");
        s.push(
          ...(f
            ? guvenliCagir(f, [j, motorDegeri("RIG") ?? null], "dans", ek, "Dans")
            : [henuzYok("dans", "Dans iskelet uyumu")]),
        );
      } else if (d.hedefYol.includes("/karakter/")) {
        const f = motorIslevi("validateWardrobeLayer");
        s.push(
          ...(f
            ? guvenliCagir(f, [j, motorDegeri("RIG") ?? null], "giysi", ek, "Giysi katmanı")
            : [henuzYok("giysi", "Giysi katmanı")]),
        );
      }
    }
    return s;
  },
};

const rozet: AlanModulu = {
  alan: "rozet",
  ad: "Rozet kuralları",
  calistir(b) {
    const s: Satir[] = [];
    const olaylar = motorDegeri("BADGE_EVENTS");
    b.oge.satirlar.forEach((ham, i) => {
      const e = { satir: i };
      if (!kayit(ham)) {
        s.push(satir("alan", "rozet", "kaldi", "Rozet satırı nesne olmalı.", e));
        return;
      }
      if (typeof ham.esik !== "number" || !Number.isInteger(ham.esik) || ham.esik < 1)
        s.push(satir("alan", "esik", "kaldi", "Eşik pozitif tam sayı olmalı.", e));
      if (Array.isArray(olaylar)) {
        if (!olaylar.includes(ham.kosul))
          s.push(satir("alan", "kosul", "kaldi", "Koşul ölçülebilir olaylar listesinde yok.", e));
      }
    });
    if (b.oge.satirlar.length && !Array.isArray(olaylar))
      s.push(henuzYok("kosul", "Rozet koşulu (olay listesi)"));
    return s;
  },
};

const kartlar: AlanModulu = {
  alan: "kartlar",
  ad: "Kart kuralları",
  calistir(b) {
    const s: Satir[] = [];
    const etkiler = motorDegeri("CARD_IDS");
    b.oge.satirlar.forEach((ham, i) => {
      const e = { satir: i };
      if (!kayit(ham)) {
        s.push(satir("alan", "kart", "kaldi", "Kart satırı nesne olmalı.", e));
        return;
      }
      const m = typeof ham.metin === "string" ? ham.metin : typeof ham.text === "string" ? ham.text : "";
      if (!m || [...m].length > 90)
        s.push(satir("alan", "kart-metni", "kaldi", "Kart metni 1–90 karakter olmalı.", e));
      if (ham.nadirlik !== undefined && !(CARD_RARITIES as readonly unknown[]).includes(ham.nadirlik))
        s.push(satir("alan", "nadirlik", "kaldi", "Kart nadirliği geçersiz.", e));
      if (ham.etki !== undefined && Array.isArray(etkiler) && !etkiler.includes(ham.etki))
        s.push(
          satir(
            "alan",
            "etki",
            "kaldi",
            "Etki var olan kart etkilerinden biri olmalı; yeni etki kod isteğidir.",
            e,
          ),
        );
    });
    return s;
  },
};

const ikon: AlanModulu = {
  alan: "ikon",
  ad: "İkon kuralları",
  calistir(b) {
    const s: Satir[] = [];
    for (const d of b.dosyalar) {
      if (d.tur !== "svg") continue;
      const e = { dosya: d.ad };
      if (d.veri.length > 8 * 1024)
        s.push(satir("alan", "ikon-boyut", "kaldi", "İkon dosyası en çok 8 KB olabilir.", e));
      try {
        const r = svgTemizle(d.veri.toString("utf8"));
        const vb = r.viewBox;
        if (!vb) s.push(satir("alan", "viewbox", "kaldi", "SVG görüntü kutusu (viewBox) yok.", e));
        else if (Math.abs(vb[2] - vb[3]) > 1e-6)
          s.push(satir("alan", "viewbox", "kaldi", "Görüntü kutusu kare olmalı.", e));
        else s.push(satir("alan", "viewbox", "gecti", "Görüntü kutusu kare.", e));
        const renkler = new Set(
          [...d.veri.toString("utf8").matchAll(/(?:fill|stroke)="([^"]+)"/g)]
            .map((m) => (m[1] ?? "").toLowerCase())
            .filter(
              (c) => c !== "none" && c !== "currentcolor" && !c.startsWith("var(") && !c.startsWith("url("),
            ),
        );
        if (renkler.size > 1)
          s.push(
            satir(
              "alan",
              "tek-renk",
              "uyari",
              `Sabit ${renkler.size} renk var; tema rengiyle (currentColor) boyanabilmeli.`,
              e,
            ),
          );
      } catch {
        s.push(satir("alan", "svg", "kaldi", "SVG okunamadı.", e));
      }
    }
    return s;
  },
};

const efekt: AlanModulu = {
  alan: "efekt",
  ad: "Efekt kuralları",
  calistir(b) {
    const s: Satir[] = [];
    b.oge.satirlar.forEach((ham, i) => {
      if (!kayit(ham)) return;
      const n = ham.parcacik;
      if (n !== undefined && (typeof n !== "number" || n < 1 || n > 60))
        s.push(
          satir("alan", "parcacik", "kaldi", "Tek efekt en çok 60 parçacık kullanabilir.", { satir: i }),
        );
    });
    return s;
  },
};

const test: AlanModulu = {
  alan: "test",
  ad: "Senaryo kuralları",
  calistir(b) {
    const s: Satir[] = [];
    const senaryolar: { v: unknown; ek: { satir?: number; dosya?: string } }[] = b.oge.satirlar.map(
      (v, i) => ({ v, ek: { satir: i } }),
    );
    for (const d of b.dosyalar)
      if (d.tur === "json" && d.hedefYol?.startsWith("docs/qa/senaryolar/")) {
        try {
          senaryolar.push({ v: JSON.parse(d.veri.toString("utf8")), ek: { dosya: d.ad } });
        } catch {
          s.push(satir("alan", "senaryo", "kaldi", "Senaryo JSON'u okunamadı.", { dosya: d.ad }));
        }
      }
    for (const { v, ek } of senaryolar) {
      if (!kayit(v) || typeof v.oyun !== "string") {
        s.push(
          satir(
            "alan",
            "senaryo",
            "kaldi",
            "Senaryo { oyun, oyuncu, strateji, beklenen } biçiminde olmalı.",
            ek,
          ),
        );
        continue;
      }
      const g = GAMES[v.oyun];
      if (!g) {
        s.push(satir("alan", "oyun", "kaldi", `"${v.oyun.slice(0, 40)}" diye bir oyun yok.`, ek));
        continue;
      }
      const o = v.oyuncu;
      if (typeof o !== "number" || !Number.isInteger(o) || o < g.minPlayers || o > g.maxPlayers)
        s.push(
          satir(
            "alan",
            "oyuncu",
            "kaldi",
            `${g.name}: oyuncu sayısı ${g.minPlayers}–${g.maxPlayers} olmalı.`,
            ek,
          ),
        );
      else s.push(satir("alan", "senaryo", "gecti", `${g.name} senaryosu geçerli.`, ek));
    }
    return s;
  },
};

const wiki: AlanModulu = {
  alan: "moderasyon",
  ad: "Wiki kuralları",
  calistir(b) {
    const s: Satir[] = [];
    for (const d of b.dosyalar) {
      if (d.tur !== "json" || !d.hedefYol?.startsWith("docs/wiki/")) continue;
      const e = { dosya: d.ad };
      let j: unknown;
      try {
        j = JSON.parse(d.veri.toString("utf8"));
      } catch {
        s.push(satir("alan", "wiki", "kaldi", "Wiki JSON'u okunamadı.", e));
        continue;
      }
      if (d.hedefYol.endsWith("/sira.json")) {
        if (!Array.isArray(j) || !j.every((x) => typeof x === "string"))
          s.push(satir("alan", "wiki", "kaldi", "Sıra dosyası oyun kimliklerinin listesi olmalı.", e));
        continue;
      }
      if (!kayit(j) || typeof j.id !== "string" || typeof j.ad !== "string" || typeof j.ozet !== "string") {
        s.push(satir("alan", "wiki", "kaldi", "Wiki sayfasında id, ad ve ozet olmalı.", e));
        continue;
      }
      const ekranlar = Array.isArray(j.ekranlar) ? j.ekranlar : [];
      const gorselsiz = ekranlar.filter(
        (x) => !kayit(x) || typeof x.dosya !== "string" || x.dosya === "",
      ).length;
      if (gorselsiz)
        s.push(satir("alan", "wiki-ekran", "kaldi", `${gorselsiz} ekran girdisinin görseli yok.`, e));
      else s.push(satir("alan", "wiki", "gecti", "Wiki sayfası biçimi uygun.", e));
    }
    return s;
  },
};

/** Kayıtlı modüller. Yeni alan kuralı eklemek: bir `AlanModulu` yaz, buraya ekle. */
export const ALAN_MODULLERI: readonly AlanModulu[] = [magaza, rozet, kartlar, ikon, efekt, test, wiki];

export async function alanKontrolleri(b: KontrolBaglami): Promise<Satir[]> {
  const out: Satir[] = [];
  for (const m of ALAN_MODULLERI) if (m.alan === b.alan.id) out.push(...(await m.calistir(b)));
  return out;
}
