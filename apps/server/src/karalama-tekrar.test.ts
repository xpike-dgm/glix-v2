import {
  createRng,
  KARALAMA_POOL,
  KARALAMA_WORD_MEMORY_ID,
  type KaralamaPublicView,
  type KaralamaView,
  karalamaDefteri,
} from "@glix/engine";
import { describe, expect, it } from "vitest";
import { rememberContent, withoutRecent } from "./match.js";
import type { Room } from "./runtime.js";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer({ statsDb: ":memory:" });

const P = ["a", "b", "c"];
const room = () => ({}) as Room;
const keysOf = (list: readonly unknown[] | undefined): string[] =>
  (list ?? []).map((raw) => {
    const e = KARALAMA_POOL.unpack(raw) ?? (raw as { main: string; near: string });
    return [e.main, e.near].sort().join("|");
  });

describe("karalama defteri: aynı odada tekrar (KD-M5)", () => {
  it("son çift ve son kelimeleri içeren çiftler yerleşik havuzdan da süzülür", () => {
    const r = room();
    const s = karalamaDefteri.setup(P, { now: 0, rng: createRng(5), connected: P });
    rememberContent(r, karalamaDefteri, s);
    expect(r.recentContent?.get(KARALAMA_POOL.id)).toEqual([s.pairKey]);
    expect(r.recentContent?.get(KARALAMA_WORD_MEMORY_ID)?.sort()).toEqual(s.pairKey.split("|").sort());
    const out = withoutRecent(r, undefined, "karalama-defteri")?.[KARALAMA_POOL.id] ?? [];
    const words = s.pairKey.split("|");
    expect(out.length).toBeLessThan(KARALAMA_POOL.builtin.length);
    for (const raw of out) {
      const e = raw as { main: string; near: string };
      expect(words.includes(e.main) || words.includes(e.near)).toBe(false);
    }
  });

  it("kelime kuralı havuzu alt sınırın altına düşürürse yalnız çift kuralı uygulanır", () => {
    const r = room();
    const list = Array.from({ length: 11 }, (_, i) => ({ main: "ortak", near: `kel${"abcdefghijk"[i]}` }));
    const content = { [KARALAMA_POOL.id]: list };
    r.recentContent = new Map([
      [KARALAMA_POOL.id, ["kela|ortak"]],
      [KARALAMA_WORD_MEMORY_ID, ["ortak"]],
    ]);
    const out = withoutRecent(r, content)?.[KARALAMA_POOL.id];
    expect(keysOf(out)).not.toContain("kela|ortak");
    expect(out).toHaveLength(10);
  });

  it("çift hafızası 50, kelime hafızası 20 (10 oyun) ile sınırlı", () => {
    const r = room();
    for (let seed = 1; seed <= 60; seed++) {
      rememberContent(
        r,
        karalamaDefteri,
        karalamaDefteri.setup(P, { now: 0, rng: createRng(seed), connected: P }),
      );
    }
    expect(r.recentContent?.get(KARALAMA_POOL.id)?.length).toBeLessThanOrEqual(50);
    expect(r.recentContent?.get(KARALAMA_WORD_MEMORY_ID)?.length).toBeLessThanOrEqual(20);
  });
});

let seq = 7_000;
async function send(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

describe("karalama defteri: çift karnesi (KD-M8)", () => {
  it("oyun bitince çift başına yakalanma ve tahmin sayısı yazılır", async () => {
    const cs = await setupRoom(["A", "B", "C"], ["karalama-defteri"]);
    const host = cs[0] as Client;
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => host.room.phase === "playing", "playing");
    const view = (c: Client) => c.room.match?.view as KaralamaView;
    const pub = (c: Client) => c.room.match?.publicView as KaralamaPublicView;
    const outsider = cs.find((c) => view(c).near) as Client;
    const others = cs.filter((c) => c !== outsider);
    const main = view(others[0] as Client).word as string;
    k.clock.advance(75_000);
    await until(() => pub(host).phase === "vote", "oylama");
    for (const c of others)
      expect(await send(c, { kind: "vote", target: outsider.session.playerId })).toBe(true);
    k.clock.advance(30_000);
    await sync();
    k.clock.advance(5_000);
    await until(() => pub(host).phase === "guess", "son şans");
    expect(await send(outsider, { kind: "guess", text: main })).toBe(true);
    k.clock.advance(1_000);
    await sync();
    k.clock.advance(3_000);
    await until(() => host.room.phase === "results", "sonuç");
    const cards = k.srv.runtime.stats.contentPlayStats(KARALAMA_POOL.id);
    expect([...cards.values()]).toEqual([{ games: 1, top: 1, single: 1 }]);
    // Hafıza: çift ve iki kelime odada.
    const r = [...k.srv.runtime.rooms.values()][0];
    expect(r?.recentContent?.get(KARALAMA_POOL.id)).toHaveLength(1);
    expect(r?.recentContent?.get(KARALAMA_WORD_MEMORY_ID)).toHaveLength(2);
  });
});
