import { describe, expect, it } from "vitest";
import type { ContentSet } from "./content.js";
import { dedupeKey, poolEntries, searchKey } from "./content.js";
import type { GameContext } from "./game.js";
import { cagrisimAgi } from "./games/cagrisim-agi/index.js";
import { CONTENT_POOLS, poolById } from "./games/content-pools.js";
import { karalamaDefteri } from "./games/karalama-defteri/index.js";
import { lafSokma } from "./games/laf-sokma/index.js";
import { sizma } from "./games/sizma/index.js";
import { sozlukBlofu } from "./games/sozluk-blofu/index.js";
import { GameRecorder, replay } from "./replay.js";
import { createRng } from "./rng.js";

const PLAYERS = ["a", "b", "c", "d"];
const ctx = (seed: number, content?: ContentSet): GameContext => ({
  now: 1_000,
  rng: createRng(seed),
  connected: PLAYERS,
  ...(content ? { content } : {}),
});

/** Test için uydurma (içerik üretimi değil) alan değerleri: yalnız harf dizileri. */
const fake = (n: number): string => {
  const letters = "abcdefghijklmnoprstuvyz";
  let s = "";
  for (let k = n + 1; k > 0; k = Math.floor(k / letters.length)) s += letters[k % letters.length];
  return `${s}${s}x`;
};

describe("havuz kayıt defteri", () => {
  it("kimlikler benzersiz, her yerleşik girdi kendi şemasından geçer, anahtarlar benzersiz", () => {
    expect(new Set(CONTENT_POOLS.map((p) => p.id)).size).toBe(CONTENT_POOLS.length);
    for (const p of CONTENT_POOLS) {
      expect(p.builtin.length, p.id).toBeGreaterThanOrEqual(p.min);
      const keys = new Set<string>();
      for (const e of p.builtin) {
        const parsed = p.fromFields(p.toFields(e));
        expect(parsed.ok, `${p.id}: ${JSON.stringify(e)}`).toBe(true);
        keys.add(p.key(e));
      }
      expect(p.builtin.length - keys.size, p.id).toBeLessThanOrEqual(
        p.id === "cagrisim-agi/kelimeler" ? 1 : 0,
      );
      expect(poolById(p.id)).toBe(p);
    }
  });

  it("poolEntries: içerik yoksa yerleşik, yeterliyse enjekte, azsa yerleşik", () => {
    const p = poolById("cagrisim-agi/kelimeler");
    if (!p) throw new Error("havuz yok");
    expect(poolEntries(p, undefined)).toBe(p.builtin);
    const many = Array.from({ length: p.min }, (_, i) => fake(i).toUpperCase());
    expect(poolEntries(p, { [p.id]: many }).length).toBe(p.min);
    expect(poolEntries(p, { [p.id]: many.slice(0, p.min - 1) })).toBe(p.builtin);
    // Geçersiz girdiler elenir; kalan az ise yerleşik.
    expect(poolEntries(p, { [p.id]: [...many.slice(0, p.min - 1), 42, "a b", "<x>"] })).toBe(p.builtin);
  });
});

function custom(poolId: string, count: number): unknown[] {
  switch (poolId) {
    case "sozluk-blofu/kelimeler":
      return Array.from({ length: count }, (_, i) => ({
        word: fake(i),
        definition: `deneme tanımı numara ${i}`,
      }));
    case "sizma/ciftler":
      return Array.from({ length: count }, (_, i) => [fake(i), fake(i + 500)]);
    case "karalama-defteri/ciftler":
      return Array.from({ length: count }, (_, i) => ({ main: fake(i), near: fake(i + 500) }));
    case "cagrisim-agi/kelimeler":
      return Array.from({ length: count }, (_, i) => fake(i).toUpperCase());
    default:
      return Array.from({ length: count }, (_, i) => `Deneme sorusu numara ${i} nedir?`);
  }
}

interface Probe {
  poolId: string;
  /** Kurulumdan çekilen girdilerin metinleri. */
  picked: (seed: number, content?: ContentSet) => string[];
}

const PROBES: Probe[] = [
  {
    poolId: "sozluk-blofu/kelimeler",
    picked: (seed, c) => {
      const s = sozlukBlofu.setup(PLAYERS, ctx(seed, c));
      return [s.word.toLocaleLowerCase("tr-TR")];
    },
  },
  {
    poolId: "cagrisim-agi/kelimeler",
    picked: (seed, c) => [cagrisimAgi.setup(PLAYERS, ctx(seed, c)).word],
  },
  {
    poolId: "sizma/ciftler",
    picked: (seed, c) => {
      const s = sizma.setup(PLAYERS, ctx(seed, c));
      return [s.commonWord.toLocaleLowerCase("tr-TR"), s.infiltratorWord.toLocaleLowerCase("tr-TR")];
    },
  },
  {
    poolId: "karalama-defteri/ciftler",
    picked: (seed, c) => {
      const s = karalamaDefteri.setup(PLAYERS, ctx(seed, c));
      return [s.mainWord, s.nearWord];
    },
  },
  {
    poolId: "laf-sokma/sorular",
    picked: (seed: number, c?: ContentSet) => {
      const s = lafSokma.setup(PLAYERS, ctx(seed, c));
      return [...s.duels.map((d) => d.prompt), s.finalPrompt];
    },
  },
];

