import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..");

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

const base = readFileSync(join(SRC, "styles/base.css"), "utf8");
const rootBlock = base.slice(base.indexOf("html,\nbody {"), base.indexOf("}", base.indexOf("html,\nbody {")));

describe("dokunma: kök kurallar tüm oyun alanlarına iner", () => {
  it("uzun basma menüsü, metin seçimi ve çift dokunma yakınlaştırma kökte kapalı", () => {
    expect(rootBlock).toContain("-webkit-touch-callout: none");
    expect(rootBlock).toMatch(/user-select: none/);
    expect(rootBlock).toContain("touch-action: manipulation");
    expect(rootBlock).toContain("overscroll-behavior: none");
  });
  it("yazı kutuları metin seçimine izin verir (iOS'ta yazılabilsin)", () => {
    expect(base).toMatch(/input,\s*textarea \{[^}]*user-select: text/);
  });
});

describe("dokunma: oyun stilleri kökü geri açmaz", () => {
  const files = cssFiles(SRC);
  it("hiçbir stil touch-action: auto ya da callout: default koymaz", () => {
    for (const f of files) {
      const css = readFileSync(f, "utf8");
      expect(css, f).not.toMatch(/touch-action:\s*auto/);
      expect(css, f).not.toMatch(/-webkit-touch-callout:\s*default/);
    }
  });
  it("metin seçimi yalnız oda kodu ve yazı kutularında açılır", () => {
    const allowed = ["styles/base.css", "styles/screens.css"];
    for (const f of files) {
      const css = readFileSync(f, "utf8");
      if (!/user-select:\s*(text|auto|all)/.test(css)) continue;
      expect(
        allowed.some((a) => f.endsWith(a)),
        f,
      ).toBe(true);
    }
  });
});

describe("dokunma: çizim tahtası", () => {
  it("çizim yüzeyi touch-action ve overscroll'u kapatır", () => {
    const css = readFileSync(join(SRC, "games/karalama-defteri/karalama.css"), "utf8");
    const live = css.slice(css.indexOf(".kd__live {"));
    const block = live.slice(0, live.indexOf("}"));
    expect(block).toContain("touch-action: none");
    expect(block).toContain("overscroll-behavior: none");
    expect(block).toContain("-webkit-touch-callout: none");
  });
});
