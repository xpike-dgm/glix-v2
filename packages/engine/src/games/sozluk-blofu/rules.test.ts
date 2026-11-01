import { describe, expect, it } from "vitest";
import { parseEntry, poolEntries } from "../../content.js";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { sozlukBlofu, sozlukCards } from "./index.js";
import { SOZLUK_DEFINITION_MAX, SOZLUK_POOL, sozlukDefinitionProblem, sozlukWordType } from "./pool.js";
import { charCount } from "./text.js";
import {
  SOZLUK_CONTENT_MEMORY,
  SOZLUK_KNEW_DELAY_MS,
  SOZLUK_PICK_MS,
  SOZLUK_WRITE_MS,
  sozlukAwards,
} from "./types.js";
import { SOZLUK_ENTRIES } from "./words.js";

const T0 = 1_000_000;
const PICK_END = T0 + SOZLUK_WRITE_MS + SOZLUK_PICK_MS;
const ctx = (now: number, connected: readonly string[] = []) => ({ now, rng: createRng(7), connected });
type S = ReturnType<typeof sozlukBlofu.setup>;
const start = (players = ["a", "b", "c"]): S => sozlukBlofu.setup(players, ctx(T0, players));

function act(s: S, id: string, action: unknown, at: number): S | string {
  const parsed = sozlukBlofu.parseAction(action);
  if (!parsed) return "parse";
  const r = sozlukBlofu.reduce(s, id, parsed, ctx(at));
  return isRejected(r) ? r.rejected : r;
}
const must = (r: S | string): S => {
  if (typeof r === "string") throw new Error(`reddedildi: ${r}`);
  return r;
};

describe("SB-M1 sıralama ödülü", () => {
  it("en yüksek +2, sonraki farklı toplam +1, diğerleri 0", () => {
    expect(sozlukAwards({ a: 5, b: 3, c: 3, d: 1, e: 0 })).toEqual({ a: 2, b: 1, c: 1, d: 0, e: 0 });
  });
  it("birincide eşitlikte hepsi +2, sonraki toplam +1", () => {
    expect(sozlukAwards({ a: 4, b: 4, c: 2, d: 1 })).toEqual({ a: 2, b: 2, c: 1, d: 0 });
  });
  it("blöf puanı 0 olan ödül almaz; herkes eşit ve pozitifse +1; hepsi 0 ise kimse", () => {
    expect(sozlukAwards({ a: 2, b: 0, c: 0 })).toEqual({ a: 2, b: 0, c: 0 });
    expect(sozlukAwards({ a: 2, b: 2, c: 2 })).toEqual({ a: 1, b: 1, c: 1 });
    expect(sozlukAwards({ a: 0, b: 0, c: 0 })).toEqual({ a: 0, b: 0, c: 0 });
  });
  it("8 kişide tek blöf 7 kişiyi kandırsa da genel skora en çok +2 gider", () => {
    const players = ["a", "b", "c", "d", "e", "f", "g", "h"];
    let s = start(players);
    s = must(act(s, "a", { kind: "bluff", text: "ince uzun bir tahta" }, T0 + 1_000));
    const fake = sozlukCards(s).find((c) => c.author === "a")?.id as string;
    const at = T0 + SOZLUK_WRITE_MS + 1_000;
    for (const id of players.slice(1)) s = must(act(s, id, { kind: "pick", card: fake }, at));
    const r = sozlukBlofu.result(sozlukBlofu.tick(s, ctx(PICK_END + 1)));
    expect(r.miniScores.a).toBe(7);
    expect(r.awards.a).toBe(2);
    expect(Math.max(...Object.values(r.awards))).toBe(2);
    const reveal = sozlukBlofu.publicView(sozlukBlofu.tick(s, ctx(PICK_END + 1)), ctx(PICK_END + 1)).reveal;
    expect(reveal?.scores.a).toBe(7);
    expect(reveal?.awards.a).toBe(2);
  });
});

