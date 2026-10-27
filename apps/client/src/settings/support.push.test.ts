import { describe, expect, it } from "vitest";
import { type PushSupportInput, pushToggleMode } from "./support.js";

const base: PushSupportInput = {
  serverEnabled: true,
  hasPushManager: true,
  hasServiceWorker: true,
  hasNotification: true,
  ios: false,
  standalone: false,
  permission: "default",
};

describe("Ayarlar: Bildirimler satırı", () => {
  it("sunucu anahtar bildirmediyse hiç görünmez", () => {
    expect(pushToggleMode({ ...base, serverEnabled: false })).toBe("hidden");
    expect(pushToggleMode({ ...base, serverEnabled: false, ios: true })).toBe("hidden");
  });

  it("destekleyen tarayıcıda anahtar görünür", () => {
    expect(pushToggleMode(base)).toBe("toggle");
    expect(pushToggleMode({ ...base, permission: "granted" })).toBe("toggle");
  });

  it("iPhone'da ana ekrana eklenmemişse ipucu (PushManager olmasa da)", () => {
    expect(pushToggleMode({ ...base, ios: true, hasPushManager: false })).toBe("hint");
    expect(pushToggleMode({ ...base, ios: true })).toBe("hint");
  });

  it("iPhone'da ana ekrandan açıksa anahtar", () => {
    expect(pushToggleMode({ ...base, ios: true, standalone: true })).toBe("toggle");
  });

  it("PushManager, hizmet çalışanı ya da Notification yoksa gizli", () => {
    expect(pushToggleMode({ ...base, hasPushManager: false })).toBe("hidden");
    expect(pushToggleMode({ ...base, hasServiceWorker: false })).toBe("hidden");
    expect(pushToggleMode({ ...base, hasNotification: false })).toBe("hidden");
  });

  it("izin kapatılmışsa anahtar devre dışı", () => {
    expect(pushToggleMode({ ...base, permission: "denied" })).toBe("denied");
  });
});
