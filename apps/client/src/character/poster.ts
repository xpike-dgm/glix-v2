/**
 * Durağan karakter afişleri (mağaza ve dolap karoları): tek kare bir Pixi sahnesinde çizilir, resme çevrilir ve
 * önbelleğe alınır. Izgarada canlı animasyon yoktur. Pixi ve karakter varlıkları tembel yüklenir; afiş sırayla
 * üretilir, iş bitince (kısa bir bekleme sonra) çizim bağlamı bırakılır.
 */
import type { Application } from "pixi.js";
import { posterTime, sampleDance } from "./dance.js";
import { loadDance, loadKit } from "./kit.js";
import { createContext, createPuppet, destroyContext, type PuppetContext } from "./puppet.js";

/** Kadraj: tüm boy, yalnız baş ve omuz (şapka), gövde (üst giysi). */
export type PosterFocus = "full" | "head" | "torso";

export interface PosterRequest {
  /** Giyilen giysi katmanları. */
  layers: readonly string[];
  /** Dans dosyası kimliği; null: dinlenme duruşu. */
  dance: string | null;
  /** Kimlik renk dönüşü (derece). */
  hue: number;
  focus: PosterFocus;
}

const SIZE: Record<PosterFocus, { w: number; h: number }> = {
  full: { w: 220, h: 320 },
  head: { w: 240, h: 240 },
  torso: { w: 240, h: 200 },
};

/** Kadrajın rig koordinatındaki dikdörtgeni (x, y, genişlik, yükseklik). */
function frameRect(
  focus: PosterFocus,
  fig: { top: number; bottom: number; left: number; right: number },
  rootX: number,
) {
  if (focus === "head") return { x: rootX - 125, y: fig.top - 18, w: 250, h: 250 };
  if (focus === "torso") return { x: rootX - 190, y: fig.top + 125, w: 380, h: 316 };
  const w = fig.right - fig.left + 60;
  const h = fig.bottom - fig.top + 40;
  return { x: fig.left - 30, y: fig.top - 20, w, h };
}

const cache = new Map<string, Promise<string>>();
let chain: Promise<unknown> = Promise.resolve();

interface Shared {
  app: Application;
  ctx: PuppetContext;
}
let shared: Promise<Shared> | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;
let pending = 0;

async function open(): Promise<Shared> {
  const [kit, pixi] = await Promise.all([loadKit(), import("pixi.js")]);
  const app = new pixi.Application();
  await app.init({
    width: 240,
    height: 320,
    backgroundAlpha: 0,
    antialias: true,
    preference: "webgl",
    powerPreference: "low-power",
    resolution: 1,
    autoStart: false,
  });
  return { app, ctx: createContext(app, kit, pixi) };
}

function scheduleClose(): void {
  clearTimeout(idle);
  idle = setTimeout(() => {
    if (pending > 0 || !shared) return;
    const s = shared;
    shared = null;
    void s.then((v) => {
      v.app.destroy(true, { children: true, texture: true });
      destroyContext(v.ctx);
    });
  }, 4000);
}

async function draw(req: PosterRequest): Promise<string> {
  shared ??= open();
  const { app, ctx } = await shared;
  const { kit } = ctx;
  const sk = kit.skeleton;
  const size = SIZE[req.focus];
  app.renderer.resize(size.w, size.h);
  const angles = new Float32Array(sk.parent.length);
  if (req.dance) {
    const clip = await loadDance(req.dance);
    const tmp = new Float32Array(clip.bones.length);
    sampleDance(clip, posterTime(clip), tmp);
    clip.bones.forEach((b, i) => {
      const ix = sk.index.get(b);
      if (ix !== undefined) angles[ix] = tmp[i] ?? 0;
    });
  }
  const puppet = createPuppet(ctx, req.layers);
  puppet.setHue(req.hue);
  puppet.setPose(angles, 0);
  const rect = frameRect(req.focus, kit.figure, sk.rig.root[0]);
  const s = Math.min(size.w / rect.w, size.h / rect.h);
  puppet.container.scale.set(s);
  puppet.container.position.set(
    size.w / 2 - (rect.x + rect.w / 2 - sk.rig.root[0]) * s,
    size.h / 2 - (rect.y + rect.h / 2 - kit.figure.bottom) * s,
  );
  app.stage.addChild(puppet.container);
  app.render();
  const canvas = app.renderer.extract.canvas({
    target: app.stage,
    frame: new ctx.pixi.Rectangle(0, 0, size.w, size.h),
    resolution: 1,
  }) as HTMLCanvasElement;
  app.stage.removeChild(puppet.container);
  puppet.destroy();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("afiş resme çevrilemedi");
  return URL.createObjectURL(blob);
}

/** Afişin resim adresi (nesne URL'si); aynı istek bir kez çizilir. Çizilemezse reddeder. */
export function renderPoster(req: PosterRequest): Promise<string> {
  const key = `${req.focus}|${req.dance ?? "-"}|${[...req.layers].sort().join("+")}|${Math.round(req.hue)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  pending++;
  const job = chain
    .catch(() => undefined)
    .then(() => draw(req))
    .finally(() => {
      pending--;
      scheduleClose();
    });
  chain = job;
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}
