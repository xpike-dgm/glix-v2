import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clapClip } from "./clap.js";
import {
  buildSkeleton,
  buildSkinData,
  createBonePose,
  parseRig,
  poseBones,
  type Skeleton,
  skin,
  vertexWeights,
} from "./rig.js";

const RIG_PATH = new URL("../../public/assets/karakter/rig.json", import.meta.url);
const rigRaw: unknown = JSON.parse(readFileSync(RIG_PATH, "utf8"));
const rig = parseRig(rigRaw);
if (!rig) throw new Error("rig.json geçersiz");
const sk: Skeleton = buildSkeleton(rig);
const ix = (n: string): number => sk.index.get(n) ?? -1;

describe("iskelet", () => {
  it("rig.json doğrulanır; ebeveyn her zaman çocuktan önce gelir; 14 gövde parçası", () => {
    expect(rig.parts).toHaveLength(14);
    expect(rig.canvas).toEqual([512, 768]);
    rig.parts.forEach((p, i) => {
      if (p.parent !== "root") expect(ix(p.parent)).toBeLessThan(i);
    });
    expect(Object.keys(rig.wardrobe).sort()).toEqual([
      "astronot",
      "atki",
      "bere",
      "bot",
      "ceket",
      "deri-ceket",
      "esofman",
      "etek",
      "forma",
      "fotr",
      "gunes-gozlugu",
      "kanat",
      "kapusonlu",
      "kargo",
      "kaykay",
      "kimono",
      "kolye",
      "korsan",
      "korsan-kaptan",
      "kot",
      "kovboy",
      "kulaklikli-kask",
      "neon-cizme",
      "ninja",
      "parti",
      "paten",
      "pelerin",
      "robot",
      "sapka",
      "sirt-cantasi",
      "smokin",
      "sort",
      "spor",
      "super-kahraman",
      "tac",
      "takim-pantolon",
      "terlik",
      "yagmurluk",
      "zirh-yelek",
    ]);
  });

  it("bozuk iskelet reddedilir", () => {
    expect(parseRig(null)).toBeNull();
    expect(parseRig({ ...(rigRaw as object), format: "x" })).toBeNull();
    const bad = JSON.parse(JSON.stringify(rigRaw));
    bad.parts.torso.file = "../../etc/passwd";
    expect(parseRig(bad)).toBeNull();
    const loop = JSON.parse(JSON.stringify(rigRaw));
    loop.parts.torso.parent = "head";
    expect(parseRig(loop)).toBeNull();
    const nobone = JSON.parse(JSON.stringify(rigRaw));
    nobone.wardrobe.sapka.pieces[0].bone = "yok";
    expect(parseRig(nobone)).toBeNull();
    const noslot = JSON.parse(JSON.stringify(rigRaw));
    delete noslot.wardrobe.sapka.slot;
    expect(parseRig(noslot)).toBeNull();
    const nolayer = JSON.parse(JSON.stringify(rigRaw));
    nolayer.wardrobe.sapka.pieces[0].layer = "yan";
    expect(parseRig(nolayer)).toBeNull();
  });

  it("arka katman parçası behind olur, varsayılan on", () => {
    const raw = JSON.parse(JSON.stringify(rigRaw));
    raw.wardrobe.sapka.pieces[0].layer = "arka";
    expect(parseRig(raw)?.wardrobe.sapka?.[0]?.behind).toBe(true);
    expect(rig.wardrobe.sapka?.[0]?.behind).toBe(false);
    expect(rig.wardrobe.sapka?.[0]?.slot).toBe("sapka");
    expect(rig.wardrobe.ceket?.[0]?.slot).toBe("ust");
  });

  it("dinlenme duruşu: açılar sıfırken eklemler dinlenme konumunda", () => {
    const pose = createBonePose(sk.parent.length);
    poseBones(sk, new Float32Array(sk.parent.length), 0, pose);
    for (let i = 0; i < sk.parent.length; i++) {
      expect(pose.x[i]).toBeCloseTo(sk.restX[i] ?? 0, 3);
      expect(pose.y[i]).toBeCloseTo(sk.restY[i] ?? 0, 3);
    }
  });

  it("kök kayması tüm gövdeyi aşağı taşır; ebeveyn dönüşü çocuğu taşır", () => {
    const n = sk.parent.length;
    const pose = createBonePose(n);
    const a = new Float32Array(n);
    poseBones(sk, a, 12, pose);
    expect(pose.y[ix("head")]).toBeCloseTo((sk.restY[ix("head")] ?? 0) + 12, 3);
    a[ix("torso")] = 90; // gövde 90 derece (saat yönü) döner: baş (yukarıda) sağa gider
    poseBones(sk, a, 0, pose);
    const headRest = sk.restX[ix("head")] ?? 0;
    expect((pose.x[ix("head")] ?? 0) - (sk.restX[ix("torso")] ?? 0)).toBeGreaterThan(100);
    expect(headRest).toBeCloseTo(sk.restX[ix("torso")] ?? 0, 3);
  });
});

describe("köşe ağırlıkları", () => {
  it("ağırlıklar toplamı 1; kemik dizinleri geçerli", () => {
    for (let y = 0; y < 768; y += 7)
      for (let x = 0; x < 512; x += 7)
        for (const bone of [ix("torso"), ix("left_forearm"), ix("right_shin"), ix("head")]) {
          const w = vertexWeights(sk, x, y, bone);
          expect(w.w0 + w.w1).toBeCloseTo(1, 5);
          expect(w.b0).toBeGreaterThanOrEqual(0);
          expect(w.b1).toBeGreaterThanOrEqual(0);
        }
  });

  it("eklem sürekliliği: ebeveyn ve çocuk parçanın aynı konumdaki köşesi aynı yere gider (dikiş yok)", () => {
    const n = sk.parent.length;
    const pose = createBonePose(n);
    // Rastgele ama sabit duruşlar (tohumlu).
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let trial = 0; trial < 6; trial++) {
      const angles = Float32Array.from({ length: n }, () => (rnd() - 0.5) * 140);
      poseBones(sk, angles, (rnd() - 0.5) * 30, pose);
      for (let c = 0; c < n; c++) {
        const radius = sk.radius[c] ?? 0;
        const parent = sk.parent[c] ?? -1;
        if (radius === 0 || parent < 0) continue;
        // eklem bölgesinin (1,5 yarıçap) içinde, ızgara aralığıyla dizilmiş noktalar
        for (let dy = -radius * 1.5; dy <= radius * 1.5; dy += 5)
          for (let dx = -radius * 1.5; dx <= radius * 1.5; dx += 5) {
            if (Math.hypot(dx, dy) > radius * 1.45) continue;
            const x = (sk.restX[c] ?? 0) + dx;
            const y = (sk.restY[c] ?? 0) + dy;
            const out = new Float32Array(4);
            const rest = Float32Array.from([x, y, x, y]);
            const data = buildSkinData(sk, rest, [
              vertexWeights(sk, x, y, parent),
              vertexWeights(sk, x, y, c),
            ]);
            skin(data, pose, out);
            expect(out[0]).toBeCloseTo(out[2] ?? 0, 3);
            expect(out[1]).toBeCloseTo(out[3] ?? 0, 3);
          }
      }
    }
  });

  it("alkış klibinin kemikleri iskelette var", () => {
    for (const b of clapClip().bones) expect(sk.index.has(b)).toBe(true);
  });
});