describe("SB-M2 tekrar önleme", () => {
  it("çekilen kelime son 40 oyun için bildirilir (anahtar = havuz anahtarı)", () => {
    const s = start();
    const entry = SOZLUK_ENTRIES.find((e) => e.word === s.word);
    expect(entry).toBeDefined();
    expect(sozlukBlofu.contentUsed?.(s)).toEqual([
      { poolId: SOZLUK_POOL.id, key: SOZLUK_POOL.key(entry as (typeof SOZLUK_ENTRIES)[number]), memory: 40 },
    ]);
    expect(SOZLUK_CONTENT_MEMORY).toBe(40);
    // 87 girdide 40'lık hafıza her zaman en az 47 seçenek bırakır.
    expect(SOZLUK_ENTRIES.length - SOZLUK_CONTENT_MEMORY).toBeGreaterThanOrEqual(47);
  });
});

describe("SB-M3 kelimenin türü", () => {
  it("yerleşik her girdinin türü dolu; tür ortak görünümde kelimeyle gelir", () => {
    for (const e of SOZLUK_ENTRIES) expect(["isim", "sıfat", "fiil", "zarf"]).toContain(e.type);
    const s = start();
    const entry = SOZLUK_ENTRIES.find((e) => e.word === s.word);
    expect(sozlukBlofu.publicView(s, ctx(T0)).wordType).toBe(entry?.type);
  });
  it("tür alanı büyük/küçük harf ve ı/i duyarsız okunur; tanınmayan tür reddedilir", () => {
    expect(sozlukWordType("SIFAT")).toBe("sıfat");
    expect(sozlukWordType(" isim ")).toBe("isim");
    expect(sozlukWordType("")).toBeNull();
    expect(sozlukWordType("edat")).toBeUndefined();
    const bad = SOZLUK_POOL.fromFields({ word: "zırzop", type: "edat", definition: "deneme bir tanım" });
    expect(bad.ok).toBe(false);
  });
  it("türü olmayan eski kayıt okunur; tür satırı boş (null) kalır", () => {
    const legacy = { word: "ZIRZOP", definition: "deneme amaçlı bir tanım metni" };
    expect(parseEntry(SOZLUK_POOL, legacy)).toEqual({ ...legacy, type: null });
    const list = Array.from({ length: 10 }, (_, i) => ({
      word: `ZIRZOP${"A".repeat(i)}`,
      definition: "bir tanım",
    }));
    const pool = poolEntries(SOZLUK_POOL, { [SOZLUK_POOL.id]: list });
    const s = sozlukBlofu.setup(["a", "b", "c"], { ...ctx(T0), content: { [SOZLUK_POOL.id]: pool } });
    expect(s.wordType).toBeNull();
    expect(sozlukBlofu.publicView(s, ctx(T0)).wordType).toBeNull();
  });
  it("yeni girdide tür zorunlu (strict)", () => {
    const e = parseEntry(SOZLUK_POOL, { word: "ZIRZOP", definition: "deneme amaçlı bir tanım metni" });
    expect(e && SOZLUK_POOL.strict?.(e)).toMatch(/Türü seç/);
    const ok = SOZLUK_POOL.fromFields({
      word: "zırzop",
      type: "isim",
      definition: "deneme amaçlı bir tanım",
    });
    expect(ok.ok && SOZLUK_POOL.strict?.(ok.entry)).toBeNull();
  });
  it("yönetici formunda tür açılır liste olarak tanımlı", () => {
    const f = SOZLUK_POOL.fields.find((x) => x.key === "type");
    expect(f?.options).toEqual(["isim", "sıfat", "fiil", "zarf"]);
    expect(SOZLUK_POOL.fields.map((x) => x.key)).toEqual(["word", "type", "definition"]);
  });
});

