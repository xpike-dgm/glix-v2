import { MAX_PLAYERS, MAX_STAGES } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { Client, k, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

async function joinStage(code: string): Promise<Client> {
  const c = await Client.connect();
  c.send({ type: "joinStage", code });
  await until(() => c.updates.length > 0 || c.of("error").length > 0, "sahne katılımı");
  return c;
}

describe("sahne (TV) rolü", () => {
  it("koltuk tutmaz, oyuncu listesinde görünmez, oyuncu kimliği almaz", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    const tv = await joinStage(a.session.roomCode);
    expect(tv.lastError).toBeUndefined();
    expect(tv.of("stage")[0]?.roomCode).toBe(a.session.roomCode);
    expect(tv.of("session")).toHaveLength(0);
    expect(tv.room.selfId).toBe("");
    expect(tv.room.players.map((p) => p.nickname)).toEqual(["A", "B"]);
    await until(() => a.room.stageCount === 1, "stageCount");
    expect(a.room.players).toHaveLength(2);
    expect(a.room.players.some((p) => p.spectator)).toBe(false);
  });

  it("8 oyuncu sınırına girmez; sahne sayısı en çok 2", async () => {
    const names = Array.from({ length: MAX_PLAYERS }, (_, i) => `P${i}`);
    const cs = await setupRoom(names);
    const code = (cs[0] as Client).session.roomCode;
    const full = await Client.connect();
    full.send({ type: "joinRoom", code, nickname: "Fazla" });
    await until(() => full.of("error").length > 0, "oda dolu");
    expect(full.lastError?.code).toBe("room_full");
    const stages: Client[] = [];
    for (let i = 0; i < MAX_STAGES; i++) {
      const s = await joinStage(code);
      expect(s.lastError).toBeUndefined();
      stages.push(s);
    }
    const third = await joinStage(code);
    expect(third.lastError?.code).toBe("stage_full");
    expect(third.updates).toHaveLength(0);
    await until(() => (cs[0] as Client).room.stageCount === MAX_STAGES, "iki sahne");
    // Bir sahne ayrılınca yer açılır.
    (stages[0] as Client).send({ type: "leaveRoom" });
    await until(() => (stages[0] as Client).of("left").length > 0, "sahne ayrıldı");
    await until(() => (cs[0] as Client).room.stageCount === 1, "bir sahne");
    third.send({ type: "joinStage", code });
    await until(() => third.updates.length > 0, "üçüncü artık girdi");
    expect((cs[0] as Client).room.players).toHaveLength(MAX_PLAYERS);
  });

  it("olmayan odaya sahne olunamaz", async () => {
    const c = await joinStage("ZZZZZ");
    expect(c.lastError?.code).toBe("room_not_found");
  });

  it("eylem, hazırım ve yönetim mesajlarını gönderemez", async () => {
    const cs = await setupRoom(["A", "B"], ["butona-bas"]);
    const [a] = cs as [Client, Client];
    const tv = await joinStage(a.session.roomCode);
    tv.send({ type: "action", seq: 5, payload: { kind: "press" } });
    await until(() => tv.of("actionAck").length > 0, "eylem reddi");
    expect(tv.of("actionAck")[0]).toMatchObject({ seq: 5, ok: false, reason: "not_participant" });
    for (const msg of [
      { type: "startMatch" },
      { type: "ready" },
      { type: "setGames", gameIds: ["butona-bas"] },
      { type: "kick", playerId: "x" },
      { type: "returnToLobby" },
      { type: "continue" },
      { type: "createRoom", nickname: "TV" },
      { type: "joinRoom", code: a.session.roomCode, nickname: "TV" },
      { type: "joinStage", code: a.session.roomCode },
    ]) {
      const before = tv.of("error").length;
      tv.send(msg);
      await until(() => tv.of("error").length > before, `ret: ${msg.type}`);
      expect(tv.lastError?.code, msg.type).toBe("stage_readonly");
    }
    expect(a.room.phase).toBe("lobby");
    // ping ve resync çalışır.
    tv.send({ type: "ping", t: 7 });
    await until(() => tv.of("pong").length > 0, "pong");
    const n = tv.of("room").length;
    tv.send({ type: "resync" });
    await until(() => tv.of("room").length > n, "resync");
  });

  it("maç sahneden etkilenmez; sahne publicView ve view(durum, null) alır, kimlik almaz", async () => {
    const cs = await setupRoom(["A", "B"], ["butona-bas"]);
    const [a, b] = cs as [Client, Client];
    const tv = await joinStage(a.session.roomCode);
    await startPlaying(cs);
    await until(() => tv.room.phase === "playing", "sahne oynanış");
    expect(tv.room.match?.publicView).toEqual(a.room.match?.publicView);
    expect(tv.room.match?.participants).toEqual([a.session.playerId, b.session.playerId]);
    expect(tv.room.match?.participants).not.toContain(tv.room.selfId);
    expect(tv.room.selfId).toBe("");
    // Oyuncular normal oynar.
    a.send({ type: "action", seq: 1, payload: { kind: "press" } });
    await until(() => a.of("actionAck").length > 0, "ack");
    expect(a.of("actionAck")[0]?.ok).toBe(true);
    k.clock.advance(50_000);
    await until(() => a.room.phase === "results", "sonuç");
    await until(() => tv.room.phase === "results", "sahne sonuç");
    expect(tv.room.players.every((p) => p.score >= 0)).toBe(true);
  });

  it("sahne kopunca sayaç düşer; oda boşalınca sahneye kapandı bildirilir", async () => {
    const cs = await setupRoom(["A"]);
    const a = cs[0] as Client;
    const tv = await joinStage(a.session.roomCode);
    await until(() => a.room.stageCount === 1, "sahne bağlı");
    const tv2 = await joinStage(a.session.roomCode);
    await until(() => a.room.stageCount === 2, "iki sahne");
    tv.ws.close();
    await until(() => a.room.stageCount === 1, "sahne koptu");
    a.send({ type: "leaveRoom" });
    await sync();
    expect(tv2.of("left")).toHaveLength(0); // oda boş ama 120 sn dolmadı: sahne düşmez
    k.clock.advance(121_000);
    await until(() => tv2.of("left").some((m) => m.reason === "closed"), "oda kapandı");
  });
});
