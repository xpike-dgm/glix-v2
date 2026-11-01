/** Rus Ruleti — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §7, docs/A6-OYUNLAR.md. */

/** Patlama riski (yüzde): başlangıç, güvenli atış başına artış ve tavan. */
export const RUS_RULETI_START_RISK = 16;
export const RUS_RULETI_RISK_STEP = 10;
export const RUS_RULETI_MAX_RISK = 76;
/** Karar süresi (ms); açılış penceresi bittiğinde başlar. */
export const RUS_RULETI_DECISION_MS = 18_000;
/** RR-M4: silah bağlantısı kopuk birindeyse karar süresi (ms). */
export const RUS_RULETI_OFFLINE_DECISION_MS = 6_000;
/**
 * Her atıştan sonra sonuç animasyonu için bekleme (ms); bu sürede eylem kabul edilmez. RR-U5: 1,2 sn tambur dönüşü +
 * 2,3 sn sonuç.
 */
export const RUS_RULETI_OPEN_MS = 3_500;
/** RR-U5: istemcide sonucu geciktiren tambur dönüşü (ms). Kural değildir; sonuç atış anında sunucuda belirlenir. */
export const RUS_RULETI_SPIN_MS = 1_200;
/** RR-U9: oyunun ilk kararı "SİLAH SENDE!" bandı kadar uzun açılır (ms). */
export const RUS_RULETI_FIRST_BAND_MS = 800;
/** RR-M3: patlamadan sonra (sonuç beklemesinin ardından) elenenin "son söz" süresi (ms). */
export const RUS_RULETI_LAST_WORD_MS = 4_000;
/** RR-M3: elenen seçimini yapınca yeni sahibin karar penceresi bu kadar sonra açılır (ms). */
export const RUS_RULETI_LAST_WORD_AFTER_MS = 500;
/** RR-U8: oyun içi son açılışın en az gösterim süresi (son atıştan itibaren, ms). */
export const RUS_RULETI_OUTRO_MS = 6_000;

/** "Kâhin" rozeti için gereken en az doğru "Evet, patlar" tahmini (O9); ayrıca "Evet"lerin en az yarısı doğru olmalı. */
export const RUS_RULETI_KAHIN_MIN_CORRECT = 1;

/**
 * Eylemler:
 * - `shoot`: silah sahibi hedefe ateş eder.
 * - `pass` (RR-M3): patlamayla elenen, "son söz" süresinde silahı hayatta birine verir.
 * - `predict` (O9): elenen izleyici, sıradaki atışın (`turn` = o ana kadarki atış sayısı) patlayıp patlamayacağını
 *   tahmin eder. Tahmin gizlidir, atış başına bir kez verilir ve değişmez; puan vermez.
 */
export type RusRuletiAction =
  | { kind: "shoot"; target: string }
  | { kind: "pass"; to: string }
  | { kind: "predict"; turn: number; explodes: boolean };

/** Son atış: herkes görür (patlama atış anında belirlenir, önceden gizli değer yoktur). */
export interface RusRuletiShot {
  /** 1'den başlayan atış sırası. */
  seq: number;
  shooter: string;
  target: string;
  /** Süre dolduğu için sunucu ateş etti. */
  auto: boolean;
  exploded: boolean;
  /** Atış anındaki risk (yüzde). */
  risk: number;
  /** Atışın sunucu zamanı (ms). */
  at: number;
}

export interface RusRuletiResult {
  /** Hayatta kalanlar (+1). */
  survivors: string[];
  /** Elenenler, elenme sırasıyla (0). */
  eliminated: string[];
  /** O9: "Kâhin" rozeti alanlar (patlamayı bilenler). Yalnız mini oyun bitince herkese açılır; puan vermez. */
  kahinler: string[];
}

/** Elenen oyuncunun son çözülen tahmininin sonucu (yalnız sahibine gider). */
export interface RusRuletiPredictionResult {
  turn: number;
  correct: boolean;
}

/** RR-M3: bekleyen son söz (herkese açık; seçim seçilene kadar yalnız elenenin ekranındadır). */
export interface RusRuletiLastWord {
  /** Elenen (silahı verecek olan). */
  from: string;
  /** Seçimin açıldığı an (sonuç beklemesinin sonu). */
  opensAt: number;
  /** Seçilmezse bu anda silah rastgele birine gider. */
  endsAt: number;
}

/** RR-M3: son patlamadan sonra silahın kime verildiği; bir sonraki atışa kadar herkese açıktır. */
export interface RusRuletiHandoff {
  from: string;
  to: string;
  /** Elenen kendisi seçti (false: süre doldu ya da bağlantısı kopuktu, rastgele). */
  chosen: boolean;
}

/** RR-U13: elenenin kendi tahmin karnesi (yalnız sahibine gider). */
export interface RusRuletiTally {
  /** Çözülen tahmin sayısı. */
  made: number;
  /** Bunlardan tutan. */
  hit: number;
  /** "Evet, patlar" tahmini sayısı. */
  yes: number;
  /** Bunlardan tutan. */
  yesHit: number;
}

/** Herkese açık görünüm. */
export interface RusRuletiPublicView {
  startedAt: number;
  /** Bütün katılımcılar (başlangıç sırası). */
  players: string[];
  alive: string[];
  eliminated: string[];
  /** Silahı tutan; oyun bitince son atıştan sonraki sahip. */
  holder: string;
  /** Sıradaki atışın patlama riski (yüzde). */
  risk: number;
  shots: number;
  last: RusRuletiShot | null;
  /** RR-U3: bütün atışlar, sırayla (herkese açık; zar tohumu yoktur). */
  history: RusRuletiShot[];
  /** RR-M1: şu anki sahibin bu kararda hedefleyemeyeceği oyuncu (az önce ona sıkan); yoksa null. */
  noReturn: string | null;
  /** RR-M3: bekleyen son söz; yoksa null. Bu sürede kimse ateş edemez. */
  lastWord: RusRuletiLastWord | null;
  /** RR-M3: son patlamadan sonra silahın kime verildiği; yeni atışta null olur. */
  handoff: RusRuletiHandoff | null;
  /** Karar penceresi bu ana kadar kapalıdır (sonuç animasyonu; son söz sürerken son sözün bitişi). */
  openAt: number;
  /** Karar süresinin bitişi; bitince sunucu otomatik ateş eder. Oyun bitince null. */
  deadline: number | null;
  over: boolean;
  result: RusRuletiResult | null;
}

/** Kişiye özel görünüm: oyuncunun durumu. */
export type RusRuletiView =
  | { role: "alive" }
  | { role: "spectator" }
  | {
      role: "out";
      /** Şu an tahmin edilen atış sırası (eylemdeki `turn`). */
      turn: number;
      /** Bu atış için verdiğim tahmin (patlar mı); yoksa null. Başkasınınki asla yoktur. */
      prediction: boolean | null;
      lastResult: RusRuletiPredictionResult | null;
      /** RR-U13: kendi karnem. */
      tally: RusRuletiTally;
    };
