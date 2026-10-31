import { describe, expect, it, vi } from "vitest";
import type { AiFetch } from "./aiComment.js";
import { parseIdeas } from "./aiInspire.js";
import { type Client, k, setupRoom, sleep, until, useServer } from "./testkit.js";

// Sahte yapay zekâ ucu: canlı API hiç çağrılmaz. Yanıt sırası `answers` ile yönetilir.
let answers: (() => Promise<{ status: number; json(): Promise<unknown> }>)[] = [];
const ok = (text: string) => async () => ({
  status: 200,
  json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text }] }),
});
const aiFetch = vi.fn<AiFetch>(async () => {
  const next = answers.shift();
  if (!next) throw new Error("beklenmeyen istek");
  return next();
});
useServer({ aiKey: "test-anahtar", aiFetch });

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
const inspireOf = (c: Client) => c.room.match?.inspire ?? null;
const errors = (c: Client) => c.of("error").map((e) => e.code);

describe("Bozuk Telefon: İlham ver (sahte yapay zekâ)", () => {
  it("öneriler yalnız isteyen oyuncuya gider; büyük harf, en çok 3; modele kişisel bilgi gitmez", async () => {
    aiFetch.mockClear();
    answers = [
      ok(
        '1. Kedi uzayda pizza yiyor\n- "Balon çiçeğe çarpıp patladı"\nDev kaplumbağa bisiklet sürüyor\nFazla dördüncü',
      ),
    ];
    const [a, b] = (await startBozuk(["Ayşe", "Mehmet", "Zeynep"])) as [Client, Client];
    expect(inspireOf(a)).toEqual({ left: 3, pending: false, failed: false, ideas: [] });
    a.send({ type: "inspire", round: a.room.match?.round ?? 0 });
    await until(() => (inspireOf(a)?.ideas.length ?? 0) > 0, "öneriler");
    expect(inspireOf(a)).toEqual({
      left: 2,
      pending: false,
      failed: false,
      ideas: ["KEDİ UZAYDA PİZZA YİYOR", "BALON ÇİÇEĞE ÇARPIP PATLADI", "DEV KAPLUMBAĞA BİSİKLET SÜRÜYOR"],
    });
    // Başkasının görünümüne ve ortak görünüme öneri girmez.
    expect(inspireOf(b)?.ideas).toEqual([]);
    const stream = JSON.stringify(b.msgs);
    expect(stream).not.toContain("KAPLUMBAĞA");
    expect(JSON.stringify(a.room.match?.publicView)).not.toContain("KAPLUMBAĞA");
    // İstem sabit: oyuncu adı ya da oda kodu yok.
    const body = aiFetch.mock.calls[0]?.[1]?.body ?? "";
    for (const secret of ["Ayşe", "Mehmet", "Zeynep", a.room.code]) expect(body).not.toContain(secret);
    expect(JSON.parse(body)).toMatchObject({ thinking: { type: "disabled" } });
  });

  it("kişi başı en çok 3 istek; hata/zaman aşımında 'ilham yok' ve hak harcanır", async () => {
    aiFetch.mockClear();
    answers = [
      async () => ({ status: 500, json: async () => ({}) }),
      ok("Kedi uyuyor"),
      async () => {
        throw new Error("ağ");
      },
    ];
    const [a] = (await startBozuk(["A", "B", "C"])) as [Client];
    const round = a.room.match?.round ?? 0;
    a.send({ type: "inspire", round });
    await until(() => inspireOf(a)?.failed === true, "hata");
    expect(inspireOf(a)?.left).toBe(2);
    a.send({ type: "inspire", round });
    await until(() => inspireOf(a)?.ideas[0] === "KEDİ UYUYOR", "öneri");
    a.send({ type: "inspire", round });
    await until(() => inspireOf(a)?.left === 0 && inspireOf(a)?.pending === false, "üçüncü");
    expect(inspireOf(a)?.failed).toBe(true);
    a.send({ type: "inspire", round });
    await until(() => errors(a).includes("rate_limited"), "sınır");
    expect(aiFetch).toHaveBeenCalledTimes(3);
  });

  it("yalnız ilk cümle adımında: sonraki adımda düğme yok, istek reddedilir", async () => {
    aiFetch.mockClear();
    answers = [];
    const [a] = (await startBozuk(["A", "B", "C"])) as [Client];
    k.clock.advance(20_000);
    await until(() => (a.room.match?.publicView as { step?: number } | undefined)?.step === 1, "çizme adımı");
    await until(() => inspireOf(a) === null, "düğme kalkar");
    a.send({ type: "inspire", round: a.room.match?.round ?? 0 });
    await until(() => errors(a).includes("wrong_phase"), "ret");
    await sleep(20);
    expect(aiFetch).not.toHaveBeenCalled();
  });

  it("yanıt ayrıştırma: uzun, yasaklı, emojili, bağlantılı satırlar atılır; hiç geçerli yoksa null", () => {
    const banned = (t: string) => t.includes("YASAK");
    expect(
      parseIdeas(`${"A".repeat(61)}\nYASAK SÖZ\nKedi 😀\nhttps://x.y\n2) güneş gülüyor.`, banned),
    ).toEqual(["GÜNEŞ GÜLÜYOR"]);
    expect(parseIdeas("123\n\n", banned)).toBeNull();
    expect(parseIdeas(null, banned)).toBeNull();
  });
});
