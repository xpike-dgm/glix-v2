import { GAMES, type KulePublicView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer({ randomInt: () => 0 });

let seq = 9000;
async function act(c: Client, at: number): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload: { kind: "drop", at } });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return ack.reason === undefined ? { ok: ack.ok } : { ok: ack.ok, reason: ack.reason };
}

async function startKule(names: string[]): Promise<Client[]> {
  const cs = await setupRoom(names);
  const [host] = cs;
  if (!host) throw new Error("host yok");
  host.send({ type: "setGames", gameIds: ["kule-ustasi"] });
  await until(() => host.room.gameIds.join() === "kule-ustasi", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
  return cs;
}

describe("Kule Ustası: gerçek oda akışı", () => {
  it("rastgele seçime girer", async () => {
    const [host] = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    expect(host.room.catalog.find((g) => g.id === "kule-ustasi")).toMatchObject({
      id: "kule-ustasi",
      name: "Kule Ustası",
      minPlayers: 2,
      maxPlayers: 8,
    });
    expect(host.room.catalog.filter((g) => g.randomPool === false)).toEqual([]);

    host.send({ type: "setRandom", count: 64 });
    await until(() => host.room.selection.mode === "random" && host.room.selection.count > 5, "rastgele");
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    expect(host.room.gameIds).toContain("kule-ustasi");
    expect(host.room.gameIds).toHaveLength(Object.values(GAMES).length);
  });

  it("tam maç: kesme, sıra, zaman aşımı otomatik bırakışı, ıska ve yarısı çıkınca sonuç", async () => {
    const cs = (await startKule(["A", "B", "C", "D"])) as [Client, Client, Client, Client];
    const [host] = cs;
    let viewer: Client = host;
    const pub = () => viewer.room.match?.publicView as KulePublicView;
    const byId = new Map(cs.map((c) => [c.session.playerId, c]));
    const goTo = (t: number) => k.clock.advance(Math.max(0, t - k.clock.now()));

    const order = pub().order as [string, string, string, string];
    const [o0, o1, o2, o3] = order;
    expect(pub().active).toBe(o0);
    expect(pub().tower).toHaveLength(1);
    expect(pub().endsAt - pub().startedAt).toBe(90_000);
    expect(pub().deadline - pub().turnStart).toBe(6_000);
    // Gözlemci: sonda bağlantısı kesilecek (o2) ve ilk oynayan (o0) dışında bir oyuncu.
    viewer = byId.get(o3) as Client;
    await sync();
    expect(byId.get(o0)?.room.match?.view).toMatchObject({ myTurn: true, turnsAway: 0 });
    expect(byId.get(o1)?.room.match?.view).toMatchObject({ myTurn: false, turnsAway: 1 });

    // Sıra başlamadan bırakış reddedilir; sırası olmayan da reddedilir.
    expect((await act(byId.get(o0) as Client, k.clock.now())).reason).toBe("not_started");
    goTo(pub().turnStart);
    expect((await act(byId.get(o1) as Client, pub().turnStart)).reason).toBe("not_your_turn");

    // Sıra 1 (o0): sıranın ilk anında bırakır -> blok sol uçta, kule 400 -> 100 daralır.
    expect((await act(byId.get(o0) as Client, pub().turnStart)).ok).toBe(true);
    await until(() => pub().turn === 2, "sıra 2");
    expect(pub().active).toBe(o1);
    expect(pub().tower).toHaveLength(2);
    expect(pub().blockWidth).toBe(100);
    expect(pub().floors).toBe(1);
    expect(pub().speed).toBe(1060);
    expect(pub().last).toMatchObject({ kind: "ok", player: o0, cutWidth: 300, auto: false });

    // Sıra 2 (o1): ilk anda bırakır -> dar kuleyi ıskalar: çıkar, kule sıfırlanır.
    goTo(pub().turnStart);
    expect((await act(byId.get(o1) as Client, pub().turnStart)).ok).toBe(true);
    await until(() => pub().turn === 3, "sıra 3");
    expect(pub().eliminated).toEqual([o1]);
    expect(pub().tower).toHaveLength(1);
    expect(pub().blockWidth).toBe(400);
    expect(pub().speed).toBe(1000);
    expect(pub().last).toMatchObject({ kind: "miss", player: o1 });
    await sync();
    expect(byId.get(o1)?.room.match?.view).toMatchObject({ isOut: true, myTurn: false });
    expect(pub().active).toBe(o2);
    // Çıkan oyuncu bir daha bırakamaz.
    expect((await act(byId.get(o1) as Client, k.clock.now())).reason).toBe("eliminated");

    // Sıra 3 (o2): hiç dokunmaz (bağlantısı koparmış gibi); süre dolunca otomatik bırakılır.
    // Tabandaki 6 sn'lik konum tam ortadır (kusursuz): kule 400 geniş kalır, o2 kusursuz sayılır.
    byId.get(o2)?.ws.terminate();
    await sync();
    goTo(pub().deadline - 100);
    await sync();
    expect(pub().turn).toBe(3);
    goTo(pub().deadline + 10);
    await until(() => pub().turn === 4, "sıra 4");
    expect(pub().last).toMatchObject({ player: o2, auto: true, kind: "perfect" });
    expect(pub().perfects[o2]).toBe(1);
    expect(pub().active).toBe(o3);
    expect(viewer.room.phase).toBe("playing");

    // Sıra 4 (o3): ilk anda bırakır; kule 400 -> 100. Sonra sıra o0'da: ıska, ikinci çıkış -> oyun biter.
    goTo(pub().turnStart);
    expect((await act(byId.get(o3) as Client, pub().turnStart)).ok).toBe(true);
    await until(() => pub().turn === 5, "sıra 5");
    expect(pub().active).toBe(o0);
    goTo(pub().turnStart);
    expect((await act(byId.get(o0) as Client, pub().turnStart)).ok).toBe(true);
    await until(() => viewer.room.phase === "results", "sonuçlar");

    // o1, o0 çıktı (−1); o2, o3 kaldı (+1); en çok kusursuz yapan o2 ek +1.
    const result = viewer.room.match?.result;
    expect(result?.miniScores).toEqual({ [o0]: -1, [o1]: -1, [o2]: 2, [o3]: 1 });
    expect(result?.awards).toEqual(result?.miniScores);
    const scoreOf = (id: string) => viewer.room.players.find((p) => p.id === id)?.score;
    expect([scoreOf(o0), scoreOf(o1), scoreOf(o2), scoreOf(o3)]).toEqual([-1, -1, 2, 1]);
    // Sonuç ekranında bırakış kabul edilmez.
    expect((await act(byId.get(o3) as Client, k.clock.now())).ok).toBe(false);
  });

  it("oyun en geç 90 sn içinde biter ve sonuç genel skora işlenir", async () => {
    const cs = (await startKule(["A", "B", "C"])) as [Client, Client, Client];
    const [host] = cs;
    const pub = () => host.room.match?.publicView as KulePublicView;
    const endsAt = pub().endsAt;
    expect(endsAt - pub().startedAt).toBe(90_000);
    // TV/sahne bağlantısı da sonucu görür; sayaçlar (`stats`) hiçbirine gitmez.
    const tv = await Client.connect();
    tv.send({ type: "joinStage", code: host.session.roomCode });
    await until(() => tv.updates.length > 0, "sahne katılımı");
    // Saat adım adım ilerler: tek hamlede sarılırsa sonuç ekranı da geçer, maç finale atlar.
    while (host.room.phase === "playing" && k.clock.now() < endsAt + 1000) {
      k.clock.advance(500);
      await sync();
    }
    expect(host.room.phase).toBe("results");
    const scores = host.room.match?.result?.miniScores ?? {};
    expect(Object.keys(scores)).toHaveLength(3);
    // Çıkan −1, kalan +1, kusursuz yapana ek +1: hiçbir puan bu aralığın dışına çıkamaz.
    for (const v of Object.values(scores)) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(2);
    }
    for (const p of host.room.players) expect(p.score).toBe(scores[p.id]);
    await sync();
    expect(tv.room.match?.result?.miniScores).toEqual(scores);
    for (const c of [...cs, tv]) {
      expect(c.room.match?.result).not.toHaveProperty("stats");
      const raw = JSON.stringify(c.msgs);
      expect(raw).not.toContain('"stats"');
    }
  });
});
