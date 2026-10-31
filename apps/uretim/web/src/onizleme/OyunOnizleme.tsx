/**
 * Oyunun gerçek bileşenleriyle önizleme (UM-U4, sözleşme bölüm 4): oyunun `onizleme.html` sayfası iframe içinde açılır.
 * Sayfa `{tur:"hazir", surum:1}` gönderince site `{tur:"goster", ...}` yollar; sayfa `cizildi` ya da `hata` döner.
 * İletiler yalnız önizleme kaynağından ve yalnız bu iframe'den kabul edilir; site de yalnız o kaynağa yollar.
 * Taslak dosyalar data: URL olarak gider (oyunun önbelleğine yazılmaz). Sayfa yoksa "önizleme henüz yok" denir.
 */
import { createSignal, type JSX, onCleanup, onMount, Show } from "solid-js";
import type { OgeAyrinti } from "../../../src/ortak/tipler.js";
import { dosyaUrl } from "../api.js";
import { Simge } from "../simgeler.js";
import { type GosterIletisi, HAZIR_BEKLEME_MS, iletiAyristir, varsayilanEkran } from "./protokol.js";

export { iletiAyristir, varsayilanEkran } from "./protokol.js";

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
  // Sözleşme: tek satır nesne, birden çok satır dizi (en çok 12; ilki ekranın ürünü).
  const satirlar = o.satirlar.filter((x): x is object => typeof x === "object" && x !== null).slice(0, 12);
  return {
    tur: "goster",
    ekran,
    ...(satirlar.length > 1
      ? { katalogSatiri: satirlar }
      : satirlar[0]
        ? { katalogSatiri: satirlar[0] }
        : {}),
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
  const [durum, setDurum] = createSignal<"bekliyor" | "hazir" | "cizildi" | "yok" | "hata">(
    ekran && kaynak ? "bekliyor" : "yok",
  );
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
        .catch(() => {
          setDurum("hata");
          setNeden("Dosyalar hazırlanamadı.");
        });
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
          <p>
            {ekran
              ? "Oyunun önizleme sayfası yanıt vermedi. Sayfa eklenince burada oyundaki gerçek görünümü göreceksin."
              : "Bu tür için oyun içi önizleme ekranı yok."}
          </p>
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
