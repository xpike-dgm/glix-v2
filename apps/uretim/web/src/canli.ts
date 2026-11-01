/**
 * Canlı güncelleme istemcisi: `/api/olaylar` (Server-Sent Events). Sunucudaki her değişiklik (bu ya da başka bir
 * sekme/cihaz, yapay zekâ teslimi) kısa bir olay olarak gelir; ekranlar `olayDinle` ile ilgili verilerini yeniden
 * çeker. Bağlantı koparsa üstel bekleme ile yeniden bağlanır (1 sn → 60 sn); bağlanamazsa 20 sn'de bir yoklar.
 * Sekme görünür olunca ve ağ geri gelince hepsi tazelenir. Aynı sekmedeki işlemler ayrıca `yerelOlay` ile anında
 * bildirilir (sunucu onayı olayla gelir ve veriyi düzeltir).
 */
import { createSignal } from "solid-js";

export type OlayTuru =
  | "teslim"
  | "karar"
  | "geri_al"
  | "is"
  | "kilit"
  | "istek_karti"
  | "kod_istegi"
  | "aktarim"
  | "paket"
  | "uyari"
  | "ayar"
  /** Bağlantı yeniden kuruldu, sekme göründü ya da ağ geldi: her şey tazelenir. */
  | "tazele";

export interface CanliOlay {
  tur: OlayTuru;
  alan: string | null;
}

type Dinleyici = (o: CanliOlay) => void;

export const YOKLAMA_MS = 20_000;
const EN_KISA_BEKLEME = 1_000;
const EN_UZUN_BEKLEME = 60_000;
/** Peş peşe gelen olaylar tek yeniden çekmede birleşir. */
const BIRLESTIRME_MS = 250;

export type BaglantiDurumu = "kapali" | "baglaniyor" | "canli" | "yoklama";
export const [baglanti, setBaglanti] = createSignal<BaglantiDurumu>("kapali");

const dinleyiciler = new Set<{ turler: ReadonlySet<OlayTuru> | null; f: Dinleyici }>();

/**
 * Olay dinler (bir ya da birkaç tür; boşsa hepsi). `tazele` her dinleyiciye gider. Aynı dinleyiciye kısa sürede gelen
 * olaylar birleşir. Dinlemeyi bırakan işlev döner (bileşenin `onCleanup`'ında çağrılır).
 */
export function olayDinle(turler: readonly OlayTuru[] | null, f: Dinleyici): () => void {
  let zaman: ReturnType<typeof setTimeout> | undefined;
  let son: CanliOlay | null = null;
  const kayit = {
    turler: turler && turler.length ? new Set(turler) : null,
    f: (o: CanliOlay) => {
      son = son && son.tur !== o.tur ? { tur: "tazele", alan: null } : o;
      clearTimeout(zaman);
      zaman = setTimeout(() => {
        const x = son;
        son = null;
        if (x) f(x);
      }, BIRLESTIRME_MS);
    },
  };
  dinleyiciler.add(kayit);
  return () => {
    clearTimeout(zaman);
    dinleyiciler.delete(kayit);
  };
}

function dagit(o: CanliOlay): void {
  for (const d of dinleyiciler) if (o.tur === "tazele" || !d.turler || d.turler.has(o.tur)) d.f(o);
}

/** Aynı sekmedeki işlem: sunucu olayını beklemeden diğer ekranlar da güncellensin. */
export const yerelOlay = (tur: OlayTuru, alan: string | null = null): void => dagit({ tur, alan });

/** Sunucudan gelen ileti gövdesini doğrular. */
export function olayAyristir(veri: string): CanliOlay | null {
  try {
    const j = JSON.parse(veri) as { tur?: unknown; alan?: unknown };
    const turler: readonly string[] = [
      "teslim",
      "karar",
      "geri_al",
      "is",
      "kilit",
      "istek_karti",
      "kod_istegi",
      "aktarim",
      "paket",
      "uyari",
      "ayar",
    ];
    if (typeof j.tur !== "string" || !turler.includes(j.tur)) return null;
    return { tur: j.tur as OlayTuru, alan: typeof j.alan === "string" ? j.alan : null };
  } catch {
    return null;
  }
}

/** Üstel bekleme (±%20 pay ile): 1, 2, 4 … en çok 60 sn. */
export const beklemeSuresi = (deneme: number, rastgele = Math.random()): number =>
  Math.round(Math.min(EN_UZUN_BEKLEME, EN_KISA_BEKLEME * 2 ** Math.min(deneme, 6) * (0.8 + 0.4 * rastgele)));

let kaynak: EventSource | null = null;
let deneme = 0;
let yenidenZaman: ReturnType<typeof setTimeout> | undefined;
let yoklamaZaman: ReturnType<typeof setInterval> | undefined;
let calisiyor = false;

function yoklamaBaslat(): void {
  if (yoklamaZaman) return;
  setBaglanti("yoklama");
  yoklamaZaman = setInterval(() => dagit({ tur: "tazele", alan: null }), YOKLAMA_MS);
}

function yoklamaDurdur(): void {
  clearInterval(yoklamaZaman);
  yoklamaZaman = undefined;
}

function baglan(): void {
  clearTimeout(yenidenZaman);
  if (!calisiyor || kaynak) return;
  if (typeof EventSource === "undefined") {
    yoklamaBaslat();
    return;
  }
  setBaglanti(yoklamaZaman ? "yoklama" : "baglaniyor");
  const es = new EventSource("/api/olaylar");
  kaynak = es;
  es.addEventListener("hazir", () => {
    const kopmustu = deneme > 0 || yoklamaZaman !== undefined;
    deneme = 0;
    yoklamaDurdur();
    setBaglanti("canli");
    // Kopukken kaçan olaylar için bir kez tazele.
    if (kopmustu) dagit({ tur: "tazele", alan: null });
  });
  es.addEventListener("degisti", (e) => {
    const o = olayAyristir((e as MessageEvent<string>).data);
    if (o) dagit(o);
  });
  es.onerror = () => {
    // Tarayıcının kendi yeniden denemesi yerine üstel bekleme (oturum bitmişse sonsuza dek denemesin).
    es.close();
    if (kaynak === es) kaynak = null;
    deneme += 1;
    if (deneme >= 2) yoklamaBaslat();
    else setBaglanti("baglaniyor");
    yenidenZaman = setTimeout(baglan, beklemeSuresi(deneme));
  };
}

const gorununce = (): void => {
  if (document.visibilityState !== "visible") return;
  dagit({ tur: "tazele", alan: null });
  if (!kaynak) {
    deneme = 0;
    baglan();
  }
};
const agGelince = (): void => {
  dagit({ tur: "tazele", alan: null });
  kaynak?.close();
  kaynak = null;
  deneme = 0;
  baglan();
};

/** Oturum açılınca başlatılır (bir kez). */
export function canliBaslat(): void {
  if (calisiyor) return;
  calisiyor = true;
  document.addEventListener("visibilitychange", gorununce);
  window.addEventListener("online", agGelince);
  baglan();
}

export function canliDurdur(): void {
  calisiyor = false;
  kaynak?.close();
  kaynak = null;
  clearTimeout(yenidenZaman);
  yoklamaDurdur();
  document.removeEventListener("visibilitychange", gorununce);
  window.removeEventListener("online", agGelince);
  setBaglanti("kapali");
}
