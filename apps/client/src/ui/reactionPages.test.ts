import { itemsOfType, LOBBY_EMOJIS, parseStickerId } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { reactionPages } from "./reactionPages.js";

describe("tepki sayfaları", () => {
  it("paket yoksa tek sayfa: emojiler", () => {
    const pages = reactionPages();
    expect(pages).toHaveLength(1);
    expect(pages[0]?.items.map((i) => i.id)).toEqual([...LOBBY_EMOJIS]);
  });

  it("her paket kendi sayfasını alır; 6 çıkartma, geçerli kimlik ve görsel", () => {
    const packs = itemsOfType("tepki");
    const pages = reactionPages(
      LOBBY_EMOJIS,
      [packs[0], packs[2]].filter((p) => p !== undefined),
    );
    expect(pages.map((p) => p.id)).toEqual(["emoji", "tepki-neon-yuzler", "tepki-efsane"]);
    const stickers = pages[2]?.items ?? [];
    expect(stickers).toHaveLength(6);
    for (const s of stickers) {
      expect(parseStickerId(s.id)?.item.id).toBe("tepki-efsane");
      expect(s.src).toMatch(/^\/assets\/shop\/tepki\/efsane-tepkiler-[1-6]\.webp$/);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});
