import { beforeEach, describe, expect, it } from "vitest";
import { applyAudioSession, getPlayInSilent, setPlayInSilent } from "./audioSession.js";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

describe("audioSession", () => {
  it("varsayılan: sessiz düğmesine uyulur, tür değişmez", () => {
    const host = { audioSession: { type: "ambient" } };
    expect(getPlayInSilent()).toBe(false);
    applyAudioSession(host);
    expect(host.audioSession.type).toBe("ambient");
  });

  it("tercih açılınca playback olur, kapanınca auto'ya döner", () => {
    const host = { audioSession: { type: "auto" } };
    setPlayInSilent(true, host);
    expect(host.audioSession.type).toBe("playback");
    expect(getPlayInSilent()).toBe(true);
    setPlayInSilent(false, host);
    expect(host.audioSession.type).toBe("auto");
  });

  it("destek yoksa ya da yazma hata verirse sessiz kalır", () => {
    expect(() => setPlayInSilent(true, {})).not.toThrow();
    const throwing = {
      get audioSession(): { type: string } {
        throw new Error("x");
      },
    };
    expect(() => applyAudioSession(throwing)).not.toThrow();
  });
});
