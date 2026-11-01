/** Gizli Kareler — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §14, docs/A6-OYUNLAR.md. */

/** Her aşamanın seçim süresi (ms). */
export const KARELER_STAGE_MS = 20_000;
/** 1. aşama sonucunun açılış süresi (GK-U6: kareler tek tek döner; ms). */
export const KARELER_REVEAL1_MS = 5_000;
/** "2. AŞAMA" bandı (GK-U5): 1. aşama açılışından sonra, 2. aşama başlamadan önce (ms). Pusula bununla açılır. */
export const KARELER_BAND_MS = 1_000;
/** 1. aşama açıldıktan sonra 2. aşama başlayana kadar geçen süre: açılış + bant (ms). */
export const KARELER_BETWEEN_MS = KARELER_REVEAL1_MS + KARELER_BAND_MS;
/** Son sonucun en az gösterim süresi (GK-U7: kareler, ödül karesi anı, pusulalar; ms); oyun bunun sonunda biter. */
export const KARELER_FINAL_MS = 8_000;
/** En uzun oyun: iki aşama + ara pencere + son sonuç. */
export const KARELER_DURATION_MS =
  KARELER_STAGE_MS + KARELER_BETWEEN_MS + KARELER_STAGE_MS + KARELER_FINAL_MS;

/** 2–4 oyuncuda 3×3, 5–8 oyuncuda 4×4. */
export function kareSize(playerCount: number): 3 | 4 {
  return playerCount <= 4 ? 3 : 4;
}

/** Izgaradaki hücre sayısı. */
export function kareCells(size: number): number {
  return size * size;
}

/** Seçim: hücre numarası, soldan sağa satır satır 0..size²-1. */
export type KarelerAction = { kind: "pick"; cell: number } | { kind: "lock" };

/** Kilitlenen aşamanın bitişine kalan süre (son dokunuşun animasyonu için, ms). */
export const KARELER_LOCK_GRACE_MS = 1_000;

/**
 * Bir oyuncunun aşamadaki durumu:
 * - `solo`: hücrede tek başına (+1, ilk aşamadaysa devam eder)
 * - `clash`: hücreyi başka bir yarışanla paylaştı (elendi, puan yok)
 * - `haunted`: yalnız 2. aşamada: yarışanlar arasında tek ama karede bir hayalet var (GK-M2; puan ve ödül yok)
 * - `passive`: seçim yapmadı (puan yok, çakışmaya girmez)
 */
export type KareStatus = "solo" | "clash" | "haunted" | "passive";

/** Bir aşamanın açılmış sonucu (yalnız o aşamaya katılanlar). */
export interface KareReveal {
  /** Katılımcının son seçimi; seçmeyen null. */
  choices: Record<string, number | null>;
  status: Record<string, KareStatus>;
}

/** 2. aşamanın açılmış sonucu: yarışanlar + hayaletlerin seçimleri ve herkesin pusulası. */
export interface KareReveal2 extends KareReveal {
  /** Hayaletlerin (1. aşamada tek kalamayanlar) seçimleri; seçmeyen null. Puan almazlar. */
  ghosts: Record<string, number | null>;
  /** Yarışanların pusulaları (GK-M1): açılışta herkese açılır. */
  compass: Record<string, KareHint>;
}

export interface KareStage2 {
  startsAt: number;
  endsAt: number;
  /** 2. aşamada yarışan (1. aşamada tek kalan) oyuncular. */
  players: string[];
  /** 2. aşamada hayalet olanlar: 1. aşamada çakışan ya da seçmeyen (GK-M2). */
  ghosts: string[];
}

/**
 * Pusula ipucu (GK-M1): ödül karesi hakkında her zaman doğru bir bilgi. Satır/sütun 0'dan sayılır
 * (ekranda satır 1…, sütun A…).
 * - `notRow` / `notCol`: o satırda / sütunda değil
 * - `corner` / `notCorner`: köşede / köşede değil
 * - `edge` / `inner`: kenarda / içeride (yalnız 4×4; 3×3'te tek kareyi ya da neredeyse hepsini gösterirdi)
 * - `half`: 4×4'te üst / alt / sol / sağ yarıda
 */
export type KareHint =
  | { kind: "notRow"; row: number }
  | { kind: "notCol"; col: number }
  | { kind: "corner" }
  | { kind: "notCorner" }
  | { kind: "edge" }
  | { kind: "inner" }
  | { kind: "half"; side: KareHalf };

export type KareHalf = "top" | "bottom" | "left" | "right";

