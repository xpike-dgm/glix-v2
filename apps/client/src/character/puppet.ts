/**
 * Pixi tarafı: tek karakterin (`Puppet`) ağı, kimlik rengi süzgeci ve duruşu. Sahne (stage.ts, canlı) ve afiş
 * (poster.ts, tek kare) aynı kodu kullanır. Pixi tembel yüklenir: bu dosya yalnız `import type` ile Pixi'ye bağlanır;
 * çalışma anı modülü bağlama (`PuppetContext`) verilir.
 */
import type { Application, Container, Filter, MeshSimple, Rectangle, Texture } from "pixi.js";
import type { CharacterKit } from "./kit.js";
import { hueMatrix } from "./look.js";
import type { MeshData } from "./mesh.js";
import { type BonePose, createBonePose, poseBones, skin } from "./rig.js";

type Pixi = typeof import("pixi.js");

export interface PuppetContext {
  pixi: Pixi;
  kit: CharacterKit;
  /** Bu bağlama özel atlas dokusu (kapanırken `destroyContext` ile bırakılır). */
  atlas: Texture;
  webgl: boolean;
  pose: BonePose;
  /** Karakter kapsayıcısının yerel uzayında (x = 0 gövde ekseni, y = 0 ayak çizgisi) çizim sınırı. */
  bounds: Rectangle;
}

export function createContext(app: Application, kit: CharacterKit, pixi: Pixi): PuppetContext {
  const { CanvasSource, Rectangle, Texture } = pixi;
  const webgl = app.renderer.name === "webgl";
  const atlas = new Texture({
    source: new CanvasSource({ resource: kit.atlas, autoGenerateMipmaps: webgl, scaleMode: "linear" }),
  });
  const fig = kit.figure;
  const figH = fig.bottom - fig.top;
  const figW = fig.right - fig.left;
  const bounds = new Rectangle(
    fig.left - kit.skeleton.rig.root[0] - 160,
    -figH - 160,
    figW + 320,
    figH + 160 + 320,
  );
  return { pixi, kit, atlas, webgl, pose: createBonePose(kit.skeleton.parent.length), bounds };
}

export function destroyContext(ctx: PuppetContext): void {
  ctx.atlas.destroy(true);
}

const ACCENT_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform mat3 uRot;
uniform vec2 uSat;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a <= 0.0) { finalColor = c; return; }
  vec3 rgb = c.rgb / c.a;
  float mx = max(rgb.r, max(rgb.g, rgb.b));
  float mn = min(rgb.r, min(rgb.g, rgb.b));
  float s = mx > 0.0 ? (mx - mn) / mx : 0.0;
  vec3 rot = clamp(uRot * rgb, 0.0, 1.0);
  rgb = mix(rgb, rot, smoothstep(uSat.x, uSat.y, s));
  finalColor = vec4(rgb * c.a, c.a);
}`;

/**
 * Kimlik rengi süzgeci: yalnız canlı (doygun) renkleri gri eksen çevresinde döndürür; koyu griler olduğu gibi kalır
 * (çizimdeki griler hafif mavimsidir, düz matrisle döndürülünce zeytin yeşiline çalar). WebGL dışında düz renk dönüşü.
 */
export function accentFilter(ctx: PuppetContext, deg: number): Filter {
  const { ColorMatrixFilter, Filter, GlProgram, defaultFilterVert } = ctx.pixi;
  if (!ctx.webgl) {
    const f = new ColorMatrixFilter();
    f.hue(deg, false);
    return f;
  }
  const m = hueMatrix(deg);
  // GLSL mat3 sütun sıralıdır.
  const col = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]] as const;
  return new Filter({
    glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: ACCENT_FRAG, name: "glix-accent" }),
    resources: {
      accent: {
        uRot: { value: Float32Array.from(col), type: "mat3x3<f32>" },
        uSat: { value: Float32Array.from([0.28, 0.55]), type: "vec2<f32>" },
      },
    },
  });
}

export interface Puppet {
  container: Container;
  mesh: MeshSimple;
  /** Giyilen katmanlar (sıralı, tekil): kıyafet kimliği. */
  layerId: string;
  /** Kimlik renk dönüşü (derece); 0 = çizimin camgöbeği. */
  setHue(deg: number): void;
  /** Yerel açılar (iskelet sırası, derece) ve kök kayması ile duruş verir. */
  setPose(angles: ArrayLike<number>, rootY: number): void;
  destroy(): void;
}

export const layerIdOf = (layers: readonly string[]): string => [...new Set(layers)].sort().join("+");

export function createPuppet(ctx: PuppetContext, layers: readonly string[]): Puppet {
  const { Container, MeshSimple } = ctx.pixi;
  const { kit } = ctx;
  const sk = kit.skeleton;
  const data: MeshData = kit.meshFor(layers);
  const verts = new Float32Array(data.rest);
  const mesh = new MeshSimple({ texture: ctx.atlas, vertices: verts, uvs: data.uvs, indices: data.indices });
  mesh.boundsArea = ctx.bounds;
  mesh.position.set(-sk.rig.root[0], -kit.figure.bottom);
  const container = new Container();
  container.boundsArea = ctx.bounds;
  container.addChild(mesh);
  let filter: Filter | null = null;
  let hue = 0;
  return {
    container,
    mesh,
    layerId: layerIdOf(layers.filter((l) => sk.rig.wardrobe[l] !== undefined)),
    setHue(deg) {
      if (Math.abs(deg) < 0.5) {
        if (filter) {
          container.filters = [];
          filter.destroy();
          filter = null;
          hue = 0;
        }
        return;
      }
      if (filter && hue === deg) return;
      filter?.destroy();
      filter = accentFilter(ctx, deg);
      hue = deg;
      container.filters = [filter];
      container.filterArea = ctx.bounds;
    },
    setPose(angles, rootY) {
      poseBones(sk, angles, rootY, ctx.pose);
      skin(data.skin, ctx.pose, verts);
      mesh.vertices = verts;
    },
    destroy() {
      container.filters = [];
      filter?.destroy();
      filter = null;
      container.destroy({ children: true });
    },
  };
}
