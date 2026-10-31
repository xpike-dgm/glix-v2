import type { ZamanBombasiColor, ZamanBombasiPublicView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 5000;
async function send(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return ack.reason === undefined ? { ok: ack.ok } : { ok: ack.ok, reason: ack.reason };
}
const act = (c: Client, color: ZamanBombasiColor) => send(c, { kind: "press", color });
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
    goTo(pub().inputStart);
    // Sıra olmayan reddedilir.
    expect((await act(byId.get(o1) as Client, seqNow[0] as ZamanBombasiColor)).reason).toBe("not_your_turn");
    for (const color of seqNow) expect((await act(byId.get(o0) as Client, color)).ok).toBe(true);
    await until(() => pub().phase === "pick", "seçim");
    expect(pub().pick).toMatchObject({ by: o0, kind: "throw", colorDone: false });
    expect(byId.get(o0)?.room.match?.view).toMatchObject({ myPick: true, pickColor: null });

    // Seçim doğrulaması: başkası seçemez, önce renk, kendine atılamaz; geçersiz biçim reddedilir.
    expect((await send(byId.get(o1) as Client, { kind: "color", color: "sari" })).reason).toBe(
      "not_your_pick",
    );
    expect((await send(byId.get(o0) as Client, { kind: "target", target: o1 })).reason).toBe("color_first");
    expect((await send(byId.get(o0) as Client, { kind: "target", target: 5 })).ok).toBe(false);
    expect((await send(byId.get(o0) as Client, { kind: "color", color: "sari" })).ok).toBe(true);
    await until(() => pub().pick?.colorDone === true, "renk seçildi");
    expect(byId.get(o0)?.room.match?.view).toMatchObject({ pickColor: "sari" });
    expect(viewer.room.match?.view).toMatchObject({ pickColor: null });
    expect((await send(byId.get(o0) as Client, { kind: "target", target: o0 })).reason).toBe("bad_target");
    expect((await send(byId.get(o0) as Client, { kind: "target", target: o1 })).ok).toBe(true);
    await until(() => pub().turn === 2, "sıra 2");
    expect(pub().active).toBe(o1);
    expect(pub().length).toBe(3);
    expect(pub().sequence).toEqual([...seqNow, "sari"]);
    expect(pub().lastThrow).toMatchObject({ from: o0, to: o1, auto: false });
    expect(pub().last).toMatchObject({ kind: "ok", player: o0 });

    // Sıra 2: o1 uzayan diziyi doğru girer; bombayı az önce atana (o0) hemen geri atamaz, o2'ye atar.
    seqNow = pub().sequence as ZamanBombasiColor[];
    goTo(pub().inputStart);
    for (const color of seqNow) expect((await act(byId.get(o1) as Client, color)).ok).toBe(true);
    await until(() => pub().phase === "pick", "seçim 2");
    expect(pub().pick?.blocked).toBe(o0);
    expect((await send(byId.get(o1) as Client, { kind: "color", color: "yesil" })).ok).toBe(true);
    expect((await send(byId.get(o1) as Client, { kind: "target", target: o0 })).reason).toBe("bad_target");
    expect((await send(byId.get(o1) as Client, { kind: "target", target: o2 })).ok).toBe(true);
    await until(() => pub().turn === 3, "sıra 3");
    expect(pub().active).toBe(o2);
    expect(pub().length).toBe(4);

    // Sıra 3: o2 yanlış basar -> elenir; dizi 2'ye döner; yeni kurbanı bombayı ona atan (o1) seçer.
    seqNow = pub().sequence as ZamanBombasiColor[];
    goTo(pub().inputStart);
    expect((await act(byId.get(o2) as Client, wrongOf(seqNow[0] as ZamanBombasiColor))).ok).toBe(true);
    await until(() => pub().phase === "pick", "elenme sonrası seçim");
    expect(pub().eliminated).toEqual([o2]);
    expect(pub().scores).toEqual({ [o0]: 0, [o1]: 0, [o2]: 0 });
    expect(pub().length).toBe(2);
    expect(pub().pick).toMatchObject({ by: o1, kind: "restart", colorDone: true });
    expect(pub().last).toMatchObject({ kind: "fail", player: o2, expected: seqNow[0] });
    expect(byId.get(o2)?.room.match?.view).toMatchObject({ isOut: true, myTurn: false });
    // o1 seçmez: süre dolunca sunucu rastgele seçer (tek geçerli hedef o0).
    goTo((pub().pick?.deadline ?? 0) + 10);
    await until(() => pub().turn === 4, "sıra 4");
    expect(pub().active).toBe(o0);
    expect(pub().lastThrow).toMatchObject({ from: o1, to: o0, auto: true });
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
    // ZB-M3: hayatta kalan +2, elenenler 0.
    expect(result?.miniScores).toEqual({ [o0]: 0, [o1]: 2, [o2]: 0 });
    expect(result?.awards).toEqual({ [o0]: 0, [o1]: 2, [o2]: 0 });
    const scoreOf = (id: string) => viewer.room.players.find((p) => p.id === id)?.score;
    expect([scoreOf(o0), scoreOf(o1), scoreOf(o2)]).toEqual([0, 2, 0]);

    // Sonuç ekranında da (izleyiciler dahil) oyun eylemi kabul edilmez.
    expect((await act(byId.get(o1) as Client, "mavi")).ok).toBe(false);
  });

  it("90 sn dolunca giriş yapan oyuncunun sırası cezasız iptal edilir; ani ölümde dizi +2 uzar; kimse elenmezse herkes +1", async () => {
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
      const doneAt = k.clock.now();
      for (const color of seqNow) expect((await act(who, color)).ok).toBe(true);
      await until(() => pub().phase === "pick", "seçim");
      // Seçim yok: süre dolunca renk ve hedef rastgele (seçim süresi 90 sn'den düşer).
      goTo(pub().pick?.deadline ?? 0);
      await until(() => pub().turn === turn + 1 || host.room.phase !== "playing", "sonraki sıra");
      if (host.room.phase !== "playing") break;
      const grew = pub().length - before;
      if (doneAt - pub().startedAt > 60_000) {
        expect(grew).toBe(2);
        sawSudden = true;
      } else {
        expect(grew).toBe(1);
      }
    }
    expect(sawSudden).toBe(true);
    if (host.room.phase === "playing" && pub().phase !== "pick") {
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
    }
    goTo(endsAt);
    await until(() => host.room.phase === "results", "sonuçlar");
    // Kimse elenmeden 90 sn doldu: herkes +1.
    const result = host.room.match?.result;
    expect(Object.values(result?.miniScores ?? {})).toEqual([1, 1, 1]);
  });
});
