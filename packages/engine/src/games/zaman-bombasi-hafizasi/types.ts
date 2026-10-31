/** Zaman Bombası Hafızası — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §24, docs/A4-OYUNLAR.md. */

export const ZAMAN_BOMBASI_COLORS = ["kirmizi", "mavi", "yesil", "sari"] as const;
export type ZamanBombasiColor = (typeof ZAMAN_BOMBASI_COLORS)[number];

/** Başlangıç (ve her elenmeden sonraki) dizi uzunluğu. */
export const ZAMAN_BOMBASI_START_LENGTH = 2;
/** Dizi oynatılırken eleman başına süre. */
export const ZAMAN_BOMBASI_STEP_MS = 350;
/** Aktif oyuncunun giriş süresi: bu taban + dizi uzunluğu × eleman başı süre (O1). */
export const ZAMAN_BOMBASI_INPUT_BASE_MS = 1_500;
export const ZAMAN_BOMBASI_INPUT_PER_ELEMENT_MS = 1_000;
/** Toplam süre sınırı (oyun kurulduğu andan; oynatma dahil). Dolunca oyun biter (O1). */
export const ZAMAN_BOMBASI_TOTAL_MS = 90_000;
/** Ani ölüm: yeni bir sıranın dizisi kurulduğu an, oyun başından bu süre geçmişse (kesin büyük) dizi 2 renk uzar. */
export const ZAMAN_BOMBASI_SUDDEN_DEATH_AFTER_MS = 60_000;
/** Ani ölümde bir doğru sıradan sonra dizinin uzama miktarı (normalde 1). */
export const ZAMAN_BOMBASI_SUDDEN_DEATH_GROWTH = 2;
/** İlk sıranın başlamasından önceki hazırlık payı (ilk sıra sahibine "Sıra sende!" uyarısı bu sürede görünür). */
export const ZAMAN_BOMBASI_INTRO_MS = 1_500;
/** Doğru girişten sonra seçim ekranı açılana kadar ("TEMİZ!" ve yeni nokta animasyonu; ZB-U4). */
export const ZAMAN_BOMBASI_OK_SHOW_MS = 900;
/** Elenmeden sonra seçim (ya da rastgele atış) açılana kadar (patlama, çatlak, avatar savrulması; ZB-U5). */
export const ZAMAN_BOMBASI_FAIL_SHOW_MS = 1_600;
/** Bombayı atan oyuncunun renk ve hedef seçimi için süresi (ZB-M1/M2). Dolunca sunucu rastgele seçer. */
export const ZAMAN_BOMBASI_PICK_MS = 4_000;
/**
 * Hedef belli olduktan sonra oynatmaya kadar uyarı payı (ZB-U2): bomba fırlatılır, hedefin ekranında
 * "SIRA SENDE!" bandı iner; dizi oynatması bu paydan SONRA başlar.
 */
export const ZAMAN_BOMBASI_ALERT_MS = 1_400;
/** Puan (ZB-M3): oyun sonunda hayatta kalanlar. */
export const ZAMAN_BOMBASI_SURVIVOR_POINTS = 2;
/** Puan (ZB-M3): kimse elenmeden 90 sn dolarsa herkes. */
export const ZAMAN_BOMBASI_NOBODY_OUT_POINTS = 1;
/** Simülasyon/bot süre sınırı (toplam süre sınırından biraz uzun). */
export const ZAMAN_BOMBASI_BOT_SPAN_MS = 95_000;

export type ZamanBombasiAction =
  | { kind: "press"; color: ZamanBombasiColor }
  /** Diziye eklenecek rengi seç (yalnız doğru girişten sonraki seçimde, hedeften önce). */
  | { kind: "color"; color: ZamanBombasiColor }
  /** Bombayı at: sıranın geçeceği oyuncu. */
  | { kind: "target"; target: string };

/** `pick`: bombayı atan oyuncu renk/hedef seçiyor (önce kısa sonuç gösterimi, sonra seçim ekranı). */
export type ZamanBombasiPhase = "pick" | "pause" | "playback" | "input" | "over";

/** Herkese açık seçim bilgisi (seçilen renk hariç: o yalnız seçenin kişisel görünümündedir, oynatmada herkese açılır). */
export interface ZamanBombasiPick {
  /** Seçimi yapan (bomba onda). */
  by: string;
  /** `throw`: doğru girişten sonra (önce renk, sonra hedef); `restart`: elenmeden sonra yeni kurbanı seçer (yalnız hedef). */
  kind: "throw" | "restart";
  /** Seçim ekranının açıldığı an (öncesi sonuç gösterimi; bu arada gelen seçim de kabul edilir). */
  opensAt: number;
  /** Seçim süresinin bittiği an; bu anda (ve sonra) sunucu eksik seçimleri rastgele yapar. */
  deadline: number;
  /** Renk seçildi mi (yalnız `throw`; `restart`ta hep true). */
  colorDone: boolean;
  /** Hemen geri atılamayacak oyuncu (bombayı az önce atan; yalnız `throw` ve 3+ aktif oyuncuda). */
  blocked: string | null;
}

