import { CELEBRATION_SPRITES, cosmeticItem } from "@glix/engine";
import { reducedMotion } from "./motion.js";

/**
 * Zafer kutlaması (mağaza türü `zafer`): finalde kazananın kuşandığı kutlama herkesin ekranında oynar.
 * Her kutlamanın 4 parçacık görseli (`/assets/shop/zafer/<asset>-1..4.webp`) ve kendine özgü hareketi vardır.
 * Hareket kuralları saftır (`createParticles` / `particleAt`): Pixi yalnız çizer. Parçacık sayısı sınırlıdır;
 * sekme gizlenince Pixi'nin ticker'ı durur, dönüşte tek karede en çok 50 ms ilerler (parçacıklar topluca atlamaz).
 */

export type CelebrationKind = "konfeti" | "balon" | "havai-fisek" | "simsek" | "altin-yagmur";

export const CELEBRATION_KINDS: readonly CelebrationKind[] = [
  "konfeti",
  "balon",
  "havai-fisek",
  "simsek",
  "altin-yagmur",
];

export const celebrationKind = (asset: string | undefined): CelebrationKind | null =>
  CELEBRATION_KINDS.find((k) => k === asset) ?? null;

/** Üst sınırlar: düşük donanımda daha az parçacık. */
export const MAX_PARTICLES = 120;
export const MAX_PARTICLES_LOW = 64;

export interface Particle {
  /** Görsel sırası 0..3. */
  sprite: number;
  /** Doğuş gecikmesi ve ömür (sn). */
  delay: number;
  life: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Yer çekimi ve hız sönümü (her saniye çarpanı). */
  g: number;
  drag: number;
  rot: number;
  vr: number;
  /** Boyut (px, ekranın kısa kenarına göre ölçeklenmiş). */
  size: number;
  /** Yan salınım (balon, yağmur): genlik px, sıklık rad/sn, evre. */
  sway: number;
  swayHz: number;
  phase: number;
  /** Titreme (şimşek): doğrusa alfa hızlı değişir. */
  flicker: boolean;
  /** Doğarken büyüme süresi (sn). */
  grow: number;
}

export interface PState {
  x: number;
  y: number;
  rot: number;
  alpha: number;
  size: number;
}

type Rand = () => number;

const base = (over: Partial<Particle>): Particle => ({
  sprite: 0,
  delay: 0,
  life: 2,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  g: 0,
  drag: 1,
  rot: 0,
  vr: 0,
  size: 32,
  sway: 0,
  swayHz: 0,
  phase: 0,
  flicker: false,
  grow: 0,
  ...over,
});

/** Sınıra göre parçacık sayısı: istenen sayı ile üst sınırın küçüğü. */
export const capCount = (want: number, low: boolean): number =>
  Math.max(0, Math.min(want, low ? MAX_PARTICLES_LOW : MAX_PARTICLES));

/**
 * Bir kutlamanın bütün parçacıklarını üretir (w x h alanında). `k`: boyut çarpanı (küçük önizlemede < 1).
 * Konum ve hız px, süre sn. `rand` [0,1) verir (testte sabitlenir).
 */
