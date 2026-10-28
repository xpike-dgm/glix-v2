import { describe, expect, it } from "vitest";
import { installNoZoom } from "./noZoom.js";

describe("installNoZoom", () => {
  it("iOS sıkıştırma hareketini engeller", () => {
    const doc = new EventTarget();
    installNoZoom(doc);
    const e = new Event("gesturestart", { cancelable: true });
    doc.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it("iki parmaklı kaydırmayı engeller, tek parmağa dokunmaz", () => {
    const doc = new EventTarget();
    installNoZoom(doc);
    const two = new Event("touchmove", { cancelable: true });
    Object.defineProperty(two, "touches", { value: { length: 2 } });
    doc.dispatchEvent(two);
    expect(two.defaultPrevented).toBe(true);
    const one = new Event("touchmove", { cancelable: true });
    Object.defineProperty(one, "touches", { value: { length: 1 } });
    doc.dispatchEvent(one);
    expect(one.defaultPrevented).toBe(false);
  });
});
