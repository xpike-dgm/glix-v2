/**
 * Kozmetik mağaza kataloğu ve günün fırsatı (saf). Sunucu (satın alma, kuşanma, fiyat) ve istemci (görünüm,
 * geri sayım) aynı tabloyu kullanır. Sahip kararları: `docs/YOL-HARITASI.md` U18, ayrıntı `docs/HESAP.md`.
 *
 * Yeni bir tür eklemek: `COSMETIC_TYPES`'a satır, `Cosmetics`'e anahtar, `ITEMS`'a ürünler; istemcide türün çizicisi.
 * M2'de yalnız kodla çizilen üç tür var (unvan, ad efekti, çerçeve). M4'te kürsü karakteri gelir: `dans` (tek yuva) ve
 * her giysi yuvası kendi türüdür (`sapka`, `ust`; ileride alt, ayakkabı, aksesuar). Giysi türlerinin `group` alanı
 * `"giysi"`dir: mağaza hepsini tek "Giysiler" sekmesinde toplar, dolap yuva başına bölüm gösterir.
 *
 * Giysi yuvaları: şapka, üst, alt, ayakkabı, aksesuar ve tam kostüm (`GIYSI_SIRASI`). Boş yuva (katalogda ürünü
 * olmayan tür) arayüzde gösterilmez. Kostüm kuşanılınca kapladığı yuvaların giysisi çıkar (`covers`, bkz. `lookRules`).
 *
 * Renk seçeneği: her giysi beş neon renkle giyilir (`CLOTHING_COLOURS`; çizimin camgöbeği varsayılandır). Kuşanılan
 * değer `kimlik` (varsayılan renk) ya da `kimlik~renk`tir; `cosmetic_equipped.item_id` metindir, şema değişmez.
 * Renk yalnız giysinin neon vurgusunu boyar (istemci süzgeci). Sahiplik kuralı `COLOUR_MODE` ile tek yerden seçilir.
 */
import { createRng } from "./rng.js";

export type CosmeticRarity = "siradan" | "nadir" | "efsanevi";

/** Nadirliğe göre fiyat (Glix). */
export const COSMETIC_PRICES: Readonly<Record<CosmeticRarity, number>> = {
  siradan: 150,
  nadir: 400,
  efsanevi: 1000,
};

/** Oyunculara görünen kuşanılmış kozmetikler; yalnız dolu olanlar yazılır. Anahtarlar tür tablosundadır. */
export interface Cosmetics {
  title?: string;
  nameFx?: string;
  frame?: string;
  /** Kürsü dansı (`dans` türü); kuşanılmadıysa varsayılan dans. */
  dance?: string;
  /** Giysi yuvaları (kürsü karakteri); değer `kimlik` ya da `kimlik~renk`. */
  hat?: string;
  top?: string;
  bottom?: string;
  shoes?: string;
  accessory?: string;
  /** Tam kostüm: kapladığı yuvaların giysisini ezer. */
  costume?: string;
  /** Kart arkası (`kart-arkasi` türü); kuşanılmadıysa klasik sırt. */
  cardBack?: string;
  /** Zafer kutlaması (`zafer` türü); kazanan kuşandıysa final ekranında herkese oynar. */
  celebration?: string;
  /** Lobi giriş efekti (`giris` türü); lobiye girişte koltukta oynar. */
  entry?: string;
}
export type CosmeticKey = keyof Cosmetics;

export type CosmeticTypeId =
  | "unvan"
  | "ad-efekti"
  | "cerceve"
  | "dans"
  | "sapka"
  | "ust"
  | "alt"
  | "ayakkabi"
  | "aksesuar"
  | "kostum"
  | "kart-arkasi"
  | "zafer"
  | "tepki"
  | "giris";

/** Varsayılan kürsü dansı (ücretsiz, kuşanılmadığında oynar). Dans dosyası `karakter/dans/<kimlik>.json`. */
export const DEFAULT_DANCE = "sevinc";
/** İkinci ve üçüncü için selam hareketi; satılmaz. */
export const PLACE_DANCE = "selam";

export interface CosmeticType {
  id: CosmeticTypeId;
  /**
   * `Cosmetics` içindeki anahtar. `null`: tür kuşanılmaz, sahip olmak yeter (tepki paketleri); sunucu kuşanmayı
   * reddeder ve oyunculara kuşanılan olarak gitmez.
   */
  key: CosmeticKey | null;
  /** Tekil ad ("Lakap"), çoğul ad (sekme: "Lakaplar") ve ücretsiz temel seçeneğin adı. */
  name: string;
  plural: string;
  none: string;
  /** Mağazada aynı sekmeyi paylaşan türler ("giysi"); yoksa tür kendi sekmesidir. */
  group?: "giysi";
}

/** Kuşanılabilir mi (tek yuvalı)? Tepki paketleri değildir: alınan paket hep kullanılabilir. */
export const isEquippable = (type: CosmeticType): boolean => type.key !== null;

