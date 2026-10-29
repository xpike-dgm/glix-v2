#!/usr/bin/env node
// Gelen giysi görsellerini kürsü karakterinin gardırobuna ekler (U18 kürsü giysileri).
//
// Kullanım:
//   node tools/karakter-deneme/giysiEkle.mjs <klasör> [--tasi] [--kuru] [--rig <rig.json>] [--hedef <klasör>]
//
// <klasör>: her ürün için `<kimlik>.json` + parça webp'leri:
//   { "id": "bere", "slot": "sapka",
//     "pieces": [ { "file": "bere-head.webp", "bone": "head", "sourceOrigin": [179, 28], "size": [152, 109],
//                   "layer": "on" | "arka" } ] }
// `sourceOrigin`, rig.json ile aynı (yarım boy, 512x768 tuval) koordinatta parçanın sol üst köşesidir. `layer: "arka"`
// gövdenin ARKASINA çizilir (pelerin, kanat, sırt çantası); "on" kendi kemiğinin hemen önüne.
//
// Ne yapar: parça görsellerini `--hedef`e (varsayılan karakter/giysi) renk/yol kuralına uygun adla kopyalar (ya da
// `--tasi` ile taşır ve kaynak json'u siler), rig.json `wardrobe`ına katmanı yazar (aynı kimlik varsa yerini alır:
// betik yeniden çalıştırılabilir). Her parça için kemiğin pivotuna göre pivot hesaplanır (bkz. pieceRelative).
// Sonunda katalog için gereken satırı ve kostümlerde kapladığı yuvaları (covers) yazar. Ürünü kataloğa
// (packages/engine/src/cosmetics.ts) elle eklersin; testler dosya ve yuva uyumunu denetler.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SLOTS = ["sapka", "ust", "alt", "ayakkabi", "aksesuar", "kostum"];
export const LAYERS = ["on", "arka"];

/**
 * Kemik -> kapladığı giysi yuvası. Kostümün covers'ı bundan türer: kostüm kuşanılınca kapladığı yuvaların giysisi
 * çıkar. packages/engine/src/cosmetics.ts `slotOfBone` ile aynıdır (client testi eşitliği denetler).
 */
export const BONE_SLOT = {
  head: "sapka",
  torso: "ust",
  left_upper_arm: "ust",
  left_forearm: "ust",
  left_hand: "ust",
  right_upper_arm: "ust",
  right_forearm: "ust",
  right_hand: "ust",
  left_thigh: "alt",
  right_thigh: "alt",
  left_shin: "alt",
  right_shin: "alt",
  left_foot: "ayakkabi",
  right_foot: "ayakkabi",
};

/**
 * Parçanın kemiğine göre yerleşimi. Parça tuvalde `sourceOrigin`'dedir, kemiğin görseli kendi `sourceOrigin`'inde ve
 * `pivot` noktasından döner. Parça aynı kemiğe bağlandığı için pivotu, kemik pivotunun parça köşesine göre
 * ofsetidir: pivot = kemikPivot - (parçaKöşe - kemikKöşe). Konum (ebeveyne göre) 0'dır.
 */
export function pieceRelative(pieceOrigin, bone) {
  return {
    pivot: [bone.pivot[0] - (pieceOrigin[0] - bone.sourceOrigin[0]), bone.pivot[1] - (pieceOrigin[1] - bone.sourceOrigin[1])],
    position: [0, 0],
  };
}

/** Kostüm parçalarının kemiklerinden kapladığı yuvalar (sıralı, tekil). */
export function coversOfBones(bones) {
  const out = new Set();
  for (const b of bones) {
    const s = BONE_SLOT[b];
    if (s) out.add(s);
  }
  return SLOTS.filter((s) => out.has(s));
}

const pair = (v) =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));

/** webp dosyasının piksel boyutu (VP8, VP8L, VP8X); okunamazsa null. */
export function webpSize(bytes) {
  if (bytes.length < 30 || bytes.toString("latin1", 0, 4) !== "RIFF" || bytes.toString("latin1", 8, 12) !== "WEBP")
    return null;
  const kind = bytes.toString("latin1", 12, 16);
  if (kind === "VP8X") return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
  if (kind === "VP8L") {
    const b = bytes.readUInt32LE(21);
    return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
  }
  if (kind === "VP8 ") return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  return null;
}

/** Dosya adı: yalnız küçük harf, rakam ve alt çizgi (rig.json yol kuralı). */
const fileStem = (id) => id.replaceAll("-", "_");

/**
 * Bir ürün tanımını doğrular ve rig'e yazılacak katmanı üretir. `readSize(file)`: parça görselinin boyutu (ya da
 * null: doğrulama atlanır). Hata varsa Error fırlatır (mesaj Türkçe, ürün kimliğiyle).
 */
