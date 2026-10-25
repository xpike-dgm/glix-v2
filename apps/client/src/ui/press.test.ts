import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pressable } from "./press.js";

const down = (over: Partial<PointerEvent> = {}): PointerEvent =>
  ({ button: 0, isPrimary: true, ...over }) as PointerEvent;

describe("pressable", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("activates on pointerdown and swallows the following click", () => {
    const fn = vi.fn();
    const p = pressable(fn);
    p.onPointerDown(down());
    expect(fn).toHaveBeenCalledTimes(1);
    p.onClick();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("activates on a bare click (keyboard, screen reader)", () => {
    const fn = vi.fn();
    const p = pressable(fn);
    p.onClick();
    p.onClick();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("ignores secondary buttons and non-primary pointers", () => {
    const fn = vi.fn();
    const p = pressable(fn);
    p.onPointerDown(down({ button: 2 }));
    p.onPointerDown(down({ isPrimary: false }));
    expect(fn).not.toHaveBeenCalled();
  });

  it("does not swallow a later keyboard click when the finger slid away", () => {
    const fn = vi.fn();
    const p = pressable(fn);
    p.onPointerDown(down());
    vi.advanceTimersByTime(800);
    p.onClick();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
