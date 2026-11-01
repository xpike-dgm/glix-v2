import { warmImage } from "./imageWarm.js";

/** Oyun nesneleri (şeffaf WebP). Yol: /assets/props/<grup>/<ad>.webp */
export type PropPath =
  | `bomba/${"govde" | "fitil" | "kivilcim" | "patlama"}`
  | `genel/${
      | "arcade-dugme"
      | "arcade-dugme-basili"
      | "el-tas"
      | "el-kagit"
      | "el-makas"
      | "el-sikisma"
      | "enerji-cekirdegi"
      | "enerji-cekirdegi-asiri"
      | "kacis-kolu"
      | "kasa-kapisi"
      | "kronometre"
      | "nisangah"
      | "rusvet-jetonu"
      | "taht"
      | "tuval"}`
  | `gizli-alisveris/${string}`
  | `kara-borsa/${string}`
  | `kontrol-paneli-kaosu/${
      | "kablo-kirmizi"
      | "kablo-mavi"
      | "kablo-sari"
      | "kablo-yesil"
      | "kablo-mor"
      | "kablo-kesik"
      | "kivilcim"
      | "bomba-govde"
      | "not-kagidi"}`
  | `rus-ruleti/${"tabanca" | "tambur" | RuletProp}`
  | `sozluk-blofu/${SozlukProp}`
  | `karalama-defteri/${KaralamaProp}`
  | `kor-kronometre/${KronometreProp}`
  | `yazi-yaz/${YaziYazProp}`
  | `zehirli-kadeh/${"efekt-temiz" | "efekt-zehir" | "masa" | "mum" | `kadeh-${string}`}`;

export const propSrc = (p: PropPath): string => `/assets/props/${p}.webp`;

/** Yazı Yaz görselleri (sahip üretecek; docs/oneriler/yazi-yaz-gorsel.md). Yoksa ekran CSS çizimini kullanır. */
export type YaziYazProp = "kart-arka" | "kart-yazan" | "kart-masum" | "konu-kagit";
export const YAZI_YAZ_PROPS: readonly YaziYazProp[] = ["kart-arka", "kart-yazan", "kart-masum", "konu-kagit"];

/** Bu Yazı Yaz görseli derlemede var mıydı? Liste yoksa (testler) yok sayılır: olmayan dosya istenmez (404 yok). */
export function yaziYazPropExists(name: YaziYazProp): boolean {
  const built = typeof __YAZI_YAZ_PROPS__ === "undefined" ? undefined : __YAZI_YAZ_PROPS__;
  return built ? built.includes(name) : false;
}

/** Var olan Yazı Yaz görselinin adresi; yoksa null. */
export const yaziYazProp = (name: YaziYazProp): string | null =>
  yaziYazPropExists(name) ? propSrc(`yazi-yaz/${name}`) : null;

/**
 * Sözlük Blöfü görselleri (sahip üretecek; docs/oneriler/GORSEL-IHTIYACLARI.md "Sözlük Blöfü"). Yoksa ekran CSS/SVG
 * karşılığını çizer ve olmayan dosyayı hiç istemez (404 yok).
 */
export type SozlukProp = "sayfa" | "muhur" | "murekkep" | "tuy-kalem";
export const SOZLUK_PROPS: readonly SozlukProp[] = ["sayfa", "muhur", "murekkep", "tuy-kalem"];

export function sozlukPropExists(name: SozlukProp): boolean {
  const built = typeof __SOZLUK_PROPS__ === "undefined" ? undefined : __SOZLUK_PROPS__;
  return built ? built.includes(name) : false;
}

/** Var olan Sözlük Blöfü görselinin adresi; yoksa null. */
export const sozlukProp = (name: SozlukProp): string | null =>
  sozlukPropExists(name) ? propSrc(`sozluk-blofu/${name}`) : null;

/**
 * Karalama Defteri görselleri (sahip üretecek; docs/oneriler/GORSEL-IHTIYACLARI.md "Karalama Defteri"). Yoksa ekran
 * CSS/SVG karşılığını çizer ve olmayan dosyayı hiç istemez (404 yok); dosya konunca kod değişmeden kullanılır.
 */
export type KaralamaProp = "kart-arka" | "isik-izi" | "damga-yakalandi" | "damga-kurtuldu" | "cerceve";
export const KARALAMA_PROPS: readonly KaralamaProp[] = [
  "kart-arka",
  "isik-izi",
  "damga-yakalandi",
  "damga-kurtuldu",
  "cerceve",
];