export function layerFromSpec(spec, rigParts, readSize = () => null) {
  const id = spec?.id;
  if (typeof id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new Error(`geçersiz kimlik: ${id}`);
  const fail = (m) => {
    throw new Error(`${id}: ${m}`);
  };
  if (!SLOTS.includes(spec.slot)) fail(`bilinmeyen yuva: ${spec.slot}`);
  if (!Array.isArray(spec.pieces) || spec.pieces.length === 0) fail("parça yok");
  const used = new Map();
  const pieces = [];
  const copies = [];
  for (const p of spec.pieces) {
    const bone = rigParts[p?.bone];
    if (!bone) fail(`bilinmeyen kemik: ${p?.bone}`);
    if (!pair(p.sourceOrigin) || !pair(p.size)) fail(`${p.file}: sourceOrigin/size geçersiz`);
    const layer = p.layer ?? "on";
    if (!LAYERS.includes(layer)) fail(`${p.file}: bilinmeyen katman: ${layer}`);
    if (typeof p.file !== "string" || !p.file.endsWith(".webp")) fail(`parça dosyası .webp olmalı: ${p.file}`);
    const real = readSize(p.file);
    if (real && (real[0] !== p.size[0] || real[1] !== p.size[1]))
      fail(`${p.file}: görsel ${real.join("x")}, json ${p.size.join("x")}`);
    let stem = `${fileStem(id)}_${p.bone}${layer === "arka" ? "_arka" : ""}`;
    const n = (used.get(stem) ?? 0) + 1;
    used.set(stem, n);
    if (n > 1) stem = `${stem}_${n}`;
    const out = `giysi/${stem}.webp`;
    const rel = pieceRelative(p.sourceOrigin, bone);
    pieces.push({
      file: out,
      size: [p.size[0], p.size[1]],
      pivot: rel.pivot,
      parent: p.bone,
      bone: p.bone,
      position: rel.position,
      rotation: 0,
      drawAfter: p.bone,
      layer,
      sourceOrigin: [p.sourceOrigin[0], p.sourceOrigin[1]],
    });
    copies.push({ from: p.file, to: out });
  }
  const covers = spec.slot === "kostum" ? coversOfBones(pieces.map((q) => q.bone)) : undefined;
  return { id, layer: { visible: true, slot: spec.slot, pieces }, copies, covers };
}

/** rig.json'u okunur yazar: nesneler 1 boşluk girintili, sayı dizileri tek satır. */
export function formatRig(value, depth = 0) {
  const pad = " ".repeat(depth + 1);
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== "object" || v === null)) return `[${value.map((v) => JSON.stringify(v)).join(", ")}]`;
    return `[\n${value.map((v) => pad + formatRig(v, depth + 1)).join(",\n")}\n${" ".repeat(depth)}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    return `{\n${keys.map((k) => `${pad}${JSON.stringify(k)}: ${formatRig(value[k], depth + 1)}`).join(",\n")}\n${" ".repeat(depth)}}`;
  }
  return JSON.stringify(value);
}

/** Klasördeki tüm ürünleri rig nesnesine ekler (rig yerinde değiştirilir). Döner: eklenen ürünlerin özeti. */
export function addAll(rig, specs, readSize) {
  const done = [];
  rig.wardrobe ??= {};
  for (const spec of specs) {
    const r = layerFromSpec(spec, rig.parts, (f) => readSize(spec.id, f));
    rig.wardrobe[r.id] = r.layer;
    done.push(r);
  }
  return done;
}

function main(argv) {
  const args = argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return null;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
  const here = dirname(fileURLToPath(import.meta.url));
  const karakter = resolve(here, "../../apps/client/public/assets/karakter");
  const rigPath = resolve(flag("--rig") ?? join(karakter, "rig.json"));
  const hedef = resolve(flag("--hedef") ?? join(karakter, "giysi"));
  const tasi = args.includes("--tasi");
  const kuru = args.includes("--kuru");
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) {
    console.error("kullanım: node tools/karakter-deneme/giysiEkle.mjs <klasör> [--tasi] [--kuru] [--rig yol] [--hedef klasör]");
    process.exit(2);
  }
  const src = resolve(dir);
  const files = readdirSync(src).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) {
    console.error(`${src}: ürün json'u yok`);
    process.exit(1);
  }
  const specs = files.map((f) => JSON.parse(readFileSync(join(src, f), "utf8")));
  const rig = JSON.parse(readFileSync(rigPath, "utf8"));
  const sizes = new Map();
  const readSize = (id, f) => {
    const p = join(src, f);
    if (!existsSync(p)) throw new Error(`${id}: parça dosyası yok: ${f}`);
    const s = webpSize(readFileSync(p));
    sizes.set(p, s);
    return s;
  };
  const done = addAll(rig, specs, readSize);
  if (kuru) {
    for (const d of done) console.log(`[kuru] ${d.id} (${d.layer.slot}): ${d.layer.pieces.length} parça`);
    return;
  }
  mkdirSync(hedef, { recursive: true });
  for (const d of done) {
    for (const c of d.copies) {
      const from = join(src, c.from);
      copyFileSync(from, join(hedef, basename(c.to)));
      if (tasi) rmSync(from);
    }
  }
  if (tasi) for (const f of files) rmSync(join(src, f));
  writeFileSync(rigPath, `${formatRig(rig)}\n`);
  for (const d of done) {
    const cov = d.covers ? `, covers: ${JSON.stringify(d.covers)}` : "";
    console.log(`+ ${d.id} (${d.layer.slot}): ${d.layer.pieces.length} parça${cov}`);
    console.log(`  katalog: item("<tür>-${d.id}", "${d.layer.slot}", "<nadirlik>", "<Ad>", "<açıklama>", "${d.id}"${d.covers ? `, ${JSON.stringify(d.covers)}` : ""}),`);
  }
  if (tasi && readdirSync(src).length === 0) rmSync(src, { recursive: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
