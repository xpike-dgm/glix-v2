import { CONTINUE_GRACE_MS, CONTINUE_MIN_GAP_MS, KONTROL_PLAY_MS, REVEAL_HOLD_MS } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { RESULTS_MS } from "./match.js";
import { type Client, join, k, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

/**
 * Oyun içi sonuç ekranı "Devam et" kuralı (docs/ERKEN-BITIS.md "Oyun içi sonuç ekranı"). Kontrol Paneli Kaosu:
 * 60 sn kesim, ardından 8 sn açılış animasyonu (`finishAt`). Testteki istemciler kendiliğinden basmaz.
 */
interface Pub {
  endsAt: number;
  finishAt: number;
}

const GAME = "kontrol-paneli-kaosu";
const pub = (c: Client): Pub => c.room.match?.publicView as Pub;

async function toReveal(cs: Client[]): Promise<{ endsAt: number; finishAt: number }> {
  for (const c of cs) c.autoReveal = false;
  const a = cs[0] as Client;
  await startPlaying(cs);
  const { endsAt, finishAt } = pub(a);
  expect(a.room.match?.reveal ?? null).toBeNull();
  k.clock.advance(Math.max(0, endsAt - k.clock.now()));
  await until(() => a.room.match?.reveal != null, "sonuç ekranı açıldı");
  return { endsAt, finishAt };
}

const ids = (cs: Client[]): string[] => cs.map((c) => c.session.playerId).sort();
const press = (c: Client): void => c.send({ type: "revealContinue", round: c.room.match?.round ?? 0 });
const gap = async (): Promise<void> => {
  k.clock.advance(CONTINUE_MIN_GAP_MS + 10);
  await sync();
};

describe("oyun içi sonuç ekranında Devam et", () => {
  it("açılış başlayınca sonuç ekranı bildirilir: başlangıç, 60 sn tavan, boş onay listesi", async () => {
    const cs = await setupRoom(["A", "B"], [GAME]);
    const [a, b] = cs as [Client, Client];
    const { endsAt } = await toReveal(cs);
    const r = a.room.match?.reveal;
    expect(r?.startedAt).toBeGreaterThanOrEqual(endsAt);
    expect((r?.startedAt ?? 0) - endsAt).toBeLessThan(200);
    expect(r?.endsAt).toBe((r?.startedAt ?? 0) + REVEAL_HOLD_MS);
    expect(r?.continueIds).toEqual([]);
    expect(b.room.match?.reveal).toEqual(r);
    expect(a.room.phase).toBe("playing");
  });

  it("herkes animasyon bitmeden basarsa animasyon kesilmez; bitince 1 sn sonra oyun biter", async () => {
    const cs = await setupRoom(["A", "B", "C"], [GAME]);
    const [a, b, c] = cs as [Client, Client, Client];
    const { finishAt } = await toReveal(cs);
    press(a);
    press(b);
    await until(() => a.room.match?.reveal?.continueIds.length === 2, "iki onay");
    press(c);
    await until(() => a.room.match?.reveal?.continueIds.length === 3, "üç onay");
    expect(a.room.match?.reveal?.continueIds.sort()).toEqual(ids(cs));
    // Animasyon (finishAt) bitene kadar oyun sürer.
    k.clock.advance(finishAt - 300 - k.clock.now());
    await sync();
    expect(a.room.phase).toBe("playing");
    k.clock.advance(Math.max(0, finishAt - k.clock.now()));
    await sync();
    const doneAt = k.clock.now();
    expect(a.room.phase).toBe("playing");
    await until(() => a.room.phase === "results", "sonuç aşaması");
    expect(k.clock.now()).toBeGreaterThanOrEqual(finishAt + CONTINUE_GRACE_MS);
    expect(k.clock.now() - doneAt).toBeLessThanOrEqual(CONTINUE_GRACE_MS + 400);
    expect(a.room.match?.reveal ?? null).toBeNull();
    expect(a.room.match?.result).not.toBeNull();
  });

  it("animasyondan sonra herkes basınca 1 sn sonra biter; biri eksikken beklenir", async () => {
    const cs = await setupRoom(["A", "B", "C"], [GAME]);
    const [a, b, c] = cs as [Client, Client, Client];
    const { finishAt } = await toReveal(cs);
    k.clock.advance(finishAt + 5_000 - k.clock.now());
    press(a);
    press(b);
    await until(() => a.room.match?.reveal?.continueIds.length === 2, "iki onay");
    k.clock.advance(10_000);
    await sync();
    expect(a.room.phase).toBe("playing");
    const sentAt = k.clock.now();
    press(c);
    await until(() => a.room.phase === "results", "sonuç aşaması");
    expect(k.clock.now()).toBeGreaterThanOrEqual(sentAt + CONTINUE_GRACE_MS);
    expect(k.clock.now() - sentAt).toBeLessThanOrEqual(CONTINUE_GRACE_MS + 600);
  });

  it("kimse basmazsa açılış başından 60 sn sonra biter (tavan)", async () => {
    const cs = await setupRoom(["A", "B"], [GAME]);
    const [a, b] = cs as [Client, Client];
    await toReveal(cs);
    const startedAt = a.room.match?.reveal?.startedAt ?? 0;
    press(b);
    await until(() => a.room.match?.reveal?.continueIds.length === 1, "bir onay");
    k.clock.advance(startedAt + REVEAL_HOLD_MS - 200 - k.clock.now());
    await sync();
    expect(a.room.phase).toBe("playing");
    k.clock.advance(300);
    await until(() => a.room.phase === "results", "tavan");
    expect(k.clock.now()).toBeGreaterThanOrEqual(startedAt + REVEAL_HOLD_MS);
  });

  it("kopan oyuncu beklenmez; son bekleneni kopması sayımı tamamlar", async () => {
    const cs = await setupRoom(["A", "B", "C"], [GAME]);
    const [a, b, c] = cs as [Client, Client, Client];
    const { finishAt } = await toReveal(cs);
    k.clock.advance(finishAt + 2_000 - k.clock.now());
    c.ws.terminate();
    await until(() => a.room.players[2]?.connected === false, "C koptu");
    press(a);
    await until(() => a.room.match?.reveal?.continueIds.length === 1, "bir onay");
    k.clock.advance(3_000);
    await sync();
    expect(a.room.phase).toBe("playing");
    press(b);
    await until(() => a.room.phase === "results", "kopan beklenmedi");

    // İkinci senaryo: herkes bağlıyken bekleneni kopar.
    const cs2 = await setupRoom(["D", "E", "F"], [GAME]);
    const [d, e, f] = cs2 as [Client, Client, Client];
    const t2 = await toReveal(cs2);
    k.clock.advance(t2.finishAt + 2_000 - k.clock.now());
    press(d);
    press(e);
    await until(() => d.room.match?.reveal?.continueIds.length === 2, "iki onay");
    k.clock.advance(3_000);
    await sync();
    expect(d.room.phase).toBe("playing");
    f.ws.terminate();
    await until(() => d.room.phase === "results", "son beklenen koptu");
  });

  it("izleyici sayılmaz ve beklenmez; hata da almaz", async () => {
    const cs = await setupRoom(["A", "B"], [GAME]);
    const [a, b] = cs as [Client, Client];
    for (const c of cs) c.autoReveal = false;
    await startPlaying(cs);
    const w = await join(a.session.roomCode, "Can");
    w.autoReveal = false;
    await until(() => a.room.players.length === 3, "izleyici girdi");
    const { endsAt, finishAt } = pub(a);
    k.clock.advance(endsAt - k.clock.now());
    await until(() => a.room.match?.reveal != null, "sonuç ekranı");
    expect(w.room.match?.reveal?.continueIds).toEqual([]);
    w.send({ type: "revealContinue", round: 0 });
    await sync();
    expect(w.of("error")).toHaveLength(0);
    expect(a.room.match?.reveal?.continueIds).toEqual([]);
    k.clock.advance(finishAt + 1_000 - k.clock.now());
    press(a);
    press(b);
    await until(() => a.room.phase === "results", "izleyici beklenmedi");
  });

  it("yanlış aşamada ya da yanlış oyunda reddedilir (lobi, anlatım, açılıştan önce, sonuç, final)", async () => {
    const cs = await setupRoom(["A", "B"], [GAME]);
    const [a, b] = cs as [Client, Client];
    for (const c of cs) c.autoReveal = false;
    let errors = 0;
    const expectWrongPhase = async (round = 0): Promise<void> => {
      b.send({ type: "revealContinue", round });
      errors += 1;
      await until(() => b.of("error").length === errors, "hata");
      expect(b.lastError?.code).toBe("wrong_phase");
      await gap();
    };
    await expectWrongPhase();

    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing", "anlatım");
    await expectWrongPhase();
    for (const c of cs) c.send({ type: "ready" });
    await until(() => a.room.phase === "countdown", "geri sayım");
    k.clock.advance(3000);
    await until(() => a.room.phase === "playing", "oyun");
    await expectWrongPhase();

    k.clock.advance(KONTROL_PLAY_MS);
    await until(() => a.room.match?.reveal != null, "sonuç ekranı");
    // Başka oyunun sırası: eski/gelecek oyundan gecikmiş mesaj sayılmaz.
    await expectWrongPhase(1);
    expect(a.room.match?.reveal?.continueIds).toEqual([]);

    k.clock.advance(REVEAL_HOLD_MS);
    await until(() => a.room.phase === "results", "sonuç aşaması");
    await expectWrongPhase();
    k.clock.advance(RESULTS_MS);
    await until(() => a.room.phase === "final", "final");
    await expectWrongPhase();
  });

  it("tekrar onay sessizdir; art arda gelen rate_limited alır, sayımı bozmaz", async () => {
    const cs = await setupRoom(["A", "B"], [GAME]);
    const [a, b] = cs as [Client, Client];
    await toReveal(cs);
    press(b);
    press(b);
    await until(() => b.of("error").length === 1, "hız sınırı");
    expect(b.lastError?.code).toBe("rate_limited");
    expect(a.room.match?.reveal?.continueIds).toEqual([b.session.playerId]);
    await gap();
    press(b);
    await sync();
    expect(b.of("error")).toHaveLength(1);
    expect(a.room.match?.reveal?.continueIds).toEqual([b.session.playerId]);
  });

  it("geçersiz biçim reddedilir (fazladan alan, eksik/bozuk sıra)", async () => {
    const cs = await setupRoom(["A", "B"], [GAME]);
    const [a, b] = cs as [Client, Client];
    await toReveal(cs);
    const bad: unknown[] = [
      { type: "revealContinue" },
      { type: "revealContinue", round: 0, extra: 1 },
      { type: "revealContinue", round: -1 },
      { type: "revealContinue", round: 0.5 },
      { type: "revealContinue", round: "0" },
    ];
    for (const [i, msg] of bad.entries()) {
      b.send(msg);
      await until(() => b.of("error").length === i + 1, "hata");
      expect(b.lastError?.code).toBe("invalid_message");
    }
    expect(a.room.match?.reveal?.continueIds).toEqual([]);
  });

  it("puan tablosu (results) 60 sn sürer", async () => {
    const cs = await setupRoom(["A", "B"], [GAME, "butona-bas"]);
    const [a] = cs as [Client];
    await toReveal(cs);
    k.clock.advance(REVEAL_HOLD_MS);
    await until(() => a.room.phase === "results", "sonuç aşaması");
    const m = a.room.match;
    expect(RESULTS_MS).toBe(60_000);
    expect((m?.phaseEndsAt ?? 0) - (m?.phaseStartedAt ?? 0)).toBe(RESULTS_MS);
  });
});
