import { describe, expect, it } from "vitest";
import type { FriendsData } from "../net/friendsRules.js";
import { friendState } from "./playerMenuRules.js";

const data: FriendsData = {
  friends: [{ username: "mert_34", since: 1, status: "online", joinable: false, withYou: true }],
  incoming: [{ username: "defne_s", at: 1 }],
  outgoing: [{ username: "ayse_t", at: 1 }],
  blocked: ["rahatsiz_01"],
};

describe("friendState", () => {
  it("hesapsız taraf ya da veri yokken gizli", () => {
    expect(friendState(null, "mert_34", data, null)).toBe("none");
    expect(friendState("ben_01", null, data, null)).toBe("none");
    expect(friendState("ben_01", "mert_34", null, null)).toBe("none");
  });
  it("kendin ve engelli kişi için gizli", () => {
    expect(friendState("ben_01", "ben_01", data, null)).toBe("none");
    expect(friendState("ben_01", "rahatsiz_01", data, null)).toBe("none");
  });
  it("arkadaş, giden, gelen ve eklenebilir", () => {
    expect(friendState("ben_01", "mert_34", data, null)).toBe("friend");
    expect(friendState("ben_01", "ayse_t", data, null)).toBe("sent");
    expect(friendState("ben_01", "defne_s", data, null)).toBe("incoming");
    expect(friendState("ben_01", "yeni_biri", data, null)).toBe("can-add");
    expect(friendState("ben_01", "yeni_biri", data, "yeni_biri")).toBe("sent");
  });
});
