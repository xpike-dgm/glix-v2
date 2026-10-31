import type { RoomSnapshot } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { deliver } from "./broadcast.js";
import { RESULTS_MS } from "./match.js";
import type { Connection } from "./runtime.js";
import {
  Client,
  create,
  join,
  k,
  setupRoom,
  sleep,
  startPlaying,
  sync,
  until,
  useServer,
} from "./testkit.js";

useServer();

describe("yama senkronu", () => {
  it("ilk mesaj tam room, sonrakiler patch; yamalar uygulanınca sunucu durumuna eşit", async () => {
    const a = await create("A");
    await sync();
    expect(a.msgs.find((m) => m.type === "room" || m.type === "patch")?.type).toBe("room");
    a.send({ type: "setGames", gameIds: ["butona-bas"] });
    await join(a.session.roomCode, "B");
    await sync();
    expect(a.of("patch").length).toBeGreaterThan(0);
    expect(a.gaps).toBe(0);
    const p = a.of("patch").at(-1);
    expect(p && p.rev > p.baseRev).toBe(true);
    expect(a.room.players).toHaveLength(2);
  });

  it("katılan yeni oyuncunun ilk mesajı tam room", async () => {
    const a = await create("A");
    const b = await join(a.session.roomCode, "B");
    await sync();
    const first = b.msgs.find((m) => m.type === "room" || m.type === "patch");
    expect(first?.type).toBe("room");
  });

  it("resync tam room ile yanıtlanır ve yamalar sürer", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    const before = a.of("room").length;
    a.send({ type: "resync" });
    await until(() => a.of("room").length > before, "resync yanıtı");
    expect(a.room.rev).toBeGreaterThan(0);
    const patches = a.of("patch").length;
    b.send({ type: "setGames", gameIds: ["butona-bas"] });
    a.send({ type: "ready" }); // lobide wrong_phase; yayını tetiklemez
    b.ws.terminate();
    await until(() => a.of("patch").length > patches, "resync sonrası yama");
    expect(a.gaps).toBe(0);
  });

  it("odada değilken resync not_in_room verir", async () => {
    const c = await Client.connect();
    c.send({ type: "resync" });
    await until(() => c.of("error").length > 0);
    expect(c.lastError?.code).toBe("not_in_room");
  });

  it("resume sonrası ilk mesaj tam room", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    b.ws.terminate();
    await sync();
    const b2 = await Client.connect();
    b2.send({ type: "resume", token: b.session.token });
    await until(() => b2.updates.length > 0);
    expect(b2.msgs.find((m) => m.type === "room" || m.type === "patch")?.type).toBe("room");
    expect(a.gaps).toBe(0);
  });

  it("null'a dönen alan (maç -> lobi) tam room ile gider, istemci tutarlı kalır", async () => {
    const [a, b] = (await setupRoom(["A", "B"], ["butona-bas"])) as [Client, Client];
    await startPlaying([a, b]);
    // maçı bitir: 45 sn
    k.clock.advance(48_000);
    await until(() => a.room.phase === "results" || a.room.phase === "final", "sonuç");
    k.clock.advance(RESULTS_MS + 1_000);
    await until(() => a.room.phase === "final", "final");
    const mark = a.mark();
    a.send({ type: "returnToLobby" });
    await until(() => a.room.phase === "lobby", "lobi");
    const msgs = a.since(mark).filter((m) => m.type === "room" || m.type === "patch");
    expect(msgs[0]?.type).toBe("room");
    expect(a.room.match).toBeNull();
    expect(a.gaps).toBe(0);
  });

  it("yama tam snapshot'tan büyükse room gönderilir", () => {
    const sent: string[] = [];
    const conn = {
      lastSent: null,
      sendRaw: (t: string) => sent.push(t),
    } as unknown as Connection;
    const base = {
      rev: 1,
      serverNow: 1,
      code: "ABCDE",
      hostId: "h",
      selfId: "h",
      phase: "lobby",
      players: [],
      gameIds: [],
      selection: { mode: "random", count: 5 },
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
      catalog: [],
      match: null,
    } as RoomSnapshot;
    deliver(conn, base);
    // her alan değişir ve oyuncu listesi dizi olarak komple yeniden yazılır: yama tam halden küçük olamaz
    const big = {
      ...base,
      rev: 2,
      hostId: "x".repeat(50),
      gameIds: Array.from({ length: 30 }, (_, i) => `oyun-${i}`),
    } as RoomSnapshot;
    deliver(conn, { ...big, serverNow: 2 });
    const small = { ...big, rev: 3, serverNow: 3 };
    deliver(conn, small);
    expect(JSON.parse(sent[0] ?? "").type).toBe("room");
    expect(JSON.parse(sent[2] ?? "").type).toBe("patch");
    // tam snapshot'a eşit boyutta/daha küçük yama gerekmez: aynı içerik, yalnız rev/serverNow farkı patch olur
    expect(sent[2]?.length).toBeLessThan(sent[1]?.length ?? 0);
  });
});

describe("bant genişliği ölçümü", () => {
  it("8 oyuncu, 45 sn Butona Bas: oyuncu başına giden bayt (yama öncesi/sonrası)", async () => {
    const cs = await setupRoom(["A", "B", "C", "D", "E", "F", "G", "H"]);
    const host = cs[0] as Client;
    await startPlaying(cs);
    for (const c of cs) {
      c.bytesIn = 0;
      c.fullEquivalentBytes = 0;
    }
    let seq = 1000;
    for (let i = 0; i < 180; i++) {
      // her 250 ms'de 3 oyuncu basar
      for (let j = 0; j < 3; j++) {
        const c = cs[(i * 3 + j) % cs.length] as Client;
        c.send({ type: "action", seq: ++seq, payload: { kind: "press" } });
      }
      await sleep(8);
      k.clock.advance(250);
    }
    // Oyun 51 sn'de biter; oyun içi sonuç ekranı herkes "Devam et" deyince 1 sn sonra kapanır.
    k.clock.advance(7_000);
    await until(() => host.room.phase === "results", "sonuç");
    await sync();
    for (const c of cs) expect(c.gaps).toBe(0);
    const after = cs.map((c) => c.bytesIn);
    const before = cs.map((c) => c.fullEquivalentBytes);
    const avg = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
    const msgs = cs.map((c) => c.updates.length);
    console.log(
      `[bant] 8 oyuncu, 45 sn: oyuncu başına önce=${avg(before)} B, sonra=${avg(after)} B, ` +
        `oran=${(avg(after) / avg(before)).toFixed(2)}, güncelleme/oyuncu=${avg(msgs)}`,
    );
    expect(avg(after)).toBeLessThan(avg(before) * 0.6);
  }, 60_000);
});
