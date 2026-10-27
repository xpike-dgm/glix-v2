/**
 * Yapısal gizlilik: maç sırasında odaya giren bir izleyici (ve sahne/TV bağlantısı; aynı güvenlik sınıfı), hiçbir oyunda oyuncuya özel `view` ya da gizli
 * bilgi almaz. Her oyun için gerçek sunucu akışı (katılım, hazırım, eylemler, yayın) botlarla sürülür ve
 * izleyicinin bağlantısına giden her ileti denetlenir:
 *   1. Oyuna izleyicinin kimliği hiç verilmez (`setup` oyuncu listesi, `view` çağrıları).
 *   2. İzleyicinin `match.view` değeri tam olarak `view(durum, null)` (kimseye bağlı olmayan görünüm) değeridir.
 *   3. `secrets(durum)` değerleri izleyiciye giden hiçbir iletide geçmez (bitmiş ve sahibi olmayanlar hariç).
 */
import {
  type AnyGame,
  applyMerge,
  createRng,
  GAMES,
  type GameDefinition,
  type RoomSnapshot,
  type ServerMessage,
} from "@glix/engine";
import { BOTS } from "@glix/engine/testing";
import { describe, expect, it, vi } from "vitest";
import { createManualClock } from "./clock.js";
import { handleMessage } from "./handlers.js";
import { runTick } from "./match.js";
import { createRuntime } from "./rooms.js";
import type { Connection, Room } from "./runtime.js";

interface Fake {
  conn: Connection;
  sent: ServerMessage[];
  /** Bu bağlantıya giden ham iletiler (yayın yolu dahil). */
  raw: string[];
  snapshot: RoomSnapshot | null;
  id(): string;
  /** Sahne bağlantısı: `session` yerine `stage` iletisi alır. */
  stageCode(): string | null;
}

function fake(): Fake {
  const f: Fake = {
    sent: [],
    raw: [],
    snapshot: null,
    stageCode: () => {
      const m = f.sent.find((x) => x.type === "stage");
      return m && m.type === "stage" ? m.roomCode : null;
    },
    id: () => {
      const s = f.sent.find((m) => m.type === "session");
      if (!s || s.type !== "session") throw new Error("oturum yok");
      return s.playerId;
    },
    conn: null as unknown as Connection,
  };
  f.conn = {
    player: null,
    stage: null,
    lastSent: null,
    sentVer: -1,
    ip: "1.2.3.4",
    failedJoins: 0,
    close() {},
    send(msg: ServerMessage) {
      f.sent.push(msg);
      f.raw.push(JSON.stringify(msg));
    },
    sendRaw(text: string) {
      f.raw.push(text);
      const m = JSON.parse(text) as { type: string; snapshot?: RoomSnapshot; patch?: unknown };
      if (m.type === "room" && m.snapshot) f.snapshot = m.snapshot;
      else if (m.type === "patch" && f.snapshot) f.snapshot = applyMerge(f.snapshot, m.patch) as RoomSnapshot;
    },
  } as Connection;
  return f;
}

/**
 * Ham iletideki oyun verisi: `publicView`, `view` ve `result` (tam `room` içinde `snapshot.match`, `patch` içinde
 * `patch.match`). Anlatım metni ve katalog gibi sabit metinler alt dizgi çakışması yarattığından taranmaz;
 * sızıntı denetimi de (`findLeaks`) yalnız görünümleri tarar.
 */
function matchPart(raw: string): string {
  const m = JSON.parse(raw) as {
    snapshot?: { match?: Record<string, unknown> | null };
    patch?: { match?: Record<string, unknown> | null };
  };
  const match = m.snapshot?.match ?? m.patch?.match ?? null;
  return JSON.stringify(match ? [match.publicView, match.view, match.result] : null);
}

const STEP_MS = 250;
const MAX_STEPS = 3000;

