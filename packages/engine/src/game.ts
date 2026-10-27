import type { Rng } from "./rng.js";

/** Odanın içerik tonu: oyunların metin havuzlarını (soru, konu) seçmesi için. Host lobide seçer. */
export const CONTENT_TONES = ["aile", "arkadas", "ofis"] as const;
export type ContentTone = (typeof CONTENT_TONES)[number];
/** Host ton seçmediyse kullanılan ton. */
export const DEFAULT_CONTENT_TONE: ContentTone = "arkadas";

/** Ekranda gösterilen ton adları (arayüz metni). */
export const CONTENT_TONE_LABELS: Record<ContentTone, string> = {
  aile: "Aile",
  arkadas: "Arkadaş",
  ofis: "Ofis",
};

export function isContentTone(value: unknown): value is ContentTone {
  return typeof value === "string" && (CONTENT_TONES as readonly string[]).includes(value);
}

/** Oyun fonksiyonlarına sunucunun verdiği bağlam. `now` sunucu saatidir (ms). */
export interface GameContext {
  now: number;
  rng: Rng;
  /**
   * Şu an bağlı katılımcılar (sıralı, katılım sırasıyla). Bağlantısı kopan oyuncu katılımcı olmaya devam eder;
   * oyun kuralı gerektiriyorsa (ör. pas hedefi, sıra) bunu dikkate alır. Değişimler `GameLog.presence`'a yazılır.
   */
  connected: readonly string[];
  /**
   * Odanın içerik tonu. Yalnız `setup` okur (içerik havuzunu seçmek için); `reduce`/`tick`/görünüm fonksiyonlarına
   * verilmez. Ton oyunun başında sabitlenir ve `GameLog.tone`'a yazılır, böylece `replay` aynı havuzu kurar.
   * Tonu önemsemeyen oyun yok sayar; verilmediyse (eski kayıt, test) oyun kendi varsayılanını kullanır.
   */
  tone?: ContentTone;
}

export interface Rejected {
  rejected: string;
}

export function isRejected(value: unknown): value is Rejected {
  return typeof value === "object" && value !== null && "rejected" in value;
}

/** Oyun öncesi tam ekran anlatım: kısa amaç + en fazla 3 madde. */
export interface Briefing {
  goal: string;
  steps: readonly string[];
}

export interface GameResult {
  /** Mini oyun içi puanlar. */
  miniScores: Record<string, number>;
  /** Genel skora eklenecek puanlar (kural dosyasındaki aktarım). */
  awards: Record<string, number>;
}

/**
 * Bir mini oyun saf fonksiyonlardan oluşur. Durum değiştirilmez; her çağrı yeni durum döner.
 * İstemciye yalnız `publicView` ve `view` çıktısı gider: gizli bilgi yalnız hak sahibinin `view`'ına konur.
 */
export interface GameDefinition<State, Action, View, PublicView = unknown> {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  orientation: "portrait" | "landscape";
  briefing: Briefing;
  /**
   * `false`: oyun rastgele seçime girmez; yalnız host elle seçebilir (ör. onay bekleyen yeni oyun).
   * Verilmezse (varsayılan) oyun rastgele havuzdadır. Havuzu sunucu `pickRandomGames` uygular.
   */
  randomPool?: false;
  /** Ağdan gelen ham eylemi doğrular; geçersizse null. */
  parseAction(raw: unknown): Action | null;
  setup(players: readonly string[], ctx: GameContext): State;
  /**
   * Oyunun bitiş anından sonra (`isFinished` tick ile henüz fark edilmemiş olsa bile) gelen eylemi
   * reddetmek zorundadır; aksi halde sonuç tick zamanlamasına bağlı kalır.
   */
  reduce(state: State, playerId: string, action: Action, ctx: GameContext): State | Rejected;
  /**
   * Zamana bağlı ilerleme; sunucu düzenli aralıklarla çağırır. Değişiklik yoksa aynı nesneyi döner.
   * `ctx.connected`'a bakmaz (yalnız `setup` ve `reduce` bakabilir); böylece kayıttan tekrar oynatma birebir aynı kalır.
   */
  tick(state: State, ctx: GameContext): State;
  /**
   * Herkese açık görünüm: odadaki herkes (izleyici dahil) için aynıdır ve oda başına bir kez hesaplanır.
   * Gizli bilgi içeremez. Herkesin gördüğü her şey (skorlar, süreler, açık olaylar) buraya konur.
   */
  publicView(state: State, ctx: GameContext): PublicView;
  /**
   * Kişiye özel görünüm: yalnız bu oyuncunun bilmesi gerekenler (kendi gizli bilgisi, kendi durumu).
   * Herkese açık görünümde olanı tekrar etmez. playerId null ise izleyicinin özel görünümü.
   */
  view(state: State, playerId: string | null, ctx: GameContext): View;
  isFinished(state: State, ctx: GameContext): boolean;
  result(state: State): GameResult;
  /**
   * Durumdaki gizli bilgiler. Sızıntı testi, `publicView` çıktısında ve `ownerIds` dışındaki her oyuncunun
   * (ve izleyicinin) `view` çıktısında `value`'nun geçmediğini doğrular. Gizli bilgisi olmayan oyun boş dizi döner.
   */
  secrets(state: State): readonly SecretEntry[];
  /**
   * İsteğe bağlı, yalnız sıra tabanlı oyunlar için: şu an "sıra kimde" ise onların kimlikleri (çoğunlukla tek kişi).
   * Sunucu bunu yalnız arka plandaki oyunculara "Sıra sende!" bildirimi göndermek için okar; sonuç hiçbir yere
   * kaydedilmez ve oyunun gidişini etkilemez. Yalnız herkesin zaten gördüğü bilgiyi (kimin sırası olduğunu) kullanır;
   * gizli bilgi taşımaz. Durumu değiştirmez; zamana bağlıysa `ctx.now` kullanır.
   */
  notify?(state: State, ctx: GameContext): readonly string[];
}

export interface SecretEntry {
  /** Bu bilgiyi görmeye hakkı olan oyuncular (boş: kimse, oyun bitene kadar). */
  ownerIds: readonly string[];
  /** Görünümde metin olarak aranacak değer; en az 3 karakter, ayırt edici olmalı. */
  value: string;
  /** Hata mesajı için kısa açıklama. */
  label: string;
}

/** Bir oyunun deterministik tekrar oynatılması için kayıt. */
export interface GameLog {
  gameId: string;
  seed: number;
  players: string[];
  startedAt: number;
  /** Zaman sıralı; yalnız kabul edilen eylemler. */
  actions: { t: number; playerId: string; action: unknown }[];
  endedAt: number;
  /** Bağlantı değişimleri (zaman sıralı); `replay` her eylem ve tick öncesi bağlı listesini buna göre kurar. */
  presence: { t: number; playerId: string; connected: boolean }[];
  /** `setup`a verilen oda tonu; yoksa (eski kayıt) `setup` tonsuz çağrılır. */
  tone?: ContentTone;
  /** Eylem sınırı aşıldığı için kayıt eksik: `replay` bu kaydı reddeder. */
  truncated?: boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: kayıt defteri farklı tipte oyunları birlikte tutar.
export type AnyGame = GameDefinition<any, any, any, any>;
