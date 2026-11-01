/**
 * Oyun alanı (test2) bot koşuları ve yalnız-bot odaları (botKosusu.ts, sözleşme bölüm 14): uçlar canlıda ve test'te
 * 404; sahte saatle 2 oyun × 3 bot koşusu biter ve ölçümleri toplar; aynı anda tek koşu; iptal; takılan ve çöken maç;
 * oyun alanı odası; yalnız-bot odaları yönetici oda listesinde görünmez.
 */
import { describe, expect, it } from "vitest";
import { buildLive } from "./adminData.js";
import { BotKosucusu, MAC_SINIRI_MS } from "./botKosusu.js";
import { createManualClock, type ManualClock } from "./clock.js";
import { abortMatch, cancelWake, runTick, TICK_MS } from "./match.js";
import { createRuntime } from "./rooms.js";
import type { Runtime } from "./runtime.js";
import { k, useServer } from "./testkit.js";

const TOKEN = "kosu-test-anahtari-0123456789";

function kur(): { clock: ManualClock; rt: Runtime; kosucu: BotKosucusu } {
  const clock = createManualClock();
  const rt = createRuntime(clock);
  rt.botsEnabled = true;
  return { clock, rt, kosucu: new BotKosucusu(rt) };
}

/** Sunucu döngüsü gibi: saat TICK_MS ilerler, tick çalışır. */
function calistir(clock: ManualClock, rt: Runtime, bitti: () => boolean, enCokMs: number): void {
  const bas = clock.now();
  while (!bitti() && clock.now() - bas < enCokMs) {
    clock.advance(TICK_MS);
    runTick(rt);
  }
}

describe("koşu ve oda uçları canlıda ve test'te yok", () => {
  for (const ortam of ["canli", "test"] as const) {
    describe(ortam, () => {
      useServer({ uretimToken: TOKEN, ortam });
      it("GET/POST kosu ve oda 404", async () => {
        const istek = (method: string, yol: string, body?: unknown) =>
          fetch(`http://127.0.0.1:${k.srv.port}/api/uretim${yol}`, {
            method,
            headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          });
        expect((await istek("GET", "/kosu")).status).toBe(404);
        expect((await istek("POST", "/kosu", { oyunlar: ["butona-bas"], oyuncular: [3] })).status).toBe(404);
        expect((await istek("POST", "/kosu/k1/iptal", {})).status).toBe(404);
        expect((await istek("GET", "/oda")).status).toBe(404);
        expect((await istek("POST", "/oda", { oyun: "butona-bas", bot: 3 })).status).toBe(404);
        expect(k.srv).toBeDefined();
      });
    });
  }
});

