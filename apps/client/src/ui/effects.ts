/**
 * Efekt motorlarının çizim kuralları (MG-4, saf): katalogdaki tarif (`@glix/engine` `parseEffectRecipe`) CSS sınıfına
 * ve CSS değişkenlerine çevrilir; animasyonlar `styles/effects.css`'tedir. Parçacıklı motorların (kıvılcım, parçacık
 * yağmuru) yerleşimi de burada, tohumlu ve belirlenimci hesaplanır (her çizimde aynı).
 *
 * Bugünkü ad efektleri ve çerçeveler bu kurallarla birebir aynı görünür (önce/sonra ekran görüntüsü:
 * `scripts/efekt-karsilastir.mjs`).
 */
import {
  type CosmeticItem,
  EFFECT_MAX_PARTICLES,
  type EffectLight,
  type ParsedEffect,
  parseEffectRecipe,
} from "@glix/engine";
import { assetUrl } from "./assetOverride.js";

export type FxStyle = Record<string, string>;

/** Doku yolunun (`public/assets/shop/` altında) adresi. */
export const shopTexture = (path: string): string => assetUrl(`/assets/shop/${path}`);

/** Ürünün tarifi (türüyle doğrulanmış); yoksa ya da geçersizse null. */
export function effectOf(item: CosmeticItem | undefined | null): ParsedEffect | null {
  return item?.efekt ? parseEffectRecipe(item.efekt, item.type) : null;
}

const px = (n: number): string => `${Math.round(n * 100) / 100}px`;
/** Metin ışığı: `0 0 <yarıçap>px <renk>` katmanları. */
export const textShadow = (lights: readonly EffectLight[], scale = 1): string =>
  lights.map((l) => `0 0 ${px(l.yaricap * scale)} ${l.renk}`).join(", ");
/** Görsel ışığı: `drop-shadow(...)` zinciri. */
export const dropShadow = (lights: readonly EffectLight[], scale = 1): string =>
  lights.length === 0
    ? "none"
    : lights.map((l) => `drop-shadow(0 0 ${px(l.yaricap * scale)} ${l.renk})`).join(" ");

/** Renk geçişi: duraklar varsa yüzdeleriyle. */
export function gradient(e: Extract<ParsedEffect, { motor: "akan-renk" }>): string {
  const stops = e.renkler.map((c, i) => (e.duraklar ? `${c} ${e.duraklar[i] ?? 0}%` : c));
  return `linear-gradient(${e.aci}deg, ${stops.join(", ")})`;
}

/**
 * Akışın bitiş konumu: zemin kutunun `genislik` katıyken tam bir zemin boyu kayması `G/(1-G)` yüzdesidir
 * (200% genişlikte -200%); döngü dikişsiz kapanır.
 */
export function flowEnd(widthPercent: number): string {
  const g = widthPercent / 100;
  if (g === 1) return "0% 0";
  return `${Math.round((g / (1 - g)) * 10000) / 100}% 0`;
}

const sec = (s: number): string => `${s}s`;

export interface NameFxLook {
  /** `cos-name` öğesine eklenen sınıflar. */
  class: string;
  style: FxStyle;
  /** Parçacıklı efektte parçacıklar (kıvılcım). */
  particles: ParsedEffect | null;
}

/** Ad efektinin görünümü. */
export function nameFxLook(e: ParsedEffect): NameFxLook {
  switch (e.motor) {
    case "parlama": {
      const pulse = e.nabizHizi > 0;
      const style: FxStyle = {
        "--fx-renk": e.renk ?? "currentColor",
        "--fx-isik": textShadow(e.isiklar, e.yogunluk),
      };
      if (pulse) {
        style["--fx-tepe"] = textShadow(
          e.tepeIsiklar ?? e.isiklar,
          e.tepeIsiklar ? e.yogunluk : e.yogunluk * 1.6,
        );
        style["--fx-sure"] = sec(e.nabizHizi);
      }
      return { class: pulse ? "fx-parlama fx-nabiz" : "fx-parlama", style, particles: null };
    }
    case "akan-renk": {
      const sway = e.hareket === "salinim";
      return {
        class: sway ? "fx-akan fx-salinim" : "fx-akan",
        style: {
          "--fx-degrade": gradient(e),
          "--fx-genislik": `${e.genislik}% 100%`,
          "--fx-dolgu": e.dolgu,
          "--fx-filtre": e.isik ? dropShadow([e.isik]) : "none",
          "--fx-sure": sec(e.akisHizi),
          "--fx-son": flowEnd(e.genislik),
          "--fx-yon": sway
            ? e.yon === "geri"
              ? "alternate-reverse"
              : "alternate"
            : e.yon === "geri"
              ? "reverse"
              : "normal",
        },
        particles: null,
      };
    }
    case "kivilcim":
      return { class: "fx-kivilcim", style: { "--fx-renk": e.renk }, particles: e };
    default:
      return { class: "", style: {}, particles: null };
  }
}

export interface FrameLayer {
  src: string;
  class: string;
  style: FxStyle;
}

export interface FrameLook {
  /** Çerçeve görselinin katmanları (ilki ana görsel). Boşsa çerçeve görseli yok (yalnız parçacık). */
  layers: FrameLayer[];
  /** Renk akışı maskesi (akan renk motoru). */
  flow: { mask: string; style: FxStyle } | null;
  particles: ParsedEffect | null;
}