export const COSMETIC_TYPES: readonly CosmeticType[] = [
  { id: "unvan", key: "title", name: "Lakap", plural: "Lakaplar", none: "Yok" },
  { id: "ad-efekti", key: "nameFx", name: "Ad efekti", plural: "Ad efektleri", none: "Yok" },
  { id: "cerceve", key: "frame", name: "Çerçeve", plural: "Çerçeveler", none: "Yok" },
  // Dansın "yok" seçeneği varsayılan dans Sevinç'tir (ücretsiz; katalogda ürün olarak yer almaz).
  { id: "dans", key: "dance", name: "Dans", plural: "Danslar", none: "Sevinç" },
  { id: "sapka", key: "hat", name: "Şapka", plural: "Şapkalar", none: "Yok", group: "giysi" },
  { id: "ust", key: "top", name: "Üst", plural: "Üstler", none: "Yok", group: "giysi" },
  { id: "alt", key: "bottom", name: "Alt", plural: "Altlar", none: "Yok", group: "giysi" },
  { id: "ayakkabi", key: "shoes", name: "Ayakkabı", plural: "Ayakkabılar", none: "Yok", group: "giysi" },
  { id: "aksesuar", key: "accessory", name: "Aksesuar", plural: "Aksesuarlar", none: "Yok", group: "giysi" },
  { id: "kostum", key: "costume", name: "Kostüm", plural: "Kostümler", none: "Yok", group: "giysi" },
  // Kart arkasının "yok" seçeneği klasik sırttır (ücretsiz, katalogda ürün olarak yer almaz).
  { id: "kart-arkasi", key: "cardBack", name: "Kart arkası", plural: "Kart arkaları", none: "Klasik" },
  // Zaferin "yok" seçeneği her finaldeki klasik konfetidir.
  {
    id: "zafer",
    key: "celebration",
    name: "Zafer kutlaması",
    plural: "Zafer kutlamaları",
    none: "Klasik konfeti",
  },
  // Paketler kuşanılmaz: sahip olunan her paketin çıkartmaları tepki yelpazesine eklenir.
  { id: "tepki", key: null, name: "Tepki paketi", plural: "Tepki paketleri", none: "Yok" },
  { id: "giris", key: "entry", name: "Giriş efekti", plural: "Giriş efektleri", none: "Yok" },
];

export interface CosmeticItem {
  id: string;
  type: CosmeticTypeId;
  rarity: CosmeticRarity;
  /** Liste fiyatı (Glix); nadirlikten türer. Fırsat indirimi `dailyDeals` ile ayrıca hesaplanır. */
  price: number;
  name: string;
  description: string;
  /**
   * Karakter varlığı: `dans` için dans dosyasının kimliği (`karakter/dans/<asset>.json`), giysi için `rig.json`
   * `wardrobe` katmanının adı (şapka `sapka`, ceket `ceket`). Resimli türlerde `public/assets/shop/` altındaki
   * dosya öneki: kart arkası `kart-arkasi/<asset>.webp`, zafer `zafer/<asset>-1..4.webp`, tepki paketi
   * `tepki/<asset>-1..6.webp` (paket kimliği de budur), giriş `giris/<asset>-zemin|isik.webp`.
   */
  asset?: string;
  /**
   * Yalnız kostüm: kapladığı giysi yuvaları. Kuşanılınca bu yuvalardaki giysiler çıkar (kostüm onların yerini
   * tutar). Parçalarının kemiklerinden türer (`coveredSlots`); katalog testi rig.json ile eşitliği denetler.
   */
  covers?: readonly CosmeticTypeId[];
}

function item(
  id: string,
  type: CosmeticTypeId,
  rarity: CosmeticRarity,
  name: string,
  description: string,
  asset?: string,
  covers?: readonly CosmeticTypeId[],
): CosmeticItem {
  return {
    id,
    type,
    rarity,
    price: COSMETIC_PRICES[rarity],
    name,
    description,
    ...(asset ? { asset } : {}),
    ...(covers ? { covers } : {}),
  };
}

