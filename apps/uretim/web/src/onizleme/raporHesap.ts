/** Rapor panosunun saf hesapları (testli): yapılandırılmış raporu okuma, kutucuk farkı, bulgu karşılaştırması. */
import {
  type RaporBulgu,
  type RaporKutucuk,
  type YapiliRapor,
  yapiliRaporMu,
} from "../../../src/ortak/rapor.js";
import type { OgeAyrinti } from "../../../src/ortak/tipler.js";

export const raporOku = (o: Pick<OgeAyrinti, "rapor"> | undefined | null): YapiliRapor | null => {
  const r = o?.rapor;
  if (!yapiliRaporMu(r)) return null;
  const x = r as Partial<YapiliRapor>;
  return {
    ...x,
    ozet: x.ozet ?? [],
    seriler: x.seriler ?? [],
    tablolar: x.tablolar ?? [],
    bulgular: x.bulgular ?? [],
  };
};

/** Kutucuğun önceki değeri: kendi `onceki`si ya da önceki rapordaki aynı adlı kutucuk. */
export function kutucukFarki(
  k: RaporKutucuk,
  onceki: YapiliRapor | null,
): { onceki: number; fark: number; iyi: boolean | null } | null {
  const o = k.onceki ?? onceki?.ozet.find((x) => x.ad === k.ad)?.deger;
  if (o === undefined) return null;
  const fark = k.deger - o;
  return { onceki: o, fark, iyi: k.iyi && fark !== 0 ? (k.iyi === "yukari" ? fark > 0 : fark < 0) : null };
}

/** Bulgu karşılaştırması: başlığa göre yeni, süren ve çözülen. */
export function bulguFarki(
  simdi: RaporBulgu[],
  onceki: RaporBulgu[],
): { yeni: Set<string>; cozulen: RaporBulgu[] } {
  const a = (b: RaporBulgu): string => b.baslik.toLocaleLowerCase("tr-TR").trim();
  const eski = new Set(onceki.map(a));
  const yeni = new Set(simdi.filter((b) => !eski.has(a(b))).map(a));
  const simdiki = new Set(simdi.map(a));
  return { yeni, cozulen: onceki.filter((b) => !simdiki.has(a(b))) };
}

/** Okunur eksen basamakları (1, 2, 2.5, 5 × 10^n). */
export function eksenBasamaklari(enk: number, enb: number, adet = 4): number[] {
  if (!(enb > enk)) return [enk];
  const ham = (enb - enk) / adet;
  const us = 10 ** Math.floor(Math.log10(ham));
  const adim = [1, 2, 2.5, 5, 10].map((x) => x * us).find((x) => x >= ham) ?? 10 * us;
  const bas = Math.floor(enk / adim) * adim;
  const out: number[] = [];
  // Üst sınırı kapsayan ilk basamağa kadar (veri eksenin dışına taşmasın).
  for (let v = bas; ; v += adim) {
    out.push(Number(v.toPrecision(12)));
    if (v >= enb - adim * 1e-9 || out.length > 50) break;
  }
  return out;
}

export const sayiBicimi = (v: number): string =>
  Math.abs(v) >= 10_000
    ? `${(v / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} B`
    : v.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
