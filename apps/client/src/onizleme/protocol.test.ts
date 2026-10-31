import { cosmeticItem } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { originAllowed, parsePreviewMessage, screenFits, URETIM_ORIGIN } from "./protocol.js";

const row = (over: Record<string, unknown> = {}) => ({
  ...(cosmeticItem("cerceve-galaksi") ?? {}),
  id: "cerceve-taslak",
  name: "Taslak",
  ...over,
});

describe("önizleme protokolü (UM-U4)", () => {
  it("kaynak: canlıda yalnız Üretim Merkezi; yerelde yerel kaynaklar", () => {
    expect(originAllowed(URETIM_ORIGIN, "glix.dgmcraft.online")).toBe(true);
    expect(originAllowed("http://localhost:5173", "glix.dgmcraft.online")).toBe(false);
    expect(originAllowed("https://kotu.example", "glix.dgmcraft.online")).toBe(false);
    expect(originAllowed("https://uretim.dgmcraft.online.kotu.example", "glix.dgmcraft.online")).toBe(false);
    expect(originAllowed("http://localhost:5173", "localhost")).toBe(true);
    expect(originAllowed("http://127.0.0.1:41000", "127.0.0.1")).toBe(true);
    expect(originAllowed("http://127.0.0.2:41000", "127.0.0.1")).toBe(false);
    expect(originAllowed("null", "localhost")).toBe(false);
  });

  it("goster iletisi doğrulanır: ekran, satır, dosyalar, seçenekler", () => {
    const ok = parsePreviewMessage({
      tur: "goster",
      ekran: "magaza-kart",
      katalogSatiri: row(),
      dosyalar: { "apps/client/public/assets/shop/cerceve/x.webp": "data:image/webp;base64,AAAA" },
      secenekler: { tema: "koyu" },
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.req.items[0]?.id).toBe("cerceve-taslak");
      expect([...ok.req.files.keys()]).toEqual(["/assets/shop/cerceve/x.webp"]);
    }
    const bad = (m: Record<string, unknown>) => parsePreviewMessage({ tur: "goster", ...m }).ok;
    expect(bad({ ekran: "yok" })).toBe(false);
    expect(bad({ ekran: "magaza-kart" })).toBe(false); // satır gerekli
    expect(bad({ ekran: "magaza-kart", katalogSatiri: row({ price: 1 }) })).toBe(false);
    expect(
      bad({ ekran: "magaza-kart", katalogSatiri: row(), dosyalar: { "/assets/a/b.webp": "https://x/y" } }),
    ).toBe(false);
    expect(
      bad({
        ekran: "magaza-kart",
        katalogSatiri: row(),
        dosyalar: { "/index.html": "data:image/png;base64,A" },
      }),
    ).toBe(false);
    expect(bad({ ekran: "magaza-kart", katalogSatiri: row(), secenekler: { tema: "acik" } })).toBe(false);
    expect(bad({ ekran: "oyun-ani", secenekler: { oyun: "kule-ustasi" } })).toBe(false);
    expect(bad({ ekran: "oyun-ani", secenekler: { oyun: "kule-ustasi", an: "oyun" } })).toBe(true);
    expect(bad({ ekran: "ses-ani", secenekler: { oyun: "kule-ustasi" } })).toBe(true);
    expect(parsePreviewMessage({ tur: "baska" }).ok).toBe(false);
    expect(parsePreviewMessage(null).ok).toBe(false);
  });

  it("ekran ve tür uyumu", () => {
    expect(screenFits("kursu", "dans")).toBe(true);
    expect(screenFits("kursu", "cerceve")).toBe(false);
    expect(screenFits("avatar-lobi", "cerceve")).toBe(true);
    expect(screenFits("zafer", "zafer")).toBe(true);
    expect(screenFits("kart-arkasi", "giris")).toBe(false);
  });
});
