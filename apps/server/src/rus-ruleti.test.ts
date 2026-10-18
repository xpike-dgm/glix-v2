import type { RusRuletiPublicView, RusRuletiView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 6000;
async function send(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return { ok: ack.ok, ...(ack.reason ? { reason: ack.reason } : {}) };
}

const pub = (c: Client) => c.room.match?.publicView as RusRuletiPublicView;
const view = (c: Client) => c.room.match?.view as RusRuletiView;

async function newMatch(names: string[]): Promise<{ cs: Client[]; ids: string[]; startedAt: number }> {
  const cs = await setupRoom(names);
  const [a] = cs as [Client, ...Client[]];
  a.send({ type: "setGames", gameIds: ["rus-ruleti"] });
  await until(() => a.room.gameIds[0] === "rus-ruleti", "oyun seçildi");
  const { startedAt } = await startPlaying(cs);
  expect(a.room.match?.gameId).toBe("rus-ruleti");
  return { cs, ids: cs.map((c) => c.session.playerId), startedAt };
}

const goTo = (t: number) => k.clock.advance(Math.max(0, t - k.clock.now()));

describe("rus-ruleti tam maç", () => {
  it("ateşler protokolden geçer, patlayan elenir, hayatta kalanlar +1 alır ve genel skora işlenir", async () => {
    const { cs, ids, startedAt } = await newMatch(["A", "B", "C", "D"]);
    const [a] = cs as [Client, ...Client[]];
    const byId = new Map(cs.map((c) => [c.session.playerId, c] as const));

    // Başlangıç: herkes hayatta, risk %16, tek bir sahip.
    expect(pub(a)).toMatchObject({ risk: 16, shots: 0, over: false, last: null });
    expect(pub(a).alive).toEqual(ids);
    expect(pub(a).deadline).toBe(startedAt + 18_000);
    const first = pub(a).holder;
    expect(ids).toContain(first);
    expect(view(byId.get(first) as Client)).toEqual({ role: "alive" });

    // Sahip olmayan ateş edemez; geçersiz hedef ve çöp reddedilir.
    const other = cs.find((c) => c.session.playerId !== first) as Client;
    const holder = byId.get(first) as Client;
    expect(await send(other, { kind: "shoot", target: first })).toEqual({ ok: false, reason: "not_holder" });
    expect(await send(holder, { kind: "shoot", target: "yok" })).toEqual({ ok: false, reason: "bad_target" });
    expect(await send(holder, { kind: "shoot" })).toMatchObject({ ok: false });

    // Oyun bitene kadar: sahip rastgele hayatta birini vurur; bazı turlarda süreyi bekler.
    let timeouts = 0;
    let manual = 0;
    for (let guard = 0; guard < 80 && a.room.phase === "playing"; guard++) {
      const p = pub(a);
      if (p.over) {
        k.clock.advance(2_600);
        await sync();
        continue;
      }
      const cur = byId.get(p.holder) as Client;
      const before = p.shots;
      goTo(Math.max(k.clock.now(), p.openAt));
      await sync();
      if (guard % 3 === 2) {
        // Süre dolsun: sunucu otomatik ateş eder (sahip bağlı olsa da).
        goTo(p.deadline as number);
        await until(() => pub(a).shots > before || a.room.phase !== "playing", "otomatik atış");
        if (pub(a).shots > before) {
          expect(pub(a).last).toMatchObject({ auto: true, shooter: p.holder });
          expect(pub(a).last?.target).not.toBe(p.holder);
          timeouts++;
        }
      } else {
        const targets = p.alive.filter((id) => id !== p.holder);
        const target = guard % 2 === 0 ? (targets[0] as string) : p.holder;
        expect(await send(cur, { kind: "shoot", target })).toEqual({ ok: true });
        manual++;
        // Açılış penceresi içinde yeni atış reddedilir.
        const next = pub(a);
        await until(() => pub(a).shots === before + 1, "atış yayınlandı");
        expect(pub(a).last).toMatchObject({ shooter: p.holder, target, auto: false });
        if (!next.over && !pub(a).over) {
          const newHolder = byId.get(pub(a).holder) as Client;
          expect(await send(newHolder, { kind: "shoot", target: pub(a).holder })).toEqual({
            ok: false,
            reason: "not_open",
          });
        }
      }
    }
    expect(a.room.phase === "results" || pub(a).over).toBe(true);
    await until(() => a.room.phase === "results", "sonuç");
    expect(manual).toBeGreaterThan(0);
    expect(timeouts).toBeGreaterThanOrEqual(0);

    // Elenen sayısı: 4 oyuncuda hayatta kalan en çok 2.
    const end = pub(a);
    expect(end.over).toBe(true);
    expect(end.alive.length).toBeLessThanOrEqual(2);
    expect(end.alive.length + end.eliminated.length).toBe(4);

    const expected = Object.fromEntries(ids.map((id) => [id, end.alive.includes(id) ? 1 : 0]));
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.match?.result?.miniScores).toEqual(expected);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => expected[id]));
    expect(end.result?.survivors).toEqual(end.alive);

    // Elenenler izleyici rolündedir.
    for (const id of end.eliminated) expect(view(byId.get(id) as Client)).toEqual({ role: "out" });
    for (const id of end.alive) expect(view(byId.get(id) as Client)).toEqual({ role: "alive" });
  });

  it("kimse dokunmasa da oyun otomatik atışlarla biter", async () => {
    const { cs, ids, startedAt } = await newMatch(["A", "B", "C"]);
    const [a] = cs as [Client, ...Client[]];
    let t = startedAt;
    for (let i = 0; i < 400 && a.room.phase === "playing"; i++) {
      t += 5_000;
      goTo(t);
      await sync();
    }
    await until(() => a.room.phase === "results", "sonuç");
    const end = pub(a);
    expect(end.over).toBe(true);
    expect(end.last?.auto).toBe(true);
    expect(end.alive).toHaveLength(1);
    const expected = Object.fromEntries(ids.map((id) => [id, end.alive.includes(id) ? 1 : 0]));
    expect(a.room.match?.result?.awards).toEqual(expected);
    expect(a.room.players.map((p) => p.score)).toEqual(ids.map((id) => expected[id]));
  });
});
