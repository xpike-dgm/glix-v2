import type { BozukPublicView, BozukView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

useServer();

let seq = 4_000;
async function send(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return ack.reason === undefined ? { ok: ack.ok } : { ok: ack.ok, reason: ack.reason };
}

const pub = (c: Client) => c.room.match?.publicView as BozukPublicView;
const mine = (c: Client) => c.room.match?.view as BozukView;

async function startBozuk(names: string[]): Promise<Client[]> {
  const cs = await setupRoom(names);
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: ["bozuk-telefon"] });
  await until(() => host.room.gameIds[0] === "bozuk-telefon", "oyun seçildi");
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
  return cs;
}

const stroke = (n: number) => ({
  kind: "stroke",
  color: "mavi",
  size: 2,
  points: Array.from({ length: n * 2 }, (_, i) => (i * 17) % 1001),
});

describe("bozuk-telefon sunucu entegrasyonu", () => {
  it("tam maç: yaz-çiz-yaz, erken bitiş, gösteri, oylama; puanlar genel skora eklenir", async () => {
    const cs = await startBozuk(["Ayşe", "Mehmet", "Zeynep"]);
    const [a, b, c] = cs as [Client, Client, Client];
    const ids = cs.map((x) => x.session.playerId);
    expect(pub(a).phase).toBe("write");
    expect(pub(a).steps).toBe(3);
    expect(pub(a).reveal).toBeNull();
    expect(mine(a).prompt).toBeNull();

    // Adım 0: herkes aynı cümleyi yazar; hâlâ değiştirilebilir, sonra "Tamam".
    expect(await send(a, { kind: "stroke", color: "mavi", size: 2, points: [1, 2, 3, 4] })).toEqual({
      ok: false,
      reason: "wrong_phase",
    });
    expect(await send(a, { kind: "text", text: "x".repeat(61) })).toEqual({
      ok: false,
      reason: "invalid_action",
    });
    for (const x of cs) expect(await send(x, { kind: "text", text: "ilk fikir" })).toEqual({ ok: true });
    for (const [x, tag] of [
      [a, "qqa"],
      [b, "qqb"],
      [c, "qqc"],
    ] as const) {
      expect(await send(x, { kind: "text", text: `kedi bahçede uyuyor ${tag}` })).toEqual({ ok: true });
    }
    await until(() => mine(a).text === "KEDİ BAHÇEDE UYUYOR QQA", "taslak");
    expect(mine(b).text).toBe("KEDİ BAHÇEDE UYUYOR QQB");
    for (const x of cs) expect(await send(x, { kind: "lock" })).toEqual({ ok: true });
    await until(() => pub(a).doneIds.length === 3, "hazır");
    expect(await send(a, { kind: "text", text: "değiştirme" })).toEqual({ ok: false, reason: "locked" });
    // Erken bitiş: 1 sn sonra çizme adımı.
    k.clock.advance(1_000);
    await until(() => pub(a).phase === "draw", "çizme adımı");
    expect(pub(a).step).toBe(1);
    expect(pub(a).doneIds).toEqual([]);

    // Herkes yalnız bir önceki adımı (kendi zincirinin) görür; ortak görünümde cümle yok.
    const holder = [b, c].find(
      (x) => (mine(x).prompt as { text?: string } | null)?.text === "KEDİ BAHÇEDE UYUYOR QQA",
    );
    expect(holder).toBeDefined();
    const texts = cs.map((x) => (mine(x).prompt?.kind === "write" ? mine(x).prompt : null));
    for (const t of texts) expect(t).not.toBeNull();
    expect(JSON.stringify(pub(a))).not.toContain("QQ");
    expect(JSON.stringify(pub(a))).not.toContain("KEDİ");

    // Adım 1: çizim, herkes bitirir.
    for (const x of cs) expect(await send(x, stroke(6))).toEqual({ ok: true });
    for (const x of cs) expect(await send(x, { kind: "lock" })).toEqual({ ok: true });
    k.clock.advance(1_000);
    await until(() => pub(a).phase === "write" && pub(a).step === 2, "adım 2");
    for (const x of cs) expect(mine(x).prompt?.kind).toBe("draw");

    // Başkasının cümlesi, zincirini tutmayan hiçbir istemcinin akışına gösteri öncesi girmez.
    const stream = (x: Client) =>
      JSON.stringify(x.msgs.filter((m) => m.type === "room" || m.type === "patch"));
    const bystander = [b, c].find((x) => x !== holder) as Client;
    expect(stream(bystander).includes("QQA")).toBe(false);
    // Adım 2: zincir başlatanın cümlesine yakın yaz -> sağlam zincir (herkes aynı cümleyi yazar).
    for (const x of cs)
      expect(await send(x, { kind: "text", text: "Kedi bahçede uyuyor" })).toEqual({ ok: true });
    for (const x of cs) await send(x, { kind: "lock" });
    k.clock.advance(1_000);
    await until(() => pub(a).phase === "reveal", "gösteri");
    expect(pub(a).reveal?.chain).toBe(0);
    expect(pub(a).reveal?.stage).toBe("show");
    expect(pub(a).reveal?.shown).toBe(1);

    // Gösteri: 3 sn aralıkla adımlar açılır (tick'ler yayını tetikler).
    k.clock.advance(3_000);
    await until(() => pub(a).reveal?.shown === 2, "ikinci adım");
    k.clock.advance(3_000);
    await until(() => pub(a).reveal?.shown === 3, "üçüncü adım");
    k.clock.advance(3_000);
    await until(() => pub(a).reveal?.stage === "vote", "oylama");

    const expected: Record<string, number> = {};
    for (const id of ids) expected[id] = 0;
    for (let chain = 0; chain < 3; chain++) {
      await until(
        () => pub(a).reveal?.chain === chain && pub(a).reveal?.stage === "vote",
        `zincir ${chain} oylama`,
      );
      const steps = pub(a).reveal?.steps ?? [];
      expect(steps).toHaveLength(3);
      // Kendi adımına oy verilemez; başkasına tek sefer.
      const ownIndex = steps.findIndex((s) => s.author === ids[0]);
      expect(await send(a, { kind: "vote", step: ownIndex })).toEqual({ ok: false, reason: "own_step" });
      for (const x of cs) {
        const pid = x.session.playerId;
        const target = steps.findIndex((s) => s.author !== pid);
        expect(await send(x, { kind: "vote", step: target })).toEqual({ ok: true });
        expect(await send(x, { kind: "vote", step: target })).toEqual({ ok: false, reason: "voted" });
      }
      // Oy hedefleri sonuç gelene kadar yok.
      await until(() => pub(a).reveal?.voted.length === 3, "oylar");
      expect(pub(a).reveal?.tally).toBeNull();
      // Herkes oy verdi: 1 sn sonra sonuç.
      k.clock.advance(1_000);
      await until(() => pub(a).reveal?.stage === "result", "sonuç penceresi");
      const reveal = pub(a).reveal;
      expect(reveal?.robust).toBe(true);
      reveal?.steps.forEach((s, i) => {
        expected[s.author] = (expected[s.author] ?? 0) + (reveal.tally?.[i] ?? 0) + 1;
      });
      if (chain < 2) {
        k.clock.advance(3_000);
        await until(() => pub(a).reveal?.chain === chain + 1, "sonraki zincir");
        k.clock.advance(9_000);
        await until(() => pub(a).reveal?.stage === "vote", "sonraki oylama");
      }
    }
    expect(pub(a).scores).toBeTruthy();
    k.clock.advance(3_000);
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.match?.result?.awards).toEqual(expected);
    // Her zincir sağlam -> herkes en az 3; oylar da eklenmiş.
    for (const id of ids) expect(expected[id]).toBeGreaterThanOrEqual(3);
    await sync();
    for (const x of cs) {
      const me = x.room.players.find((p) => p.id === x.session.playerId);
      expect(me?.score).toBe(expected[x.session.playerId]);
    }
    // Bitişten sonra eylem reddedilir.
    expect((await send(a, { kind: "vote", step: 1 })).ok).toBe(false);
  });

  it("kimse bir şey yapmazsa süreler dolar: boş yazı '…', boş tuval; oyun yine biter", async () => {
    const cs = await startBozuk(["A", "B", "C"]);
    const a = cs[0] as Client;
    k.clock.advance(25_000);
    await until(() => pub(a).step === 1, "çizme");
    expect(mine(a).prompt).toEqual({ kind: "write", text: "…" });
    k.clock.advance(60_000);
    await until(() => pub(a).step === 2, "yazma");
    expect(mine(a).prompt).toEqual({ kind: "draw", strokes: [] });
    k.clock.advance(25_000);
    await until(() => pub(a).phase === "reveal", "gösteri");
    k.clock.advance(3 * (3 * 3_000 + 10_000 + 3_000));
    await until(() => a.room.phase === "results", "sonuç");
    expect(Object.values(a.room.match?.result?.awards ?? {}).every((v) => v === 0)).toBe(true);
  });

  it("bağlantısı kopan oyuncu beklenmez: kalanlar Tamam deyince adım biter", async () => {
    const cs = await startBozuk(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    c.ws.terminate();
    await until(() => a.room.players[2]?.connected === false, "kopma");
    for (const x of [a, b]) {
      await send(x, { kind: "text", text: "merhaba dünya" });
      expect(await send(x, { kind: "lock" })).toEqual({ ok: true });
    }
    k.clock.advance(1_000);
    await until(() => pub(a).step === 1, "erken bitiş");
  });
});
