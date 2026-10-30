import type { KontrolPublicView, KontrolView, WireColor } from "@glix/engine";
import { answerFor, panelMatches, waveColors } from "@glix/engine";
import { describe, expect, it, vi } from "vitest";
import type { AiFetch } from "./aiComment.js";
import { type Client, k, setupRoom, sleep, sync, until, useServer } from "./testkit.js";

let seq = 13000;
async function send(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}

const pub = (c: Client) => c.room.match?.publicView as KontrolPublicView;
const mine = (c: Client) => c.room.match?.view as KontrolView;

async function startGame(names: string[]): Promise<Client[]> {
  const cs = await setupRoom(names, ["kontrol-paneli-kaosu"]);
  const host = cs[0] as Client;
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
  return cs;
}

/** İpucuna göre hedef paneli bulur: koşulu sağlayan tek panelin doğru kablosu ipucundan hesaplanır. */
function answers(cs: Client[]): Map<Client, WireColor> {
  const out = new Map<Client, WireColor>();
  for (const carrier of cs) {
    const clue = mine(carrier).clue;
    if (!clue) throw new Error("ipucu yok");
    const hits = cs.filter((c) => panelMatches(mine(c).panel, clue.conditions));
    expect(hits).toHaveLength(1);
    const hit = hits[0] as Client;
    out.set(hit, answerFor(mine(hit).panel, clue.cut));
  }
  expect(out.size).toBe(cs.length);
  return out;
}

/** Bütün dalgayı herkesin doğru kesimiyle bitirir ve sonraki aşamaya geçer. */
async function clearWave(cs: Client[], wave: number): Promise<void> {
  const host = cs[0] as Client;
  await until(() => pub(host).stage === "play" && pub(host).wave === wave, `dalga ${wave + 1}`);
  await until(() => cs.every((c) => mine(c).panel.length > 0), "paneller");
  const ans = answers(cs);
  for (const c of cs) expect(await send(c, { kind: "cut", color: ans.get(c) })).toBe(true);
  k.clock.advance(1_100);
  await until(() => pub(host).stage !== "play", `dalga ${wave + 1} bitti`);
}

const okFetch = (text: string) =>
  vi.fn<AiFetch>(async () => ({ status: 200, json: async () => ({ content: [{ type: "text", text }] }) }));

