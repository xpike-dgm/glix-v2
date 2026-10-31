/** Önizleme sayfası protokolü (sözleşme bölüm 4): saf işlevler, testli. */
import type { AlanId } from "../../../src/ortak/alanlar.js";
import type { OgeAyrinti } from "../../../src/ortak/tipler.js";

export const ONIZLEME_SURUMU = 1;
export const HAZIR_BEKLEME_MS = 6000;

const VARSAYILAN_EKRAN: Partial<Record<AlanId, string>> = {
  magaza: "magaza-kart",
  ses: "ses-ani",
  muzik: "oyun-ani",
  rozet: "koleksiyon",
  kartlar: "oyun-ani",
  efekt: "oyun-ani",
};

export function varsayilanEkran(o: Pick<OgeAyrinti, "alan" | "onizleme">): string | null {
  return o.onizleme?.ekran ?? VARSAYILAN_EKRAN[o.alan] ?? null;
}

export interface GosterIletisi {
  tur: "goster";
  ekran: string;
  katalogSatiri?: object;
  dosyalar: Record<string, string>;
  secenekler: { tema: "koyu"; oyun?: string; an?: string };
}

/** Gelen iletiyi doğrular: yalnız beklenen kaynak, kaynak pencere ve biçim. */
export function iletiAyristir(
  e: { origin: string; source: unknown; data: unknown },
  beklenenKaynak: string,
  pencere: unknown,
): { tur: "hazir" } | { tur: "cizildi"; w: number; h: number } | { tur: "hata"; neden: string } | null {
  if (e.origin !== beklenenKaynak || e.source !== pencere || !e.data || typeof e.data !== "object") return null;
  const d = e.data as Record<string, unknown>;
  if (d.tur === "hazir" && d.surum === ONIZLEME_SURUMU) return { tur: "hazir" };
  if (d.tur === "cizildi" && d.boyut && typeof d.boyut === "object") {
    const b = d.boyut as Record<string, unknown>;
    if (typeof b.w === "number" && typeof b.h === "number") return { tur: "cizildi", w: b.w, h: b.h };
  }
  if (d.tur === "hata") return { tur: "hata", neden: typeof d.neden === "string" ? d.neden.slice(0, 200) : "" };
  return null;
}