export const COSMETIC_ITEMS: readonly CosmeticItem[] = [
  item("unvan-parti-canavari", "unvan", "siradan", "Parti Canavarı", "Adının altında herkes görsün."),
  item("unvan-sessiz-tehlike", "unvan", "siradan", "Sessiz Tehlike", "Az konuşur, çok kazanır."),
  item("unvan-sansli", "unvan", "siradan", "Şanslı", "Zar hep senin yanında."),
  item("unvan-taktikci", "unvan", "siradan", "Taktikçi", "Her hamle hesaplı."),
  item("unvan-bluf-ustasi", "unvan", "nadir", "Blöf Ustası", "Yüzünden hiçbir şey anlaşılmaz."),
  item("unvan-son-saniyeci", "unvan", "nadir", "Son Saniyeci", "İş son saniyede biter."),
  item("unvan-efsane", "unvan", "efsanevi", "Efsane", "Masanın en büyük adı."),
  item("ad-neon-mavi", "ad-efekti", "siradan", "Neon Mavi", "Adın mavi neon gibi parlar."),
  item("ad-neon-pembe", "ad-efekti", "siradan", "Neon Pembe", "Adın pembe neon gibi parlar."),
  item("ad-gokkusagi", "ad-efekti", "nadir", "Gökkuşağı", "Adının renkleri yavaşça akar."),
  item("ad-kivilcim", "ad-efekti", "nadir", "Kıvılcım", "Adın hafifçe kıvılcım saçar."),
  item("ad-altin-parilti", "ad-efekti", "efsanevi", "Altın Parıltı", "Adın altın gibi parlar."),
  item("cerceve-camgobegi", "cerceve", "siradan", "Camgöbeği Halka", "Avatarını camgöbeği halka sarar."),
  item("cerceve-pembe", "cerceve", "siradan", "Pembe Halka", "Avatarını pembe halka sarar."),
  item("cerceve-cift", "cerceve", "nadir", "Çift Halka", "İç içe iki ince halka."),
  item("cerceve-donen-neon", "cerceve", "nadir", "Dönen Neon", "Avatarının çevresinde dönen neon."),
  item("cerceve-altin-tac", "cerceve", "efsanevi", "Altın Taç Halkası", "Taçlı altın halka."),
  item("cerceve-yesil-sarmasik", "cerceve", "siradan", "Yeşil Sarmaşık", "Neon yapraklı sarmaşık halka."),
  item(
    "cerceve-buz-kristali",
    "cerceve",
    "siradan",
    "Buz Kristali",
    "Sivri buz kristalleriyle soğuk parıltı.",
  ),
  item(
    "cerceve-ates-halkasi",
    "cerceve",
    "nadir",
    "Ateş Halkası",
    "Avatarının çevresini neon alevler sarar.",
  ),
  item("cerceve-devre-karti", "cerceve", "nadir", "Devre Kartı", "Işıklı düğümlü elektronik devre yolları."),
  item("cerceve-galaksi", "cerceve", "efsanevi", "Galaksi", "Yıldızlar ve dönen küçük bir gezegen."),
  item("cerceve-ejderha", "cerceve", "efsanevi", "Ejderha", "Halkaya dolanmış altın-kırmızı neon ejderha."),
  item("dans-twist", "dans", "siradan", "Twist", "Kalçalar sağa sola, ayaklar yerde.", "twist"),
  item("dans-tavuk", "dans", "siradan", "Tavuk Dansı", "Kanatlar çırpılır, kuyruk sallanır.", "tavuk"),
  item("dans-mutlu", "dans", "siradan", "Neşeli Adım", "Gülümseten, hafif adımlı bir dans.", "mutlu"),
  item("dans-charleston", "dans", "nadir", "Charleston", "Eski zaman, yeni neon.", "charleston"),
  item("dans-lambada", "dans", "nadir", "Lambada", "Kalçalar dalgalanır.", "lambada"),
  item("dans-makarena", "dans", "nadir", "Makarena", "Kollar sırayla, sonra bir dönüş.", "makarena"),
  item("dans-kazacok", "dans", "efsanevi", "Kazaçok", "Çömel, tekmele, zıpla.", "kazacok"),
  item(
    "dans-cizgi-film",
    "dans",
    "efsanevi",
    "Çizgi Film Dansı",
    "Eski bir çizgi filmden fırlamış gibi.",
    "mickey",
  ),
  item(
    "kart-neon-izgara",
    "kart-arkasi",
    "siradan",
    "Neon Izgara",
    "Kart sırtında neon bir ızgara.",
    "neon-izgara",
  ),
  item(
    "kart-gece-sehri",
    "kart-arkasi",
    "siradan",
    "Gece Şehri",
    "Kartların sırtında ışıl ışıl bir şehir.",
    "gece-sehri",
  ),
  item(
    "kart-retro-oyun",
    "kart-arkasi",
    "siradan",
    "Retro Oyun",
    "Piksel piksel neon oyun salonu.",
    "retro-oyun",
  ),
  item(
    "kart-okyanus",
    "kart-arkasi",
    "siradan",
    "Derin Okyanus",
    "Su altında parlayan denizanaları.",
    "okyanus",
  ),
  item(
    "kart-mor-girdap",
    "kart-arkasi",
    "nadir",
    "Mor Girdap",
    "Sırttaki mor girdap seni içine çeker.",
    "mor-girdap",
  ),
  item("kart-elektrik", "kart-arkasi", "nadir", "Elektrik", "Kartın sırtında elektrik akar.", "elektrik"),
  item(
    "kart-ejderha-pulu",
    "kart-arkasi",
    "nadir",
    "Ejderha Pulu",
    "Kırmızı-altın pullar, ortada parlayan göz.",
    "ejderha-pulu",
  ),
  item(
    "kart-kozmik-tac",
    "kart-arkasi",
    "efsanevi",
    "Kozmik Taç",
    "Galaksinin ortasında yıldızlardan taç.",
    "kozmik-tac",
  ),
  item(
    "kart-altin-kraliyet",
    "kart-arkasi",
    "efsanevi",
    "Altın Kraliyet",
    "Kraliyete yakışır altın sırt.",
    "altin-kraliyet",
  ),
  item(
    "zafer-konfeti",
    "zafer",
    "siradan",
    "Konfeti Patlaması",
    "Kazanınca renkli konfeti patlar.",
    "konfeti",
  ),
  item("zafer-balon", "zafer", "siradan", "Neon Balonlar", "Kazanınca neon balonlar yükselir.", "balon"),
  item(
    "zafer-havai-fisek",
    "zafer",
    "nadir",
    "Havai Fişek",
    "Kazanınca gökyüzü havai fişekle dolar.",
    "havai-fisek",
  ),
  item("zafer-simsek", "zafer", "nadir", "Şimşek Fırtınası", "Kazanınca şimşekler çakar.", "simsek"),
  item(
    "zafer-altin-yagmur",
    "zafer",
    "efsanevi",
    "Altın Yağmur",
    "Kazanınca altın ve yıldız yağar.",
    "altin-yagmur",
  ),
  item(
    "tepki-neon-yuzler",
    "tepki",
    "siradan",
    "Neon Yüzler",
    "Altı neon yüz ifadesi: gülen, şaşkın, sinirli ve daha fazlası.",
    "neon-yuzler",
  ),
  item(
    "tepki-hayvanlar",
    "tepki",
    "siradan",
    "Neon Hayvanlar",
    "Gülen kedi, şaşkın baykuş, uykucu panda ve daha fazlası.",
    "hayvanlar",
  ),
  item("tepki-parti", "tepki", "nadir", "Parti", "Şapka, disko topu, kadeh ve daha fazlası.", "parti"),
  item(
    "tepki-oyun-ani",
    "tepki",
    "nadir",
    "Oyun Anı",
    "Düşünen avatar, kum saati, zar, şans yoncası ve daha fazlası.",
    "oyun-ani",
  ),
  item(
    "tepki-efsane",
    "tepki",
    "efsanevi",
    "Efsane Tepkiler",
    "Taç, ateş topu, roket, elmas ve daha fazlası.",
    "efsane-tepkiler",
  ),
  item(
    "tepki-kozmik",
    "tepki",
    "efsanevi",
    "Kozmik",
    "Gezegen, kuyruklu yıldız, UFO, kara delik ve daha fazlası.",
    "kozmik",
  ),
  item(
    "giris-isinlanma",
    "giris",
    "siradan",
    "Işınlanma",
    "Lobiye ışık huzmesiyle ışınlanırsın.",
    "isinlanma",
  ),
  item("giris-duman", "giris", "siradan", "Duman", "Lobiye dumanın içinden çıkarsın.", "duman"),
  item("giris-simsek", "giris", "nadir", "Şimşek", "Lobiye şimşek çakarak girersin.", "simsek"),
  item("giris-portal", "giris", "nadir", "Portal", "Lobiye bir portaldan geçersin.", "portal"),
  item(
    "giris-altin-isik",
    "giris",
    "efsanevi",
    "Altın Işık Sütunu",
    "Lobiye altın bir ışık sütunuyla inersin.",
    "altin-isik",
  ),
  item("sapka-neon-kep", "sapka", "siradan", "Neon Kep", "Kürsüde başında neon bir kep.", "sapka"),
  item("sapka-bere", "sapka", "siradan", "Bere", "Ponponlu, neon çizgili sıcak bir bere.", "bere"),
  item("sapka-fotr", "sapka", "siradan", "Fötr", "Neon şeritli klasik fötr şapka.", "fotr"),
  item("sapka-parti", "sapka", "siradan", "Parti Şapkası", "Neon zikzaklı külah: parti başlasın!", "parti"),
  item("sapka-kasket", "sapka", "siradan", "Kasket", "Düz siperli işçi kasketi, neon şeritli.", "kasket"),
  item("sapka-boynuz", "sapka", "siradan", "Neon Boynuz", "Parlak uçlu sevimli şeytan boynuzları.", "boynuz"),
  item(
    "sapka-kovboy",
    "sapka",
    "nadir",
    "Kovboy Şapkası",
    "Neon dikişli, geniş kenarlı kovboy şapkası.",
    "kovboy",
  ),
  item(
    "sapka-kulaklikli-kask",
    "sapka",
    "nadir",
    "Kulaklıklı Kask",
    "Neon ışıklı kulaklıkla gelen fütüristik kask.",
    "kulaklikli-kask",
  ),
  item(
    "sapka-korsan",
    "sapka",
    "nadir",
    "Korsan Şapkası",
    "Ortasında neon yıldız parlayan korsan şapkası.",
    "korsan",
  ),
  item(
    "sapka-sihirbaz",
    "sapka",
    "nadir",
    "Sihirbaz",
    "Neon yıldızlı, hilalli uzun sivri şapka.",
    "sihirbaz",
  ),
  item(
    "sapka-samuray",
    "sapka",
    "efsanevi",
    "Samuray Kaskı",
    "Neon ön süslü, zırh plakalı kabuto.",
    "samuray",
  ),
  item("sapka-tac", "sapka", "efsanevi", "Taç", "Neon kristallerle süslü altın taç.", "tac"),
  item("ust-neon-bomber", "ust", "nadir", "Neon Bomber", "Kürsüde sırtında neon bomber ceket.", "ceket"),
  item("ust-kapusonlu", "ust", "siradan", "Kapüşonlu", "Göğsünde neon şeritli bol kapüşonlu.", "kapusonlu"),
  item("ust-forma", "ust", "siradan", "Forma", "Neon çizgili kısa kollu spor forması.", "forma"),
  item("ust-deri-ceket", "ust", "nadir", "Deri Ceket", "Yakası neon kenarlı siyah deri ceket.", "deri-ceket"),
  item("ust-smokin", "ust", "nadir", "Smokin", "Papyonlu, yakası neon smokin.", "smokin"),
  item(
    "ust-yagmurluk",
    "ust",
    "siradan",
    "Yağmurluk",
    "Parlak, neon şeritli kapüşonlu yağmurluk.",
    "yagmurluk",
  ),
  item("ust-kimono", "ust", "nadir", "Kimono", "Geniş kollu, neon kuşaklı kimono ceket.", "kimono"),
  item(
    "ust-zirh-yelek",
    "ust",
    "efsanevi",
    "Zırh Yelek",
    "Neon panelli fütüristik zırh yelek.",
    "zirh-yelek",
  ),
  item("alt-kot", "alt", "siradan", "Kot", "Dizleri hafif yıpranmış, yan dikişi neon kot.", "kot"),
  item("alt-sort", "alt", "siradan", "Şort", "Neon kenarlı şort.", "sort"),
  item("alt-esofman", "alt", "siradan", "Eşofman", "Yanında iki neon şerit olan eşofman altı.", "esofman"),
  item("alt-kargo", "alt", "nadir", "Kargo", "Yan cepli, neon fermuarlı kargo pantolon.", "kargo"),
  item("alt-etek", "alt", "nadir", "Etek", "Neon kenarlı pileli kısa etek.", "etek"),
  item(
    "alt-takim-pantolon",
    "alt",
    "nadir",
    "Takım Pantolon",
    "Ütü çizgisi ince neon kumaş pantolon.",
    "takim-pantolon",
  ),
  item("ayakkabi-spor", "ayakkabi", "siradan", "Spor Ayakkabı", "Neon bağcıklı spor ayakkabı.", "spor"),
  item("ayakkabi-terlik", "ayakkabi", "siradan", "Terlik", "Neon bantlı parmak arası terlik.", "terlik"),
  item(
    "ayakkabi-kaykay",
    "ayakkabi",
    "siradan",
    "Kaykay Ayakkabısı",
    "Yanı neon çizgili kaykay ayakkabısı.",
    "kaykay",
  ),
  item("ayakkabi-bot", "ayakkabi", "nadir", "Bot", "Çapraz neon bağcıklı kalın tabanlı bot.", "bot"),
  item("ayakkabi-paten", "ayakkabi", "nadir", "Paten", "Tekerlekleri parlayan neon paten.", "paten"),
  item(
    "ayakkabi-neon-cizme",
    "ayakkabi",
    "efsanevi",
    "Neon Çizme",
    "Dize kadar uzanan ışıl ışıl çizme.",
    "neon-cizme",
  ),
  item("aksesuar-kolye", "aksesuar", "siradan", "Kolye", "Kalın zincir, parlayan neon madalyon.", "kolye"),
  item("aksesuar-atki", "aksesuar", "siradan", "Atkı", "Ucu göğse düşen neon şeritli atkı.", "atki"),
  item(
    "aksesuar-gunes-gozlugu",
    "aksesuar",
    "nadir",
    "Güneş Gözlüğü",
    "Maskenin önüne geniş neon gözlük.",
    "gunes-gozlugu",
  ),
  item(
    "aksesuar-sirt-cantasi",
    "aksesuar",
    "nadir",
    "Sırt Çantası",
    "Askıları omuzda, ışıklı sırt çantası.",
    "sirt-cantasi",
  ),
  item(
    "aksesuar-pelerin",
    "aksesuar",
    "nadir",
    "Pelerin",
    "Omuzdan bacaklara uzanan neon kenarlı pelerin.",
    "pelerin",
  ),
  item(
    "aksesuar-kanat",
    "aksesuar",
    "efsanevi",
    "Neon Kanat",
    "Sırtta açılan ışıl ışıl tüy kanatlar.",
    "kanat",
  ),
  item("kostum-ninja", "kostum", "efsanevi", "Ninja", "Başlıklı siyah ninja kıyafeti, neon kuşak.", "ninja", [
    "sapka",
    "ust",
    "alt",
    "ayakkabi",
  ]),
  item(
    "kostum-robot",
    "kostum",
    "efsanevi",
    "Robot",
    "Metal plakalı zırh, parlayan neon eklemler.",
    "robot",
    ["sapka", "ust", "alt", "ayakkabi"],
  ),
  item(
    "kostum-astronot",
    "kostum",
    "efsanevi",
    "Astronot",
    "Neon panelli uzay kıyafeti ve kask.",
    "astronot",
    ["sapka", "ust", "alt", "ayakkabi"],
  ),
  item(
    "kostum-korsan-kaptan",
    "kostum",
    "efsanevi",
    "Korsan Kaptan",
    "Uzun ceket, kemer, çizme ve kaptan şapkası.",
    "korsan-kaptan",
    ["sapka", "ust", "alt", "ayakkabi"],
  ),
  item(
    "kostum-super-kahraman",
    "kostum",
    "efsanevi",
    "Süper Kahraman",
    "Pelerinli kostüm, göğsünde neon simge.",
    "super-kahraman",
    ["sapka", "ust", "alt", "ayakkabi"],
  ),
];

