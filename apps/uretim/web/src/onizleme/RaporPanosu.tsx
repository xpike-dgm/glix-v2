/**
 * Rapor panosu (Üretim Merkezi 2): yapılandırılmış rapor (ozet kutucukları, seriler, tablolar, bulgular) grafiklerle;
 * önceki raporla karşılaştırma (kutucuk farkı, önceki seri, yeni/çözülen bulgular) ve raporlar boyunca gidişat.
 * Bulgu tek tıkla iş olur (İş iste ekranı alanı ve metni doldurulmuş açılır; başka alan da seçilebilir).
 */
import { createMemo, createSignal, For, type JSX, Show } from "solid-js";
import {
  ONEM_ADI,
  ONEMLER,
  type Onem,
  type RaporBulgu,
  type RaporKutucuk,
  type YapiliRapor,
  yapiliRaporMu,
} from "../../../src/ortak/rapor.js";
import type { OgeAyrinti } from "../../../src/ortak/tipler.js";
import { tarihSaat } from "../bicim.js";
import { git } from "../durum.js";
import { Simge } from "../simgeler.js";
import { Grafik, sayiBicimi } from "./Grafik.js";
import { bulguFarki, kutucukFarki, raporOku } from "./raporHesap.js";

export { raporOku } from "./raporHesap.js";

const ONEM_SINIFI: Record<Onem, string> = {
  kritik: "etiket--kaldi",
  yuksek: "etiket--kaldi",
  orta: "etiket--uyari",
  dusuk: "",
};

function Kutucuk(p: { k: RaporKutucuk; onceki: YapiliRapor | null; gidisat: number[] }): JSX.Element {
  const f = (): ReturnType<typeof kutucukFarki> => kutucukFarki(p.k, p.onceki);
  return (
    <div class="rk">
      <span class="rk__ad">{p.k.ad}</span>
      <span class="rk__deger">
        {sayiBicimi(p.k.deger)}
        <Show when={p.k.birim}>
          <small> {p.k.birim}</small>
        </Show>
      </span>
      <Show when={f()} fallback={<span class="rk__fark cok-soluk">İlk ölçüm</span>}>
        {(x) => (
          <span
            class="rk__fark"
            classList={{ "rk__fark--iyi": x().iyi === true, "rk__fark--kotu": x().iyi === false }}
            title={`Önceki: ${sayiBicimi(x().onceki)}`}
          >
            {x().fark > 0 ? "▲" : x().fark < 0 ? "▼" : "■"} {sayiBicimi(Math.abs(x().fark))}
            <span class="cok-soluk"> · önceki {sayiBicimi(x().onceki)}</span>
          </span>
        )}
      </Show>
      <Show when={p.gidisat.length >= 3}>
        <Gidisat degerler={p.gidisat} />
      </Show>
    </div>
  );
}

/** Raporlar boyunca küçük gidişat çizgisi (en eski solda). */
function Gidisat(p: { degerler: number[] }): JSX.Element {
  const enk = (): number => Math.min(...p.degerler);
  const enb = (): number => Math.max(...p.degerler, enk() + 1e-9);
  const nokta = (): string =>
    p.degerler
      .map(
        (v, i) =>
          `${((i / (p.degerler.length - 1)) * 100).toFixed(1)},${(22 - ((v - enk()) / (enb() - enk())) * 20).toFixed(1)}`,
      )
      .join(" ");
  return (
    <svg
      class="rk__gidisat"
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      aria-label="Raporlar boyunca gidişat"
    >
      <polyline points={nokta()} fill="none" vector-effect="non-scaling-stroke" />
    </svg>
  );
}

