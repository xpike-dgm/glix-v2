/**
 * Pixi tarafı: tek karakterin (`Puppet`) ağı, kimlik rengi süzgeci ve duruşu. Sahne (stage.ts, canlı) ve afiş
 * (poster.ts, tek kare) aynı kodu kullanır. Pixi tembel yüklenir: bu dosya yalnız `import type` ile Pixi'ye bağlanır;
 * çalışma anı modülü bağlama (`PuppetContext`) verilir.
 */
import type {
  Application,
  Buffer,
  Container,
  Filter,
  Mesh,
  MeshGeometry,
  Rectangle,
  Shader,
  Texture,
  TextureShader,
} from "pixi.js";
import type { CharacterKit } from "./kit.js";
import type { MeshData } from "./mesh.js";
import { type BonePose, createBonePose, poseBones, skin } from "./rig.js";

type Pixi = typeof import("pixi.js");
/** Özel gölgelendiricili ağ (WebGL) ya da düz `MeshSimple` (yedek). */
type PuppetMesh = Mesh<MeshGeometry, Shader> | Mesh<MeshGeometry, TextureShader>;

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

const ACCENT_VERT = `
in vec2 aPosition;
in vec2 aUV;
in vec2 aTint;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec4 uColor;
out vec2 vUV;
out vec3 vTint;
out vec4 vColor;
void main(void) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  float r = radians(aTint.x);
  vUV = aUV;
  vTint = vec3(cos(r), sin(r), aTint.y);
  vColor = uColor;
}`;

/**
 * Köşe başına renk dönüşü (`aTint`: x = derece, y = 1 ise giysi): tek ağda hem gövde (kimlik rengi) hem her giysi
 * (kendi rengi) boyanır, süzgeç geçişi yoktur. Yalnız canlı (doygun) renkler döner; koyu griler (çizimdeki hafif
 * mavimsi griler, kumaş) olduğu gibi kalır. Giysilerde ek olarak yalnız camgöbeği tonları döner: altın taç, deri,
 * kahverengi gibi diğer canlı renkler kendi renginde kalır.
 */
const ACCENT_FRAG = `
in vec2 vUV;
in vec3 vTint;
in vec4 vColor;
out vec4 finalColor;
uniform sampler2D uTexture;
void main(void) {
  vec4 c = texture(uTexture, vUV);
  if (c.a <= 0.0) { finalColor = vec4(0.0); return; }
  vec3 rgb = c.rgb / c.a;
  float mx = max(rgb.r, max(rgb.g, rgb.b));
  float mn = min(rgb.r, min(rgb.g, rgb.b));
  float s = mx > 0.0 ? (mx - mn) / mx : 0.0;
  float w = smoothstep(0.28, 0.55, s);
  if (vTint.z > 0.5) {
    float ang = degrees(atan(1.7320508 * (rgb.g - rgb.b), 2.0 * rgb.r - rgb.g - rgb.b));
    if (ang < 0.0) ang += 360.0;
    w *= 1.0 - smoothstep(55.0, 80.0, abs(ang - 180.0));
  }
  float cs = vTint.x;
  float sn = vTint.y;
  float a = cs + (1.0 - cs) / 3.0;
  float b = (1.0 - cs) / 3.0 - 0.57735027 * sn;
  float d = (1.0 - cs) / 3.0 + 0.57735027 * sn;
  vec3 rot = clamp(vec3(a * rgb.r + b * rgb.g + d * rgb.b,
                        d * rgb.r + a * rgb.g + b * rgb.b,
                        b * rgb.r + d * rgb.g + a * rgb.b), 0.0, 1.0);
  rgb = mix(rgb, rot, w);
  finalColor = vec4(rgb * c.a, c.a) * vColor;
}`;

/** WebGL dışında (yedek yol): yalnız kimlik rengi, düz renk dönüşüyle; giysi renkleri uygulanmaz. */
function fallbackFilter(ctx: PuppetContext, deg: number): Filter {
  const f = new ctx.pixi.ColorMatrixFilter();
  f.hue(deg, false);
  return f;
}

export interface Puppet {
  container: Container;
  mesh: PuppetMesh;
  /** Giyilen katmanlar (sıralı, tekil): kıyafet kimliği. */
  layerId: string;
  /** Kimlik renk dönüşü (derece); 0 = çizimin camgöbeği. Yalnız gövdenin neonunu boyar. */
  setHue(deg: number): void;
  /** Giysi katmanı -> renk dönüşü (derece); yazılmayan katman çizildiği gibi (camgöbeği) kalır. */
  setTints(tints: Readonly<Record<string, number>>): void;
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
  const container = new Container();
  container.boundsArea = ctx.bounds;
  const layerId = layerIdOf(layers.filter((l) => sk.rig.wardrobe[l] !== undefined));
  let mesh: PuppetMesh;
  let tint: Float32Array | null = null;
  let tintBuffer: Buffer | null = null;
  let shader: Shader | null = null;
  let filter: Filter | null = null;
  let hue = 0;
  let tints: Readonly<Record<string, number>> = {};

  if (ctx.webgl) {
    const { Buffer, BufferUsage, GlProgram, Mesh, MeshGeometry, Shader } = ctx.pixi;
    const geometry = new MeshGeometry({ positions: verts, uvs: data.uvs, indices: data.indices });
    tint = new Float32Array(data.skin.count * 2);
    const buffer = new Buffer({ data: tint, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    geometry.addAttribute("aTint", { buffer, format: "float32x2", stride: 8, offset: 0 });
    tintBuffer = buffer;
    shader = new Shader({
      glProgram: GlProgram.from({ vertex: ACCENT_VERT, fragment: ACCENT_FRAG, name: "glix-accent" }),
      resources: { uTexture: ctx.atlas.source, uSampler: ctx.atlas.source.style },
    });
    mesh = new Mesh({ geometry, shader });
  } else {
    mesh = new MeshSimple({ texture: ctx.atlas, vertices: verts, uvs: data.uvs, indices: data.indices });
  }
  mesh.boundsArea = ctx.bounds;
  mesh.position.set(-sk.rig.root[0], -kit.figure.bottom);
  container.addChild(mesh);

  /** Köşe başına renk dönüşünü yeniden yazar (kimlik rengi ya da giysi rengi değişince). */
  function refreshTint(): void {
    if (!tint || !tintBuffer) return;
    const perLayer = data.layerNames.map((n) => tints[n] ?? 0);
    for (let i = 0; i < data.vertexLayer.length; i++) {
      const li = data.vertexLayer[i] ?? -1;
      tint[i * 2] = li < 0 ? hue : (perLayer[li] ?? 0);
      tint[i * 2 + 1] = li < 0 ? 0 : 1;
    }
    tintBuffer.data = tint;
  }

  return {
    container,
    mesh,
    layerId,
    setHue(deg) {
      const next = Math.abs(deg) < 0.5 ? 0 : deg;
      if (next === hue) return;
      hue = next;
      if (tint) {
        refreshTint();
        return;
      }
      filter?.destroy();
      filter = null;
      container.filters = [];
      if (hue !== 0) {
        filter = fallbackFilter(ctx, hue);
        container.filters = [filter];
        container.filterArea = ctx.bounds;
      }
    },
    setTints(next) {
      tints = next;
      refreshTint();
    },
    setPose(angles, rootY) {
      poseBones(sk, angles, rootY, ctx.pose);
      skin(data.skin, ctx.pose, verts);
      mesh.geometry.positions = verts;
    },
    destroy() {
      container.filters = [];
      filter?.destroy();
      filter = null;
      container.destroy({ children: true });
      shader?.destroy();
      shader = null;
    },
  };
}
