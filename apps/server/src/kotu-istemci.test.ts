import { CARD_IDS, createRng, GAMES, type Rng } from "@glix/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client, create, join, k, setupRoom, sync, until, useServer } from "./testkit.js";

const HOSTILE_STR = [
  "",
  " ",
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "x".repeat(70),
  "a‮b​c",
  "ünİıĞğ😀",
  "0",
  "-1",
];
const HOSTILE_NUM = [0, -0, -1, 1.5, 7, 63, 1e308, 2 ** 53, 2 ** 31, -(2 ** 31)];

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[rng.int(xs.length)] as T;

function junk(rng: Rng, depth = 0): unknown {
  switch (rng.int(8)) {
    case 0:
      return pick(rng, HOSTILE_STR);
    case 1:
      return pick(rng, HOSTILE_NUM);
    case 2:
      return null;
    case 3:
      return rng.int(2) === 0;
    case 4:
      return depth < 3 ? [junk(rng, depth + 1), junk(rng, depth + 1)] : [];
    case 5:
      return JSON.parse('{"__proto__":{"polluted":1}}');
    case 6:
      return depth < 3 ? { kind: pick(rng, HOSTILE_STR), a: junk(rng, depth + 1) } : {};
    default:
      return { kind: "press" };
  }
}

/** Ayrıştırıcıdan geçecek ama anlamsal olarak düşman iletiler üretir. */
function message(rng: Rng, ids: readonly string[], codes: readonly string[]): Record<string, unknown> {
  const id = (): string => (rng.int(4) === 0 ? pick(rng, HOSTILE_STR) || "x" : pick(rng, ids));
  const gameIds = Object.keys(GAMES);
  const t = rng.int(34);
  switch (t) {
    case 0:
      return { type: "ping", t: pick(rng, HOSTILE_NUM) };
    case 1:
      return { type: "resync" };
    case 2:
      return { type: "chooseAvatar", avatar: rng.int(12) };
    case 3:
      return { type: "rename", nickname: `Ad${rng.int(5)}` };
    case 4:
      return { type: "react", emoji: "🔥" };
    case 5:
      return { type: "setReady", ready: rng.int(2) === 0 };
    case 6:
      return { type: "transferHost", playerId: id() };
    case 7:
      return { type: "kick", playerId: id() };
    case 8:
      return {
        type: "setGames",
        gameIds: [pick(rng, gameIds), pick(rng, gameIds)].filter((g, i, a) => a.indexOf(g) === i),
      };
    case 9:
      return { type: "setGames", gameIds: ["yok-oyun"] };
    case 10:
      return { type: "setRandom", count: 1 + rng.int(64) };
    case 11:
      return { type: "setJoinPolicy", policy: pick(rng, ["izleyici", "kapali"]) };
    case 12:
      return {
        type: "setCards",
        enabled: rng.int(2) === 0,
        off: rng.int(2) === 0 ? [] : [pick(rng, CARD_IDS)],
      };
    case 13:
      return { type: "pickCard", index: rng.int(8) };
    case 14:
      return { type: "discardCard", index: rng.int(3) === 0 ? null : rng.int(8) };
    case 15:
      return {
        type: "playCard",
        card: pick(rng, CARD_IDS),
        target: id(),
        gameId: pick(rng, [...gameIds, "yok"]),
      };
    case 16:
      return { type: "playCard", card: pick(rng, CARD_IDS) };
    case 17:
      return { type: "unplayCard" };
    case 18:
      return { type: "startMatch" };
    case 19:
      return { type: "ready" };
    case 20:
      return { type: "continue" };
    case 21:
      return { type: "returnToLobby" };
    case 22:
      return { type: "leaveRoom" };
    case 23:
      return {
        type: "report",
        playerId: id(),
        reason: pick(rng, ["name", "abuse", "cheat", "other"]),
        note: "n",
      };
    case 24:
      return { type: "feedback", rating: 1 + rng.int(5), text: "güzel" };
    case 25:
      return { type: "visibility", hidden: rng.int(2) === 0 };
    case 26:
      return { type: "joinRoom", code: pick(rng, codes), nickname: "Yeni" };
    case 27:
      return { type: "joinStage", code: pick(rng, codes) };
    case 28:
      return { type: "resume", token: pick(rng, ["abc", "A".repeat(43), "-_-_"]) };
    case 29:
      return { type: "inviteFriend", username: "biri" };
    case 30:
      return { type: "createRoom", nickname: "Oda" };
    case 31:
      return { type: "pushUnsubscribe" };
    default:
      return { type: "action", seq: rng.int(1000), payload: junk(rng) };
  }
}