export function karalamaPropExists(name: KaralamaProp): boolean {
  const built = typeof __KARALAMA_PROPS__ === "undefined" ? undefined : __KARALAMA_PROPS__;
  return built ? built.includes(name) : false;
}

/** Var olan Karalama Defteri görselinin adresi; yoksa null. */
export const karalamaProp = (name: KaralamaProp): string | null =>
  karalamaPropExists(name) ? propSrc(`karalama-defteri/${name}`) : null;

/**
 * Rus Ruleti görselleri (sahip üretecek; docs/oneriler/GORSEL-IHTIYACLARI.md "Rus Ruleti"). Yoksa ekran mevcut yandan
 * tabancayı döndürerek kullanır ve olmayan dosyayı hiç istemez (404 yok); dosya `rus-ruleti/<ad>.webp` olarak gelince
 * kod değişmeden kullanılır.
 */
export type RuletProp = "tabanca-ust";
export const RULET_PROPS: readonly RuletProp[] = ["tabanca-ust"];

export function ruletPropExists(name: RuletProp): boolean {
  const built = typeof __RULET_PROPS__ === "undefined" ? undefined : __RULET_PROPS__;
  return built ? built.includes(name) : false;
}

/** Var olan Rus Ruleti görselinin adresi; yoksa null. */
export const ruletProp = (name: RuletProp): string | null =>
  ruletPropExists(name) ? propSrc(`rus-ruleti/${name}`) : null;

/**
 * Kör Kronometre görselleri (sahip üretecek; docs/oneriler/GORSEL-IHTIYACLARI.md "Kör Kronometre"). Yoksa ekran CSS
 * karşılığını çizer ve olmayan dosyayı hiç istemez (404 yok); dosya `kor-kronometre/<ad>.webp` olarak gelince
 * kendiliğinden kullanılır.
 */
export type KronometreProp = "kronometre-donmus";
export const KRONOMETRE_PROPS: readonly KronometreProp[] = ["kronometre-donmus"];

export function kronometrePropExists(name: KronometreProp): boolean {
  const built = typeof __KRONOMETRE_PROPS__ === "undefined" ? undefined : __KRONOMETRE_PROPS__;
  return built ? built.includes(name) : false;
}

/** Var olan Kör Kronometre görselinin adresi; yoksa null. */
export const kronometreProp = (name: KronometreProp): string | null =>
  kronometrePropExists(name) ? propSrc(`kor-kronometre/${name}`) : null;

/**
 * Gizli Alışveriş ürün kimliği (motor havuzu sırası, 0..19) -> dosya adı. Son 8 ürünün görseli henüz yoksa ekran
 * kendi yer tutucusunu çizer; dosya `gizli-alisveris/<ad>.webp` olarak gelince kendiliğinden kullanılır.
 */
export const ALISVERIS_PROP_FILES: readonly string[] = [
  "hologram-sticker",
  "enerji-icecegi",
  "neon-rozet",
  "retro-kartus",
  "mini-hoparlor",
  "arcade-eldiveni",
  "piksel-kamera",
  "jet-canta",
  "kristal-kulaklik",
  "holo-kask",
  "mini-drone",
  "gizli-sandik",
  "lazer-kalem",
  "ses-karti",
  "retro-joystick",
  "plazma-lamba",
  "mini-robot",
  "hologram-saat",
  "neon-kaykay",
  "vr-gozluk",
];

/**
 * Görsel dosyası gerçekten var mı (derleme anındaki liste)? Liste yoksa (testler) yalnız ilk 12 ürünün dosyası
 * var sayılır. Önyükleme olmayan dosyayı istemez (404 yok); ekran yine dosyayı dener, yoksa yer tutucu çizer.
 */
export function alisverisPropExists(file: string): boolean {
  const built = typeof __ALISVERIS_PROPS__ === "undefined" ? undefined : __ALISVERIS_PROPS__;
  return built ? built.includes(file) : ALISVERIS_PROP_FILES.indexOf(file) < 12;
}

/** Kara Borsa'da bugün depoda olan görseller (derleme listesi yoksa, örn. testlerde, bunlar var sayılır). */
const KARA_BORSA_BASE = ["kutu-ahsap", "kutu-antika", "kutu-celik", "kutu-hediye", "kutu-lanet"];

/**
 * Kara Borsa görseli derlemede var mıydı? Yeni görseller (açık kutular `<kutu>-acik`, `tokmak`, `buyuk-sandik`)
 * sahip tarafından üretilip `public/assets/props/kara-borsa/<ad>.webp` olarak konunca kod değişmeden kullanılır;
 * yokken ekran CSS/SVG karşılığını çizer ve dosyayı hiç istemez (404 ve konsol hatası olmaz).
 */
