import {
  type Rng,
  YAZI_YAZ_TOPIC_POOL,
  type YaziYazPublicView,
  type YaziYazView,
  yaziYaz,
} from "@glix/engine";
import { describe, expect, it } from "vitest";
import { rememberContent, withoutRecent } from "./match.js";
import type { Room } from "./runtime.js";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 9000;
async function send(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

const pub = (c: Client) => c.room.match?.publicView as YaziYazPublicView;
const mine = (c: Client) => c.room.match?.view as YaziYazView;

describe("yazı yaz: oda içinde tam maç", () => {
  it("roller gizli kalır, erken bitişlerle ilerler, tahmin puanları genel skora eklenir", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"], ["yazi-yaz"]);
    const host = cs[0] as Client;
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => host.room.phase === "playing", "playing");

    const ids = cs.map((c) => c.session.playerId);
    const roleOf = (c: Client) => mine(c).role;
    const writers = cs.filter((c) => roleOf(c) === "writer");
    const innocents = cs.filter((c) => roleOf(c) === "innocent");
    expect(writers).toHaveLength(2);
    expect(innocents).toHaveLength(2);
    expect(pub(host).stage).toBe("write");
    // Yerleşik konu listesinden bir konu çıkar ve herkese açıktır.
    expect(typeof pub(host).topic).toBe("string");

    // Rol yalnız sahibine gider: ortak görünümde ve diğerlerinin görünümünde yok.
    for (const c of cs) {
      const raw = JSON.stringify(c.room.match);
      expect(raw).not.toContain('"writers"');
      expect(raw).not.toContain('"reveal":{');
    }

    const [w1, w2] = writers as [Client, Client];
    // Masum yalnız MASUM yazabilir; yazan kendi kelimesini yazar (aynı kelime serbest).
    expect(await send(innocents[0] as Client, { kind: "write", text: "ELMA" })).toBe(false);
    expect(await send(innocents[0] as Client, { kind: "write", text: "masum" })).toBe(true);
    expect(await send(innocents[1] as Client, { kind: "write", text: "MASUM" })).toBe(true);
    expect(await send(w1, { kind: "write", text: "ışık" })).toBe(true);
    // Yazan MASUM yazabilir ama kilitleyemez (yalnız kendine "Yazansın" uyarısı).
    expect(await send(w2, { kind: "write", text: "masum" })).toBe(true);
    expect(await send(w2, { kind: "lock" })).toBe(false);
    expect(await send(w2, { kind: "write", text: "kedi" })).toBe(true);
    await sync();
    expect(mine(w1).myText).toBe("IŞIK");
    for (const c of cs) {
      const raw = JSON.stringify(c.room.match);
      if (c !== w1) expect(raw).not.toContain("IŞIK");
      if (c !== w2) expect(raw).not.toContain("KEDİ");
    }

    // Herkes Tamam deyince yazma 1 sn sonra biter.
    for (const c of cs) expect(await send(c, { kind: "lock" })).toBe(true);
    expect(await send(w1, { kind: "write", text: "başka" })).toBe(false);
    // Yazmada kimin Tamam dediği gizli, sayı görünür.
    await sync();
    expect(pub(host).ready).toEqual([]);
    expect(pub(host).readyCount).toBe(4);
    k.clock.advance(1_100);
    await until(() => pub(host).stage === "talk", "tartışma");
    expect(pub(host).letters).toEqual([4, 4]);

    // Tartışmada herkes atlayınca tahmine geçilir.
    expect(await send(innocents[0] as Client, { kind: "guessPlayer", target: ids[0] as string })).toBe(false);
    for (const c of cs) expect(await send(c, { kind: "skip" })).toBe(true);
    k.clock.advance(1_100);
    await until(() => pub(host).stage === "guess", "tahmin");

    const id = (c: Client) => c.session.playerId;
    const [i1, i2] = innocents as [Client, Client];
    // i1: doğru yazan + doğru kelime (2); i2: doğru yazan, yanlış kelime (1); w1: diğer yazanı + kelimesi (2); w2: masumu seçer (0).
    expect(await send(i1, { kind: "guessPlayer", target: id(w1) })).toBe(true);
    expect(await send(i1, { kind: "guessWord", text: " Işık " })).toBe(true);
    expect(await send(i2, { kind: "guessPlayer", target: id(w2) })).toBe(true);
    expect(await send(i2, { kind: "guessWord", text: "köpek" })).toBe(true);
    expect(await send(w1, { kind: "guessPlayer", target: id(w2) })).toBe(true);
    expect(await send(w1, { kind: "guessWord", text: "KEDİ" })).toBe(true);
    expect(await send(w2, { kind: "guessPlayer", target: id(i1) })).toBe(true);
    expect(await send(w2, { kind: "guessPlayer", target: id(w2) })).toBe(false);
    for (const c of cs) expect(await send(c, { kind: "lock" })).toBe(true);
    // Tahminler kilitlenene kadar sonuç açılmaz; kilit sonrası değişiklik yok.
    expect(await send(i1, { kind: "guessWord", text: "x1" })).toBe(false);
    k.clock.advance(1_100);
    await until(() => pub(host).stage === "reveal", "sonuç açıldı");
    const rev = pub(host).reveal;
    expect(rev?.writers.slice().sort()).toEqual([id(w1), id(w2)].sort());
    expect(rev?.words[id(w1)]).toBe("IŞIK");
    expect(rev?.words[id(w2)]).toBe("KEDİ");

    k.clock.advance(8_000);
    await until(() => host.room.phase === "results", "sonuç");
    const expected: Record<string, number> = {
      [id(i1)]: 2,
      [id(i2)]: 1,
      [id(w1)]: 2,
      [id(w2)]: 0,
    };
    expect(host.room.match?.result?.awards).toEqual(expected);
    expect(host.room.match?.result?.miniScores).toEqual(expected);
    expect(host.room.players.map((p) => p.score)).toEqual(ids.map((x) => expected[x]));
  });

  it("son eksik oyuncu koparsa yazma 1 sn sonra biter (YY-M5)", async () => {
    const cs = await setupRoom(["A", "B", "C", "D"], ["yazi-yaz"]);
    const host = cs[0] as Client;
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => host.room.phase === "playing", "playing");
    const last = cs.find((c) => c !== host && mine(c).role === "innocent") as Client;
    for (const c of cs) {
      if (c === last) continue;
      if (mine(c).role === "writer") expect(await send(c, { kind: "write", text: "elma" })).toBe(true);
      expect(await send(c, { kind: "lock" })).toBe(true);
    }
    await sync();
    expect(pub(host).stage).toBe("write");
    const before = pub(host).writeEndsAt;
    last.ws.close();
    await until(() => pub(host).writeEndsAt < before, "erken bitiş");
    k.clock.advance(1_100);
    await until(() => pub(host).stage === "talk", "tartışma");
  });
});

