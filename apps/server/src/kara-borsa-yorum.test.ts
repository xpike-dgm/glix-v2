import type { BorsaPublicView } from "@glix/engine";
import { describe, expect, it, vi } from "vitest";
import type { AiFetch } from "./aiComment.js";
import { type Client, k, setupRoom, sleep, startPlaying, sync, until, useServer } from "./testkit.js";

// Sahte yapay zekâ ucu (canlı API asla çağrılmaz): mezatçı yorumu yer tutucu adla döner, sunucu gerçek adı koyar.
const aiFetch = vi.fn<AiFetch>(async () => ({
  status: 200,
  json: async () => ({
    stop_reason: "end_turn",
    content: [{ type: "text", text: "Oyuncu1 beş kutuyu da izledi, cüzdanı sağlam ama kârı sıfır." }],
  }),
}));
useServer({ aiKey: "test-anahtar", aiFetch });

let seq = 9_000;
async function send(c: Client, payload: unknown): Promise<boolean> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  return c.of("actionAck").find((a) => a.seq === n)?.ok === true;
}
const pub = (c: Client) => c.room.match?.publicView as BorsaPublicView;

describe("Kara Borsa: mezatçı yorumu", () => {
  it("son kutu açılınca tek istek; modele yalnız yer tutucu adlar ve tur sonuçları gider", async () => {
    const cs = await setupRoom(["Ali", "Banu", "Can"], ["kara-borsa"]);
    await startPlaying(cs);
    const a = cs[0] as Client;
    const b = cs[1] as Client;
    for (let round = 0; round < 5; round++) {
      await until(() => pub(a).round === round && pub(a).phase === "bid", `tur ${round}`);
      expect(await send(b, { kind: "bid", amount: 5 })).toBe(true);
      // Son tur açılmadan istek yok.
      expect(aiFetch).not.toHaveBeenCalled();
      k.clock.advance(20_000);
      await until(() => pub(a).phase === "reveal", "açılış");
      if (round < 4) k.clock.advance(8_000);
    }
    await until(() => a.room.match?.comment !== undefined, "yorum");
    expect(a.room.match?.comment).toBe("Ali beş kutuyu da izledi, cüzdanı sağlam ama kârı sıfır.");
    expect(aiFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(aiFetch.mock.calls[0]?.[1]?.body ?? "{}") as { messages: { content: string }[] };
    const prompt = body.messages[0]?.content ?? "";
    expect(prompt).toContain("Kara Borsa");
    expect(prompt).toContain("Oyuncu2 5 jetona aldı");
    expect(prompt).toContain("(büyük final kutusu)");
    expect(prompt).toContain("- Oyuncu1: 0 kutu aldı, 5 tur teklif vermedi; toplam kâr 0");
    for (const s of ["Ali", "Banu", "Can", ...cs.map((c) => c.session.playerId)])
      expect(prompt).not.toContain(s);
    await sync();
  });
});