/** Son bomba atışı: fırlatma animasyonu ve "Sıra sende!" uyarısı için. */
export interface ZamanBombasiThrow {
  /** Atan; oyun başında ve atanı olmayan elenmeden sonra (rastgele) null. */
  from: string | null;
  to: string;
  /** Atışın gerçekleştiği an (sunucu saati, ms). */
  at: number;
  /** Seçim yapılmadı, sunucu rastgele seçti. */
  auto: boolean;
}

export interface ZamanBombasiLast {
  /** Hangi sıranın sonucu (1'den başlar). */
  turn: number;
  player: string;
  kind: "ok" | "fail" | "timeout";
  /** Sonucun kesinleştiği an (sunucu saati, ms). */
  at: number;
  /** Yanlış basılan renk (yalnız `fail`). */
  color?: ZamanBombasiColor;
  /** Basılması gereken renk (yalnız `fail`); dizinin tamamı verilmez. */
  expected?: ZamanBombasiColor;
}

/**
 * Herkese açık görünüm. Sıra bilgisi mutlak zamanlarla verilir (istemci kendi saatinden evre türetir).
 * Hafıza oyunu: `sequence` yalnız hazırlık ve oynatma evrelerinde dolu, giriş evresinde `null` (tekrar gösterilmez).
 */
export interface ZamanBombasiPublicView {
  /** Oyuncuların gösterim sırası (maç başında bir kez karıştırılır; ilk sıra sahibi ilk eleman). */
  order: string[];
  /** Elenenler, elenme sırasıyla. */
  eliminated: string[];
  /** Oyun içi puanlar (= genel skora aktarılan); oyun sırasında herkes 0, bitişte kesinleşir (ZB-M3). */
  scores: Record<string, number>;
  /** Bomba kimde: sırası olan oyuncu, seçim evresinde seçimi yapan; oyun bitince null. */
  active: string | null;
  /** Seçim evresinde seçim bilgisi; başka evrede null. */
  pick: ZamanBombasiPick | null;
  /** Bombanın şu anki sahibine son atışı (oyun başında atan yok). */
  lastThrow: ZamanBombasiThrow | null;
  /** Bu sıradaki dizi uzunluğu. */
  length: number;
  phase: ZamanBombasiPhase;
  /** Sıra sayacı (1'den). */
  turn: number;
  /** Oynatmanın başladığı an; şimdiden ilerideyse hazırlık evresidir. */
  turnStart: number;
  /** Giriş evresinin başladığı an (= turnStart + uzunluk × stepMs). */
  inputStart: number;
  /** Giriş süresinin bittiği an (= inputStart + 1,5 sn + uzunluk × 1 sn). */
  deadline: number;
  stepMs: number;
  /** Oynatma evresinde şu an yanan elemanın sırası; başka evrede -1. */
  playbackIndex: number;
  /** Yalnız hazırlık ve oynatma evresinde; seçim ve giriş evresinde null. */
  sequence: ZamanBombasiColor[] | null;
  /** Aktif oyuncunun bu sıradaki doğru basışları (yankı). Tam dizi hiçbir zaman burada olmaz. */
  pressed: ZamanBombasiColor[];
  /** Oyunun bitmesi için gereken elenme sayısı. */
  need: number;
  /** Oyunun başladığı an (toplam süre buradan işler). */
  startedAt: number;
  /** Toplam sürenin bittiği an (= startedAt + 90 sn). */
  endsAt: number;
  /** Ani ölümün başladığı an (= startedAt + 60 sn). */
  suddenDeathAt: number;
  /** Oyun süre dolduğu için mi bitti. */
  timeUp: boolean;
  /** Son sıranın sonucu. */
  last: ZamanBombasiLast | null;
}

/** Kişiye özel görünüm: kendi durumun ve (seçimi yapıyorsan) seçtiğin renk. */
export interface ZamanBombasiView {
  /** Elendin mi. İzleyicide false. */
  isOut: boolean;
  /** Sıra bende (hazırlık, oynatma veya giriş evresinde). İzleyicide false. */
  myTurn: boolean;
  /** Seçimi ben yapıyorum (seçim evresi). İzleyicide false. */
  myPick: boolean;
  /** Seçtiğim renk (yalnız seçimi yapana, seçim evresinde); diğer herkeste null. */
  pickColor: ZamanBombasiColor | null;
}
