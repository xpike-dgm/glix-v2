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
});
