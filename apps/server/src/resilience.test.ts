import { type AnyGame, GAMES } from "@glix/engine";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client, create, k, press, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

useServer({ drainTimeoutMs: 120_000 });

type Mode = "none" | "setup" | "parseAction" | "reduce" | "tick" | "view" | "publicView" | "result";
let mode: Mode = "none";

function maybeThrow(at: Mode): void {
  if (mode === at) throw new Error(`kasıtlı hata: ${at}`);
}

/** Her fonksiyonu isteğe bağlı olarak fırlatan sahte oyun. `result` modunda hemen biter. */
const boom: AnyGame = {
  id: "test-boom",
  name: "Boom",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: { goal: "g", steps: [] },
  parseAction(raw) {
    maybeThrow("parseAction");
    return raw === "go" ? "go" : null;
  },
  setup() {
    maybeThrow("setup");
    return { n: 0 };
  },
  reduce(state) {
    maybeThrow("reduce");
    return { n: state.n + 1 };
  },
  tick(state) {
    maybeThrow("tick");
    return state;
  },
  publicView(state) {
    maybeThrow("publicView");
    return { n: state.n };
  },
  view(state) {
    maybeThrow("view");
    return { n: state.n };
  },
  isFinished: () => mode === "result",
  result(state) {
    maybeThrow("result");
    return { miniScores: {}, awards: { x: state.n } };
  },
  secrets: () => [],
};

/** Hemen biten, herkese 3 puan veren sahte oyun (skorların korunduğunu görmek için). */
const quick: AnyGame = {
  ...boom,
  id: "test-quick",
  name: "Quick",
  setup: (players: string[]) => ({ players }),
  view: () => ({}),
  tick: (s: unknown) => s,
  isFinished: () => true,
  result: (s: { players: string[] }) => ({
    miniScores: {},
    awards: Object.fromEntries(s.players.map((id) => [id, 3])),
  }),
};

beforeAll(() => {
  GAMES[boom.id] = boom;
  GAMES[quick.id] = quick;
});
afterAll(() => {
  delete GAMES[boom.id];
  delete GAMES[quick.id];
});

let errLines: string[] = [];
beforeEach(() => {
  mode = "none";
  errLines = [];
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
    errLines.push(String(chunk));
    return true;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

function faults(): Record<string, unknown>[] {
  return errLines
    .flatMap((l) => l.split("\n"))
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l) as Record<string, unknown>)
    .filter((o) => o.msg === "game_failed");
}

/** Odaya `games` ayarlar ve tüm oyuncular hazır olup ilk oyunun oynanma aşamasına gelir. */
async function playUntil(cs: Client[], games: string[], phase: "playing" | "briefing"): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: games });
  await sync();
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  if (phase === "briefing") return;
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await sync();
}

describe("oyun hatası: maç zarifçe iptal edilir", () => {
  for (const at of ["setup", "tick", "view", "publicView", "reduce", "parseAction"] as const) {
    it(`${at} hata fırlatırsa oda lobiye döner, diğer oda sürer`, async () => {
      // Diğer oda: gerçek Butona Bas
      const others = await setupRoom(["X", "Y"]);
      await startPlaying(others);
      const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
      if (at === "setup") {
        mode = "setup";
        await playUntil([a, b], ["test-boom"], "playing");
      } else {
        await playUntil([a, b], ["test-boom"], "playing");
        expect(a.room.phase).toBe("playing");
        mode = at;
        if (at === "tick") k.clock.advance(300);
        // view yalnız durum değişince yayında çağrılır: geçerli bir eylemle yayın tetiklenir
        else a.send({ type: "action", seq: 1, payload: "go" });
        await sync();
      }
      await until(() => a.room.phase === "lobby", "lobiye dönüş");
      await until(() => b.room.phase === "lobby", "lobiye dönüş B");
      expect(a.room.match).toBeNull();
      // oyunculara gösterilebilir Türkçe hata mesajı
      const err = b.of("error").at(-1);
      expect(err?.message).toMatch(/Oyunda bir sorun çıktı/);
      expect(err?.code).toBe("game_failed");
      // yapılandırılmış günlük
      const f = faults();
      expect(f).toHaveLength(1);
      expect(f[0]).toMatchObject({ roomCode: a.room.code, gameId: "test-boom", fn: at });
      // oda kullanılabilir: yeni maç başlatılabilir
      mode = "none";
      a.send({ type: "startMatch" });
      await until(() => a.room.phase === "briefing", "yeni maç");
      // diğer oda etkilenmedi
      expect(others[0]?.room.phase).toBe("playing");
      await press(others[0] as Client);
    });
  }

  it("result hata fırlatırsa da zarifçe iptal edilir", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    await playUntil([a, b], ["test-boom"], "playing");
    mode = "result";
    k.clock.advance(300);
    await until(() => a.room.phase === "lobby", "lobi");
    expect(faults()[0]).toMatchObject({ gameId: "test-boom", fn: "result" });
  });

  it("genel skorlar korunur", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    await playUntil([a, b], ["test-quick", "test-boom"], "playing");
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.players.map((p) => p.score)).toEqual([3, 3]);
    mode = "setup";
    k.clock.advance(7_000);
    await until(() => a.room.phase === "briefing", "ikinci oyun anlatımı");
    for (const c of [a, b]) c.send({ type: "ready" });
    await until(() => a.room.phase === "countdown", "geri sayım");
    k.clock.advance(3_000);
    await until(() => a.room.phase === "lobby", "lobi");
    expect(a.room.players.map((p) => p.score)).toEqual([3, 3]);
    expect(faults()).toHaveLength(1);
  });

  it("kayıt: biten oyun kaydı günlüğe yazılmaz, çöken oyunun kaydı yazılır", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    await playUntil([a, b], ["test-boom"], "playing");
    a.send({ type: "action", seq: 1, payload: "go" });
    await sync();
    mode = "tick";
    k.clock.advance(300);
    await until(() => a.room.phase === "lobby", "lobi");
    const log = faults()[0]?.gameLog as { gameId: string; actions: unknown[]; players: string[] };
    expect(log.gameId).toBe("test-boom");
    expect(log.actions).toHaveLength(1);
    expect(log.players).toHaveLength(2);
  });
});