interface Probe {
  hostId: string;
  gameIds: string[];
  selection: unknown;
  joinPolicy: string;
  cardSettings: unknown;
  phase: string;
  players: string[];
}

const probe = (c: Client): Probe => ({
  hostId: c.room.hostId,
  gameIds: [...c.room.gameIds],
  selection: c.room.selection,
  joinPolicy: c.room.joinPolicy,
  cardSettings: c.room.cardSettings,
  phase: c.room.phase,
  players: c.room.players.map((p) => p.id),
});

describe("kötü niyetli istemci", () => {
  useServer();
  let errors: string[] = [];
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errors = [];
    spy = vi.spyOn(process.stderr, "write").mockImplementation(((chunk: unknown) => {
      errors.push(String(chunk));
      return true;
    }) as typeof process.stderr.write);
  });
  afterEach(() => spy.mockRestore());

  const pingAll = async (cs: Client[]): Promise<void> => {
    const marks = cs.map((c) => c.mark());
    for (const [i, c] of cs.entries()) c.send({ type: "ping", t: 100 + i });
    await until(() => cs.every((c, i) => c.since(marks[i] as number).some((m) => m.type === "pong")), "pong");
  };

  it("host olmayan lobide host eylemi yapamaz; başka oda etkilenmez; sunucu ayakta kalır", async () => {
    const [host, b, c] = await setupRoom(["Ali", "Veli", "Deli"]);
    const other = await create("Ayri");
    const otherBefore = JSON.stringify(other.room.players.map((p) => p.id));
    const base = probe(host as Client);
    const rng = createRng(4242);
    const ids = (host as Client).room.players.map((p) => p.id);
    const codes = [(host as Client).session.roomCode, other.session.roomCode, "ZZZZZ"];
    const actors = [b as Client, c as Client];
    for (let round = 0; round < 3; round++) {
      for (const a of actors) {
        for (let i = 0; i < 20; i++) {
          const m = message(rng, [...ids, other.session.playerId], codes);
          // Oda terk etme/host olmayan akışı sürdürmek için çıkış ve yeniden-oda iletilerini atla.
          if (m.type === "leaveRoom" || m.type === "kick" || m.type === "report") continue;
          a.send(m);
        }
      }
      await sync();
    }
    const after = probe(host as Client);
    expect(after.hostId).toBe(base.hostId);
    expect(after.gameIds).toEqual(base.gameIds);
    expect(after.selection).toEqual(base.selection);
    expect(after.joinPolicy).toBe(base.joinPolicy);
    expect(after.cardSettings).toEqual(base.cardSettings);
    expect(after.phase).toBe("lobby");
    expect(after.players).toEqual(base.players);
    expect(JSON.stringify(other.room.players.map((p) => p.id))).toBe(otherBefore);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(errors).toEqual([]);
    await pingAll(other.closeCode === null ? [other] : []);
  }, 30_000);

  it("maç boyunca herkesin rastgele iletileri: fırlatma yok, oda tutarlı, başka oda etkilenmez", async () => {
    const cs = await setupRoom(["Ali", "Veli", "Deli"], ["butona-bas", "sozluk-blofu"]);
    const host = cs[0] as Client;
    const other = await create("Ayri");
    const rng = createRng(777);
    const seen = new Set<string>();
    const code = host.session.roomCode;
    const room0 = k.srv.runtime.rooms.get(host.session.roomCode);
    expect(room0).toBeDefined();
    for (let round = 0; round < 24; round++) {
      // Kopma/yeniden bağlanma ve maç sırasında izleyici girişi de karışır.
      if (rng.int(4) === 0) {
        const i = rng.int(cs.length);
        const old = cs[i] as Client;
        if (old.closeCode === null && old.of("session").length > 0) {
          const token = old.session.token;
          old.ws.terminate();
          const fresh = await Client.connect();
          fresh.send({ type: "resume", token });
          cs[i] = fresh;
        }
      }
      if (rng.int(5) === 0 && cs.length < 7) {
        const v = await Client.connect();
        v.send({ type: "joinRoom", code: host.session.roomCode, nickname: `Iz${rng.int(1000)}` });
        cs.push(v);
      }
      for (const c of cs) {
        if (c.closeCode !== null) continue;
        if (c.updates.length === 0 && c.of("session").length === 0) continue;
        const ids = [...(k.srv.runtime.rooms.get(code)?.players.keys() ?? [])];
        const codes = [host.session.roomCode, "ZZZZZ"];
        for (let i = 0; i < 12; i++) {
          const m = message(rng, ids, codes);
          if (m.type === "leaveRoom" && rng.int(3) !== 0) continue;
          c.send(m);
        }
      }
      if (round % 4 === 3) {
        for (const c of cs) {
          c.send({ type: "ready" });
          c.send({ type: "continue" });
        }
        k.clock.advance(70_000);
      }
      seen.add(k.srv.runtime.rooms.get(code)?.phase ?? "yok");
      k.clock.advance(rng.int(3000));
      await sync();
    }
    expect(seen.has("playing")).toBe(true);
    const rt = k.srv.runtime;
    for (const room of rt.rooms.values()) {
      expect(room.players.has(room.hostId) || room.players.size === 0).toBe(true);
      for (const [id, p] of room.players) {
        expect(p.id).toBe(id);
        expect(rt.tokens.get(p.token)).toBe(p);
        if (p.conn) expect(p.conn.player).toBe(p);
      }
      if (room.match) {
        const m = room.match;
        for (const id of [...m.readyIds, ...m.continueIds]) expect(m.startParticipants).toContain(id);
        for (const id of m.participants) expect(m.startParticipants).toContain(id);
        for (const p of room.players.values())
          if (p.spectator) expect(m.startParticipants).not.toContain(p.id);
      }
    }
    for (const [token, p] of rt.tokens) expect(p.room.players.get(p.id)?.token).toBe(token);
    expect(other.room.players.map((p) => p.id)).toEqual([other.session.playerId]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(errors).toEqual([]);
    await pingAll([other]);
  }, 60_000);

  it("çöp ham metinler bağlantıyı kapatır ama sunucuyu ve odayı bozmaz", async () => {
    const host = await create("Ali");
    const b = await join(host.session.roomCode, "Veli");
    const rng = createRng(9);
    const raws = [
      "{",
      "null",
      "[]",
      '{"type":"__proto__"}',
      '{"__proto__":{"type":"ping","t":1}}',
      '{"type":"action","seq":1e999,"payload":{}}',
      `{"type":"action","seq":1,"payload":${"[".repeat(5000)}${"]".repeat(5000)}}`,
      `{"type":"action","seq":1,"payload":${'{"a":'.repeat(1500)}1${"}".repeat(1500)}}`,
      "x".repeat(20_000),
    ];
    for (const r of raws) {
      const v = await join(host.session.roomCode, `V${rng.int(1e6)}`);
      v.send(r);
      v.send({ type: "ping", t: 1 });
      await sync();
      v.ws.terminate();
    }
    await until(() => host.room.players.filter((p) => p.connected).length >= 2, "oda sağlam");
    await pingAll([host, b]);
    expect(errors).toEqual([]);
  }, 30_000);
});
