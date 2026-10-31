/**
 * Efekt motorları ve efekt tarifi (MG-4). Yeni bir ad efekti, çerçeve, giriş ya da zafer görünümü kod yazılmadan bir
 * **tarifle** tanımlanır: hazır bir motor + o motorun parametreleri (+ doku dosyaları). İstemci tarifi motorun
 * çizicisiyle çizer (`apps/client/src/ui/effects.ts`); Üretim Merkezi aynı doğrulayıcıyla ön kontrol yapar.
 *
 * Kurallar (performans): tek efekt en çok `EFFECT_MAX_PARTICLES` parçacık; parçacık/kare dokusu en çok
 * `EFFECT_TEXTURE_MAX_PX` piksel. Hareket transform/opacity ile yapılır (ad efektlerinin ışık ve renk akışı hariç: o
 * ikisi bugünkü görünümü birebir korumak için gölge/zemin konumunu oynatır). "Hareket azaltma" açıkken (oyunun ayarı
 * ya da sistemin `prefers-reduced-motion`'ı) her motor sade sürümünü çizer (`sade` açıklaması).
 *
 * Doku yolları `public/assets/shop/` altına görelidir (ör. `cerceve/galaksi.webp`, `efekt/kivilcim-yildiz.webp`).
 */
import type { CosmeticTypeId } from "./cosmeticTypes.js";

export type EffectEngineId =
  | "parlama"
  | "akan-renk"
  | "kivilcim"
  | "donen-halka"
  | "parcacik-yagmuru"
  | "kare-animasyon"
  | "doku-katmani";

/** Katalogdaki tarif: motor ve parametreleri (ham; `parseEffectRecipe` doğrular ve varsayılanları doldurur). */
export interface EffectRecipe {
  motor: EffectEngineId;
  parametreler: Readonly<Record<string, unknown>>;
}

/** Tek efektte en çok parçacık sayısı. */
export const EFFECT_MAX_PARTICLES = 60;
/** Parçacık ve kare dokularının en büyük kenarı (piksel). */
export const EFFECT_TEXTURE_MAX_PX = 256;
/** Ürün görseli olan katman dokuları: çerçeve 384x384 (delik %62), kart arkası 480x720. */
export const EFFECT_FRAME_TEXTURE_PX = 384;
export const EFFECT_CARD_TEXTURE_PX = 720;

interface ParamBase {
  zorunlu: boolean;
  /** Türkçe açıklama (Üretim Merkezi ve talimat belgesi gösterir). */
  aciklama: string;
}

/** Parametre şeması. */
export type EffectParam =
  | (ParamBase & { tur: "renk" })
  | (ParamBase & { tur: "renkler"; min: number; max: number })
  | (ParamBase & { tur: "sayi"; min: number; max: number; tam: boolean; birim: string; varsayilan?: number })
  | (ParamBase & { tur: "secim"; secenekler: readonly string[]; varsayilan: string })
  | (ParamBase & { tur: "mantik"; varsayilan: boolean })
  | (ParamBase & { tur: "doku"; enBuyukPiksel: number })
  | (ParamBase & { tur: "dokular"; min: number; max: number; enBuyukPiksel: number })
  /** Işık katmanları: `[{ renk, yaricap }]` (yarıçap piksel). */
  | (ParamBase & { tur: "isiklar"; min: number; max: number; enBuyukYaricap: number })
  /** Tek ışık: `{ renk, yaricap }`. */
  | (ParamBase & { tur: "isik"; enBuyukYaricap: number })
  /** Renk durakları (yüzde, artan; `renkler` ile aynı sayıda). */
  | (ParamBase & { tur: "duraklar" });

export interface EffectEngine {
  id: EffectEngineId;
  /** Türkçe ad. */
  ad: string;
  /** Bu motorun kullanılabildiği ürün türleri. */
  turler: readonly CosmeticTypeId[];
  parametreler: Readonly<Record<string, EffectParam>>;
  /** Hareket azaltma açıkken ne çizilir. */
  sade: string;
}

