import { describe, expect, it } from "vitest";
import {
  emailError,
  loginError,
  normalizeEmail,
  passwordError,
  registerError,
  usernameError,
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
