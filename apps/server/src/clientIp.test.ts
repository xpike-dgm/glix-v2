import { describe, expect, it } from "vitest";
import { isPrivateOrLoopback, resolveClientIp } from "./clientIp.js";

describe("resolveClientIp", () => {
  it("TRUST_PROXY kapalıyken başlık yok sayılır", () => {
    expect(resolveClientIp("10.0.0.5", "1.2.3.4", false)).toBe("10.0.0.5");
  });
  it("özel/loopback eşten gelen XFF'in son girdisi kullanılır", () => {
    expect(resolveClientIp("172.18.0.1", "6.6.6.6, 203.0.113.9", true)).toBe("203.0.113.9");
    expect(resolveClientIp("127.0.0.1", " 203.0.113.9 ", true)).toBe("203.0.113.9");
    expect(resolveClientIp("::ffff:192.168.1.2", ["8.8.8.8"], true)).toBe("8.8.8.8");
    expect(resolveClientIp("::1", "2001:db8::1", true)).toBe("2001:db8::1");
    expect(resolveClientIp("fd12::1", "1.1.1.1", true)).toBe("1.1.1.1");
  });
  it("genel adresten gelen başlık güvenilmez", () => {
    expect(resolveClientIp("203.0.113.7", "1.2.3.4", true)).toBe("203.0.113.7");
    expect(resolveClientIp("172.32.0.1", "1.2.3.4", true)).toBe("172.32.0.1");
  });
  it("başlık yoksa ya da bozuksa eş adres", () => {
    expect(resolveClientIp("10.1.1.1", undefined, true)).toBe("10.1.1.1");
    expect(resolveClientIp("10.1.1.1", "bozuk", true)).toBe("10.1.1.1");
    expect(resolveClientIp("10.1.1.1", "1.2.3.4,", true)).toBe("10.1.1.1");
    expect(resolveClientIp(undefined, undefined, true)).toBe("unknown");
  });
  it("özel aralık sınırları", () => {
    for (const ip of [
      "127.0.0.1",
      "10.255.0.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.1",
      "::1",
      "fc00::1",
      "fdff::2",
    ])
      expect(isPrivateOrLoopback(ip), ip).toBe(true);
    for (const ip of ["172.15.0.1", "172.32.0.1", "192.169.0.1", "11.0.0.1", "2001:db8::1", "fe80::1", "x"])
      expect(isPrivateOrLoopback(ip), ip).toBe(false);
  });
});