export function createParticles(
  kind: CelebrationKind,
  w: number,
  h: number,
  low: boolean,
  rand: Rand = Math.random,
  k = 1,
): Particle[] {
  const r = (a: number, b: number): number => a + rand() * (b - a);
  const sp = (): number => Math.floor(rand() * CELEBRATION_SPRITES);
  const out: Particle[] = [];
  const n = (want: number): number => capCount(want, low);
  switch (kind) {
    case "konfeti": {
      for (let i = 0; i < n(110); i++) {
        const ang = -Math.PI / 2 + (rand() - 0.5) * 2.2;
        const s = r(380, 900) * k;
        out.push(
          base({
            sprite: sp(),
            x: w / 2 + r(-0.15, 0.15) * w,
            y: h * 0.3,
            vx: Math.cos(ang) * s,
            vy: Math.sin(ang) * s,
            g: 900 * k,
            drag: 0.45,
            rot: r(0, 6),
            vr: r(-7, 7),
            size: r(26, 44) * k,
            life: 2.4,
          }),
        );
      }
      break;
    }
    case "balon": {
      for (let i = 0; i < n(26); i++) {
        out.push(
          base({
            sprite: sp(),
            delay: r(0, 1.2),
            x: r(0.06, 0.94) * w,
            y: h + 50 * k,
            vy: -r(210, 340) * k,
            sway: r(10, 26) * k,
            swayHz: r(1.4, 2.6),
            phase: r(0, 6.3),
            size: r(54, 84) * k,
            life: (h + 120 * k) / (210 * k) + 0.4,
            grow: 0.2,
          }),
        );
      }
      break;
    }
    case "havai-fisek": {
      const bursts = [0, 0.55, 1.05, 1.6, 2.1];
      const per = low ? 10 : 16;
      for (const at of bursts) {
        const cx = r(0.18, 0.82) * w;
        const cy = r(0.14, 0.46) * h;
        const main = sp();
        for (let i = 0; i < n(per); i++) {
          const ang = (i / per) * Math.PI * 2 + r(-0.15, 0.15);
          const s = r(150, 300) * k;
          out.push(
            base({
              sprite: i % 3 === 0 ? sp() : main,
              delay: at,
              x: cx,
              y: cy,
              vx: Math.cos(ang) * s,
              vy: Math.sin(ang) * s,
              g: 140 * k,
              drag: 0.18,
              rot: ang,
              vr: r(-2, 2),
              size: r(30, 52) * k,
              life: 1.5,
              grow: 0.12,
            }),
          );
        }
      }
      break;
    }
    case "simsek": {
      const strikes = [0, 0.5, 0.95, 1.5, 1.95];
      for (const at of strikes) {
        const x = r(0.12, 0.88) * w;
        const y = r(0.2, 0.5) * h;
        // Çakan şimşek: büyük, titrek, kısa ömürlü.
        out.push(
          base({
            sprite: Math.floor(rand() * 2),
            delay: at,
            x,
            y,
            rot: r(-0.4, 0.4),
            size: r(120, 190) * k,
            life: 0.55,
            flicker: true,
          }),
        );
        const sparks = low ? 4 : 8;
        for (let i = 0; i < n(sparks); i++) {
          const ang = r(0, Math.PI * 2);
          const s = r(120, 280) * k;
          out.push(
            base({
              sprite: 2 + Math.floor(rand() * 2),
              delay: at + 0.08,
              x,
              y,
              vx: Math.cos(ang) * s,
              vy: Math.sin(ang) * s,
              g: 260 * k,
              drag: 0.2,
              vr: r(-5, 5),
              size: r(24, 40) * k,
              life: 0.9,
            }),
          );
        }
      }
      break;
    }
    case "altin-yagmur": {
      for (let i = 0; i < n(80); i++) {
        const vy = r(280, 460) * k;
        out.push(
          base({
            sprite: sp(),
            delay: r(0, 2),
            x: r(0.04, 0.96) * w,
            y: -40 * k,
            vy,
            sway: r(6, 18) * k,
            swayHz: r(2, 4),
            phase: r(0, 6.3),
            rot: r(0, 6),
            vr: r(-5, 5),
            size: r(26, 46) * k,
            life: (h + 80 * k) / vy,
          }),
        );
      }
      break;
    }
  }
  return out.slice(0, low ? MAX_PARTICLES_LOW : MAX_PARTICLES);
}

/** Toplam süre (sn): en geç biten parçacığın sonu. */
export const totalDuration = (ps: readonly Particle[]): number =>
  ps.reduce((m, p) => Math.max(m, p.delay + p.life), 0);

/** Parçacığın t anındaki durumu; henüz doğmadıysa ya da ölmüşse null. */
export function particleAt(p: Particle, t: number): PState | null {
  const age = t - p.delay;
  if (age < 0 || age > p.life) return null;
  // Sönümlü hız: konum = başlangıç + v0 * (1 - e^(-a t)) / a (a = -ln drag) + yer çekimi.
  const a = p.drag < 1 ? -Math.log(p.drag) : 0;
  const slide = a > 0 ? (1 - Math.exp(-a * age)) / a : age;
  const x = p.x + p.vx * slide + p.sway * Math.sin(age * p.swayHz + p.phase);
  const y = p.y + p.vy * slide + 0.5 * p.g * age * age;
  const fadeIn = p.grow > 0 ? Math.min(1, age / p.grow) : 1;
  const fadeOut = Math.min(1, (p.life - age) / Math.max(0.25, p.life * 0.3));
  const flick = p.flicker ? (Math.floor(age * 28) % 2 === 0 ? 1 : 0.45) : 1;
  return {
    x,
    y,
    rot: p.rot + p.vr * age,
    alpha: Math.max(0, Math.min(fadeIn, fadeOut)) * flick,
    size: p.size * (p.grow > 0 ? 0.6 + 0.4 * fadeIn : 1),
  };
}