describe.each(PROBES)("$poolId", ({ poolId, picked }) => {
  const pool = poolById(poolId);
  if (!pool) throw new Error("havuz yok");

  it("içerik verilmezse davranış değişmez (aynı tohum, aynı sonuç; hepsi yerleşik havuzdan)", () => {
    const a = picked(7);
    expect(picked(7)).toEqual(a);
    expect(picked(7, {})).toEqual(a);
    expect(picked(7, { "baska/havuz": ["x"] })).toEqual(a);
    const builtinTexts = new Set(
      pool.builtin.flatMap((e) => Object.values(pool.toFields(e)).map((t) => t.toLocaleLowerCase("tr-TR"))),
    );
    for (const t of a) expect(builtinTexts.has(t.toLocaleLowerCase("tr-TR"))).toBe(true);
  });

  it("enjekte edilen içerik kullanılır; yerleşik girdi çıkmaz", () => {
    const set = { [poolId]: custom(poolId, 40) };
    const builtinTexts = new Set(
      pool.builtin.flatMap((e) => Object.values(pool.toFields(e)).map((t) => t.toLocaleLowerCase("tr-TR"))),
    );
    const customTexts = new Set(
      set[poolId]?.flatMap((e) => {
        const v = pool.unpack(e);
        return v ? Object.values(v).map((t) => t.toLocaleLowerCase("tr-TR")) : [];
      }),
    );
    for (let seed = 1; seed <= 30; seed++) {
      for (const t of picked(seed, set)) {
        const low = t.toLocaleLowerCase("tr-TR");
        expect(customTexts.has(low), t).toBe(true);
        expect(builtinTexts.has(low), t).toBe(false);
      }
    }
  });

  it("kapatılan girdi hiç seçilmez (yerleşikten biri çıkarılmış havuz)", () => {
    const [off, ...rest] = pool.builtin;
    const content: ContentSet = { [poolId]: rest };
    const offTexts = new Set(Object.values(pool.toFields(off)).map((t) => t.toLocaleLowerCase("tr-TR")));
    const restTexts = new Set(
      rest.flatMap((e) => Object.values(pool.toFields(e)).map((t) => t.toLocaleLowerCase("tr-TR"))),
    );
    for (let seed = 1; seed <= 300; seed++) {
      const got = picked(seed, content);
      // Kapatılan girdi yalnız başka bir girdiyle aynı metni paylaşıyorsa görünebilir.
      if (
        got.some(
          (t) => offTexts.has(t.toLocaleLowerCase("tr-TR")) && !restTexts.has(t.toLocaleLowerCase("tr-TR")),
        )
      )
        throw new Error(`kapalı girdi seçildi: ${got}`);
    }
  });

  it("aynı tohum + aynı içerik = aynı seçim; farklı tohumlarda çeşitlilik var", () => {
    const set = { [poolId]: custom(poolId, 40) };
    expect(picked(11, set)).toEqual(picked(11, set));
    const seen = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) seen.add(picked(seed, set).join("|"));
    expect(seen.size).toBeGreaterThan(5);
  });

  it("havuz asgari boydan küçükse yerleşik havuza dönülür", () => {
    const set = { [poolId]: custom(poolId, pool.min - 1) };
    expect(picked(3, set)).toEqual(picked(3));
  });
});

describe("kayıttan tekrar oynatma içeriği korur", () => {
  it("GameLog.content kayıt altına alınır ve replay aynı havuzu kurar (Sözlük Blöfü)", () => {
    const content: ContentSet = { "sozluk-blofu/kelimeler": custom("sozluk-blofu/kelimeler", 30) };
    const rec = new GameRecorder("sozluk-blofu", 5, PLAYERS, 1_000, content);
    const log = rec.finish(200_000);
    expect(log.content).toEqual(content);
    const withContent = replay(sozlukBlofu, JSON.parse(JSON.stringify(log)));
    const plain = replay(sozlukBlofu, { ...log, content: undefined } as unknown as typeof log);
    // Aynı kayıt, havuz farklıysa farklı kelimeyle kurulur; sonuç (puanlar) boş maçta eşit olabilir, ama kurulum ayrışır.
    expect(withContent).toBeDefined();
    expect(plain).toBeDefined();
    const s1 = sozlukBlofu.setup(PLAYERS, { now: 1_000, rng: createRng(5), connected: PLAYERS, content });
    const s2 = sozlukBlofu.setup(PLAYERS, { now: 1_000, rng: createRng(5), connected: PLAYERS });
    expect(s1.word).not.toBe(s2.word);
  });

  it("kaydedilen içerik sonradan değişen nesneden etkilenmez", () => {
    const content: Record<string, unknown[]> = {
      "cagrisim-agi/kelimeler": custom("cagrisim-agi/kelimeler", 12),
    };
    const rec = new GameRecorder("cagrisim-agi", 1, PLAYERS, 0, content);
    content["cagrisim-agi/kelimeler"]?.push("SONRADAN");
    expect(rec.finish(1).content?.["cagrisim-agi/kelimeler"]).toHaveLength(12);
  });
});

describe("tekrar anahtarı", () => {
  it("Türkçe harfleri ayırır, yalnız I/ı/İ/i ve büyük/küçük harfi birleştirir", () => {
    expect(dedupeKey("GÖL")).not.toBe(dedupeKey("GOL"));
    expect(dedupeKey("kaş")).not.toBe(dedupeKey("kas"));
    expect(dedupeKey("DENEMELIK")).toBe(dedupeKey("denemelik"));
    expect(dedupeKey("denemelık")).toBe(dedupeKey("Denemelik!"));
    expect(dedupeKey("İSTANBUL")).toBe(dedupeKey("istanbul"));
  });
  it("arama anahtarı aksanları da atar", () => {
    expect(searchKey("GÖKKUŞAĞI").includes(searchKey("go"))).toBe(true);
  });
});
