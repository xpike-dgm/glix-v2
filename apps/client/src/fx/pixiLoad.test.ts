import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("Pixi yükleme", () => {
  it("içerik politikası unsafe-eval vermediği için Pixi yalnız unsafe-eval paketiyle yüklenir", () => {
    const direct = sources(SRC).filter((f) =>
      /(?<!typeof )import\(\s*["']pixi\.js["']\s*\)/.test(readFileSync(f, "utf8")),
    );
    expect(direct.map((f) => f.slice(SRC.length + 1))).toEqual(["fx/pixiLoad.ts"]);
    expect(readFileSync(join(SRC, "fx/pixiLoad.ts"), "utf8")).toContain('import("pixi.js/unsafe-eval")');
  });

  it("sunucu içerik politikası unsafe-eval içermez (Pixi bu yüzden ayrı pakete muhtaç)", () => {
    const csp = readFileSync(join(SRC, "../../server/src/static.ts"), "utf8");
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("uygulamalar genel Pixi havuzlarını boşaltmadan kapanır (destroy(true) yok)", () => {
    const bad = sources(SRC).filter((f) => /\.destroy\(\s*true\s*,\s*\{/.test(readFileSync(f, "utf8")));
    expect(bad.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });
});
