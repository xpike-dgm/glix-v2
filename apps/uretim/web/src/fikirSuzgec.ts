/** Fikir panosunun süzgeç ve sıralaması (saf; testli). */
import type { Etki, FikirAsamasi, FikirKarti, Zahmet } from "../../src/ortak/fikir.js";

export type Siralama = "yeni" | "etki" | "kolay";
const ETKI_PUAN: Record<Etki, number> = { dusuk: 1, orta: 2, yuksek: 3 };
const ZAHMET_PUAN: Record<Zahmet, number> = { kucuk: 1, orta: 2, buyuk: 3 };
/** Süzgeç ve sıralama (saf; testli). */
export function fikirSuz(
  fikirler: readonly FikirKarti[],
  s: {
    ara: string;
    alan: string | null;
    kategori: string | null;
    etki: Etki | null;
    zahmet: Zahmet | null;
    asama: FikirAsamasi | "acik" | null;
    siralama: Siralama;
  },
): FikirKarti[] {
  const q = s.ara.trim().toLocaleLowerCase("tr-TR");
  const out = fikirler.filter(
    (f) =>
      (!s.alan || f.alan === s.alan) &&
      (!s.kategori || f.kategori === s.kategori) &&
      (!s.etki || f.etki === s.etki) &&
      (!s.zahmet || f.zahmet === s.zahmet) &&
      (!s.asama || (s.asama === "acik" ? f.asama !== "reddedildi" : f.asama === s.asama)) &&
      (!q ||
        `${f.baslik} ${f.ozet ?? ""} ${f.aciklama} ${f.kategori ?? ""}`
          .toLocaleLowerCase("tr-TR")
          .includes(q)),
  );
  const etki = (f: FikirKarti): number => (f.etki ? ETKI_PUAN[f.etki] : 0);
  const zahmet = (f: FikirKarti): number => (f.zahmet ? ZAHMET_PUAN[f.zahmet] : 2);
  if (s.siralama === "etki") out.sort((a, b) => etki(b) - etki(a) || zahmet(a) - zahmet(b) || b.id - a.id);
  else if (s.siralama === "kolay")
    out.sort((a, b) => etki(b) / zahmet(b) - etki(a) / zahmet(a) || etki(b) - etki(a) || b.id - a.id);
  else out.sort((a, b) => b.id - a.id);
  return out;
}
