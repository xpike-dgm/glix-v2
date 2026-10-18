import type { AsiriYuklemePublicView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 3000;
async function send(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return { ok: ack.ok, ...(ack.reason ? { reason: ack.reason } : {}) };
}

const pub = (c: Client) => c.room.match?.publicView as AsiriYuklemePublicView;

async function startGame(names: string[]): Promise<Client[]> {
  const cs = await setupRoom(names);
  const a = cs[0] as Client;
  a.send({ type: "setGames", gameIds: ["asiri-yukleme"] });
  await until(() => a.room.gameIds[0] === "asiri-yukleme", "oyun seçildi");
  await startPlaying(cs);
  expect(a.room.match?.gameId).toBe("asiri-yukleme");
  return cs;
}

describe("asiri-yukleme tam maç", () => {
  it("toplam ve tıklamalar gizli kalır, 100'de yalnız danger açılır, aşan tık patlar", async () => {
    const cs = await startGame(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    const ids = cs.map((x) => x.session.playerId);

    // Kötü biçimli ve sınır dışı toplu tıklar reddedilir.
    expect(await send(a, { kind: "tap", count: 0 })).toMatchObject({ ok: false });
    expect(await send(a, { kind: "tap", count: 11 })).toMatchObject({ ok: false });
    expect(await send(a, { kind: "tap", count: 1.5 })).toMatchObject({ ok: false });

    // a 40, b 35, c 11 -> 86 tık; bar hâlâ 100 altı.
    for (let i = 0; i < 4; i++) expect((await send(a, { kind: "tap", count: 10 })).ok).toBe(true);
    for (let i = 0; i < 3; i++) expect((await send(b, { kind: "tap", count: 10 })).ok).toBe(true);
    expect((await send(b, { kind: "tap", count: 5 })).ok).toBe(true);
    expect((await send(c, { kind: "tap", count: 10 })).ok).toBe(true);
    expect((await send(c, { kind: "tap" })).ok).toBe(true); // count yok = 1 tık
    await sync();
    expect(pub(a)).toMatchObject({ danger: false, reveal: null });
    expect(Object.keys(pub(a)).sort()).toEqual(["danger", "reveal", "startedAt"]);

    // 100'e ulaşınca yalnız danger değişir; hâlâ sayı yok.
    expect((await send(c, { kind: "tap", count: 10 })).ok).toBe(true); // 96
    expect((await send(c, { kind: "tap", count: 4 })).ok).toBe(true); // tam 100
    await until(() => pub(a).danger, "tehlike");
    expect(pub(a).reveal).toBeNull();
    for (const x of cs) {
      // Oyun görünümleri (yama dahil, tüm geçmiş): sayaç, tıklama ya da patlayan yok.
      const seen = JSON.stringify(
        x.updates.map((u) => [u.snapshot.match?.publicView, u.snapshot.match?.view]),
      );
      expect(seen).not.toContain("clicks");
      expect(seen).not.toContain("exploder");
      expect(seen).not.toContain("total");
      const patches = JSON.stringify(x.msgs.filter((m) => m.type === "patch"));
      expect(patches).not.toContain("clicks");
      expect(patches).not.toContain("exploder");
    }
    expect(a.room.phase).toBe("playing");

    // Pencerede 2 sn sonra hâlâ oyun sürer; sonra ilk tık patlatır ve tur hemen biter.
    k.clock.advance(2_000);
    await sync();
    expect(a.room.phase).toBe("playing");
    expect(pub(b).reveal).toBeNull();
    expect((await send(b, { kind: "tap" })).ok).toBe(true);
    await until(() => pub(a).reveal !== null, "patlama");
    const rev = pub(c).reveal;
    expect(rev?.exploder).toBe(ids[1]);
    expect(rev?.total).toBe(101);
    expect(await send(a, { kind: "tap" })).toEqual({ ok: false, reason: "ended" });

    k.clock.advance(5_100);
    await until(() => a.room.phase === "results", "sonuç");
    // a ve c patlamadı: a (40) tek lider +2, c (25) +1; b patladı -1.
    expect(a.room.match?.result?.awards).toEqual({
      [ids[0] as string]: 2,
      [ids[1] as string]: -1,
      [ids[2] as string]: 1,
    });
    expect(a.room.players.map((p) => p.score)).toEqual([2, -1, 1]);
    expect(c.room.players.map((p) => p.score)).toEqual([2, -1, 1]);
  });

  it("pencere taşmadan biterse patlama olmaz ve tıklamalar sıralanır; 3 sn dolana kadar tur sürer", async () => {
    const cs = await startGame(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    const ids = cs.map((x) => x.session.playerId);
    for (let i = 0; i < 6; i++) expect((await send(a, { kind: "tap", count: 10 })).ok).toBe(true);
    for (let i = 0; i < 4; i++) expect((await send(b, { kind: "tap", count: 10 })).ok).toBe(true);
    await until(() => pub(a).danger, "tehlike");
    k.clock.advance(2_900);
    await sync();
    expect(pub(a).reveal).toBeNull();
    k.clock.advance(200);
    await until(() => pub(a).reveal !== null, "pencere bitti");
    expect(pub(b).reveal).toMatchObject({ exploder: null, total: 100 });
    k.clock.advance(5_100);
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.match?.result?.awards).toEqual({ [ids[0] as string]: 2, [ids[1] as string]: 1 });
    expect(a.room.players.map((p) => p.score)).toEqual([2, 1]);
  });

  it("kimse tıklamazsa 90 sn teknik sınırda sıralama olmadan biter", async () => {
    const cs = await startGame(["A", "B"]);
    const a = cs[0] as Client;
    k.clock.advance(89_000);
    await sync();
    expect(a.room.phase).toBe("playing");
    expect(pub(a).reveal).toBeNull();
    k.clock.advance(1_100);
    await until(() => pub(a).reveal !== null, "sınır doldu");
    k.clock.advance(5_100);
    await until(() => a.room.phase === "results", "sonuç");
    expect(Object.values(a.room.match?.result?.awards ?? {})).toEqual([0, 0]);
  });
});