describe("SB-M6 gerçek tanım biçim kuralı", () => {
  it("yerleşik tanımlar tek cümle, en çok 70 karakter; ; ( ) ve ör. yok", () => {
    for (const e of SOZLUK_ENTRIES) {
      expect(sozlukDefinitionProblem(e.definition), e.word).toBeNull();
      expect(charCount(e.definition)).toBeLessThanOrEqual(SOZLUK_DEFINITION_MAX);
    }
  });
  it("yeni girdide noktalı virgül, parantez, ör. ve 70 karakter üstü reddedilir", () => {
    expect(sozlukDefinitionProblem("güneşin batması; akşam vakti")).toMatch(/tek cümle/);
    expect(sozlukDefinitionProblem("ince bir tel (altın)")).not.toBeNull();
    expect(sozlukDefinitionProblem("bir tür kap, ör. tas")).not.toBeNull();
    expect(sozlukDefinitionProblem("a".repeat(71))).not.toBeNull();
    expect(sozlukDefinitionProblem("a".repeat(70))).toBeNull();
  });
  it("oyuncunun blöfünde bu kısıtlar yoktur (noktalı virgül ve 100 karakter serbest)", () => {
    const s = must(act(start(), "a", { kind: "bluff", text: `bir tür kuş; ${"x".repeat(80)}` }, T0 + 1_000));
    expect(s.bluffs.a).toContain(";");
  });
});

describe("SB-M7 'Bu kelimeyi biliyordum'", () => {
  const revealed = (): S => sozlukBlofu.tick(start(), ctx(PICK_END + 1));
  const at = PICK_END + SOZLUK_KNEW_DELAY_MS;

  it("açılışın ilk 1,5 sn'sinde ve öncesinde reddedilir", () => {
    expect(act(start(), "a", { kind: "knew", on: true }, T0 + 1_000)).toBe("not_yet");
    expect(act(revealed(), "a", { kind: "knew", on: true }, at - 1)).toBe("not_yet");
  });
  it("oyuncu başına bir kez sayılır, geri alınabilir; yalnız sahibinin görünümünde", () => {
    let s = must(act(revealed(), "a", { kind: "knew", on: true }, at));
    expect(act(s, "a", { kind: "knew", on: true }, at + 10)).toBe(s);
    s = must(act(s, "b", { kind: "knew", on: true }, at + 20));
    expect(sozlukBlofu.contentFeedback?.(s)).toEqual([{ poolId: SOZLUK_POOL.id, key: s.entryKey, knew: 2 }]);
    s = must(act(s, "b", { kind: "knew", on: false }, at + 30));
    expect(sozlukBlofu.contentFeedback?.(s)?.[0]?.knew).toBe(1);
    expect(sozlukBlofu.view(s, "a", ctx(at)).myKnew).toBe(true);
    expect(sozlukBlofu.view(s, "b", ctx(at)).myKnew).toBe(false);
    // Kim bastığı ortak görünümde yok.
    expect(JSON.stringify(sozlukBlofu.publicView(s, ctx(at)))).not.toMatch(/knew/i);
  });
  it("puana etkisi yoktur; oyun bittikten sonra (Devam et beklenirken) de basılabilir", () => {
    const base = revealed();
    const s = must(act(base, "c", { kind: "knew", on: true }, PICK_END + 30_000));
    expect(sozlukBlofu.result(s)).toEqual(sozlukBlofu.result(base));
  });
  it("katılımcı olmayan basamaz; biçim tam olmalı", () => {
    expect(act(revealed(), "x", { kind: "knew", on: true }, at)).toBe("not_participant");
    expect(sozlukBlofu.parseAction({ kind: "knew" })).toBeNull();
    expect(sozlukBlofu.parseAction({ kind: "knew", on: 1 })).toBeNull();
    expect(sozlukBlofu.parseAction({ kind: "knew", on: true, x: 1 })).toBeNull();
  });
});

describe("SB-U16 anlatım", () => {
  it("gerçeği bulmanın +1 olduğu ve en çok puanlayanın +2 aldığı yazar", () => {
    const steps = sozlukBlofu.briefing.steps.join(" ");
    expect(steps).toMatch(/bulursan \+1/);
    expect(steps).toMatch(/\+2/);
  });
});