const BY_ID: ReadonlyMap<string, CosmeticItem> = new Map(COSMETIC_ITEMS.map((i) => [i.id, i]));

export function cosmeticItem(id: string): CosmeticItem | undefined {
  return BY_ID.get(id);
}

export function cosmeticType(id: CosmeticTypeId): CosmeticType {
  const t = COSMETIC_TYPES.find((x) => x.id === id);
  if (!t) throw new Error(`bilinmeyen kozmetik türü: ${id}`);
  return t;
}

/** Bir türün ürünleri (katalog sırasıyla). */
export function itemsOfType(type: CosmeticTypeId): CosmeticItem[] {
  return COSMETIC_ITEMS.filter((i) => i.type === type);
}

// ---- Giysi yuvaları, kemik eşlemesi, kostüm kuralı ----

/** Giysi türü mü (şapka, üst, alt, ayakkabı, aksesuar, kostüm)? */
export const isClothingType = (type: CosmeticTypeId): boolean => cosmeticType(type).group === "giysi";

/**
 * Giysi yuvalarının çizim sırası (arkadan öne), AYNI kemiğe bağlı parçalar arasında: kostüm en altta, sonra alt,
 * ayakkabı, üst; aksesuar üstün ÜSTÜNDE, şapka en üstte. (Farklı kemiklerde sıra gövdenin çizim sırasıdır;
 * `arka` katmanı her yuvada gövdenin arkasına çizilir.)
 */
