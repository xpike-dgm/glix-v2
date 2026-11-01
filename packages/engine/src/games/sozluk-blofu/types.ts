/** Sözlük Blöfü — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §4, docs/A6-OYUNLAR.md. */

import type { SozlukWordType } from "./pool.js";

export const SOZLUK_WRITE_MS = 50_000;
export const SOZLUK_PICK_MS = 30_000;
/** Kartların sahipleri açıldıktan sonra sonucun gösterildiği süre (oyun bu sürenin sonunda biter). */
export const SOZLUK_REVEAL_MS = 12_000;
/** Herkes hazırsa aşamanın bitişine kalan süre (ms). */
export const SOZLUK_LOCK_GRACE_MS = 1_000;
export const SOZLUK_DURATION_MS = SOZLUK_WRITE_MS + SOZLUK_PICK_MS + SOZLUK_REVEAL_MS;
/** Sahte tanım sınırı (Unicode karakter, temizlemeden sonra). */
export const SOZLUK_MAX_LENGTH = 100;
/** Ham metin için ağ koruması (temizlemeden önce); kural sınırı değildir. */
export const SOZLUK_MAX_RAW_LENGTH = 400;
/** Aynı odada son bu kadar Sözlük Blöfü oyununda çıkan kelime tekrar gelmez (SB-M2). */
export const SOZLUK_CONTENT_MEMORY = 40;
/** "Bu kelimeyi önceden biliyordum" düğmesi açılışın bu kadar ms'sinden sonra etkin (SB-M7). */
export const SOZLUK_KNEW_DELAY_MS = 1_500;

/**
 * Genel skor ödülü (SB-M1): en yüksek blöf puanı +2 (eşitse hepsi), sonraki farklı toplam +1, diğerleri 0. Blöf puanı 0
 * olan ödül almaz; herkesin toplamı aynı ve 0'dan büyükse herkes +1, hepsi 0 ise kimse.
 */
export function sozlukAwards(points: Readonly<Record<string, number>>): Record<string, number> {
  const ids = Object.keys(points);
  const awards: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const value = (id: string): number => points[id] ?? 0;
  const positive = [...new Set(ids.map(value).filter((v) => v > 0))].sort((x, y) => y - x);
  const top = positive[0];
  if (top === undefined) return awards;
  if (ids.every((id) => value(id) === top)) {
    for (const id of ids) awards[id] = 1;
    return awards;
  }
  const second = positive[1];
  for (const id of ids) {
    if (value(id) === top) awards[id] = 2;
    else if (second !== undefined && value(id) === second) awards[id] = 1;
  }
  return awards;
}

export type SozlukAction =
  /** Sahte tanımını gönder; gönderilen tanım kesindir (değiştirilemez), göndermek "Tamam"dır. */
  | { kind: "bluff"; text: string }
  /** Karıştırılmış kartlardan birini seç (kendi kartın hariç); kilitlenene kadar değiştirilebilir. */
  | { kind: "pick"; card: string }
  /** Seçimde "Tamam": seçim kesinleşir. */
  | { kind: "lock" }
  /**
   * Açılışta "Bu kelimeyi önceden biliyordum" (SB-M7): puana etkisi yok, geri alınabilir (`on: false`). Kim bastığı
   * hiçbir görünümde yoktur; sunucu yalnız toplam sayıyı havuz istatistiğine yazar.
   */
  | { kind: "knew"; on: boolean };

export type SozlukPhase = "write" | "pick" | "reveal";

/** Karıştırılmış kart: gerçek tanım ve sahte tanımlar aynı biçimde, sahipsiz. */
export interface SozlukCard {
  id: string;
  text: string;
}

export interface SozlukReveal {
  /** Gerçek tanımın kartı. */
  realCard: string;
  /** Sahte kartların sahibi: kart -> oyuncu (gerçek kart yok). */
  authors: Record<string, string>;
  /** Seçimler: oyuncu -> kart (seçmeyen yok). */
  picks: Record<string, string>;
  /** Blöf puanı (mini puan): gerçeği bulmak +1, seni seçen her kişi +1. */
  scores: Record<string, number>;
  /** Genel skora giden sıralama ödülü (SB-M1): +2 / +1 / 0. */
  awards: Record<string, number>;
}

/** Herkese açık görünüm: gerçek kart ve kart sahipleri sonuç açılana kadar hiçbir yerde yoktur. */
export interface SozlukPublicView {
  players: string[];
  phase: SozlukPhase;
  /** Garip kelime (büyük harf). */
  word: string;
  /** Kelimenin türü (SB-M3); havuz girdisinde yoksa null (satır görünmez). */
  wordType: SozlukWordType | null;
  startedAt: number;
  writeEndsAt: number;
  pickEndsAt: number;
  finishAt: number;
  /** Bulunulan aşamada hazır olanlar: yazmada tanımını gönderenler, seçmede "Tamam" diyenler. */
  ready: string[];
  /** Seçme aşamasından itibaren: karıştırılmış kartlar. */
  cards: SozlukCard[] | null;
  reveal: SozlukReveal | null;
}

/** Kişiye özel görünüm. */
export interface SozlukView {
  /** Gönderdiğin (temizlenmiş) sahte tanım; henüz göndermediysen null. */
  myBluff: string | null;
  /** Seçme aşamasında senin kartının numarası (seçemezsin); yazmadıysan null. */
  myCard: string | null;
  myPick: string | null;
  /** Bulunulan aşamada hazır dedin mi. */
  locked: boolean;
  /** Açılışta "Bu kelimeyi biliyordum" dedin mi (yalnız sende görünür). */
  myKnew: boolean;
}
