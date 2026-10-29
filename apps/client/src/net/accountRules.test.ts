import { describe, expect, it } from "vitest";
import {
  emailError,
  loginError,
  normalizeEmail,
  parseAdminFlag,
  parseAvailableAt,
  passwordError,
  registerError,
  turkishDateTime,
  usernameError,
  usernameLockedUntil,
  usernameNote,
  wireNickname,
} from "./accountRules.js";

describe("kullanıcı adı", () => {
  it("3-20 karakter, harf/rakam/alt çizgi", () => {
    for (const ok of ["abc", "Ali_01", "a".repeat(20), "_x_"]) expect(usernameError(ok)).toBeNull();
    for (const bad of ["", "ab", "a".repeat(21), "ali-01", "ali 01", "çağrı", "ali@x"])
      expect(usernameError(bad), bad).not.toBeNull();
  });
});

describe("e-posta", () => {
  it("temel biçim denetlenir, boşluk kırpılır ve küçük harfe çevrilir", () => {
    expect(emailError("a@b.co")).toBeNull();
    expect(emailError("  Ali@Example.COM ")).toBeNull();
    expect(normalizeEmail("  Ali@Example.COM ")).toBe("ali@example.com");
    for (const bad of ["", "ali", "ali@", "@b.co", "a@b", "a b@c.de", "a@b..co"])
      expect(emailError(bad), bad).not.toBeNull();
  });
});

describe("şifre", () => {
  it("8-128 karakter", () => {
    expect(passwordError("1234567")).not.toBeNull();
    expect(passwordError("12345678")).toBeNull();
    expect(passwordError("x".repeat(128))).toBeNull();
    expect(passwordError("x".repeat(129))).not.toBeNull();
  });
});

describe("form denetimi", () => {
  it("kayıtta ilk hata döner", () => {
    expect(registerError({ username: "ab", email: "yok", password: "kisa" })).toMatch(/Kullanıcı adı/);
    expect(registerError({ username: "abc", email: "yok", password: "kisa" })).toMatch(/e-posta/);
    expect(registerError({ username: "abc", email: "a@b.co", password: "kisa" })).toMatch(/Şifre/);
    expect(registerError({ username: "abc", email: "a@b.co", password: "12345678" })).toBeNull();
  });
  it("girişte boş alanlar reddedilir", () => {
    expect(loginError({ login: " ", password: "x" })).not.toBeNull();
    expect(loginError({ login: "abc", password: "" })).not.toBeNull();
    expect(loginError({ login: "abc", password: "x" })).toBeNull();
  });
});

describe("oyundaki ad (tek ad kuralı)", () => {
  it("protokole her zaman geçerli bir ad gider", () => {
    expect(wireNickname("Ali_01")).toBe("Ali_01");
    expect(wireNickname("a".repeat(20))).toBe("a".repeat(16));
    expect(wireNickname("___")).toBe("Oyuncu");
    expect(wireNickname("")).toBe("Oyuncu");
  });
});

describe("kullanıcı adı değiştirme tarihi", () => {
  it("Türkiye saatiyle yazılır", () => {
    expect(turkishDateTime(Date.UTC(2026, 10, 3, 11, 5))).toBe("3 Kasım 2026 14:05");
    expect(turkishDateTime(Date.UTC(2026, 11, 31, 22, 0))).toBe("1 Ocak 2027 01:00");
  });
  it("kilit yalnız gelecekteki anda sürer", () => {
    expect(usernameLockedUntil(null, 100)).toBeNull();
    expect(usernameLockedUntil(100, 100)).toBeNull();
    expect(usernameLockedUntil(101, 100)).toBe(101);
  });
  it("bilgi satırı serbestken kuralı, kilitliyken tarihi söyler", () => {
    expect(usernameNote(null, 0)).toBe("Kullanıcı adını 7 günde bir değiştirebilirsin.");
    const at = Date.UTC(2026, 10, 3, 11, 5);
    expect(usernameNote(at, at - 1)).toBe(
      "Kullanıcı adını 3 Kasım 2026 14:05 tarihinde tekrar değiştirebilirsin.",
    );
    expect(usernameNote(at, at + 1)).toBe("Kullanıcı adını 7 günde bir değiştirebilirsin.");
  });
  it("sunucu değeri doğrulanır", () => {
    expect(parseAvailableAt(1_700_000_000_000)).toBe(1_700_000_000_000);
    for (const bad of [null, undefined, "5", 0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(parseAvailableAt(bad), String(bad)).toBeNull();
  });
});

describe("yönetici işareti", () => {
  it("yalnız true yönetici sayılır", () => {
    expect(parseAdminFlag(true)).toBe(true);
    for (const v of [false, undefined, null, 1, "true", "1", {}, []]) expect(parseAdminFlag(v)).toBe(false);
  });
});