const MOTOR_TURLERI: Readonly<Record<EffectEngineId, readonly CosmeticTypeId[]>> = {
  parlama: ["ad-efekti", "cerceve"],
  "akan-renk": ["ad-efekti", "cerceve"],
  kivilcim: ["ad-efekti", "cerceve", "giris"],
  "donen-halka": ["cerceve"],
  "parcacik-yagmuru": ["giris", "zafer"],
  "kare-animasyon": ["zafer", "tepki", "giris"],
  "doku-katmani": ["cerceve", "kart-arkasi"],
};

const cerceveDokusu: EffectParam = {
  tur: "doku",
  zorunlu: false,
  enBuyukPiksel: EFFECT_FRAME_TEXTURE_PX,
  aciklama:
    "Çerçevede zorunlu: çerçeve görseli (384x384, ortada %62 şeffaf delik), örn. cerceve/galaksi.webp. Ad efektinde kullanılmaz.",
};

/** Motorlar ve parametre şemaları. */
export const EFFECT_ENGINES: Readonly<Record<EffectEngineId, EffectEngine>> = {
  parlama: {
    id: "parlama",
    ad: "Parlama",
    turler: MOTOR_TURLERI.parlama,
    sade: "Işık sabit kalır (nabız yok); nabızlı ad efektinde yalnız metin rengi.",
    parametreler: {
      renk: { tur: "renk", zorunlu: false, aciklama: "Ad efektinde zorunlu: metnin rengi." },
      isiklar: {
        tur: "isiklar",
        zorunlu: true,
        min: 1,
        max: 4,
        enBuyukYaricap: 40,
        aciklama: "Işık katmanları (içten dışa): her biri renk ve bulanıklık yarıçapı (px).",
      },
      tepeIsiklar: {
        tur: "isiklar",
        zorunlu: false,
        min: 1,
        max: 4,
        enBuyukYaricap: 40,
        aciklama: "Nabzın tepesindeki ışık katmanları; yoksa nabız ışıkları 1,6 kat büyütür.",
      },
      nabizHizi: {
        tur: "sayi",
        zorunlu: false,
        min: 0,
        max: 10,
        tam: false,
        birim: "sn",
        varsayilan: 0,
        aciklama: "Bir nabzın süresi; 0 sabit ışık.",
      },
      yogunluk: {
        tur: "sayi",
        zorunlu: false,
        min: 0.25,
        max: 2,
        tam: false,
        birim: "kat",
        varsayilan: 1,
        aciklama: "Işık yarıçaplarının çarpanı.",
      },
      doku: cerceveDokusu,
    },
  },
  "akan-renk": {
    id: "akan-renk",
    ad: "Akan renk",
    turler: MOTOR_TURLERI["akan-renk"],
    sade: "Renk geçişi durur, ilk konumda sabit kalır.",
    parametreler: {
      renkler: { tur: "renkler", zorunlu: true, min: 2, max: 8, aciklama: "Geçişin renkleri (sırayla)." },
      duraklar: {
        tur: "duraklar",
        zorunlu: false,
        aciklama: "Renklerin konumu (yüzde, artan); yoksa eşit aralıklı.",
      },
      aci: {
        tur: "sayi",
        zorunlu: false,
        min: 0,
        max: 360,
        tam: true,
        birim: "derece",
        varsayilan: 90,
        aciklama: "Geçişin açısı (90: soldan sağa).",
      },
      genislik: {
        tur: "sayi",
        zorunlu: false,
        min: 100,
        max: 400,
        tam: true,
        birim: "%",
        varsayilan: 200,
        aciklama: "Geçişin metne göre genişliği.",
      },
      akisHizi: {
        tur: "sayi",
        zorunlu: true,
        min: 0.5,
        max: 30,
        tam: false,
        birim: "sn",
        aciklama: "Bir tam akışın (ya da salınımın bir yönünün) süresi.",
      },
      hareket: {
        tur: "secim",
        zorunlu: false,
        secenekler: ["akis", "salinim"],
        varsayilan: "akis",
        aciklama: "akis: sürekli aynı yöne kayar; salinim: ileri geri gider.",
      },
      yon: {
        tur: "secim",
        zorunlu: false,
        secenekler: ["ileri", "geri"],
        varsayilan: "ileri",
        aciklama: "Akışın yönü.",
      },
      dolgu: {
        tur: "renk",
        zorunlu: false,
        aciklama: "Geçiş çizilemezse (eski tarayıcı) metnin rengi; yoksa ilk renk.",
      },
      isik: {
        tur: "isik",
        zorunlu: false,
        enBuyukYaricap: 24,
        aciklama: "Dış ışıma (renk ve yarıçap).",
      },
      doku: { ...cerceveDokusu, aciklama: "Çerçevede zorunlu: renk geçişinin maskesi olan çerçeve görseli." },
    },
  },
  kivilcim: {
    id: "kivilcim",
    ad: "Kıvılcım",
    turler: MOTOR_TURLERI.kivilcim,
    sade: "Kıvılcımlar çizilmez.",
    parametreler: {
      doku: {
        tur: "doku",
        zorunlu: false,
        enBuyukPiksel: EFFECT_TEXTURE_MAX_PX,
        aciklama: "Kıvılcım görseli (en çok 256 px); yoksa yuvarlak ışık noktası.",
      },
      sayi: {
        tur: "sayi",
        zorunlu: false,
        min: 1,
        max: EFFECT_MAX_PARTICLES,
        tam: true,
        birim: "adet",
        varsayilan: 12,
        aciklama: "Aynı anda en çok kaç kıvılcım.",
      },
      hiz: {
        tur: "sayi",
        zorunlu: false,
        min: 0.4,
        max: 6,
        tam: false,
        birim: "sn",
        varsayilan: 1.6,
        aciklama: "Bir kıvılcımın ömrü.",
      },
      renk: { tur: "renk", zorunlu: true, aciklama: "Kıvılcımın rengi (doku varsa ışıması)." },
      boyut: {
        tur: "sayi",
        zorunlu: false,
        min: 2,
        max: 24,
        tam: true,
        birim: "px",
        varsayilan: 6,
        aciklama: "Kıvılcımın boyu.",
      },
    },
  },
  "donen-halka": {
    id: "donen-halka",
    ad: "Dönen halka",
    turler: MOTOR_TURLERI["donen-halka"],
    sade: "Halka dönmez, ilk konumda durur.",
    parametreler: {
      doku: {
        ...cerceveDokusu,
        zorunlu: true,
        aciklama: "Çerçeve görseli (384x384, ortada %62 şeffaf delik).",
      },
      donusHizi: {
        tur: "sayi",
        zorunlu: true,
        min: 1,
        max: 120,
        tam: false,
        birim: "sn",
        aciklama: "Bir tam turun süresi.",
      },
      katman: {
        tur: "sayi",
        zorunlu: false,
        min: 1,
        max: 3,
        tam: true,
        birim: "adet",
        varsayilan: 1,
        aciklama: "Katman sayısı: ikinci ve üçüncü katman ters yönde, daha hızlı ve yarı saydam döner.",
      },
      yon: {
        tur: "secim",
        zorunlu: false,
        secenekler: ["saat", "ters"],
        varsayilan: "saat",
        aciklama: "Dönüş yönü (saat yönü ya da tersi).",
      },
    },
  },
  "parcacik-yagmuru": {
    id: "parcacik-yagmuru",
    ad: "Parçacık yağmuru",
    turler: MOTOR_TURLERI["parcacik-yagmuru"],
    sade: "Parçacıklar hareket etmez; birkaçı sabit görünür.",
    parametreler: {
      dokular: {
        tur: "dokular",
        zorunlu: true,
        min: 1,
        max: 4,
        enBuyukPiksel: EFFECT_TEXTURE_MAX_PX,
        aciklama: "Parçacık görselleri (en çok 256 px).",
      },
      yogunluk: {
        tur: "sayi",
        zorunlu: false,
        min: 1,
        max: EFFECT_MAX_PARTICLES,
        tam: true,
        birim: "adet",
        varsayilan: 24,
        aciklama: "Parçacık sayısı.",
      },
      yon: {
        tur: "secim",
        zorunlu: false,
        secenekler: ["asagi", "yukari", "patlama"],
        varsayilan: "asagi",
        aciklama: "asagi: yağar; yukari: yükselir; patlama: ortadan dışa saçılır.",
      },
      sure: {
        tur: "sayi",
        zorunlu: false,
        min: 0.5,
        max: 6,
        tam: false,
        birim: "sn",
        varsayilan: 2.4,
        aciklama: "Bir parçacığın yolculuğu.",
      },
    },
  },
  "kare-animasyon": {
    id: "kare-animasyon",
    ad: "Kare animasyonu",
    turler: MOTOR_TURLERI["kare-animasyon"],
    sade: "Yalnız ilk kare.",
    parametreler: {
      kareler: {
        tur: "dokular",
        zorunlu: true,
        min: 2,
        max: 12,
        enBuyukPiksel: EFFECT_TEXTURE_MAX_PX,
        aciklama: "Kareler (sırayla; en çok 256 px).",
      },
      kareSuresi: {
        tur: "sayi",
        zorunlu: false,
        min: 40,
        max: 1000,
        tam: true,
        birim: "ms",
        varsayilan: 120,
        aciklama: "Bir karenin süresi.",
      },
      dongu: { tur: "mantik", zorunlu: false, varsayilan: true, aciklama: "Sona gelince başa dön." },
    },
  },
  "doku-katmani": {
    id: "doku-katmani",
    ad: "Doku katmanı",
    turler: MOTOR_TURLERI["doku-katmani"],
    sade: "Doku hareket etmez.",
    parametreler: {
      doku: {
        tur: "doku",
        zorunlu: true,
        enBuyukPiksel: EFFECT_CARD_TEXTURE_PX,
        aciklama: "Ürün görseli: çerçevede 384x384 (ortada %62 delik), kart arkasında 480x720.",
      },
      karisim: {
        tur: "secim",
        zorunlu: false,
        secenekler: ["normal", "screen", "lighten", "overlay", "plus-lighter"],
        varsayilan: "normal",
        aciklama: "Altındakiyle karışım modu.",
      },
      hareket: {
        tur: "secim",
        zorunlu: false,
        secenekler: ["yok", "kayma", "salinim"],
        varsayilan: "yok",
        aciklama: "yok: sabit; kayma: yavaşça yana kayar; salinim: hafifçe sallanır.",
      },
      hareketHizi: {
        tur: "sayi",
        zorunlu: false,
        min: 1,
        max: 60,
        tam: false,
        birim: "sn",
        varsayilan: 8,
        aciklama: "Bir hareket döngüsünün süresi.",
      },
    },
  },
};

