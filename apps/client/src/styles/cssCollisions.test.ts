import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Her oyunun CSS'i yüklenince global olur. İki oyun aynı sınıf ya da keyframe
// adını tanımlarsa birbirini bozar. Bu test o çakışmaları yakalar.

const SRC = join(import.meta.dirname, "..");

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

interface Defs {
  classes: Set<string>;
  keyframes: Set<string>;
}

/** Yorumları ve metinleri atar; seçicilerde geçen her sınıfı ve keyframe adlarını toplar. */
function extract(css: string): Defs {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*"|'[^']*'/g, '""');
  const classes = new Set<string>();
  const keyframes = new Set<string>();
  for (const m of text.matchAll(/([^{};]+)\{/g)) {
    let prelude = (m[1] ?? "").trim();
    const kf = /^@(?:-webkit-)?keyframes\s+([\w-]+)/.exec(prelude);
    if (kf?.[1]) {
      keyframes.add(kf[1]);
      continue;
    }
    if (prelude.startsWith("@")) continue;
    // :not(.x), :is(.a .b) gibi parantez içleri tanım sayılmaz.
    for (let prev = ""; prev !== prelude; ) {
      prev = prelude;
      prelude = prelude.replace(/\([^()]*\)/g, "");
    }
    // Kapsamlı seçicideki (`.kn .av`) sınıf da sayılır: o da aynı adı başka yerde
    // tanımlayan oyunla çakışır; kasıtlıysa aşağıdaki izin listesine girmeli.
    for (const c of prelude.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) if (c[1]) classes.add(c[1]);
  }
  return { classes, keyframes };
}

function merge(files: string[]): Defs {
  const out: Defs = { classes: new Set(), keyframes: new Set() };
  for (const f of files) {
    const d = extract(readFileSync(f, "utf8"));
    for (const c of d.classes) out.classes.add(c);
    for (const k of d.keyframes) out.keyframes.add(k);
  }
  return out;
}

const gamesDir = join(SRC, "games");
const games = readdirSync(gamesDir)
  .filter((id) => statSync(join(gamesDir, id)).isDirectory())
  .map((id) => ({ id, defs: merge(cssFiles(join(gamesDir, id))) }));
const shared = merge([...cssFiles(join(SRC, "styles")), ...cssFiles(join(SRC, "ui"))]);

/**
 * Ortak bileşen sınıfları: ortak CSS'te tanımlı, oyunlar kendi kapsamları
 * altında yeniden biçimlendirir. Yeni bir ad eklemeden önce çakışmanın
 * gerçekten kasıtlı olduğundan emin ol.
 */
const SHARED_ALLOWED = new Set<string>([
  "av", // Avatar (ui/Avatar.tsx)
  "av__disc", // Avatar diski
  "av__img", // avatar görseli
  "bomb", // ortak bomba çizimi (ui/bomb.css)
  "col", // ortak dikey yerleşim
  "gbtn--small", // küçük ortak düğme
  "npick", // sayı seçici (ui/number-picker.css)
  "wfield", // kelime alanı (ui/word-field.css)
  "game__tools", // oyun araç şeridi
  "pbar__fill", // ilerleme çubuğu dolgusu
  "game__top", // oyun üst şeridi (styles/game.css)
  "overline", // üst başlık etiketi
  "pbar", // ilerleme çubuğu
  "pbtn", // birincil düğme
  "pbtn-wrap", // birincil düğme kabı
  "pbtn__label", // birincil düğme yazısı
  "tamam", // TAMAM çubuğu
  "tamam__count", // TAMAM sayacı
  // frame.css dikey ekranda bu iki oyunun kendi üst şeridini yeniden ayarlar.
  "kb__top", // kara-borsa
  "kd__top", // karalama-defteri (bozuk-telefon da kullanır)
]);

/**
 * Bilinçli paylaşım: bozuk-telefon, karalama-defteri'nin çizim tahtasını
 * (DrawingCanvas, `kd__thumb`) yeniden kullanır; iki CSS aynı tahtayı tarif eder.
 */
const PAIR_ALLOWED: Record<string, string[]> = {
  "bozuk-telefon|karalama-defteri": ["kd__thumb"],
};

function isSharedOk(kind: "classes" | "keyframes", name: string): boolean {
  return kind === "classes" && SHARED_ALLOWED.has(name);
}

function pairAllowed(a: string, b: string, name: string): boolean {
  const key = [a, b].sort().join("|");
  return PAIR_ALLOWED[key]?.includes(name) ?? false;
}

describe("oyun CSS çakışmaları", () => {
  it("CSS dosyaları okunuyor", () => {
    expect(games.length).toBeGreaterThan(10);
    expect(shared.classes.size).toBeGreaterThan(50);
  });

  for (const kind of ["classes", "keyframes"] as const) {
    it(`iki oyun aynı ${kind === "classes" ? "sınıfı" : "keyframe adını"} tanımlamaz`, () => {
      const clashes: string[] = [];
      for (let i = 0; i < games.length; i++) {
        for (let j = i + 1; j < games.length; j++) {
          const a = games[i];
          const b = games[j];
          if (!a || !b) continue;
          for (const name of a.defs[kind]) {
            if (b.defs[kind].has(name) && !pairAllowed(a.id, b.id, name) && !isSharedOk(kind, name)) {
              clashes.push(`${name}: ${a.id} <-> ${b.id}`);
            }
          }
        }
      }
      expect(clashes).toEqual([]);
    });

    it(`oyun, ortak CSS'teki ${kind === "classes" ? "sınıfı" : "keyframe adını"} yeniden tanımlamaz`, () => {
      const clashes: string[] = [];
      for (const g of games) {
        for (const name of g.defs[kind]) {
          if (shared[kind].has(name) && !isSharedOk(kind, name)) {
            clashes.push(`${name}: ${g.id}`);
          }
        }
      }
      expect(clashes).toEqual([]);
    });
  }
});
