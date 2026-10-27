import { describe, expect, it } from "vitest";
import {
  addInvite,
  badgeText,
  canJoinFriend,
  cleanUsername,
  type Friend,
  inviteCandidates,
  leavesCurrentRoom,
  liveInvites,
  parseFriends,
  parseInvite,
  remainingText,
  sortFriends,
  statusShape,
  statusText,
  withStatus,
} from "./friendsRules.js";

const f = (username: string, status: Friend["status"], over: Partial<Friend> = {}): Friend => ({
  username,
  since: 1,
  status,
  joinable: false,
  withYou: false,
  ...over,
});

describe("parseFriends", () => {
  it("geçerli yanıtı çözer, bozuk satırları atar, çevrimiçileri öne alır", () => {
    const out = parseFriends({
      ok: true,
      friends: [
        { username: "zeynep", since: 5, status: "offline", joinable: false, withYou: false },
        { username: "Ali_1", since: 9, status: "lobby", joinable: true, withYou: false },
        { username: "x", since: 1, status: "online" },
        { username: "Mert", since: 2, status: "uyuyor" },
        { username: "Defne", since: 2, status: "online" },
        "bozuk",
      ],
      incoming: [
        { username: "Cem", at: 3 },
        { username: "a b", at: 3 },
      ],
      outgoing: [{ username: "Elif", at: 4 }],
      blocked: [{ username: "Kotu" }, { nope: 1 }],
    });
    expect(out?.friends.map((x) => x.username)).toEqual(["Ali_1", "Defne", "zeynep"]);
    expect(out?.friends[0]?.joinable).toBe(true);
    expect(out?.incoming).toEqual([{ username: "Cem", at: 3 }]);
    expect(out?.outgoing.length).toBe(1);
    expect(out?.blocked).toEqual(["Kotu"]);
  });

  it("ok olmayan ya da nesne olmayan yanıt null", () => {
    expect(parseFriends(null)).toBeNull();
    expect(parseFriends([])).toBeNull();
    expect(parseFriends({ ok: false })).toBeNull();
    expect(parseFriends({ ok: true })?.friends).toEqual([]);
  });

  it("aşırı uzun listeyi kırpar", () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({
      username: `kisi${i}`,
      since: 1,
      status: "offline",
    }));
    expect(parseFriends({ ok: true, friends: many })?.friends.length).toBe(300);
  });
});

describe("sıralama ve metinler", () => {
  it("lobi, oyun, çevrimiçi, çevrimdışı; aynı grupta büyük-küçük harf duyarsız ada göre", () => {
    const sorted = sortFriends([
      f("zeynep", "online"),
      f("Ali", "offline"),
      f("bora", "online"),
      f("Cem", "playing"),
      f("Dilek", "lobby"),
    ]);
    expect(sorted.map((x) => x.username)).toEqual(["Dilek", "Cem", "bora", "zeynep", "Ali"]);
  });

  it("her durumun yazısı ve şekli ayrıdır", () => {
    const all = ["offline", "online", "lobby", "playing"] as const;
    expect(new Set(all.map(statusText)).size).toBe(4);
    expect(new Set(all.map(statusShape)).size).toBe(4);
    expect(statusText("lobby")).toBe("Lobide");
  });

  it("Katıl yalnız lobi/maçta ve katılınabilirse", () => {
    expect(canJoinFriend(f("a", "lobby", { joinable: true }))).toBe(true);
    expect(canJoinFriend(f("a", "playing", { joinable: true }))).toBe(true);
    expect(canJoinFriend(f("a", "playing", { joinable: false }))).toBe(false);
    expect(canJoinFriend(f("a", "online", { joinable: true }))).toBe(false);
    expect(canJoinFriend(f("a", "offline", { joinable: true }))).toBe(false);
  });

  it("davet adayları: çevrimiçi ve aynı odada olmayanlar", () => {
    const out = inviteCandidates([
      f("a", "offline"),
      f("b", "online"),
      f("c", "lobby", { withYou: true }),
      f("d", "playing"),
    ]);
    expect(out.map((x) => x.username)).toEqual(["b", "d"]);
  });

  it("rozet: 0 gizli, 9 üstü 9+", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(3)).toBe("3");
    expect(badgeText(10)).toBe("9+");
  });

  it("kullanıcı adı alanı", () => {
    expect(cleanUsername("  @Ayse_01 ")).toBe("Ayse_01");
    expect(cleanUsername("ab")).toBeNull();
    expect(cleanUsername("ali veli")).toBeNull();
    expect(cleanUsername("")).toBeNull();
  });
});

describe("withStatus", () => {
  const data = {
    friends: [f("Ali", "online"), f("Veli", "offline")],
    incoming: [],
    outgoing: [],
    blocked: [],
  };

  it("durumu günceller ve yeniden sıralar", () => {
    const out = withStatus(data, "veli", "lobby");
    expect(out.friends.map((x) => [x.username, x.status])).toEqual([
      ["Veli", "lobby"],
      ["Ali", "online"],
    ]);
  });

  it("çevrimdışına düşen katılınamaz olur; listede olmayan değişmez", () => {
    const joinable = { ...data, friends: [f("Ali", "lobby", { joinable: true })] };
    expect(withStatus(joinable, "Ali", "offline").friends[0]?.joinable).toBe(false);
    expect(withStatus(data, "Yok", "lobby")).toBe(data);
  });
});

describe("davetler", () => {
  const inv = { from: "Ayse", roomCode: "ABCDE", expiresAt: 1000 };

  it("parseInvite alanları doğrular", () => {
    expect(parseInvite({ ...inv })).toEqual(inv);
    expect(parseInvite({ ...inv, roomCode: "abcde" })).toBeNull();
    expect(parseInvite({ ...inv, roomCode: "ABCD" })).toBeNull();
    expect(parseInvite({ ...inv, from: "a!" })).toBeNull();
    expect(parseInvite({ ...inv, expiresAt: "x" })).toBeNull();
    expect(parseInvite(null)).toBeNull();
  });

  it("aynı kişi ve oda için yeni davet eskisinin yerini alır, sayı sınırlıdır", () => {
    const a = addInvite([], inv);
    const b = addInvite(a, { ...inv, expiresAt: 2000 });
    expect(b).toEqual([{ ...inv, expiresAt: 2000 }]);
    let list = b;
    for (let i = 0; i < 9; i++)
      list = addInvite(list, { from: `Kisi${i}`, roomCode: "ZZZZZ", expiresAt: 5000 });
    expect(list.length).toBe(5);
    expect(list[0]?.from).toBe("Kisi8");
  });

  it("süresi dolanlar ayıklanır", () => {
    expect(liveInvites([inv, { ...inv, from: "Berk", expiresAt: 3000 }], 1500).map((i) => i.from)).toEqual([
      "Berk",
    ]);
  });

  it("başka bir odadaysan katılmak ayrılmayı gerektirir", () => {
    expect(leavesCurrentRoom(null, inv)).toBe(false);
    expect(leavesCurrentRoom("ABCDE", inv)).toBe(false);
    expect(leavesCurrentRoom("QWERT", inv)).toBe(true);
  });

  it("kalan süre metni", () => {
    expect(remainingText(1000, 2000)).toBe("Süresi doldu");
    expect(remainingText(60_000 * 9, 0)).toBe("9 dk kaldı");
    expect(remainingText(30_000, 0)).toBe("1 dk'dan az kaldı");
  });
});