export const EFFECT_ENGINE_IDS = Object.keys(EFFECT_ENGINES) as EffectEngineId[];

// ---- Değer doğrulayıcıları -----------------------------------------------------------------------------------

const HEX = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d{1,3})\s*\)$/;
/** Doku yolu: `public/assets/shop/` altında bilinen bir klasörde küçük harfli .webp (yol kaçışı yok). */
const TEXTURE = /^(?:cerceve|kart-arkasi|zafer|tepki|giris|efekt)\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/;

/** Renk: `#rrggbb`, `#rrggbbaa` ya da `rgba(r, g, b, a)`. */
export function isEffectColour(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (HEX.test(v)) return true;
  const m = RGBA.exec(v);
  return m !== null && [m[1], m[2], m[3]].every((x) => Number(x) <= 255);
}

export function isEffectTexture(v: unknown): v is string {
  return typeof v === "string" && v.length <= 80 && TEXTURE.test(v);
}

export interface EffectLight {
  renk: string;
  yaricap: number;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function checkLight(v: unknown, max: number): EffectLight | string {
  if (!isRec(v)) return "renk ve yaricap alanları olan bir nesne olmalı";
  const extra = Object.keys(v).filter((k) => k !== "renk" && k !== "yaricap");
  if (extra.length > 0) return `bilinmeyen alan: ${extra.join(", ")}`;
  if (!isEffectColour(v.renk)) return "renk geçersiz";
  if (typeof v.yaricap !== "number" || !Number.isFinite(v.yaricap) || v.yaricap < 0 || v.yaricap > max)
    return `yaricap 0-${max} arası olmalı`;
  return { renk: v.renk, yaricap: v.yaricap };
}

/** Tek parametreyi şemasına göre denetler; hata metni ya da null. */
function checkParam(name: string, s: EffectParam, v: unknown, all: Record<string, unknown>): string | null {
  const at = `parametreler.${name}`;
  switch (s.tur) {
    case "renk":
      return isEffectColour(v) ? null : `${at}: geçersiz renk (#rrggbb ya da rgba(...))`;
    case "renkler":
      if (!Array.isArray(v) || v.length < s.min || v.length > s.max)
        return `${at}: ${s.min}-${s.max} renklik liste olmalı`;
      return v.every(isEffectColour) ? null : `${at}: geçersiz renk var`;
    case "sayi": {
      if (typeof v !== "number" || !Number.isFinite(v)) return `${at}: sayı olmalı`;
      if (s.tam && !Number.isInteger(v)) return `${at}: tam sayı olmalı`;
      return v >= s.min && v <= s.max ? null : `${at}: ${s.min}-${s.max} ${s.birim} arası olmalı`;
    }
    case "secim":
      return typeof v === "string" && s.secenekler.includes(v)
        ? null
        : `${at}: şunlardan biri olmalı: ${s.secenekler.join(", ")}`;
    case "mantik":
      return typeof v === "boolean" ? null : `${at}: true ya da false olmalı`;
    case "doku":
      return isEffectTexture(v) ? null : `${at}: doku yolu geçersiz (örn. cerceve/ad.webp)`;
    case "dokular":
      if (!Array.isArray(v) || v.length < s.min || v.length > s.max)
        return `${at}: ${s.min}-${s.max} dokuluk liste olmalı`;
      return v.every(isEffectTexture) ? null : `${at}: geçersiz doku yolu var`;
    case "isiklar": {
      if (!Array.isArray(v) || v.length < s.min || v.length > s.max)
        return `${at}: ${s.min}-${s.max} ışıklık liste olmalı`;
      for (const [i, x] of v.entries()) {
        const r = checkLight(x, s.enBuyukYaricap);
        if (typeof r === "string") return `${at}[${i}]: ${r}`;
      }
      return null;
    }
    case "isik": {
      const r = checkLight(v, s.enBuyukYaricap);
      return typeof r === "string" ? `${at}: ${r}` : null;
    }
    case "duraklar": {
      const colours = all.renkler;
      if (!Array.isArray(v) || !Array.isArray(colours) || v.length !== colours.length)
        return `${at}: renklerle aynı sayıda olmalı`;
      let last = -1;
      for (const x of v) {
        if (typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 100 || x < last)
          return `${at}: 0-100 arası artan sayılar olmalı`;
        last = x;
      }
      return null;
    }
  }
}

export interface EffectCheck {
  ok: boolean;
  errors: string[];
}

/**
 * Efekt tarifini doğrular: bilinen motor, bilinen ve geçerli parametreler, zorunlular dolu. `tur` verilirse motorun
 * o ürün türünde kullanılabildiği ve türe özel zorunlular da (ad efektinde metin rengi, çerçevede çerçeve görseli)
 * denetlenir.
 */
export function validateEffectRecipe(r: unknown, tur?: CosmeticTypeId): EffectCheck {
  const errors: string[] = [];
  if (!isRec(r)) return { ok: false, errors: ["tarif bir nesne olmalı: { motor, parametreler }"] };
  const extra = Object.keys(r).filter((k) => k !== "motor" && k !== "parametreler");
  if (extra.length > 0) errors.push(`bilinmeyen alan: ${extra.join(", ")}`);
  const engine = typeof r.motor === "string" ? EFFECT_ENGINES[r.motor as EffectEngineId] : undefined;
  if (!engine || !Object.hasOwn(EFFECT_ENGINES, r.motor as string)) {
    errors.push(`motor bilinmiyor; şunlardan biri olmalı: ${EFFECT_ENGINE_IDS.join(", ")}`);
    return { ok: false, errors };
  }
  if (!isRec(r.parametreler)) {
    errors.push("parametreler bir nesne olmalı");
    return { ok: false, errors };
  }
  const p = r.parametreler;
  for (const k of Object.keys(p))
    if (!Object.hasOwn(engine.parametreler, k)) errors.push(`parametreler.${k}: bu motorda yok`);
  for (const [name, schema] of Object.entries(engine.parametreler)) {
    if (p[name] === undefined) {
      if (schema.zorunlu) errors.push(`parametreler.${name}: zorunlu`);
      continue;
    }
    const e = checkParam(name, schema, p[name], p);
    if (e) errors.push(e);
  }
  if (tur !== undefined) {
    if (!engine.turler.includes(tur))
      errors.push(`${engine.id} motoru ${tur} türünde kullanılamaz (izinli: ${engine.turler.join(", ")})`);
    if (tur === "ad-efekti" && engine.id === "parlama" && p.renk === undefined)
      errors.push("parametreler.renk: ad efektinde zorunlu");
    if (tur === "cerceve" && (engine.id === "parlama" || engine.id === "akan-renk") && p.doku === undefined)
      errors.push("parametreler.doku: çerçevede zorunlu");
  }
  return { ok: errors.length === 0, errors };
}

// ---- Çözülmüş tarif (çiziciler için) -------------------------------------------------------------------------

export type ParsedEffect =
  | {
      motor: "parlama";
      renk: string | null;
      isiklar: EffectLight[];
      tepeIsiklar: EffectLight[] | null;
      nabizHizi: number;
      yogunluk: number;
      doku: string | null;
    }
  | {
      motor: "akan-renk";
      renkler: string[];
      duraklar: number[] | null;
      aci: number;
      genislik: number;
      akisHizi: number;
      hareket: "akis" | "salinim";
      yon: "ileri" | "geri";
      dolgu: string;
      isik: EffectLight | null;
      doku: string | null;
    }
  | { motor: "kivilcim"; doku: string | null; sayi: number; hiz: number; renk: string; boyut: number }
  | { motor: "donen-halka"; doku: string; donusHizi: number; katman: number; yon: "saat" | "ters" }
  | {
      motor: "parcacik-yagmuru";
      dokular: string[];
      yogunluk: number;
      yon: "asagi" | "yukari" | "patlama";
      sure: number;
    }
  | { motor: "kare-animasyon"; kareler: string[]; kareSuresi: number; dongu: boolean }
  | {
      motor: "doku-katmani";
      doku: string;
      karisim: "normal" | "screen" | "lighten" | "overlay" | "plus-lighter";
      hareket: "yok" | "kayma" | "salinim";
      hareketHizi: number;
    };

/** Tarifi doğrular ve varsayılanları doldurur; geçersizse null (ağdan ya da taslaktan gelen veri). */
export function parseEffectRecipe(r: unknown, tur?: CosmeticTypeId): ParsedEffect | null {
  if (!validateEffectRecipe(r, tur).ok || !isRec(r) || !isRec(r.parametreler)) return null;
  const p = r.parametreler;
  const engine = EFFECT_ENGINES[r.motor as EffectEngineId];
  const num = (k: string): number => {
    const v = p[k];
    if (typeof v === "number") return v;
    const s = engine.parametreler[k];
    return s?.tur === "sayi" ? (s.varsayilan ?? s.min) : 0;
  };
  const str = <T extends string>(k: string): T => {
    const v = p[k];
    if (typeof v === "string") return v as T;
    const s = engine.parametreler[k];
    return (s?.tur === "secim" ? s.varsayilan : "") as T;
  };
  const opt = (k: string): string | null => (typeof p[k] === "string" ? (p[k] as string) : null);
  const strs = (k: string): string[] => (Array.isArray(p[k]) ? (p[k] as string[]).slice() : []);
  const lights = (k: string): EffectLight[] | null =>
    Array.isArray(p[k]) ? (p[k] as EffectLight[]).map((l) => ({ renk: l.renk, yaricap: l.yaricap })) : null;
  switch (engine.id) {
    case "parlama":
      return {
        motor: "parlama",
        renk: opt("renk"),
        isiklar: lights("isiklar") ?? [],
        tepeIsiklar: lights("tepeIsiklar"),
        nabizHizi: num("nabizHizi"),
        yogunluk: num("yogunluk"),
        doku: opt("doku"),
      };
    case "akan-renk": {
      const renkler = strs("renkler");
      const light = isRec(p.isik) ? (p.isik as unknown as EffectLight) : null;
      return {
        motor: "akan-renk",
        renkler,
        duraklar: Array.isArray(p.duraklar) ? (p.duraklar as number[]).slice() : null,
        aci: num("aci"),
        genislik: num("genislik"),
        akisHizi: num("akisHizi"),
        hareket: str("hareket"),
        yon: str("yon"),
        dolgu: opt("dolgu") ?? renkler[0] ?? "#ffffff",
        isik: light ? { renk: light.renk, yaricap: light.yaricap } : null,
        doku: opt("doku"),
      };
    }
    case "kivilcim":
      return {
        motor: "kivilcim",
        doku: opt("doku"),
        sayi: num("sayi"),
        hiz: num("hiz"),
        renk: opt("renk") ?? "#ffffff",
        boyut: num("boyut"),
      };
    case "donen-halka":
      return {
        motor: "donen-halka",
        doku: opt("doku") ?? "",
        donusHizi: num("donusHizi"),
        katman: num("katman"),
        yon: str("yon"),
      };
    case "parcacik-yagmuru":
      return {
        motor: "parcacik-yagmuru",
        dokular: strs("dokular"),
        yogunluk: num("yogunluk"),
        yon: str("yon"),
        sure: num("sure"),
      };
    case "kare-animasyon":
      return {
        motor: "kare-animasyon",
        kareler: strs("kareler"),
        kareSuresi: num("kareSuresi"),
        dongu: typeof p.dongu === "boolean" ? p.dongu : true,
      };
    case "doku-katmani":
      return {
        motor: "doku-katmani",
        doku: opt("doku") ?? "",
        karisim: str("karisim"),
        hareket: str("hareket"),
        hareketHizi: num("hareketHizi"),
      };
  }
}

/** Tarifin kullandığı doku dosyaları (`public/assets/shop/` altında göreli yol). */
export function effectTextures(e: ParsedEffect): string[] {
  switch (e.motor) {
    case "parlama":
    case "akan-renk":
    case "kivilcim":
      return e.doku ? [e.doku] : [];
    case "donen-halka":
    case "doku-katmani":
      return [e.doku];
    case "parcacik-yagmuru":
      return e.dokular;
    case "kare-animasyon":
      return e.kareler;
  }
}