describe("kontrol paneli kaosu: oda içinde tam maç (üç dalga)", () => {
  const aiFetch = okFetch("A üç dalgada da kabloları bir cerrah gibi kesti.");
  useServer({ aiKey: "test-anahtar", aiFetch });

  it("paneller ve ipuçları kişiye özel, kesimler gizli; yanlış kesim saati 5 sn atlatır; dalgalar ilerler; puan +2/+1/0", async () => {
    aiFetch.mockClear();
    const cs = await startGame(["A", "B", "C"]);
    const host = cs[0] as Client;
    const ids = cs.map((c) => c.session.playerId);
    const [a, b, c] = cs as [Client, Client, Client];

    // Dalga 1: her telefonda farklı sıra; herkes bir ipucu taşır; ortak görünümde hiçbiri yok.
    expect(pub(host).wave).toBe(0);
    expect(pub(host).wires).toBe(4);
    expect(new Set(cs.map((x) => mine(x).panel.join())).size).toBe(3);
    for (const x of cs) {
      expect([...mine(x).panel].sort()).toEqual([...waveColors(0)].sort());
      expect(mine(x).clue?.conditions.length).toBeGreaterThanOrEqual(2);
      const raw = JSON.stringify(x.room.match);
      for (const other of cs) if (other !== x) expect(raw).not.toContain(JSON.stringify(mine(other).panel));
      expect(raw).not.toContain('"reveal":{');
    }
    const ans = answers(cs);
    const wrong = (cl: Client): WireColor => waveColors(0).find((x) => x !== ans.get(cl)) as WireColor;

    // a doğru, b yanlış (saat atlar), c sonra.
    const endsAt = pub(host).endsAt;
    expect(await send(a, { kind: "cut", color: "orange" })).toBe(false);
    expect(await send(a, { kind: "cut", color: "purple" })).toBe(false); // 4 kablolu dalgada mor yok
    expect(await send(a, { kind: "cut", color: ans.get(a) })).toBe(true);
    expect(await send(a, { kind: "cut", color: wrong(a) })).toBe(false); // geri alınamaz
    await sync();
    expect(pub(host).endsAt).toBe(endsAt);
    expect(await send(b, { kind: "cut", color: wrong(b) })).toBe(true);
    await sync();
    expect(pub(host).endsAt).toBe(endsAt - 5_000);
    expect(pub(host).jumps).toBe(1);
    expect(pub(host).done).toEqual([ids[0], ids[1]]);
    expect(mine(a).myCut).toBe(ans.get(a));
    expect(mine(b).myCut).toBe(wrong(b));
    expect(mine(c).myCut).toBeNull();
    for (const x of cs) expect(JSON.stringify(pub(x))).not.toContain('"cut":"');

    // Son kesimle herkes tamam: 1 sn sonra kısa sonuç.
    expect(await send(c, { kind: "cut", color: ans.get(c) })).toBe(true);
    k.clock.advance(500);
    await sync();
    expect(pub(host).stage).toBe("play");
    k.clock.advance(700);
    await until(() => pub(host).stage === "break", "ara");
    expect(pub(host).results).toHaveLength(1);
    expect(pub(host).results[0]?.rows[ids[1] as string]?.correct).toBe(false);
    expect(mine(a).panel).toEqual([]);
    expect(await send(a, { kind: "cut", color: "red" })).toBe(false);

    // 4 sn ara, dalga 2 ve 3 herkes doğru.
    k.clock.advance(4_000);
    await clearWave(cs, 1);
    k.clock.advance(4_000);
    await until(() => pub(host).wave === 2 && pub(host).stage === "play", "dalga 3");
    expect(pub(host).wires).toBe(5);
    for (const x of cs) expect(mine(x).panel).toContain("purple");
    await clearWave(cs, 2);
    await until(() => pub(host).reveal !== null, "sonuç açıldı");

    // Toplam imha puanı: dalga 1'de a ve c doğru (+ taşıyıcıları), dalga 2-3'te herkes 2'şer.
    const totals = pub(host).reveal?.totals ?? {};
    const sum = Object.values(totals).reduce((x, y) => x + y, 0);
    expect(sum).toBe(4 + 6 + 6);

    // Yorum: tek istek, yalnız oyun bilgisi (takma adlar, kesimler, puanlar); yanıt ortak görünüme eklenir.
    await until(() => host.room.match?.comment !== undefined, "yorum");
    expect(host.room.match?.comment).toBe("A üç dalgada da kabloları bir cerrah gibi kesti.");
    expect(aiFetch).toHaveBeenCalledTimes(1);
    const [url, init] = aiFetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init?.headers["x-api-key"]).toBe("test-anahtar");
    expect(init?.headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(init?.body ?? "{}") as { model: string; messages: { content: string }[] };
    expect(body.model).toBe("claude-haiku-5-5");
    const prompt = body.messages[0]?.content ?? "";
    expect(prompt).toContain("- A:");
    expect(prompt).toContain("dalga 3:");
    for (const id of ids) expect(prompt).not.toContain(id as string);
    for (const x of cs) expect(JSON.stringify(x.room)).not.toContain("test-anahtar");

    k.clock.advance(8_000);
    await until(() => host.room.phase === "results", "sonuç");
    const awards = host.room.match?.result?.awards ?? {};
    const sorted = [...new Set(Object.values(totals))].filter((v) => v > 0).sort((x, y) => y - x);
    for (const id of ids) {
      const t = totals[id as string] ?? 0;
      const want = t > 0 && t === sorted[0] ? 2 : t > 0 && t === sorted[1] ? 1 : 0;
      expect(awards[id as string]).toBe(want);
    }
    expect(host.room.match?.result?.miniScores).toEqual(awards);
    expect(host.room.players.map((p) => p.score)).toEqual(ids.map((x) => awards[x as string]));
    expect(aiFetch).toHaveBeenCalledTimes(1);
  });
});

describe("kontrol paneli kaosu: yorum anahtarı yokken", () => {
  const aiFetch = okFetch("Bu metin hiç gelmemeli.");
  useServer({ aiFetch });

  it("hiç istek yapılmaz ve yorum görünmez", async () => {
    aiFetch.mockClear();
    const cs = await startGame(["A", "B"]);
    const host = cs[0] as Client;
    await clearWave(cs, 0);
    k.clock.advance(4_000);
    await clearWave(cs, 1);
    k.clock.advance(4_000);
    await clearWave(cs, 2);
    await until(() => pub(host).reveal !== null, "sonuç açıldı");
    expect(pub(host).reveal?.awards).toEqual(Object.fromEntries(cs.map((c) => [c.session.playerId, 1])));
    await sync();
    expect(aiFetch).not.toHaveBeenCalled();
    expect(host.room.match?.comment).toBeUndefined();
  });
});
