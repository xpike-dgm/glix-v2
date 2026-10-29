import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientPhase } from "../games/zaman-bombasi-hafizasi/view.js";
import { atServerTime } from "./serverTimer.js";

describe("atServerTime", () => {
  let offset = 0;
  const now = (): number => Date.now() + offset;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    offset = 0;
  });
  afterEach(() => vi.useRealTimers());

  it("hedef anda bir kez çağırır", () => {
    const fn = vi.fn();
    atServerTime(now() + 500, fn, now);
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("geçmiş hedefte de (eşzamansız) çağırır", () => {
    const fn = vi.fn();
    atServerTime(now() - 100, fn, now);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("bekleme sırasında saat ofseti geri çekilirse hedefe varmadan çağırmaz, kalan süre için yeniden kurar", () => {
    const target = now() + 1_000;
    const seen: number[] = [];
    atServerTime(target, () => seen.push(now()), now);
    vi.advanceTimersByTime(400);
    offset -= 61; // yeni pong: medyan 61 ms geri (tarayıcıda yeniden üretimde ölçülen değer)
    vi.advanceTimersByTime(600);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(61);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeGreaterThanOrEqual(target);
  });

  it("iptal edilince (yeniden kurulmuş olsa da) çağırmaz", () => {
    const fn = vi.fn();
    const cancel = atServerTime(now() + 100, fn, now);
    offset -= 50;
    vi.advanceTimersByTime(100);
    cancel();
    vi.advanceTimersByTime(1_000);
    expect(fn).not.toHaveBeenCalled();
  });

  it("Zaman Bombası: giriş sınırında yeniden hesaplanan evre, ofset geri çekilse de 'input' olur", () => {
    const t0 = now();
    const v = { phase: "playback" as const, turnStart: t0, inputStart: t0 + 700, deadline: t0 + 4_200 };
    const phases: string[] = [];
    atServerTime(v.inputStart, () => phases.push(clientPhase(v, now())), now);
    vi.advanceTimersByTime(300);
    offset -= 30;
    vi.advanceTimersByTime(2_000);
    expect(phases).toEqual(["input"]);
  });
});
