import { describe, expect, it } from "vitest";
import { shapePattern } from "./haptics.js";

describe("shapePattern", () => {
  it("normal harekette deseni olduğu gibi verir", () => {
    expect(shapePattern([14, 40, 14], false)).toEqual([14, 40, 14]);
    expect(shapePattern(10, false)).toEqual([10]);
  });
  it("azaltılmış harekette titreşimleri yarıya indirir, aralara dokunmaz", () => {
    expect(shapePattern([14, 40, 14], true)).toEqual([7, 40, 7]);
    expect(shapePattern(45, true)).toEqual([23]);
  });
  it("çok kısa titreşim en az 6 ms kalır", () => {
    expect(shapePattern(6, true)).toEqual([6]);
  });
});