/** İpucu bu kareye izin veriyor mu (ödül karesi bu kare olabilir mi). */
export function hintAllows(hint: KareHint, cell: number, size: number): boolean {
  const row = Math.floor(cell / size);
  const col = cell % size;
  const last = size - 1;
  const corner = (row === 0 || row === last) && (col === 0 || col === last);
  const edge = row === 0 || row === last || col === 0 || col === last;
  switch (hint.kind) {
    case "notRow":
      return row !== hint.row;
    case "notCol":
      return col !== hint.col;
    case "corner":
      return corner;
    case "notCorner":
      return !corner;
    case "edge":
      return edge;
    case "inner":
      return !edge;
    case "half": {
      const half = size / 2;
      if (hint.side === "top") return row < half;
      if (hint.side === "bottom") return row >= half;
      if (hint.side === "left") return col < half;
      return col >= half;
    }
  }
}

/** İpucunun izin verdiği kareler. */
export function hintCells(hint: KareHint, size: number): number[] {
  return Array.from({ length: kareCells(size) }, (_, i) => i).filter((c) => hintAllows(hint, c, size));
}

/**
 * Bir ızgarada verilebilecek ipucu türleri. Her ipucu karelerin en az dörtte birini eler ama en az 3 kareye izin verir
 * (bu yüzden 3×3'te "kenarda" / "içeride" ve yarılar yok).
 */
export function kareHintPool(size: number): KareHint[] {
  const all: KareHint[] = [];
  for (let r = 0; r < size; r++) all.push({ kind: "notRow", row: r });
  for (let c = 0; c < size; c++) all.push({ kind: "notCol", col: c });
  all.push({ kind: "corner" }, { kind: "notCorner" }, { kind: "edge" }, { kind: "inner" });
  if (size % 2 === 0) {
    for (const side of ["top", "bottom", "left", "right"] as const) all.push({ kind: "half", side });
  }
  const cells = kareCells(size);
  return all.filter((h) => {
    const allowed = hintCells(h, size).length;
    return allowed >= 3 && cells - allowed >= cells / 4;
  });
}

/** Ödül karesi için doğru olan bütün ipuçları (sabit sırayla; dağıtım tohumlu karıştırmayla yapılır). */
export function kareHintsFor(bonusCell: number, size: number): KareHint[] {
  if (!Number.isInteger(bonusCell) || bonusCell < 0 || bonusCell >= kareCells(size)) return [];
  return kareHintPool(size).filter((h) => hintAllows(h, bonusCell, size));
}

/** Herkese açık görünüm (oda başına bir kez). Seçimler aşama bitene kadar burada yoktur. */
export interface KarelerPublicView {
  size: number;
  startedAt: number;
  /** 1. aşama seçim süresinin bitişi (herkes kilitlediyse erken); seçimler bu anda açılır. */
  endsAt: number;
  /** 1. aşama açılmadan veya oyun 1. aşamada bitiyorsa null. */
  stage2: KareStage2 | null;
  stage1: KareReveal | null;
  stage2Reveal: KareReveal2 | null;
  /** Oyunun bitişi; 1. aşama açılmadan null. */
  finishesAt: number | null;
  /**
   * 1. aşamadan sonra tek başına kalıp 2. aşamayı rakipsiz sayılan oyuncu (otomatik +1). Bağlı bir hayalet varsa
   * rakipsiz bitiş yoktur; 2. aşama oynanır (GK-M2).
   */
  walkover: string | null;
  /** Şimdiye kadar açılan sonuçlardan kazanılan puanlar (genel skora direkt). 1. aşama açılmadan null. */
  points: Record<string, number> | null;
  /** Ödül karesi: yalnız 2. aşamanın sonucu açılırken var; o ana kadar null (konumu hiçbir yerde yok). */
  bonus: KareBonus | null;
  /** Şu an seçim yapılan aşamada "Tamam" diyenler (seçimleri gizli kalır); seçim aşaması dışında boş. */
  ready: string[];
}

/** Ödül karesinin ek puanı (2. aşamada tek başına basana, genel skora). */
export const KARELER_BONUS_POINTS = 2;

/** 2. aşamanın sonucuyla açılan ödül karesi. */
export interface KareBonus {
  /** Ödül karesinin hücre numarası. */
  cell: number;
  /** Ödül karesinde tek başına (hayaletsiz) kalan yarışan; hiç kimse ya da birden çok kişi bastıysa null. */
  winner: string | null;
}

/** Kişiye özel görünüm: yalnız kendi seçimin (şu an seçim yapılan aşamada) ve kendi pusulan. */
export interface KarelerView {
  myChoice: number | null;
  /** Bu aşamada seçimini kilitledin mi. */
  locked: boolean;
  /**
   * Pusulan (GK-M1): yalnız 2. aşamada yarışansan, "2. AŞAMA" bandından 2. aşamanın sonuna kadar. Başkasının
   * pusulası hiçbir görünümde yoktur; açılışta `stage2Reveal.compass` ile herkese açılır.
   */
  compass: KareHint | null;
}
