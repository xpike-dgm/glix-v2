import { butonaBas, LAF_PROMPTS, type LafTone, replay } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, press, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

describe("oda tonu", () => {
  it("yeni oda arkadaş tonuyla açılır; snapshot'ta herkes görür", async () => {
    const cs = await setupRoom(["A", "B"]);
    for (const c of cs) expect(c.room.tone).toBe("arkadas");
  });

  it("host tonu değiştirir; herkes yeni tonu görür; aynı ton sessizce geçer", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    a.send({ type: "setTone", tone: "ofis" });
    await until(() => a.room.tone === "ofis" && b.room.tone === "ofis", "ton ofis");
    a.send({ type: "setTone", tone: "ofis" });
    await sync();
    expect(a.lastError).toBeUndefined();
    a.send({ type: "setTone", tone: "aile" });
    await until(() => b.room.tone === "aile", "ton aile");
  });

  it("host olmayan ton değiştiremez (not_host)", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    b.send({ type: "setTone", tone: "ofis" });
    await until(() => b.lastError?.code === "not_host", "not_host");
    await sync();
    expect(a.room.tone).toBe("arkadas");
    expect(b.room.tone).toBe("arkadas");
  });

  it("geçersiz ton invalid_message; maç sırasında wrong_phase", async () => {
    const cs = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    const [a] = cs;
    a.send({ type: "setTone", tone: "kaba" });
    await until(() => a.lastError?.code === "invalid_message", "geçersiz ton");
    a.send({ type: "setGames", gameIds: ["butona-bas"] });
    await until(() => a.room.gameIds.join() === "butona-bas");
    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing", "briefing");
    a.send({ type: "setTone", tone: "ofis" });
    await until(() => a.lastError?.code === "wrong_phase", "wrong_phase");
    expect(a.room.tone).toBe("arkadas");
  });

  it("tonu seçilen havuzdan sorular gelir ve kayıt tonu taşır; tekrar oynatma aynı sonucu verir", async () => {
    for (const tone of ["aile", "ofis"] as LafTone[]) {
      const cs = await setupRoom(["A", "B", "C"]);
      const [a] = cs as [Client, Client, Client];
      a.send({ type: "setTone", tone });
      await until(() => a.room.tone === tone, "ton");
      a.send({ type: "setGames", gameIds: ["laf-sokma"] });
      await until(() => a.room.gameIds.join() === "laf-sokma");
      a.send({ type: "startMatch" });
      await until(() => a.room.phase === "briefing", "briefing");
      for (const c of cs) c.send({ type: "ready" });
      await until(() => a.room.phase === "countdown", "countdown");
      k.clock.advance(3000);
      await until(() => a.room.phase === "playing", "playing");
      await sync();
      for (const c of cs) {
        const view = c.room.match?.view as { tasks: { prompt: string }[] } | undefined;
        const tasks = view?.tasks ?? [];
        expect(tasks.length).toBeGreaterThan(0);
        for (const t of tasks) expect(LAF_PROMPTS[tone]).toContain(t.prompt);
      }
    }
  });

  it("biten oyunun kaydı tonu taşır ve replay aynı sonucu verir", async () => {
    const cs = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    const [a] = cs;
    a.send({ type: "setTone", tone: "ofis" });
    await until(() => a.room.tone === "ofis", "ton");
    await startPlaying(cs);
    await press(a);
    k.clock.advance(46_000);
    await until(() => a.room.phase === "results", "sonuç");
    const log = k.srv.recentLogs.at(-1);
    if (!log) throw new Error("kayıt yok");
    expect(log.tone).toBe("ofis");
    expect(replay(butonaBas, log)).toEqual(a.room.match?.result);
  });
});
