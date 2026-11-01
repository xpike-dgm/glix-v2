import { SOZLUK_ENTRIES, SOZLUK_POOL } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { withFamiliarity, withoutRecent } from "./match.js";
import type { Room } from "./runtime.js";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

const ID = SOZLUK_POOL.id;
const keyOf = (word: string): string => SOZLUK_POOL.key({ word, type: null, definition: "" });

describe("sözlük blöfü: bilinirlik ağırlığı (SB-M7)", () => {
  const none = () => new Map<string, { shown: number; knew: number }>();
  it("sayaç yoksa ya da fazla bilinen yoksa havuz değişmez", () => {
    expect(withFamiliarity(undefined, "sozluk-blofu", none)).toBeUndefined();
    const low = new Map([[keyOf("ŞAKUL"), { shown: 9, knew: 9 }]]);
    expect(withFamiliarity(undefined, "sozluk-blofu", () => low)).toBeUndefined();
    const fine = new Map([[keyOf("ŞAKUL"), { shown: 10, knew: 4 }]]);
    expect(withFamiliarity(undefined, "sozluk-blofu", () => fine)).toBeUndefined();
  });

  it("en az 10 oyunda çıkmış ve %40'ı aşan girdinin ağırlığı yarıya iner (diğerleri iki kez)", () => {
    const stats = new Map([[keyOf("ŞAKUL"), { shown: 10, knew: 5 }]]);
    const out = withFamiliarity(undefined, "sozluk-blofu", () => stats)?.[ID] as readonly { word: string }[];
    expect(out).toHaveLength(SOZLUK_ENTRIES.length * 2 - 1);
    expect(out.filter((e) => e.word === "ŞAKUL")).toHaveLength(1);
    expect(out.filter((e) => e.word === "PERVAZ")).toHaveLength(2);
    // Başka oyunun havuzuna dokunulmaz.
    expect(withFamiliarity(undefined, "yazi-yaz", () => stats)).toBeUndefined();
  });

  it("tekrar süzgeci yerleşik havuza uygulanır: son 40 kelime gelmez", () => {
    const r = {} as Room;
    const recent = SOZLUK_ENTRIES.slice(0, 40).map((e) => SOZLUK_POOL.key(e));
    r.recentContent = new Map([[ID, recent]]);
    const out = withoutRecent(r, undefined, "sozluk-blofu")?.[ID] as readonly { word: string }[];
    expect(out).toHaveLength(SOZLUK_ENTRIES.length - 40);
    for (const e of SOZLUK_ENTRIES.slice(0, 40)) expect(out.map((x) => x.word)).not.toContain(e.word);
  });
});

describe("sözlük blöfü: oda içinde bilinirlik sayacı ve tekrar önleme", () => {
  useServer({ statsDb: ":memory:" });

  let seq = 9000;
  async function act(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
    const n = ++seq;
    c.send({ type: "action", seq: n, payload });
    for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
    const ack = c.of("actionAck").find((a) => a.seq === n);
    return ack?.reason === undefined ? { ok: ack?.ok === true } : { ok: ack.ok, reason: ack.reason };
  }
  const pubOf = (c: Client) => (c.room.match?.publicView ?? {}) as { word?: string; reveal?: unknown };
  const word = (c: Client): string => pubOf(c).word ?? "";
  const myKnew = (c: Client): boolean => (c.room.match?.view as { myKnew?: boolean } | null)?.myKnew === true;

  it("'biliyordum' anonim sayılır, oyun bitince sayaca yazılır; aynı odada kelime tekrar gelmez", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b] = cs as [Client, Client, Client];
    a.send({ type: "setGames", gameIds: ["sozluk-blofu"] });
    await until(() => a.room.gameIds.join() === "sozluk-blofu", "oyun seçildi");
    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "ready" });
    await until(() => a.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => a.room.phase === "playing", "playing");
    await sync();
    const first = word(a);
    expect((await act(a, { kind: "knew", on: true })).reason).toBe("not_yet");

    k.clock.advance(80_000);
    await until(() => (pubOf(a).reveal ?? null) !== null, "açılış");
    k.clock.advance(1_600);
    await sync();
    expect((await act(a, { kind: "knew", on: true })).ok).toBe(true);
    expect((await act(b, { kind: "knew", on: true })).ok).toBe(true);
    expect((await act(b, { kind: "knew", on: false })).ok).toBe(true);
    await sync();
    expect(myKnew(a)).toBe(true);
    expect(myKnew(b)).toBe(false);
    // Kimin bastığı kimsenin ekranına gitmez.
    expect(JSON.stringify(b.room.match?.publicView)).not.toMatch(/knew/i);

    k.clock.advance(70_000);
    await until(() => a.room.phase === "results", "sonuç");
    const stats = k.srv.runtime.stats.contentStats(ID);
    expect(stats.get(keyOf(first))).toEqual({ shown: 1, knew: 1 });
    expect(stats.size).toBe(1);

    // Çekilen kelime odanın tekrar hafızasında (son 40 oyun, SB-M2): sonraki oyunlarda havuzdan çıkarılır.
    const room = [...k.srv.runtime.rooms.values()][0];
    expect(room?.recentContent?.get(ID)).toEqual([keyOf(first)]);
  });
});
