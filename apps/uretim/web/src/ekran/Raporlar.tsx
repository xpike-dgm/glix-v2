/**
 * Raporlar (Üretim Merkezi 2): bütün alanların rapor teslimleri. Yapılandırılmış rapor grafikli panoda (özet
 * kutucukları, çizgi/çubuk grafikler, tablolar, bulgular), önceki raporla karşılaştırılarak; eski düz metin raporlar
 * basit kart. Bulgudan tek tıkla iş açılır. Canlı: yeni rapor gelince liste kendiliğinden yenilenir.
 */
import { createMemo, createResource, createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import { yapiliRaporMu } from "../../../src/ortak/rapor.js";
import type { OgeAyrinti } from "../../../src/ortak/tipler.js";
import { al } from "../api.js";
import { tarihSaat } from "../bicim.js";
import { AlanIsareti, Bos, IskeletKartlar } from "../bilesenler.js";
import { olayDinle } from "../canli.js";
import { alanBul, git, sorgu } from "../durum.js";
import { RaporSahne } from "../onizleme/Sahneler.js";

export function Raporlar(): JSX.Element {
  const [veri, { refetch }] = createResource(() => al<{ raporlar: OgeAyrinti[] }>("raporlar"));
  onCleanup(olayDinle(["teslim", "karar"], () => void refetch()));
  const [alan, setAlan] = createSignal<string | null>(sorgu().get("alan"));
  const [seciliId, setSeciliId] = createSignal<number | null>(Number(sorgu().get("rapor")) || null);
  const tum = (): OgeAyrinti[] => veri()?.raporlar ?? [];
  const alanlar = createMemo(() => [...new Set(tum().map((r) => r.alan))]);
  const liste = createMemo(() => tum().filter((r) => !alan() || r.alan === alan()));
  const rapor = (): OgeAyrinti | undefined => liste().find((r) => r.id === seciliId()) ?? liste()[0];
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
                  </button>
                )}
              </For>
            </aside>
            <section class="kart kart--ic rapor-alani">
              <Show when={rapor()} keyed>
                {(r) => <RaporSahne oge={r} gecmis={tum()} />}
              </Show>
            </section>
          </div>
        </Show>
      </Show>
    </div>
  );
}
