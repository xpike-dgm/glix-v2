import type { KontrolPublicView, KontrolView, WireColor } from "@glix/engine";
import { WIRE_COLORS } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 13000;
async function send(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

const pub = (c: Client) => c.room.match?.publicView as KontrolPublicView;
const mine = (c: Client) => c.room.match?.view as KontrolView;

describe("kontrol paneli kaosu: oda içinde tam maç", () => {
  it("paneller ve ipuçları kişiye özel kalır, kesimler gizlidir, herkes kesince 1 sn sonra açılır, puanlar uygulanır", async () => {
    const cs = await setupRoom(["A", "B", "C"], ["kontrol-paneli-kaosu"]);
    const host = cs[0] as Client;
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => host.room.phase === "playing", "playing");
    const ids = cs.map((c) => c.session.playerId);

    // Her telefonda farklı sıra; herkes bir ipucu taşır; ortak görünümde hiçbiri yok.
    const panels = cs.map((c) => mine(c).panel.join());
    expect(new Set(panels).size).toBe(3);
    for (const c of cs) {
      expect([...mine(c).panel].sort()).toEqual([...WIRE_COLORS].sort());
      expect(mine(c).clue?.conditions.length).toBeGreaterThanOrEqual(2);
      const raw = JSON.stringify(c.room.match);
      for (const other of cs) if (other !== c) expect(raw).not.toContain(JSON.stringify(mine(other).panel));
      expect(raw).not.toContain('"reveal":{');
    }
    expect(pub(host).done).toEqual([]);

    // Ipucuna göre hedef paneli bul: koşulu sağlayan tek panel kimdeyse onun doğru kablosu ipucundaki renktir.
    const targetOf = (carrier: Client): Client => {
      const clue = mine(carrier).clue;
      if (!clue) throw new Error("ipucu yok");
      const hits = cs.filter((c) =>
        clue.conditions.every((cond) => mine(c).panel[cond.position - 1] === cond.color),
      );
      expect(hits).toHaveLength(1);
      return hits[0] as Client;
    };
    const [a, b, c] = cs as [Client, Client, Client];
    const answer = new Map<Client, WireColor>();
    for (const carrier of cs) answer.set(targetOf(carrier), mine(carrier).clue?.cut as WireColor);
    expect(answer.size).toBe(3);

    // a doğru keser, b yanlış keser, c kesmez (henüz).
    const wrong = (cl: Client): WireColor => WIRE_COLORS.find((x) => x !== answer.get(cl)) as WireColor;
    expect(await send(a, { kind: "cut", color: "mor" })).toBe(false);
    expect(await send(a, { kind: "cut", color: answer.get(a) })).toBe(true);
    expect(await send(a, { kind: "cut", color: wrong(a) })).toBe(false); // geri alınamaz
    expect(await send(b, { kind: "cut", color: wrong(b) })).toBe(true);
    await sync();
    expect(pub(host).done).toEqual([ids[0], ids[1]]);
    expect(mine(a).myCut).toBe(answer.get(a));
    expect(mine(b).myCut).toBe(wrong(b));
    expect(mine(c).myCut).toBeNull();
    for (const cl of cs) expect(pub(cl).reveal).toBeNull();

    // Son kesimle herkes tamam: 1 sn sonra sonuç açılır.
    expect(await send(c, { kind: "cut", color: answer.get(c) })).toBe(true);
    k.clock.advance(500);
    await sync();
    expect(pub(host).reveal).toBeNull();
    k.clock.advance(700);
    await until(() => pub(host).reveal !== null, "sonuç açıldı");
    expect(await send(a, { kind: "cut", color: "red" })).toBe(false);

    k.clock.advance(8_000);
    await until(() => host.room.phase === "results", "sonuç");
    // a ve c doğru kesti: her biri +1 ve kendi panellerinin ipucu taşıyıcıları +1.
    const expected: Record<string, number> = {
      [ids[0] as string]: 0,
      [ids[1] as string]: 0,
      [ids[2] as string]: 0,
    };
    for (const [cl, ok] of [
      [a, true],
      [b, false],
      [c, true],
    ] as const) {
      if (!ok) continue;
      expected[cl.session.playerId] = (expected[cl.session.playerId] ?? 0) + 1;
      const carrier = cs.find((x) => targetOf(x) === cl) as Client;
      expected[carrier.session.playerId] = (expected[carrier.session.playerId] ?? 0) + 1;
    }
    expect(host.room.match?.result?.awards).toEqual(expected);
    expect(host.room.match?.result?.miniScores).toEqual(expected);
    expect(host.room.players.map((p) => p.score)).toEqual(ids.map((x) => expected[x as string]));
  });
});