/** Çerçevenin görünümü. */
export function frameLook(e: ParsedEffect): FrameLook {
  switch (e.motor) {
    case "doku-katmani": {
      const style: FxStyle = {};
      if (e.karisim !== "normal") style["mix-blend-mode"] = e.karisim;
      let cls = "";
      if (e.hareket !== "yok") {
        cls = e.hareket === "kayma" ? "fx-kayma" : "fx-sallan";
        style["--fx-sure"] = sec(e.hareketHizi);
      }
      return { layers: [{ src: shopTexture(e.doku), class: cls, style }], flow: null, particles: null };
    }
    case "donen-halka": {
      const layers: FrameLayer[] = [];
      for (let k = 0; k < e.katman; k++) {
        const reverse = (e.yon === "ters") !== (k % 2 === 1);
        const style: FxStyle = {
          "--fx-sure": sec(k === 0 ? e.donusHizi : Math.round((e.donusHizi / (1 + k * 0.5)) * 100) / 100),
          "--fx-yon": reverse ? "reverse" : "normal",
        };
        if (k > 0) style.opacity = "0.55";
        layers.push({ src: shopTexture(e.doku), class: k === 0 ? "fx-don" : "fx-don av__frame--ek", style });
      }
      return { layers, flow: null, particles: null };
    }
    case "parlama": {
      const src = shopTexture(e.doku ?? "");
      const layers: FrameLayer[] = [{ src, class: "", style: { filter: dropShadow(e.isiklar, e.yogunluk) } }];
      if (e.nabizHizi > 0)
        layers.push({
          src,
          class: "fx-nabiz-kat av__frame--ek",
          style: {
            filter: dropShadow(e.tepeIsiklar ?? e.isiklar, e.tepeIsiklar ? e.yogunluk : e.yogunluk * 1.6),
            "--fx-sure": sec(e.nabizHizi),
          },
        });
      return { layers, flow: null, particles: null };
    }
    case "akan-renk":
      return {
        layers: [],
        flow: {
          mask: shopTexture(e.doku ?? ""),
          style: {
            "--fx-degrade": gradient(e),
            "--fx-sure": sec(e.akisHizi),
            "--fx-yon": e.yon === "geri" ? "reverse" : "normal",
            "--fx-anim": e.hareket === "salinim" ? "fx-akis-sallan" : "fx-akis-kay",
            filter: e.isik ? dropShadow([e.isik]) : "none",
          },
        },
        particles: null,
      };
    case "kivilcim":
      return { layers: [], flow: null, particles: e };
    default:
      return { layers: [], flow: null, particles: null };
  }
}

// ---- Parçacıklar ----

/** Belirlenimci sözde rastgele (0..1): aynı tohum ve sıra her zaman aynı değeri verir. */
export function seeded(seed: number, i: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i + 1, 0xc2b2ae35);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  x = Math.imul(x, 0x297a2d39);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

export interface Particle {
  /** Başlangıç konumu: kutunun yüzdesi. */
  x: number;
  y: number;
  /** Kayma (px). */
  dx: number;
  dy: number;
  /** Gecikme ve süre (sn). */
  delay: number;
  duration: number;
  size: number;
  /** Doku (varsa) adresi. */
  src: string | null;
  rotate: number;
}

/** Parçacık yerleşimi; `shape`: `ring` (çerçeve/giriş halkası), `box` (ad), `rain` (yağmur). En çok 60 parçacık. */
export function particlesOf(e: ParsedEffect, shape: "ring" | "box"): Particle[] {
  const out: Particle[] = [];
  if (e.motor === "kivilcim") {
    const n = Math.min(EFFECT_MAX_PARTICLES, e.sayi);
    for (let i = 0; i < n; i++) {
      const r = (k: number) => seeded(n * 31 + e.boyut, i * 7 + k);
      let x: number;
      let y: number;
      if (shape === "ring") {
        const a = (i / n) * Math.PI * 2 + r(0) * 0.6;
        const rad = 50 + r(1) * 8;
        x = 50 + Math.cos(a) * rad;
        y = 50 + Math.sin(a) * rad;
      } else {
        x = r(0) * 100;
        y = 20 + r(1) * 60;
      }
      out.push({
        x,
        y,
        dx: (r(2) - 0.5) * 10,
        dy: -6 - r(3) * 10,
        delay: Math.round(r(4) * e.hiz * 100) / 100,
        duration: e.hiz,
        size: Math.max(2, Math.round(e.boyut * (0.6 + r(5) * 0.6))),
        src: e.doku ? shopTexture(e.doku) : null,
        rotate: Math.round(r(6) * 360),
      });
    }
  } else if (e.motor === "parcacik-yagmuru") {
    const n = Math.min(EFFECT_MAX_PARTICLES, e.yogunluk);
    for (let i = 0; i < n; i++) {
      const r = (k: number) => seeded(n * 17 + e.dokular.length, i * 7 + k);
      const tex = e.dokular[i % e.dokular.length] ?? "";
      let x = r(0) * 100;
      const y = e.yon === "asagi" ? -10 : e.yon === "yukari" ? 110 : 50;
      let dx = (r(1) - 0.5) * 40;
      let dy = e.yon === "asagi" ? 260 : e.yon === "yukari" ? -260 : 0;
      if (e.yon === "patlama") {
        const a = r(2) * Math.PI * 2;
        const d = 80 + r(3) * 120;
        x = 50;
        dx = Math.cos(a) * d;
        dy = Math.sin(a) * d;
      }
      out.push({
        x,
        y,
        dx: Math.round(dx),
        dy: Math.round(dy),
        delay: Math.round(r(4) * e.sure * 100) / 100,
        duration: e.sure,
        size: Math.round(22 + r(5) * 18),
        src: shopTexture(tex),
        rotate: Math.round(r(6) * 360),
      });
    }
  }
  return out;
}
