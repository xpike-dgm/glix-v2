/** Ön kontrol (UM-K1…K6): bütün modüller sırayla; sonuç geçti / uyarı / kaldı. */
import { type KontrolRaporu, toplamSonuc } from "../ortak/tipler.js";
import { alanKontrolleri } from "./alan.js";
import type { KontrolBaglami, Satir } from "./baglam.js";
import { satir } from "./baglam.js";
import { gorselKontrolleri } from "./gorsel.js";
import { metinKontrolleri } from "./metin.js";
import { ortakKontroller } from "./ortak.js";
import { sesKontrolleri } from "./ses.js";

export type { KontrolBaglami, KontrolDosyasi } from "./baglam.js";

export async function onKontrol(b: KontrolBaglami, ek: Satir[] = []): Promise<KontrolRaporu> {
  const satirlar: Satir[] = [...ek, ...ortakKontroller(b, b.katalog.varOlanYollar())];
  const guvenli = async (grup: Satir["grup"], f: () => Satir[] | Promise<Satir[]>): Promise<void> => {
    try {
      satirlar.push(...(await f()));
    } catch {
      satirlar.push(satir(grup, "hata", "uyari", "Bu kontrol çalışırken bir sorun çıktı; elle bakılmalı."));
    }
  };
  await guvenli("gorsel", () => gorselKontrolleri(b));
  await guvenli("ses", () => sesKontrolleri(b));
  await guvenli("metin", () => metinKontrolleri(b));
  await guvenli("alan", () => alanKontrolleri(b));
  return { sonuc: toplamSonuc(satirlar), satirlar };
}
