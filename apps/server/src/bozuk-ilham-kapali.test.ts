import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, until, useServer } from "./testkit.js";

// Anahtar yok: özellik tamamen kapalı (düğme hiç görünmez, istek reddedilir).
useServer();

describe("Bozuk Telefon: İlham ver anahtar yokken", () => {
  it("kişisel görünümde ilham alanı yok; istek wrong_phase", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const a = cs[0] as Client;
    a.send({ type: "setGames", gameIds: ["bozuk-telefon"] });
    await until(() => a.room.gameIds[0] === "bozuk-telefon", "oyun");
    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "ready" });
    await until(() => a.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => a.room.phase === "playing", "playing");
    expect(a.room.match?.inspire ?? null).toBeNull();
    a.send({ type: "inspire", round: 0 });
    await until(() => a.of("error").some((e) => e.code === "wrong_phase"), "ret");
  });
});
