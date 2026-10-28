/**
 * Kart kataloğu (docs/KURALLAR.md "0. Maç düzeyi kuralları: Kartlar", K5). Kimlikler sabittir:
 * istemci görselleri `/assets/cards/<kimlik>.webp` yolundan okunur.
 */

export const CARD_RARITIES = ["siradan", "nadir", "efsanevi", "kotu"] as const;
export type CardRarity = (typeof CARD_RARITIES)[number];

/** Bir kartın hedef türü: yok, başka bir oyuncu, başka bir oyuncu ya da kendin, listeden bir oyun. */
export type CardTarget = "none" | "player" | "playerOrSelf" | "game";

export interface CardDef {
  id: string;
  name: string;
  /** Kartın yüzündeki metin (kural dosyasındaki söz); adın ardından okunur. */
  text: string;
  rarity: CardRarity;
  target: CardTarget;
  /** Saldırı kartı (⚔): herkese açık oynanır; Koruma, Ayna ve Açık Hedef bunlarla etkileşir. */
  attack: boolean;
  /** Ayna ve Koruma: tetiklenene kadar herkese gizli kalır. */
  hidden: boolean;
}

const def = <I extends string>(
  id: I,
  name: string,
  text: string,
  rarity: CardRarity,
  extra: Partial<Pick<CardDef, "target" | "attack" | "hidden">> = {},
): CardDef & { id: I } => ({
  id,
  name,
  text,
  rarity,
  target: "none",
  attack: false,
  hidden: false,
  ...extra,
});

const LIST = [
  def("kalkan", "Kalkan", "Eksiye düşersen 0 sayılır", "siradan"),
  def("sigorta", "Sigorta", "Sonuncu olursan +1", "siradan"),
  def("takviye", "Takviye", "Oyun sonunda +1", "siradan"),
  def("kendine-guven", "Kendine Güven", "Birinci olursan +2, olamazsan −1", "siradan"),
  def("tahmin", "Tahmin", "Bir oyuncu seç; o birinci olursa +2", "siradan", { target: "player" }),
  def(
    "ortaklik",
    "Ortaklık",
    "Seçtiğin oyuncuyla bu oyundaki puanlarınızın toplamı ikinize eşit bölünür",
    "siradan",
    { target: "player" },
  ),
  def("koruma", "Koruma", "Seçtiğin oyuncuya (ya da kendine) bu oyunda saldırı kartı işlemez", "siradan", {
    target: "playerOrSelf",
    hidden: true,
  }),
  def("ayna", "Ayna", "Sana oynanan ilk saldırı saldırana döner", "siradan", { hidden: true }),
  def("vergi", "Vergi", "Seçtiğin oyuncu puan alırsa 1 puanı sana geçer", "siradan", {
    target: "player",
    attack: true,
  }),
  def("celme", "Çelme", "Seçtiğin oyuncu −1", "siradan", { target: "player", attack: true }),
  def("veto", "Veto", "Sıradaki oyunlardan birini listeden çıkar", "siradan", { target: "game" }),
  def("genis-secim", "Geniş Seçim", "Bir sonraki kart seçiminde 4 kart görürsün", "siradan"),

  def("cift-puan", "Çift Puan", "Puanın ×2 (eksi de ×2)", "nadir"),
  def("takas", "Takas", "Oyun sonunda seçtiğin oyuncuyla bu oyunun puanlarınızı değiştirin", "nadir", {
    target: "player",
  }),
  def("oyunu-sec", "Sıradaki Oyunu Seç", "Bir sonraki mini oyunu sen belirlersin", "nadir", {
    target: "game",
  }),
  def("lanet", "Lanet", "Seçtiğin oyuncu bu oyundan artı puan alamaz", "nadir", {
    target: "player",
    attack: true,
  }),
  def("hirsiz", "Hırsız", "Bu oyunun birincisinden 1 puan al", "nadir", { attack: true }),
  def("kart-cal", "Kart Çal", "Seçtiğin oyuncunun elindeki rastgele bir kartı al", "nadir", {
    target: "player",
    attack: true,
  }),

  def("altin-dokunus", "Altın Dokunuş", "Puanın ×3 (eksi etkilenmez)", "efsanevi"),
  def("ters-kose", "Ters Köşe", "Bu oyunun sıralaması tamamen tersine döner", "efsanevi"),

  def("talihsizlik", "Talihsizlik", "Sonraki oyunda −1", "kotu"),
  def("agir-yuk", "Ağır Yük", "Sonraki oyunda puanın yarıya iner", "kotu"),
  def("hayirsever", "Hayırsever", "Sonraki oyunda puan alırsan 1'i sonuncuya gider", "kotu"),
  def("acik-hedef", "Açık Hedef", "Sonraki oyunda sana oynanan saldırılar iki kat etkili", "kotu"),
  def("bos-el", "Boş El", "Elindeki rastgele bir kart yanar", "kotu"),
  def("kor-secim", "Kör Seçim", "Bir sonraki seçimde kartlar ters gelir, görmeden seçersin", "kotu"),
  def("sessizlik", "Sessizlik", "Bir sonraki kart seçimini kaçırırsın", "kotu"),
  def("kumarbaz", "Kumarbaz", "Sonraki oyunda −2, ama bir sonraki seçimde 2 kart alırsın", "kotu"),
  def(
    "lanetli-hediye",
    "Lanetli Hediye",
    "Sonraki oyunda −1, ama bir sonraki seçimde nadir ve efsanevi kart çıkma şansın artar",
    "kotu",
  ),
] as const;

