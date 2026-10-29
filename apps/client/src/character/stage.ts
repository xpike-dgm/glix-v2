/**
 * Kürsü karakter sahnesi (Pixi, tembel yüklenir): tek tuvalde birden çok karakter; her biri sayfadaki bir yer
 * tutucu elemanın (anchor) kutusuna sığar, ayakları kutunun altında durur. Karakter tek `MeshSimple`: köşeler her
 * karede kemik dönüşümleriyle yeniden hesaplanır (bkz. rig.ts). Kimlik rengi için karaktere renk dönüşü uygulanır.
 */
import type { Application } from "pixi.js";
import { APP_VIEW_ONLY, loadPixi } from "../fx/pixiLoad.js";
import { clapClip } from "./clap.js";
import { clipSeconds, type DanceClip, mapBones, sampleDance, wrapDelta } from "./dance.js";
import { type CharacterKit, loadDance, loadKit } from "./kit.js";
import { createContext, createPuppet, destroyContext, layerIdOf, type Puppet } from "./puppet.js";

/** Karakterin ne yaptığı. */
export type Act =
  | { kind: "dance"; id: string }
  /** 2. ve 3.: alkış ve selam dönüşümlü; `offset` (sn) karakterlerin eşzamanlı alkışlamasını bozar. */
  | { kind: "ovation"; offset: number }
  /** Durağan duruş (azaltılmış hareket, afiş): dansın `at`. saniyesi. */
  | { kind: "still"; id: string; at: number };

export interface StageSlot {
  key: string;
  /** Karakterin sığacağı kutu (ayaklar altta ortada). */
  anchor: HTMLElement;
  layers: readonly string[];
  /** Renk dönüşü (derece); 0 = çizimin kendi camgöbeği. */
  hue: number;
  act: Act;
  /** Soluk çiz (bağlantısı kopuk). */
  dim?: boolean;
}

export interface StageOptions {
  /** Azaltılmış hareket: hiçbir şey oynamaz, yalnız durağan duruş çizilir. */
  reduced: boolean;
  /** En çok bu piksel yoğunluğu (varsayılan 2). */
  maxDpr?: number;
  /** Karakterler tümüyle görününce (belirme bitince) bir kez çağrılır. */
  onShown?: () => void;
}

/** Kare maliyeti ölçümü (geliştirme önizlemesi için). */
export interface StagePerf {
  frames: number;
  /** Karenin JS maliyeti (güncelleme + çizim komutları), ms. */
  avgMs: number;
  maxMs: number;
}

export interface CharacterStage {
  update(slots: readonly StageSlot[]): void;
  destroy(): void;
  perf(): StagePerf;
}

const FADE_S = 0.35;
const BLEND_S = 0.3;
/** Alkış ve selam sırası: kaç döngü sürer. */
const CLAPS = 4;
const WAVES = 2;

interface Live {
  slot: StageSlot;
  puppet: Puppet;
  want: Float32Array;
  t: number;
  age: number;
  /** Etkin klip ve kemik eşlemesi; yüklenene kadar null (dinlenme duruşu). */
  clip: DanceClip | null;
  map: Int16Array | null;
  clipId: string;
  seg: string;
  fromAngles: Float32Array;
  segAge: number;
  angles: Float32Array;
  scratch: Float32Array;
}

