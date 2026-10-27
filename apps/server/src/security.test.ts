import { describe, expect, it } from "vitest";
import type { WebSocket as ServerSocket } from "ws";
import { WebSocket } from "ws";
import { Client, create, join, k, loginCookie, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

const closed = (c: Client) => until(() => c.closeCode !== null, "kapanış");
const serverSide = (): ServerSocket[] => [...k.srv.sockets];

describe("yavaş tüketici", () => {
  useServer();
  it("bufferedAmount sınırı aşınca soket koparılır ve oyuncu kopmuş sayılır", async () => {
    const [host] = [await create("Ali")];
    const b = await join(host.session.roomCode, "Veli");
    await sync();
    const ws = serverSide().at(-1) as ServerSocket;
    Object.defineProperty(ws, "bufferedAmount", { get: () => 2_000_000 });
    b.send({ type: "ping", t: 1 });
    await closed(b);
    await until(() => host.room.players.find((p) => p.nickname === "Veli")?.connected === false, "kopuk");
  });
});

describe("kalp atışı", () => {
  useServer({ heartbeatMs: 20_000 });
  it("pong veren soket yaşar, vermeyen sonraki turda koparılır", async () => {
    const a = await create("Ali");
    const b = await join(a.session.roomCode, "Veli");
    // b pong göndermez
    (b.ws as unknown as { pong: () => void }).pong = () => {};
    for (let i = 0; i < 3; i++) {
      k.clock.advance(20_000);
      await sleep(40);
    }
    await closed(b);
    expect(a.closeCode).toBeNull();
    await until(() => a.room.players.find((p) => p.nickname === "Veli")?.connected === false, "kopuk");
  });
});

describe("üst sınırlar", () => {
  useServer({ limits: { maxSockets: 3, maxSocketsPerIp: 2, maxRooms: 1 } });
  it("IP başına soket sınırı yükseltmeyi reddeder", async () => {
    await Client.connect();
    await Client.connect();
    await expect(Client.connect()).rejects.toThrow();
  });
  it("oda sınırı server_busy döner", async () => {
    await create("Ali");
    const c = await Client.connect(loginCookie());
    c.send({ type: "createRoom", nickname: "Veli" });
    await until(() => c.lastError !== undefined);
    expect(c.lastError?.code).toBe("server_busy");
    expect(c.lastError?.message).toBe("Sunucu şu an çok yoğun, birazdan tekrar dene.");
  });
});

describe("toplam soket sınırı", () => {
  useServer({ limits: { maxSockets: 2, maxSocketsPerIp: 40 } });
  it("aşınca 503", async () => {
    await Client.connect();
    await Client.connect();
    const status = await new Promise<number | string>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${k.srv.port}/ws`);
      ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
      ws.on("error", () => {});
    });
    expect(status).toBe(503);
  });
});

describe("oda kurma hızı", () => {
  useServer();
  it("IP başına 10 ani; sonrası rate_limited, zamanla yenilenir", async () => {
    const c = await Client.connect(loginCookie());
    const hits: Client[] = [];
    for (let i = 0; i < 11; i++) hits.push(await Client.connect(loginCookie()));
    for (const h of hits) h.send({ type: "createRoom", nickname: "Ali" });
    await until(() => hits.every((h) => h.updates.length > 0 || h.lastError), "yanıtlar");
    expect(hits.filter((h) => h.updates.length > 0)).toHaveLength(10);
    expect(hits.filter((h) => h.lastError?.code === "rate_limited")).toHaveLength(1);
    k.clock.advance(6_000);
    c.send({ type: "createRoom", nickname: "Ali" });
    await until(() => c.updates.length > 0, "yenilendi");
  });
});

describe("boşta soket", () => {
  useServer();
  it("60 sn odaya girmeyen soket 4000 ile kapanır; odadaki kalır", async () => {
    const idle = await Client.connect();
    const a = await create("Ali");
    k.clock.advance(59_000);
    await sleep(30);
    expect(idle.closeCode).toBeNull();
    k.clock.advance(2_000);
    await closed(idle);
    expect(idle.closeCode).toBe(4000);
    expect(a.closeCode).toBeNull();
  });
});

describe("oda kodu tahmini", () => {
  useServer();
  it("10 başarısız katılmadan sonra soket 1008 ile kapanır", async () => {
    const c = await Client.connect();
    for (let i = 0; i < 10; i++) {
      c.send({ type: "joinRoom", code: "ZZZZ2", nickname: "Ali" });
      await sleep(60); // soket kovasına takılmamak için
    }
    await closed(c);
    expect(c.closeCode).toBe(1008);
    expect(c.of("error").filter((e) => e.code === "room_not_found")).toHaveLength(10);
  });
  it("IP başına başarısız katılma kovası boşalınca rate_limited", async () => {
    const cs = await Promise.all(Array.from({ length: 4 }, () => Client.connect()));
    for (let round = 0; round < 6; round++) {
      for (const c of cs) c.send({ type: "joinRoom", code: "ZZZZ2", nickname: "Ali" });
      await sleep(120);
      k.clock.advance(0);
    }
    const all = cs.flatMap((c) => c.of("error"));
    expect(all.filter((e) => e.code === "room_not_found").length).toBeLessThanOrEqual(20);
    expect(all.some((e) => e.code === "rate_limited")).toBe(true);
  });
  it("match_in_progress, room_not_found'dan ayrı bir hata olarak kalır", async () => {
    const [host] = await setupRoom(["Ali", "Veli"]);
    host?.send({ type: "setJoinPolicy", policy: "kapali" });
    await until(() => host?.room.joinPolicy === "kapali", "ayar");
    host?.send({ type: "startMatch" });
    await until(() => host?.room.phase === "briefing", "briefing");
    const j = await Client.connect();
    j.send({ type: "joinRoom", code: host?.session.roomCode, nickname: "Can" });
    await until(() => j.lastError !== undefined);
    expect(j.lastError?.code).toBe("match_in_progress");
  });
});

describe("hız sınırı serisi", () => {
  useServer();
  it("100 ardışık rate_limited sonrası 1008", async () => {
    const c = await Client.connect();
    for (let i = 0; i < 400 && c.closeCode === null; i++) c.send({ type: "ping", t: i });
    await closed(c);
    expect(c.closeCode).toBe(1008);
  });
});

describe("yük boyutu", () => {
  useServer();
  it("8 KiB üstü mesaj bağlantıyı kapatır", async () => {
    const c = await Client.connect();
    c.send(JSON.stringify({ type: "hello", clientVersion: "x".repeat(9000) }));
    await closed(c);
    expect(c.closeCode).toBe(1009);
  });
});
