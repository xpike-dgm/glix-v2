import { describe, expect, it } from "vitest";
import { snapshot } from "./fixtures.js";
import { parseServerMessage } from "./parse.js";

const wire = (v: unknown): string => JSON.stringify(v);

describe("sunucu mesajı doğrulama", () => {
  it("geçerli room mesajını kabul eder", () => {
    const m = parseServerMessage(wire({ type: "room", snapshot: snapshot("briefing") }));
    expect(m?.type).toBe("room");
    if (m?.type === "room") expect(m.snapshot.match?.gameId).toBe("butona-bas");
  });
  it("sahne onayını ve stageCount alanını doğrular", () => {
    expect(parseServerMessage(wire({ type: "stage", roomCode: "KX7QP" }))).toEqual({
      type: "stage",
      roomCode: "KX7QP",
    });
    expect(parseServerMessage(wire({ type: "stage" }))).toBeNull();
    expect(parseServerMessage(wire({ type: "stage", roomCode: 5 }))).toBeNull();
    const parse = (stageCount: unknown) =>
      parseServerMessage(wire({ type: "room", snapshot: { ...snapshot(), stageCount } }));
    const two = parse(2);
    if (two?.type === "room") expect(two.snapshot.stageCount).toBe(2);
    else throw new Error("room kabul edilmedi");
    for (const bad of [undefined, "2", -3, null]) {
      const m = parse(bad);
      if (m?.type === "room") expect(m.snapshot.stageCount).toBe(0);
    }
  });
  it("oyun seçim modunu doğrular", () => {
    const parse = (selection: unknown) =>
      parseServerMessage(wire({ type: "room", snapshot: { ...snapshot(), selection } }));
    expect(parse({ mode: "manual" })?.type).toBe("room");
    const random = parse({ mode: "random", count: 5 });
    if (random?.type === "room") expect(random.snapshot.selection).toEqual({ mode: "random", count: 5 });
    else throw new Error("rastgele mod kabul edilmedi");
    for (const bad of [undefined, null, "random", {}, { mode: "x" }, { mode: "random" }]) {
      expect(parse(bad)).toBeNull();
    }
    for (const count of [0, 1.5, "5", 65, null]) expect(parse({ mode: "random", count })).toBeNull();
  });
  it("bozuk snapshot'ı reddeder", () => {
    expect(parseServerMessage(wire({ type: "room", snapshot: { ...snapshot(), phase: "x" } }))).toBeNull();
    expect(
      parseServerMessage(wire({ type: "room", snapshot: { ...snapshot(), players: [{ id: 1 }] } })),
    ).toBeNull();
    expect(parseServerMessage(wire({ type: "room", snapshot: null }))).toBeNull();
  });
  it("diğer mesaj türlerini doğrular", () => {
    expect(parseServerMessage(wire({ type: "pong", t: 1, serverTime: 2 }))).toEqual({
      type: "pong",
      t: 1,
      serverTime: 2,
    });
    expect(parseServerMessage(wire({ type: "pong", t: "1", serverTime: 2 }))).toBeNull();
    expect(parseServerMessage(wire({ type: "left", reason: "kicked" }))).toEqual({
      type: "left",
      reason: "kicked",
    });
    expect(parseServerMessage(wire({ type: "left", reason: "nope" }))).toBeNull();
    expect(parseServerMessage(wire({ type: "error", code: "resume_failed", message: "x" }))?.type).toBe(
      "error",
    );
    expect(parseServerMessage(wire({ type: "error", code: "bilinmeyen", message: "x" }))).toBeNull();
    expect(parseServerMessage(wire({ type: "actionAck", seq: 3, ok: false, reason: "r" }))).toEqual({
      type: "actionAck",
      seq: 3,
      ok: false,
      reason: "r",
    });
  });
  it("patch mesajını doğrular", () => {
    expect(parseServerMessage(wire({ type: "patch", baseRev: 1, rev: 2, patch: { a: 1 } }))).toEqual({
      type: "patch",
      baseRev: 1,
      rev: 2,
      patch: { a: 1 },
    });
    expect(parseServerMessage(wire({ type: "patch", baseRev: "1", rev: 2, patch: {} }))).toBeNull();
    expect(parseServerMessage(wire({ type: "patch", baseRev: 1, rev: 2, patch: [] }))).toBeNull();
    expect(parseServerMessage(wire({ type: "patch", baseRev: 1, rev: 2 }))).toBeNull();
  });
  it("JSON olmayan ya da bilinmeyen türü reddeder", () => {
    expect(parseServerMessage("{")).toBeNull();
    expect(parseServerMessage("[]")).toBeNull();
    expect(parseServerMessage(wire({ type: "yok" }))).toBeNull();
  });
  it("reaction mesajını yalnız izinli emojiyle kabul eder", () => {
    expect(parseServerMessage(wire({ type: "reaction", playerId: "p1", emoji: "🔥" }))).toEqual({
      type: "reaction",
      playerId: "p1",
      emoji: "🔥",
    });
    expect(parseServerMessage(wire({ type: "reaction", playerId: "p1", emoji: "💩" }))).toBeNull();
    expect(parseServerMessage(wire({ type: "reaction", emoji: "🔥" }))).toBeNull();
    expect(parseServerMessage(wire({ type: "reaction", playerId: 3, emoji: "🔥" }))).toBeNull();
  });
  it("snapshot'ta lobbyReady dizi olmalı", () => {
    const parse = (lobbyReady: unknown) =>
      parseServerMessage(wire({ type: "room", snapshot: { ...snapshot(), lobbyReady } }));
    const ok = parse(["a"]);
    if (ok?.type === "room") expect(ok.snapshot.lobbyReady).toEqual(["a"]);
    else throw new Error("kabul edilmedi");
    for (const bad of [undefined, null, "a", [1], {}]) expect(parse(bad)).toBeNull();
  });
  it("nickname_taken hata kodunu tanır", () => {
    expect(parseServerMessage(wire({ type: "error", code: "nickname_taken", message: "x" }))?.type).toBe(
      "error",
    );
  });
});

