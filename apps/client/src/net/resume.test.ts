import type { RoomSnapshot } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { decideOnReturn, reconnectNotice } from "./resume.js";

describe("decideOnReturn", () => {
  it("soket yok ya da kapalı: hemen yeniden bağlan", () => {
    expect(decideOnReturn({ readyState: null, hiddenMs: 0, restored: false })).toBe("reconnect");
    expect(decideOnReturn({ readyState: 2, hiddenMs: 0, restored: false })).toBe("reconnect");
    expect(decideOnReturn({ readyState: 3, hiddenMs: 100, restored: false })).toBe("reconnect");
  });
  it("bağlanıyorsa dokunma", () => {
    expect(decideOnReturn({ readyState: 0, hiddenMs: 60_000, restored: true })).toBe("none");
  });
  it("uzun gizli kalma ya da bfcache: canlılık yoklaması", () => {
    expect(decideOnReturn({ readyState: 1, hiddenMs: 6000, restored: false })).toBe("probe");
    expect(decideOnReturn({ readyState: 1, hiddenMs: 10, restored: true })).toBe("probe");
  });
  it("kısa kopuş: yalnız ping", () => {
    expect(decideOnReturn({ readyState: 1, hiddenMs: 1000, restored: false })).toBe("ping");
  });
});

function snap(phase: string, match: boolean): RoomSnapshot {
  return { phase, match: match ? { round: 2, total: 5 } : null } as unknown as RoomSnapshot;
}

describe("reconnectNotice", () => {
  it("maç sürerken oyun sırasını söyler", () => {
    expect(reconnectNotice(snap("playing", true))).toBe("Tekrar bağlandın · Oyun 3/5");
  });
  it("lobide, finalde ve odasızken sessiz", () => {
    expect(reconnectNotice(snap("lobby", false))).toBeNull();
    expect(reconnectNotice(snap("final", true))).toBeNull();
    expect(reconnectNotice(null)).toBeNull();
  });
});
