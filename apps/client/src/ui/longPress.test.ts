import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLongPress, type PointerLike } from "./longPress.js";

const at = (x = 0, y = 0, over: Partial<PointerLike> = {}): PointerLike => ({
  button: 0,
  isPrimary: true,
  clientX: x,
  clientY: y,
  ...over,
});

describe("createLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires after 500 ms and swallows the click that follows", () => {
    const long = vi.fn();
    const tap = vi.fn();
    const p = createLongPress(long, tap);
    p.onPointerDown(at());
    vi.advanceTimersByTime(499);
    expect(long).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(long).toHaveBeenCalledTimes(1);
    p.onPointerEnd();
    p.onClick(false);
    expect(tap).not.toHaveBeenCalled();
  });

  it("a short press is a tap", () => {
    const long = vi.fn();
    const tap = vi.fn();
    const p = createLongPress(long, tap);
    p.onPointerDown(at());
    vi.advanceTimersByTime(200);
    p.onPointerEnd();
    vi.advanceTimersByTime(1000);
    p.onClick(false);
    expect(long).not.toHaveBeenCalled();
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it("cancels when the finger slides away", () => {
    const long = vi.fn();
    const p = createLongPress(long, vi.fn());
    p.onPointerDown(at(10, 10));
    p.onPointerMove(at(40, 10));
    vi.advanceTimersByTime(900);
    expect(long).not.toHaveBeenCalled();
  });

  it("tolerates small jitter", () => {
    const long = vi.fn();
    const p = createLongPress(long, vi.fn());
    p.onPointerDown(at(10, 10));
    p.onPointerMove(at(14, 12));
    vi.advanceTimersByTime(500);
    expect(long).toHaveBeenCalledTimes(1);
  });

  it("ignores secondary buttons and non-primary pointers", () => {
    const long = vi.fn();
    const p = createLongPress(long, vi.fn());
    p.onPointerDown(at(0, 0, { button: 2 }));
    p.onPointerDown(at(0, 0, { isPrimary: false }));
    vi.advanceTimersByTime(900);
    expect(long).not.toHaveBeenCalled();
  });

  it("keyboard click opens directly", () => {
    const long = vi.fn();
    const tap = vi.fn();
    const p = createLongPress(long, tap);
    p.onClick(true);
    expect(long).toHaveBeenCalledTimes(1);
    expect(tap).not.toHaveBeenCalled();
  });
});
