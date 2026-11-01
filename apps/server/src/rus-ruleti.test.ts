import { createRng, type Rng, type RusRuletiPublicView, type RusRuletiView } from "@glix/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

/**
 * Oyun tohumu sabit (`rt.randomInt` üzerinden; üretimde crypto). Tamburun hangi atışta patlayacağı tohumdan gelir:
 * tohum rastgeleyken "geri ateş" testi, ilk atış patladığında (~%16; 32 tohumdan 5'i) geri ateş durumunu hiç görmeden
 * son söze geçip `sawBan` false ile düşüyordu. Bu tohumda ilk atış patlamaz; her test aynı tohum dizisiyle başlar.
 */
const SEED = 1;
let seeded: Rng = createRng(SEED);
beforeEach(() => {
  seeded = createRng(SEED);
});
useServer({ randomInt: (max) => seeded.int(max) });

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
    // RR-U9: ilk karar "SİLAH SENDE!" bandı kadar (0,8 sn) uzun.
    expect(pub(a).deadline).toBe(startedAt + 18_800);
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
        k.clock.advance(6_100);
        await sync();
        continue;
      }
      if (p.lastWord) {
        // RR-M3: son söz süresi dolsun (silah rastgele birine geçer).
        goTo(p.lastWord.endsAt);
        await until(() => pub(a).lastWord === null || a.room.phase !== "playing", "son söz bitti");
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
        const targets = p.alive.filter((id) => id !== p.holder && id !== p.noReturn);
        const target = guard % 2 === 0 ? (targets[0] as string) : p.holder;
        expect(await send(cur, { kind: "shoot", target })).toEqual({ ok: true });
        manual++;
        // Açılış penceresi içinde yeni atış reddedilir.
        const next = pub(a);
        await until(() => pub(a).shots === before + 1, "atış yayınlandı");
        expect(pub(a).last).toMatchObject({ shooter: p.holder, target, auto: false });
        if (!next.over && !pub(a).over && !pub(a).lastWord) {
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
    for (const id of end.eliminated)
      expect(view(byId.get(id) as Client)).toEqual({
        role: "out",
        turn: end.shots,
        prediction: null,
        lastResult: null,
        tally: { made: 0, hit: 0, yes: 0, yesHit: 0 },
      });
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

describe("rus-ruleti tahmini (O9)", () => {
  it("yalnız elenen tahmin verir; tahmin gizli kalır; rozet yalnız bitişte herkese açılır", async () => {
    const { cs, ids } = await newMatch(["A", "B", "C", "D", "E", "F"]);
    const [a] = cs as [Client, ...Client[]];
    const byId = new Map(cs.map((c) => [c.session.playerId, c] as const));

    // İlk eleme olana (oyun bitmeden) güvenli biçimde ilerle.
    for (let guard = 0; guard < 120 && pub(a).eliminated.length === 0 && !pub(a).over; guard++) {
      const p = pub(a);
      goTo(Math.max(k.clock.now(), p.openAt));
      await sync();
      const target = p.alive.find((id) => id !== p.holder && id !== p.noReturn) as string;
      await send(byId.get(p.holder) as Client, { kind: "shoot", target });
      await until(() => pub(a).shots > p.shots, "atış");
    }
    expect(pub(a).eliminated.length).toBeGreaterThan(0);
    expect(pub(a).over).toBe(false);
    // RR-M3: elenenin tahmini son sözünden sonra başlar.
    const lw = pub(a).lastWord;
    if (lw) {
      goTo(lw.endsAt);
      await until(() => pub(a).lastWord === null, "son söz bitti");
    }

    const out = byId.get(pub(a).eliminated[0] as string) as Client;
    const aliveOne = byId.get(pub(a).alive[0] as string) as Client;
    const turn = pub(a).shots;
    // Hayatta olan tahmin veremez.
    expect(await send(aliveOne, { kind: "predict", turn, explodes: true })).toEqual({
      ok: false,
      reason: "alive_cannot_predict",
    });
    // Elenen verir; ikinci tahmin ve yanlış sıra reddedilir.
    expect(await send(out, { kind: "predict", turn: turn + 1, explodes: true })).toEqual({
      ok: false,
      reason: "stale_turn",
    });
    expect(await send(out, { kind: "predict", turn, explodes: false })).toEqual({ ok: true });
    expect(await send(out, { kind: "predict", turn, explodes: true })).toEqual({
      ok: false,
      reason: "already_predicted",
    });
    await until(() => (view(out) as { prediction: unknown }).prediction === false, "tahmin görünümde");
    expect(view(out)).toMatchObject({ role: "out", turn, prediction: false });

    // Başkalarına tahmin sızmaz: hayatta olanın görünümü ve ortak görünüm değişmez.
    expect(view(aliveOne)).toEqual({ role: "alive" });
    for (const c of cs) {
      expect(JSON.stringify(pub(c))).not.toMatch(/prediction|predict|correct|kahin/i);
    }
    if (c0(aliveOne) !== c0(out))
      expect(JSON.stringify(aliveOne.msgs.slice(-3))).not.toContain('"prediction":false');

    // Oyun bitene kadar oyna; rozet yalnız bitişte ortak görünümde.
    for (let guard = 0; guard < 200 && a.room.phase === "playing" && !pub(a).over; guard++) {
      let p = pub(a);
      if (p.lastWord) {
        goTo(p.lastWord.endsAt);
        await until(() => pub(a).lastWord === null, "son söz bitti");
        p = pub(a);
      }
      goTo(Math.max(k.clock.now(), p.openAt));
      await sync();
      const target = p.alive.find((id) => id !== p.holder && id !== p.noReturn) ?? p.holder;
      await send(byId.get(p.holder) as Client, { kind: "shoot", target });
      await until(() => pub(a).shots > p.shots || pub(a).over, "atış");
    }
    // RR-U8: oyun içi açılış en az 6 sn.
    for (let i = 0; i < 20 && a.room.phase === "playing"; i++) {
      k.clock.advance(6_100);
      await sync();
    }
    await until(() => a.room.phase === "results", "sonuç");
    expect(Array.isArray(pub(a).result?.kahinler)).toBe(true);
    // Puan yalnız hayatta kalmaya bağlıdır; tahmin puan vermez.
    const end = pub(a);
    const expected = Object.fromEntries(ids.map((id) => [id, end.alive.includes(id) ? 1 : 0]));
    expect(a.room.match?.result?.awards).toEqual(expected);
  });
});

const c0 = (c: Client): string => c.session.playerId;

describe("rus-ruleti son söz ve geri ateş (RR-M1, RR-M3)", () => {
  it("geri ateş reddedilir; elenen silahı protokolle seçtiği kişiye verir", async () => {
    const { cs } = await newMatch(["A", "B", "C", "D", "E", "F"]);
    const [a] = cs as [Client, ...Client[]];
    const byId = new Map(cs.map((c) => [c.session.playerId, c] as const));
    let sawBan = false;
    let passed = false;
    for (let guard = 0; guard < 200 && !passed && !pub(a).over; guard++) {
      const p = pub(a);
      if (p.lastWord) {
        const from = byId.get(p.lastWord.from) as Client;
        goTo(p.lastWord.opensAt);
        await sync();
        const to = p.alive.find((id) => id !== p.holder) as string;
        expect(await send(from, { kind: "pass", to })).toEqual({ ok: true });
        await until(() => pub(a).lastWord === null, "son söz");
        expect(pub(a).holder).toBe(to);
        expect(pub(a).handoff).toEqual({ from: p.lastWord.from, to, chosen: true });
        passed = true;
        break;
      }
      goTo(Math.max(k.clock.now(), p.openAt));
      await sync();
      const holder = byId.get(p.holder) as Client;
      if (p.noReturn) {
        expect(await send(holder, { kind: "shoot", target: p.noReturn })).toEqual({
          ok: false,
          reason: "no_return_fire",
        });
        sawBan = true;
      }
      const target = p.alive.find((id) => id !== p.holder && id !== p.noReturn) as string;
      expect(await send(holder, { kind: "shoot", target })).toEqual({ ok: true });
      await until(() => pub(a).shots > p.shots, "atış");
      expect(pub(a).history).toHaveLength(pub(a).shots);
    }
    expect(passed).toBe(true);
    expect(sawBan).toBe(true);
  });
});