const lowEnd = (): boolean =>
  (navigator.hardwareConcurrency ?? 8) <= 4 ||
  ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

export const spriteUrl = (asset: string, i: number): string => `/assets/shop/zafer/${asset}-${i + 1}.webp`;

export interface CelebrationOptions {
  /** Bitince baştan başlar (mağaza önizlemesi); durdurma işlevi çağrılana dek sürer. */
  loop?: boolean;
}

/**
 * Kutlamayı `host` içinde oynatır; bitince kendini yok eder. Durdurma işlevi döner (ikinci çağrı zararsız).
 * Hareket azaltmada Pixi hiç yüklenmez: üstte birkaç sabit görsel kısa süre görünür, sonra solar.
 */
export async function playCelebration(
  host: HTMLElement,
  itemId: string,
  opts: CelebrationOptions = {},
): Promise<() => void> {
  const item = cosmeticItem(itemId);
  const kind = item?.type === "zafer" ? celebrationKind(item.asset) : null;
  if (!item?.asset || !kind) return () => {};
  const asset = item.asset;
  if (reducedMotion()) return playStill(host, asset, opts.loop === true);

  const { Application, Assets, Sprite, Texture } = await import("pixi.js");
  const app = new Application();
  await app.init({
    resizeTo: host,
    backgroundAlpha: 0,
    antialias: false,
    preference: "webgl",
    resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    autoDensity: true,
  });
  host.appendChild(app.canvas);
  const w = app.screen.width;
  const h = app.screen.height;
  const k = Math.max(0.45, Math.min(1, Math.min(w, h) / 420));
  const urls = Array.from({ length: CELEBRATION_SPRITES }, (_, i) => spriteUrl(asset, i));
  const textures: InstanceType<typeof Texture>[] = [];
  for (const u of urls) {
    try {
      textures.push(await Assets.load<InstanceType<typeof Texture>>(u));
    } catch {
      // görsel yüklenemezse o parçacık çizilmez
    }
  }

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    app.destroy(true, { children: true });
    for (const u of urls) void Assets.unload(u).catch(() => undefined);
  };
  if (textures.length === 0) {
    dispose();
    return dispose;
  }

  const low = lowEnd();
  let parts = createParticles(kind, w, h, low, Math.random, k);
  let sprites = parts.map((p) => {
    const s = new Sprite(textures[p.sprite % textures.length]);
    s.anchor.set(0.5);
    s.visible = false;
    app.stage.addChild(s);
    return s;
  });
  let end = totalDuration(parts);
  let t = 0;
  app.ticker.add((tk) => {
    // Sekme gizliyken rAF durur; dönüşte büyük bir kare gelirse parçacıklar topluca atlamasın.
    t += Math.min(tk.deltaMS, 50) / 1000;
    parts.forEach((p, i) => {
      const s = sprites[i];
      if (!s) return;
      const st = particleAt(p, t);
      if (!st) {
        s.visible = false;
        return;
      }
      s.visible = true;
      s.x = st.x;
      s.y = st.y;
      s.rotation = st.rot;
      s.alpha = st.alpha;
      const tex = s.texture;
      s.scale.set(st.size / Math.max(1, tex.width));
    });
    if (t > end + 0.1) {
      if (opts.loop) {
        t = -0.9;
        parts = createParticles(kind, w, h, low, Math.random, k);
        for (const s of sprites) s.destroy();
        sprites = parts.map((p) => {
          const s = new Sprite(textures[p.sprite % textures.length]);
          s.anchor.set(0.5);
          s.visible = false;
          app.stage.addChild(s);
          return s;
        });
        end = totalDuration(parts);
      } else dispose();
    }
  });
  return dispose;
}

/** Hareketsiz yedek: birkaç görsel sabit durur, 2,5 sn sonra solar (döngüde kalır). */
function playStill(host: HTMLElement, asset: string, keep: boolean): () => void {
  const box = document.createElement("div");
  box.className = "celebration-still";
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < CELEBRATION_SPRITES; i++) {
    const img = document.createElement("img");
    img.src = spriteUrl(asset, i);
    img.alt = "";
    img.draggable = false;
    img.style.setProperty("--i", String(i));
    box.appendChild(img);
  }
  host.appendChild(box);
  const timer = keep ? null : setTimeout(() => box.remove(), 2600);
  return () => {
    if (timer) clearTimeout(timer);
    box.remove();
  };
}
