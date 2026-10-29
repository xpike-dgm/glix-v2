import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildKit, type KitIO } from "./kit.js";
import { parseRig } from "./rig.js";

const rigJson: unknown = JSON.parse(
  readFileSync(new URL("../../public/assets/karakter/rig.json", import.meta.url), "utf8"),
);
const rig = parseRig(rigJson);
if (!rig) throw new Error("rig");

const sizes = new Map<string, [number, number]>();
for (const p of rig.parts) sizes.set(p.file, [p.size[0], p.size[1]]);
for (const pieces of Object.values(rig.wardrobe))
  for (const q of pieces) sizes.set(q.file, [q.size[0], q.size[1]]);

const LAYERS = Object.keys(rig.wardrobe);
const A = LAYERS[0] ?? "";
const B = LAYERS[1] ?? "";
const fileOf = (layer: string): string => rig.wardrobe[layer]?.[0]?.file ?? "";

/** Sahte ağ ve tuval: hangi görsel kaç kez istendi, hangileri (kaç kez) başarısız olacak. */
function fakeIO(failures: Record<string, number> = {}) {
  const requested: string[] = [];
  const left = { ...failures };
  let draws = 0;
  const io: KitIO = {
    json: async () => rigJson,
    image: async (url) => {
      requested.push(url);
      const file = url.replace(/^.*karakter\//, "");
      if ((left[file] ?? 0) > 0) {
        left[file] = (left[file] ?? 0) - 1;
        throw new Error("ağ yok");
      }
      const s = sizes.get(file);
      if (!s) throw new Error("bilinmeyen görsel");
      return { width: s[0], height: s[1] } as unknown as HTMLImageElement;
    },
    canvas: (w, h) =>
      ({
        width: w,
        height: h,
        getContext: () => ({
          drawImage: () => {
            draws++;
          },
          getImageData: (_x: number, _y: number, w2: number, h2: number) => ({
            data: new Uint8ClampedArray(w2 * h2 * 4).fill(255),
          }),
        }),
      }) as unknown as HTMLCanvasElement,
  };
  return { io, requested, draws: () => draws };
}

const count = (requested: string[], file: string): number => requested.filter((u) => u.endsWith(file)).length;

describe("karakter takımı: giysiler tembel yüklenir", () => {
  it("yalnız gövde yüklenir; giysi görseli istenmez", async () => {
    const { io, requested } = fakeIO();
    const kit = await buildKit(io);
    expect(requested.length).toBe(rig.parts.length);
    expect(requested.some((u) => u.includes("/giysi/"))).toBe(false);
    expect(kit.layersReady([A])).toBe(false);
    expect(kit.figure.bottom).toBeGreaterThan(kit.figure.top);
  });

  it("bilinmeyen katman hazır sayılır ve hiçbir şey indirmez", async () => {
    const { io, requested } = fakeIO();
    const kit = await buildKit(io);
    const n = requested.length;
    expect(kit.layersReady(["yok-boyle-bir-sey"])).toBe(true);
    await kit.ensureLayers(["yok-boyle-bir-sey"]);
    expect(requested.length).toBe(n);
  });

  it("katman istenince yalnız onun görselleri iner; geometri ve ağ oluşur", async () => {
    const { io, requested } = fakeIO();
    const kit = await buildKit(io);
    const bare = kit.meshFor([A]);
    expect(bare.layerNames).toEqual([]);
    const v0 = kit.atlasVersion();
    await kit.ensureLayers([A]);
    const pieces = rig.wardrobe[A]?.length ?? 0;
    expect(requested.filter((u) => u.includes("/giysi/")).length).toBe(pieces);
    expect(requested.some((u) => u.endsWith(fileOf(B)))).toBe(false);
    expect(kit.atlasVersion()).toBe(v0 + 1);
    expect(kit.layersReady([A])).toBe(true);
    expect(kit.meshFor([A]).layerNames).toEqual([A]);
    expect(kit.meshFor([A]).indices.length).toBeGreaterThan(bare.indices.length);
  });

  it("aynı katman için eşzamanlı istekler tek yüklemeyi paylaşır; sonrası önbellekten", async () => {
    const { io, requested } = fakeIO();
    const kit = await buildKit(io);
    await Promise.all([kit.ensureLayers([A]), kit.ensureLayers([A, B]), kit.ensureLayers([A])]);
    await kit.ensureLayers([A, B]);
    expect(count(requested, fileOf(A))).toBe(1);
    expect(count(requested, fileOf(B))).toBe(1);
  });

  it("yüklenemeyen katman çizimden çıkar, karakter bozulmaz; sonraki istek yeniden dener", async () => {
    const { io, requested } = fakeIO({ [fileOf(A)]: 1 });
    const kit = await buildKit(io);
    await expect(kit.ensureLayers([A, B])).resolves.toBeUndefined();
    expect(kit.layersReady([A])).toBe(false);
    expect(kit.layersReady([B])).toBe(true);
    // A olmadan çizilir: ağ yalnız B'yi (ve gövdeyi) içerir.
    expect(kit.meshFor([A, B]).layerNames).toEqual([B]);
    expect(kit.drawable([A, B])).toEqual([B]);
    await kit.ensureLayers([A]);
    expect(count(requested, fileOf(A))).toBe(2);
    expect(kit.meshFor([A, B]).layerNames.sort()).toEqual([A, B].sort());
  });

  it("katmanın bir parçası inmezse hiçbiri atlasa çizilmez (ya hep ya hiç)", async () => {
    const multi = LAYERS.find((l) => (rig.wardrobe[l]?.length ?? 0) > 1);
    if (!multi) return;
    const last = rig.wardrobe[multi]?.at(-1)?.file ?? "";
    const { io, draws } = fakeIO({ [last]: 1 });
    const kit = await buildKit(io);
    const d0 = draws();
    await kit.ensureLayers([multi]);
    expect(draws()).toBe(d0);
    expect(kit.layersReady([multi])).toBe(false);
  });

  it("görsel boyutu rig ile uyuşmazsa katman yüklenmiş sayılmaz", async () => {
    const { io } = fakeIO();
    const bad: KitIO = {
      ...io,
      image: async (url) => {
        const im = await io.image(url);
        return url.endsWith(fileOf(A))
          ? ({ width: im.width + 1, height: im.height } as HTMLImageElement)
          : im;
      },
    };
    const kit = await buildKit(bad);
    await kit.ensureLayers([A]);
    expect(kit.layersReady([A])).toBe(false);
  });

  it("gövde yüklenemezse takım kurulamaz (çağıran yeniden dener)", async () => {
    const body = rig.parts[0]?.file ?? "";
    const { io } = fakeIO({ [body]: 1 });
    await expect(buildKit(io)).rejects.toThrow();
    await expect(buildKit(io)).resolves.toBeDefined();
  });

  it("ağ önbelleği yüklü birleşime göre anahtarlanır: yüklenince yeni ağ gelir", async () => {
    const { io } = fakeIO();
    const kit = await buildKit(io);
    const before = kit.meshFor([A]);
    expect(kit.meshFor([A])).toBe(before);
    await kit.ensureLayers([A]);
    const after = kit.meshFor([A]);
    expect(after).not.toBe(before);
    expect(kit.meshFor([A])).toBe(after);
  });
});
