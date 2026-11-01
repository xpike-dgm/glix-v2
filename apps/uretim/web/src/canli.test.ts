/** Canlı güncelleme istemcisi: yeniden bağlanma (üstel bekleme), yoklama yedeği, görünürlük/ağ tazelemesi. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class SahteKaynak {
  static hepsi: SahteKaynak[] = [];
  dinleyiciler = new Map<string, (e: { data: string }) => void>();
  onerror: (() => void) | null = null;
  kapali = false;
  constructor(readonly url: string) {
    SahteKaynak.hepsi.push(this);
  }
  addEventListener(t: string, f: (e: { data: string }) => void): void {
    this.dinleyiciler.set(t, f);
  }
  close(): void {
    this.kapali = true;
  }
  hazir(): void {
    this.dinleyiciler.get("hazir")?.({ data: "{}" });
  }
  olay(veri: unknown): void {
    this.dinleyiciler.get("degisti")?.({ data: JSON.stringify(veri) });
  }
  hata(): void {
    this.onerror?.();
  }
}

const olaylar = new Map<string, () => void>();
const gorunur = "visible";

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  SahteKaynak.hepsi = [];
  olaylar.clear();
  vi.stubGlobal("EventSource", SahteKaynak);
  vi.stubGlobal("document", {
    get visibilityState() {
      return gorunur;
    },
    addEventListener: (t: string, f: () => void) => olaylar.set(t, f),
    removeEventListener: (t: string) => olaylar.delete(t),
  });
  vi.stubGlobal("window", {
    addEventListener: (t: string, f: () => void) => olaylar.set(t, f),
    removeEventListener: (t: string) => olaylar.delete(t),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("canlı istemci", () => {
  it("olayı dinleyene iletir; kısa sürede gelenleri birleştirir; geçersiz ileti yok sayılır", async () => {
    const c = await import("./canli.js");
    const gelen: string[] = [];
    const birak = c.olayDinle(["karar"], (o) => gelen.push(`${o.tur}:${o.alan}`));
    c.canliBaslat();
    const es = SahteKaynak.hepsi[0];
    es?.hazir();
    expect(c.baglanti()).toBe("canli");
    es?.olay({ tur: "karar", alan: "magaza" });
    es?.olay({ tur: "karar", alan: "magaza" });
    es?.olay({ tur: "teslim", alan: "magaza" }); // bu dinleyicinin türü değil
    es?.olay({ tur: "<script>", alan: 1 });
    await vi.advanceTimersByTimeAsync(300);
    expect(gelen).toEqual(["karar:magaza"]);
    birak();
    c.canliDurdur();
  });

  it("koparsa üstel beklemeyle yeniden bağlanır; ikinci kopuşta 20 sn yoklama; bağlanınca tazeler", async () => {
    const c = await import("./canli.js");
    const gelen: string[] = [];
    c.olayDinle(null, (o) => gelen.push(o.tur));
    c.canliBaslat();
    SahteKaynak.hepsi[0]?.hazir();
    SahteKaynak.hepsi[0]?.hata();
    expect(SahteKaynak.hepsi[0]?.kapali).toBe(true);
    expect(c.baglanti()).toBe("baglaniyor");
    await vi.advanceTimersByTimeAsync(c.beklemeSuresi(1, 1) + 10);
    expect(SahteKaynak.hepsi).toHaveLength(2);
    SahteKaynak.hepsi[1]?.hata();
    expect(c.baglanti()).toBe("yoklama");
    // Yoklama: 20 sn'de bir tazele.
    await vi.advanceTimersByTimeAsync(c.YOKLAMA_MS + 300);
    expect(gelen).toContain("tazele");
    gelen.length = 0;
    await vi.advanceTimersByTimeAsync(c.beklemeSuresi(2, 1));
    const son = SahteKaynak.hepsi.at(-1);
    son?.hazir();
    expect(c.baglanti()).toBe("canli");
    await vi.advanceTimersByTimeAsync(300);
    expect(gelen).toEqual(["tazele"]);
    c.canliDurdur();
  });

  it("bekleme 1 sn'den başlar, 60 sn'yi geçmez", async () => {
    const c = await import("./canli.js");
    expect(c.beklemeSuresi(0, 0.5)).toBe(1000);
    expect(c.beklemeSuresi(3, 0.5)).toBe(8000);
    expect(c.beklemeSuresi(20, 1)).toBe(60_000);
    expect(c.beklemeSuresi(20, 0.5)).toBe(60_000);
  });

  it("sekme görünür olunca ve ağ gelince tazeler", async () => {
    const c = await import("./canli.js");
    const gelen: string[] = [];
    c.olayDinle(["karar"], (o) => gelen.push(o.tur));
    c.canliBaslat();
    SahteKaynak.hepsi[0]?.hazir();
    olaylar.get("visibilitychange")?.();
    await vi.advanceTimersByTimeAsync(300);
    olaylar.get("online")?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(gelen).toEqual(["tazele", "tazele"]);
    c.canliDurdur();
  });
});
