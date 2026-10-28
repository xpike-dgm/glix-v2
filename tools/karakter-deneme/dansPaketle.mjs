// glix-dance-2 (bvh2dance.py çıktısı, 30 fps, her kare açık yazılı) -> glix-dance-3 (üretim, küçük).
//   node tools/karakter-deneme/dansPaketle.mjs <klasör>     klasördeki her *.json yerinde dönüştürülür
// glix-dance-3: { format, fps, loop, bones: [kemik adları], y: [kök y, 0,1 px], a: [kare başına kemik başına 0,1 derece] }
//  - yalnız oynayan kemikler (eller ve ayaklar hiç oynamıyor), 0,1 derece/0,1 px tamsayı
//  - kare sayısı yarıya iner (ara kareler doğrusal; açılar 360 sarmasıyla); tempo korunur: fps = kare / süre
// Zaten glix-dance-3 olan dosyalar olduğu gibi kalır (tekrar çalıştırmak zararsız).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("kullanım: node dansPaketle.mjs <klasör>");

const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

for (const name of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
  const path = join(dir, name);
  const src = JSON.parse(readFileSync(path, "utf8"));
  if (src.format === "glix-dance-3") continue;
  if (src.format !== "glix-dance-2") throw new Error(`${name}: bilinmeyen biçim ${src.format}`);
  const n = src.frames.length;
  const all = Object.keys(src.frames[0].angles);
  const moving = all.filter((b) => {
    const v = src.frames.map((f) => f.angles[b]);
    return Math.max(...v) - Math.min(...v) > 0.5;
  });
  const m = Math.ceil(n / 2);
  const at = (i) => src.frames[((i % n) + n) % n];
  const y = [];
  const a = [];
  for (let k = 0; k < m; k++) {
    const t = (k * n) / m;
    const i = Math.floor(t);
    const f = t - i;
    const p = at(i);
    const q = at(i + 1);
    y.push(Math.round((p.root.y + (q.root.y - p.root.y) * f) * 10));
    for (const b of moving) {
      const d = wrap(q.angles[b] - p.angles[b]);
      a.push(Math.round(wrap(p.angles[b] + d * f) * 10));
    }
  }
  const fps = Math.round(((m * src.fps) / n) * 1000) / 1000;
  writeFileSync(path, JSON.stringify({ format: "glix-dance-3", fps, loop: src.loop !== false, bones: moving, y, a }));
  console.log(`${name}: ${n} kare -> ${m} kare, ${moving.length} kemik, ${fps} fps`);
}