describe("arkadaş mesajları", () => {
  it("durum, istek, değişim, davet ve davet onayı", () => {
    expect(parseServerMessage(wire({ type: "friendStatus", username: "Ayse", status: "lobby" }))).toEqual({
      type: "friendStatus",
      username: "Ayse",
      status: "lobby",
    });
    expect(parseServerMessage(wire({ type: "friendStatus", username: "Ayse", status: "uyuyor" }))).toBeNull();
    expect(parseServerMessage(wire({ type: "friendRequest", username: "Ayse" }))?.type).toBe("friendRequest");
    expect(parseServerMessage(wire({ type: "friendRequest" }))).toBeNull();
    expect(parseServerMessage(wire({ type: "friendsChanged" }))).toEqual({ type: "friendsChanged" });
    expect(parseServerMessage(wire({ type: "inviteSent", username: "Berk" }))?.type).toBe("inviteSent");
    const invite = { type: "invite", from: "Ayse", roomCode: "ABCDE", expiresAt: 5 };
    expect(parseServerMessage(wire(invite))).toEqual(invite);
    expect(parseServerMessage(wire({ ...invite, roomCode: "abc" }))).toBeNull();
    expect(parseServerMessage(wire({ ...invite, expiresAt: "x" }))).toBeNull();
  });

  it("yeni hata kodları kabul edilir", () => {
    for (const code of ["invite_failed", "friend_not_found", "login_required", "stage_full"])
      expect(parseServerMessage(wire({ type: "error", code, message: "x" }))?.type).toBe("error");
  });
});

describe("A3: duyuru, bakım ve lobi bildirimi", () => {
  const ann = { id: 2, text: "Bu akşam bakım var", kind: "uyari", endsAt: null };

  it("welcome site alanını taşır; eski sunucuda alan yoktur", () => {
    const base = { type: "welcome", protocolVersion: 3, serverVersion: "0.1.0" };
    const withSite = parseServerMessage(wire({ ...base, site: { announcement: ann, maintenance: true } }));
    expect(withSite).toEqual({ ...base, site: { announcement: ann, maintenance: true } });
    expect(parseServerMessage(wire(base))).toEqual(base);
    // Bozuk site alanı welcome'u düşürmez, yalnız alanı atar.
    expect(parseServerMessage(wire({ ...base, site: "x" }))).toEqual(base);
  });

  it("siteNotice yalnız geçerli durumla kabul edilir", () => {
    expect(
      parseServerMessage(wire({ type: "siteNotice", site: { announcement: null, maintenance: false } })),
    ).toEqual({
      type: "siteNotice",
      site: { announcement: null, maintenance: false },
    });
    expect(parseServerMessage(wire({ type: "siteNotice", site: { announcement: ann } }))).toBeNull();
    expect(parseServerMessage(wire({ type: "siteNotice" }))).toBeNull();
  });

  it("lobbyNotice kısa bir metin ister", () => {
    expect(parseServerMessage(wire({ type: "lobbyNotice", text: "Kule Ustası şu an kapalı." }))).toEqual({
      type: "lobbyNotice",
      text: "Kule Ustası şu an kapalı.",
    });
    for (const bad of [
      { type: "lobbyNotice" },
      { type: "lobbyNotice", text: "" },
      { type: "lobbyNotice", text: "x".repeat(201) },
    ])
      expect(parseServerMessage(wire(bad))).toBeNull();
  });

  it("bakım hata kodu kabul edilir", () => {
    expect(
      parseServerMessage(
        wire({
          type: "error",
          code: "maintenance",
          message: "Kısa bir bakım yapıyoruz, birazdan tekrar dene.",
        }),
      ),
    ).toEqual({
      type: "error",
      code: "maintenance",
      message: "Kısa bir bakım yapıyoruz, birazdan tekrar dene.",
    });
  });
});