function BulguKarti(p: { b: RaporBulgu; yeni: boolean; alan: string }): JSX.Element {
  const [acik, setAcik] = createSignal(false);
  const isMetni = (): string =>
    [
      `Bulgu (${ONEM_ADI[p.b.onem]}${p.b.oyun ? `, ${p.b.oyun}` : ""}): ${p.b.baslik}`,
      p.b.adimlar?.length ? `Adımlar: ${p.b.adimlar.join(" → ")}` : "",
      p.b.kanit ? `Kanıt: ${p.b.kanit}` : "",
      p.b.oneri ? `Öneri: ${p.b.oneri}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1900);
  const isAc = (): void => git(`/iste?alan=${p.alan}&metin=${encodeURIComponent(isMetni())}`);
  return (
    <article class={`bulgu bulgu--${p.b.onem}`}>
      <div class="bulgu__bas">
        <span class={`etiket ${ONEM_SINIFI[p.b.onem]}`}>{ONEM_ADI[p.b.onem]}</span>
        <Show when={p.yeni}>
          <span class="etiket etiket--vurgu">Yeni</span>
        </Show>
        <Show when={p.b.oyun}>
          <span class="cok-soluk kucuk">{p.b.oyun}</span>
        </Show>
        <Show when={p.b.siklik !== undefined}>
          <span class="cok-soluk kucuk">· {p.b.siklik} kez</span>
        </Show>
      </div>
      <strong class="bulgu__baslik">{p.b.baslik}</strong>
      <Show when={p.b.oneri}>
        <p class="kucuk soluk">Öneri: {p.b.oneri}</p>
      </Show>
      <Show when={acik()}>
        <Show when={p.b.adimlar?.length}>
          <ol class="bulgu__adimlar">
            <For each={p.b.adimlar}>{(a) => <li>{a}</li>}</For>
          </ol>
        </Show>
        <Show when={p.b.kanit}>
          <pre class="bulgu__kanit">{p.b.kanit}</pre>
        </Show>
      </Show>
      <div class="bulgu__ayak">
        <Show when={p.b.adimlar?.length || p.b.kanit}>
          <button
            type="button"
            class="dg dg--hayalet dg--k"
            aria-expanded={acik()}
            onClick={() => setAcik(!acik())}
          >
            {acik() ? "Ayrıntıyı gizle" : "Adımlar ve kanıt"}
          </button>
        </Show>
        <button type="button" class="dg dg--k" onClick={isAc}>
          <Simge ad="arti" /> İş aç
        </button>
      </div>
    </article>
  );
}

export function RaporPanosu(p: { oge: OgeAyrinti; gecmis?: OgeAyrinti[] | undefined }): JSX.Element {
  const r = createMemo(() => raporOku(p.oge));
  /** Aynı alanın bu rapordan eski raporları (en yeni başta). */
  const eskiler = createMemo(() =>
    (p.gecmis ?? []).filter((x) => x.alan === p.oge.alan && x.id < p.oge.id && raporOku(x) !== null),
  );
  const onceki = createMemo(() => raporOku(eskiler()[0]));
  const [onemSuzgec, setOnemSuzgec] = createSignal<Onem | null>(null);
  const [oyunSuzgec, setOyunSuzgec] = createSignal<string | null>(null);
  const fark = createMemo(() => bulguFarki(r()?.bulgular ?? [], onceki()?.bulgular ?? []));
  const oyunlar = createMemo(() => [
    ...new Set((r()?.bulgular ?? []).map((b) => b.oyun).filter((x): x is string => !!x)),
  ]);
  const bulgular = createMemo(() =>
    [...(r()?.bulgular ?? [])]
      .filter((b) => (!onemSuzgec() || b.onem === onemSuzgec()) && (!oyunSuzgec() || b.oyun === oyunSuzgec()))
      .sort((a, b) => ONEMLER.indexOf(a.onem) - ONEMLER.indexOf(b.onem) || (b.siklik ?? 0) - (a.siklik ?? 0)),
  );
  const sayi = (o: Onem): number => (r()?.bulgular ?? []).filter((b) => b.onem === o).length;
  const gidisat = (ad: string): number[] => {
    const seri = [...eskiler()]
      .reverse()
      .slice(-9)
      .map((x) => raporOku(x)?.ozet.find((k) => k.ad === ad)?.deger);
    const simdi = r()?.ozet.find((k) => k.ad === ad)?.deger;
    return [...seri, simdi].filter((v): v is number => typeof v === "number");
  };
  return (
    <Show when={r()}>
      {(rp) => (
        <div class="rapor-panosu">
          <header class="rapor-panosu__bas">
            <div>
              <h2>{rp().baslik ?? p.oge.ad}</h2>
              <p class="soluk kucuk">
                {[rp().donem, tarihSaat(p.oge.olusturma)].filter(Boolean).join(" · ")}
                <Show when={eskiler()[0]}>
                  {(e) => <> · önceki rapor {tarihSaat(e().olusturma)} ile karşılaştırılıyor</>}
                </Show>
              </p>
            </div>
            <Show when={rp().bulgular.length}>
              <div class="onem-ozeti">
                <For each={ONEMLER}>
                  {(o) => (
                    <Show when={sayi(o)}>
                      <span class={`etiket ${ONEM_SINIFI[o]}`}>
                        {sayi(o)} {ONEM_ADI[o].toLocaleLowerCase("tr-TR")}
                      </span>
                    </Show>
                  )}
                </For>
              </div>
            </Show>
          </header>

          <Show when={rp().ozet.length}>
            <div class="rk-izgara">
              <For each={rp().ozet}>{(k) => <Kutucuk k={k} onceki={onceki()} gidisat={gidisat(k.ad)} />}</For>
            </div>
          </Show>

          <Show when={rp().seriler.length}>
            <div class="grafik-izgara">
              <For each={rp().seriler}>
                {(s) => (
                  <Grafik seri={s} onceki={onceki()?.seriler.find((x) => x.ad === s.ad && x.tur === s.tur)} />
                )}
              </For>
            </div>
          </Show>

          <Show when={rp().bulgular.length || onceki()?.bulgular.length}>
            <section class="yigin">
              <div class="satir satir--ara satir--sar">
                <h3>
                  Bulgular <span class="cok-soluk">({rp().bulgular.length})</span>
                </h3>
                <Show when={onceki()}>
                  <span class="kucuk soluk">
                    {fark().yeni.size} yeni · {fark().cozulen.length} çözülmüş (önceki raporda vardı)
                  </span>
                </Show>
              </div>
              <fieldset class="cipler" aria-label="Bulgu süzgeci">
                <button
                  type="button"
                  class="cip"
                  aria-pressed={!onemSuzgec()}
                  onClick={() => setOnemSuzgec(null)}
                >
                  Hepsi
                </button>
                <For each={ONEMLER.filter((o) => sayi(o) > 0)}>
                  {(o) => (
                    <button
                      type="button"
                      class="cip"
                      aria-pressed={onemSuzgec() === o}
                      onClick={() => setOnemSuzgec(onemSuzgec() === o ? null : o)}
                    >
                      {ONEM_ADI[o]} · {sayi(o)}
                    </button>
                  )}
                </For>
                <Show when={oyunlar().length > 1}>
                  <select
                    class="girdi girdi--kucuk"
                    aria-label="Oyun"
                    value={oyunSuzgec() ?? ""}
                    onChange={(e) => setOyunSuzgec(e.currentTarget.value || null)}
                  >
                    <option value="">Bütün oyunlar</option>
                    <For each={oyunlar()}>{(o) => <option value={o}>{o}</option>}</For>
                  </select>
                </Show>
              </fieldset>
              <div class="bulgu-izgara">
                <For each={bulgular()} fallback={<p class="soluk kucuk">Bu süzgeçte bulgu yok.</p>}>
                  {(b) => (
                    <BulguKarti
                      b={b}
                      alan={p.oge.alan}
                      yeni={!!onceki() && fark().yeni.has(b.baslik.toLocaleLowerCase("tr-TR").trim())}
                    />
                  )}
                </For>
              </div>
              <Show when={fark().cozulen.length}>
                <details class="cozulenler">
                  <summary>Önceki raporda olup artık görünmeyen {fark().cozulen.length} bulgu</summary>
                  <ul>
                    <For each={fark().cozulen}>
                      {(b) => (
                        <li>
                          <span class={`etiket ${ONEM_SINIFI[b.onem]}`}>{ONEM_ADI[b.onem]}</span> {b.baslik}
                        </li>
                      )}
                    </For>
                  </ul>
                </details>
              </Show>
            </section>
          </Show>

          <For each={rp().tablolar}>
            {(t) => (
              <section class="yigin">
                <h3>{t.ad}</h3>
                <div class="tablo-kap">
                  <table class="tablo">
                    <thead>
                      <tr>
                        <For each={t.sutunlar}>{(s) => <th scope="col">{s}</th>}</For>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={t.satirlar}>
                        {(s) => (
                          <tr>
                            <For each={s}>
                              {(h) => (
                                <td class={typeof h === "number" ? "sayi-hucre" : ""}>
                                  {typeof h === "number" ? sayiBicimi(h) : h}
                                </td>
                              )}
                            </For>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </For>
        </div>
      )}
    </Show>
  );
}
