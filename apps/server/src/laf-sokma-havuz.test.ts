import { butonaBas, LAF_PROMPTS, replay } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, press, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

describe("ton kaldırıldı (eski istemci uyumu)", () => {
  it("eski istemcinin setTone mesajı sessizce yok sayılır: hata yok, oda değişmez", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    const rev = a.room.rev;
    a.send({ type: "setTone", tone: "ofis" });
    b.send({ type: "setTone", tone: "aile" });
    // Sonrasında gelen geçerli bir değişiklik, önceki iki mesajın hata üretmediğini sıraya koyarak kanıtlar.
    a.send({ type: "setRandom", count: 2 });
    await until(() => a.room.selection.mode === "random" && a.room.selection.count === 2, "setRandom");
    expect(a.of("error")).toEqual([]);
    expect(b.of("error")).toEqual([]);
    expect(a.room.rev).toBeGreaterThan(rev);
  });

  it("anlık görüntü eski istemciler için sabit tone alanını bir sürüm daha taşır", async () => {
    const cs = await setupRoom(["A", "B"]);
    for (const c of cs) expect((c.room as { tone?: string }).tone).toBe("arkadas");
  });

  it("setTone yanlış biçimde yine invalid_message verir", async () => {
    const [a] = (await setupRoom(["A", "B"])) as [Client, Client];
    a.send({ type: "setTone", tone: "x".repeat(40) } as never);
    await until(() => a.lastError?.code === "invalid_message", "geçersiz");
  });
});

describe("Laf Sokma tek soru havuzu", () => {
  it("sorular birleşik havuzdan gelir; kayıt ton taşımaz; replay aynı sonucu verir", async () => {
    const cs = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    const [a] = cs;
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
      for (const t of tasks) expect(LAF_PROMPTS).toContain(t.prompt);
    }
  });

  it("biten oyunun kaydında ton yoktur ve replay aynı sonucu verir", async () => {
    const cs = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    const [a] = cs;
    await startPlaying(cs);
    await press(a);
    k.clock.advance(46_000);
    await until(() => a.room.phase === "results", "sonuç");
    const log = k.srv.recentLogs.at(-1);
    if (!log) throw new Error("kayıt yok");
    expect(log.tone).toBeUndefined();
    expect(replay(butonaBas, log)).toEqual(a.room.match?.result);
  });
});
