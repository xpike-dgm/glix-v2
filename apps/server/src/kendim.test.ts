import type { KendimPublicView, KendimView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 11000;
async function send(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

const pub = (c: Client) => c.room.match?.publicView as KendimPublicView;
const mine = (c: Client) => c.room.match?.view as KendimView;

describe("kendim: oda içinde tam maç", () => {
  it("kartlar sahipsiz karışık gelir, eşleştirmeler gizli kalır, puanlar ve genel skor uygulanır", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"], ["kendim"]);
    const host = cs[0] as Client;
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => host.room.phase === "playing", "playing");
    const [a, b, c, d] = cs as [Client, Client, Client, Client];
    const id = (x: Client) => x.session.playerId;
    expect(pub(host).stage).toBe("write");

    expect(await send(a, { kind: "lock" })).toBe(false); // yazmadan Tamam yok
    const words = ["elma", "armut", "kiraz", "üzüm"];
    for (const [i, x] of cs.entries()) expect(await send(x, { kind: "write", text: words[i] })).toBe(true);
    await sync();
    for (const [i, x] of cs.entries()) {
      for (const [j, y] of cs.entries()) {
        const raw = JSON.stringify(y.room.match);
        if (i !== j) expect(raw).not.toContain((words[i] as string).toLocaleUpperCase("tr-TR"));
      }
      expect(mine(x).myText).toBe((words[i] as string).toLocaleUpperCase("tr-TR"));
    }
    for (const x of cs) expect(await send(x, { kind: "lock" })).toBe(true);
    expect(await send(a, { kind: "write", text: "başka" })).toBe(false);
    k.clock.advance(1_100);
    await until(() => pub(host).stage === "match", "eşleştirme");

    // Kartlar: kendi kartın yok; sahipler görünmez.
    for (const [i, x] of cs.entries()) {
      const texts = mine(x)
        .cards.map((card) => card.text)
        .sort();
      expect(texts).toEqual(
        words
          .filter((_, j) => j !== i)
          .map((w) => w.toLocaleUpperCase("tr-TR"))
          .sort(),
      );
      expect(JSON.stringify(x.room.match)).not.toContain('"owner"');
    }
    const cardId = (viewer: Client, word: string) =>
      mine(viewer).cards.find((card) => card.text === word.toLocaleUpperCase("tr-TR"))?.id as number;

    // a: armut -> b (doğru), kiraz -> d (yanlış) => 0; b: elma -> a (doğru; a'nın kartını yalnız b buldu) ;
    // c: armut -> b (doğru; b'nin kartını a ve c buldu: bonus yok), üzüm -> a (yanlış)
    expect(await send(a, { kind: "match", card: cardId(a, "armut"), target: id(b) })).toBe(true);
    expect(await send(a, { kind: "match", card: cardId(a, "kiraz"), target: id(d) })).toBe(true);
    expect(await send(b, { kind: "match", card: cardId(b, "elma"), target: id(a) })).toBe(true);
    expect(await send(c, { kind: "match", card: cardId(c, "armut"), target: id(b) })).toBe(true);
    expect(await send(c, { kind: "match", card: cardId(c, "üzüm"), target: id(a) })).toBe(true);
    // Kendi kartı ve kendine eşleştirme reddedilir.
    expect(await send(a, { kind: "match", card: cardId(b, "armut") as number, target: id(a) })).toBe(false);
    await sync();
    expect(Object.values(mine(a).myPairs).sort()).toEqual([id(b), id(d)].sort());
    expect(mine(d).myPairs).toEqual({});
    for (const x of cs) {
      const raw = JSON.stringify(x.room.match);
      expect(raw).not.toContain('"pairs"');
      expect(pub(x).reveal).toBeNull();
    }

    for (const x of cs) expect(await send(x, { kind: "lock" })).toBe(true);
    expect(await send(a, { kind: "match", card: cardId(a, "armut"), target: id(c) })).toBe(false);
    k.clock.advance(1_100);
    await until(() => pub(host).stage === "reveal", "sonuç açıldı");
    expect(
      pub(host)
        .reveal?.cards.map((card) => card.owner)
        .sort(),
    ).toEqual(cs.map(id).sort());

    k.clock.advance(9_000);
    await until(() => host.room.phase === "results", "sonuç");
    // a: +1 −1 = 0 (kartı b buldu: a'nın kartını yalnız b buldu → +1) = 1
    // b: +1 (a'yı buldu) ; kartını a ve c buldu → bonus yok = 1
    // c: +1 (b) −1 = 0; kartı (kiraz) kimse bulamadı = 0 ; d: sessiz = 0
    const expectedMini: Record<string, number> = { [id(a)]: 1, [id(b)]: 1, [id(c)]: 0, [id(d)]: 0 };
    expect(host.room.match?.result?.miniScores).toEqual(expectedMini);
    // En yüksek puan eşit (1): a ve b +1
    expect(host.room.match?.result?.awards).toEqual({ [id(a)]: 1, [id(b)]: 1 });
    expect(host.room.players.map((p) => p.score)).toEqual([1, 1, 0, 0]);
  });
});
