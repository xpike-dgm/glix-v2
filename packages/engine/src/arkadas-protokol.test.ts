import { describe, expect, it } from "vitest";
import { isFriendStatus, parseClientMessage } from "./protocol.js";

const parse = (o: unknown) => parseClientMessage(JSON.stringify(o));

describe("arkadaş mesajları", () => {
  it("inviteFriend: yalnız geçerli kullanıcı adı", () => {
    expect(parse({ type: "inviteFriend", username: "Ayse_1" })).toEqual({
      type: "inviteFriend",
      username: "Ayse_1",
    });
    for (const username of ["", "ab", "a".repeat(21), "a b", "ali!", "ali@x.com", 5, null])
      expect(parse({ type: "inviteFriend", username })).toBeNull();
    expect(parse({ type: "inviteFriend", username: "Ayse", extra: 1 })).toBeNull();
    expect(parse({ type: "inviteFriend" })).toBeNull();
  });

  it("joinFriend: takma ad temizlenir, avatar isteğe bağlı ve aralık denetimli", () => {
    expect(parse({ type: "joinFriend", username: "Ayse", nickname: "  Ay   se " })).toEqual({
      type: "joinFriend",
      username: "Ayse",
      nickname: "Ay se",
    });
    expect(parse({ type: "joinFriend", username: "Ayse", nickname: "A", avatar: 3 })).toEqual({
      type: "joinFriend",
      username: "Ayse",
      nickname: "A",
      avatar: 3,
    });
    expect(parse({ type: "joinFriend", username: "Ayse", nickname: "A", avatar: 8 })).toBeNull();
    expect(parse({ type: "joinFriend", username: "Ayse", nickname: "" })).toBeNull();
    expect(parse({ type: "joinFriend", username: "x", nickname: "A" })).toBeNull();
    expect(parse({ type: "joinFriend", username: "Ayse", nickname: "A", code: "ABCDE" })).toBeNull();
  });

  it("durum değerleri", () => {
    for (const s of ["offline", "online", "lobby", "playing"]) expect(isFriendStatus(s)).toBe(true);
    expect(isFriendStatus("away")).toBe(false);
    expect(isFriendStatus(1)).toBe(false);
  });
});