describe("test2 uçları", () => {
  useServer({ uretimToken: TOKEN, ortam: "test2", oyunAlaniDir: null });
  it("koşu başlar, ikincisi reddedilir, iptal edilir; anahtarsız 401", async () => {
    const istek = async (method: string, yol: string, body?: unknown, yetki = true) => {
      const r = await fetch(`http://127.0.0.1:${k.srv.port}/api/uretim${yol}`, {
        method,
        headers: {
          ...(yetki ? { Authorization: `Bearer ${TOKEN}` } : {}),
          "Content-Type": "application/json",
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, data: (await r.json()) as Record<string, unknown> };
    };
    expect((await istek("GET", "/kosu", undefined, false)).status).toBe(401);
    expect((await istek("POST", "/kosu", { oyunlar: ["yok-boyle-oyun"] })).data.code).toBe("unknown_game");
    expect((await istek("POST", "/kosu", { oyunlar: ["butona-bas"], mac: 99 })).status).toBe(400);
    const r = await istek("POST", "/kosu", { oyunlar: ["butona-bas"], oyuncular: [3], mac: 2 });
    expect(r.status).toBe(200);
    const id = (r.data.kosu as { id: string }).id;
    expect((await istek("POST", "/kosu", { oyunlar: ["butona-bas"] })).data.code).toBe("run_active");
    const liste = await istek("GET", "/kosu");
    expect((liste.data.suren as { id: string }).id).toBe(id);
    const iptal = await istek("POST", `/kosu/${id}/iptal`, {});
    expect((iptal.data.kosu as { durum: string }).durum).toBe("iptal");
    expect((await istek("GET", `/kosu/${id}`)).data.kosu).toMatchObject({ id, durum: "iptal" });
    // Oyun alanı odası: aç, durumu oku, kapat.
    const oda = await istek("POST", "/oda", { oyun: "butona-bas", bot: 3 });
    expect(oda.status).toBe(200);
    const kod = (oda.data.oda as { kod: string }).kod;
    const d = await istek("GET", `/oda/${kod}`);
    expect(d.data.oda).toMatchObject({ kod, oyun: "butona-bas", durum: "oynaniyor" });
    expect((d.data.oda as { oyuncular: unknown[] }).oyuncular.length).toBe(3);
    expect((await istek("POST", `/oda/${kod}/kapat`, {})).status).toBe(200);
    expect((await istek("GET", `/oda/${kod}`)).status).toBe(404);
  });
});

describe("bot koşusu (sahte saat)", () => {
  it("2 oyun × 3 bot: maçlar biter, ölçümler toplanır, odalar kapanır", () => {
    const { clock, rt, kosucu } = kur();
    const r = kosucu.baslat({
      oyunlar: ["butona-bas", "kor-kronometre"],
      oyuncular: [3],
      mac: 1,
      sureDk: 60,
    });
    if (!r.ok) throw new Error(r.message);
    const id = r.deger.id;
    // Koşu odaları yönetici oda listesinde görünmez.
    expect(rt.rooms.size).toBe(2);
    const live = buildLive({
      rt,
      startedAt: 0,
      revision: "t",
      sockets: { total: 0, accounts: 0 },
      sampler: { cpuPercent: () => 0, eventLoopLagMsP95: () => 0, stop: () => {} },
    });
    expect(live.roomList).toEqual([]);
    // Aynı anda tek koşu.
    const ikinci = kosucu.baslat({ oyunlar: ["butona-bas"] });
    expect(ikinci.ok ? null : ikinci.code).toBe("run_active");
    calistir(clock, rt, () => kosucu.kosular().suren === null, 40 * 60_000);
    const s = kosucu.kosu(id);
    expect(s?.durum).toBe("bitti");
    expect(s?.maclar.map((m) => [m.oyun, m.oyuncu, m.durum])).toEqual([
      ["butona-bas", 3, "bitti"],
      ["kor-kronometre", 3, "bitti"],
    ]);
    for (const m of s?.maclar ?? []) {
      expect(m.skorlar).toHaveLength(3);
      expect(m.sureMs).toBeGreaterThan(0);
    }
    expect(Object.keys(s?.eylemler ?? {}).sort()).toEqual(["butona-bas", "kor-kronometre"]);
    expect(s?.eylemler["butona-bas"]?.n).toBeGreaterThan(0);
    expect(s?.ornekler.length).toBeGreaterThan(1);
    expect(s?.oyunHatalari).toEqual([]);
    clock.advance(10);
    expect([...rt.rooms.values()].filter((x) => x.botOdasi)).toHaveLength(0);
    // Bittikten sonra yeni koşu başlayabilir.
    expect(kosucu.baslat({ oyunlar: ["butona-bas"], oyuncular: [2] }).ok).toBe(true);
    kosucu.kapat();
  });

  it("iptal ve süre sınırı: açık odalar kapanır, bekleyen maçlar iptal sayılır", () => {
    const { clock, rt, kosucu } = kur();
    const r = kosucu.baslat({ oyunlar: ["butona-bas"], oyuncular: [3], mac: 5 });
    if (!r.ok) throw new Error(r.message);
    calistir(clock, rt, () => false, 5_000);
    expect(kosucu.iptal(r.deger.id)).toBe(true);
    expect(kosucu.iptal(r.deger.id)).toBe(false);
    const s = kosucu.kosu(r.deger.id);
    expect(s?.durum).toBe("iptal");
    expect(s?.maclar.every((m) => m.durum === "iptal")).toBe(true);
    expect([...rt.rooms.values()].filter((x) => x.botOdasi)).toHaveLength(0);

    const z = kosucu.baslat({ oyunlar: ["butona-bas"], oyuncular: [3], mac: 10, sureDk: 1 });
    if (!z.ok) throw new Error(z.message);
    calistir(clock, rt, () => kosucu.kosular().suren === null, 3 * 60_000);
    expect(kosucu.kosu(z.deger.id)?.durum).toBe("zaman_asimi");
  });

  it("takılan ve çöken maç bulguya dönecek biçimde kaydedilir", () => {
    const { clock, rt, kosucu } = kur();
    const r = kosucu.baslat({ oyunlar: ["butona-bas"], oyuncular: [3], mac: 2, sureDk: 60 });
    if (!r.ok) throw new Error(r.message);
    const [birinci, ikinci] = [...rt.rooms.values()];
    if (!birinci || !ikinci) throw new Error("oda");
    // Birinci oda: oyun hata verir (abortMatch, çöken oyun kaydı).
    abortMatch(rt, birinci, new Error("deneme çöküşü"));
    // İkinci oda: sunucu adımı durur (tick yok) → aşama ilerlemez, maç süre sınırında takılır.
    rt.active.delete(ikinci);
    cancelWake(ikinci);
    for (let t = 0; t < MAC_SINIRI_MS + 60_000 && kosucu.kosular().suren; t += 1_000) clock.advance(1_000);
    const s = kosucu.kosu(r.deger.id);
    expect(s?.maclar.map((m) => m.durum).sort()).toEqual(["coktu", "takildi"]);
    expect(s?.oyunHatalari[0]).toMatchObject({ oyun: "butona-bas", mesaj: "deneme çöküşü" });
    expect(s?.maclar.find((m) => m.durum === "takildi")?.takildigiAsama).toBeTruthy();
  });

  it("oyun alanı odası: maç biter, olay kaydı okunur, sınır aşılmaz", () => {
    const { clock, rt, kosucu } = kur();
    const o = kosucu.odaAc({ oyun: "butona-bas", bot: 4 });
    if (!o.ok) throw new Error(o.message);
    const kod = String(o.deger.kod);
    expect(kosucu.odaAc({ oyun: "butona-bas", bot: 99 }).ok).toBe(false);
    calistir(clock, rt, () => kosucu.oda(kod)?.durum === "bitti", 20 * 60_000);
    const d = kosucu.oda(kod, 200) as { olaylar: { metin: string }[]; asama: string };
    expect(d.asama).toBe("final");
    expect(d.olaylar.some((e) => /Maç bitti/.test(e.metin))).toBe(true);
    // En çok 4 yalnız-bot odası.
    const ek = [1, 2, 3].map(() => kosucu.odaAc({ oyun: "butona-bas", bot: 2 }));
    expect(ek.every((x) => x.ok)).toBe(true);
    const fazla = kosucu.odaAc({ oyun: "butona-bas", bot: 2 });
    expect(fazla.ok ? "" : fazla.code).toBe("limit");
    expect(kosucu.odaKapat(kod)).toBe(true);
    expect(rt.rooms.has(kod)).toBe(false);
    kosucu.kapat();
    expect([...rt.rooms.values()].filter((x) => x.botOdasi)).toHaveLength(0);
  });
});