/** Oyunu bir izleyiciyle baştan sona sürer; bulunan ihlalleri döner (boşsa temiz). */
function auditGame(id: string, bots: Record<string, { generate: unknown }> = BOTS): string[] {
  const game = GAMES[id] as AnyGame;
  const bot = bots[id] as { generate: (...a: unknown[]) => unknown } | undefined;
  const violations: string[] = [];
  if (!bot) return [`${id}: bot yok`];
  const clock = createManualClock();
  const rt = createRuntime(clock);
  const viewSpy = vi.spyOn(game, "view");
  const setupSpy = vi.spyOn(game, "setup");
  try {
    const n = Math.min(6, Math.max(3, game.minPlayers), game.maxPlayers);
    const host = fake();
    handleMessage(rt, host.conn, { type: "createRoom", nickname: "P0" });
    const room = rt.rooms.get(
      (host.sent.find((m) => m.type === "session") as { roomCode: string }).roomCode,
    ) as Room;
    const crew = [host];
    for (let i = 1; i < n; i++) {
      const f = fake();
      handleMessage(rt, f.conn, { type: "joinRoom", code: room.code, nickname: `P${i}` });
      crew.push(f);
    }
    handleMessage(rt, host.conn, { type: "setGames", gameIds: [id] });
    handleMessage(rt, host.conn, { type: "startMatch" });
    if ((room.phase as string) !== "briefing") return [`${id}: maç başlamadı (${room.phase})`];

    // Sahne (TV) bağlantıları: biri anlatımdan önce, biri oyun sürerken girer. İzleyiciyle aynı kurallara tabidir.
    const stagers: Fake[] = [];
    const joinStager = () => {
      const t = fake();
      handleMessage(rt, t.conn, { type: "joinStage", code: room.code });
      if (t.stageCode() !== room.code) violations.push(`${id}: sahne odaya girmedi`);
      stagers.push(t);
    };
    joinStager();
    if (room.players.size !== n || [...room.players.values()].some((p) => p.spectator))
      violations.push(`${id}: sahne oyuncu listesine girdi`);

    // İlk izleyici anlatımda, ikincisi oyun başladıktan sonra girer.
    const watchers: Fake[] = [];
    const joinWatcher = (name: string) => {
      const w = fake();
      handleMessage(rt, w.conn, { type: "joinRoom", code: room.code, nickname: name });
      const me = room.players.get(w.id());
      if (!me?.spectator) violations.push(`${id}: ${name} izleyici olarak girmedi`);
      watchers.push(w);
    };
    joinWatcher("Izleyici1");
    for (const c of crew) handleMessage(rt, c.conn, { type: "ready" });
    clock.advance(3000);
    runTick(rt);
    rt.broadcaster.flush(room);

    const rng = createRng(0x51ee);
    const checked = new Map<Fake, number>();
    let sawPlaying = false;
    let sawResults = false;
    let joinedLate = false;
    let sawStagePlaying = false;
    let sawStageResults = false;
    for (let step = 0; step < MAX_STEPS && room.phase !== "final"; step++) {
      const match = room.match;
      if (!match) break;
      if (room.phase === "playing") {
        if (!joinedLate && step > 8) {
          joinedLate = true;
          joinWatcher("Izleyici2");
          joinStager();
        }
        const connected = [...match.participants];
        const ctx = { now: clock.now(), rng: createRng(1), connected };
        for (const c of crew) {
          if (rng.next() < 0.5) continue;
          const pid = c.id();
          const pub = game.publicView(match.state, ctx);
          const own = game.view(match.state, pid, ctx);
          const payload = bot.generate(rng, pid, pub, own, connected);
          handleMessage(rt, c.conn, { type: "action", seq: step, payload });
        }
      }
      clock.advance(STEP_MS);
      runTick(rt);
      if (!room.match) break;
      rt.broadcaster.flush(room);

      // Denetim: bu yayında watcher'lara giden iletiler.
      const m = room.match;
      const ctx = { now: clock.now(), rng: createRng(1), connected: [...m.participants] };
      const live = room.phase === "playing" || room.phase === "results";
      const expectedView = live ? JSON.stringify(game.view(m.state, null, ctx) ?? null) : "null";
      const secrets = live ? game.secrets(m.state) : [];
      const finished = live && game.isFinished(m.state, ctx);
      for (const t of stagers) {
        const snap = t.snapshot?.match;
        if (t.snapshot && t.snapshot.selfId !== "") violations.push(`${id}: sahneye oyuncu kimliği verildi`);
        if (t.snapshot && t.snapshot.players.some((p) => p.nickname.startsWith("TV")))
          violations.push(`${id}: sahne oyuncu listesinde`);
        if (snap && room.phase === "results" && snap.result) sawStageResults = true;
        if (snap && room.phase === "playing" && snap.publicView !== null) sawStagePlaying = true;
        if (snap && JSON.stringify(snap.view ?? null) !== expectedView)
          violations.push(`${id}: sahnenin view'ı view(durum, null) değil (adım ${step})`);
        if (
          snap &&
          JSON.stringify(snap.publicView ?? null) !==
            JSON.stringify(watchers[0]?.snapshot?.match?.publicView ?? null)
        )
          violations.push(`${id}: sahnenin publicView'ı izleyiciyle aynı değil (adım ${step})`);
        for (const raw of t.raw.slice(checked.get(t) ?? 0)) {
          const text = matchPart(raw);
          for (const sec of secrets) {
            if (sec.value.length < 3 || (finished && sec.ownerIds.length === 0)) continue;
            if (text.includes(sec.value) || text.includes(JSON.stringify(sec.value).slice(1, -1))) {
              violations.push(`${id}: gizli bilgi sahneye gitti: ${sec.label}`);
            }
          }
        }
        checked.set(t, t.raw.length);
      }
      for (const w of watchers) {
        const snap = w.snapshot?.match;
        if (snap && room.phase === "results" && snap.result) sawResults = true;
        if (snap && live && snap.publicView !== null && room.phase === "playing") sawPlaying = true;
        if (snap && JSON.stringify(snap.view ?? null) !== expectedView) {
          violations.push(`${id}: izleyicinin view'ı view(durum, null) değil (adım ${step})`);
        }
        // Maça ait kısım denetlenir (oda kataloğu gibi herkese açık sabit metinler alt dizgi çakışması yaratır).
        for (const raw of w.raw.slice(checked.get(w) ?? 0)) {
          const text = matchPart(raw);
          for (const s of secrets) {
            if (s.value.length < 3 || (finished && s.ownerIds.length === 0)) continue;
            if (text.includes(s.value) || text.includes(JSON.stringify(s.value).slice(1, -1))) {
              violations.push(`${id}: gizli bilgi izleyiciye gitti: ${s.label}`);
            }
          }
        }
        checked.set(w, w.raw.length);
      }
      if (violations.length > 0) break;
    }
    if (!sawResults) violations.push(`${id}: izleyici sonuç ekranına hiç ulaşmadı`);
    if (!sawPlaying) violations.push(`${id}: izleyici hiç oynanış görünümü almadı (test boş geçiyor)`);

    if (!sawStageResults) violations.push(`${id}: sahne sonuç ekranına hiç ulaşmadı`);
    if (!sawStagePlaying) violations.push(`${id}: sahne hiç oynanış görünümü almadı (test boş geçiyor)`);

    const watcherIds = new Set(watchers.map((w) => w.id()));
    for (const call of viewSpy.mock.calls) {
      if (typeof call[1] === "string" && watcherIds.has(call[1]))
        violations.push(`${id}: view() izleyici kimliğiyle çağrıldı`);
    }
    for (const call of setupSpy.mock.calls) {
      if ((call[0] as readonly string[]).some((p) => watcherIds.has(p)))
        violations.push(`${id}: izleyici setup oyuncu listesine girdi`);
    }
    for (const t of stagers) {
      if (room.stages.size !== stagers.length) violations.push(`${id}: sahne sayısı tutmuyor`);
      if (room.players.size !== watchers.length + n) violations.push(`${id}: sahne koltuk tuttu`);
      if (t.conn.player !== null) violations.push(`${id}: sahne bağlantısına oyuncu bağlandı`);
    }
    for (const w of watchers) {
      if (room.match?.participants.includes(w.id())) violations.push(`${id}: izleyici katılımcı oldu`);
      if (room.players.get(w.id())?.score !== 0) violations.push(`${id}: izleyici puan aldı`);
    }
    return violations;
  } finally {
    viewSpy.mockRestore();
    setupSpy.mockRestore();
  }
}