const smooth01 = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export async function mountCharacterStage(host: HTMLElement, opts: StageOptions): Promise<CharacterStage> {
  const [kit, pixi] = await Promise.all([loadKit(), loadPixi()]);
  const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr ?? 2);
  const app: Application = new pixi.Application();
  await app.init({
    resizeTo: host,
    backgroundAlpha: 0,
    antialias: dpr < 2,
    preference: "webgl",
    powerPreference: "low-power",
    resolution: dpr,
    autoDensity: true,
    autoStart: false,
  });
  host.appendChild(app.canvas);
  app.canvas.setAttribute("aria-hidden", "true");

  // Atlas bu sahneye özeldir (paylaşılan önbelleğe girmez): sahne kapanırken GPU'dan bırakılır.
  const ctx = createContext(app, kit, pixi);
  const sk = kit.skeleton;
  const nBones = sk.parent.length;
  const fig = kit.figure;
  const figH = fig.bottom - fig.top;
  const figW = fig.right - fig.left;
  const lives = new Map<string, Live>();
  const clap = clapClip();
  const clapMap = mapBones(clap, sk.index);
  let disposed = false;
  let hostBox = host.getBoundingClientRect();

  function makeLive(slot: StageSlot): Live {
    const puppet = createPuppet(ctx, slot.layers);
    puppet.container.alpha = 0;
    app.stage.addChild(puppet.container);
    return {
      slot,
      puppet,
      want: new Float32Array(nBones),
      t: 0,
      age: 0,
      clip: null,
      map: null,
      clipId: "",
      seg: "",
      fromAngles: new Float32Array(nBones),
      segAge: 1,
      angles: new Float32Array(nBones),
      scratch: new Float32Array(32),
    };
  }

  /** Eylemin klibi ve o andaki yerel zamanı; yüklenmemişse null. */
  function resolve(l: Live): { clip: DanceClip; at: number; seg: string } | null {
    const act = l.slot.act;
    if (act.kind === "ovation") {
      const wave = l.clipId === "selam" ? l.clip : null;
      const clapSec = clipSeconds(clap) * CLAPS;
      const waveSec = wave ? clipSeconds(wave) * WAVES : 0;
      const period = clapSec + waveSec;
      const u = (((l.t + act.offset) % period) + period) % period;
      if (u < clapSec || !wave) return { clip: clap, at: u, seg: "alkis" };
      return { clip: wave, at: u - clapSec, seg: "selam" };
    }
    if (!l.clip) return null;
    if (act.kind === "still") return { clip: l.clip, at: act.at, seg: "still" };
    return { clip: l.clip, at: l.t, seg: act.id };
  }

  function ensureClip(l: Live): void {
    const id = l.slot.act.kind === "ovation" ? "selam" : l.slot.act.id;
    if (l.clipId === id) return;
    l.clipId = id;
    l.clip = null;
    l.map = null;
    void loadDance(id)
      .then((c) => {
        if (disposed || l.clipId !== id) return;
        l.clip = c;
        l.map = mapBones(c, sk.index);
        if (opts.reduced) renderOnce();
      })
      .catch(() => {
        // dans dosyası yoksa karakter dinlenme duruşunda kalır
      });
  }

  function place(l: Live): boolean {
    const a = l.slot.anchor;
    const c = l.puppet.container;
    if (!a.isConnected) {
      c.visible = false;
      return false;
    }
    const r = a.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) {
      c.visible = false;
      return false;
    }
    const s = Math.min(r.height / figH, (r.width * 1.3) / figW);
    c.visible = true;
    c.scale.set(s);
    c.position.set(r.left + r.width / 2 - hostBox.left, r.bottom - hostBox.top);
    return true;
  }

  function pickPose(l: Live, dt: number): void {
    const r = resolve(l);
    let rootY = 0;
    const out = l.angles;
    if (r) {
      if (r.seg !== l.seg) {
        // Klip değişti: önceki duruştan yeni duruşa yumuşak geçiş
        l.fromAngles.set(l.angles);
        l.segAge = l.seg === "" ? 1 : 0;
        l.seg = r.seg;
      }
      const map = r.clip === clap ? clapMap : l.map;
      rootY = sampleDance(r.clip, r.at, l.scratch);
      const want = l.want;
      want.fill(0);
      if (map)
        for (let b = 0; b < map.length; b++) {
          const ix = map[b] ?? -1;
          if (ix >= 0) want[ix] = l.scratch[b] ?? 0;
        }
      const w = smooth01(l.segAge / BLEND_S);
      for (let i = 0; i < nBones; i++) {
        const to = want[i] ?? 0;
        const from = l.fromAngles[i] ?? 0;
        out[i] = w >= 1 ? to : from + wrapDelta(to - from) * w;
      }
      l.segAge += dt;
    } else out.fill(0);
    l.puppet.setPose(out, rootY);
  }

  const alphaOf = (l: Live): number => (l.slot.dim ? 0.45 : 1);

  let shown = false;
  function frame(dtS: number): void {
    hostBox = host.getBoundingClientRect();
    for (const l of lives.values()) {
      if (!place(l)) continue;
      if (!opts.reduced) l.t += dtS;
      l.age += dtS;
      l.puppet.container.alpha = (opts.reduced ? 1 : smooth01(l.age / FADE_S)) * alphaOf(l);
      pickPose(l, dtS);
    }
    if (!shown && lives.size > 0 && [...lives.values()].every((l) => l.age >= FADE_S || opts.reduced)) {
      shown = true;
      opts.onShown?.();
    }
  }

  function renderOnce(): void {
    if (disposed) return;
    frame(0);
    for (const l of lives.values()) l.puppet.container.alpha = alphaOf(l);
    app.render();
  }

  let frames = 0;
  let sum = 0;
  let max = 0;
  const tick = (tk: { deltaMS: number }): void => {
    const s = performance.now();
    frame(Math.min(tk.deltaMS, 100) / 1000);
    app.render();
    const d = performance.now() - s;
    frames++;
    sum += d;
    if (d > max) max = d;
  };

  const onVis = (): void => {
    if (opts.reduced) return;
    if (document.hidden) app.ticker.stop();
    else app.ticker.start();
  };
  document.addEventListener("visibilitychange", onVis);
  const ro = new ResizeObserver(() => {
    if (opts.reduced) renderOnce();
  });
  ro.observe(host);

  if (!opts.reduced) {
    app.ticker.maxFPS = 30;
    app.ticker.add(tick);
    if (!document.hidden) app.ticker.start();
  }

  return {
    update(slots) {
      if (disposed) return;
      const keep = new Set<string>();
      for (const slot of slots) {
        keep.add(slot.key);
        let l = lives.get(slot.key);
        if (
          l &&
          l.puppet.layerId !== layerIdOf(slot.layers.filter((x) => sk.rig.wardrobe[x] !== undefined))
        ) {
          l.puppet.destroy();
          lives.delete(slot.key);
          l = undefined;
        }
        if (!l) {
          l = makeLive(slot);
          lives.set(slot.key, l);
        } else l.slot = slot;
        l.puppet.setHue(slot.hue);
        ensureClip(l);
      }
      for (const [key, l] of lives) {
        if (keep.has(key)) continue;
        l.puppet.destroy();
        lives.delete(key);
      }
      if (opts.reduced) renderOnce();
    },
    perf: () => ({ frames, avgMs: frames ? sum / frames : 0, maxMs: max }),
    destroy() {
      if (disposed) return;
      disposed = true;
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      app.ticker.stop();
      for (const l of lives.values()) l.puppet.destroy();
      lives.clear();
      app.destroy(APP_VIEW_ONLY, { children: true, texture: true });
      destroyContext(ctx);
    },
  };
}

export type { CharacterKit };
