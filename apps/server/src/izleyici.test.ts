import { GAMES } from "@glix/engine";
import { describe, expect, it, vi } from "vitest";
import { type Client, join, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

/** Oyuncu 1 (host) maçı başlatır; herkes briefing'de. */
async function startBriefing(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
}

const self = (c: Client) => c.room.players.find((p) => p.id === c.room.selfId);

async function ack(c: Client, payload: unknown, seq: number): Promise<{ ok: boolean; reason?: string }> {
  c.send({ type: "action", seq, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === seq); i++) await sleep(5);
  const a = c.of("actionAck").find((x) => x.seq === seq);
  if (!a) throw new Error("onay gelmedi");
  return { ok: a.ok, ...(a.reason ? { reason: a.reason } : {}) };
}

describe("maç sürerken katılım: izleyici", () => {
  it("varsayılan ayar izleyici; maç sürerken gelen izleyici olarak girer ve herkes onu izleyici görür", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    expect(a.room.joinPolicy).toBe("izleyici");
    await startBriefing(cs);
    const c = await join(a.session.roomCode, "Can");
    expect(c.lastError).toBeUndefined();
    await until(() => a.room.players.length === 3, "izleyici listede");
    for (const x of [a, b, c]) {
      const w = x.room.players.find((p) => p.nickname === "Can");
      expect(w?.spectator).toBe(true);
      expect(x.room.players.filter((p) => p.spectator)).toHaveLength(1);
    }
    expect(self(c)?.spectator).toBe(true);
    expect(c.room.match?.participants).toHaveLength(2);
    expect(c.room.match?.participants).not.toContain(c.session.playerId);
  });

  it("izleyici oyun kurulumuna hiç verilmez, eylem ve hazırım gönderemez, puan almaz", async () => {
    const cs = await setupRoom(["A", "B"], ["butona-bas"]);
    const [a, b] = cs as [Client, Client];
    const setup = vi.spyOn(GAMES["butona-bas"] as NonNullable<(typeof GAMES)[string]>, "setup");
    try {
      await startBriefing(cs);
      const c = await join(a.session.roomCode, "Can");
      c.send({ type: "ready" });
      await until(() => c.lastError !== undefined, "hazırım reddi");
      expect(c.lastError?.code).toBe("not_participant");
      a.send({ type: "ready" });
      b.send({ type: "ready" });
      await until(() => a.room.phase === "countdown", "countdown");
      k.clock.advance(3000);
      await until(() => a.room.phase === "playing", "playing");
      const players = setup.mock.calls[0]?.[0] ?? [];
      expect([...players].sort()).toEqual([a.session.playerId, b.session.playerId].sort());
      expect(players).not.toContain(c.session.playerId);
      expect(await ack(c, { kind: "press" }, 77)).toEqual({ ok: false, reason: "not_participant" });
      // İzleyici yalnız herkese açık görünümü görür: oyuncu listesinde kendisi yok.
      const pub = c.room.match?.publicView as { players?: string[] };
      expect(JSON.stringify(pub)).not.toContain(c.session.playerId);
      k.clock.advance(46_000);
      await until(() => a.room.phase === "results", "results");
      expect(Object.keys(a.room.match?.result?.awards ?? {})).not.toContain(c.session.playerId);
      expect(a.room.players.find((p) => p.id === c.session.playerId)?.score).toBe(0);
    } finally {
      setup.mockRestore();
    }
  });

  it("Kapalı: maç sürerken katılım reddedilir ve Türkçe mesaj gösterilir; lobide serbesttir", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    a.send({ type: "setJoinPolicy", policy: "kapali" });
    await until(() => a.room.joinPolicy === "kapali", "ayar");
    const early = await join(a.session.roomCode, "Erken");
    expect(early.lastError).toBeUndefined();
    await startBriefing(cs);
    const late = await join(a.session.roomCode, "Geç");
    expect(late.lastError?.code).toBe("match_in_progress");
    expect(late.lastError?.message).toBe("Oyun sürüyor, bitince tekrar dene.");
    expect(a.room.players).toHaveLength(3);
  });

  it("oda doluysa izleyici de giremez: oyuncular + izleyiciler en fazla 8", async () => {
    const names = ["A", "B", "C", "D", "E", "F", "G"];
    const cs = await setupRoom(names);
    await startBriefing(cs);
    const w = await join((cs[0] as Client).session.roomCode, "Sekiz");
    expect(w.lastError).toBeUndefined();
    await until(() => (cs[0] as Client).room.players.length === 8, "sekizinci kişi");
    const x = await join((cs[0] as Client).session.roomCode, "Dokuz");
    expect(x.lastError?.code).toBe("room_full");
    expect((cs[0] as Client).room.players).toHaveLength(8);
  });

  it("maç bitip lobiye dönünce izleyici normal oyuncu olur ve sonraki maça girer", async () => {
    const cs = await setupRoom(["A", "B"], ["butona-bas"]);
    const [a, b] = cs as [Client, Client];
    await startPlaying(cs);
    const c = await join(a.session.roomCode, "Can");
    await until(() => self(c)?.spectator === true, "izleyici");
    k.clock.advance(46_000);
    await until(() => a.room.phase === "results", "results");
    k.clock.advance(8_000);
    await until(() => a.room.phase === "final", "final");
    // Final'de hâlâ izleyici; sıralamaya girmez (bayrak sunucudan gelir).
    expect(c.room.players.find((p) => p.id === c.session.playerId)?.spectator).toBe(true);
    a.send({ type: "returnToLobby" });
    await until(() => c.room.phase === "lobby", "lobi");
    for (const x of [a, b, c]) expect(x.room.players.every((p) => !p.spectator)).toBe(true);
    // Artık oyuncu: sonraki maçın katılımcısı.
    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing", "ikinci maç");
    expect(a.room.match?.participants).toContain(c.session.playerId);
    expect(a.room.match?.participants).toHaveLength(3);
  });

  it("izleyici erken bitişi engellemez: katılımcıların hepsi bastığında oyun hemen biter", async () => {
    const cs = await setupRoom(["A", "B"], ["kor-kronometre"]);
    const [a, b] = cs as [Client, Client];
    const { startedAt } = await startPlaying(cs);
    const c = await join(a.session.roomCode, "Can");
    await until(() => self(c)?.spectator === true, "izleyici");
    k.clock.advance(startedAt + 5_000 - k.clock.now());
    expect((await ack(a, { kind: "press" }, 1)).ok).toBe(true);
    expect((await ack(b, { kind: "press" }, 2)).ok).toBe(true);
    k.clock.advance(1_500);
    await until(() => a.room.match?.publicView !== null && a.room.phase !== "playing", "erken bitiş");
    expect(a.room.phase).toBe("results");
    // Süre 18 sn; izleyici beklenseydi oyun ancak o zaman biterdi.
    expect(k.clock.now() - startedAt).toBeLessThan(18_000);
  });

  it("kopup kendi oturumuyla dönen oyuncu etkilenmez: Kapalı olsa da yerine döner", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    a.send({ type: "setJoinPolicy", policy: "kapali" });
    await until(() => a.room.joinPolicy === "kapali", "ayar");
    await startBriefing(cs);
    const token = b.session.token;
    const bid = b.session.playerId;
    b.ws.terminate();
    await until(() => a.room.players.find((p) => p.id === bid)?.connected === false, "koptu");
    const { Client: C } = await import("./testkit.js");
    const b2 = await C.connect();
    b2.send({ type: "resume", token });
    await until(() => b2.updates.length > 0, "resume");
    expect(b2.room.selfId).toBe(bid);
    expect(self(b2)?.spectator).toBe(false);
    expect(b2.room.match?.participants).toContain(bid);
  });

  it("izleyici kopup kendi oturumuyla dönünce izleyici kalır", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    await startBriefing(cs);
    const c = await join(a.session.roomCode, "Can");
    await until(() => self(c)?.spectator === true, "izleyici");
    const token = c.session.token;
    c.ws.terminate();
    const { Client: C } = await import("./testkit.js");
    const c2 = await C.connect();
    c2.send({ type: "resume", token });
    await until(() => c2.updates.length > 0, "resume");
    expect(self(c2)?.spectator).toBe(true);
  });

  it("setJoinPolicy yalnız host ve yalnız lobide çalışır; geçersiz değer reddedilir", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    b.send({ type: "setJoinPolicy", policy: "kapali" });
    await until(() => b.lastError !== undefined, "hata");
    expect(b.lastError?.code).toBe("not_host");
    expect(a.room.joinPolicy).toBe("izleyici");
    a.send({ type: "setJoinPolicy", policy: "açık" });
    await until(() => a.lastError !== undefined, "geçersiz");
    expect(a.lastError?.code).toBe("invalid_message");
    await startBriefing(cs);
    a.send({ type: "setJoinPolicy", policy: "kapali" });
    await until(() => a.lastError?.code === "wrong_phase", "yanlış aşama");
    expect(a.room.joinPolicy).toBe("izleyici");
  });

  it("katılımcıların hepsi çıkarsa maç biter ve izleyici oyuncu olarak lobiye döner", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await startBriefing(cs);
    const c = await join(a.session.roomCode, "Can");
    await until(() => self(c)?.spectator === true, "izleyici");
    a.send({ type: "leaveRoom" });
    b.send({ type: "leaveRoom" });
    await until(() => c.room.phase === "lobby", "lobi");
    await sync();
    expect(self(c)?.spectator).toBe(false);
    expect(c.room.hostId).toBe(c.session.playerId);
  });
});