describe("/health", () => {
  it("yeni alanlar", async () => {
    const h = (await (await fetch(`http://127.0.0.1:${k.srv.port}/health`)).json()) as Record<
      string,
      unknown
    >;
    expect(h).toMatchObject({ ok: true, draining: false, activeMatches: 0 });
    for (const key of ["tickMsP95", "bytesOutPerSec", "memoryRssMb"]) expect(typeof h[key]).toBe("number");
    expect(h.memoryRssMb as number).toBeGreaterThan(0);
  });
  it("activeMatches ve bytesOutPerSec maç sırasında artar", async () => {
    const cs = await setupRoom(["A", "B"]);
    await startPlaying(cs);
    await press(cs[0] as Client);
    await sync();
    const h = (await (await fetch(`http://127.0.0.1:${k.srv.port}/health`)).json()) as Record<string, number>;
    expect(h.activeMatches).toBe(1);
    expect(h.bytesOutPerSec).toBeGreaterThan(0);
  });
});

describe("zarif kapanış (drain)", () => {
  const health = async () => {
    const res = await fetch(`http://127.0.0.1:${k.srv.port}/health`);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  it("drain: /health 503, yeni oda/katılım reddedilir, maç sürer, bitince çözülür, 1012 ile kapanır", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    a.send({ type: "setGames", gameIds: ["butona-bas"] });
    await sync();
    await startPlaying(cs);
    const code = a.session.roomCode;
    let drained = false;
    const drain = k.srv.drain().then(() => {
      drained = true;
    });
    const h = await health();
    expect(h.status).toBe(503);
    expect(h.body).toMatchObject({ ok: false, draining: true, activeMatches: 1 });

    const fresh = await Client.connect();
    fresh.send({ type: "createRoom", nickname: "Yeni" });
    await until(() => fresh.of("error").length > 0);
    expect(fresh.lastError?.message).toBe("Güncelleme yapılıyor, birazdan tekrar dene.");
    expect(fresh.lastError?.code).toBe("draining");
    fresh.send({ type: "joinRoom", code, nickname: "Yeni" });
    await until(() => fresh.of("error").length > 1);
    expect(fresh.lastError?.message).toBe("Güncelleme yapılıyor, birazdan tekrar dene.");

    // mevcut maç sürer; resume çalışır
    await press(a);
    b.ws.terminate();
    const b2 = await Client.connect();
    b2.send({ type: "resume", token: b.session.token });
    await until(() => b2.updates.length > 0);
    expect(b2.room.phase).toBe("playing");
    expect(drained).toBe(false);

    // maç biter ve host lobiye döner -> drain çözülür
    k.clock.advance(4_000);
    await sync();
    expect(drained).toBe(false);
    k.clock.advance(41_000);
    await until(() => a.room.phase === "results", "sonuç");
    k.clock.advance(7_000);
    await until(() => a.room.phase === "final", "final");
    a.send({ type: "returnToLobby" });
    await until(() => a.room.phase === "lobby", "lobi");
    k.clock.advance(200);
    await drain;
    expect(drained).toBe(true);

    await k.srv.close(1012);
    await until(() => a.closeCode !== null);
    expect(a.closeCode).toBe(1012);
    expect(a.of("left")).toHaveLength(0);
  });

  it("drain süresi dolunca maç bitmemiş olsa da çözülür", async () => {
    const cs = await setupRoom(["A", "B"]);
    // İki tur: 100 sn sonra hâlâ ikinci oyun sürer (final'deki oda drain'i bekletmez).
    cs[0]?.send({ type: "setGames", gameIds: ["butona-bas", "cagrisim-agi"] });
    await sync();
    await startPlaying(cs);
    let drained = false;
    const drain = k.srv.drain().then(() => {
      drained = true;
    });
    // maç (45 sn) sürerken drain bekler; süre (120 sn) dolunca maç bitmemiş olsa da çözülür
    // Maç sürerken drain çözülmez; maç ve sonuç ekranı bittiğinde ya da 120 sn dolunca çözülür.
    k.clock.advance(30_000);
    await sync();
    expect(drained).toBe(false);
    k.clock.advance(91_000);
    await drain;
    expect(drained).toBe(true);
  });

  it("maç yoksa drain hemen çözülür", async () => {
    await create("A");
    await k.srv.drain();
    expect((await health()).status).toBe(503);
  });
});
