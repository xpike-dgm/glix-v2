import type { ResolveInput } from "./cards/resolve.js";
import type { ContentSet } from "./content.js";
import type { Rng } from "./rng.js";

/**
 * Eski kayıtlardaki oda tonu. Ton özelliği kaldırıldı (sahip kararı); yeni maçlar ton taşımaz.
 * Yalnız ton taşıyan eski `GameLog`'ların `replay`i için okunur.
 */
export type LegacyContentTone = "aile" | "arkadas" | "ofis";

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
   * Yalnız ton taşıyan ESKİ kayıtların `replay`i için: sunucu yeni maçlarda vermez. Verilirse `setup` kaydın
   * kurulduğu eski ton havuzunu kullanır (aynı durum yeniden kurulur); tonu önemsemeyen oyun yok sayar.
   */
  tone?: LegacyContentTone;
  /**
   * Yöneticinin değiştirdiği içerik havuzları (kimlik -> etkin girdiler). Yalnız `setup` okur (`poolEntries`);
   * oyun seçtiği girdiyi durumuna yazar. Verilmezse ya da havuz yoksa yerleşik havuz kullanılır. `GameLog.content`'e yazılır.
   */
  content?: ContentSet;
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
  /**
   * Yalnız sunucu muhasebesi (rozetler): oyuncu kimliği -> sayaç adı -> değer. İstemciye ASLA gönderilmez
   * (sunucu `match.ts` anlık görüntüde ayıklar). Saf ve belirleyici olmalı; oyun kuralını etkilemez.
   */
  stats?: Record<string, Record<string, number>>;
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
  /**
   * İsteğe bağlı "geç gelen eylem payı" (ms; docs/KURALLAR.md). Verilirse sunucu bu oyuna `setup` dışında
   * gerçek saat yerine `gameClock` ile gecikmeli saati (`ctx.now`) verir: süreye bağlı her geçiş ve bitiş
   * (tick, `reduce` reddi, `isFinished`) `graceMs` kadar geç gerçekleşir, böylece süre dolmadan gönderilip ağ
   * gecikmesiyle biraz geç ulaşan eylem kabul edilir. İstemci süreyi yine özgün `endsAt`'ten gösterir.
   * Oyun kodu değişmez; yalnız zamanlamayı puanlayan (tepki/ritim/bekleme) oyunlar bunu KULLANMAZ.
   */
  graceMs?: number;
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
  /**
   * İsteğe bağlı: `state` kendiliğinden (eylem gelmeden, yalnız zamanla) en erken hangi mutlak anda değişir
   * (`tick` çıktısı ya da görünüm farklı olur, oyun biter)? `ctx.now`'dan sonraki an ya da yok ise null.
   * Sunucu bu ana tam zamanlı bir uyandırma kurar; böylece görünür geçişler 100 ms'lik tick'i beklemez. Yalnız
   * yayın gecikmesini azaltır: oyunun sonucu tick zamanlamasından bağımsız kalmak zorundadır (sunucu aynı
   * `tick`/`isFinished`'i çağırır), bu yüzden kural değiştirmez. Saf olmalı, `ctx.connected`'a bakmamalı.
   */
  nextWake?(state: State, ctx: GameContext): number | null;
  /**
   * Oyunun son sonuç açılışı (oyun içi sonuç ekranı; docs/ERKEN-BITIS.md "Oyun içi sonuç ekranı"): açılışın başladığı
   * (ya da başlayacağı belli olan) an, oyun saatiyle; henüz belli değilse null. Sözleşme: açılış başladıktan sonra
   * `result` değişmez ve bu an kaymaz; `isFinished`'in true olduğu an açılış animasyonunun bittiği andır. Sunucu,
   * açılış başlayınca ekranda "Devam et" düğmesini açar ve oyunu `isFinished`'ten sonra da açık tutar: bağlı
   * katılımcıların hepsi bastığında (`CONTINUE_GRACE_MS` payıyla, animasyon bitmeden değil) ya da açılış başından
   * `REVEAL_HOLD_MS` sonra biter. Yalnız bitiş zamanlamasını etkiler; kural, puan ve gizlilik değişmez. Saf olmalı,
   * `ctx.connected`'a bakmamalı. Verilmezse oyun `isFinished` anında biter (eski davranış).
   */
  revealAt?(state: State, ctx: GameContext): number | null;
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
  /** Yalnız eski kayıtlarda bulunur (ton özelliği kaldırıldı): `replay` `setup`a aynen verir, yeni kayıt yazmaz. */
  tone?: LegacyContentTone;
  /** `setup`a verilen içerik havuzları; yoksa yerleşik havuzlar. `replay` aynısını verir. */
  content?: ContentSet;
  /**
   * Bu oyunun kart hesabının girdileri (kartlar açıksa): `replayWithCards` ham sonuca uygulayıp nihai puanları
   * birebir yeniden üretir. Ham `miniScores` / `awards` buraya yazılmaz; `replay` onları üretir.
   */
  cards?: Omit<ResolveInput, "miniScores" | "awards" | "participants">;
  /** Eylem sınırı aşıldığı için kayıt eksik: `replay` bu kaydı reddeder. */
  truncated?: boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: kayıt defteri farklı tipte oyunları birlikte tutar.
export type AnyGame = GameDefinition<any, any, any, any>;

/**
 * Oyun içi sonuç açılışının en uzun süresi (ms; açılış başından). Bağlı katılımcıların hepsi "Devam et" derse daha
 * erken biter (bkz. `GameDefinition.revealAt`). Sahip süreyi değiştirmek isterse yalnız bu sabit değişir.
 */
export const REVEAL_HOLD_MS = 60_000;

/** Geç gelen eylem payı (ms): `graceMs` alan oyunlarda süre bitişi bu kadar gecikir. */
export const LATE_ACTION_GRACE_MS = 250;

/**
 * Oyun saati: `setup` gerçek an `startedAt`'ta çalışır (mutlak bitiş zamanları gerçek koordinatta kalır), sonrası
 * `max(startedAt, now - graceMs)`. `graceMs` yoksa/0 ise gerçek saatin kendisi. Tek yerde tanımlıdır; sunucu ve
 * simülasyon aynı işlevi kullanır.
 */
export function gameClock(startedAt: number, now: number, graceMs: number | undefined): number {
  return graceMs === undefined || graceMs <= 0 ? now : Math.max(startedAt, now - graceMs);
}