export const GIYSI_SIRASI: readonly CosmeticTypeId[] = [
  "kostum",
  "alt",
  "ayakkabi",
  "ust",
  "aksesuar",
  "sapka",
];

/** Kemik adı -> o kemikteki giysinin yuvası. Kostümün kapladığı yuvalar parçalarının kemiklerinden türer. */
export function slotOfBone(bone: string): CosmeticTypeId | null {
  if (bone === "head") return "sapka";
  if (bone === "torso" || /_(upper_arm|forearm|hand)$/.test(bone)) return "ust";
  if (/_(thigh|shin)$/.test(bone)) return "alt";
  if (/_foot$/.test(bone)) return "ayakkabi";
  return null;
}

/** Kemik listesinin kapladığı yuvalar (`GIYSI_SIRASI` sırasıyla, tekil). Aksesuar hiç kaplanmaz. */
export function coveredSlots(bones: readonly string[]): CosmeticTypeId[] {
  const set = new Set(bones.map(slotOfBone));
  return GIYSI_SIRASI.filter((t) => set.has(t));
}

// ---- Giysi renkleri ----

export type ClothingColourId = "camgobegi" | "pembe" | "altin" | "yesil" | "mor";

export interface ClothingColour {
  id: ClothingColourId;
  name: string;
  /** Oyunun neon renk jetonu (`tokens.css`): camgöbeği, magenta, amber, lime, violet. */
  hex: string;
}

