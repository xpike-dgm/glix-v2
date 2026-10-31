import { CONTINUE_GRACE_MS, CONTINUE_MIN_GAP_MS } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { RESULTS_MS } from "./match.js";
import { type Client, join, k, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

/** Maçı başlatıp ilk oyunu bitirir; herkes sonuç ekranında. */
async function toResults(cs: Client[], games: string[] = ["butona-bas", "kor-bomba"]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: games });
  await until(() => host.room.gameIds.length === games.length, "oyun seçimi");
  await startPlaying(cs);
  k.clock.advance(48_000);
  await until(() => host.room.phase === "results", "results");
}

/**
 * Bitiş, son onayın işlendiği andan 1 sn sonraya kurulmuş olmalı. Onay `sentAt` (sahte saat) anında gönderilir ve
 * saat yalnız bizim `sync` turlarımızla ilerler; sunucu onayı gönderimden sonraki bir turda işler, yani bitiş
 * `sentAt + 1 sn` ile `şimdi + 1 sn` arasındadır. (Eskiden "şimdi + 1 sn − 400 ms" alt sınırı vardı: yükte yayın
 * 6'dan çok turda geldiğinde sahte saat bu payı aşıp test boşuna düşüyordu.)
 */
function expectGrace(c: Client, sentAt: number): void {
  const ends = c.room.match?.phaseEndsAt ?? 0;
  expect(ends).toBeGreaterThanOrEqual(sentAt + CONTINUE_GRACE_MS);
  expect(ends - k.clock.now()).toBeLessThanOrEqual(CONTINUE_GRACE_MS);
}

const wait = async (): Promise<void> => {
  k.clock.advance(CONTINUE_MIN_GAP_MS + 10);
  await sync();
};

describe("sonuç ekranında Devam (erken bitiş)", () => {
  it("bağlı herkes Devam deyince sonuç ekranı 1 sn sonra biter ve sıradaki oyun gelir", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    await toResults(cs);
    const endsBefore = a.room.match?.phaseEndsAt ?? 0;
    expect(a.room.match?.continueIds).toEqual([]);

    a.send({ type: "continue" });
    b.send({ type: "continue" });
    await until(() => a.room.match?.continueIds.length === 2, "iki onay");
    // Biri eksik: bitiş ertelenmez.
    expect(a.room.match?.phaseEndsAt).toBe(endsBefore);

    const sentAt = k.clock.now();
    c.send({ type: "continue" });
    await until(() => (a.room.match?.phaseEndsAt ?? endsBefore) < endsBefore, "erken bitiş kuruldu");
    expectGrace(a, sentAt);
    expect(a.room.match?.continueIds.sort()).toEqual([a, b, c].map((x) => x.session.playerId).sort());

    k.clock.advance(300);
    await sync();
    expect(a.room.phase).toBe("results");
    k.clock.advance(CONTINUE_GRACE_MS);
    await until(() => a.room.phase === "briefing", "sıradaki oyun");
    expect(a.room.match?.round).toBe(1);
    expect(a.room.match?.continueIds).toEqual([]);
  });

  it("son oyunda Devam final'e geçirir", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await toResults(cs, ["butona-bas"]);
    a.send({ type: "continue" });
    b.send({ type: "continue" });
    await until(() => a.room.match?.continueIds.length === 2);
    k.clock.advance(CONTINUE_GRACE_MS + 50);
    await until(() => a.room.phase === "final", "final");
  });

  it("kopuk oyuncu beklenmez", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    await toResults(cs);
    c.ws.terminate();
    await until(() => a.room.players[2]?.connected === false, "C koptu");
    const endsBefore = a.room.match?.phaseEndsAt ?? 0;
    a.send({ type: "continue" });
    await until(() => a.room.match?.continueIds.length === 1);
    expect(a.room.match?.phaseEndsAt).toBe(endsBefore);
    const sentAt = k.clock.now();
    b.send({ type: "continue" });
    await until(() => (a.room.match?.phaseEndsAt ?? endsBefore) < endsBefore, "erken bitiş");
    expectGrace(a, sentAt);
  });

  it("son bekleneni kopma Devam sayımını tamamlar", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    await toResults(cs);
    const endsBefore = a.room.match?.phaseEndsAt ?? 0;
    a.send({ type: "continue" });
    b.send({ type: "continue" });
    await until(() => a.room.match?.continueIds.length === 2);
    expect(a.room.match?.phaseEndsAt).toBe(endsBefore);
    c.ws.terminate();
    await until(() => (a.room.match?.phaseEndsAt ?? endsBefore) < endsBefore, "erken bitiş");
  });

  it("izleyici sayılmaz ve beklenmez; hata da almaz", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    a.send({ type: "setGames", gameIds: ["butona-bas", "kor-bomba"] });
    await until(() => a.room.gameIds.length === 2);
    await startPlaying(cs);
    const w = await join(a.session.roomCode, "Can");
    await until(() => a.room.players.length === 3);
    k.clock.advance(48_000);
    await until(() => a.room.phase === "results");
    const endsBefore = a.room.match?.phaseEndsAt ?? 0;

    w.send({ type: "continue" });
    await sync();
    expect(w.of("error")).toHaveLength(0);
    expect(a.room.match?.continueIds).toEqual([]);

    a.send({ type: "continue" });
    b.send({ type: "continue" });
    await until(() => (a.room.match?.phaseEndsAt ?? endsBefore) < endsBefore, "izleyici beklenmedi");
    expect(a.room.match?.continueIds).not.toContain(w.session.playerId);
  });

  it("results dışında reddedilir (lobi, briefing, oyun, final)", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    b.send({ type: "continue" });
    await until(() => b.of("error").length === 1);
    expect(b.lastError?.code).toBe("wrong_phase");

    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing");
    await wait();
    b.send({ type: "continue" });
    await until(() => b.of("error").length === 2);
    expect(b.lastError?.code).toBe("wrong_phase");

    for (const c of cs) c.send({ type: "ready" });
    await until(() => a.room.phase === "countdown");
    k.clock.advance(3000);
    await until(() => a.room.phase === "playing");
    await wait();
    b.send({ type: "continue" });
    await until(() => b.of("error").length === 3);
    expect(b.lastError?.code).toBe("wrong_phase");

    k.clock.advance(48_000);
    await until(() => a.room.phase === "results");
    k.clock.advance(RESULTS_MS);
    await until(() => a.room.phase === "final");
    await wait();
    b.send({ type: "continue" });
    await until(() => b.of("error").length === 4);
    expect(b.lastError?.code).toBe("wrong_phase");
  });

  it("hız sınırı: art arda gelen ikinci mesaj rate_limited alır, sayımı bozmaz", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await toResults(cs);
    b.send({ type: "continue" });
    b.send({ type: "continue" });
    await until(() => b.of("error").length === 1);
    expect(b.lastError?.code).toBe("rate_limited");
    expect(a.room.match?.continueIds).toEqual([b.session.playerId]);
    // Aralık geçince tekrar eden onay hatasız ve sessizce yok sayılır.
    await wait();
    b.send({ type: "continue" });
    await sync();
    expect(b.of("error")).toHaveLength(1);
    expect(a.room.match?.continueIds).toEqual([b.session.playerId]);
  });

  it("geçersiz biçim (fazladan alan) reddedilir", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await toResults(cs);
    b.send({ type: "continue", extra: 1 });
    await until(() => b.of("error").length === 1);
    expect(b.lastError?.code).toBe("invalid_message");
    expect(a.room.match?.continueIds).toEqual([]);
  });
});
