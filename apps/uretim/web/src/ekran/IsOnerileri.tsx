/**
 * "Ne iş vereyim?" (iş önerisi): İş iste formunda alan için 5–6 hazır iş önerisi kart olarak gelir. Karta dokununca
 * metin istek kutusuna yazılır (sahip düzenleyebilir); ilgili onaylı fikir varsa "onaylananları uygula" o fikirlerle
 * işaretlenir. "Başka öner" önbelleği atlar ve az önce gösterilenlerden farklı öneri ister.
 */

import { createSignal, For, type JSX, Show } from "solid-js";
import type { AlanId } from "../../../src/ortak/alanlar.js";
import { gonder } from "../api.js";
import { Iskelet } from "../bilesenler.js";
import { titret } from "../durum.js";
import { Simge } from "../simgeler.js";

export interface IsOnerisi {
  baslik: string;
  metin: string;
  neden: string;
  fikirler: number[];
}
interface OneriYaniti {
  oneriler: IsOnerisi[];
  kaynak: "model" | "sabit";
}

/** Sunucudan gelen yanıtı doğrular (bozuk öğe düşer). */
export function oneriYanitiOku(v: unknown): OneriYaniti | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as { oneriler?: unknown; kaynak?: unknown };
  if (!Array.isArray(r.oneriler) || (r.kaynak !== "model" && r.kaynak !== "sabit")) return null;
  const oneriler = r.oneriler.filter(
    (o): o is IsOnerisi =>
      typeof o === "object" &&
      o !== null &&
      typeof (o as IsOnerisi).baslik === "string" &&
      typeof (o as IsOnerisi).metin === "string" &&
      typeof (o as IsOnerisi).neden === "string" &&
      Array.isArray((o as IsOnerisi).fikirler) &&
      (o as IsOnerisi).fikirler.every((x) => Number.isInteger(x) && x > 0),
  );
  return { oneriler, kaynak: r.kaynak };
}

export function IsOnerileri(p: {
  alan: AlanId;
  sec: (o: IsOnerisi) => void;
  kapat: () => void;
}): JSX.Element {
  const [veri, setVeri] = createSignal<OneriYaniti | null>(null);
  const [yukleniyor, setYukleniyor] = createSignal(false);
  const [hata, setHata] = createSignal(false);
  const [secili, setSecili] = createSignal<string | null>(null);
  let sira = 0;

  const getir = async (yeni: boolean): Promise<void> => {
    const benim = ++sira;
    const alan = p.alan;
    setYukleniyor(true);
    setHata(false);
    try {
      const r = oneriYanitiOku(await gonder<unknown>(`alan/${alan}/is-onerisi`, yeni ? { yeni: true } : {}));
      if (benim !== sira) return;
      if (r?.oneriler.length) {
        setVeri(r);
        setSecili(null);
      } else setHata(true);
    } catch {
      if (benim === sira) setHata(true);
    } finally {
      if (benim === sira) setYukleniyor(false);
    }
  };
  void getir(false);

  return (
    <section class="is-onerileri" aria-label="İş önerileri" aria-busy={yukleniyor()}>
      <div class="satir satir--ara">
        <strong>Bu alana verebileceğin işler</strong>
        <button type="button" class="dg-simge" onClick={() => p.kapat()} aria-label="Önerileri kapat">
          <Simge ad="kapat" boyut={16} />
        </button>
      </div>
      <Show when={veri()?.kaynak === "sabit" && !yukleniyor()}>
        <p class="kucuk soluk">Hazır öneri listesinden getirildi; istersen dokunup kendine göre düzenle.</p>
      </Show>
      <Show when={hata() && !yukleniyor()}>
        <p class="kucuk soluk">Öneriler şu an getirilemedi. Biraz sonra yeniden dene.</p>
      </Show>
      <div class="fikir-izgara">
        <Show
          when={!yukleniyor()}
          fallback={
            <For each={[0, 1, 2]}>
              {() => (
                <div class="fikir-karti" aria-hidden="true">
                  <div class="fikir-karti__govde">
                    <Iskelet g="55%" y="16px" />
                    <Iskelet />
                    <Iskelet g="80%" />
                  </div>
                </div>
              )}
            </For>
          }
        >
          <For each={veri()?.oneriler ?? []}>
            {(o) => (
              <article class="fikir-karti" classList={{ "fikir-karti--secili": secili() === o.baslik }}>
                <button
                  type="button"
                  class="fikir-karti__govde is-onerisi__dugme"
                  onClick={() => {
                    setSecili(o.baslik);
                    titret(8);
                    p.sec(o);
                  }}
                >
                  <Show when={o.fikirler.length}>
                    <span class="fikir-karti__ust">
                      <span class="fikir-karti__kategori">
                        {o.fikirler.length === 1 ? "1 onaylı fikir" : `${o.fikirler.length} onaylı fikir`}
                      </span>
                    </span>
                  </Show>
                  <strong class="fikir-karti__baslik">{o.baslik}</strong>
                  <span class="fikir-karti__ozet">{o.metin}</span>
                  <span class="kucuk cok-soluk">{o.neden}</span>
                  <span class="kucuk is-onerisi__kullan">
                    {secili() === o.baslik ? "İstek kutusuna yazıldı" : "Dokun, istek kutusuna yazılsın"}
                  </span>
                </button>
              </article>
            )}
          </For>
        </Show>
      </div>
      <button type="button" class="dg" disabled={yukleniyor()} onClick={() => void getir(true)}>
        <Simge ad="tekrar" /> Başka öner
      </button>
    </section>
  );
}
