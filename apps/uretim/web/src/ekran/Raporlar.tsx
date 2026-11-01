/**
 * Raporlar (Üretim Merkezi 2): bütün alanların rapor teslimleri. Yapılandırılmış rapor grafikli panoda (özet
 * kutucukları, çizgi/çubuk grafikler, tablolar, bulgular), önceki raporla karşılaştırılarak; eski düz metin raporlar
 * basit kart. Bulgudan tek tıkla iş açılır. Canlı: yeni rapor gelince liste kendiliğinden yenilenir.
 */
import { createMemo, createResource, createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import { yapiliRaporMu } from "../../../src/ortak/rapor.js";
import type { OgeAyrinti } from "../../../src/ortak/tipler.js";
import { al } from "../api.js";
import { sure, tarihSaat } from "../bicim.js";
import { AlanIsareti, Bos, IskeletKartlar } from "../bilesenler.js";
import { olayDinle } from "../canli.js";
import { alanBul, git, sorgu } from "../durum.js";
import { RaporSahne } from "../onizleme/Sahneler.js";
import { Simge } from "../simgeler.js";

/** Bot koşusundan gelen raporun koşu ayrıntısı (api `raporlar`; sözleşme bölüm 14). */
interface KosuBilgisi {
  id: number;
  istek: { oyunlar: string[]; oyuncular: number[]; mac: number };
  ozet: { mac: number; biten: number; takilan: number; coken: number; sureMs: number | null } | null;
}
type RaporOgesi = OgeAyrinti & { kosu?: KosuBilgisi };

/** Rapor kartında "Bot koşusu" şeridi: oyunlar, maçlar, süre. */
function KosuSeridi(p: { k: KosuBilgisi }): JSX.Element {
  return (
    <span class="kosu-seridi">
      <span class="etiket etiket--vurgu">
        <Simge ad="oynat" /> Bot koşusu
      </span>
      <span class="cok-soluk kucuk">
        {p.k.istek.oyunlar.length} oyun · {p.k.ozet?.mac ?? 0} maç
        {p.k.ozet?.takilan ? ` · ${p.k.ozet.takilan} takıldı` : ""}
        {p.k.ozet?.coken ? ` · ${p.k.ozet.coken} çöktü` : ""}
        {p.k.ozet?.sureMs ? ` · ${sure(p.k.ozet.sureMs)}` : ""}
      </span>
    </span>
  );
}

export function Raporlar(): JSX.Element {
  const [veri, { refetch }] = createResource(() => al<{ raporlar: RaporOgesi[] }>("raporlar"));
  onCleanup(olayDinle(["teslim", "karar"], () => void refetch()));
  const [alan, setAlan] = createSignal<string | null>(sorgu().get("alan"));
  const [seciliId, setSeciliId] = createSignal<number | null>(Number(sorgu().get("rapor")) || null);
  const tum = (): RaporOgesi[] => veri()?.raporlar ?? [];
  const alanlar = createMemo(() => [...new Set(tum().map((r) => r.alan))]);
  const liste = createMemo(() => tum().filter((r) => !alan() || r.alan === alan()));
  const rapor = (): RaporOgesi | undefined => liste().find((r) => r.id === seciliId()) ?? liste()[0];
  const sec = (id: number): void => {
    setSeciliId(id);
    git(`/raporlar?rapor=${id}${alan() ? `&alan=${alan()}` : ""}`, true);
  };
  return (
    <div class="sayfa sayfa--genis">
      <header class="sayfa__bas">
        <div>
          <h1>Raporlar</h1>
          <p class="soluk">
            Test, performans, moderasyon ve içerik raporları; önceki raporla karşılaştırmalı.
          </p>
        </div>
      </header>
      <Show when={!veri.loading || veri()} fallback={<IskeletKartlar adet={2} y="160px" />}>
        <Show
          when={tum().length}
          fallback={
            <Bos simge="rapor" baslik="Henüz rapor yok">
              Bir alan "rapor" türünde teslim yapınca burada grafikli pano olarak görünür.
            </Bos>
          }
        >
          <Show when={alanlar().length > 1}>
            <fieldset class="cipler" aria-label="Alan">
              <button type="button" class="cip" aria-pressed={!alan()} onClick={() => setAlan(null)}>
                Hepsi
              </button>
              <For each={alanlar()}>
                {(a) => (
                  <button type="button" class="cip" aria-pressed={alan() === a} onClick={() => setAlan(a)}>
                    {alanBul(a)?.ad ?? a}
                  </button>
                )}
              </For>
            </fieldset>
          </Show>
          <div class="rapor-duzen">
            <aside class="kart rapor-listesi" aria-label="Raporlar">
              <For each={liste()}>
                {(r) => (
                  <button
                    type="button"
                    class="rapor-listesi__oge"
                    aria-pressed={rapor()?.id === r.id}
                    onClick={() => sec(r.id)}
                  >
                    <strong class="tasma">{r.ad}</strong>
                    <span class="satir kucuk">
                      <AlanIsareti alan={r.alan} kisa />
                      <span class="cok-soluk">{tarihSaat(r.olusturma)}</span>
                      <Show when={!yapiliRaporMu(r.rapor)}>
                        <span class="cok-soluk">· metin</span>
                      </Show>
                    </span>
                    <Show when={r.kosu}>{(k) => <KosuSeridi k={k()} />}</Show>
                  </button>
                )}
              </For>
            </aside>
            <section class="kart kart--ic rapor-alani">
              <Show when={rapor()} keyed>
                {(r) => (
                  <>
                    <Show when={r.kosu}>
                      {(k) => (
                        <div class="kosu-ayrinti">
                          <KosuSeridi k={k()} />
                          <span class="cok-soluk kucuk">
                            Oyunlar: {k().istek.oyunlar.join(", ")} · oyuncu{" "}
                            {k().istek.oyuncular.join("/") || "oyuna göre"} · {k().istek.mac} maç/birleşim
                          </span>
                        </div>
                      )}
                    </Show>
                    <RaporSahne oge={r} gecmis={tum()} />
                  </>
                )}
              </Show>
            </section>
          </div>
        </Show>
      </Show>
    </div>
  );
}
