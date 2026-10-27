import type { ZamanBombasiColor, ZamanBombasiPublicView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 5000;
async function act(c: Client, color: ZamanBombasiColor): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload: { kind: "press", color } });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return ack.reason === undefined ? { ok: ack.ok } : { ok: ack.ok, reason: ack.reason };
}
const wrongOf = (c: ZamanBombasiColor): ZamanBombasiColor => (c === "kirmizi" ? "mavi" : "kirmizi");

describe("Zaman Bombası Hafızası: gerçek oda akışı", () => {
  it("tam maç: doğru sıralar, yanlış basış, zaman aşımı, ödüller genel skora işlenir", async () => {
    const cs = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    const [host] = cs;
    host.send({ type: "setGames", gameIds: ["zaman-bombasi-hafizasi"] });
    await until(() => host.room.gameIds.join() === "zaman-bombasi-hafizasi", "oyun seçildi");
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => host.room.phase === "playing", "playing");

    // Gözlemci: sonda bağlantısı kesilecek oyuncu (o0) host olabilir; okumalar o0 dışından yapılır.
    let viewer: Client = host;
    const pub = () => viewer.room.match?.publicView as ZamanBombasiPublicView;
    const byId = new Map(cs.map((c) => [c.session.playerId, c]));
    const goTo = (t: number) => k.clock.advance(Math.max(0, t - k.clock.now()));

    expect(pub().phase).toBe("pause");
    expect(pub().length).toBe(2);
    expect(pub().order).toHaveLength(3);
    const [o0, o1, o2] = pub().order as [string, string, string];
    expect(pub().active).toBe(o0);
    viewer = cs.find((c) => c.session.playerId !== o0) as Client;

    // Oynatma/hazırlık evresinde basış reddedilir.
    expect((await act(byId.get(o0) as Client, "mavi")).reason).toBe("not_input_yet");

    // Sıra 1: o0 diziyi doğru girer. Dizi herkese açık, giriş evresinde kaybolur.
    let seqNow = pub().sequence as ZamanBombasiColor[];
    expect(seqNow).toHaveLength(2);
    for (const c of cs) expect(c.room.match?.view).toMatchObject({ isOut: false });
    goTo(pub().inputStart);
    // Sıra olmayan reddedilir.
    expect((await act(byId.get(o1) as Client, seqNow[0] as ZamanBombasiColor)).reason).toBe("not_your_turn");
    for (const color of seqNow) expect((await act(byId.get(o0) as Client, color)).ok).toBe(true);
    await until(() => pub().turn === 2, "sıra 2");
    expect(pub().active).toBe(o1);
    expect(pub().length).toBe(3);
    expect((pub().sequence as ZamanBombasiColor[]).slice(0, 2)).toEqual(seqNow);
    expect(pub().last).toMatchObject({ kind: "ok", player: o0 });

    // Sıra 2: o1 uzayan diziyi doğru girer (3 renk).
    seqNow = pub().sequence as ZamanBombasiColor[];
    goTo(pub().inputStart);
    for (const color of seqNow) expect((await act(byId.get(o1) as Client, color)).ok).toBe(true);
    await until(() => pub().turn === 3, "sıra 3");
    expect(pub().active).toBe(o2);
    expect(pub().length).toBe(4);

    // Sıra 3: o2 yanlış basar -> elenir, −1; diğerleri +1; dizi 2'ye döner.
    seqNow = pub().sequence as ZamanBombasiColor[];
    goTo(pub().inputStart);
    expect((await act(byId.get(o2) as Client, wrongOf(seqNow[0] as ZamanBombasiColor))).ok).toBe(true);
    await until(() => pub().turn === 4, "sıra 4");
    expect(pub().eliminated).toEqual([o2]);
    expect(pub().scores).toEqual({ [o0]: 1, [o1]: 1, [o2]: -1 });
    expect(pub().length).toBe(2);
    expect(pub().active).toBe(o0);
    expect(pub().last).toMatchObject({ kind: "fail", player: o2, expected: seqNow[0] });
    expect(byId.get(o2)?.room.match?.view).toMatchObject({ isOut: true, myTurn: false });
    expect(viewer.room.phase).toBe("playing");

    // Sıra 4: o0 hiç basmaz (bağlantısı koparmış gibi); süre dolunca elenir ve oyun biter (⌈3/2⌉ = 2).
    byId.get(o0)?.ws.terminate();
    await sync();
    goTo(pub().deadline - 200);
    await sync();
    expect(viewer.room.phase).toBe("playing");
    goTo(pub().deadline + 50);
    await until(() => viewer.room.phase === "results", "sonuçlar");

    const result = viewer.room.match?.result;
    expect(result?.miniScores).toEqual({ [o0]: 0, [o1]: 2, [o2]: -1 });
    expect(result?.awards).toEqual({ [o0]: 0, [o1]: 2, [o2]: -1 });
    const scoreOf = (id: string) => viewer.room.players.find((p) => p.id === id)?.score;
    expect([scoreOf(o0), scoreOf(o1), scoreOf(o2)]).toEqual([0, 2, -1]);

    // Sonuç ekranında da (izleyiciler dahil) oyun eylemi kabul edilmez.
    expect((await act(byId.get(o1) as Client, "mavi")).ok).toBe(false);
  });

  it("90 sn dolunca giriş yapan oyuncunun sırası cezasız iptal edilir; ani ölümde dizi +2 uzar", async () => {
    const cs = (await setupRoom(["A", "B", "C"])) as [Client, Client, Client];
    const [host] = cs;
    host.send({ type: "setGames", gameIds: ["zaman-bombasi-hafizasi"] });
    await until(() => host.room.gameIds.join() === "zaman-bombasi-hafizasi", "oyun seçildi");
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => host.room.phase === "playing", "playing");

    const pub = () => host.room.match?.publicView as ZamanBombasiPublicView;
    const byId = new Map(cs.map((c) => [c.session.playerId, c]));
    const goTo = (t: number) => k.clock.advance(Math.max(0, t - k.clock.now()));
    const endsAt = pub().endsAt;
    expect(endsAt - pub().startedAt).toBe(90_000);
    expect(pub().suddenDeathAt - pub().startedAt).toBe(60_000);
    expect(pub().stepMs).toBe(350);
    expect(pub().deadline - pub().inputStart).toBe(1_500 + 2 * 1_000);

    // Herkes diziyi giriş evresinin başında doğru girer; ani ölüm başlayana kadar +1, sonra +2.
    let sawSudden = false;
    let guard = 0;
    while (pub().deadline < endsAt && guard++ < 60) {
      const before = pub().length;
      const turn = pub().turn;
      const seqNow = pub().sequence as ZamanBombasiColor[];
      const who = byId.get(pub().active as string) as Client;
      goTo(pub().inputStart);
      for (const color of seqNow) expect((await act(who, color)).ok).toBe(true);
      await until(() => pub().turn === turn + 1, "sonraki sıra");
      const grew = pub().length - before;
      if (k.clock.now() - pub().startedAt > 60_000) {
        expect(grew).toBe(2);
        sawSudden = true;
      } else {
        expect(grew).toBe(1);
      }
    }
    expect(sawSudden).toBe(true);
    expect(host.room.phase).toBe("playing");

    // Son sıra: giriş penceresi toplam süreyi aşar; oyuncu yarım girer, süre dolar.
    const who = byId.get(pub().active as string) as Client;
    const seqNow = pub().sequence as ZamanBombasiColor[];
    // (Sıra toplam süreden sonra başlıyorsa oynatma sırasında süre dolar; ceza yine yoktur.)
    if (pub().inputStart < endsAt) {
      goTo(pub().inputStart);
      expect((await act(who, seqNow[0] as ZamanBombasiColor)).ok).toBe(true);
    }
    goTo(endsAt - 1_000);
    await sync();
    expect(host.room.phase).toBe("playing");
    goTo(endsAt);
    await until(() => host.room.phase === "results", "sonuçlar");
    const result = host.room.match?.result;
    expect(Object.values(result?.miniScores ?? {})).toEqual([0, 0, 0]);
  });
});