describe("U16 A4 yeni mesajlar", () => {
  it("reportAck, yeni ayrılma sebepleri ve hata kodları", () => {
    expect(parseServerMessage(JSON.stringify({ type: "reportAck" }))).toEqual({ type: "reportAck" });
    for (const reason of ["adminClosed", "removed"])
      expect(parseServerMessage(JSON.stringify({ type: "left", reason }))).toEqual({ type: "left", reason });
    expect(parseServerMessage(JSON.stringify({ type: "left", reason: "bilinmeyen" }))).toBeNull();
    for (const code of ["report_limit", "report_duplicate", "room_blocked"]) {
      const msg = parseServerMessage(JSON.stringify({ type: "error", code, message: "Metin" }));
      expect(msg).toEqual({ type: "error", code, message: "Metin" });
    }
  });
});

describe("kart alanları", () => {
  const cards = {
    phase: { done: ["b"], silenced: [] },
    hands: { a: 1, b: 0 },
    announce: [{ playerId: "b", cardId: "talihsizlik" }],
    plays: [{ playerId: "a", cardId: "celme", target: "b" }],
    lines: [{ cardId: "celme", owner: "a", subject: "b", before: 1, after: 0 }],
  };
  const mine = {
    hand: ["kalkan"],
    gameOptions: { veto: [{ id: "g", name: "G" }], pick: [] },
    pick: {
      options: [null, "celme", "takviye"],
      blind: false,
      taken: [0],
      total: 1,
      got: ["kalkan"],
      held: null,
      silenced: false,
      done: false,
    },
    staged: null,
    played: null,
  };
  const withMatch = (extra: Record<string, unknown>, phase = "cards") =>
    parseServerMessage(
      wire({
        type: "room",
        snapshot: { ...snapshot(phase as never), match: { ...snapshot("briefing").match, ...extra } },
      }),
    );
  it("kart seçimi aşamasını ve kart ayarını kabul eder", () => {
    const m = parseServerMessage(
      wire({
        type: "room",
        snapshot: { ...snapshot("cards"), cardSettings: { enabled: true, off: ["kalkan"] } },
      }),
    );
    expect(m?.type).toBe("room");
    if (m?.type === "room") {
      expect(m.snapshot.phase).toBe("cards");
      expect(m.snapshot.cardSettings).toEqual({ enabled: true, off: ["kalkan"] });
    }
  });
  it("kart ayarı yoksa alan yoktur; bozuksa snapshot reddedilir", () => {
    const m = parseServerMessage(wire({ type: "room", snapshot: snapshot("lobby") }));
    if (m?.type === "room") expect(m.snapshot.cardSettings).toBeUndefined();
    for (const bad of [{ enabled: true }, { enabled: true, off: ["yok"] }, "x", null]) {
      expect(
        parseServerMessage(wire({ type: "room", snapshot: { ...snapshot("lobby"), cardSettings: bad } })),
      ).toBeNull();
    }
  });
  it("herkese açık ve özel kart bilgisini doğrular", () => {
    const m = withMatch({ cards, mine });
    expect(m?.type).toBe("room");
    if (m?.type === "room") {
      expect(m.snapshot.match?.cards?.announce[0]?.cardId).toBe("talihsizlik");
      expect(m.snapshot.match?.mine?.pick?.options).toEqual([null, "celme", "takviye"]);
      expect(m.snapshot.match?.mine?.gameOptions.veto[0]?.name).toBe("G");
    }
    const none = withMatch({ cards: null, mine: null });
    if (none?.type === "room") {
      expect(none.snapshot.match?.cards).toBeNull();
      expect(none.snapshot.match?.mine).toBeNull();
    }
  });
  it("bozuk kart verisi snapshot'ı reddeder", () => {
    expect(withMatch({ cards: { ...cards, announce: [{ playerId: "b", cardId: "yok" }] } })).toBeNull();
    expect(withMatch({ cards: { ...cards, hands: { a: "x" } } })).toBeNull();
    expect(withMatch({ cards: { ...cards, lines: [{ ...cards.lines[0], before: 1.5 }] } })).toBeNull();
    expect(withMatch({ mine: { ...mine, hand: ["yok"] } })).toBeNull();
    expect(withMatch({ mine: { ...mine, pick: { ...mine.pick, options: ["yok"] } } })).toBeNull();
    expect(withMatch({ mine: { ...mine, gameOptions: null } })).toBeNull();
  });
  it("card_invalid hata kodunu tanır", () => {
    expect(parseServerMessage(wire({ type: "error", code: "card_invalid", message: "x" }))?.type).toBe(
      "error",
    );
  });
});
