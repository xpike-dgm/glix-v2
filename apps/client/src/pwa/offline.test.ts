import { describe, expect, it } from "vitest";
import { isOfflineHome } from "./offline.js";

describe("isOfflineHome", () => {
  it("tarayıcı çevrimdışıysa her durumda true", () => {
    expect(isOfflineHome({ online: false, conn: "open", failedAttempts: 0 })).toBe(true);
    expect(isOfflineHome({ online: false, conn: "connecting", failedAttempts: 0 })).toBe(true);
  });
  it("ilk bağlanma denemesi sürerken henüz göstermez", () => {
    expect(isOfflineHome({ online: true, conn: "connecting", failedAttempts: 0 })).toBe(false);
  });
  it("bağlantı kurulamadıysa gösterir", () => {
    expect(isOfflineHome({ online: true, conn: "closed", failedAttempts: 1 })).toBe(true);
    expect(isOfflineHome({ online: true, conn: "connecting", failedAttempts: 2 })).toBe(true);
  });
  it("bağlıyken ya da boşta beklerken göstermez", () => {
    expect(isOfflineHome({ online: true, conn: "open", failedAttempts: 0 })).toBe(false);
    expect(isOfflineHome({ online: true, conn: "idle", failedAttempts: 0 })).toBe(false);
  });
});
