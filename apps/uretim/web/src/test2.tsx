/**
 * Oyun alanı (test2) göstergeleri (sözleşme bölüm 13): teslim kartında ve incelemede "test2'de yüklü · geri al" şeridi
 * ve "test2'de aç" bağlantısı; panoda ve alan sayfasında test2 durumu (çalışıyor mu, sürüm, son sıfırlama).
 */
import { createSignal, type JSX, Show } from "solid-js";
import type { Test2Bilgisi, Test2Durum } from "../../src/ortak/oyunAlani.js";
import type { OgeOzeti } from "../../src/ortak/tipler.js";
import { gonder } from "./api.js";
import { goreliZaman } from "./bicim.js";
import { hataTost, tost } from "./durum.js";
import { Simge } from "./simgeler.js";

const ETIKET: Record<Test2Bilgisi["durum"], { metin: string; sinif: string }> = {
  yuklu: { metin: "test2'de yüklü", sinif: "etiket--gecti" },
  bekliyor: { metin: "test2'ye yükleniyor", sinif: "etiket--vurgu" },
  hata: { metin: "test2'ye yüklenemedi", sinif: "etiket--kaldi" },
  geri_alindi: { metin: "test2'den geri alındı", sinif: "" },
};

/** "test2'de aç" bağlantısı (yeni sekme). */
export function Test2Ac(p: { baglanti: string; kucuk?: boolean }): JSX.Element {
  return (
    <a
      class={`dg ${p.kucuk ? "dg--k" : ""} dg--hayalet test2-ac`}
      href={p.baglanti}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Simge ad="dis" /> test2'de aç
    </a>
  );
}

/**
 * Öğenin test2 şeridi: durum, kısa özet, "test2'de aç" ve geri al / yeniden yükle. `degisti` sunucunun döndürdüğü
 * yeni öğeyle çağrılır.
 */
export function Test2Seridi(p: {
  oge: OgeOzeti;
  degisti?: (o: OgeOzeti) => void;
  kucuk?: boolean;
}): JSX.Element {
  const [mesgul, setMesgul] = createSignal(false);
  const t = (): Test2Bilgisi | null => p.oge.test2 ?? null;
  const islem = async (yol: "test2-geri-al" | "test2-yukle"): Promise<void> => {
    setMesgul(true);
    try {
      const r = await gonder<{ oge: OgeOzeti }>(`oge/${p.oge.id}/${yol}`);
      tost(yol === "test2-geri-al" ? "test2'den geri alındı" : "test2'ye yeniden yüklendi");
      p.degisti?.(r.oge);
    } catch (e) {
      hataTost(e);
    } finally {
      setMesgul(false);
    }
  };
  return (
    <Show when={t()}>
      {(b) => (
        <div class="test2-serit" data-durum={b().durum} data-kucuk={p.kucuk ? "1" : undefined}>
          <span class={`etiket ${ETIKET[b().durum].sinif}`}>
            <Simge ad="katman" /> {ETIKET[b().durum].metin}
          </span>
          <Show when={!p.kucuk && (b().hata || b().ozet)}>
            <span class={`kucuk ${b().hata ? "test2-serit__hata" : "cok-soluk"}`}>
              {b().hata ?? b().ozet}
            </span>
          </Show>
          <span class="esnek" />
          <Show when={b().durum === "yuklu"}>
            <Test2Ac baglanti={b().baglanti} kucuk />
            <button
              type="button"
              class="dg dg--k dg--hayalet"
              disabled={mesgul()}
              onClick={(e) => {
                e.stopPropagation();
                void islem("test2-geri-al");
              }}
            >
              geri al
            </button>
          </Show>
          <Show when={b().durum === "hata" || b().durum === "geri_alindi"}>
            <button
              type="button"
              class="dg dg--k dg--hayalet"
              disabled={mesgul()}
              onClick={(e) => {
                e.stopPropagation();
                void islem("test2-yukle");
              }}
            >
              <Simge ad="tekrar" /> yeniden yükle
            </button>
          </Show>
        </div>
      )}
    </Show>
  );
}

/** Panoda ve alan sayfasında test2 durum kartı. */
export function Test2DurumKarti(p: { d: Test2Durum; esitlendi?: (d: Test2Durum) => void }): JSX.Element {
  const [mesgul, setMesgul] = createSignal(false);
  const esitle = async (): Promise<void> => {
    setMesgul(true);
    try {
      const r = await gonder<{ test2: Test2Durum }>("test2/esitle");
      tost(r.test2.calisiyor ? "test2 ile eşitlendi" : "test2'ye ulaşılamadı");
      p.esitlendi?.(r.test2);
    } catch (e) {
      hataTost(e);
    } finally {
      setMesgul(false);
    }
  };
  const simdi = Date.now();
  return (
    <section class="kart kart--ic test2-kart" data-calisiyor={p.d.calisiyor ? "1" : "0"}>
      <div class="test2-kart__bas">
        <span class="test2-kart__nokta" aria-hidden="true" />
        <strong>Oyun alanı (test2)</strong>
        <span class={`etiket ${p.d.ayarli ? (p.d.calisiyor ? "etiket--gecti" : "etiket--kaldi") : ""}`}>
          {p.d.ayarli ? (p.d.calisiyor ? "Çalışıyor" : "Ulaşılamıyor") : "Bağlı değil"}
        </span>
        <span class="esnek" />
        <Show when={p.d.ayarli}>
          <Test2Ac baglanti={p.d.baglanti} kucuk />
          <button
            type="button"
            class="dg dg--k dg--hayalet"
            disabled={mesgul()}
            onClick={() => void esitle()}
          >
            <Simge ad="tekrar" /> Eşitle
          </button>
        </Show>
      </div>
      <Show
        when={p.d.ayarli}
        fallback={
          <p class="cok-soluk kucuk">
            Teslimler test2'ye yüklenmiyor: sitede URETIM_TEST2_URL ve URETIM_TEST2_TOKEN ayarlı değil.
          </p>
        }
      >
        <dl class="test2-kart__bilgi">
          <div>
            <dt>Sürüm</dt>
            <dd class="mono">{p.d.revision ? p.d.revision.slice(0, 7) : "—"}</dd>
          </div>
          <div>
            <dt>Son sıfırlama</dt>
            <dd>{p.d.sonSifirlama ? goreliZaman(p.d.sonSifirlama, simdi) : "—"}</dd>
          </div>
          <div>
            <dt>Yüklü teslim</dt>
            <dd>{p.d.yuklu}</dd>
          </div>
          <div>
            <dt>Mağaza taslağı</dt>
            <dd>{p.d.taslak}</dd>
          </div>
          <Show when={p.d.hata > 0}>
            <div>
              <dt>Yüklenemeyen</dt>
              <dd class="test2-serit__hata">{p.d.hata}</dd>
            </div>
          </Show>
        </dl>
        <Show when={p.d.sorun}>
          <p class="kucuk test2-serit__hata">{p.d.sorun}</p>
        </Show>
        <Show when={p.d.sonDenetim}>
          {(z) => <p class="cok-soluk kucuk">Son denetim {goreliZaman(z(), simdi)}.</p>}
        </Show>
      </Show>
    </section>
  );
}
