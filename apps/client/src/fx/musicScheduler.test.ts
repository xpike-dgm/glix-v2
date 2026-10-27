import { describe, expect, it } from "vitest";
import {
  type CtxLike,
  createMusicScheduler,
  type GainLike,
  LOOKAHEAD_S,
  type OscLike,
  TICK_MS,
} from "./musicScheduler.js";

function param() {
  const calls: { fn: string; v: number; t: number }[] = [];
  return {
    value: 0,
    calls,
    setValueAtTime: (v: number, t: number) => calls.push({ fn: "set", v, t }),
    linearRampToValueAtTime: (v: number, t: number) => calls.push({ fn: "lin", v, t }),
    exponentialRampToValueAtTime: (v: number, t: number) => calls.push({ fn: "exp", v, t }),
    setTargetAtTime: (v: number, t: number) => calls.push({ fn: "target", v, t }),
  };
}

function fake() {
  const oscs: { freq: number; start: number; stop: number }[] = [];
  const gains: GainLike[] = [];
  const ctx: CtxLike = {
    currentTime: 0,
    createOscillator(): OscLike {
      const rec = { freq: 0, start: 0, stop: 0 };
      oscs.push(rec);
      const f = param();
      return {
        type: "sine",
        frequency: {
          ...f,
          setValueAtTime: (v: number) => {
            rec.freq = v;
          },
        },
        connect: () => undefined,
        start: (t) => {
          rec.start = t;
        },
        stop: (t) => {
          rec.stop = t;
        },
      };
    },
    createGain() {
      const g = { gain: param(), connect: () => undefined };
      gains.push(g);
      return g;
    },
  };
  const timers = new Map<number, () => void>();
  let id = 0;
  const host = {
    ctx,
    out: {},
    setInterval: (fn: () => void) => {
      timers.set(++id, fn);
      return id;
    },
    clearInterval: (h: unknown) => void timers.delete(h as number),
  };
  const advance = (s: number) => {
    ctx.currentTime += s;
    for (const fn of timers.values()) fn();
  };
  return { ctx, oscs, gains, host, timers, advance };
}

describe("müzik zamanlayıcısı", () => {
  it("başlangıçta durur; start lobi notalarını önden kurar ve zamanlayıcı açar", () => {
    const f = fake();
    const m = createMusicScheduler(f.host);
    expect(m.mode).toBeNull();
    expect(f.timers.size).toBe(0);
    m.start("lobby");
    expect(m.mode).toBe("lobby");
    expect(f.timers.size).toBe(1);
    expect(f.oscs.length).toBeGreaterThan(0);
    expect(Math.max(...f.oscs.map((o) => o.start))).toBeLessThan(LOOKAHEAD_S + 0.1);
  });

  it("aynı kipi yeniden başlatmak ikinci zamanlayıcı açmaz", () => {
    const f = fake();
    const m = createMusicScheduler(f.host);
    m.start("lobby");
    m.start("lobby");
    expect(f.timers.size).toBe(1);
  });

  it("zaman ilerledikçe yeni nota kurulur; stop sonrası kurulmaz", () => {
    const f = fake();
    const m = createMusicScheduler(f.host);
    m.start("lobby");
    const n0 = f.oscs.length;
    f.advance(TICK_MS / 1000 + 1);
    expect(f.oscs.length).toBeGreaterThan(n0);
    m.stop();
    expect(m.mode).toBeNull();
    expect(f.timers.size).toBe(0);
    const n1 = f.oscs.length;
    f.advance(5);
    expect(f.oscs.length).toBe(n1);
  });

  it("gerilim kipi alçak notalar çalar, yoğunluk arttıkça nabız sıklaşır", () => {
    const calm = fake();
    const a = createMusicScheduler(calm.host);
    a.start("tension");
    a.setIntensity(0);
    calm.advance(5);
    const hot = fake();
    const b = createMusicScheduler(hot.host);
    b.start("tension");
    b.setIntensity(1);
    hot.advance(5);
    expect(Math.max(...calm.oscs.map((o) => o.freq))).toBeLessThan(200);
    expect(hot.oscs.length).toBeGreaterThan(calm.oscs.length);
  });

  it("yoğunluk 0..1 aralığına kırpılır", () => {
    const f = fake();
    const m = createMusicScheduler(f.host);
    m.setIntensity(5);
    expect(m.intensity).toBe(1);
    m.setIntensity(Number.NaN);
    expect(m.intensity).toBe(0);
  });

  it("duck veriyolunu kısar, kaldırınca geri açar ve durumu hatırlar", () => {
    const f = fake();
    const m = createMusicScheduler(f.host);
    m.start("lobby");
    const bus = f.gains[0] as GainLike & { gain: ReturnType<typeof param> };
    m.duck(true);
    expect(m.ducked).toBe(true);
    expect(bus.gain.calls.at(-1)?.v).toBeLessThan(1);
    m.duck(false);
    expect(bus.gain.calls.at(-1)?.v).toBe(1);
    m.duck(true);
    m.stop();
    m.start("tension");
    expect(bus.gain.calls.at(-1)?.v).toBeLessThan(1);
  });

  it("donmuş sekmeden dönünce eski notalar yağmaz", () => {
    const f = fake();
    const m = createMusicScheduler(f.host);
    m.start("lobby");
    const n0 = f.oscs.length;
    f.ctx.currentTime += 600;
    m.tick();
    expect(f.oscs.length - n0).toBeLessThan(30);
  });
});
