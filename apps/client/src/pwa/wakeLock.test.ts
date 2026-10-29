import { describe, expect, it } from "vitest";
import { createWakeLock, type SentinelLike } from "./wakeLock.js";

function fakeHost() {
  const log = { requests: 0, releases: 0, sentinels: [] as Array<{ fire: () => void }> };
  const host = {
    wakeLock: {
      async request(): Promise<SentinelLike> {
        log.requests += 1;
        let cb: () => void = () => {};
        const s: SentinelLike = {
          async release() {
            log.releases += 1;
          },
          addEventListener(_t, l) {
            cb = l;
          },
        };
        log.sentinels.push({ fire: () => cb() });
        return s;
      },
    },
  };
  return { host, log };
}

describe("createWakeLock", () => {
  it("odaya girince alır, tekrar istemez, çıkınca bırakır", async () => {
    const { host, log } = fakeHost();
    const wl = createWakeLock(host, () => true);
    await wl.setWanted(true);
    await wl.setWanted(true);
    expect(log.requests).toBe(1);
    await wl.setWanted(false);
    expect(log.releases).toBe(1);
  });

  it("sistem bıraktıysa görünür olunca yeniden alır", async () => {
    const { host, log } = fakeHost();
    const wl = createWakeLock(host, () => true);
    await wl.setWanted(true);
    log.sentinels[0]?.fire();
    await wl.onVisible();
    expect(log.requests).toBe(2);
  });

  it("ana ekranda görünür olunca almaz", async () => {
    const { host, log } = fakeHost();
    const wl = createWakeLock(host, () => true);
    await wl.onVisible();
    expect(log.requests).toBe(0);
  });

  it("gizliyken istemez", async () => {
    const { host, log } = fakeHost();
    const wl = createWakeLock(host, () => false);
    await wl.setWanted(true);
    expect(log.requests).toBe(0);
  });

  it("destek yoksa ya da istek reddedilirse sessiz kalır", async () => {
    const none = createWakeLock({}, () => true);
    await expect(none.setWanted(true)).resolves.toBeUndefined();
    const denied = createWakeLock(
      {
        wakeLock: {
          request: () => Promise.reject(new Error("NotAllowedError")),
        },
      },
      () => true,
    );
    await expect(denied.setWanted(true)).resolves.toBeUndefined();
  });

  /** iOS Safari benzeri: kilit yalnız kullanıcı jestinin içinde verilir. */
  function gestureOnlyHost() {
    const state = { inGesture: false, granted: 0, denied: 0 };
    let releaseCb: () => void = () => {};
    const host = {
      wakeLock: {
        request(): Promise<SentinelLike> {
          if (!state.inGesture) {
            state.denied += 1;
            return Promise.reject(new Error("NotAllowedError"));
          }
          state.granted += 1;
          return Promise.resolve({
            async release() {},
            addEventListener(_t: "release", l: () => void) {
              releaseCb = l;
            },
          });
        },
      },
    };
    return { host, state, systemRelease: () => releaseCb() };
  }

  it("jest dışında reddedilen kilidi ilk dokunuşta alır (iOS: Hazırım'dan sonra ekran kilitlenmez)", async () => {
    const { host, state } = gestureOnlyHost();
    const wl = createWakeLock(host, () => true);
    await wl.setWanted(true); // sunucudan gelen oda görüntüsü: jest yok
    expect(state).toMatchObject({ granted: 0, denied: 1 });
    state.inGesture = true; // "Hazırım" dokunuşu
    const p = wl.onGesture();
    state.inGesture = false;
    await p;
    expect(state.granted).toBe(1);
    // Kilit tutulurken sonraki dokunuşlar yeni istek açmaz.
    state.inGesture = true;
    await wl.onGesture();
    expect(state.granted).toBe(1);
  });

  it("arka plandan dönüşte reddedilen kilidi sonraki dokunuşta yeniden alır", async () => {
    const { host, state, systemRelease } = gestureOnlyHost();
    const wl = createWakeLock(host, () => true);
    state.inGesture = true;
    await wl.setWanted(true);
    state.inGesture = false;
    expect(state.granted).toBe(1);
    systemRelease(); // iOS arka plana geçince bıraktı
    await wl.onVisible(); // visibilitychange: jest yok, reddedilir
    expect(state.denied).toBe(1);
    state.inGesture = true;
    await wl.onGesture();
    expect(state.granted).toBe(2);
  });

  it("odada değilken dokunuş kilit istemez", async () => {
    const { host, log } = fakeHost();
    const wl = createWakeLock(host, () => true);
    await wl.onGesture();
    await wl.setWanted(true);
    await wl.setWanted(false);
    await wl.onGesture();
    expect(log.requests).toBe(1);
  });
});
