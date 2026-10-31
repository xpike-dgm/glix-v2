/**
 * Oyunun gerçek bileşenleriyle önizleme (UM-U4, sözleşme bölüm 4): oyunun `onizleme.html` sayfası iframe içinde açılır.
 * Sayfa `{tur:"hazir", surum:1}` gönderince site `{tur:"goster", ...}` yollar; sayfa `cizildi` ya da `hata` döner.
 * İletiler yalnız önizleme kaynağından ve yalnız bu iframe'den kabul edilir; site de yalnız o kaynağa yollar.
 * Taslak dosyalar data: URL olarak gider (oyunun önbelleğine yazılmaz). Sayfa yoksa "önizleme henüz yok" denir.
 */
import { createSignal, type JSX, onCleanup, onMount, Show } from "solid-js";
import type { AlanId } from "../../../src/ortak/alanlar.js";
import type { OgeAyrinti } from "../../../src/ortak/tipler.js";
import { dosyaUrl } from "../api.js";
import { Simge } from "../simgeler.js";

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

async function dataUrl(url: string): Promise<string> {
  const r = await fetch(url, { credentials: "same-origin" });
  const b = await r.blob();
  return new Promise((res, rej) => {
    const f = new FileReader();
    f.onload = () => res(String(f.result));
    f.onerror = () => rej(new Error("okunamadı"));
    f.readAsDataURL(b);
  });
}

export async function gosterIletisi(o: OgeAyrinti, ekran: string): Promise<GosterIletisi> {
  const dosyalar: Record<string, string> = {};
  for (const d of o.dosyalar) if (d.hedefYol) dosyalar[d.hedefYol] = await dataUrl(dosyaUrl(o.id, d.ozet));
  const satir = o.satirlar[0];
  return {
    tur: "goster",
    ekran,
    ...(satir && typeof satir === "object" ? { katalogSatiri: satir } : {}),
    dosyalar,
    secenekler: { tema: "koyu" },
  };
}

export function OyunOnizleme(p: { oge: OgeAyrinti; url: string }): JSX.Element {
  const kaynak = ((): string => {
    try {
      return new URL(p.url).origin;
    } catch {
      return "";
    }
  })();
  const ekran = varsayilanEkran(p.oge);
  const [durum, setDurum] = createSignal<"bekliyor" | "hazir" | "cizildi" | "yok" | "hata">(ekran && kaynak ? "bekliyor" : "yok");
  const [neden, setNeden] = createSignal("");
  let cerceve: HTMLIFrameElement | undefined;
  let zaman: ReturnType<typeof setTimeout> | undefined;
  const dinle = (e: MessageEvent): void => {
    const i = iletiAyristir(e, kaynak, cerceve?.contentWindow);
    if (!i) return;
    if (i.tur === "hazir" && ekran) {
      clearTimeout(zaman);
      setDurum("hazir");
      void gosterIletisi(p.oge, ekran)
        .then((m) => cerceve?.contentWindow?.postMessage(m, kaynak))
        .catch(() => (setDurum("hata"), setNeden("Dosyalar hazırlanamadı.")));
    } else if (i.tur === "cizildi") setDurum("cizildi");
    else if (i.tur === "hata") {
      setDurum("hata");
      setNeden(i.neden);
    }
  };
  onMount(() => {
    window.addEventListener("message", dinle);
    zaman = setTimeout(() => {
      if (durum() === "bekliyor") setDurum("yok");
    }, HAZIR_BEKLEME_MS);
  });
  onCleanup(() => {
    window.removeEventListener("message", dinle);
    clearTimeout(zaman);
  });
  return (
    <div class="oyun-onizleme">
      <Show when={ekran && kaynak && durum() !== "yok"}>
        <iframe
          ref={cerceve}
          src={p.url}
          title="Oyun önizlemesi"
          class="oyun-onizleme__cerceve"
          classList={{ "oyun-onizleme__cerceve--hazir": durum() === "cizildi" }}
          sandbox="allow-scripts allow-same-origin"
          referrerpolicy="no-referrer"
          loading="lazy"
        />
      </Show>
      <Show when={durum() === "bekliyor" || durum() === "hazir"}>
        <div class="oyun-onizleme__durum">
          <span class="donen" aria-hidden="true" />
          {durum() === "bekliyor" ? "Oyun önizlemesi açılıyor…" : "Çiziliyor…"}
        </div>
      </Show>
      <Show when={durum() === "yok"}>
        <div class="bos">
          <div class="bos__simge">
            <Simge ad="incele" />
          </div>
          <h3>Önizleme henüz yok</h3>
          <p>{ekran ? "Oyunun önizleme sayfası yanıt vermedi. Sayfa eklenince burada oyundaki gerçek görünümü göreceksin." : "Bu tür için oyun içi önizleme ekranı yok."}</p>
        </div>
      </Show>
      <Show when={durum() === "hata"}>
        <div class="serit serit--sari">
          <Simge ad="uyari" />
          <span>Önizleme çizilemedi{neden() ? `: ${neden()}` : "."}</span>
        </div>
      </Show>
    </div>
  );
}