export const CLOTHING_COLOURS: readonly ClothingColour[] = [
  { id: "camgobegi", name: "Camgöbeği", hex: "#2EF2FF" },
  { id: "pembe", name: "Pembe", hex: "#FF2BD6" },
  { id: "altin", name: "Altın", hex: "#FFC23B" },
  { id: "yesil", name: "Yeşil", hex: "#B6FF3B" },
  { id: "mor", name: "Mor", hex: "#8B5CFF" },
];

/** Çizildiği gibi renk: kuşanılan değerde yazılmaz (`kimlik`). */
export const DEFAULT_COLOUR: ClothingColourId = "camgobegi";

/**
 * Renk iş kuralı (sahip kararı bekliyor): "free" = ürüne sahip olmak tüm renkleri açar, renk Dolabım'da ücretsiz
 * seçilir. "paid" = varsayılan dışındaki her renk ayrı satın alınır (sahip olunan `kimlik~renk` ürünü). Yalnız
 * `colourUnlocked` bu sabite bakar; "paid"e geçmek için ek olarak mağazaya renk ürünleri eklenmelidir.
 */
export type ColourMode = "free" | "paid";
export const COLOUR_MODE: ColourMode = "free";

export const clothingColour = (id: string): ClothingColour | undefined =>
  CLOTHING_COLOURS.find((c) => c.id === id);

/** Kuşanılan değer: `kimlik` ya da `kimlik~renk`. */
export interface Equipped {
  id: string;
  colour: ClothingColourId;
}

