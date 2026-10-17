import { butonaBas, replay } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { Client, k, press, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

describe("bağlantı kaydı (presence)", () => {
  useServer();

  it("oyun sırasında kopma ve dönüş kayda yazılır; kayıt tekrar oynatılınca sonucu verir", async () => {
    const cs = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    const [a, b] = cs;
    await startPlaying(cs);
    await press(a);

    b.ws.terminate();
    await until(() => a.room.players[1]?.connected === false, "kopma");
    const dropBy = k.clock.now();
    k.clock.advance(500);
    await press(a);

    const b2 = await Client.connect();
    b2.send({ type: "resume", token: b.session.token });
    await until(() => b2.updates.length > 0, "resume");
    const backBy = k.clock.now();
    await sync();

    k.clock.advance(46_000);
    await until(() => a.room.phase === "results", "sonuç");

    const log = k.srv.recentLogs.at(-1);
    if (!log) throw new Error("kayıt yok");
    const bId = a.room.players[1]?.id;
    expect(log.presence.map((p) => [p.playerId, p.connected])).toEqual([
      [bId, false],
      [bId, true],
    ]);
    const [drop, back] = log.presence;
    expect(drop?.t).toBeLessThanOrEqual(dropBy);
    expect(back?.t).toBeLessThanOrEqual(backBy);
    expect(back?.t).toBeGreaterThan(drop?.t ?? 0);
    expect(replay(butonaBas, log)).toEqual(a.room.match?.result);
  });
});
