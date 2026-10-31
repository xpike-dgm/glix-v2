import type { Katalog } from "../katalog.js";
import type { AlanTanimi, DosyaTuru } from "../ortak/alanlar.js";
import type { DosyaMeta, KontrolSatiri, TeslimTuru } from "../ortak/tipler.js";
import type { OgeGirdisi } from "../teslimGirdisi.js";

export interface KontrolDosyasi {
  dosyaId: string;
  ad: string;
  tur: DosyaTuru;
  veri: Buffer;
  ozet: string;
  meta: DosyaMeta | null;
  hedefYol: string | null;
  rol: string | null;
  /** Aynı içerik bu alanda daha önce başka bir öğeyle geldi mi. */
  dahaOnce: boolean;
}

export interface KontrolBaglami {
  alan: AlanTanimi;
  tur: TeslimTuru;
  oge: OgeGirdisi;
  dosyalar: KontrolDosyasi[];
  /** Aynı teslimdeki diğer öğelerin ad anahtarları. */
  ayniTeslimAdlari: string[];
  /** Alanda karar bekleyen ya da onaylanmış (başka teslimden) öğe ad anahtarları. */
  alandakiAdlar: Set<string>;
  katalog: Katalog;
  now: number;
}

export type Satir = KontrolSatiri;

export const satir = (
  grup: KontrolSatiri["grup"],
  kod: string,
  sonuc: KontrolSatiri["sonuc"],
  mesaj: string,
  ek: { dosya?: string; satir?: number } = {},
): KontrolSatiri => ({ grup, kod, sonuc, mesaj, ...ek });