/** Değeri ayırır; rengi bilinmiyorsa ya da biçim bozuksa null (kimliğin katalogda olması burada aranmaz). */
export function splitEquipped(value: string): Equipped | null {
  const i = value.indexOf("~");
  if (i < 0) return value.length > 0 ? { id: value, colour: DEFAULT_COLOUR } : null;
  const id = value.slice(0, i);
  const colour = clothingColour(value.slice(i + 1));
  return id.length > 0 && colour ? { id, colour: colour.id } : null;
}

/** Kuşanılan değerin kanonik yazımı: varsayılan renk yazılmaz. */
export const equippedValue = (id: string, colour: ClothingColourId = DEFAULT_COLOUR): string =>
  colour === DEFAULT_COLOUR ? id : `${id}~${colour}`;

/**
 * Bir yuvaya yazılacak/okunan değeri doğrular ve kanonik biçime getirir. Ürün katalogda ve bu türde olmalı; renk
 * yalnız giysi türlerinde ve bilinen renklerden olabilir. Geçersizse null.
 */
export function cleanEquipped(type: CosmeticTypeId, value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const e = splitEquipped(value);
  if (!e) return null;
  const it = BY_ID.get(e.id);
  if (!it || it.type !== type) return null;
  if (value.includes("~") && !isClothingType(type)) return null;
  return equippedValue(e.id, e.colour);
}

/** Bu renk bu hesapta açık mı? `owns(kimlik)`: ürüne sahiplik. "free": ürüne sahip olmak yeter. */
export function colourUnlocked(
  owns: (itemId: string) => boolean,
  id: string,
  colour: ClothingColourId,
): boolean {
  if (!owns(id)) return false;
  if (colour === DEFAULT_COLOUR || COLOUR_MODE === "free") return true;
  return owns(`${id}~${colour}`);
}

