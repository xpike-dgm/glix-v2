/** Rapor sayfası (UM-U9): test, hata ve performans alanının raporları; "Düzelt" yöneticiye iş açar. */
import { createResource, createSignal, For, type JSX, Show } from "solid-js";
import type { OgeAyrinti } from "../../../src/ortak/tipler.js";
import { al } from "../api.js";
import { tarihSaat } from "../bicim.js";
import { Bos, IskeletKartlar } from "../bilesenler.js";
import { RaporSahne } from "../onizleme/Sahneler.js";

export function Raporlar(): JSX.Element {
  const [veri] = createResource(() => al<{ raporlar: OgeAyrinti[] }>("raporlar"));
  const [secili, setSecili] = createSignal(0);
  const rapor = (): OgeAyrinti | undefined => veri()?.raporlar[secili()];
  return (
    <div class="sayfa">
      <header class="sayfa__bas">
        <div>
          <h1>Raporlar</h1>
          <p class="soluk">Gece testleri, hata kartları ve performans eğilimi. Bir sorunu düzelttirmek için “Düzelt”e dokun.</p>
        </div>
      </header>
      <Show when={!veri.loading} fallback={<IskeletKartlar adet={2} y="160px" />}>
        <Show when={veri()?.raporlar.length} fallback={<Bos simge="rapor" baslik="Henüz rapor yok">Test ve Performans alanı ilk raporunu teslim edince burada görünür.</Bos>}>
          <div class="rapor-duzen">
            <aside class="kart rapor-listesi">
              <For each={veri()?.raporlar}>
                {(r, i) => (
                  <button type="button" class="rapor-listesi__oge" aria-pressed={i() === secili()} onClick={() => setSecili(i())}>
                    <strong class="tasma">{r.ad}</strong>
                    <span class="cok-soluk kucuk">{tarihSaat(r.olusturma)}</span>
                  </button>
                )}
              </For>
            </aside>
            <section class="kart kart--ic">
              <Show when={rapor()}>{(r) => <RaporSahne oge={r()} />}</Show>
            </section>
          </div>
        </Show>
      </Show>
    </div>
  );
}