export type CardId = (typeof LIST)[number]["id"];

export const CARD_IDS: readonly CardId[] = LIST.map((c) => c.id);

export const CARDS: Readonly<Record<CardId, CardDef>> = Object.fromEntries(
  LIST.map((c) => [c.id, c]),
) as Record<CardId, CardDef>;

export function isCardId(value: unknown): value is CardId {
  return typeof value === "string" && Object.hasOwn(CARDS, value);
}

export const isBadCard = (id: CardId): boolean => CARDS[id].rarity === "kotu";

/** Elmas sayısı (renk körleri için nadirlik işareti): sıradan 1, nadir 2, efsanevi 3, kötü 0 (kırık elmas). */
export const CARD_GEMS: Readonly<Record<CardRarity, number>> = { siradan: 1, nadir: 2, efsanevi: 3, kotu: 0 };

/** Elin en çok tutabileceği kart. */
export const MAX_HAND = 2;
/** Kart seçimi süresi (ms). */
export const CARDS_MS = 25_000;
/** Bağlı herkes seçimini bitirince aşamanın kapanmasına kalan süre (ms). */
export const CARDS_DONE_GRACE_MS = 1_000;
/** Her N mini oyundan sonra kart seçimi gelir. */
export const CARD_PHASE_EVERY = 3;
/** Seçenek sayısı; Geniş Seçim ile 4. */
export const BASE_OPTIONS = 3;
export const WIDE_OPTIONS = 4;

/** Lobi ayarı: ana anahtar ve kapatılan kartlar. */
export interface CardSettings {
  enabled: boolean;
  /** Kapalı kartların kimlikleri (sıralı, tekrarsız). */
  off: CardId[];
}

export const DEFAULT_CARD_SETTINGS: CardSettings = { enabled: true, off: [] };

/** Ayara göre etkin kartlar (katalog sırasıyla). Ana anahtar kapalıysa boş. */
export function enabledCards(settings: CardSettings): CardId[] {
  return settings.enabled ? CARD_IDS.filter((id) => !settings.off.includes(id)) : [];
}

/** Ağdan gelen kart ayarını doğrular; geçersizse null. Kapalı liste sıralanır ve tekrarsızlaştırılır. */
export function parseCardSettings(raw: unknown): CardSettings | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== 2 || !keys.includes("enabled") || !keys.includes("off")) return null;
  if (typeof o.enabled !== "boolean" || !Array.isArray(o.off) || o.off.length > CARD_IDS.length) return null;
  const off = new Set<CardId>();
  for (const id of o.off) {
    if (!isCardId(id) || off.has(id)) return null;
    off.add(id);
  }
  return { enabled: o.enabled, off: CARD_IDS.filter((id) => off.has(id)) };
}
