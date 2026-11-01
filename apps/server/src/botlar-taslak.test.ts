/** Taslak oyunlar (test2'de açık) da hareketsiz insan + botlarla kilitlenmeden biter; bot stratejisi TASLAK_BOTLAR'dan. */
import { GAMES, TASLAK_OYUNLAR } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { createManualClock } from "./clock.js";
import { handleMessage } from "./handlers.js";
import { runTick, TICK_MS } from "./match.js";
import { createRuntime } from "./rooms.js";
import type { Connection, Room } from "./runtime.js";
import { enableDraftGames } from "./taslak.js";

function conn(): Connection {
  return {
    player: null,
    stage: null,
    lastSent: null,
    sentVer: -1,
    ip: "1.2.3.4",
    failedJoins: 0,
    account: { id: 5, username: "Sahip" },
    close() {},
    send() {},
    sendRaw() {},
  };
}

describe("botlar: taslak oyunlar", () => {
  enableDraftGames();
  for (const id of Object.keys(TASLAK_OYUNLAR)) {
    it(id, () => {
      expect(GAMES[id]).toBeDefined();
      const clock = createManualClock();
      const rt = createRuntime(clock);
      rt.botsEnabled = true;
      const host = conn();
      handleMessage(rt, host, { type: "createRoom", nickname: "Sahip" });
      const room = [...rt.rooms.values()][0] as Room;
      handleMessage(rt, host, { type: "setGames", gameIds: [id] });
      for (let i = 0; i < 3; i++) handleMessage(rt, host, { type: "addBot" });
      handleMessage(rt, host, { type: "startMatch" });
      expect(room.phase).toBe("briefing");
      for (let t = 0; t < 20 * 60_000 && room.phase !== "final"; t += TICK_MS) {
        clock.advance(TICK_MS);
        runTick(rt);
      }
      expect(room.phase).toBe("final");
      const botIds = [...room.players.values()].filter((p) => p.bot).map((p) => p.id);
      const log = rt.recentLogs.at(-1);
      expect(log?.gameId).toBe(id);
      expect(log?.actions.some((a) => botIds.includes(a.playerId))).toBe(true);
    });
  }
});