describe("yazı yaz: konu tekrarı (aynı odada son 10 oyun)", () => {
  const room = () => ({}) as Room;
  /** Her zaman ilk seçeneği veren sahte rastgele sayı üreteci. */
  const FIRST: Rng = { next: () => 0, int: () => 0, shuffle: <T>(x: readonly T[]) => [...x] };
  const id = YAZI_YAZ_TOPIC_POOL.id;
  it("son çıkan konular havuzdan çıkarılır; havuz yetmezse çıkarılmaz", () => {
    const r = room();
    const content = { [id]: ["MEYVE", "MESLEK", "HAYVAN"] };
    const state = yaziYaz.setup(["a", "b", "c"], {
      now: 0,
      rng: FIRST,
      connected: ["a", "b", "c"],
      content,
    });
    expect(state.topic).toBe("MEYVE");
    rememberContent(r, yaziYaz, state);
    expect(withoutRecent(r, content)?.[id]).toEqual(["MESLEK", "HAYVAN"]);
    r.recentContent?.set(id, ["meyve", "meslek", "hayvan"]);
    expect(withoutRecent(r, content)?.[id]).toEqual(content[id]);
    expect(withoutRecent(r, undefined)).toBeUndefined();
  });

  it("en çok 10 konu hatırlanır", () => {
    const r = room();
    for (let i = 0; i < 12; i++) {
      rememberContent(r, yaziYaz, {
        ...yaziYaz.setup(["a", "b", "c"], {
          now: 0,
          rng: FIRST,
          connected: ["a", "b", "c"],
          content: { [id]: [`KONU ${i}`] },
        }),
      });
    }
    expect(r.recentContent?.get(id)).toHaveLength(10);
    expect(r.recentContent?.get(id)?.at(-1)).toBe("konu 11");
  });
});
