/**
 * SVG temizleme (UM-G5): betik, dış bağlantı, olay öznitelikleri, `<style>` ve izinli olmayan öğeler atılır. DOCTYPE
 * ya da ENTITY içeren dosya hiç kabul edilmez (dış varlık saldırısı). Sonuç yeniden yazılmış, izin listesinden geçmiş
 * bir SVG'dir; tarayıcıda hiçbir şey çalıştırmaz.
 */

const IZINLI_OGELER = new Set(
  [
    "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "defs", "lineargradient",
    "radialgradient", "stop", "clippath", "mask", "use", "symbol", "title", "desc", "pattern", "text", "tspan",
    "filter", "fegaussianblur", "feoffset", "feblend", "fecolormatrix", "fecomposite", "feflood", "femerge",
    "femergenode", "femorphology", "fedropshadow",
  ],
);

const AD = /^[a-zA-Z_][\w:.-]*$/;

export interface SvgSonucu {
  temiz: string;
  atilanlar: string[];
  viewBox: [number, number, number, number] | null;
  genislik: number | null;
  yukseklik: number | null;
}

export class SvgHatasi extends Error {}

function ozellikler(metin: string): { ad: string; deger: string }[] {
  const out: { ad: string; deger: string }[] = [];
  const re = /([^\s=/]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  for (const m of metin.matchAll(re)) {
    const ad = m[1] ?? "";
    out.push({ ad, deger: m[2] ?? m[3] ?? m[4] ?? "" });
  }
  return out;
}

const kacis = (v: string): string => v.replace(/&(?!(?:#\d+|#x[\da-f]+|[a-z]+);)/gi, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function guvenliDeger(ad: string, deger: string): boolean {
  const kucuk = ad.toLowerCase();
  if (kucuk.startsWith("on")) return false;
  const d = deger.replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
  if (kucuk === "href" || kucuk === "xlink:href") return d.startsWith("#");
  if (d.includes("javascript:") || d.includes("expression(") || d.includes("@import")) return false;
  // url(...) yalnız belge içi başvuru (#kimlik) olabilir.
  for (const m of d.matchAll(/url\(([^)]*)\)/g)) {
    const hedef = (m[1] ?? "").replace(/["']/g, "");
    if (!hedef.startsWith("#")) return false;
  }
  return true;
}

export function svgTemizle(girdi: string): SvgSonucu {
  const metin = girdi.replace(/^﻿/, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(metin)) throw new SvgHatasi("SVG belge türü ya da varlık tanımı içeremez.");
  const atilanlar = new Set<string>();
  let out = "";
  let atla: { ad: string; derinlik: number } | null = null;
  let svgGoruldu = false;
  let viewBox: SvgSonucu["viewBox"] = null;
  let genislik: number | null = null;
  let yukseklik: number | null = null;
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<(\/?)([^\s/>]+)([^>]*?)(\/?)>|([^<]+)|(<)/g;
  for (const m of metin.matchAll(re)) {
    const [tum, kapanis, adHam, govde, kendiKapanan, yazi, tekBuyuktur] = m;
    if (tekBuyuktur) throw new SvgHatasi("SVG bozuk.");
    if (yazi !== undefined) {
      if (!atla && svgGoruldu) out += yazi.replace(/>/g, "&gt;");
      continue;
    }
    if (!adHam) {
      // Yorum, CDATA ve işlem talimatları atılır.
      if (tum.startsWith("<![CDATA[")) atilanlar.add("CDATA");
      continue;
    }
    const ad = adHam.toLowerCase();
    if (!AD.test(adHam)) throw new SvgHatasi("SVG bozuk.");
    if (atla) {
      if (ad === atla.ad) {
        if (kapanis) atla.derinlik -= 1;
        else if (!kendiKapanan) atla.derinlik += 1;
        if (atla.derinlik === 0) atla = null;
      }
      continue;
    }
    const yerel = ad.includes(":") ? (ad.split(":").at(-1) ?? ad) : ad;
    if (!IZINLI_OGELER.has(yerel) || ad.includes(":")) {
      atilanlar.add(adHam);
      if (!kapanis && !kendiKapanan) atla = { ad, derinlik: 1 };
      continue;
    }
    if (kapanis) {
      out += `</${adHam}>`;
      continue;
    }
    if (ad === "svg") svgGoruldu = true;
    const temizOz: string[] = [];
    for (const { ad: oa, deger } of ozellikler(govde ?? "")) {
      if (!AD.test(oa) || !guvenliDeger(oa, deger)) {
        atilanlar.add(`${adHam}@${oa}`);
        continue;
      }
      if (ad === "svg" && viewBox === null && oa === "viewBox") {
        const s = deger.trim().split(/[\s,]+/).map(Number);
        if (s.length === 4 && s.every(Number.isFinite)) viewBox = [s[0] ?? 0, s[1] ?? 0, s[2] ?? 0, s[3] ?? 0];
      }
      if (ad === "svg" && oa === "width") genislik = Number.parseFloat(deger) || null;
      if (ad === "svg" && oa === "height") yukseklik = Number.parseFloat(deger) || null;
      temizOz.push(`${oa}="${kacis(deger)}"`);
    }
    out += `<${adHam}${temizOz.length ? ` ${temizOz.join(" ")}` : ""}${kendiKapanan ? "/" : ""}>`;
  }
  if (!svgGoruldu) throw new SvgHatasi("Dosyada SVG öğesi yok.");
  return { temiz: out.trim(), atilanlar: [...atilanlar], viewBox, genislik, yukseklik };
}