export function karaBorsaPropExists(name: string): boolean {
  const built = typeof __KARA_BORSA_PROPS__ === "undefined" ? undefined : __KARA_BORSA_PROPS__;
  return built ? built.includes(name) : KARA_BORSA_BASE.includes(name);
}

/** Kara Borsa'nın önden indirilecek, gerçekten var olan görselleri. */
export const KARA_BORSA_PROP_FILES: readonly string[] = [
  ...KARA_BORSA_BASE,
  ...["kutu-ahsap", "kutu-celik", "kutu-hediye", "kutu-antika", "kutu-lanet"].map((b) => `${b}-acik`),
  "tokmak",
  "buyuk-sandik",
  "buyuk-sandik-acik",
];

const BOMBA: PropPath[] = ["bomba/govde", "bomba/fitil", "bomba/kivilcim", "bomba/patlama"];

/** Oyun kimliği -> o oyunun nesneleri (anlatım başlarken önden indirilir). */
const GAME_PROPS: Record<string, readonly PropPath[]> = {
  "gizli-alisveris": ALISVERIS_PROP_FILES.filter(alisverisPropExists).map(
    (f): PropPath => `gizli-alisveris/${f}`,
  ),
  "kara-borsa": KARA_BORSA_PROP_FILES.filter(karaBorsaPropExists).map((f): PropPath => `kara-borsa/${f}`),
  "kor-bomba": BOMBA,
  "zaman-bombasi-hafizasi": BOMBA,
  "rus-ruleti": [
    "rus-ruleti/tabanca",
    "rus-ruleti/tambur",
    ...RULET_PROPS.filter(ruletPropExists).map((n): PropPath => `rus-ruleti/${n}`),
  ],
  "kontrol-paneli-kaosu": [
    "kontrol-paneli-kaosu/kablo-kirmizi",
    "kontrol-paneli-kaosu/kablo-mavi",
    "kontrol-paneli-kaosu/kablo-sari",
    "kontrol-paneli-kaosu/kablo-yesil",
    "kontrol-paneli-kaosu/kablo-kesik",
    "kontrol-paneli-kaosu/kivilcim",
    "kontrol-paneli-kaosu/kablo-mor",
    "kontrol-paneli-kaosu/bomba-govde",
    "kontrol-paneli-kaosu/not-kagidi",
  ],
  "butona-bas": ["genel/arcade-dugme", "genel/arcade-dugme-basili"],
  "rusvet-darbe": ["genel/taht", "genel/rusvet-jetonu", "genel/el-tas", "genel/el-kagit", "genel/el-makas"],
  "asiri-yukleme": ["genel/enerji-cekirdegi", "genel/enerji-cekirdegi-asiri"],
  "kor-kronometre": [
    "genel/kronometre",
    ...KRONOMETRE_PROPS.filter(kronometrePropExists).map((n): PropPath => `kor-kronometre/${n}`),
  ],
  "gizli-hirsiz": ["genel/kasa-kapisi"],
  "son-kisi": ["genel/kacis-kolu"],
  ittifak: ["genel/el-sikisma"],
  "capraz-ates": ["genel/nisangah"],
  "yazi-yaz": YAZI_YAZ_PROPS.filter(yaziYazPropExists).map((n): PropPath => `yazi-yaz/${n}`),
  "sozluk-blofu": SOZLUK_PROPS.filter(sozlukPropExists).map((n): PropPath => `sozluk-blofu/${n}`),
  "karalama-defteri": KARALAMA_PROPS.filter(karalamaPropExists).map((n): PropPath => `karalama-defteri/${n}`),
  "acgozluluk-limiti": ["genel/rusvet-jetonu"],
  "zehirli-kadeh": [
    "zehirli-kadeh/efekt-temiz",
    "zehirli-kadeh/efekt-zehir",
    "zehirli-kadeh/masa",
    "zehirli-kadeh/mum",
    ...["cyan", "magenta", "amber", "lime", "violet", "orange", "emerald", "cobalt"].map(
      (c): PropPath => `zehirli-kadeh/kadeh-${c}`,
    ),
  ],
};

/** Oyunun nesne görsellerini önden indirir; ekranlarda yanıp sönme olmaz. */
export function preloadProps(gameId: string, low = false): void {
  for (const p of GAME_PROPS[gameId] ?? []) warmImage(propSrc(p), low);
}
