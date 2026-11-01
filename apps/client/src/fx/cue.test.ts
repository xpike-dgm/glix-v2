import { createMemo, createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { createOnce, onChange, onPhaseKey } from "./cue.js";

describe("ses tetikleyici güvencesi", () => {
  it("onChange: kaynak her karede yeniden hesaplansa da yalnız değer değişince çalışır", () => {
    const [now, setNow] = createSignal(0);
    const calls: [string, string | undefined][] = [];
    const dispose = createRoot((d) => {
      // Her karede yeni nesne üreten saat (oyun ekranlarındaki `clock` memo'su gibi).
      const clock = createMemo(() => ({ phase: now() < 1_000 ? "ready" : "count" }));
      onChange(
        () => clock().phase,
        (v, p) => calls.push([v, p]),
      );
      return d;
    });
    for (let t = 0; t <= 3_000; t += 100) setNow(t);
    expect(calls).toEqual([
      ["ready", undefined],
      ["count", "ready"],
    ]);
    dispose();
  });

  it("onChange defer: açılıştaki değerde çalışmaz", () => {
    const [v, setV] = createSignal(1);
    let n = 0;
    const dispose = createRoot((d) => {
      onChange(v, () => n++, { defer: true });
      return d;
    });
    expect(n).toBe(0);
    setV(1);
    setV(2);
    setV(2);
    expect(n).toBe(1);
    dispose();
  });

  it("createOnce: aynı olay kimliği için bir kez", () => {
    const once = createOnce();
    let n = 0;
    for (let i = 0; i < 12; i++) once("go:0", () => n++);
    once("go:1", () => n++);
    expect(n).toBe(2);
  });

  it("onPhaseKey: anahtar geri dönse de (A → B → A) her anahtar bir kez", () => {
    const [k, setK] = createSignal("play:0");
    const seen: [string, boolean][] = [];
    const dispose = createRoot((d) => {
      onPhaseKey(k, (key, opening) => seen.push([key, opening]));
      return d;
    });
    for (const key of ["play:0", "gap:0", "play:0", "gap:0", "play:1"])
      for (let i = 0; i < 10; i++) setK(key);
    expect(seen).toEqual([
      ["play:0", true],
      ["gap:0", false],
      ["play:1", false],
    ]);
    dispose();
  });
});
