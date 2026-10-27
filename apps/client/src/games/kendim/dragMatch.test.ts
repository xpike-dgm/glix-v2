import { describe, expect, it } from "vitest";
import { clampToViewport, type DropTarget, exceedsDragThreshold, hitTest } from "./dragMatch.js";

const box = (id: string, left: number, top: number, size = 40): DropTarget => ({
  id,
  left,
  top,
  right: left + size,
  bottom: top + size,
});
const row = [box("a", 10, 400), box("b", 60, 400), box("c", 110, 400)];

describe("dragMatch", () => {
  it("avatarın içine bırakılan hedef olur", () => {
    expect(hitTest(30, 420, row)).toBe("a");
    expect(hitTest(80, 420, row)).toBe("b");
    expect(hitTest(130, 420, row)).toBe("c");
  });

  it("hiçbir avatarın yakınında değilse null", () => {
    expect(hitTest(30, 200, row)).toBeNull();
    expect(hitTest(300, 420, row)).toBeNull();
    expect(hitTest(30, 420, [])).toBeNull();
  });

  it("tolerans payı: kenarın biraz dışı da sayılır, payın dışı sayılmaz", () => {
    expect(hitTest(5, 420, row, 14)).toBe("a");
    expect(hitTest(-10, 420, row, 14)).toBeNull();
    expect(hitTest(30, 446, row, 0)).toBeNull();
    expect(hitTest(30, 446, row, 14)).toBe("a");
  });

  it("iki hedefin tolerans payı çakışırsa merkezi yakın olan seçilir", () => {
    // a: 10-50, b: 60-100; 54 noktası ikisinin de payı içinde, b'nin merkezi (80) a'nınkinden (30) daha uzak: a'ya 24, b'ye 26
    expect(hitTest(54, 420, row, 14)).toBe("a");
    expect(hitTest(56, 420, row, 14)).toBe("b");
  });

  it("sürükleme eşiği: küçük titreme dokunuş, büyük kayma sürükleme", () => {
    expect(exceedsDragThreshold(3, 4)).toBe(false);
    expect(exceedsDragThreshold(0, 8)).toBe(false);
    expect(exceedsDragThreshold(6, 6)).toBe(true);
    expect(exceedsDragThreshold(-20, 0)).toBe(true);
  });

  it("hayalet ekranın içinde kalır", () => {
    expect(clampToViewport(-50, 900, 320, 568)).toEqual({ x: 8, y: 560 });
    expect(clampToViewport(100, 100, 320, 568)).toEqual({ x: 100, y: 100 });
    expect(clampToViewport(999, -5, 320, 568)).toEqual({ x: 312, y: 8 });
  });
});
