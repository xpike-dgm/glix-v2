import { afterEach, describe, expect, it, vi } from "vitest";

/** Pixi'yi taklit eder: oluşturulan her uygulamanın `destroy` çağrısı izlenir. */
function fakePixi() {
  const apps: {
    destroy: ReturnType<typeof vi.fn>;
    ticker: { add: () => void; stop: () => void; start: () => void; maxFPS: number };
  }[] = [];
  const unload = vi.fn(async () => undefined);
  class Application {
    canvas = {};
    stage = { addChild: () => undefined };
    screen = { width: 300, height: 600 };
    renderer = { generateTexture: () => ({}) };
    ticker = { add: () => undefined, stop: () => undefined, start: () => undefined, maxFPS: 0 };
    destroy = vi.fn();
    constructor() {
      apps.push(this);
    }
    async init(): Promise<void> {}
  }
  class Graphics {
    circle() {
      return this;
    }
    fill() {
      return this;
    }
    destroy() {}
    clear() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    stroke() {
      return this;
    }
    rect() {
      return this;
    }
  }
  class Sprite {
    anchor = { set: () => undefined };
    scale = { set: () => undefined };
    x = 0;
    y = 0;
    tint = 0;
    alpha = 1;
    rotation = 0;
  }
  class Texture {
    destroy = vi.fn();
  }
  class Rectangle {}
  const Assets = { load: async () => ({ source: {} }), unload };
  return { apps, unload, module: { Application, Graphics, Sprite, Texture, Rectangle, Assets } };
}

/** Node ortamında yalnız Pixi sarmalayıcılarının dokunduğu tarayıcı yüzeyi. */
function stubDom() {
  const removeEventListener = vi.fn();
  const host = { appendChild: () => undefined };
  vi.stubGlobal("document", { hidden: false, addEventListener: () => undefined, removeEventListener });
  vi.stubGlobal("window", { devicePixelRatio: 2 });
  vi.stubGlobal("navigator", { hardwareConcurrency: 8 });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  return { removeEventListener, host: host as unknown as HTMLElement };
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.doUnmock("pixi.js");
});

describe("Pixi temizliği", () => {
  it("konfeti kapanınca uygulama yok edilir, şerit görseli bırakılır, ikinci çağrı zararsız", async () => {
    const f = fakePixi();
    vi.doMock("pixi.js", () => f.module);
    const dom = stubDom();
    const { playConfetti } = await import("./confetti.js");
    const stop = await playConfetti(dom.host);
    stop();
    stop();
    expect(f.apps).toHaveLength(1);
    expect(f.apps[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(f.unload).toHaveBeenCalledTimes(1);
  });

  it("ana sayfa zemini kapanınca dokular dahil yok edilir ve dinleyici kalkar", async () => {
    const f = fakePixi();
    vi.doMock("pixi.js", () => f.module);
    const dom = stubDom();
    const { mountBackdrop } = await import("../backdrop/hero.js");
    const stop = await mountBackdrop(dom.host);
    stop();
    expect(f.apps[0]?.destroy).toHaveBeenCalledWith({ removeView: true }, { children: true, texture: true });
    expect(dom.removeEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});
