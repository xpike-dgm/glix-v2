import { describe, expect, it } from "vitest";
import { CLAP_FRAMES, clapClip } from "./clap.js";
import { type DanceClip, mapBones, parseDance, posterTime, sampleDance, wrapDelta } from "./dance.js";

/** 4 karelik, tek kemikli, 4 kare/sn'lik küçük klip: açılar derece x10. */
function raw(a: number[], y: number[] = [0, 0, 0, 0], extra: Record<string, unknown> = {}) {
  return { format: "glix-dance-3", fps: 4, loop: true, bones: ["torso"], y, a, ...extra };
}
const clip = (a: number[], extra: Record<string, unknown> = {}): DanceClip => {
  const c = parseDance(raw(a, [0, 10, 20, 30], extra));
  if (!c) throw new Error("klip");
  return c;
};

describe("dans dosyası doğrulaması", () => {
  it("geçerli dosya 0,1 derece/0,1 piksel birimlerinden çözülür", () => {
    const c = parseDance(raw([100, 200, -50, 0], [0, 10, 20, 30]));
    expect(c?.frames).toBe(4);
    expect(c?.fps).toBe(4);
    expect(Array.from(c?.angles ?? [])).toEqual([10, 20, -5, 0]);
    expect(Array.from(c?.rootY ?? [])).toEqual([0, 1, 2, 3]);
    expect(c?.loop).toBe(true);
  });

  it("bozuk dosyalar reddedilir", () => {
    expect(parseDance(null)).toBeNull();
    expect(parseDance({ ...raw([1, 2, 3, 4]), format: "glix-dance-2" })).toBeNull();
    expect(parseDance(raw([1, 2, 3]))).toBeNull(); // kare x kemik uyuşmuyor
    expect(parseDance(raw([1, 2, 3, Number.NaN]))).toBeNull();
    expect(parseDance(raw([1, 2, 3, 4], [0, 0, 0, 0], { fps: 0 }))).toBeNull();
    expect(parseDance(raw([1, 2, 3, 4], [0, 0, 0, 0], { bones: ["../x"] }))).toBeNull();
    expect(parseDance(raw([1, 2, 3, 4], [0, 0, 0, 0], { bones: [] }))).toBeNull();
    expect(parseDance(raw([1, "2", 3, 4] as number[]))).toBeNull();
  });
});

describe("örnekleme", () => {
  it("kareler arası doğrusal; kök kayması da aynı oranda", () => {
    const c = clip([0, 100, 200, 300]);
    const out = new Float32Array(1);
    const y = sampleDance(c, 0.125, out); // kare 0,5
    expect(out[0]).toBeCloseTo(5, 5);
    expect(y).toBeCloseTo(0.5, 5);
  });

  it("açı farkı 360 sarmasıyla en kısa yoldan alınır (350 -> 10 derece, 20 derece fark)", () => {
    expect(wrapDelta(10 - 350)).toBe(20);
    expect(wrapDelta(350 - 10)).toBe(-20);
    const c = clip([-100, 100, 0, 0]); // -10 -> 10
    const out = new Float32Array(1);
    sampleDance(c, 0.125, out);
    expect(out[0]).toBeCloseTo(0, 5);
    const w = clip([1700, -1700, 0, 0]); // 170 -> -170: 20 derece fark, 180 üstünden
    sampleDance(w, 0.125, out);
    expect(Math.abs(out[0] ?? 0)).toBeCloseTo(180, 4);
  });

  it("döngü: son kare ilk kareye harmanlanır, zaman sarar", () => {
    const c = clip([0, 100, 200, 300]);
    const out = new Float32Array(1);
    sampleDance(c, 0.875, out); // kare 3,5: 30 -> 0
    expect(out[0]).toBeCloseTo(15, 5);
    sampleDance(c, 1 + 0.25, out); // süre 1 sn: 1,25 sn = 0,25 sn
    expect(out[0]).toBeCloseTo(10, 5);
    sampleDance(c, -0.25, out); // negatif zaman geriden sarar
    expect(out[0]).toBeCloseTo(30, 5);
  });

  it("döngü olmayan klip son karede kalır", () => {
    const c = clip([0, 100, 200, 300], { loop: false });
    const out = new Float32Array(1);
    sampleDance(c, 99, out);
    expect(out[0]).toBeCloseTo(30, 5);
    sampleDance(c, -5, out);
    expect(out[0]).toBeCloseTo(0, 5);
  });

  it("afiş karesi ortalama duruştan en uzak kare", () => {
    const c = clip([0, 0, 900, 0]);
    expect(posterTime(c)).toBeCloseTo(2 / 4, 5);
  });

  it("kemik eşlemesi: iskeletteki dizin ya da -1", () => {
    const c = clip([0, 0, 0, 0]);
    expect(Array.from(mapBones(c, new Map([["torso", 3]])))).toEqual([3]);
    expect(Array.from(mapBones(c, new Map()))).toEqual([-1]);
  });
});

describe("alkış (kodla yazılmış)", () => {
  it("döngü klibi: kare sayısı, simetri, açılar makul", () => {
    const c = clapClip();
    expect(c.frames).toBe(CLAP_FRAMES);
    expect(c.loop).toBe(true);
    expect(c.angles.length).toBe(c.frames * c.bones.length);
    for (const a of c.angles) expect(Math.abs(a)).toBeLessThan(180);
    // sol ve sağ kol aynalıdır
    const k = c.bones.length;
    const l = c.bones.indexOf("left_upper_arm");
    const r = c.bones.indexOf("right_upper_arm");
    for (let f = 0; f < c.frames; f++)
      expect(c.angles[f * k + l]).toBeCloseTo(-(c.angles[f * k + r] ?? 0), 5);
    // vuruş (kare 0) ile tam açık (kare 4) farklı
    const el = c.bones.indexOf("left_hand");
    expect(c.angles[el]).not.toBeCloseTo(c.angles[4 * k + el] ?? 0, 1);
  });
});
