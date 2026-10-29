import { GAMES, getCatalog } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { pickRandomGames } from "./match.js";
import { create, join, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

// Varsayılan sunucu (taslak yolu AÇILMAMIŞ): sahip onayı bekleyen oyunlar normal oyuncuya hiçbir yoldan erişilemez.
// Not: `enableDraftGames` süreç genelinde `GAMES`'i değiştirdiği için taslak yolunu AÇAN testler ayrı dosyadadır
// (taslak-oyunlar.test.ts); vitest her test dosyasını kendi modül örneğinde çalıştırır.
useServer();

const DRAFTS = ["ortak-nokta", "tek-ve-kucuk", "sessiz-sira"] as const;

describe("taslak oyunlar varsayılan olarak kapalıdır", () => {
  it("kayıt defterinde ve motor kataloğunda yok", () => {
    for (const id of DRAFTS) {
      expect(Object.hasOwn(GAMES, id)).toBe(false);
      expect(getCatalog().some((g) => g.id === id)).toBe(false);
    }
  });

  it("odanın kataloğunda (lobi seçicisi) yok", async () => {
    const [host] = await setupRoom(["A", "B", "C"]);
    const ids = host?.room.catalog.map((g) => g.id) ?? [];
    expect(ids.length).toBeGreaterThan(20);
    for (const id of DRAFTS) expect(ids).not.toContain(id);
  });

  it("ev sahibi elle bile seçemez: setGames reddedilir, seçim değişmez", async () => {
    const host = await create("A");
    for (const id of DRAFTS) {
      host.send({ type: "setGames", gameIds: [id] });
      await until(() => host.lastError?.code === "invalid_games", `${id} reddedildi`);
      expect(host.room.gameIds).toEqual(["butona-bas"]);
      host.msgs.length = 0;
    }
    host.send({ type: "setGames", gameIds: ["butona-bas", "ortak-nokta"] });
    await sleep(40);
    await sync();
    expect(host.room.gameIds).toEqual(["butona-bas"]);
  });

  it("rastgele havuza girmez (8 oyuncu, en çok oyun)", () => {
    const picked = pickRandomGames(k.srv.runtime, 8, 500);
    expect(picked.length).toBeGreaterThan(20);
    for (const id of DRAFTS) expect(picked).not.toContain(id);
  });

  it("rastgele modda başlayan maçın oyun listesinde yok", async () => {
    for (let i = 0; i < 3; i++) {
      const host = await create(`H${i}`);
      const guest = await join(host.session.roomCode, `G${i}`);
      const third = await join(host.session.roomCode, `T${i}`);
      host.send({ type: "setRandom", count: 64 });
      await until(() => host.room.selection.mode === "random", "rastgele mod");
      host.send({ type: "startMatch" });
      await until(() => host.room.phase === "briefing", "briefing");
      expect(host.room.gameIds.length).toBeGreaterThan(5);
      for (const id of DRAFTS) expect(host.room.gameIds).not.toContain(id);
      void guest;
      void third;
    }
  });
});
