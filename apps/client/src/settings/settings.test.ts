import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

async function fresh(initial: Record<string, string> = {}) {
  vi.resetModules();
  const storage = memoryStorage(initial);
  vi.stubGlobal("localStorage", storage);
  const mod = await import("./settings.js");
  return { storage, ...mod };
}

afterEach(() => vi.unstubAllGlobals());

describe("varsayılanlar", () => {
  it("kayıt yokken güvenli varsayılanlar gelir", async () => {
    const s = await fresh();
    expect(s.haptics()).toBe(true);
    expect(s.motion()).toBe("auto");
    expect(s.textSize()).toBe("normal");
    expect(s.dataSaver()).toBe(false);
    expect(s.telemetry()).toBe(true);
  });
});

describe("kalıcılık", () => {
  it("yazılan değer saklanır ve yeni açılışta okunur", async () => {
    const a = await fresh();
    a.setHaptics(false);
    a.setMotion("reduce");
    a.setTextSize("large");
    a.setDataSaver(true);
    a.setTelemetry(false);
    const b = await fresh(Object.fromEntries(a.storage.data));
    expect(b.haptics()).toBe(false);
    expect(b.motion()).toBe("reduce");
    expect(b.textSize()).toBe("large");
    expect(b.dataSaver()).toBe(true);
    expect(b.telemetry()).toBe(false);
  });
  it("değişiklik hemen okuyucuya yansır", async () => {
    const s = await fresh();
    s.setMotion("full");
    expect(s.motion()).toBe("full");
  });
});

describe("bozuk kayıt", () => {
  it("tanınmayan değerler varsayılana düşer", async () => {
    const s = await fresh({
      "glix.haptics": "evet",
      "glix.motion": "çok",
      "glix.textSize": "devasa",
      "glix.dataSaver": "2",
      "glix.telemetry": "",
    });
    expect(s.haptics()).toBe(true);
    expect(s.motion()).toBe("auto");
    expect(s.textSize()).toBe("normal");
    expect(s.dataSaver()).toBe(false);
    expect(s.telemetry()).toBe(true);
  });
});

describe("depolama hata verirse", () => {
  beforeEach(() => {
    vi.resetModules();
    const boom = (): never => {
      throw new Error("kapalı");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom, removeItem: boom });
  });
  it("okuma varsayılan verir, yazma çökmez, bellekteki değer yine de değişir", async () => {
    const s = await import("./settings.js");
    expect(s.haptics()).toBe(true);
    expect(() => s.setHaptics(false)).not.toThrow();
    expect(s.haptics()).toBe(false);
    expect(() => s.setTextSize("large")).not.toThrow();
    expect(s.textSize()).toBe("large");
  });
});

describe("kök öznitelikler", () => {
  it("auto/normal özniteliği kaldırır, diğerleri yazar", async () => {
    const s = await fresh();
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    s.setMotion("reduce");
    s.setTextSize("large");
    s.applyRootSettings(root);
    expect(root.dataset).toEqual({ motion: "reduce", text: "large" });
    s.setMotion("auto");
    s.setTextSize("normal");
    s.applyRootSettings(root);
    expect(root.dataset).toEqual({});
  });
});

describe("parseFlag / parseChoice", () => {
  it("yalnız 0 ve 1 kabul edilir", async () => {
    const s = await fresh();
    expect(s.parseFlag("1", false)).toBe(true);
    expect(s.parseFlag("0", true)).toBe(false);
    expect(s.parseFlag(null, true)).toBe(true);
    expect(s.parseChoice("large", s.TEXT_CHOICES, "normal")).toBe("large");
    expect(s.parseChoice("x", s.TEXT_CHOICES, "normal")).toBe("normal");
  });
});
