/**
 * Ekran Uyanık Tutma: oyuncu bir odadayken ekran kararmasın. iOS arka plana geçince kilidi bırakır;
 * sekme geri gelince yeniden alınır. Destek yoksa ya da reddedilirse sessizce vazgeçilir.
 */

export interface SentinelLike {
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
}

export interface WakeLockHost {
  wakeLock?: { request(type: "screen"): Promise<SentinelLike> };
}

export interface WakeLockController {
  /** Odadayken true, ana ekranda false. */
  setWanted(wanted: boolean): Promise<void>;
  /** Sekme görünür olunca çağrılır. */
  onVisible(): Promise<void>;
}

export function createWakeLock(host: WakeLockHost, isVisible: () => boolean): WakeLockController {
  let wanted = false;
  let sentinel: SentinelLike | null = null;
  let requesting = false;

  async function acquire(): Promise<void> {
    if (!wanted || sentinel || requesting || !isVisible() || !host.wakeLock) return;
    requesting = true;
    try {
      const s = await host.wakeLock.request("screen");
      s.addEventListener("release", () => {
        if (sentinel === s) sentinel = null;
      });
      if (wanted) sentinel = s;
      else await s.release().catch(() => {});
    } catch {
      // destek yok, pil tasarrufu ya da izin reddi: sessizce geç
    } finally {
      requesting = false;
    }
  }

  async function release(): Promise<void> {
    const s = sentinel;
    sentinel = null;
    if (s) await s.release().catch(() => {});
  }

  return {
    async setWanted(next) {
      wanted = next;
      if (next) await acquire();
      else await release();
    },
    onVisible: acquire,
  };
}

let controller: WakeLockController | null = null;

/** Tarayıcıya bağlı tek denetleyici; ilk çağrıda dinleyici kurulur. */
export function setScreenAwake(wanted: boolean): void {
  if (!controller) {
    const c = createWakeLock(navigator as WakeLockHost, () => document.visibilityState === "visible");
    controller = c;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void c.onVisible();
    });
  }
  void controller.setWanted(wanted);
}
