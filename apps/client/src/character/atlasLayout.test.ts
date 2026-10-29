import { describe, expect, it } from "vitest";
import { packAtlas } from "./atlasLayout.js";

describe("atlas yerleşimi", () => {
  it("yüksekten alçağa, satır satır dizer; kenar payı bırakır", () => {
    const { slots, height } = packAtlas(
      [
        { w: 40, h: 10 },
        { w: 40, h: 30 },
        { w: 40, h: 20 },
      ],
      100,
      5,
    );
    // 30 yüksek olan ilk sırada, sonra 20: iki parça (40+10 genişlik) bir satıra sığar; 10 olan yeni satıra iner.
    expect(slots[1]).toEqual({ ax: 5, ay: 5 });
    expect(slots[2]).toEqual({ ax: 55, ay: 5 });
    expect(slots[0]).toEqual({ ax: 5, ay: 5 + 30 + 10 });
    expect(height).toBe(40 + 10 + 10);
  });

  it("yalnız boyutlara bağlıdır: görsellerin yüklenme sırası yerleşimi değiştiremez", () => {
    const boxes = [
      { w: 30, h: 12 },
      { w: 25, h: 12 },
      { w: 10, h: 40 },
    ];
    expect(packAtlas(boxes, 64, 4)).toEqual(packAtlas([...boxes], 64, 4));
  });
});