/** Kuşanılanları oyunculara giden `Cosmetics` alanına çevirir; bilinmeyen/yanlış türdeki değer atlanır. */
export function cosmeticsFromEquipped(equipped: Readonly<Record<string, string>>): Cosmetics | undefined {
  const out: Cosmetics = {};
  for (const t of COSMETIC_TYPES) {
    if (t.key === null) continue;
    const v = cleanEquipped(t.id, equipped[t.id]);
    if (v !== null) out[t.key] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Ağdan gelen `cosmetics` alanını doğrular: yalnız katalogda olan ve doğru türdeki kimlikler (giysilerde bilinen
 * renkle) kalır, gerisi atılır. Hiçbir şey kalmadıysa `undefined`.
 */
export function parseCosmetics(raw: unknown): Cosmetics | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const out: Cosmetics = {};
  for (const t of COSMETIC_TYPES) {
    if (t.key === null) continue;
    const v = cleanEquipped(t.id, rec[t.key]);
    if (v !== null) out[t.key] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ---- Resimli ürün dosyaları ----

/** Zafer kutlamasının parçacık görseli sayısı ve tepki paketinin çıkartma sayısı. */
export const CELEBRATION_SPRITES = 4;
export const STICKERS_PER_PACK = 6;

/** Ürünün `public/assets/shop/` altındaki tüm görselleri (göreli yol); resimsiz türlerde boş. */
export function cosmeticAssetFiles(it: CosmeticItem): string[] {
  const a = it.asset;
  if (!a) return [];
  const nth = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);
  switch (it.type) {
    case "kart-arkasi":
      return [`kart-arkasi/${a}.webp`];
    case "zafer":
      return nth(CELEBRATION_SPRITES).map((n) => `zafer/${a}-${n}.webp`);
    case "tepki":
      return nth(STICKERS_PER_PACK).map((n) => `tepki/${a}-${n}.webp`);
    case "giris":
      return [`giris/${a}-zemin.webp`, `giris/${a}-isik.webp`];
    default:
      return [];
  }
}

/** Çıkartmaların ekran okuyucu adları (paket kimliği -> 6 ad, görsel sırasıyla). */
export const STICKER_NAMES: Readonly<Record<string, readonly string[]>> = {
  "neon-yuzler": ["Gülüyor", "Şaşkın", "Sinirli", "Ağlıyor", "Göz kırpıyor", "Uykulu"],
  parti: ["Parti şapkası", "Disko topu", "Kadeh tokuşturma", "Havai fişek", "Dans eden avatar", "Alkış"],
  "efsane-tepkiler": ["Altın taç", "Ateş topu", "Mikrofonu bırak", "Roket", "Elmas", "Şimşekli kupa"],
  hayvanlar: [
    "Gülen kedi",
    "Şaşkın baykuş",
    "Uykucu panda",
    "Kızgın tavuk",
    "Göz kırpan tilki",
    "Ağlayan köpek",
  ],
  "oyun-ani": ["Düşünüyorum", "Ter damlası", "Kum saati", "Şans yoncası", "Zar", "Tam isabet"],
  kozmik: ["Gezegen", "Kuyruklu yıldız", "UFO", "Astronot kaskı", "Kara delik", "Yıldız patlaması"],
};

/** Tepki paketi çıkartmasının kimliği: `pack:<paketKimliği>:<1..6>` (`react` ve `reaction` mesajlarında). */
export type StickerId = `pack:${string}:${number}`;

export interface StickerRef {
  /** Paket ürünü (`tepki` türü). */
  item: CosmeticItem;
  /** 1..STICKERS_PER_PACK */
  n: number;
}

/** Çıkartma kimliğini çözer; biçim, paket ya da sıra katalogda yoksa null (ağdan gelen veri). */
export function parseStickerId(raw: unknown): StickerRef | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  const m = /^pack:([a-z]+(?:-[a-z]+)*):([1-9])$/.exec(raw);
  if (!m) return null;
  const item = COSMETIC_ITEMS.find((i) => i.type === "tepki" && i.asset === m[1]);
  const n = Number(m[2]);
  return item && n >= 1 && n <= STICKERS_PER_PACK ? { item, n } : null;
}

export const stickerId = (item: CosmeticItem, n: number): StickerId => `pack:${item.asset ?? ""}:${n}`;

/** Çıkartmanın görsel yolu (`/assets/shop/` altında). */
export const stickerFile = (ref: StickerRef): string => `tepki/${ref.item.asset ?? ""}-${ref.n}.webp`;

// ---- Günün fırsatı ----

const DAY_MS = 24 * 3600 * 1000;
const ISTANBUL_OFFSET_MS = 3 * 3600 * 1000;

/** Fırsattaki ürün sayısı ve indirim oranı (yüzde). */
export const DEAL_COUNT = 2;
export const DEAL_DISCOUNT_PERCENT = 30;

/** İstanbul takvim günü numarası (1970-01-01 = 0). Türkiye yıl boyu UTC+3. */
export function istanbulDayNumber(ms: number): number {
  return Math.floor((ms + ISTANBUL_OFFSET_MS) / DAY_MS);
}

/** Sonraki İstanbul gece yarısı (UTC ms); fırsat o ana kadar geçerlidir. */
export function nextIstanbulMidnight(ms: number): number {
  return (istanbulDayNumber(ms) + 1) * DAY_MS - ISTANBUL_OFFSET_MS;
}

/** İndirimli fiyat: liste fiyatının %70'i, en yakın 5'e yuvarlanır. */
export function dealPrice(listPrice: number): number {
  return Math.round((listPrice * (100 - DEAL_DISCOUNT_PERCENT)) / 100 / 5) * 5;
}

export interface DailyDeal {
  itemId: string;
  /** İndirimli fiyat. */
  price: number;
  /** Liste fiyatı (üstü çizili gösterilir). */
  listPrice: number;
}

/**
 * O İstanbul gününün fırsatları: ücretli ürünlerden gün numarasıyla tohumlanan karıştırmadan ilk `DEAL_COUNT`
 * tanesi (farklı). Aynı gün her yerde aynı sonucu verir.
 */
/**
 * Geçiş dönemi: canlıdaki eski uygulama (önbellekteki PWA) günün fırsatını kendi küçük kataloğundan hesaplar. Katalog
 * büyüdüğü için sunucu başka ürün seçerse oyuncu indirimli gördüğü ürüne tam fiyat öder. Bu tarihe dek fırsat havuzu
 * eski katalogdaki ücretli ürünlerdir (aynı sırayla); eski ve yeni istemci aynı fırsatı gösterir.
 */
export const LEGACY_DEAL_POOL: readonly string[] = [
  "unvan-parti-canavari",
  "unvan-sessiz-tehlike",
  "unvan-sansli",
  "unvan-taktikci",
  "unvan-bluf-ustasi",
  "unvan-son-saniyeci",
  "unvan-efsane",
  "ad-neon-mavi",
  "ad-neon-pembe",
  "ad-gokkusagi",
  "ad-kivilcim",
  "ad-altin-parilti",
  "cerceve-camgobegi",
  "cerceve-pembe",
  "cerceve-cift",
  "cerceve-donen-neon",
  "cerceve-altin-tac",
];
/** Geçişin bittiği an: 12 Kasım 2026 00:00 İstanbul. */
export const LEGACY_DEAL_POOL_UNTIL = Date.UTC(2026, 10, 11, 21, 0, 0);

export function dailyDeals(ms: number): DailyDeal[] {
  const paid =
    ms < LEGACY_DEAL_POOL_UNTIL
      ? LEGACY_DEAL_POOL.flatMap((id) => {
          const it = BY_ID.get(id);
          return it && it.price > 0 ? [it] : [];
        })
      : COSMETIC_ITEMS.filter((i) => i.price > 0);
  const rng = createRng(Math.imul(istanbulDayNumber(ms), 0x9e3779b1) ^ 0x51ed270b);
  return rng
    .shuffle(paid)
    .slice(0, DEAL_COUNT)
    .map((i) => ({ itemId: i.id, price: dealPrice(i.price), listPrice: i.price }));
}

/** Ürünün o anda geçerli fiyatı (fırsattaysa indirimli); ürün yoksa null. */
export function currentPrice(itemId: string, ms: number): number | null {
  const it = BY_ID.get(itemId);
  if (!it) return null;
  return dailyDeals(ms).find((d) => d.itemId === itemId)?.price ?? it.price;
}
