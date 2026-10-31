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
  | `kara-borsa/${"kutu-ahsap" | "kutu-antika" | "kutu-celik" | "kutu-hediye" | "kutu-lanet"}`
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
  | `rus-ruleti/${"tabanca" | "tambur"}`
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

const BOMBA: PropPath[] = ["bomba/govde", "bomba/fitil", "bomba/kivilcim", "bomba/patlama"];

/** Oyun kimliği -> o oyunun nesneleri (anlatım başlarken önden indirilir). */
const GAME_PROPS: Record<string, readonly PropPath[]> = {
  "gizli-alisveris": ALISVERIS_PROP_FILES.filter(alisverisPropExists).map(
    (f): PropPath => `gizli-alisveris/${f}`,
  ),
  "kara-borsa": [
    "kara-borsa/kutu-ahsap",
    "kara-borsa/kutu-antika",
    "kara-borsa/kutu-celik",
    "kara-borsa/kutu-hediye",
    "kara-borsa/kutu-lanet",
  ],
  "kor-bomba": BOMBA,
  "zaman-bombasi-hafizasi": BOMBA,
  "rus-ruleti": ["rus-ruleti/tabanca", "rus-ruleti/tambur"],
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
  "kor-kronometre": ["genel/kronometre"],
  "gizli-hirsiz": ["genel/kasa-kapisi"],
  "son-kisi": ["genel/kacis-kolu"],
  ittifak: ["genel/el-sikisma"],
  "capraz-ates": ["genel/nisangah"],
  "yazi-yaz": YAZI_YAZ_PROPS.filter(yaziYazPropExists).map((n): PropPath => `yazi-yaz/${n}`),
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