describe("izleyici gizliliği (yapısal)", () => {
  const ids = Object.keys(GAMES);
  it("tüm oyunlar kayıtlı ve botlu (28)", () => {
    expect(ids).toHaveLength(28);
    for (const id of ids) expect(BOTS[id], id).toBeDefined();
  });

  for (const id of ids) {
    it(`${id}: izleyici hiçbir oyuncuya özel view ya da gizli bilgi almaz`, () => {
      expect(auditGame(id)).toEqual([]);
    }, 60_000);
  }

  describe("denetim kendini kanıtlar", () => {
    interface S {
      players: string[];
      codes: Record<string, string>;
      endsAt: number;
    }
    /** `leak`: gizli kodların izleyiciye hangi yoldan sızdığı. */
    function leaky(leak: "spectator-view" | "public"): GameDefinition<S, { kind: "x" }, unknown, unknown> {
      return {
        id: "sahte-sizinti",
        name: "Sahte",
        minPlayers: 2,
        maxPlayers: 4,
        orientation: "portrait",
        briefing: { goal: "x", steps: [] },
        parseAction: (raw) => (typeof raw === "object" && raw !== null ? { kind: "x" } : null),
        setup: (players, ctx) => ({
          players: [...players],
          endsAt: ctx.now + 20_000,
          codes: Object.fromEntries(players.map((p) => [p, `GIZLI-${p}-${ctx.rng.int(1_000_000)}`])),
        }),
        reduce: (s) => s,
        tick: (s) => s,
        publicView: (s) => (leak === "public" ? { codes: s.codes } : { n: s.players.length }),
        view: (s, id) => (id === null ? (leak === "spectator-view" ? { codes: s.codes } : {}) : {}),
        isFinished: (s, ctx) => ctx.now >= s.endsAt,
        result: (s) => ({ miniScores: {}, awards: Object.fromEntries(s.players.map((p) => [p, 0])) }),
        secrets: (s) => s.players.map((p) => ({ ownerIds: [p], value: s.codes[p] as string, label: p })),
      };
    }
    const bots = { "sahte-sizinti": { generate: () => ({ kind: "x" }) } };

    for (const leak of ["spectator-view", "public"] as const) {
      it(`${leak} sızıntısı yakalanır`, () => {
        (GAMES as Record<string, AnyGame>)["sahte-sizinti"] = leaky(leak) as AnyGame;
        try {
          const found = auditGame("sahte-sizinti", bots);
          expect(found.some((v) => v.includes("gizli bilgi izleyiciye gitti"))).toBe(true);
        } finally {
          delete (GAMES as Record<string, AnyGame>)["sahte-sizinti"];
        }
      });
    }
  });
});
