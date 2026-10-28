import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { COSMETIC_ITEMS, DEFAULT_DANCE, itemsOfType, PLACE_DANCE } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { parseDance } from "./dance.js";

/** Katalog ile karakter varlıkları (public/assets/karakter) birbirini tutar. */
const root = new URL("../../public/assets/karakter/", import.meta.url);
const file = (p: string) => new URL(p, root);

describe("katalog ve karakter varlıkları", () => {
  it("her dans ürününün dosyası var ve geçerli; varsayılan dans ve selam da", () => {
    const ids = [...itemsOfType("dans").map((d) => d.asset), DEFAULT_DANCE, PLACE_DANCE];
    for (const id of ids) {
      expect(id).toBeDefined();
      const path = file(`dans/${id}.json`);
      expect(existsSync(path)).toBe(true);
      expect(parseDance(JSON.parse(readFileSync(path, "utf8")))).not.toBeNull();
    }
  });

  it("dans dosyaları küçük (toplam 100 KB altı) ve her dosya satılan ya da kullanılan bir dans", () => {
    const names = readdirSync(file("dans/")).map((n) => n.replace(".json", ""));
    const known = new Set<string | undefined>([
      ...itemsOfType("dans").map((d) => d.asset),
      DEFAULT_DANCE,
      PLACE_DANCE,
    ]);
    for (const n of names) expect(known.has(n)).toBe(true);
    const total = names.reduce((n, f) => n + statSync(file(`dans/${f}.json`)).size, 0);
    expect(total).toBeLessThan(100_000);
  });

  it("giysi ürünlerinin katmanı rig.json'da tanımlı, parça görselleri var", () => {
    const rig = JSON.parse(readFileSync(file("rig.json"), "utf8")) as {
      wardrobe: Record<string, { pieces: { file: string }[] }>;
    };
    for (const it of COSMETIC_ITEMS.filter((i) => i.type === "sapka" || i.type === "ust")) {
      const layer = rig.wardrobe[it.asset ?? ""];
      expect(layer).toBeDefined();
      for (const p of layer?.pieces ?? []) expect(existsSync(file(p.file))).toBe(true);
    }
  });
});
